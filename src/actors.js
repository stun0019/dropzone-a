import * as THREE from "three";
import { runtime } from "./runtime.js";
import { WORLD, TAU, MOB_KEYS, MOB_TYPES, BOSS_TYPES } from "./config.js";
import { makeBoss, makeMob } from "./models.js";
import { message, feed } from "./hud.js";
import { sound } from "./audio.js";
import { patrolDestination } from "./player.js";
import { steer, animateMob, visibleTarget } from "./navigation.js";
import { makeBeam, impactEffect } from "./combat.js";
import { playAnimation } from "./assets.js";

export function randomSpawn(min = 12, max = WORLD * 0.84) {
  const a = runtime.rand(0, TAU),
    r = Math.sqrt(runtime.rand(min * min, max * max));
  return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
}

export function spawnBot(i, boss = false, eventPos = null) {
  // Count captured bodies until their exit animation finishes as well.
  if (boss && runtime.G.bots.filter((b) => b.type === "boss").length >= 3)
    return false;
  const type = boss
      ? "boss"
      : eventPos
        ? ["zombie", "brute", "spitter"][i % 3]
        : MOB_KEYS[i % MOB_KEYS.length],
    spec = MOB_TYPES[type];
  const variant = boss ? runtime.G.bossSerial % BOSS_TYPES.length : null;
  const pool = runtime.mobPool[type],
    poolIndex = boss
      ? pool.findIndex((m) => m.userData.bossVariant === variant)
      : pool.length - 1;
  const mesh =
    (poolIndex >= 0 ? pool.splice(poolIndex, 1)[0] : null) ||
    (boss ? makeBoss(variant) : makeMob(type));
  const radius = boss ? 1.7 : spec.radius + 0.2;
  let pos = null,
    bestSpace = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = runtime.rand(0, TAU),
      r = runtime.rand(2, 12);
    const candidate = eventPos
      ? new THREE.Vector3(
          runtime.rand(eventPos.minX + 4, eventPos.maxX - 4),
          0,
          runtime.rand(eventPos.minZ + 4, eventPos.maxZ - 4),
        )
      : randomSpawn();
    if (
      collides(candidate, radius) ||
      candidate.distanceToSquared(runtime.G.player.mesh.position) <
        (eventPos ? 16 : 64)
    )
      continue;
    const space = runtime.G.bots
      .filter((b) => !b.dead)
      .reduce(
        (min, b) => Math.min(min, candidate.distanceToSquared(b.mesh.position)),
        2500,
      );
    if (space < (eventPos ? 9 : 49)) continue;
    if (space > bestSpace) {
      pos = candidate;
      bestSpace = space;
    }
    if (attempt >= 11 && pos) break;
  }
  if (!pos) {
    runtime.mobPool[type].push(mesh);
    return false;
  }
  mesh.position.copy(pos);
  runtime.scene.add(mesh);
  const serial = ++runtime.G.enemySerial,
    boost = 1 + (runtime.G.stage - 1) * 0.22;
  runtime.G.bots.push({
    mesh,
    type,
    variant,
    eventSpawn: !!eventPos,
    sector: eventPos,
    faction: boss ? (variant === 2 ? "soldier" : "zombie") : spec.faction,
    dead: false,
    radius: boss ? 1.5 : spec.radius,
    fireCd: runtime.rand(0.5, 2),
    think: runtime.rand(0.1, 0.4),
    dir: new THREE.Vector3(0, 0, -1),
    speed: (boss ? BOSS_TYPES[variant].speed : spec.speed) * boost,
    name:
      (boss ? "BOSS · " + BOSS_TYPES[variant].name : spec.name) +
      "-" +
      String(serial).padStart(2, "0"),
    target: null,
    walk: runtime.rand(0, 10),
    patrolHome: pos.clone(),
    wander: pos.clone(),
    engage: 0,
    rest: runtime.rand(3, 6),
    turnSide: i % 2 ? 1 : -1,
    hitTime: 0,
  });
  runtime.G.alive++;
  playAnimation(mesh, "idle");
  if (boss) {
    runtime.G.bossSerial++;
    message("BOSS 出現 · " + BOSS_TYPES[variant].name, 2.5);
    feed(BOSS_TYPES[variant].name + " 已進入戰區");
    sound("boss");
  }
  return true;
}

export function collides(pos, r = 0.55) {
  if (Math.abs(pos.x) > WORLD - 3 || Math.abs(pos.z) > WORLD - 3) return true;
  return runtime.coverBounds.some(
    (b) =>
      pos.x > b.min.x - r &&
      pos.x < b.max.x + r &&
      pos.z > b.min.z - r &&
      pos.z < b.max.z + r,
  );
}

export function moveEntity(entity, delta) {
  const old = entity.mesh.position.clone();
  entity.mesh.position.x += delta.x;
  if (collides(entity.mesh.position, entity.radius || 0.55)) {
    entity.mesh.position.x = old.x;
  }
  entity.mesh.position.z += delta.z;
  if (collides(entity.mesh.position, entity.radius || 0.55)) {
    entity.mesh.position.z = old.z;
  }
}

