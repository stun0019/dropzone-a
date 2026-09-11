import * as THREE from "three";
import { runtime } from "./runtime.js";
import { MOB_KEYS } from "./config.js";
import { initAudio, updateAudio } from "./audio.js";
import { finish, startGame, clearActors } from "./session.js";
import { aimFromScreen } from "./combat.js";
import { endJoy, setBet } from "./input.js";
import { message } from "./hud.js";
import { resize, loop } from "./engine.js";
import { resetInput } from "./navigation.js";
import { createWorld } from "./world.js";
import { initNativeUI } from "./ui.js";
import { preloadModels } from "./assets.js";

export function initializeRuntime() {
  runtime.$ = (id) => document.getElementById(id);
  runtime.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  runtime.rand = (a, b) => a + Math.random() * (b - a);
  runtime.game = runtime.$("game");
  runtime.canvas = runtime.$("view");
  runtime.mapCanvas = runtime.$("map");
  runtime.mapCtx = runtime.mapCanvas.getContext("2d");
  runtime.coarse = matchMedia("(pointer:coarse)").matches;
  runtime.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  runtime.renderer = undefined;
  runtime.scene = undefined;
  runtime.camera = undefined;
  runtime.raycaster = undefined;
  runtime.groundPlane = undefined;
  runtime.clock3 = undefined;
  runtime.state = "menu";
  runtime.G = null;
  runtime.last = 0;
  runtime.selectedBet = 1;
  runtime.aimPoint = null;
  runtime.mouseDown = false;
  runtime.mobileFiring = false;
  runtime.pointer = null;
  runtime.joyPointer = null;
  runtime.aimPointer = null;
  runtime.joyStart = null;
  runtime.joyVec = { x: 0, y: 0 };
  runtime.touchAim = { x: 0, z: -1 };
  runtime.keys = new Set();
  runtime.tactics = {
    move: true,
    fire: true,
    bounty: true,
    infection: false,
    supply: false,
    fallback: true,
    stop: 0,
    distance: 12,
    selected: new Set(),
    order: ["bounty", "boss", "infected", "vehicle", "near"],
  };
  runtime.tacticalPanel = false;
  runtime.tacticalTab = 0;
  runtime.gameAudio = {
    ctx: null,
    master: null,
    enabled: true,
    next: 0,
    beat: 0,
    last: {},
  };
  runtime.UP = new THREE.Vector3(0, 1, 0);
  runtime.tempV = new THREE.Vector3();
  runtime.coverBounds = [];
  runtime.tactics.selected = new Set([...MOB_KEYS, "boss"]);
  runtime.mobPool = Object.fromEntries(
    [...MOB_KEYS, "boss"].map((type) => [type, []]),
  );
  runtime.beamPool = { player: [], enemy: [] };
  runtime.impactPool = [];
  runtime.hudElapsed = 0;
  runtime.assetsReady = false;
  runtime.assets = { loaded: 0, total: 0, failures: 0, ready: false };
  runtime.$("audioButton").addEventListener("click", () => {
    runtime.gameAudio.enabled = !runtime.gameAudio.enabled;
    runtime.$("audioButton").textContent = runtime.gameAudio.enabled
      ? "聲音 ON"
      : "聲音 OFF";
    if (runtime.gameAudio.enabled) initAudio();
    updateAudio();
  });
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (
      [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k) &&
      runtime.state === "playing"
    )
      e.preventDefault();
    if (
      runtime.state !== "playing" ||
      runtime.G.choosing ||
      runtime.tacticalPanel
    )
      return;
    runtime.keys.add(k);
    if (k === "escape") finish(false, "你撤離了戰場");
  });
  document.addEventListener("keyup", (e) =>
    runtime.keys.delete(e.key.toLowerCase()),
  );
  runtime.canvas.addEventListener("pointermove", (e) => {
    if (!runtime.coarse) {
      runtime.pointer = { x: e.clientX, y: e.clientY };
      aimFromScreen(e.clientX, e.clientY);
    } else if (e.pointerId === runtime.aimPointer) {
      runtime.pointer = { x: e.clientX, y: e.clientY };
      aimFromScreen(e.clientX, e.clientY);
    }
  });
  runtime.canvas.addEventListener("pointerdown", (e) => {
    if (
      runtime.state !== "playing" ||
      runtime.G.transition > 0 ||
      runtime.G.choosing
    )
      return;
    runtime.canvas.setPointerCapture(e.pointerId);
    if (!runtime.coarse) {
      runtime.pointer = { x: e.clientX, y: e.clientY };
      aimFromScreen(e.clientX, e.clientY);
      runtime.mouseDown = true;
    } else {
      runtime.aimPointer = e.pointerId;
      runtime.mobileFiring = true;
      runtime.pointer = { x: e.clientX, y: e.clientY };
      const r = runtime.canvas.getBoundingClientRect();
      aimFromScreen(e.clientX, e.clientY);
    }
  });
  runtime.canvas.addEventListener("pointerup", (e) => {
    if (!runtime.coarse) runtime.mouseDown = false;
    if (e.pointerId === runtime.aimPointer) { runtime.aimPointer = null; runtime.mobileFiring = false; }
  });
  runtime.canvas.addEventListener("pointerleave", () => {
    if (!runtime.mouseDown && !runtime.coarse) {
      runtime.pointer = null;
      if (runtime.G) runtime.G.hoverTarget = null;
    }
  });
  runtime.canvas.addEventListener("pointercancel", (e) => {
    runtime.mouseDown = false;
    runtime.mobileFiring = false;
    if (e.pointerId === runtime.aimPointer) runtime.aimPointer = null;
  });
  runtime.joy = runtime.$("joy");
  runtime.stick = runtime.$("stick");
  runtime.joy.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    runtime.joyPointer = e.pointerId;
    const r = runtime.joy.getBoundingClientRect();
    runtime.joyStart = {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      r: r.width * 0.38,
    };
    runtime.joy.setPointerCapture(e.pointerId);
  });
  runtime.joy.addEventListener("pointermove", (e) => {
    if (e.pointerId !== runtime.joyPointer) return;
    let x = (e.clientX - runtime.joyStart.x) / runtime.joyStart.r,
      y = (e.clientY - runtime.joyStart.y) / runtime.joyStart.r;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    runtime.joyVec = { x, y };
    runtime.stick.style.transform =
      "translate(calc(-50% + " + x * 35 + "px),calc(-50% + " + y * 35 + "px))";
  });
  runtime.joy.addEventListener("pointerup", endJoy);
  runtime.joy.addEventListener("pointercancel", endJoy);
  runtime.$("fire").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (runtime.state === "playing" && runtime.G.transition <= 0) {
      runtime.mobileFiring = true;
      runtime.$("fire").setPointerCapture(e.pointerId);
    }
  });
  runtime
    .$("fire")
    .addEventListener("pointerup", () => (runtime.mobileFiring = false));
  runtime
    .$("fire")
    .addEventListener("pointercancel", () => (runtime.mobileFiring = false));
  runtime.$("betDown").onclick = (e) => {
    e.stopPropagation();
    setBet(runtime.selectedBet - 1);
  };
  runtime.$("betUp").onclick = (e) => {
    e.stopPropagation();
    setBet(runtime.selectedBet + 1);
  };
  runtime.$("autoButton").onclick = (e) => {
    e.stopPropagation();
    if (!runtime.G || runtime.state !== "playing" || runtime.G.transition > 0)
      return;
    runtime.G.auto = !runtime.G.auto;
    runtime.mouseDown = false;
    runtime.mobileFiring = false;
    message(runtime.G.auto ? "AUTO 搜敵啟動" : "AUTO 關閉", 0.9);
  };
  runtime.$("start").onclick = () => { if (runtime.assetsReady) startGame(); };
  runtime.$("again").onclick = startGame;
  runtime.$("back").onclick = () => {
    runtime.state = "menu";
    runtime.$("result").hidden = true;
    runtime.$("menu").hidden = false;
    runtime.$("stageCurtain").classList.remove("show");
    clearActors();
    runtime.G = null;
  };
  window.addEventListener("resize", resize);
  window.addEventListener("blur", resetInput);
  document.addEventListener("visibilitychange", () => {
    resetInput();
    runtime.last = performance.now();
  });
  runtime.game.addEventListener("contextmenu", (e) => e.preventDefault());
  runtime.nativeUI = {
    scene: null,
    camera: null,
    texture: null,
    surface: null,
    ctx: null,
    hits: [],
    stamp: 0,
    held: new Map(),
  };
}
export function startApplication() {
  initializeRuntime();
  createWorld();
  initNativeUI();
  resize();
  runtime.$("load").textContent = "Loading Models... 0 / 0";
  preloadModels((loaded, total, key, fallback) => {
    runtime.$("load").textContent = `Loading Models... ${loaded} / ${total}${fallback ? " · fallback" : ""}`;
    runtime.nativeUI.stamp = 0;
  }).then((result) => {
    runtime.assetsReady = true;
    runtime.$("load").textContent = result.failures.size ? `系統就緒 · fallback ${result.failures.size}` : "系統就緒 / TWO STAGES";
    runtime.nativeUI.stamp = 0;
  });
  requestAnimationFrame(loop);
}
