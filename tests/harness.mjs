import * as THREE from "three";
import { runtime } from "../src/runtime.js";
import { initializeRuntime } from "../src/bootstrap.js";
import * as session from "../src/session.js";
import * as events from "../src/events.js";
import * as economy from "../src/economy.js";
import * as combat from "../src/combat.js";
import * as engine from "../src/engine.js";
import * as player from "../src/player.js";
import * as ui from "../src/ui.js";
import * as hud from "../src/hud.js";

export function createHarness() {
  const nodes = new Map();
  function node() {
    return {
      style: { setProperty() {} },
      children: [],
      classList: { add() {}, remove() {}, toggle() {} },
      append(...v) {
        this.children.push(...v);
      },
      prepend(v) {
        this.children.unshift(v);
      },
      remove() {},
      replaceChildren() {
        this.children = [];
      },
      get lastChild() {
        return { remove: () => this.children.pop() };
      },
      addEventListener() {},
      setAttribute() {},
      setPointerCapture() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 1280, height: 720 };
      },
      getContext() {
        return new Proxy(
          {},
          {
            get: (_, key) =>
              key === "createLinearGradient"
                ? () => ({ addColorStop() {} })
                : () => {},
          },
        );
      },
    };
  }
  globalThis.document = {
    hidden: false,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, node());
      return nodes.get(id);
    },
    createElement: node,
    addEventListener() {},
  };
  globalThis.window = { addEventListener() {} };
  globalThis.matchMedia = () => ({ matches: false });
  initializeRuntime();
  const methods = {
    ...session,
    ...events,
    ...economy,
    ...combat,
    ...engine,
    ...player,
    ...ui,
    ...hud,
    init() {
      runtime.scene = new THREE.Scene();
      runtime.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 150);
      runtime.aimPoint = new THREE.Vector3(0, 0, -10);
      runtime.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      runtime.raycaster = new THREE.Raycaster();
      session.startGame();
      runtime.camera.updateMatrixWorld(true);
      ui.initNativeUI();
    },
    open() {
      runtime.tacticalPanel = true;
    },
    close() {
      runtime.tacticalPanel = false;
    },
    tab(v) {
      runtime.tacticalTab = v;
    },
    menu() {
      runtime.state = "menu";
    },
    result() {
      runtime.state = "result";
    },
  };
  return new Proxy(methods, {
    get: (target, key) => (key in target ? target[key] : runtime[key]),
  });
}
