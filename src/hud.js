import { runtime } from "./runtime.js";
import { WORLD, SECTORS, TAU, MOB_TYPES, WEAPONS } from "./config.js";
import { worldToScreen } from "./combat.js";

export function drawMap() {
  runtime.mapCtx.clearRect(0, 0, 180, 180);
  runtime.mapCtx.fillStyle = "#172119";
  runtime.mapCtx.fillRect(0, 0, 180, 180);
  runtime.mapCtx.strokeStyle = "#6a786d";
  runtime.mapCtx.strokeRect(1, 1, 178, 178);
  if (!runtime.G) return;
  const s = 180 / (WORLD * 2),
    mx = (x) => (x + WORLD) * s,
    mz = (z) => (z + WORLD) * s;
  if (runtime.G.infection) {
    const q = runtime.G.infection.sector;
    runtime.mapCtx.fillStyle = "#759b354d";
    runtime.mapCtx.fillRect(mx(q.minX), mz(q.minZ), 90, 90);
    runtime.mapCtx.strokeStyle = "#a5e54e";
    runtime.mapCtx.strokeRect(mx(q.minX) + 1, mz(q.minZ) + 1, 88, 88);
  }
  runtime.mapCtx.strokeStyle = "#75868188";
  runtime.mapCtx.beginPath();
  runtime.mapCtx.moveTo(90, 0);
  runtime.mapCtx.lineTo(90, 180);
  runtime.mapCtx.moveTo(0, 90);
  runtime.mapCtx.lineTo(180, 90);
  runtime.mapCtx.stroke();
  runtime.mapCtx.fillStyle = "#c2ceb5";
  runtime.mapCtx.font = "11px monospace";
  SECTORS.forEach((q, i) =>
    runtime.mapCtx.fillText("ABCD"[i], mx(q.minX) + 5, mz(q.minZ) + 13),
  );
  for (const b of runtime.G.bots) {
    if (b.dead || b.type !== "boss") continue;
    runtime.mapCtx.fillStyle = "#ffbb55";
    const size = 7;
    runtime.mapCtx.fillRect(
      mx(b.mesh.position.x) - size / 2,
      mz(b.mesh.position.z) - size / 2,
      size,
      size,
    );
  }
  for (const s of runtime.G.supplies) {
    runtime.mapCtx.fillStyle =
      Math.sin(runtime.G.time * 5) > 0 ? "#fff2bd" : "#efa82c";
    runtime.mapCtx.fillRect(mx(s.pos.x) - 5, mz(s.pos.z) - 5, 10, 10);
    runtime.mapCtx.strokeStyle = "#ffda81";
    runtime.mapCtx.beginPath();
    runtime.mapCtx.moveTo(
      mx(runtime.G.player.mesh.position.x),
      mz(runtime.G.player.mesh.position.z),
    );
    runtime.mapCtx.lineTo(mx(s.pos.x), mz(s.pos.z));
    runtime.mapCtx.stroke();
  }
  runtime.mapCtx.fillStyle = "#dcef72";
  runtime.mapCtx.beginPath();
  runtime.mapCtx.arc(
    mx(runtime.G.player.mesh.position.x),
    mz(runtime.G.player.mesh.position.z),
    4,
    0,
    TAU,
  );
  runtime.mapCtx.fill();
}

