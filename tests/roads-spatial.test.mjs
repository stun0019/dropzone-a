import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ROADS, roadSpawn, driveRoad } from '../src/roads.js';
import { SpatialGrid } from '../src/spatial.js';

test('vehicles remain on connected roads through long patrols and junctions',()=>{
  for(let i=0;i<40;i++) {
    const actor={mesh:{position:roadSpawn()},dir:new THREE.Vector3()};
    for(let frame=0;frame<2400;frame++) {
      const before=actor.mesh.position.clone();
      driveRoad(actor,.05,8);
      const p=actor.mesh.position;
      assert.ok(ROADS.some(r=>Math.abs(p.x-r.x)<=r.w/2-1.5 && Math.abs(p.z-r.z)<=r.d/2-1.5));
      assert.ok(p.distanceTo(before)<=.400001);
      assert.ok(Number.isFinite(p.x+p.z));
    }
  }
});
test('spatial search includes nearby actors across negative and positive cell boundaries',()=>{
  const actors=Array.from({length:100},(_,i)=>({mesh:{position:new THREE.Vector3(i-50,0,i%11-5)},dead:i%9===0}));
  const grid=new SpatialGrid();grid.rebuild(actors);
  for(const center of [new THREE.Vector3(-8,0,0),new THREE.Vector3(0,0,0),new THREE.Vector3(8,0,0)]) {
    const actual=new Set(grid.near(center,8));
    for(const actor of actors) if(!actor.dead && actor.mesh.position.distanceTo(center)<=8) assert.ok(actual.has(actor));
    assert.ok([...actual].every(a=>!a.dead));
  }
});
