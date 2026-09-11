import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { MODEL_CONFIG } from "./config.js";
import { runtime } from "./runtime.js";
import { setupActorAnimation, playAnimation, updateAnimation } from "./animation.js";
import { setupExplorer } from './explorer.js';
import { equipMobVisual } from './mobVisuals.js';

const loader = new GLTFLoader();
const cache = new Map();
const failures = new Set();
const downloads = new Map();

function configureRoot(root, key, animations = []) {
  const spec = MODEL_CONFIG[key] || {};
  root.scale.multiplyScalar(spec.scale || 1);
  if (spec.rotation) root.rotation.set(...spec.rotation);
  let firstMesh = null;
  root.traverse((node) => {
    if (node.isMesh && (!firstMesh || node.isSkinnedMesh || (spec.vehicle && node.geometry.attributes.position.count > firstMesh.geometry.attributes.position.count))) firstMesh = node;
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  const mountNames = ["gunmount", "weaponmount", "righthand", "handr", "weapon_mount"];
  let mount = null;
  root.traverse((node) => { if (!mount && mountNames.includes(node.name.toLowerCase().replace(/[^a-z0-9_]/g, ""))) mount = node; });
  if (!mount) { mount = new THREE.Group(); const m = spec.mount || {}; mount.position.set(...(m.position || [0.48, 1.55, -0.55])); mount.rotation.set(...(m.rotation || [0, 0, 0])); mount.scale.set(...(m.scale || [1, 1, 1])); root.add(mount); }
  const legs = new THREE.Group();
  // Never detach bones from their skeleton to imitate procedural leg animation.
  root.userData.body = firstMesh || null;
  if (firstMesh && !Array.isArray(firstMesh.material)) firstMesh.material = firstMesh.material.clone();
  if (firstMesh?.material?.color && spec.tint) firstMesh.material.color.setHex(spec.tint);
  if (firstMesh?.material && spec.uniform) {
    firstMesh.material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float cloth = smoothstep(0.10, 0.25, diffuseColor.r - diffuseColor.b)
          * smoothstep(0.02, 0.16, diffuseColor.g - diffuseColor.b);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18,0.25,0.21) * (0.5 + diffuseColor.r), cloth * 0.88);
      `);
    };
    firstMesh.material.customProgramCacheKey = () => 'trooper-olive-v1';
  }
  root.userData.legs = legs;
  root.userData.gunMount = mount;
  root.userData.gun = null;
  root.userData.assetClone = true;
  const originalWeapons = [];
  const weaponNames = ['Axe','Guitar','Knife','Pistol','Rifle','Shotgun','SMG','Spear','WoodenBat_Barbed','WoodenBat_Saw'];
  root.traverse(n => { if (weaponNames.includes(n.name)) originalWeapons.push(n); });
  const authoredRifle = originalWeapons.find(n => n.name === 'Rifle');
  const socket = originalWeapons.find(n => n.name === 'WoodenBat_Saw');
  if (authoredRifle) {
    for (const weapon of originalWeapons) weapon.visible = weapon === authoredRifle;
    root.userData.gun = authoredRifle;
    root.userData.weaponModel = authoredRifle;
    const grip = new THREE.Group();
    grip.position.copy(authoredRifle.position); grip.quaternion.copy(authoredRifle.quaternion);
    authoredRifle.parent.add(grip);
    root.userData.gunMount = grip;
  } else if (socket) {
    const grip = new THREE.Group();
    grip.position.copy(socket.position); grip.quaternion.copy(socket.quaternion); grip.scale.copy(socket.scale);
    socket.parent.add(grip);
    for (const weapon of originalWeapons) weapon.visible = false;
    root.userData.gunMount = grip;
    const rifle = cache.get('rifle')?.gltf;
    if (rifle) {
      const model = rifle.scene.clone(true); model.rotation.x = -Math.PI / 2; grip.add(model);
      root.userData.gun = model; root.userData.weaponModel = model;
    }
  }
  setupActorAnimation(root, animations);
  return root;
}

function cloneTemplate(key) {
  const entry = cache.get(key);
  if (!entry?.gltf) return null;
  const visual = SkeletonUtils.clone(entry.gltf.scene);
  const root = new THREE.Group();
  root.add(visual);
  const spec = MODEL_CONFIG[key] || {};
  visual.scale.setScalar(spec.scale || 1);
  if (spec.rotation) visual.rotation.set(...spec.rotation);
  // Keep gameplay rotation/scale independent of the imported rig transform.
  const configured = configureRoot(root, key, entry.gltf.animations);
  configured.scale.setScalar(1); configured.rotation.set(0,0,0);
  if (spec.clips && configured.userData.mixer) {
    for (const [action, name] of Object.entries(spec.clips)) {
      const clip = entry.gltf.animations.find(c => c.name === name);
      if (clip) configured.userData.actions[action] = configured.userData.mixer.clipAction(clip);
    }
    playAnimation(configured, 'idle', 0);
  }
  if (spec.explorer) setupExplorer(configured, cache.get('rifle')?.gltf?.scene);
  if (spec.unarmed) {
    configured.traverse(n => {if (['Axe','Guitar','Knife','Pistol','Rifle','Shotgun','SMG','Spear','WoodenBat_Barbed','WoodenBat_Saw'].includes(n.name)) n.visible = false;});
    if (configured.userData.weaponModel) configured.userData.weaponModel.visible = false;
  }
  equipMobVisual(configured, spec.equipment);
  return configured;
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
      if (!downloads.has(spec.path)) downloads.set(spec.path, loader.loadAsync(spec.path));
      const gltf = await downloads.get(spec.path);
      cache.set(key, { gltf, done: true });
    } catch (error) {
      failures.add(key); cache.set(key, { gltf: null, done: true });
    } finally {
      runtime.assets.loaded++;
      onProgress(runtime.assets.loaded, runtime.assets.total, key, !isModelReady(key));
    }
  }));
  runtime.assets.ready = true;
  return runtime.assets;
}

export { playAnimation, updateAnimation };
