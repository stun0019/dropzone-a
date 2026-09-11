import * as THREE from 'three';

// Role-specific equipment on the animated character, in gameplay coordinates.
export function equipMobVisual(root, role) {
  if (role === 'shield') {
    const outline = new THREE.Shape();
    outline.moveTo(-.42, -.72); outline.lineTo(.42, -.72);
    outline.lineTo(.54, -.46); outline.lineTo(.54, .62);
    outline.lineTo(.34, .8); outline.lineTo(-.34, .8);
    outline.lineTo(-.54, .62); outline.lineTo(-.54, -.46); outline.closePath();
    const shield = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, {depth:.075,bevelEnabled:true,bevelSize:.045,bevelThickness:.025,bevelSegments:2,steps:1}),new THREE.MeshStandardMaterial({color:0x263746,metalness:.55,roughness:.38}));
    shield.position.set(-.5,1.27,-.56); shield.rotation.y = -.18; shield.castShadow = true;
    root.add(shield);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.65,.19),new THREE.MeshStandardMaterial({color:0x91bcc0,metalness:.7,roughness:.2,side:THREE.DoubleSide}));
    glass.position.set(0,.42,-.028); shield.add(glass);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(.72,.08),new THREE.MeshBasicMaterial({color:0xd3ae67,side:THREE.DoubleSide}));
    stripe.position.set(0,-.3,-.028); shield.add(stripe);
    // Left hand follows the shield handle while right hand retains the rifle.
    const support = root.userData.explorerArms?.[1];
    if (support) support.grip.set(-.45,1.3,-.38);
  }
  if (role === 'sniper') {
    const mount = root.userData.gunMount;
    if (!mount) return;
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.38,12),new THREE.MeshStandardMaterial({color:0x202b30,metalness:.5,roughness:.35}));
    scope.rotation.x = Math.PI / 2; scope.position.set(0,.33,.02); mount.add(scope);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.42,12),scope.material);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0,.08,1.12); mount.add(barrel);
    if (root.userData.muzzle) root.userData.muzzle.position.z = 1.34;
  }
}