export function updateBots(dt) {
  for (const b of runtime.G.bots) {
    if (b.dead || b.airborne) continue;
    const spec = MOB_TYPES[b.type],
      peaceful = !!spec?.peaceful;
    const ranged = spec?.range > 10 || (b.type === "boss" && b.variant === 2);
    const toxic =
      b.type === "spitter" || (b.type === "boss" && b.variant === 1);
    b.fireCd -= dt;
    b.think -= dt;
    b.engage -= dt;
    b.rest = Math.max(0, b.rest - dt);
    if (b.target && (b.target.dead || b.engage <= 0)) {
      b.target = null;
      b.rest = runtime.rand(4, 7);
      b.wander = patrolDestination(b);
      b.think = 0;
    }
    if (b.think <= 0) {
      b.think = runtime.rand(0.22, 0.42);
      if (!peaceful && !b.target && b.rest <= 0) {
        b.target = null;
        let best = 12 * 12;
        for (const o of runtime.G.bots) {
          if (o.dead || o.faction === b.faction || o.faction === "civilian")
            continue;
          const d = o.mesh.position.distanceToSquared(b.mesh.position);
          if (d < best) {
            best = d;
            b.target = o;
          }
        }
        if (b.target) b.engage = runtime.rand(1.2, 2.4);
        else b.rest = runtime.rand(1.5, 3);
      }
      if (b.mesh.position.distanceToSquared(b.wander) < 9)
        b.wander = patrolDestination(b);
      const destination = b.target ? b.target.mesh.position : b.wander;
      b.dir.copy(destination).sub(b.mesh.position);
      b.dir.y = 0;
      b.dir.normalize();
      if (peaceful) {
        const threat = runtime.G.bots.find(
          (o) =>
            !o.dead &&
            o.target &&
            o.mesh.position.distanceToSquared(b.mesh.position) < 100,
        );
        if (threat)
          b.dir
            .copy(b.mesh.position)
            .sub(threat.mesh.position)
            .setY(0)
            .normalize();
        else if (b.hitTime > 0)
          b.dir
            .copy(b.mesh.position)
            .sub(runtime.G.player.mesh.position)
            .setY(0)
            .normalize();
      }
      if (
        b.target &&
        ranged &&
        b.mesh.position.distanceToSquared(destination) < 100
      )
        b.dir.applyAxisAngle(runtime.UP, b.turnSide * 1.4);
    }
    if (b.target && b.target.dead) b.target = null;
    let distance = b.target
      ? b.mesh.position.distanceTo(b.target.mesh.position)
      : 100;
    const moving =
      !b.target ||
      distance > (ranged ? 7 : toxic ? 5 : b.type === "boss" ? 3 : 1.6);
    const travel = moving ? b.dir.clone() : new THREE.Vector3();
    for (const other of runtime.G.bots) {
      if (other === b || other.dead) continue;
      const away = b.mesh.position.clone().sub(other.mesh.position).setY(0),
        distance = away.length();
      const separation = Math.max(
        3.5,
        (b.radius || 0.55) + (other.radius || 0.55) + 1,
      );
      if (distance < separation && distance > 0.01)
        travel.addScaledVector(
          away.normalize(),
          (1 - distance / separation) * 2.5,
        );
    }
    if (travel.lengthSq() > 0.01) steer(b, travel.normalize(), dt, b.speed);
    const aim = b.target
      ? b.target.mesh.position.clone().sub(b.mesh.position).normalize()
      : b.dir;
    const aimYaw = Math.atan2(-aim.x, -aim.z);
    const yaw =
        spec?.vehicle && travel.lengthSq() > 0.01
          ? Math.atan2(-travel.x, -travel.z)
          : aimYaw,
      diff = Math.atan2(
        Math.sin(yaw - b.mesh.rotation.y),
        Math.cos(yaw - b.mesh.rotation.y),
      );
    b.mesh.rotation.y += diff * Math.min(1, dt * 7);
    animateMob(b, dt, moving);
    if (b.mesh.userData.turret)
      b.mesh.userData.turret.rotation.y = aimYaw - b.mesh.rotation.y;
    if (
      !peaceful &&
      b.target &&
      b.fireCd <= 0 &&
      distance < (spec?.range || (ranged ? 22 : toxic ? 7 : 3.6)) &&
      visibleTarget(b.mesh.position, b.target.mesh.position)
    ) {
      const end = b.target.mesh.position
        .clone()
        .add(new THREE.Vector3(0, 1.3, 0));
      if (ranged || toxic)
        makeBeam(
          b.mesh.position.clone().add(new THREE.Vector3(0, 1.55, 0)),
          end,
          false,
          toxic ? "acid" : b.type === "tank" ? "rocket" : "rifle",
        );
      impactEffect(end, true);
      b.target.hitTime = 0.1;
      b.fireCd =
        b.type === "tank" || b.type === "sniper"
          ? runtime.rand(1.8, 2.8)
          : ranged
            ? runtime.rand(0.7, 1.2)
            : runtime.rand(1, 1.6);
    }
  }
}
