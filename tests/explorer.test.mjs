import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupExplorer, updateExplorerPose } from '../src/explorer.js';
globalThis.ProgressEvent = class {};
const data = JSON.parse(fs.readFileSync('public/assets/models/player/explorer.gltf'));
for (const m of data.materials || []) { delete m.pbrMetallicRoughness?.baseColorTexture; delete m.normalTexture; }
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(data), '');
const root = new THREE.Group();
gltf.scene.scale.setScalar(1.7); gltf.scene.rotation.y = Math.PI; root.add(gltf.scene);
setupExplorer(root, new THREE.Group());
const mixer = new THREE.AnimationMixer(root);
for (const clipName of ['Idle_Gun','Walk_Gun']) {
  mixer.stopAllAction(); mixer.clipAction(gltf.animations.find(c => c.name === clipName)).play();
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    root.rotation.y = yaw; mixer.update(.25); updateExplorerPose(root);
    for (const arm of root.userData.explorerArms) {
      const gap = arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(root.localToWorld(arm.grip.clone()));
      assert(gap < .16, `${clipName} hand gap ${gap}`);
    }
    const muzzle = root.userData.muzzle;
    const direction = new THREE.Vector3(0,0,1).transformDirection(muzzle.matrixWorld);
    assert(direction.dot(new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw))) > .999);
  }
}
