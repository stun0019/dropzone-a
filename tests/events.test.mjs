import assert from "node:assert/strict";
import { createHarness } from "./harness.mjs";
const api = createHarness();
const nodes = { get: (id) => document.getElementById(id) };
api.init();
api.updateEvents(19);
assert(!api.G.bounty);
api.updateEvents(1);
assert(api.G.bounty);
const target = api.G.bounty.bot,
  prob = api.captureProbability(target);
assert.equal(target.rewardScale, 2);
target.rewardScale = 1;
assert(Math.abs(api.captureProbability(target) / 2 - prob) < 1e-12);
target.rewardScale = 2;
const random = Math.random;
Math.random = () => 0;
assert.equal(api.rollMobLoot(target).odds, 10);
Math.random = random;
api.killBot(target, "你");
api.updateEvents(0.01);
assert(!api.G.bounty);
assert.equal(target.rewardScale, 1);
api.beginStage(1);
assert(api.beginBounty());
const expired = api.G.bounty.bot;
api.updateEvents(35);
assert(!api.G.bounty);
assert.equal(expired.rewardScale, 1);
api.beginStage(1);
assert(api.beginInfection());
assert(api.G.bots.filter((b) => b.eventSpawn).length > 0);
assert(api.G.bots.filter((b) => b.eventSpawn).length <= 16);
const sector = api.G.infection.sector;
assert.equal(api.G.infection.mesh.geometry.parameters.width, 105);
assert(
  api.G.bots
    .filter((b) => b.eventSpawn)
    .every(
      (b) =>
        b.mesh.position.x > sector.minX &&
        b.mesh.position.x < sector.maxX &&
        b.mesh.position.z > sector.minZ &&
        b.mesh.position.z < sector.maxZ,
    ),
);
assert(
  api.G.bots.filter((b) => b.eventSpawn).every((b) => b.faction === "zombie"),
);
api.updateEvents(35);
assert(!api.G.infection);
assert.equal(api.G.bots.filter((b) => b.eventSpawn && !b.dead).length, 0);
assert.equal(api.G.alive, 72);
api.beginStage(1);
api.G.intel = 300;
api.updateSupply(0.01);
assert.equal(api.G.supplies.length, 1);
api.updateHud();
assert.equal(nodes.get("supplyAlert").hidden, false);
api.updateSupply(2);
api.updateSupply(2);
assert.equal(api.G.supplies.length, 3);
api.G.intel = 0;
for (let i = 0; i < 12; i++) api.updateSupply(1);
api.updateHud();
assert.equal(
  nodes.get("supplyAlert").hidden,
  true,
  "Existing boxes do not keep warning",
);
const collected = api.G.supplies[0];
collected.weapon = "rocket";
api.G.player.mesh.position.copy(collected.pos);
api.G.manualApproach = false;
api.updateSupply(0.01);
assert.equal(api.G.supplies.length, 3);
api.G.manualApproach = true;
Math.random = () => 0.8;
api.updateSupply(0.01);
Math.random = random;
assert.equal(api.G.weapons[2], "rocket");
assert.equal(api.G.supplies.length, 2);
assert(!api.G.choosing);
assert.deepEqual(api.G.weapons.slice(0, 2), ["rifle", "rifle"]);
api.G.intel = 100;
api.G.supplyRetry = 0;
api.updateSupply(0.01);
api.updateHud();
assert.equal(nodes.get("supplyAlert").hidden, false);
api.beginStage(2);
assert.equal(api.G.supplies.length, 0);
assert.equal(api.G.supplyNotices.length, 0);
assert.equal(api.G.supplyNotice, 0);
assert(!api.G.bounty);
assert(!api.G.infection);
api.startGame();
for (let i = 0; i < 3600; i++) api.step(1 / 60);
assert(api.G.infection);
assert(api.G.bots.every((b) => Number.isFinite(b.mesh.position.x)));
api.updateHud();
api.startGame();
assert.equal(api.G.infectionTimer, 50);
assert.equal(api.G.bountyTimer, 20);
console.log(
  "PASS: event timing; bounty multiplier/RTP and capture/timeout cleanup; bounded infection; new-drop-only alerts; random equipment without pause; independent weapons; stage/restart cleanup; 60-second simulation.",
);
