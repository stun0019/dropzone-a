import * as THREE from "three";
import { runtime } from "./runtime.js";
import { recycleMob, sightDistance, disposeMesh } from "./navigation.js";
import { message, showHit } from "./hud.js";
import { WEAPON_RATES } from "./config.js";
import { sound } from "./audio.js";
import { playAnimation } from "./assets.js";
import { captureProbability, rollMobLoot } from "./economy.js";
import { killBot } from "./session.js";
import { mat } from "./models.js";
import { moveEntity } from "./actors.js";

export function aimFromScreen(clientX, clientY) {
  const rect = runtime.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    (-(clientY - rect.top) / rect.height) * 2 + 1,
  );
  runtime.raycaster.setFromCamera(ndc, runtime.camera);
  const out = new THREE.Vector3();
  if (runtime.raycaster.ray.intersectPlane(runtime.groundPlane, out))
    runtime.aimPoint.copy(out);
  runtime.$("crosshair").style.left =
    ((clientX - rect.left) / rect.width) * 100 + "%";
  runtime.$("crosshair").style.top =
    ((clientY - rect.top) / rect.height) * 100 + "%";
}

export function makeBeam(origin, end, isPlayer, weapon = "rifle") {
  const kind = isPlayer ? "player" : "enemy",
    delta = end.clone().sub(origin),
    length = delta.length();
  if (length < 0.01) return;
  let group = runtime.beamPool[kind].pop();
  if (!group) {
    group = new THREE.Group();
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(
        isPlayer ? 0.045 : 0.025,
        isPlayer ? 0.045 : 0.025,
        1,
        6,
      ),
      new THREE.MeshBasicMaterial({
        color: isPlayer ? 0xfff36a : 0xf08162,
        transparent: true,
        depthWrite: false,
      }),
    );
    m.position.y = 0.5;
    group.add(m);
    if (isPlayer) {
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 1, 5),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          depthWrite: false,
        }),
      );
      core.position.y = 0.5;
      group.add(core);
    }
  }
  for (let i = 0; i < group.children.length; i++) {
    const m = group.children[i];
    m.material.opacity = isPlayer ? 1 : 0.45;
    m.material.color.setHex(
      i
        ? 0xffffff
        : weapon === "acid"
          ? 0xa3d345
          : weapon === "laser"
            ? 0x62eaff
            : weapon === "rocket"
              ? 0xff9f48
              : isPlayer
                ? 0xfff36a
                : 0xf08162,
    );
  }
  group.scale.set(1, length, 1);
  group.position.copy(origin);
  group.quaternion.setFromUnitVectors(runtime.UP, delta.normalize());
  const duration =
    weapon === "laser"
      ? 0.14
      : Math.max(0.06, length / (weapon === "rocket" ? 35 : 150));
  if (weapon !== "laser")
    group.scale.set(
      weapon === "rocket" ? 3 : 1,
      Math.min(length, weapon === "rocket" ? 0.7 : 1.2),
      weapon === "rocket" ? 3 : 1,
    );
  runtime.scene.add(group);
  runtime.G.tracers.push({
    mesh: group,
    kind,
    life: duration,
    max: duration,
    origin: origin.clone(),
    end: end.clone(),
    direction: delta.clone(),
    length,
    weapon,
  });
}

export function impactEffect(position, isPlayerHit = false) {
  let group = runtime.impactPool.pop();
  const color = isPlayerHit ? 0xf08162 : 0xfff18b;
  if (!group) {
    group = new THREE.Group();
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        depthTest: false,
      }),
    );
    group.add(sphere);
    for (let i = 0; i < 4; i++) {
      const spark = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.65),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 1,
          depthTest: false,
        }),
      );
      spark.rotation.y = (i * Math.PI) / 2;
      spark.rotation.x = Math.PI / 2;
      group.add(spark);
    }
  }
  group.scale.setScalar(1);
  for (const m of group.children) {
    m.material.opacity = 1;
    m.material.color.setHex(color);
  }
  group.position.copy(position);
  runtime.scene.add(group);
  runtime.G.impacts.push({ mesh: group, life: 0.24, max: 0.24 });
}

export function worldToScreen(position) {
  const point = position.clone().project(runtime.camera);
  const rect = runtime.game.getBoundingClientRect();
  return {
    x: (point.x * 0.5 + 0.5) * rect.width,
    y: (-0.5 * point.y + 0.5) * rect.height,
  };
}

export function showLootBurst(position, loot, amount) {
  const node = document.createElement("div");
  node.className = "lootBurst loot-" + loot.type;
  const icon = document.createElement("div");
  icon.className = "lootIcon";
  const label = document.createElement("div");
  label.className = "lootText";
  label.textContent = loot.label + " ×" + loot.odds + "  +" + amount;
  node.append(icon, label);
  runtime.$("floaters").append(node);
  runtime.G.flights.push({ node, position: position.clone(), age: 0 });
}

