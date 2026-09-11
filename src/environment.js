import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { overlapsRoad } from './roads.js';

// Bake static detail by material and spatial tile, retaining useful frustum culling.
export function batchEnvironment(scene, roots) {
  scene.updateMatrixWorld(true);
  const batches=new Map(), oldGeometry=new Set(), oldMaterials=new Set();
  for (const root of roots) root.traverse(mesh=>{
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const m=mesh.material, p=new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    const key=`${Math.floor(p.x/32)},${Math.floor(p.z/32)},${m.color.getHex()},${m.roughness},${m.metalness}`;
    if (!batches.has(key)) batches.set(key,{material:m,geometries:[]});
    const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    batches.get(key).geometries.push(geometry);
    oldGeometry.add(mesh.geometry); oldMaterials.add(m);
  });
  const retained=new Set();
  for (const {material,geometries} of batches.values()) {
    const merged=mergeGeometries(geometries);
    if (!merged) throw new Error('Static environment geometry mismatch');
    const mesh=new THREE.Mesh(merged,material);
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh); retained.add(material);
    geometries.forEach(g=>g.dispose());
  }
  roots.forEach(root=>root.removeFromParent());
  oldGeometry.forEach(g=>g.dispose());
  oldMaterials.forEach(m=>{if (!retained.has(m)) m.dispose();});
}

export function dressDistricts(scene) {
  const root=new THREE.Group();
  root.userData.coverBounds=[];
  const materials=new Map();
  const cube=new THREE.BoxGeometry(1,1,1);
  const part=(x,y,z,w,h,d,color)=>{
    if (!materials.has(color)) materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));
    const mesh=new THREE.Mesh(cube,materials.get(color));
    mesh.position.set(x,y,z); mesh.scale.set(w,h,d); root.add(mesh);
    return mesh;
  };
  // District landmarks and dressing stay outside the driveable corridors.
  for (const [cx,cz,tone] of [[-48,-42,0x667b82],[51,-37,0x69775b],[-47,44,0x68734c],[50,42,0xa27648]]) {
    part(cx,.045,cz,25,.06,22,tone);
    for (let i=0;i<3;i++) {
      const x=cx-8+i*7;
      root.userData.coverBounds.push(new THREE.Box3(new THREE.Vector3(x-2.9,0,cz+3.4),new THREE.Vector3(x+2.9,3.1,cz+6.6)));
      part(x,1.45,cz+5,5.6,2.9,3.1,i%2?0x6d807a:0x9b6042);
      for (let k=0;k<7;k++) part(x-2.4+k*.8,1.45,cz+6.58,.08,2.6,.06,0x39484a);
      part(x,2.95,cz+5,5.8,.13,3.2,0xb2a78c);
    }
    // Checkpoint barriers, concrete feet and alternating hazard panels.
    for (let i=0;i<5;i++) {
      const x=cx-10+i*4;
      part(x,.6,cz-8,3,1.2,.7,0x85867c);
      part(x,.85,cz-7.63,2.8,.35,.035,i%2?0xd3ac55:0x303d3d);
    }
    part(cx-11,3.3,cz-3,.18,6.6,.18,0x465054);
    part(cx-10.4,6.4,cz-3,1.6,.25,.6,0xe1c886);
  }
  // Roadside drainage, pavement edges and reflector studs are batched.
  for (let z=-98;z<99;z+=6) for (const x of [-6,6]) {
    part(x,.09,z,.55,.18,5.6,0xaaa58e);
    part(x,.2,z,.16,.06,.3,0xd9c890);
  }
  for (let x=-98;x<99;x+=6) {
    if (Math.abs(x)<8 || Math.abs(x-30)<6) continue;
    for (const z of [-5.3,5.3]) part(x,.08,z,5.6,.16,.55,0xaaa58e);
  }
  for (let i=0;i<100;i++) {
    const x=Math.sin(i*17.13)*96, z=Math.cos(i*9.71)*96;
    if (overlapsRoad(x,z,2,2,2)) continue;
    part(x,.13,z,.5+(i%3)*.25,.26,.45,0x827967);
  }
  scene.add(root);
  return root;
}
