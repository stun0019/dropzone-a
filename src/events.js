import * as THREE from "three";
import { runtime } from "./runtime.js";
import { disposeMesh, walkClear, findPath, recycleMob } from "./navigation.js";
import { TAU, WEAPONS, MOB_TYPES, SECTORS, WORLD } from "./config.js";
import { collides, spawnBot } from "./actors.js";
import { box, mat } from "./models.js";
import { feed, message } from "./hud.js";
import { sound } from "./audio.js";

export function clearSupply() {
  for (const s of runtime.G.supplies) {
    disposeMesh(s.mesh);
    runtime.G.intel += 100;
  }
  runtime.G.supplies = [];
  runtime.G.selectedSupply = null;
  runtime.G.choosing = false;
  runtime.G.supplyNotice = 0;
  runtime.G.supplyNotices = [];
  runtime.$("supplyAlert").hidden = true;
}

export function spawnSupply() {
  if (runtime.G.supplies.length >= 3 || runtime.G.intel < 100) return false;
  const start = runtime.G.player.mesh.position;
  let pos = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = runtime.rand(0, TAU),
      distance = runtime.rand(20, 38);
    const candidate = start
      .clone()
      .add(
        new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance,
        ),
      );
    if (
      collides(candidate, 2) ||
      runtime.G.supplies.some((s) => s.pos.distanceTo(candidate) < 8)
    )
      continue;
    if (walkClear(start, candidate, 1.1) || findPath(start, candidate, 1.1)) {
      pos = candidate;
      break;
    }
  }
  if (!pos) return false;
  const root = new THREE.Group();
  const crate = box(1.8, 1.5, 1.8, 0x645140);
  crate.position.y = 0.75;
  root.add(crate);
  for (const x of [-0.62, 0.62]) {
    const band = box(0.14, 1.56, 1.86, 0xdaba68);
    band.position.set(x, 0.78, 0);
    root.add(band);
  }
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 6, 0, TAU, 0, Math.PI / 2),
    mat(0xd7c49b),
  );
  canopy.position.y = 4;
  root.add(canopy);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.9, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffb952,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    }),
  );
  beacon.position.y = 6;
  root.add(beacon);
  root.position.copy(pos);
  root.position.y = 18;
  runtime.scene.add(root);
  const choices = ["laser", "shotgun", "rocket", "grenade"];
  runtime.G.supplies.push({
    mesh: root,
    pos,
    canopy,
    beacon,
    age: 0,
    weapon: choices[Math.floor(Math.random() * choices.length)],
  });
  runtime.G.intel -= 100;
  runtime.G.supplyNotices.push("新空投即將抵達 · 雷達已標記");
  feed("新空投正在降落 · 靠近領取");
  return true;
}

export function updateSupply(dt) {
  runtime.G.supplyRetry = (runtime.G.supplyRetry || 0) - dt;
  if (runtime.G.supplyRetry <= 0) {
    if (runtime.G.supplies.length < 3 && runtime.G.intel >= 100) spawnSupply();
    runtime.G.supplyRetry = 2;
  }
  runtime.G.supplyNotice = Math.max(0, runtime.G.supplyNotice - dt);
  if (!runtime.G.supplyNotice && runtime.G.supplyNotices.length) {
    runtime.G.supplyNotice = 3;
    runtime.$("supplyAlert").textContent = runtime.G.supplyNotices.shift();
    sound("supply");
  }
  for (const s of runtime.G.supplies) {
    s.age += dt;
    s.mesh.position.y = Math.max(0, 18 - s.age * 6);
    s.canopy.visible = s.age < 3;
    s.beacon.material.opacity = 0.12 + Math.sin(s.age * 4) * 0.05;
  }
  const nearest = runtime.G.supplies
    .filter(
      (s) => s.age >= 3 && runtime.G.player.mesh.position.distanceTo(s.pos) < 4,
    )
    .sort(
      (a, b) =>
        a.pos.distanceToSquared(runtime.G.player.mesh.position) -
        b.pos.distanceToSquared(runtime.G.player.mesh.position),
    )[0];
  if (nearest && runtime.G.manualApproach) {
    runtime.G.selectedSupply = nearest;
    sound("pickup");
    equipSupply(Math.floor(Math.random() * 3));
  }
}

export function updateWeaponModels() {
  [runtime.G.player, ...runtime.G.followers].forEach((member, index) => {
    const weapon = runtime.G.weapons[index],
      gun = member.mesh.userData.gun;
    gun.scale.set(
      weapon === "rocket"
        ? 3
        : weapon === "shotgun"
          ? 1.8
          : weapon === "grenade"
            ? 2
            : 1,
      weapon === "rocket" ? 3 : weapon === "grenade" ? 2 : 1,
      weapon === "laser"
        ? 1.3
        : weapon === "rocket"
          ? 1.2
          : weapon === "grenade"
            ? 0.35
            : 1,
    );
    gun.material.color.setHex(
      weapon === "laser"
        ? 0x438b9e
        : weapon === "rocket"
          ? 0x687049
          : weapon === "grenade"
            ? 0x54733c
            : weapon === "shotgun"
              ? 0x94704d
              : 0x1c2421,
    );
  });
}