export function updateCaptures(dt) {
  for (const b of runtime.G.bots) {
    if (!b.dead) continue;
    b.captureAge += dt;
    const t = b.captureAge;
    b.mesh.rotation.z = -runtime.clamp((t - 0.08) / 0.4, 0, 1) * 1.4;
    b.mesh.scale.setScalar(
      (b.mesh.userData.baseScale || 1) *
        (1 - runtime.clamp((t - 0.7) / 0.3, 0, 1) * 0.95),
    );
    if (t >= 0.28 && !b.lootShown) {
      b.lootShown = true;
      showLootBurst(
        b.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)),
        b.loot,
        b.win,
      );
    }
  }
  for (let i = runtime.G.bots.length - 1; i >= 0; i--)
    if (runtime.G.bots[i].dead && runtime.G.bots[i].captureAge >= 1) {
      recycleMob(runtime.G.bots[i]);
      runtime.G.bots.splice(i, 1);
    }
  const rect = runtime.game.getBoundingClientRect(),
    dest = runtime.$("credits").getBoundingClientRect();
  for (let i = runtime.G.flights.length - 1; i >= 0; i--) {
    const f = runtime.G.flights[i];
    f.age += dt;
    const p = worldToScreen(f.position);
    const travel = runtime.clamp((f.age - 0.65) / 0.6, 0, 1),
      ease = travel * travel;
    const x = p.x + (dest.left + dest.width / 2 - rect.left - p.x) * ease;
    const y =
      p.y - 45 + (dest.top + dest.height / 2 - rect.top - p.y + 45) * ease;
    f.node.style.left = x + "px";
    f.node.style.top = y + "px";
    f.node.style.transform =
      "translate(-50%,-50%) scale(" +
      (travel ? 1 - travel * 0.8 : Math.min(1.1, 0.4 + f.age * 5)) +
      ")";
    f.node.style.opacity = String(travel > 0.8 ? (1 - travel) * 5 : 1);
    if (f.age >= 1.25) {
      f.node.remove();
      runtime.G.flights.splice(i, 1);
      runtime.$("economy").classList.remove("reward");
      void runtime.$("economy").offsetWidth;
      runtime.$("economy").classList.add("reward");
    }
  }
}

export function shoot(shooter, dir, isPlayer = false) {
  if (
    !isPlayer ||
    runtime.state !== "playing" ||
    runtime.G.transition > 0 ||
    runtime.G.choosing ||
    runtime.tacticalPanel ||
    runtime.G.fireCd > 0
  )
    return;
  if (runtime.G.credits < runtime.G.bet) {
    runtime.G.auto = false;
    message("點數不足", 1.4);
    return;
  }
  const bet = runtime.G.bet;
  playAnimation(shooter.mesh, "shoot");
  runtime.G.credits -= bet;
  runtime.G.wagered += bet;
  runtime.G.fireCd += 1 / WEAPON_RATES[runtime.G.weapons[0]];
  const intended = runtime.G.auto
      ? runtime.G.autoTarget
      : runtime.G.hoverTarget,
    attacks = [],
    entries = new Map();
  [runtime.G.player, ...runtime.G.followers].forEach((member, index) => {
    const weapon = runtime.G.weapons[index];
    if (index > 0 && runtime.G.bet <= 10 && weapon === "rifle") return;
    if (index > 0 && runtime.G.weaponCds[index] > 1e-9) return;
    runtime.G.weaponCds[index] = 1 / WEAPON_RATES[weapon];
    const origin = member.mesh.position
      .clone()
      .add(new THREE.Vector3(0, 1.55, 0));
    const direction =
      intended && !intended.dead
        ? intended.mesh.position.clone().sub(origin).setY(0).normalize()
        : dir.clone();
    const range = sightDistance(
      origin,
      direction,
      weapon === "grenade" ? 25 : 35,
    );
    let best = range,
      hit = null;
    const candidates = [];
    for (const b of runtime.G.bots) {
      if (b.dead || b.pendingCapture) continue;
      const center = b.mesh.position.clone().setY(1.55);
      const along = center.clone().sub(origin).dot(direction);
      if (along < 0 || along > range) continue;
      const distance = origin
        .clone()
        .addScaledVector(direction, along)
        .distanceTo(center);
      if (weapon === "grenade") {
        if (distance < Math.max(2.2, (b.radius || 0.55) + 1))
          candidates.push(b);
      } else if (distance < Math.max(0.7, b.radius || 0.55) && along < best) {
        best = along;
        hit = b;
      }
    }
    if (hit) candidates.push(hit);
    const end = origin.clone().addScaledVector(direction, best);
    const delay =
      weapon === "grenade"
        ? 0.85
        : weapon === "rocket"
          ? Math.max(0.06, best / 35)
          : weapon === "laser"
            ? 0.03
            : Math.max(0.03, best / 150);
    attacks.push({ origin, end, weapon, candidates, delay });
    for (const b of candidates)
      if (!entries.has(b) || entries.get(b) > delay) entries.set(b, delay);
  });
  for (const attack of attacks) {
    weaponEffect(attack.origin, attack.end, attack.weapon);
  }
  sound(runtime.G.weapons[0]);
  if (entries.size) {
    runtime.G.eligibleWagered += bet;
    for (const [b, delay] of entries) {
      b.hitTime = 0.18;
      if (b.mesh.userData.body?.material?.emissive) b.mesh.userData.body.material.emissive.setHex(0xffffff);
      if (Math.random() < captureProbability(b, entries.size)) {
        b.pendingCapture = true;
        runtime.G.resolutions.push({
          bot: b,
          bet,
          loot: rollMobLoot(b),
          life: delay,
        });
      }
    }
  }
}

