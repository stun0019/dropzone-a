import * as THREE from "three";
import { runtime } from "./runtime.js";
import { WORLD, SECTORS, TAU, MOB_KEYS, MOB_TYPES, WEAPONS } from "./config.js";
import { resetInput } from "./navigation.js";
import { sound, initAudio, updateAudio } from "./audio.js";
import { startGame } from "./session.js";
import { setBet } from "./input.js";
import { worldToScreen } from "./combat.js";

export function initNativeUI() {
  const ui = runtime.nativeUI;
  ui.surface = document.createElement("canvas");
  ui.surface.width = 1920;
  ui.surface.height = 1080;
  ui.ctx = ui.surface.getContext("2d");
  ui.texture = new THREE.CanvasTexture(ui.surface);
  ui.texture.colorSpace = THREE.SRGBColorSpace;
  ui.texture.minFilter = THREE.LinearFilter;
  ui.texture.generateMipmaps = false;
  ui.scene = new THREE.Scene();
  ui.camera = new THREE.OrthographicCamera(0, 1280, 720, 0, -1, 1);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1280, 720),
    new THREE.MeshBasicMaterial({
      map: ui.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  plane.position.set(640, 360, 0);
  ui.scene.add(plane);
  for (const child of runtime.game.children)
    if (child !== runtime.canvas) {
      child.style.setProperty("display", "none", "important");
    }
  runtime.canvas.addEventListener("pointerdown", uiPointerDown, true);
  runtime.canvas.addEventListener("pointermove", uiPointerMove, true);
  runtime.canvas.addEventListener("pointerup", uiPointerUp, true);
  runtime.canvas.addEventListener("pointercancel", uiPointerUp, true);
  window.addEventListener("blur", () => ui.held.clear());
}

export function uiText(
  text,
  x,
  y,
  size = 18,
  color = "#d9e8eb",
  align = "left",
  bold = false,
) {
  const c = runtime.nativeUI.ctx;
  c.font = (bold ? "700 " : "500 ") + size + 'px "Microsoft JhengHei",Arial';
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.shadowColor = '#00000066'; c.shadowBlur = 2; c.shadowOffsetY = 1;
  c.fillText(String(text), x, y);
  c.shadowBlur = 0; c.shadowOffsetY = 0;
}

export function uiPanel(x, y, w, h, accent = "#64848c", fill = "#101d29ee") {
  const c = runtime.nativeUI.ctx;
  c.save();
  c.shadowColor = '#07112388'; c.shadowBlur = 8; c.shadowOffsetY = 5;
  c.beginPath();
  c.moveTo(x + 12, y);
  c.lineTo(x + w, y);
  c.lineTo(x + w, y + h - 12);
  c.lineTo(x + w - 12, y + h);
  c.lineTo(x, y + h);
  c.lineTo(x, y + 12);
  c.closePath();
  const gradient = c.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, '#202a30f5');
  gradient.addColorStop(1, '#10191ef5');
  c.fillStyle = gradient;
  c.fill();
  c.shadowBlur = 0; c.shadowOffsetY = 0;
  c.strokeStyle = '#080f14';
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = '#65747766'; c.lineWidth = 1; c.stroke();
  c.fillStyle = accent;
  c.fillRect(x + 14, y, 32, 2);
  c.save();
  c.clip();
  const sheen = c.createLinearGradient(x, y, x, y + Math.min(h, 48));
  sheen.addColorStop(0, "rgba(190,220,230,.1)");
  sheen.addColorStop(1, "rgba(190,220,230,0)");
  c.fillStyle = sheen;
  c.fillRect(x, y, w, Math.min(h, 48));
  c.strokeStyle = "rgba(185,213,220,.12)";
  c.beginPath(); c.moveTo(x + 14, y + 5); c.lineTo(x + w - 6, y + 5); c.stroke();
  c.fillStyle = "#829395";
  for (const px of [x + 7, x + w - 7]) {
    c.fillRect(px, y + h - 8, 2, 2);
  }
  c.restore();
  c.restore();
}

