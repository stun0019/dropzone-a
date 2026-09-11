import * as THREE from "three";
import { runtime } from "./runtime.js";
import {
  clearTransient,
  recycleMob,
  disposeMesh,
  resetInput,
} from "./navigation.js";
import { clearEvents, clearSupply, updateWeaponModels } from "./events.js";
import { initAudio, sound } from "./audio.js";
import { applyStageTheme } from "./world.js";
import { makeSoldier } from "./models.js";
import { updateFollowers } from "./player.js";
import { spawnBot } from "./actors.js";
import { message, updateHud, feed } from "./hud.js";
import { MOB_TYPES, MOTION_PROFILES } from "./config.js";
import { rollMobLoot } from "./economy.js";
import { settleCaptures } from "./combat.js";

export function clearActors() {
  if (!runtime.G) return;
  clearTransient();
  clearEvents();
  for (const b of runtime.G.bots) recycleMob(b);
  clearSupply();
  disposeMesh(runtime.G.player.mesh);
  for (const follower of runtime.G.followers || []) disposeMesh(follower.mesh);
  runtime.$("feed").replaceChildren();
  runtime.$("lockTarget").style.display = "none";
}

export function startGame() {
  initAudio();
  runtime.gameAudio.next = 0;
  runtime.gameAudio.beat = 0;
  clearActors();
  applyStageTheme(1);
  resetInput();
  runtime.G = {
    time: 0,
    stage: 1,
    totalStages: 2,
    stageTime: 240,
    transition: 0,
    enemySerial: 0,
    alive: 0,
    kills: 0,
    infection: null,
    bounty: null,
    infectionTimer: 50,
    bountyTimer: 20,
    supplyNotice: 0,
    supplyNotices: [],
    bet: runtime.selectedBet,
    credits: 200000,
    winTotal: 0,
    lastOdds: 0,
    auto: false,
    respawnTimer: 0,
    fireCd: 0,
    weaponCds: [0, 0, 0],
    feedbackCd: 0,
    spawnShield: 4,
    dead: false,
    bossTimer: 30,
    bossSerial: 0,
    intel: 0,
    supplies: [],
    selectedSupply: null,
    choosing: false,
    weapons: ["rifle", "rifle", "rifle"],
    resolutions: [],
    grenades: [],
    wagered: 0,
    eligibleWagered: 0,
    bots: [],
    tracers: [],
    impacts: [],
    flights: [],
    messageTime: 0,
    shake: 0,
    autoTarget: null,
    searchCd: 0,
    displayCredits: 200000,
    displayWins: 0,
  };

  const mesh = makeSoldier(0x385a40, false, "player");
  const teamRing = new THREE.Mesh(new THREE.RingGeometry(.85, 1.03, 40), new THREE.MeshBasicMaterial({color:0x48dbff, transparent:true, opacity:.85, depthWrite:false}));
  teamRing.rotation.x = -Math.PI / 2;
  teamRing.position.y = .055;
  mesh.add(teamRing);
  mesh.position.set(0, 0, 28);
  runtime.scene.add(mesh);
  mesh.userData.motionProfile = MOTION_PROFILES.player;
  mesh.userData.animationRates = MOTION_PROFILES.player;
  runtime.G.player = { mesh, vel: new THREE.Vector3(), yaw: Math.PI, motion: MOTION_PROFILES.player, motionSpeed: 0, walk: 0, lastMoveDir: new THREE.Vector3(0, 0, -1) };
  runtime.G.followers = [-1, 1].map((side) => {
    const mesh = makeSoldier(0x3c6970, false, "player");
    mesh.userData.motionProfile = MOTION_PROFILES.follower;
    mesh.userData.animationRates = MOTION_PROFILES.follower;
    const ring = new THREE.Mesh(new THREE.RingGeometry(.65, .78, 32), new THREE.MeshBasicMaterial({color:0x63bfff, transparent:true, opacity:.55, depthWrite:false}));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .055; mesh.add(ring);
    runtime.scene.add(mesh);
    return {
      mesh,
      side,
      type: "soldier",
      speed: 8,
      walk: 0,
      hitTime: 0,
      turnSide: side,
      motion: MOTION_PROFILES.follower,
      motionSpeed: 0,
    };
  });
  updateFollowers(0, true);

  for (let i = 0; i < 72; i++) spawnBot(i);

  runtime.camera.position.set(0, 15, 45);
  runtime.camera.lookAt(0, 1, 25);
  runtime.state = "playing";
  runtime.$("menu").hidden = true;
  runtime.$("result").hidden = true;
  runtime.$("stageCurtain").classList.remove("show");
  message("STAGE 1 START", 1.8);
  updateHud();
}

