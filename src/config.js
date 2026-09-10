export const TAU = Math.PI * 2;

export const WORLD = 105;

export const SECTORS = [
  { name: "A區 · 西北", minX: -WORLD, maxX: 0, minZ: -WORLD, maxZ: 0 },
  { name: "B區 · 東北", minX: 0, maxX: WORLD, minZ: -WORLD, maxZ: 0 },
  { name: "C區 · 西南", minX: -WORLD, maxX: 0, minZ: 0, maxZ: WORLD },
  { name: "D區 · 東南", minX: 0, maxX: WORLD, minZ: 0, maxZ: WORLD },
];

export const RTP = 0.985;

export const LOOT_TABLE = [
  { type: "med", label: "醫療包", min: 5, max: 10, weight: 0.62 },
  { type: "ammo", label: "彈藥箱", min: 10, max: 25, weight: 0.3 },
  { type: "armor", label: "護甲", min: 25, max: 35, weight: 0.08 },
];

export const LOOT_MEAN = LOOT_TABLE.reduce(
  (sum, t) => sum + (t.weight * (t.min + t.max)) / 2,
  0,
);

export const WEAPONS = {
  rifle: "步槍",
  laser: "雷射槍",
  shotgun: "散彈槍",
  rocket: "火箭筒",
  grenade: "手榴彈",
};

export const WEAPON_RATES = {
  rifle: 5.5,
  laser: 6,
  shotgun: 3.5,
  rocket: 2,
  grenade: 1.8,
};

export const BOSS_TYPES = [
  {
    name: "裝甲暴君",
    color: 0x792c32,
    scale: 2,
    min: 60,
    max: 120,
    speed: 1.7,
  },
  {
    name: "劇毒巨獸",
    color: 0x547b28,
    scale: 2.15,
    min: 120,
    max: 220,
    speed: 1.9,
  },
  {
    name: "重裝督軍",
    color: 0x364f72,
    scale: 2.3,
    min: 220,
    max: 400,
    speed: 1.45,
  },
];

export const MOB_TYPES = {
  zombie: {
    name: "遊蕩殭屍",
    faction: "zombie",
    speed: 2.6,
    radius: 0.55,
    intel: 6,
    range: 2.2,
  },
  soldier: {
    name: "突擊士兵",
    faction: "soldier",
    speed: 3.1,
    radius: 0.55,
    intel: 10,
    range: 22,
  },
  villager: {
    name: "村民",
    faction: "civilian",
    speed: 2,
    radius: 0.5,
    intel: 6,
    range: 0,
    peaceful: true,
  },
  brute: {
    name: "肥胖感染者",
    faction: "zombie",
    speed: 1.8,
    radius: 0.85,
    intel: 6,
    range: 3,
  },
  spitter: {
    name: "毒液感染者",
    faction: "zombie",
    speed: 2.3,
    radius: 0.55,
    intel: 6,
    range: 10,
  },
  shield: {
    name: "盾牌衛兵",
    faction: "soldier",
    speed: 2.1,
    radius: 0.65,
    intel: 10,
    range: 12,
  },
  sniper: {
    name: "狙擊手",
    faction: "soldier",
    speed: 2.5,
    radius: 0.55,
    intel: 10,
    range: 28,
  },
  jeep: {
    name: "武裝吉普車",
    faction: "soldier",
    speed: 4.2,
    radius: 1.15,
    intel: 10,
    range: 22,
    vehicle: true,
  },
  scavenger: {
    name: "拾荒者",
    faction: "civilian",
    speed: 2.7,
    radius: 0.6,
    intel: 6,
    range: 0,
    peaceful: true,
  },
  tank: {
    name: "主戰坦克",
    faction: "soldier",
    speed: 1.8,
    radius: 1.8,
    intel: 10,
    range: 26,
    vehicle: true,
  },
};

export const MOB_KEYS = Object.keys(MOB_TYPES);

// Runtime model overrides. Files are optional: when a GLB is absent or fails
// to load, models.js keeps using its procedural fallback.
export const MODEL_CONFIG = {
  player: { path: "./assets/models/player/ranger.gltf", scale: 1.7, rotation: [0, Math.PI, 0], clips: {idle:'Idle_Gun', walk:'Walk_Gun', run:'Run_Gun', shoot:'Idle_Gun'} },
  zombie: { path: "./assets/models/enemies/infected.gltf", scale: 1.8, rotation:[0,Math.PI,0] },
  soldier: { path: "./assets/models/player/ranger.gltf", scale: 1.7, rotation:[0,Math.PI,0], clips:{idle:'Idle_Gun',walk:'Walk_Gun'} },
  brute: { path: "./assets/models/enemies/heavy.gltf", scale: 1.85, rotation:[0,Math.PI,0] },
  spitter: { path: "./assets/models/enemies/infected.gltf", scale: 1.65, rotation:[0,Math.PI,0] },
  shield: { path: "./assets/models/player/ranger.gltf", scale: 1.85, rotation:[0,Math.PI,0], clips:{idle:'Idle_Gun',walk:'Walk_Gun'} },
  sniper: { path: "./assets/models/player/ranger.gltf", scale: 1.7, rotation:[0,Math.PI,0], clips:{idle:'Idle_Gun',walk:'Walk_Gun'} },
  jeep: { path: "./assets/models/vehicles/jeep.glb", scale: 1 },
  tank: { path: "./assets/models/vehicles/tank.glb", scale: 1 },
  scavenger: { path: "./assets/models/enemies/scavenger.glb", scale: 1 },
  villager: { path: "./assets/models/enemies/villager.glb", scale: 1 },
  boss0: { path: "./assets/models/bosses/armor-tyrant.glb", scale: 2 },
  boss1: { path: "./assets/models/bosses/toxic-beast.glb", scale: 2.15 },
  boss2: { path: "./assets/models/bosses/heavy-warlord.glb", scale: 2.3 },
  rifle: { path: "./assets/models/weapons/rifle.gltf", scale: 1 },
  laser: { path: "./assets/models/weapons/laser.glb", scale: 1 },
  shotgun: { path: "./assets/models/weapons/shotgun.glb", scale: 1 },
  rocket: { path: "./assets/models/weapons/rocket.glb", scale: 1 },
  grenade: { path: "./assets/models/weapons/grenade.glb", scale: 1 },
};