export function equipSupply(index) {
  if (!runtime.G || !runtime.G.selectedSupply || index < 0 || index > 2) return;
  const s = runtime.G.selectedSupply;
  runtime.G.weapons[index] = s.weapon;
  disposeMesh(s.mesh);
  runtime.G.supplies.splice(runtime.G.supplies.indexOf(s), 1);
  runtime.G.selectedSupply = null;
  runtime.G.choosing = false;
  runtime.G.manualApproach = false;
  updateWeaponModels();
  message(
    ["玩家", "左隨從", "右隨從"][index] + " 裝備 " + WEAPONS[s.weapon],
    2,
  );
  sound("equip");
}

export function eventRing(pos, radius, color) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.2, radius, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(pos).setY(0.06);
  runtime.scene.add(mesh);
  return mesh;
}

export function clearEvents() {
  if (runtime.G.infection) disposeMesh(runtime.G.infection.mesh);
  if (runtime.G.bounty) {
    runtime.G.bounty.bot.rewardScale = 1;
    disposeMesh(runtime.G.bounty.mesh);
  }
  runtime.G.infection = null;
  runtime.G.bounty = null;
  runtime.$("eventHud").textContent = "";
}

export function beginBounty() {
  const candidates = runtime.G.bots
    .filter(
      (b) =>
        !b.dead &&
        !b.pendingCapture &&
        !b.eventSpawn &&
        b.type !== "boss" &&
        b.faction !== "civilian",
    )
    .sort(
      (a, b) =>
        a.mesh.position.distanceToSquared(runtime.G.player.mesh.position) -
        b.mesh.position.distanceToSquared(runtime.G.player.mesh.position),
    )
    .slice(0, 8);
  if (!candidates.length) return false;
  const bot = candidates[Math.floor(Math.random() * candidates.length)];
  bot.rewardScale = 2;
  runtime.G.bounty = {
    bot,
    life: 35,
    mesh: eventRing(bot.mesh.position, 2.3, 0xffc456),
  };
  message("懸賞發布 · " + MOB_TYPES[bot.type].name + " · 獎勵倍率加倍", 3);
  sound("supply");
  return true;
}

export function beginInfection() {
  if (runtime.G.infection) return false;
  const sector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
  const pos = new THREE.Vector3(
    (sector.minX + sector.maxX) / 2,
    0,
    (sector.minZ + sector.maxZ) / 2,
  );
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshBasicMaterial({
      color: 0x93b92c,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(pos).setY(0.04);
  runtime.scene.add(mesh);
  runtime.G.infection = { pos, sector, life: 35, mesh };
  for (let i = 0; i < 16; i++) spawnBot(i, false, sector);
  message("感染爆發 · " + sector.name + " 全區警戒", 3);
  sound("boss");
  return true;
}

export function updateEvents(dt) {
  if (runtime.G.bounty) {
    const event = runtime.G.bounty;
    event.life = Math.max(0, event.life - dt);
    event.mesh.position.copy(event.bot.mesh.position).setY(0.06);
    if (event.bot.dead || (event.life === 0 && !event.bot.pendingCapture)) {
      feed(event.bot.dead ? "懸賞完成 · 獎勵已結算" : "懸賞時間結束");
      event.bot.rewardScale = 1;
      disposeMesh(event.mesh);
      runtime.G.bounty = null;
      runtime.G.bountyTimer = 55;
    }
  } else {
    runtime.G.bountyTimer -= dt;
    if (runtime.G.bountyTimer <= 0 && !beginBounty()) runtime.G.bountyTimer = 3;
  }
  if (runtime.G.infection) {
    runtime.G.infection.life -= dt;
    runtime.G.infection.mesh.material.opacity =
      0.12 + Math.sin(runtime.G.time * 3) * 0.035;
    if (runtime.G.infection.life <= 0) {
      disposeMesh(runtime.G.infection.mesh);
      runtime.G.infection = null;
      runtime.G.infectionTimer = 75;
      runtime.G.bots = runtime.G.bots.filter((b) => {
        if (b.eventSpawn && !b.dead && !b.pendingCapture) {
          recycleMob(b);
          runtime.G.alive--;
          return false;
        }
        return true;
      });
      feed("感染爆發結束");
    }
  } else {
    runtime.G.infectionTimer -= dt;
    if (runtime.G.infectionTimer <= 0 && !beginInfection())
      runtime.G.infectionTimer = 3;
  }
}
