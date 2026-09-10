import * as THREE from "three";
import { runtime } from "./runtime.js";
import { WORLD, TAU } from "./config.js";
import { box, cylinder, mat } from "./models.js";
import { surfaceTexture, addRoadPaint } from "./art.js";

export function createWorld() {
  runtime.scene = new THREE.Scene();
  runtime.scene.background = new THREE.Color(0x9cb8b2);
  runtime.scene.fog = new THREE.Fog(0x9cb8b2, 38, 94);

  runtime.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 150);
  runtime.renderer = new THREE.WebGLRenderer({
    canvas: runtime.canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  runtime.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  runtime.renderer.setSize(1280, 720, false);
  runtime.renderer.shadowMap.enabled = !runtime.reduced;
  runtime.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  runtime.renderer.outputColorSpace = THREE.SRGBColorSpace;
  runtime.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  runtime.renderer.toneMappingExposure = 0.95;

  const skyLight = new THREE.HemisphereLight(0xb8d3e0, 0x434331, 1.5);
  runtime.scene.add(skyLight);
  const sun = new THREE.DirectionalLight(0xffefd2, 3.2);
  sun.position.set(-20, 35, 18);
  sun.castShadow = !runtime.reduced;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  sun.shadow.normalBias = 0.04;
  sun.shadow.bias = -0.00015;
  runtime.scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 2, WORLD * 2),
    new THREE.MeshStandardMaterial({ color: 0x788064, map: surfaceTexture('ground'), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  runtime.scene.add(ground);
  runtime.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x404643,
    map: surfaceTexture('road'),
    roughness: 1,
  });
  for (const r of [
    { x: 0, z: 0, w: 10, d: WORLD * 2 },
    { x: 0, z: 0, w: WORLD * 2, d: 9 },
    { x: 30, z: -25, w: 8, d: WORLD * 1.5 },
  ]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(r.x, 0.012, r.z);
    road.receiveShadow = true;
    runtime.scene.add(road);
  }

  const grid = new THREE.GridHelper(WORLD * 2, 28, 0x7c8879, 0x60705c);
  grid.position.y = 0.025;
  grid.material.opacity = 0.18;
  grid.material.transparent = true;
  runtime.scene.add(grid);
  grid.visible = false;
  addRoadPaint(runtime.scene, WORLD);
  runtime.scene.userData.terrainTheme = {
    ground,
    roadMat,
    grid,
    skyLight,
    sun,
    crowns: [],
  };

  addBuildings();
  addTrees();
  runtime.scene.updateMatrixWorld(true);
  for (const o of runtime.scene.children)
    if (o.userData.cover)
      runtime.coverBounds.push(new THREE.Box3().setFromObject(o));

  runtime.raycaster = new THREE.Raycaster();
  runtime.aimPoint = new THREE.Vector3(0, 0, -10);
  runtime.clock3 = new THREE.Clock();
}

export function applyStageTheme(stage) {
  const theme = runtime.scene.userData.terrainTheme;
  if (!theme) return;
  const desert = stage === 2;
  theme.ground.material.color.setHex(desert ? 0xc5a15d : 0x788064);
  theme.roadMat.color.setHex(desert ? 0x88714d : 0x404643);
  theme.grid.visible = false;
  runtime.scene.background.setHex(desert ? 0xd5bd91 : 0x9cb8b2);
  runtime.scene.fog.color.copy(runtime.scene.background);
  theme.skyLight.color.setHex(desert ? 0xffe4b6 : 0xcde6e4);
  theme.skyLight.groundColor.setHex(desert ? 0x977647 : 0x485642);
  theme.sun.color.setHex(desert ? 0xffdda4 : 0xffefd2);
  for (const crown of theme.crowns)
    crown.material.color.setHex(desert ? 0x877044 : 0x2f5535);
}

