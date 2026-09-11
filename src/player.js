import * as THREE from "three";
import { runtime } from "./runtime.js";
import {
  visibleTarget,
  sightDistance,
  navigateTo,
  animateMob,
  walkClear,
} from "./navigation.js";
import { MOB_TYPES, BOSS_TYPES, TAU } from "./config.js";
import { centerOf, aimFromScreen, shoot } from "./combat.js";
import { moveEntity, collides } from "./actors.js";
import { playAnimation, updateAnimation } from "./assets.js";

export function chooseTarget(dt) {
  if (runtime.G.credits <= runtime.tactics.stop) {
    runtime.G.auto = false;
    return null;
  }
  if (
    runtime.G.autoTarget &&
    !runtime.tactics.selected.has(runtime.G.autoTarget.type) &&
    !runtime.tactics.fallback
  ) {
    runtime.G.autoTarget = null;
    runtime.G.searchCd = 0;
  }
  runtime.G.searchCd -= dt;
  if (
    runtime.G.autoTarget &&
    (runtime.G.autoTarget.dead ||
      runtime.G.autoTarget.pendingCapture ||
      runtime.G.autoTarget.mesh.position.distanceToSquared(
        runtime.G.player.mesh.position,
      ) >
        55 * 55)
  ) {
    runtime.G.autoTarget = null;
    runtime.G.searchCd = 0;
  }
  if (runtime.G.searchCd > 0) return runtime.G.autoTarget;
  runtime.G.searchCd = 0.25;
  const pos = runtime.G.player.mesh.position;
  let best = null,
    score = Infinity;
  const preferred = runtime.G.bots.some(
    (b) => !b.dead && !b.pendingCapture && runtime.tactics.selected.has(b.type),
  );
  for (const b of runtime.G.bots) {
    if (b.dead || b.pendingCapture || (b.avoidUntil || 0) > runtime.G.time)
      continue;
    if (
      !runtime.tactics.selected.has(b.type) &&
      (preferred || !runtime.tactics.fallback)
    )
      continue;
    let value = b.mesh.position.distanceToSquared(pos);
    if (!visibleTarget(pos, b.mesh.position)) value *= 2.5;
    if (b === runtime.G.autoTarget) value *= 0.65;
    const rank = runtime.tactics.order.findIndex(
      (key) =>
        key === "near" ||
        (key === "bounty" &&
          runtime.tactics.bounty &&
          runtime.G.bounty?.bot === b) ||
        (key === "boss" && b.type === "boss") ||
        (key === "infected" &&
          runtime.tactics.infection &&
          runtime.G.infection &&
          b.mesh.position.x >= runtime.G.infection.sector.minX &&
          b.mesh.position.x <= runtime.G.infection.sector.maxX &&
          b.mesh.position.z >= runtime.G.infection.sector.minZ &&
          b.mesh.position.z <= runtime.G.infection.sector.maxZ) ||
        (key === "vehicle" && MOB_TYPES[b.type]?.vehicle),
    );
    value += (rank < 0 ? runtime.tactics.order.length : rank) * 100000;
    if (value < score) {
      score = value;
      best = b;
    }
  }
  runtime.G.autoTarget = best;
  return best;
}

export function updateLock() {
  const b = runtime.G.auto ? runtime.G.autoTarget : runtime.G.hoverTarget,
    el = runtime.$("lockTarget");
  if (runtime.state !== "playing" || runtime.G.transition > 0 || !b || b.dead) {
    el.style.display = "none";
    return;
  }
  const p = centerOf(b).project(runtime.camera);
  if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) {
    el.style.display = "none";
    return;
  }
  b.mesh.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(b.mesh),
    rect = runtime.game.getBoundingClientRect();
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(runtime.camera);
        if (point.z < -1 || point.z > 1) {
          el.style.display = "none";
          return;
        }
        const sx = (point.x * 0.5 + 0.5) * rect.width,
          sy = (-point.y * 0.5 + 0.5) * rect.height;
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
  const pad = 4;
  el.style.display = "block";
  el.style.left = left - pad + "px";
  el.style.top = top - pad + "px";
  el.style.width = right - left + pad * 2 + "px";
  el.style.height = bottom - top + pad * 2 + "px";
  runtime.$("lockName").textContent =
    (runtime.G.auto ? "LOCK / " : "") +
    (b.type === "boss"
      ? "BOSS · " + BOSS_TYPES[b.variant].name
      : MOB_TYPES[b.type].name);
}