export function updateHud() {
  if (!runtime.G) return;
  runtime.$("supplyProgress").textContent =
    "空投情報 " + runtime.G.intel + " / 100";
  runtime.$("eventHud").textContent = [
    runtime.G.bounty
      ? "懸賞 · " +
        MOB_TYPES[runtime.G.bounty.bot.type].name +
        "\n倍率加倍 / " +
        Math.ceil(runtime.G.bounty.life) +
        "秒 / " +
        Math.round(
          runtime.G.player.mesh.position.distanceTo(
            runtime.G.bounty.bot.mesh.position,
          ),
        ) +
        "m"
      : "",
    runtime.G.infection
      ? "感染爆發 · " +
        runtime.G.infection.sector.name +
        "\n全區警戒 / " +
        Math.ceil(runtime.G.infection.life) +
        "秒"
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const distance = runtime.G.supplies.length
    ? Math.min(
        ...runtime.G.supplies.map((s) =>
          runtime.G.player.mesh.position.distanceTo(s.pos),
        ),
      )
    : 0;
  runtime.$("supplyHint").textContent = runtime.G.supplies.length
    ? "場上 " +
      runtime.G.supplies.length +
      " / 3 · 最近 " +
      Math.round(distance) +
      "m"
    : "情報 · 感染者／村民 6 · 軍隊 10 · BOSS 30";
  runtime.$("supplyAlert").hidden = runtime.G.supplyNotice <= 0;
  runtime.$("weaponStatus").textContent = runtime.G.weapons
    .map((w, i) => ["玩家", "左", "右"][i] + ":" + WEAPONS[w])
    .join(" / ");
  runtime.$("alive").textContent = runtime.G.alive;
  runtime.$("kills").textContent =
    "捕獲 " + String(runtime.G.kills).padStart(3, "0");
  runtime.$("stageProgress").style.transform =
    "scaleX(" + runtime.G.stageTime / 240 + ")";
  runtime.$("zoneBox").classList.toggle("urgent", runtime.G.stageTime < 30);
  runtime.$("betDown").disabled = runtime.G.bet <= 1;
  runtime.$("betUp").disabled = runtime.G.bet >= 20;
  const seconds = Math.max(0, Math.ceil(runtime.G.stageTime));
  runtime.$("zoneTime").textContent =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0");
  runtime.$("stageLabel").textContent =
    "STAGE " + runtime.G.stage + " / " + runtime.G.totalStages;
  runtime.$("betValue").textContent = runtime.G.bet;
  runtime.$("credits").textContent = Math.round(
    runtime.G.displayCredits,
  ).toLocaleString("zh-TW");
  runtime.$("winTotal").textContent =
    "+" + Math.round(runtime.G.displayWins).toLocaleString("zh-TW");
  runtime.$("lastOdds").textContent = runtime.G.lastOdds
    ? "最近掉落 ×" + runtime.G.lastOdds
    : "等待捕獲";
  runtime.$("autoButton").textContent = runtime.G.auto ? "∞ ON" : "OFF";
  runtime.$("autoButton").classList.toggle("active", runtime.G.auto);
  runtime.$("autoButton").setAttribute("aria-pressed", String(runtime.G.auto));
  runtime.$("fire").classList.toggle("auto", runtime.G.auto);
  runtime.$("fire").textContent = runtime.G.auto ? "AUTO" : "射擊";
  if (runtime.G.transition > 0)
    runtime.$("nextStage").textContent =
      "距離 00:" +
      String(Math.ceil(runtime.G.transition)).padStart(2, "0") +
      " 到下關卡";
}

export function message(text, time = 1) {
  runtime.$("message").textContent = text;
  runtime.$("message").classList.add("show");
  if (runtime.G) runtime.G.messageTime = time;
}

export function feed(text) {
  const item = document.createElement("div");
  item.className = "feedItem";
  item.textContent = text;
  runtime.$("feed").prepend(item);
  while (runtime.$("feed").children.length > 2)
    runtime.$("feed").lastChild.remove();
  setTimeout(() => item.remove(), 4000);
}

export function showHit(position, kill = false) {
  if (runtime.G)
    runtime.G.uiHit = {
      position: position.clone(),
      kill,
      time: performance.now(),
    };
  const h = runtime.$("hitmark");
  h.classList.remove("on");
  void h.offsetWidth;
  h.classList.add("on");
  h.classList.toggle("kill", kill);
  const point = worldToScreen(position);
  h.style.left = point.x + "px";
  h.style.top = point.y + "px";
}