export function uiButton(label, x, y, w, h, fn, active = false) {
  uiPanel(
    x,
    y,
    w,
    h,
    active ? "#f2bd65" : "#486776",
    active ? "#5a4229f2" : "#1b3040f2",
  );
  const c = runtime.nativeUI.ctx;
  const face = c.createLinearGradient(0, y + 3, 0, y + h - 4);
  face.addColorStop(0, active ? '#e6c27b' : '#425158');
  face.addColorStop(1, active ? '#aa7b35' : '#28343b');
  c.fillStyle = face;
  c.fillRect(x + 5, y + 5, w - 10, h - 12);
  c.fillStyle = active ? '#755329' : '#142027';
  c.fillRect(x + 5, y + h - 8, w - 14, 4);
  uiText(
    label,
    x + w / 2,
    y + h / 2,
    17,
    active ? '#172127' : '#eef3f1',
    "center",
    true,
  );
  runtime.nativeUI.hits.push({ x, y, w, h, fn });
}

export function uiIcon(type, x, y, size, color = "#eac17a") {
  const c = runtime.nativeUI.ctx;
  c.save();
  c.translate(x, y);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 2;
  if (type === "med") {
    c.fillRect(-size * 0.13, -size * 0.4, size * 0.26, size * 0.8);
    c.fillRect(-size * 0.4, -size * 0.13, size * 0.8, size * 0.26);
  } else if (type === "armor") {
    c.beginPath();
    c.moveTo(0, -size * 0.4);
    c.lineTo(size * 0.35, -size * 0.2);
    c.lineTo(size * 0.25, size * 0.25);
    c.lineTo(0, size * 0.45);
    c.lineTo(-size * 0.25, size * 0.25);
    c.lineTo(-size * 0.35, -size * 0.2);
    c.closePath();
    c.stroke();
  } else {
    for (let i = -1; i <= 1; i++) {
      c.strokeRect(
        i * size * 0.25 - size * 0.075,
        -size * 0.3,
        size * 0.15,
        size * 0.65,
      );
    }
  }
  c.restore();
}

export function uiRadar() {
  const c = runtime.nativeUI.ctx,
    x = 30,
    y = 86,
    w = 122;
  uiPanel(x - 6, y - 24, w + 12, w + 42, "#557c7b");
  uiText("戰術雷達", x, y - 10, 12, "#96b8bd");
  c.save();
  c.beginPath();
  c.rect(x, y, w, w);
  c.clip();
  c.fillStyle = "#132626";
  c.fillRect(x, y, w, w);
  const px = (v) => x + ((v + WORLD) / (WORLD * 2)) * w,
    pz = (v) => y + ((v + WORLD) / (WORLD * 2)) * w;
  if (runtime.G.infection) {
    const q = runtime.G.infection.sector;
    c.fillStyle = "#8cba3655";
    c.fillRect(px(q.minX), pz(q.minZ), w / 2, w / 2);
  }
  c.strokeStyle = "#385853";
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i <= 4; i++) {
    c.moveTo(x + (i * w) / 4, y);
    c.lineTo(x + (i * w) / 4, y + w);
    c.moveTo(x, y + (i * w) / 4);
    c.lineTo(x + w, y + (i * w) / 4);
  }
  c.stroke();
  SECTORS.forEach((q, i) =>
    uiText("ABCD"[i], px(q.minX) + 9, pz(q.minZ) + 10, 10, "#9daf95"),
  );
  for (const b of runtime.G.bots)
    if (!b.dead && b.type === "boss") {
      uiIcon(
        "armor",
        px(b.mesh.position.x),
        pz(b.mesh.position.z),
        12,
        "#ff956f",
      );
    }
  for (const s of runtime.G.supplies) {
    c.fillStyle = "#efc979";
    c.fillRect(px(s.pos.x) - 3, pz(s.pos.z) - 3, 6, 6);
  }
  const p = runtime.G.player.mesh.position;
  c.fillStyle = "#d3f4ed";
  c.beginPath();
  c.arc(px(p.x), pz(p.z), 4, 0, TAU);
  c.fill();
  c.restore();
}

