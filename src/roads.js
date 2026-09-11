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
const ROAD_EDGES = [[0,1],[1,2],[2,3],[1,4],[1,5],[2,6],[2,7]];
const LANE_OFFSET = 1.8;

export function overlapsRoad(x, z, w, d, margin = 1) {
  return ROADS.some(r => Math.abs(x-r.x) < (w+r.w)/2+margin && Math.abs(z-r.z) < (d+r.d)/2+margin);
}

export function roadSpawn(random = Math.random) {
  const edgeIndex = Math.floor(random() * ROAD_EDGES.length);
  const [a, b] = ROAD_EDGES[edgeIndex];
  const t = .08 + random() * .84;
  const lane = random() < .5 ? -1 : 1;
  const forward = random() < .5 ? 1 : -1;
  const from = forward > 0 ? a : b, to = forward > 0 ? b : a;
  const base = new THREE.Vector3(
    ROAD_NODES[a][0] * (1-t) + ROAD_NODES[b][0] * t, 0,
    ROAD_NODES[a][1] * (1-t) + ROAD_NODES[b][1] * t,
  );
  const direction = new THREE.Vector3(
    ROAD_NODES[to][0] - ROAD_NODES[from][0], 0,
    ROAD_NODES[to][1] - ROAD_NODES[from][1],
  ).normalize();
  base.add(new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(lane * LANE_OFFSET));
  base.roadEdge = edgeIndex;
  base.roadFrom = from;
  base.roadTo = to;
  base.lane = lane;
  return base;
}

function lanePoint(node, previous, lane) {
  const direction = new THREE.Vector3(
    ROAD_NODES[node][0] - ROAD_NODES[previous][0], 0,
    ROAD_NODES[node][1] - ROAD_NODES[previous][1],
  ).normalize();
  return new THREE.Vector3(ROAD_NODES[node][0], 0, ROAD_NODES[node][1])
    .add(new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(lane * LANE_OFFSET));
}

function chooseNext(node, previous) {
  const options = links[node].filter(next => next !== previous);
  if (!options.length) return previous;
  const incoming = new THREE.Vector3(
    ROAD_NODES[node][0] - ROAD_NODES[previous][0], 0,
    ROAD_NODES[node][1] - ROAD_NODES[previous][1],
  ).normalize();
  const ranked = options.slice().sort((a, b) => {
    const da = new THREE.Vector3(ROAD_NODES[a][0]-ROAD_NODES[node][0], 0, ROAD_NODES[a][1]-ROAD_NODES[node][1]).normalize();
    const db = new THREE.Vector3(ROAD_NODES[b][0]-ROAD_NODES[node][0], 0, ROAD_NODES[b][1]-ROAD_NODES[node][1]).normalize();
    return (1-da.dot(incoming)) - (1-db.dot(incoming));
  });
  return ranked[Math.random() < .75 ? 0 : Math.floor(Math.random() * ranked.length)];
}

export function driveRoad(actor, dt, speed) {
  const p = actor.mesh.position;
  if (actor.roadTo == null) {
    actor.roadFrom = actor.roadFrom ?? p.roadFrom ?? 0;
    actor.roadTo = actor.roadTo ?? p.roadTo ?? 1;
    actor.lane = actor.lane || p.lane || 1;
  }
  let remaining = dt * speed;
  while (remaining > 0 && actor.roadTo != null) {
    const target = lanePoint(actor.roadTo, actor.roadFrom, actor.lane);
    const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz);
    if (distance > .0001) {
      const step = Math.min(remaining, distance);
      p.x += dx / distance * step;
      p.z += dz / distance * step;
      actor.dir.set(dx / distance, 0, dz / distance);
      remaining -= step;
      if (step < distance) break;
    }
    const next = chooseNext(actor.roadTo, actor.roadFrom);
    actor.roadFrom = actor.roadTo;
    actor.roadTo = next;
  }
}
