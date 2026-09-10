import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { MODEL_CONFIG } from "./config.js";
import { runtime } from "./runtime.js";
import { setupActorAnimation, playAnimation, updateAnimation } from "./animation.js";

const loader = new GLTFLoader();
const cache = new Map();
const failures = new Set();

function configureRoot(root, key, animations = []) {
  const spec = MODEL_CONFIG[key] || {};
  root.scale.multiplyScalar(spec.scale || 1);
  if (spec.rotation) root.rotation.set(...spec.rotation);
  let firstMesh = null;
  root.traverse((node) => {
    if (node.isMesh && !firstMesh) firstMesh = node;
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  const mountNames = ["gunmount", "weaponmount", "righthand", "handr", "weapon_mount"];
  let mount = null;
  root.traverse((node) => { if (!mount && mountNames.includes(node.name.toLowerCase().replace(/[^a-z0-9_]/g, ""))) mount = node; });
  if (!mount) { mount = new THREE.Group(); const m = spec.mount || {}; mount.position.set(...(m.position || [0.48, 1.55, -0.55])); mount.rotation.set(...(m.rotation || [0, 0, 0])); mount.scale.set(...(m.scale || [1, 1, 1])); root.add(mount); }
  const legs = new THREE.Group();
  const legNames = ["legs", "leg", "lowerbody", "walk"];
  root.traverse((node) => { if (node !== root && legNames.some((n) => node.name.toLowerCase().includes(n))) legs.add(node); });
  root.userData.body = firstMesh || null;
  root.userData.legs = legs;
  root.userData.gunMount = mount;
  root.userData.gun = firstMesh || null;
  root.userData.assetClone = true;
  setupActorAnimation(root, animations);
  return root;
}

function cloneTemplate(key) {
  const entry = cache.get(key);
  if (!entry?.gltf) return null;
  const root = SkeletonUtils.clone(entry.gltf.scene);
  return configureRoot(root, key, entry.gltf.animations);
}

export function createActorModel(key) { return cloneTemplate(key); }

export function attachWeapon(actor, weapon) {
  const model = cloneTemplate(weapon);
  if (!model) return false;
  const mount = actor?.mesh?.userData?.gunMount || actor?.mesh;
  if (!mount) return false;
  if (actor.mesh.userData.weaponModel) actor.mesh.userData.weaponModel.removeFromParent();
  model.userData.isWeaponModel = true;
  mount.add(model);
  actor.mesh.userData.weaponModel = model;
  if (actor.mesh.userData.gun) actor.mesh.userData.gun.visible = false;
  return true;
}

export function modelStatus() {
  const values = [...cache.values()];
  return { loaded: values.filter((v) => v.done).length, total: values.length, failures: failures.size };
}

export function isModelReady(key) { return cache.get(key)?.gltf != null; }

export async function preloadModels(onProgress = () => {}) {
  const entries = Object.entries(MODEL_CONFIG);
  runtime.assets = { cache, failures, loaded: 0, total: entries.length, ready: false };
  await Promise.all(entries.map(async ([key, spec], index) => {
    try {
      const gltf = await new Promise((resolve, reject) => loader.load(spec.path, resolve, undefined, reject));
      cache.set(key, { gltf, done: true });
    } catch (error) {
      failures.add(key); cache.set(key, { gltf: null, done: true });
    } finally {
      runtime.assets.loaded = index + 1;
      onProgress(runtime.assets.loaded, runtime.assets.total, key, !isModelReady(key));
    }
  }));
  runtime.assets.ready = true;
  return runtime.assets;
}

export { playAnimation, updateAnimation };