export function killBot(bot, killer, bet = runtime.G.bet, awardedLoot = null) {
  if (bot.dead) return;
  bot.dead = true;
  bot.captureAge = 0;
  bot.lootShown = false;
  runtime.G.alive--;
  if (runtime.G.autoTarget === bot) runtime.G.autoTarget = null;
  if (killer === "你") {
    runtime.G.kills++;
    runtime.G.intel += bot.type === "boss" ? 30 : MOB_TYPES[bot.type].intel;
    const loot = awardedLoot || rollMobLoot(bot);
    const win = bet * loot.odds;
    runtime.G.credits += win;
    runtime.G.winTotal += win;
    runtime.G.lastOdds = loot.odds;
    bot.loot = loot;
    bot.win = win;
    runtime.G.shake = 0.07;
    sound(bot.type === "boss" ? "bosswin" : "capture");
    feed(loot.label + " ×" + loot.odds + "  +" + win);
  }

  runtime.G.respawnTimer = Math.max(runtime.G.respawnTimer, 1.5);
}

export function finish(win, from = "") {
  if (runtime.state !== "playing") return;
  settleCaptures(0, true);
  clearEvents();
  runtime.state = "result";
  runtime.G.auto = false;
  resetInput();
  clearSupply();
  runtime.G.displayCredits = runtime.G.credits;
  runtime.G.displayWins = runtime.G.winTotal;
  runtime.$("lockTarget").style.display = "none";
  runtime.$("stageCurtain").classList.remove("show");
  runtime.$("resultTag").textContent = win ? "TWO STAGES CLEAR" : "ELIMINATED";
  runtime.$("resultTitle").textContent = win ? "兩關完成" : "本輪結束";
  runtime.$("resultText").textContent = win
    ? "四分鐘戰區全部完成，本輪贏分已結算。"
    : from
      ? from + " 結束了你的作戰。"
      : "作戰訊號已中斷。";
  runtime.$("resultStats").textContent =
    "捕獲：" +
    runtime.G.kills +
    "\n總贏分：" +
    runtime.G.winTotal.toLocaleString("zh-TW") +
    "\n剩餘虛擬點數：" +
    runtime.G.credits.toLocaleString("zh-TW") +
    "\n作戰時間：" +
    Math.floor(runtime.G.time) +
    " 秒" +
    "\n完成關卡：" +
    (win ? 2 : runtime.G.stage - 1) +
    " / 2";
  runtime.$("result").hidden = false;
}

export function beginStage(stage) {
  applyStageTheme(stage);
  clearTransient();
  clearEvents();
  for (const b of runtime.G.bots) recycleMob(b);
  runtime.G.autoTarget = null;
  runtime.G.searchCd = 0;
  runtime.G.alive = 0;
  clearSupply();
  runtime.G.weapons = ["rifle", "rifle", "rifle"];
  runtime.G.weaponCds = [0, 0, 0];
  runtime.G.fireCd = 0;
  runtime.G.player.nav = null;
  for (const f of runtime.G.followers) f.nav = null;
  updateWeaponModels();
  runtime.G.bots = [];
  runtime.G.stage = stage;
  runtime.G.stageTime = 240;
  runtime.G.transition = 0;
  runtime.G.respawnTimer = 0;
  runtime.G.bossTimer = 30;
  runtime.G.infectionTimer = 50;
  runtime.G.bountyTimer = 20;
  runtime.G.player.mesh.position.set(0, 0, 28);
  runtime.G.spawnShield = 3;
  updateFollowers(0, true);
  const count = stage === 1 ? 72 : 96;
  for (let i = 0; i < count; i++) spawnBot(i);
  runtime.$("stageCurtain").classList.remove("show");
  message("STAGE " + stage + " START", 1.8);
}

export function stageUpdate(dt) {
  if (runtime.G.transition > 0) {
    runtime.G.transition -= dt;
    if (runtime.G.transition <= 0) beginStage(runtime.G.stage + 1);
    return true;
  }
  runtime.G.stageTime = Math.max(0, runtime.G.stageTime - dt);
  const cap = runtime.G.stage === 1 ? 72 : 96;
  if (
    runtime.G.bots.filter((b) => !b.dead && !b.eventSpawn && b.type !== "boss")
      .length < cap
  ) {
    runtime.G.respawnTimer -= dt;
    if (runtime.G.respawnTimer <= 0) {
      spawnBot(runtime.G.enemySerial);
      runtime.G.respawnTimer = runtime.rand(1.2, 2.4);
    }
  }
  if (runtime.G.stageTime <= 0) {
    if (runtime.G.stage < runtime.G.totalStages) {
      runtime.G.transition = 6;
      resetInput();
      runtime.G.autoTarget = null;
      runtime.$("stageClear").textContent = "第 " + runtime.G.stage + " 關完成";
      runtime.$("stageCurtain").classList.add("show");
    } else finish(true);
    return true;
  }
  runtime.G.bossTimer -= dt;
  if (runtime.G.bossTimer <= 0) {
    if (runtime.G.bots.filter((b) => b.type === "boss").length < 3)
      runtime.G.bossTimer = spawnBot(runtime.G.enemySerial, true) ? 25 : 2;
    else runtime.G.bossTimer = 2;
  }
  return false;
}