export function drawTactics() {
  const c = runtime.nativeUI.ctx;
  c.fillStyle = "#020911c9";
  c.fillRect(0, 0, 1280, 720);
  uiPanel(120, 54, 1040, 604, "#c99e61", "#122638ff");
  uiText("AUTO / 戰術指揮", 154, 91, 27, "#e6d1ad", "left", true);
  uiText("設定期間暫停戰場 · 關閉後恢復", 1130, 94, 13, "#7f9da9", "right");
  uiButton(
    "戰鬥設定",
    154,
    126,
    190,
    42,
    () => (runtime.tacticalTab = 0),
    runtime.tacticalTab === 0,
  );
  uiButton(
    "目標 / 順位",
    356,
    126,
    190,
    42,
    () => (runtime.tacticalTab = 1),
    runtime.tacticalTab === 1,
  );
  if (runtime.tacticalTab === 0) {
    const options = [
      ["move", "自動移動"],
      ["fire", "自動射擊"],
      ["bounty", "優先追捕懸賞"],
      ["infection", "優先感染區目標"],
      ["supply", "自動前往空投"],
      ["fallback", "攻擊列表外目標"],
    ];
    options.forEach(([key, label], i) => {
      const x = 154 + (i % 2) * 490,
        y = 195 + Math.floor(i / 2) * 86;
      uiPanel(x, y, 466, 70, "#2e4c5a");
      uiText(label, x + 20, y + 35, 19);
      uiButton(
        runtime.tactics[key] ? "ON" : "OFF",
        x + 350,
        y + 15,
        96,
        40,
        () => (runtime.tactics[key] = !runtime.tactics[key]),
        runtime.tactics[key],
      );
    });
    uiText("停止追擊距離", 174, 484, 18);
    [8, 12, 18].forEach((d, i) =>
      uiButton(
        ["近 8m", "中 12m", "遠 18m"][i],
        340 + i * 125,
        464,
        114,
        40,
        () => (runtime.tactics.distance = d),
        runtime.tactics.distance === d,
      ),
    );
    uiText("點數低於即停止", 174, 548, 18);
    [0, 1000, 5000, 10000].forEach((d, i) =>
      uiButton(
        d ? d.toLocaleString() : "不限制",
        340 + i * 125,
        528,
        114,
        40,
        () => (runtime.tactics.stop = d),
        runtime.tactics.stop === d,
      ),
    );
  } else {
    const entries = [...MOB_KEYS, "boss"];
    entries.forEach((key, i) => {
      const x = 154 + (i % 4) * 145,
        y = 192 + Math.floor(i / 4) * 98,
        on = runtime.tactics.selected.has(key);
      uiButton(
        key === "boss" ? "全體 BOSS" : MOB_TYPES[key].name,
        x,
        y,
        134,
        83,
        () => {
          on
            ? runtime.tactics.selected.delete(key)
            : runtime.tactics.selected.add(key);
        },
        on,
      );
    });
    uiButton(
      "全部選取",
      154,
      504,
      180,
      42,
      () => (runtime.tactics.selected = new Set(entries)),
    );
    uiButton("清除選取", 346, 504, 180, 42, () => {
      runtime.tactics.selected.clear();
      runtime.tactics.fallback = false;
    });
    uiText("攻擊優先順序", 790, 191, 19, "#f0d399");
    const names = {
      bounty: "懸賞目標",
      boss: "BOSS",
      infected: "感染區目標",
      vehicle: "載具",
      near: "最近目標",
    };
    runtime.tactics.order.forEach((key, i) => {
      const y = 220 + i * 59;
      uiPanel(786, y, 334, 50, "#385563");
      uiText(i + 1 + "  " + names[key], 802, y + 25, 17);
      uiButton("↑", 1028, y + 5, 38, 40, () => {
        if (i)
          [runtime.tactics.order[i - 1], runtime.tactics.order[i]] = [
            key,
            runtime.tactics.order[i - 1],
          ];
      });
      uiButton("↓", 1074, y + 5, 38, 40, () => {
        if (i < 4)
          [runtime.tactics.order[i + 1], runtime.tactics.order[i]] = [
            key,
            runtime.tactics.order[i + 1],
          ];
      });
    });
  }
  uiButton("關閉", 154, 594, 170, 42, () => {
    runtime.tacticalPanel = false;
    resetInput();
  });
  uiButton("停止 AUTO", 704, 594, 190, 42, () => {
    runtime.G.auto = false;
    runtime.tacticalPanel = false;
    resetInput();
  });
  uiButton(
    "套用並啟動",
    914,
    588,
    210,
    50,
    () => {
      runtime.G.auto = true;
      runtime.G.autoTarget = null;
      runtime.G.searchCd = 0;
      runtime.G.player.chaseTarget = null;
      runtime.tacticalPanel = false;
      resetInput();
      sound("equip");
    },
    true,
  );
}

