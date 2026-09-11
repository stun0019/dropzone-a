import * as THREE from "three";
import { runtime } from "./runtime.js";
import { stageUpdate } from "./session.js";
import { updatePlayer, updateFollowers, updateLock } from "./player.js";
import { updateBots } from "./actors.js";
import { updateSupply, updateEvents } from "./events.js";
import {
  updateGrenades,
  settleCaptures,
  updateCaptures,
  impactEffect,
} from "./combat.js";
import { sound, updateAudio } from "./audio.js";
import { releaseEffect } from "./navigation.js";
import { drawMap, updateHud } from "./hud.js";
import { drawNativeUI } from "./ui.js";
const shadowTransform = new THREE.Object3D();

export function updateCamera(dt) {
  const p = runtime.G.player.mesh.position;
  const desired = new THREE.Vector3(p.x, p.y + 15, p.z + 17);
  runtime.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  if (runtime.G.shake > 0 && !runtime.reduced) {
    runtime.camera.position.x += runtime.rand(
      -runtime.G.shake,
      runtime.G.shake,
    );
    runtime.camera.position.y +=
      runtime.rand(-runtime.G.shake, runtime.G.shake) * 0.55;
    runtime.camera.position.z += runtime.rand(
      -runtime.G.shake,
      runtime.G.shake,
    );
  }
  runtime.camera.lookAt(p.x, p.y + 1, p.z - 3);
}

export function step(dt) {
  if (
    runtime.state !== "playing" ||
    runtime.G.choosing ||
    runtime.tacticalPanel
  )
    return;
  runtime.G.time += dt;
  const stagePaused = stageUpdate(dt);
  runtime.G.spawnShield = Math.max(0, runtime.G.spawnShield - dt);

  runtime.G.feedbackCd = Math.max(0, runtime.G.feedbackCd - dt);
  runtime.G.shake = Math.max(0, runtime.G.shake - dt * 1.5);
  if (!stagePaused) {
    updatePlayer(dt);
    updateFollowers(dt);
    updateBots(dt);
    updateSupply(dt);
    updateEvents(dt);
  }
  updateCamera(dt);
  updateGrenades(dt);
  settleCaptures(dt);
  updateCaptures(dt);

  for (const t of runtime.G.tracers) {
    t.life -= dt;
    if (t.weapon !== "laser") {
      const traveled = t.length * runtime.clamp(1 - t.life / t.max, 0, 1);
      t.mesh.position.copy(t.origin).addScaledVector(t.direction, traveled);
      t.mesh.scale.y = Math.min(
        t.mesh.scale.y,
        Math.max(0.01, t.length - traveled),
      );
    }
    if (t.life <= 0 && t.weapon === "rocket") {
      sound("explosion");
      impactEffect(t.end);
      const blast = runtime.G.impacts.at(-1);
      blast.max = blast.life = 0.5;
      blast.blast = true;
      runtime.G.shake = Math.max(runtime.G.shake, 0.12);
    }
    const opacity = runtime.clamp(t.life / t.max, 0, 1);
    for (const child of t.mesh.children)
      child.material.opacity = opacity * (t.kind === "enemy" ? 0.45 : 1);
    if (t.life <= 0) releaseEffect(t, runtime.beamPool[t.kind]);
  }
  runtime.G.tracers = runtime.G.tracers.filter((t) => t.life > 0);

  for (const impact of runtime.G.impacts) {
    impact.life -= dt;
    const progress = 1 - impact.life / impact.max;
    impact.mesh.scale.setScalar(1 + progress * (impact.blast ? 18 : 2.5));
    for (const child of impact.mesh.children)
      child.material.opacity = runtime.clamp(impact.life / impact.max, 0, 1);
    if (impact.life <= 0) releaseEffect(impact, runtime.impactPool);
  }
  runtime.G.impacts = runtime.G.impacts.filter((impact) => impact.life > 0);

  for (const b of runtime.G.bots) {
    if (b.dead) continue;
    const material = b.mesh.userData.body?.material;
    const emissive = Array.isArray(material) ? material[0]?.emissive : material?.emissive;
    emissive?.multiplyScalar(Math.pow(0.02, dt));
  }
  const playerMaterial = runtime.G.player.mesh.userData.body?.material;
  const playerEmissive = Array.isArray(playerMaterial) ? playerMaterial[0]?.emissive : playerMaterial?.emissive;
  playerEmissive?.multiplyScalar(Math.pow(0.018, dt));

  if (runtime.G.messageTime > 0) {
    runtime.G.messageTime -= dt;
    if (runtime.G.messageTime <= 0)
      runtime.$("message").classList.remove("show");
  }
}

