import * as THREE from "three";
import { runtime } from "./runtime.js";
import { settleCaptures } from "./combat.js";
import { collides, moveEntity } from "./actors.js";
import { WORLD } from "./config.js";
import { updateAnimation, playAnimation } from "./assets.js";

export function disposeMesh(root) {
  root.removeFromParent();
  // GLB clones share cached geometry/material resources. The cache owns them.
  if (root.userData?.assetClone) return;
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    }
  });
}

export function recycleMob(b) {
  b.mesh.removeFromParent();
  b.mesh.rotation.set(0, 0, 0);
  b.mesh.scale.setScalar(b.mesh.userData.baseScale || 1);
  if (b.mesh.userData.body?.material?.emissive) b.mesh.userData.body.material.emissive.setHex(0);
  if (runtime.mobPool[b.type].length < 20) runtime.mobPool[b.type].push(b.mesh);
  else disposeMesh(b.mesh);
}

export function releaseEffect(item, pool) {
  item.mesh.removeFromParent();
  if (pool.length < 64) pool.push(item.mesh);
  else disposeMesh(item.mesh);
}

export function clearTransient() {
  settleCaptures(0, true);
  for (const grenade of runtime.G.grenades) disposeMesh(grenade.mesh);
  runtime.G.grenades = [];
  for (const t of runtime.G.tracers) releaseEffect(t, runtime.beamPool[t.kind]);
  for (const t of runtime.G.impacts) releaseEffect(t, runtime.impactPool);
  runtime.G.tracers = [];
  runtime.G.impacts = [];
  for (const flight of runtime.G.flights) flight.node.remove();
  runtime.G.flights = [];
  runtime.$("floaters").replaceChildren();
}

export function resetInput() {
  runtime.mouseDown = false;
  runtime.mobileFiring = false;
  runtime.keys.clear();
  runtime.joyVec = { x: 0, y: 0 };
  runtime.aimPointer = null;
  runtime.pointer = null;
  runtime.joyPointer = null;
  runtime.stick.style.transform = "translate(-50%,-50%)";
}

export function sightDistance(origin, dir, max = 35) {
  let limit = max;
  for (const box of runtime.coverBounds) {
    let lo = 0,
      hi = limit;
    for (const axis of ["x", "y", "z"]) {
      if (Math.abs(dir[axis]) < 1e-7) {
        if (origin[axis] < box.min[axis] || origin[axis] > box.max[axis]) {
          hi = -1;
          break;
        }
      } else {
        let a = (box.min[axis] - origin[axis]) / dir[axis],
          b = (box.max[axis] - origin[axis]) / dir[axis];
        if (a > b) [a, b] = [b, a];
        lo = Math.max(lo, a);
        hi = Math.min(hi, b);
      }
    }
    if (hi >= lo && lo < limit) limit = lo;
  }
  return limit;
}

export function visibleTarget(from, to) {
  const origin = from.clone();
  origin.y = 1.55;
  const d = to.clone().sub(origin);
  d.y = 0;
  const length = d.length();
  if (length < 0.01) return true;
  return sightDistance(origin, d.normalize(), length) >= length - 0.7;
}

export function walkClear(a, b, r = 0.65) {
  if (collides(a, r) || collides(b, r)) return false;
  for (const box of runtime.coverBounds) {
    let lo = 0,
      hi = 1;
    for (const axis of ["x", "z"]) {
      const delta = b[axis] - a[axis],
        min = box.min[axis] - r,
        max = box.max[axis] + r;
      if (Math.abs(delta) < 1e-9) {
        if (a[axis] <= min || a[axis] >= max) {
          hi = -1;
          break;
        }
      } else {
        let p = (min - a[axis]) / delta,
          q = (max - a[axis]) / delta;
        if (p > q) [p, q] = [q, p];
        lo = Math.max(lo, p);
        hi = Math.min(hi, q);
      }
    }
    if (hi >= lo) return false;
  }
  return true;
}

export function findPath(start, goal, r = 0.65) {
  if (walkClear(start, goal, r)) return [goal.clone()];
  const size = 2,
    edge = WORLD - 4,
    n = Math.floor((edge * 2) / size) + 1;
  const point = (id) =>
    new THREE.Vector3(
      (id % n) * size - edge,
      0,
      Math.floor(id / n) * size - edge,
    );
  const blocked = new Map();
  const openCell = (id) => {
    if (id < 0 || id >= n * n) return false;
    if (!blocked.has(id)) blocked.set(id, collides(point(id), r));
    return !blocked.get(id);
  };
  const nearest = (p) => {
    const cx = Math.round((p.x + edge) / size),
      cz = Math.round((p.z + edge) / size);
    let best = -1,
      d = Infinity;
    for (let z = cz - 2; z <= cz + 2; z++)
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        const id = z * n + x,
          q = point(id),
          dist = q.distanceToSquared(p);
        if (dist < d && openCell(id) && walkClear(p, q, r)) {
          best = id;
          d = dist;
        }
      }
    return best;
  };
  const source = nearest(start),
    dest = nearest(goal);
  if (source < 0 || dest < 0) return null;
  const heap = [],
    cost = new Map([[source, 0]]),
    parent = new Map(),
    closed = new Set();
  const push = (item) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i) {
      let p = (i - 1) >> 1;
      if (heap[p].f <= item.f) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = item;
  };
  const pop = () => {
    const top = heap[0],
      tail = heap.pop();
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
        if (heap[c].f >= tail.f) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = tail;
    }
    return top;
  };
  const goalPoint = point(dest);
  push({ id: source, f: point(source).distanceTo(goalPoint) });
  while (heap.length) {
    const { id } = pop();
    if (closed.has(id)) continue;
    if (id === dest) {
      const path = [goal.clone()];
      let cur = id;
      while (cur !== source) {
        path.push(point(cur));
        cur = parent.get(cur);
      }
      path.push(point(source));
      return path.reverse();
    }
    closed.add(id);
    const x = id % n,
      z = Math.floor(id / n),
      from = point(id);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const next = nz * n + nx;
      if (closed.has(next) || !openCell(next)) continue;
      const to = point(next);
      if (!walkClear(from, to, r)) continue;
      const c = cost.get(id) + from.distanceTo(to);
      if (c < (cost.get(next) ?? Infinity)) {
        cost.set(next, c);
        parent.set(next, id);
        push({ id: next, f: c + to.distanceTo(goalPoint) });
      }
    }
  }
  return null;
}