export function drawNativeUI(now) {
  const ui = runtime.nativeUI;
  if (!ui.ctx) return;
  // A 30 Hz UI texture update keeps text sharp without uploading at full render rate.
  if (now - ui.stamp < 32) return;
  ui.stamp = now;
  ui.hits = [];
  const c = ui.ctx;
  c.setTransform(1.5, 0, 0, 1.5, 0, 0);
  c.clearRect(0, 0, 1280, 720);
  if (runtime.state === "menu" || runtime.state === "result") {
    const shade = c.createLinearGradient(0, 0, 1280, 0);
    shade.addColorStop(0, "#153966d9");
    shade.addColorStop(1, "#14336222");
    c.fillStyle = shade;
    c.fillRect(0, 0, 1280, 720);
    for (let i = 0; i < 12; i++) {
      c.fillStyle = "#89b3bf08";
      c.fillRect(0, i * 64, 1280, 1);
    }
    uiText("三人小隊 / 戰區獵捕", 90, 155, 20, "#ffe3a0", 'left', true);
    uiText("DROPZONE", 84, 242, 86, "#fff3c2", "left", true);
    uiText("戰區獵捕行動", 92, 327, 31, "#aac8cd");
    uiText(
      runtime.state === "menu"
        ? "指揮三人小隊 · 搜尋空投 · 追捕懸賞"
        : "本輪任務完成",
      94,
      387,
      20,
    );
    uiPanel(804, 165, 372, 382, "#b68d55");
    uiText(
      runtime.state === "menu" ? "部署簡報" : "作戰結算",
      832,
      205,
      26,
      "#edce97",
      "left",
      true,
    );
    const lines =
      runtime.state === "menu"
        ? [
            runtime.assetsReady
              ? "模型載入完成 · 可部署"
              : `Loading Models... ${runtime.assets.loaded || 0} / ${runtime.assets.total || 0}`,
            "WASD / 搖桿：移動",
            "游標 / 觸控：瞄準射擊",
            "AUTO：開啟戰術設定",
            "空投：靠近後隨機裝備",
            "點選目標開火 · 點空地不扣 BET",
          ]
        : [
            "捕獲目標  " + runtime.G.kills,
            "總贏分  " + runtime.G.winTotal.toLocaleString(),
            "剩餘點數  " + runtime.G.credits.toLocaleString(),
            "作戰時間  " + Math.floor(runtime.G.time) + " 秒",
          ];
    lines.forEach((line, i) => uiText(line, 832, 255 + i * 30, 16, "#e2edf8"));
    uiButton(
      runtime.state === "menu"
        ? runtime.assetsReady
          ? "部署 / START"
          : "載入模型中..."
        : "再次部署",
      830,
      466,
      318,
      56,
      () => {
        if (runtime.state === "menu" && !runtime.assetsReady) return;
        runtime.tacticalPanel = false;
        startGame();
      },
      true,
    );
  } else if (runtime.G) {
    uiText("DROPZONE", 28, 31, 23, "#e5ebe7", "left", true);
    uiText("TACTICAL CAPTURE", 30, 53, 10, "#96b8bd");
    uiRadar();
    uiPanel(518, 14, 244, 65, "#b59a68");
    uiText("STAGE 0" + runtime.G.stage + " / 02", 537, 34, 12, "#9bb2b9");
    uiText(
      Math.floor(Math.ceil(runtime.G.stageTime) / 60)
        .toString()
        .padStart(2, "0") +
        ":" +
        (Math.ceil(runtime.G.stageTime) % 60)
          .toString()
          .padStart(2, "0"),
      740,
      43,
      30,
      runtime.G.stageTime < 30 ? "#ff986e" : "#e7d5ad",
      "right",
      true,
    );
    c.fillStyle = "#d9b575";
    c.fillRect(532, 72, (216 * runtime.G.stageTime) / 240, 2);
    uiButton(
      runtime.gameAudio.enabled ? "聲音 ON" : "聲音 OFF",
      1136,
      22,
      116,
      38,
      () => {
        runtime.gameAudio.enabled = !runtime.gameAudio.enabled;
        if (runtime.gameAudio.enabled) initAudio();
        updateAudio();
      },
    );
    let cardY = 102;
    for (const [title, detail, color] of [
      runtime.G.bounty
        ? [
            "懸賞 / " + MOB_TYPES[runtime.G.bounty.bot.type].name,
            Math.ceil(runtime.G.bounty.life) + "秒 · 倍率加倍",
            "#e8b66d",
          ]
        : null,
      runtime.G.infection
        ? [
            "感染 / " + runtime.G.infection.sector.name,
            Math.ceil(runtime.G.infection.life) + "秒 · 全區警戒",
            "#adc966",
          ]
        : null,
    ].filter(Boolean)) {
      uiPanel(1000, cardY, 250, 65, color);
      uiText(title, 1016, cardY + 22, 17, color);
      uiText(detail, 1016, cardY + 46, 13, "#adc1c7");
      cardY += 77;
    }
    uiText("補給 " + runtime.G.supplies.length + "/3", 30, 249, 12, "#edf2e8");
    uiText(runtime.G.intel + "%", 152, 249, 12, "#e7d39e", "right", true);
    c.fillStyle = "#385251";
    c.fillRect(30, 262, 122, 3);
    c.fillStyle = "#dab777";
    c.fillRect(30, 262, 122 * Math.min(1, runtime.G.intel / 100), 3);
    uiPanel(258, 616, 764, 86, "#b79258");
    c.fillStyle = '#77888a44';
    c.fillRect(434, 634, 1, 48); c.fillRect(683, 634, 1, 48); c.fillRect(876, 634, 1, 48);
    uiText("BET", 280, 636, 13, "#a2b5bb");
    uiButton("−", 278, 654, 42, 34, () => setBet(runtime.selectedBet - 1));
    uiText(runtime.G.bet, 349, 672, 28, "#ffe0a0", "center", true);
    uiButton("+", 378, 654, 42, 34, () => setBet(runtime.selectedBet + 1));
    uiText("PLAYER / 01", 450, 637, 12, "#97b8c0");
    uiText(
      Math.round(runtime.G.displayCredits).toLocaleString(),
      450,
      673,
      30,
      "#eef3ed",
      "left",
      true,
    );
    uiText("累積贏分", 702, 637, 12, "#a7c4bf");
    uiText(
      Math.round(runtime.G.displayWins).toLocaleString(),
      702,
      675,
      26,
      "#e9c584",
      "left",
      true,
    );
    uiButton(
      runtime.G.auto ? "AUTO ON" : "AUTO",
      894,
      634,
      110,
      50,
      () => {
        runtime.tacticalPanel = true;
        resetInput();
      },
      true,
    );
    runtime.G.weapons.forEach((w, i) => {
      const x = 361 + i * 190;
      // Equipment is a slim status rail integrated with the command dock.
      if (i === 0) uiPanel(350, 588, 580, 28, '#5f7f7d');
      uiText(
        ["P1", "L", "R"][i] + " / " + WEAPONS[w],
        x + 13,
        602,
        11,
        "#b7ced2",
      );
    });
    if (runtime.G.messageTime > 0) {
      uiPanel(370, 103, 540, 42, "#b69760");
      uiText(
        runtime.$("message").textContent,
        640,
        125,
        18,
        "#f6d59b",
        "center",
        true,
      );
    }
    if (runtime.G.supplyNotice > 0) {
      uiPanel(398, 162, 484, 38, "#bfa365");
      uiText("新空投即將抵達 · 雷達已標記", 640, 181, 17, "#ebd19a", "center");
    }
    const lock = runtime.$("lockTarget"),
      rect = runtime.game.getBoundingClientRect();
    if (lock.style.display === "block") {
      const x = (parseFloat(lock.style.left) * 1280) / rect.width,
        y = (parseFloat(lock.style.top) * 720) / rect.height,
        w = (parseFloat(lock.style.width) * 1280) / rect.width,
        h = (parseFloat(lock.style.height) * 720) / rect.height;
      c.strokeStyle = "#dfd49a";
      c.lineWidth = 2;
      for (const [xx, yy, sx, sy] of [
        [x, y, 1, 1],
        [x + w, y, -1, 1],
        [x, y + h, 1, -1],
        [x + w, y + h, -1, -1],
      ]) {
        c.beginPath();
        c.moveTo(xx + sx * 12, yy);
        c.lineTo(xx, yy);
        c.lineTo(xx, yy + sy * 12);
        c.stroke();
      }
      uiText(
        runtime.$("lockName").textContent,
        x + w / 2,
        y - 12,
        13,
        "#f0d9a5",
        "center",
      );
    }
    for (const f of runtime.G.flights) {
      const p = worldToScreen(f.position),
        t = runtime.clamp((f.age - 0.65) / 0.6, 0, 1),
        x = ((p.x * 1280) / rect.width) * (1 - t) + 740 * t,
        y = ((p.y * 720) / rect.height - 50) * (1 - t) + 670 * t;
      c.save();
      c.globalAlpha = 1 - t * 0.8;
      uiPanel(x - 55, y - 26, 110, 65, "#d9bf78");
      uiIcon(
        f.node.className.includes("med")
          ? "med"
          : f.node.className.includes("armor")
            ? "armor"
            : "ammo",
        x,
        y - 8,
        25,
      );
      uiText(f.node.textContent, x, y + 24, 12, "#ffe1a0", "center");
      c.restore();
    }
    if (runtime.coarse) {
      for (const [x, label] of [
        [117, "MOVE"],
        [1163, "FIRE"],
      ]) {
        c.beginPath();
        c.arc(x, 582, sixty(), 0, TAU);
        c.fillStyle = "#15283299";
        c.fill();
        c.strokeStyle = "#829a9b";
        c.lineWidth = 2;
        c.stroke();
        uiText(label, x, 582, 16, "#c6d5cf", "center");
      }
      c.beginPath();
      c.arc(
        117 + runtime.joyVec.x * 32,
        582 + runtime.joyVec.y * 32,
        23,
        0,
        TAU,
      );
      c.fillStyle = "#adc6c799";
      c.fill();
    }
    if (runtime.G.uiHit && now - runtime.G.uiHit.time < 250) {
      const p = worldToScreen(runtime.G.uiHit.position),
        x = (p.x * 1280) / rect.width,
        y = (p.y * 720) / rect.height;
      c.strokeStyle = runtime.G.uiHit.kill ? "#ffce69" : "#e8f1ef";
      c.lineWidth = 2;
      c.globalAlpha = 1 - (now - runtime.G.uiHit.time) / 250;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        c.beginPath();
        c.moveTo(x + dx * 5, y + dy * 5);
        c.lineTo(x + dx * 12, y + dy * 12);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    if (runtime.G.transition > 0) {
      c.fillStyle = "#091420cc";
      c.fillRect(0, 0, 1280, 720);
      uiText("區域作戰完成", 640, 310, 42, "#eddbb6", "center", true);
      uiText(
        "距離下一關 " + Math.ceil(runtime.G.transition) + " 秒",
        640,
        373,
        23,
        "#bfd4d5",
        "center",
      );
    }
    if (runtime.tacticalPanel) drawTactics();
  }
  ui.texture.needsUpdate = true;
}

export function sixty() {
  return 59;
}

export function uiPoint(e) {
  const r = runtime.canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * 1280) / r.width,
    y: ((e.clientY - r.top) * 720) / r.height,
  };
}