export function settleCaptures(dt = 0, flush = false) {
  for (const item of runtime.G.resolutions) {
    item.life -= dt;
    if (flush || item.life <= 0) {
      item.bot.pendingCapture = false;
      if (!item.bot.dead) {
        killBot(item.bot, "你", item.bet, item.loot);
        showHit(centerOf(item.bot), true);
      }
      item.done = true;
    }
  }
  runtime.G.resolutions = runtime.G.resolutions.filter((item) => !item.done);
}

export function weaponEffect(origin, end, weapon) {
  if (weapon === "grenade") {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      mat(0x556d35),
    );
    mesh.position.copy(origin);
    runtime.scene.add(mesh);
    runtime.G.grenades.push({
      mesh,
      origin: origin.clone(),
      end: end.clone(),
      age: 0,
      duration: 0.85,
      seen: new Set(),
      previous: origin.clone(),
    });
    sound("grenade");
  } else if (weapon === "shotgun") {
    const d = end.clone().sub(origin),
      length = d.length();
    for (let i = -2; i <= 2; i++) {
      const ray = d
        .clone()
        .normalize()
        .applyAxisAngle(runtime.UP, i * 0.035);
      makeBeam(
        origin,
        origin.clone().addScaledVector(ray, sightDistance(origin, ray, length)),
        true,
      );
    }
  } else makeBeam(origin, end, true, weapon);
}

export function knockMob(b, direction) {
  if (
    b.dead ||
    b.type === "boss" ||
    runtime.G.time - (b.lastKnock ?? -10) < 0.4
  )
    return;
  b.lastKnock = runtime.G.time;
  b.airborne = 0.7;
  b.airborneMax = 0.7;
  b.knockVelocity = direction.clone().setY(0).normalize().multiplyScalar(12);
  b.nav = null;
  sound("knock");
}

export function updateGrenades(dt) {
  for (const g of runtime.G.grenades) {
    g.age += dt;
    const t = runtime.clamp(g.age / g.duration, 0, 1);
    const ground = g.origin.clone().lerp(g.end, t),
      direction = g.end.clone().sub(g.origin).setY(0).normalize();
    g.mesh.position.copy(ground);
    g.mesh.position.y += Math.sin(t * Math.PI) * 4;
    g.mesh.rotation.x += dt * 9;
    const a = g.previous.clone().setY(0),
      segment = ground.clone().setY(0).sub(a),
      length2 = segment.lengthSq();
    for (const b of runtime.G.bots) {
      if (b.dead || g.seen.has(b)) continue;
      const pos = b.mesh.position.clone().setY(0);
      const along = length2
        ? runtime.clamp(pos.clone().sub(a).dot(segment) / length2, 0, 1)
        : 0;
      if (pos.distanceTo(a.clone().addScaledVector(segment, along)) < 2.3) {
        g.seen.add(b);
        knockMob(b, direction);
      }
    }
    g.previous.copy(ground);
    if (t === 1) {
      impactEffect(g.end);
      const effect = runtime.G.impacts.at(-1);
      effect.blast = true;
      effect.life = effect.max = 0.45;
      disposeMesh(g.mesh);
      sound("explosion");
    }
  }
  runtime.G.grenades = runtime.G.grenades.filter((g) => g.age < g.duration);
  for (const b of runtime.G.bots) {
    if (b.dead || !b.airborne) continue;
    b.airborne = Math.max(0, b.airborne - dt);
    moveEntity(b, b.knockVelocity.clone().multiplyScalar(dt));
    b.knockVelocity.multiplyScalar(Math.exp(-dt * 3));
    b.mesh.position.y =
      Math.sin((1 - b.airborne / b.airborneMax) * Math.PI) * 2.5;
    b.mesh.rotation.z =
      Math.sin((1 - b.airborne / b.airborneMax) * Math.PI) * 0.6;
    if (!b.airborne) {
      b.mesh.position.y = 0;
      b.mesh.rotation.z = 0;
    }
  }
}

export function centerOf(target) {
  return target.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0));
}