export function addBuildings() {
  const specs = [
    [-23, -22, 10, 6, 8],
    [-16, 16, 8, 6, 12],
    [18, -19, 12, 8, 6],
    [24, 18, 9, 7, 10],
    [-39, 2, 7, 5, 8],
    [42, -5, 8, 5, 11],
    [-4, -38, 10, 5, 7],
    [6, 39, 11, 6, 8],
    [-65, -55, 9, 6, 10],
    [62, -58, 10, 7, 8],
    [-60, 58, 10, 6, 8],
    [67, 55, 8, 7, 10],
    [-78, 10, 8, 5, 9],
    [78, -15, 10, 6, 8],
    [-16, -77, 9, 6, 10],
    [16, 77, 9, 6, 8],
  ];
  for (const [x, z, w, h, d] of specs) {
    const root = new THREE.Group();
    const b = box(w, h, d, Math.random() > 0.5 ? 0x8d8068 : 0x6e786f);
    b.position.y = h / 2;
    root.add(b);
    const roof = box(w + 1, 0.35, d + 1, 0x343b37);
    roof.position.y = h + 0.18;
    root.add(roof);
    // Roof hardware and facade details stay inside the original cover footprint.
    const vent = box(w * .25, .55, d * .25, 0x697574);
    vent.position.set(-w * .2, h + .62, -d * .18);
    root.add(vent);
    for (let i = 0; i < 4; i++) {
      const rib = box(w * .23, .035, .09, 0x273433);
      rib.position.set(-w * .2, h + .91, -d * .18 + (i - 1.5) * .22);
      root.add(rib);
    }
    const door = box(1.25, 2.3, .07, 0x263635);
    door.position.set(-w * .22, 1.15, d / 2 + .035);
    root.add(door);
    const lintel = box(1.6, .12, .14, 0xd3ba77);
    lintel.position.set(-w * .22, 2.4, d / 2 + .05);
    root.add(lintel);
    for (let wx = -w / 2 + 1.6; wx < w / 2 - .5; wx += 2) {
      const frame = box(1.05, 1.15, .09, 0x293b3c);
      frame.position.set(wx, h - 1.8, d / 2 + .04);
      root.add(frame);
      const glass = box(.82, .9, .1, 0x65898b);
      glass.position.copy(frame.position); glass.position.z += .015;
      root.add(glass);
    }
    for (let yy = 1.5; yy < h - 1; yy += 1.8) {
      for (const side of [-1, 1]) {
        const win = box(0.7, 0.65, 0.06, 0x9dbdb8);
        win.position.set(side * (w / 2 + 0.04), yy, 0);
        win.rotation.y = Math.PI / 2;
        root.add(win);
      }
    }
    root.position.set(x, 0, z);
    root.userData.cover = true;
    runtime.scene.add(root);
  }

  const crates = [
    [-9, -12],
    [9, -8],
    [-12, 4],
    [13, 8],
    [-31, 12],
    [34, 27],
    [3, 24],
    [-4, -27],
    [20, 2],
    [-21, 31],
    [35, -34],
    [-39, -28],
  ];
  for (const [x, z] of crates) {
    const root = new THREE.Group();
    const count = Math.random() > 0.55 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const b = box(2.2, 1.8, 2.2, 0x66513a);
      b.position.set(i * 0.9, 1 + i * 0.25, i * 0.45);
      root.add(b);
    }
    root.position.set(x, 0, z);
    root.userData.cover = true;
    runtime.scene.add(root);
  }
}

export function addTrees() {
  for (let i = 0; i < 55; i++) {
    const a = runtime.rand(0, TAU),
      r = runtime.rand(18, WORLD - 7);
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Math.abs(x) < 7 || Math.abs(z) < 6) continue;
    const root = new THREE.Group();
    const trunk = cylinder(0.28, 2.2, 0x5b4935, 7);
    trunk.position.y = 1.1;
    root.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(runtime.rand(1.3, 2), runtime.rand(3, 5), 7),
      mat(0x2f5535),
    );
    runtime.scene.userData.terrainTheme.crowns.push(crown);
    crown.position.y = 3.3;
    crown.castShadow = true;
    root.add(crown);
    root.position.set(x, 0, z);
    runtime.scene.add(root);
  }
}
