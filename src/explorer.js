import * as THREE from 'three';

export function setupExplorer(root, rifleScene) {
  if (!rifleScene) return;
  const old = [];
  root.traverse(n => { if (['Rifle','Axe','Guitar','Knife','Pistol','Shotgun','SMG','Spear','WoodenBat_Barbed','WoodenBat_Saw'].includes(n.name)) old.push(n); });
  for (const n of old) n.visible = false;
  const mount = new THREE.Group();
  mount.position.set(.16, 1.42, -.18);
  mount.rotation.y = Math.PI;
  root.add(mount);
  const gun = rifleScene.clone(true); mount.add(gun);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .08, 1.02); mount.add(muzzle);
  root.userData.gun = gun;
  root.userData.weaponModel = gun;
  root.userData.gunMount = mount;
  root.userData.muzzle = muzzle;
  root.userData.explorerArms = ['R','L'].map((side, i) => ({
    joints: [root.getObjectByName('LowerArm' + side), root.getObjectByName('UpperArm' + side)],
    hand: root.getObjectByName('Middle1' + side),
    grip: new THREE.Vector3(.16, 1.34, i ? -.56 : -.05),
  }));
}

// Solve the forearms after locomotion animation; weapon direction is the same
// local -Z used by gameplay yaw, instead of inheriting the melee socket rotation.
export function updateExplorerPose(root) {
  const arms = root.userData.explorerArms;
  if (!arms) return;
  root.updateWorldMatrix(true, true);
  for (const arm of arms) {
    if (!arm.hand || arm.joints.some(n => !n)) continue;
    const target = root.localToWorld(arm.grip.clone());
    for (let i = 0; i < 8; i++) for (const joint of arm.joints) {
      const origin = joint.getWorldPosition(new THREE.Vector3());
      const from = arm.hand.getWorldPosition(new THREE.Vector3()).sub(origin);
      const to = target.clone().sub(origin);
      if (from.lengthSq() < 1e-8 || to.lengthSq() < 1e-8) continue;
      const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
      const parent = joint.parent.getWorldQuaternion(new THREE.Quaternion());
      joint.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
      joint.updateWorldMatrix(true, true);
    }
  }
}