export function uiPointerDown(e) {
  const p = uiPoint(e),
    ui = runtime.nativeUI;
  const hit = ui.hits
    .slice()
    .reverse()
    .find(
      (b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h,
    );
  if (hit) {
    e.stopImmediatePropagation();
    e.preventDefault();
    resetInput();
    hit.fn();
    ui.stamp = 0;
    return;
  }
  if (
    runtime.tacticalPanel ||
    runtime.state !== "playing" ||
    runtime.G.transition > 0
  ) {
    e.stopImmediatePropagation();
    return;
  }
  if (runtime.coarse && Math.hypot(p.x - 117, p.y - 582) < 75) {
    ui.held.set(e.pointerId, "joy");
  } else if (runtime.coarse && Math.hypot(p.x - 1163, p.y - 582) < 75) {
    ui.held.set(e.pointerId, "fire");
    runtime.mobileFiring = true;
  } else return;
  runtime.canvas.setPointerCapture(e.pointerId);
  e.stopImmediatePropagation();
  e.preventDefault();
}

export function uiPointerMove(e) {
  const kind = runtime.nativeUI.held.get(e.pointerId);
  if (runtime.tacticalPanel) {
    e.stopImmediatePropagation();
    return;
  }
  if (!kind) return;
  e.stopImmediatePropagation();
  if (kind === "joy") {
    const p = uiPoint(e),
      x = (p.x - 117) / 38,
      y = (p.y - 582) / 38,
      d = Math.max(1, Math.hypot(x, y));
    runtime.joyVec = { x: x / d, y: y / d };
  }
}

export function uiPointerUp(e) {
  const kind = runtime.nativeUI.held.get(e.pointerId);
  if (!kind) return;
  e.stopImmediatePropagation();
  runtime.nativeUI.held.delete(e.pointerId);
  if (kind === "joy") runtime.joyVec = { x: 0, y: 0 };
  else runtime.mobileFiring = false;
}