export function render() {
  if (!runtime.renderer) return;
  if (runtime.contactShadows) {
    let count=0;
    const actors=runtime.G ? [runtime.G.player,...(runtime.G.followers || []),...runtime.G.bots] : [];
    for (const actor of actors) {
      if (!actor?.mesh || actor.dead || count>=512) continue;
      shadowTransform.position.copy(actor.mesh.position).setY(.04);
      shadowTransform.rotation.set(-Math.PI/2,0,0);
      shadowTransform.scale.setScalar((actor.radius || .65)*1.3);
      shadowTransform.updateMatrix(); runtime.contactShadows.setMatrixAt(count++,shadowTransform.matrix);
    }
    runtime.contactShadows.count=count;
    runtime.contactShadows.instanceMatrix.needsUpdate=true;
  }
  if (runtime.state === "menu") {
    runtime.camera.position.set(14, 17, 20);
    runtime.camera.lookAt(0, 1, 0);
  }
  runtime.renderer.render(runtime.scene, runtime.camera);
  const now = performance.now();
  if (now - (runtime.mapStamp || 0) > 100) { drawMap(); runtime.mapStamp = now; }
  if (runtime.nativeUI.scene) {
    drawNativeUI(performance.now());
    runtime.renderer.autoClear = false;
    runtime.renderer.clearDepth();
    runtime.renderer.render(runtime.nativeUI.scene, runtime.nativeUI.camera);
    runtime.renderer.autoClear = true;
  }
}

export function loop(now) {
  if (document.hidden) { runtime.last=now; requestAnimationFrame(loop); return; }
  if (runtime.coarse && runtime.last && now-runtime.last < 1000/60-1) {
    requestAnimationFrame(loop); return;
  }
  if (runtime.coarse) {
    runtime.frameAverage = (runtime.frameAverage || 16.7)*.97 + Math.min(100,now-runtime.last)*.03;
    if (now-(runtime.qualityStamp||0)>4000) {
      const ratio = runtime.frameAverage > 26 ? Math.max(.65,runtime.renderRatio-.1) : runtime.frameAverage < 18 ? Math.min(1,runtime.renderRatio+.05) : runtime.renderRatio;
      if (ratio!==runtime.renderRatio) { runtime.renderRatio=ratio; runtime.renderer.setPixelRatio(ratio); }
      runtime.qualityStamp=now;
    }
  }
  updateAudio();
  const dt = Math.min(0.05, (now - runtime.last) / 1000 || 0);
  runtime.last = now;
  if (runtime.state === "playing" && !document.hidden) step(dt);
  render();
  if (runtime.G) {
    runtime.G.displayCredits +=
      (runtime.G.credits - runtime.G.displayCredits) * (1 - Math.exp(-dt * 12));
    runtime.G.displayWins +=
      (runtime.G.winTotal - runtime.G.displayWins) * (1 - Math.exp(-dt * 10));
    updateLock();
  }
  runtime.hudElapsed += dt;
  if (runtime.hudElapsed > 0.05) {
    updateHud();
    runtime.hudElapsed = 0;
  }
  requestAnimationFrame(loop);
}

export function resize() {
  if (!runtime.renderer) return;
  const rect = runtime.game.getBoundingClientRect();
  runtime.renderer.setSize(rect.width, rect.height, false);
  runtime.camera.aspect = rect.width / rect.height;
  runtime.camera.updateProjectionMatrix();
}