export function pickHoveredMob() {
  if (!runtime.pointer) return null;
  runtime.camera.updateMatrixWorld(true);
  aimFromScreen(runtime.pointer.x, runtime.pointer.y);
  const origin = runtime.raycaster.ray.origin,
    direction = runtime.raycaster.ray.direction;
  const limit = sightDistance(origin, direction, 150);
  let picked = null,
    best = limit;
  for (const b of runtime.G.bots) {
    if (b.dead || b.pendingCapture) continue;
    b.mesh.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(b.mesh).expandByScalar(0.15);
    const point = runtime.raycaster.ray.intersectBox(
      bounds,
      new THREE.Vector3(),
    );
    if (point) {
      const distance = origin.distanceTo(point);
      if (distance < best) {
        best = distance;
        picked = b;
      }
    }
  }
  return picked;
}

export function updatePlayer(dt) {
  const p = runtime.G.player;
  updateAnimation(p.mesh, dt);
  runtime.G.weaponCds = runtime.G.weaponCds.map((cd) => Math.max(0, cd - dt));
  let x =
    Number(runtime.keys.has("d") || runtime.keys.has("arrowright")) -
    Number(runtime.keys.has("a") || runtime.keys.has("arrowleft"));
  let z =
    Number(runtime.keys.has("s") || runtime.keys.has("arrowdown")) -
    Number(runtime.keys.has("w") || runtime.keys.has("arrowup"));
  if (Math.hypot(runtime.joyVec.x, runtime.joyVec.y) > 0.1) {
    x = runtime.joyVec.x;
    z = runtime.joyVec.y;
  }
  const manualMove = Math.hypot(x, z) > 0.1;
  runtime.G.manualApproach = manualMove;
  const target = runtime.G.auto ? chooseTarget(dt) : null;
  const move = new THREE.Vector3(x, 0, z);
  if (target && !manualMove && runtime.tactics.move) {
    const d = target.mesh.position.clone().sub(p.mesh.position);
    d.y = 0;
    const distance = d.length(),
      clear = visibleTarget(p.mesh.position, target.mesh.position);
    // Separate stopping and restarting distances prevent repeated tiny chase steps.
    if (p.chaseTarget !== target) {
      p.chaseTarget = target;
      p.chasing = distance > runtime.tactics.distance + 6;
      p.blockedTime = 0;
      p.nav = null;
    }
    p.blockedTime = clear ? 0 : (p.blockedTime || 0) + dt;
    if (clear && distance <= runtime.tactics.distance) {
      p.chasing = false;
      p.nav = null;
    } else if (distance > runtime.tactics.distance + 6 || p.blockedTime > 0.45)
      p.chasing = true;
    if (p.chasing) move.copy(d.normalize());
  } else {
    p.chaseTarget = null;
    p.chasing = false;
    p.blockedTime = 0;
    p.nav = null;
  }
  let supplyGoal = null;
  if (
    runtime.G.auto &&
    runtime.tactics.move &&
    runtime.tactics.supply &&
    !manualMove &&
    runtime.G.supplies.length
  ) {
    supplyGoal = runtime.G.supplies
      .slice()
      .sort(
        (a, b) =>
          a.pos.distanceToSquared(p.mesh.position) -
          b.pos.distanceToSquared(p.mesh.position),
      )[0].pos;
    if (p.mesh.position.distanceTo(supplyGoal) > 2)
      move.copy(supplyGoal).sub(p.mesh.position).setY(0).normalize();
    else move.set(0, 0, 0);
    runtime.G.manualApproach = true;
  }
  if (move.lengthSq() > 0.01) {
    move.normalize();
    if (runtime.G.auto && !manualMove) {
      if (!navigateTo(p, supplyGoal || target.mesh.position, dt, 6.4)) {
        if (target) target.avoidUntil = runtime.G.time + 4;
        runtime.G.autoTarget = null;
        runtime.G.searchCd = 0;
      }
    } else {
      p.nav = null;
      moveEntity(p, move.multiplyScalar(dt * 6.4));
    }
  }
  if (p.mesh.userData.actions) playAnimation(p.mesh, move.lengthSq() > 0.01 ? "walk" : "idle");
  for (let i = 0; i < (p.mesh.userData.legs?.children || []).length; i++)
    p.mesh.userData.legs.children[i].rotation.x =
      move.lengthSq() > 0.01
        ? Math.sin(runtime.G.time * 11 + i * Math.PI) * 0.35
        : 0;
  if (runtime.pointer && !runtime.G.auto)
    aimFromScreen(runtime.pointer.x, runtime.pointer.y);
  runtime.G.hoverTarget = runtime.G.auto ? null : pickHoveredMob();
  let dir;
  if (target) dir = target.mesh.position.clone().sub(p.mesh.position);
  else
    dir = (
      runtime.G.hoverTarget
        ? runtime.G.hoverTarget.mesh.position
        : runtime.aimPoint
    )
      .clone()
      .sub(p.mesh.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(0, 0, -1);
  else dir.normalize();
  p.yaw = Math.atan2(-dir.x, -dir.z);
  p.mesh.rotation.y = p.yaw;
  const firing =
    (!!runtime.G.hoverTarget &&
      (((runtime.mouseDown || runtime.keys.has(" ")) && !runtime.coarse) ||
      (runtime.mobileFiring && runtime.coarse))) ||
    (target &&
      runtime.tactics.fire &&
      target.mesh.position.distanceTo(p.mesh.position) < 33 &&
      visibleTarget(p.mesh.position, target.mesh.position));
  // Preserve the frame remainder for the equipped weapon's firing interval.
  runtime.G.fireCd =
    runtime.G.fireCd === 0 ? 0 : Math.max(-dt, runtime.G.fireCd - dt);
  if (firing) {
    if (runtime.G.fireCd <= 1e-9) {
      runtime.G.fireCd = Math.min(0, runtime.G.fireCd);
      shoot(p, dir, true);
    }
  } else runtime.G.fireCd = Math.max(0, runtime.G.fireCd);
}

export function updateFollowers(dt, snap = false) {
  const p = runtime.G.player;
  for (const f of runtime.G.followers || []) {
    updateAnimation(f.mesh, dt);
    const offset = new THREE.Vector3(f.side * 2.1, 0, 0.9).applyAxisAngle(
      runtime.UP,
      p.yaw,
    );
    const desired = p.mesh.position.clone().add(offset);
    // Tighten formation beside cover rather than placing a follower inside it.
    for (let i = 0; i < 5 && collides(desired); i++)
      desired.lerp(p.mesh.position, 0.3);
    if (snap) {
      f.mesh.position.copy(desired);
      f.mesh.rotation.y = p.yaw;
      continue;
    }
    const before = f.mesh.position.clone(),
      distance = desired.distanceTo(before);
    if (distance > 0.12) navigateTo(f, desired, dt, Math.min(9, distance * 5));
    const angle = Math.atan2(
      Math.sin(p.yaw - f.mesh.rotation.y),
      Math.cos(p.yaw - f.mesh.rotation.y),
    );
    f.mesh.rotation.y += angle * (1 - Math.exp(-dt * 12));
    animateMob(f, dt, f.mesh.position.distanceToSquared(before) > 0.00001);
  }
}

export function patrolDestination(b) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const angle = runtime.rand(0, TAU),
      distance = runtime.rand(8, 20);
    const p = b.patrolHome
      .clone()
      .add(
        new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance,
        ),
      );
    if (b.sector) {
      p.x = runtime.clamp(p.x, b.sector.minX + 3, b.sector.maxX - 3);
      p.z = runtime.clamp(p.z, b.sector.minZ + 3, b.sector.maxZ - 3);
    }
    if (
      !collides(p, b.radius || 0.55) &&
      walkClear(b.mesh.position.clone().setY(0), p, b.radius || 0.55)
    )
      return p;
  }
  return b.patrolHome.clone();
}
