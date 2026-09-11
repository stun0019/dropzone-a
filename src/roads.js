import * as THREE from 'three';
import { WORLD } from './config.js';

// Shared by road rendering, placement and vehicle navigation.
export const ROADS = [
  { x: 0, z: 0, w: 10, d: WORLD * 2 },
  { x: 0, z: 0, w: WORLD * 2, d: 9 },
  { x: 30, z: -25, w: 8, d: WORLD * 1.5 },
];
const end = WORLD - 5;
export const ROAD_NODES = [
  [-end, 0], [0, 0], [30, 0], [end, 0],
  [0, -end], [0, end], [30, -end], [30, 48],
];
const links = [[1], [0,2,4,5], [1,3,6,7], [2], [1], [1], [2], [2]];
export function overlapsRoad(x, z, w, d, margin = 1) {
  return ROADS.some(r => Math.abs(x-r.x) < (w+r.w)/2+margin && Math.abs(z-r.z) < (d+r.d)/2+margin);
}
export function roadSpawn(random = Math.random) {
  const edges = [[0,1],[1,2],[2,3],[1,4],[1,5],[2,6],[2,7]];
  const [a,b] = edges[Math.floor(random()*edges.length)];
  const t = .08 + random()*.84;
  return new THREE.Vector3(ROAD_NODES[a][0]*(1-t)+ROAD_NODES[b][0]*t, 0,
    ROAD_NODES[a][1]*(1-t)+ROAD_NODES[b][1]*t);
}
export function driveRoad(actor, dt, speed) {
  const p = actor.mesh.position;
  if (actor.roadNode == null) {
    let best = Infinity;
    ROAD_NODES.forEach(([x,z], i) => {
      const aligned = Math.abs(p.x-x)<.01 || Math.abs(p.z-z)<.01;
      const d = (p.x-x)**2+(p.z-z)**2;
      if (aligned && d < best) { best=d; actor.roadNode=i; }
    });
  }
  let remaining = dt*speed;
  while (remaining > 0 && actor.roadNode != null) {
    const [x,z] = ROAD_NODES[actor.roadNode];
    const dx=x-p.x, dz=z-p.z, distance=Math.hypot(dx,dz);
    if (distance > .0001) {
      const step=Math.min(remaining,distance);
      p.x+=dx/distance*step; p.z+=dz/distance*step;
      actor.dir.set(dx/distance,0,dz/distance);
      remaining-=step;
      if (step < distance) break;
    }
    const options=links[actor.roadNode].filter(n=>n!==actor.previousRoadNode);
    const next=options.length ? options[Math.floor(Math.random()*options.length)] : actor.previousRoadNode;
    actor.previousRoadNode=actor.roadNode; actor.roadNode=next;
  }
}