export function navigateTo(entity, goal, dt, speed) {
  const pos = entity.mesh.position,
    r = (entity.radius || 0.55) + 0.12;
  if (walkClear(pos, goal, r)) {
    entity.nav = null;
    const delta = goal.clone().sub(pos).setY(0);
    const length = delta.length();
    if (length > 0.05)
      moveEntity(
        entity,
        delta.normalize().multiplyScalar(Math.min(length, speed * dt)),
      );
    return true;
  }
  if (entity.nav) entity.nav.ttl -= dt;
  if (
    !entity.nav ||
    entity.nav.ttl <= 0 ||
    entity.nav.goal.distanceToSquared(goal) > 16
  ) {
    const path = findPath(pos, goal, r);
    entity.nav = { path, goal: goal.clone(), ttl: 1.1, stuck: 0 };
  }
  const nav = entity.nav;
  if (!nav.path) return false;
  while (
    nav.path.length &&
    pos.distanceTo(nav.path[0]) < 0.12 &&
    (!nav.path[1] || walkClear(pos, nav.path[1], r))
  )
    nav.path.shift();
  for (let i = nav.path.length - 1; i > 0; i--)
    if (walkClear(pos, nav.path[i], r)) {
      nav.path.splice(0, i);
      break;
    }
  if (!nav.path.length) return true;
  const delta = nav.path[0].clone().sub(pos).setY(0),
    length = delta.length(),
    before = pos.clone();
  moveEntity(
    entity,
    delta.normalize().multiplyScalar(Math.min(length, speed * dt)),
  );
  nav.stuck = pos.distanceToSquared(before) < 0.00001 ? nav.stuck + dt : 0;
  if (nav.stuck > 0.4) entity.nav = null;
  return true;
}

export function smoothMotion(entity, desired, dt, profile = {}) {
  const current = entity.motionSpeed || 0;
  const rate = desired > current ? (profile.accel || 10) : (profile.decel || 8);
  entity.motionSpeed = current + (desired - current) * (1 - Math.exp(-dt * rate));
  if (Math.abs(entity.motionSpeed) < .015 && desired === 0) entity.motionSpeed = 0;
  return entity.motionSpeed;
}

export function steer(entity, dir, dt, speed) {
  const pos = entity.mesh.position,
    step = speed * dt;
  const probe = pos.clone().addScaledVector(dir, Math.max(1.7, step));
  if (collides(probe, entity.radius || 0.55)) {
    entity.turnSide = entity.turnSide || 1;
    for (const angle of [Math.PI / 3, Math.PI / 2, Math.PI * 0.8, Math.PI]) {
      const detour = dir
        .clone()
        .applyAxisAngle(runtime.UP, angle * entity.turnSide);
      if (
        !collides(
          pos.clone().addScaledVector(detour, 1.7),
          entity.radius || 0.55,
        )
      ) {
        moveEntity(entity, detour.multiplyScalar(step));
        return;
      }
    }
    entity.turnSide *= -1;
    return;
  }
  moveEntity(entity, dir.clone().multiplyScalar(step));
}

export function animateMob(b, dt, moving) {
  // Debounce brief collision stops so clips do not restart on every frame.
  b.motionHold = moving ? .14 : Math.max(0, (b.motionHold || 0) - dt);
  moving = moving || b.motionHold > 0;
  const profile = b.motion || b.mesh.userData.motionProfile || {};
  const running = moving && (b.chaseState === 'chase' || (b.motionSpeed || 0) > (b.speed || 1) * 1.08);
  if (b.mesh.userData.actions) playAnimation(b.mesh, moving ? (running && b.mesh.userData.actions.run ? 'run' : 'walk') : "idle");
  updateAnimation(b.mesh, dt);
  b.walk += dt * (b.motionSpeed || b.speed) * (profile.legRate || 1);
  if (b.type === 'boss' && b.mesh.userData.bossAura) {
    const pulse = 1 + Math.sin((b.walk || 0) * .9) * .07;
    b.mesh.userData.bossAura.scale.setScalar(pulse);
    b.mesh.userData.bossCore.scale.setScalar(1 + Math.sin((b.walk || 0) * 1.4) * .12);
    b.mesh.userData.bossAura.material.opacity = .48 + (pulse - .93) * 1.8;
  }
  for (const wheel of b.mesh.userData.wheels || [])
    if (moving) wheel.rotation.x += dt * b.speed * 2;
  const legs = b.mesh.userData.legs?.children || [];
  for (let i = 0; i < legs.length; i++)
    legs[i].rotation.x += ((moving ? Math.sin(b.walk * 3 + i * Math.PI) * 0.4 : 0) - legs[i].rotation.x) * (1 - Math.exp(-dt * 14));
  b.hitTime = Math.max(0, (b.hitTime || 0) - dt);
  if (!b.mesh.userData.assetClone && b.mesh.userData.body) b.mesh.userData.body.rotation.x =
    (b.type === "zombie" ? 0.12 : 0) + Math.sin(b.hitTime * 35) * b.hitTime;
}
