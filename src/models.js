import * as THREE from "three";
import { TAU, MOB_TYPES, BOSS_TYPES } from "./config.js";
import { createActorModel } from "./assets.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function mat(color, rough = 0.8, metal = 0.05, emissive = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    emissive,
    emissiveIntensity: 0.65,
  });
}

export function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cylinder(r, h, color, sides = 10) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, sides),
    mat(color),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function makeSoldier(color = 0x334c3b, enemy = false, modelKey = null) {
  const asset = modelKey && createActorModel(modelKey);
  if (asset) return asset;
  const root = new THREE.Group();
  const legs = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.25, 0.55, 2, .1), mat(color));
  body.castShadow = true;
  body.position.y = 1.55;
  root.add(body);
  const vest = box(1.02, 0.72, 0.64, enemy ? 0x4b2f29 : 0x1f2a22);
  vest.position.set(0, 1.68, 0);
  root.add(vest);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 7),
    mat(0xc29a75),
  );
  head.position.y = 2.48;
  head.castShadow = true;
  root.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 10, 5, 0, TAU, 0, Math.PI * 0.58),
    mat(enemy ? 0x6b3a30 : 0x35443a),
  );
  helmet.position.y = 2.58;
  helmet.castShadow = true;
  root.add(helmet);
  const visor = box(.57, .17, .13, enemy ? 0x8c4731 : 0x4cafbc);
  visor.position.set(0, 2.52, -.32);
  visor.material.metalness = .65;
  visor.material.roughness = .22;
  root.add(visor);
  const pack = box(.66, .76, .3, enemy ? 0x594735 : 0x34474c);
  pack.position.set(0, 1.7, .43);
  root.add(pack);
  for (const x of [-.32, .32]) {
    const strap = box(.11, .78, .08, 0x89846a);
    strap.position.set(x, 1.77, -.35); root.add(strap);
    const pouch = box(.25, .28, .19, enemy ? 0x7e6042 : 0x657660);
    pouch.position.set(x, 1.42, -.4); root.add(pouch);
    const shoulder = new THREE.Mesh(new RoundedBoxGeometry(.31, .36, .5, 2, .07), mat(color));
    shoulder.position.set(x * 1.65, 1.96, 0); shoulder.castShadow = true; root.add(shoulder);
  }
  for (const x of [-0.25, 0.25]) {
    const leg = box(0.25, 0.75, 0.28, 0x202b25);
    leg.position.set(x, 0.6, 0);
    legs.add(leg);
    const boot = box(.29, .23, .43, 0x172326);
    boot.position.set(x, .19, -.07); legs.add(boot);
    const knee = box(.28, .24, .1, 0x758077);
    knee.position.set(x, .62, -.18); legs.add(knee);
  }
  root.add(legs);
  const gun = box(0.16, 0.16, 1.3, 0x1c2421);
  gun.position.set(0.48, 1.62, -0.55);
  gun.rotation.x = -0.08;
  root.add(gun);
  const barrel = box(.08, .08, .55, 0x111c21);
  barrel.position.set(0, 0, -.8); gun.add(barrel);
  const sight = box(.12, .13, .2, 0x536569);
  sight.position.set(0, .14, -.12); gun.add(sight);
  const arm = box(0.23, 0.7, 0.23, 0xb98264);
  arm.position.set(0.5, 1.55, -0.13);
  arm.rotation.x = -0.8;
  root.add(arm);
  root.userData = { body, legs, gun };
  return root;
}

export function makeVehicle(type) {
  const asset = createActorModel(type);
  if (asset) { asset.userData.vehicle = true; return asset; }
  const root = new THREE.Group(),
    heavy = type !== "jeep",
    tank = type === "tank";
  const body = box(
    tank ? 2.9 : heavy ? 2.45 : 1.9,
    heavy ? 0.9 : 0.55,
    tank ? 3.8 : heavy ? 3.5 : 2.8,
    tank ? 0x69714a : heavy ? 0x5e6f79 : 0x9d7645,
  );
  body.position.y = heavy ? 1.05 : 0.85;
  root.add(body);
  const wheels = [];
  for (const side of [-1, 1]) {
    if (tank) {
      const track = box(0.5, 0.8, 4.1, 0x242827);
      track.position.set(side * 1.5, 0.55, 0);
      root.add(track);
    }
    for (const z of heavy ? [-1.2, 0, 1.2] : [-0.95, 0.95]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.43, 0.43, 0.3, 10),
        mat(0x24292b),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * (tank ? 1.53 : heavy ? 1.22 : 1), 0.5, z);
      root.add(wheel);
      wheels.push(wheel);
    }
  }
  if (!tank) {
    const cabin = box(
      heavy ? 2.1 : 1.65,
      heavy ? 0.65 : 0.7,
      heavy ? 1.65 : 1.1,
      heavy ? 0x485762 : 0x665543,
    );
    cabin.position.set(0, 1.55, -0.55);
    root.add(cabin);
    const glass = box(heavy ? 1.5 : 1.4, 0.36, 0.06, 0x83bbc7);
    glass.position.set(0, 1.64, -(heavy ? 1.39 : 1.13));
    root.add(glass);
  }
  const turret = new THREE.Group();
  turret.position.set(0, tank ? 1.7 : 1.95, tank ? 0 : 0.65);
  root.add(turret);
  const housing = box(
    tank ? 1.65 : 0.75,
    tank ? 0.6 : 0.35,
    tank ? 1.5 : 0.7,
    tank ? 0x454f32 : 0x333d40,
  );
  turret.add(housing);
  const gun = box(
    tank ? 0.22 : 0.12,
    tank ? 0.22 : 0.12,
    tank ? 2.7 : 1.3,
    0x26302b,
  );
  gun.position.z = tank ? -1.6 : -0.8;
  turret.add(gun);
  root.userData = {
    body,
    legs: new THREE.Group(),
    wheels,
    turret,
    gun,
    vehicle: true,
  };
  return root;
}

export function makeMob(type) {
  if (MOB_TYPES[type].vehicle) return makeVehicle(type);
  const asset = createActorModel(type);
  if (asset) return asset;
  if (MOB_TYPES[type].peaceful) {
    const root = makeSoldier(type === "villager" ? 0xc19d72 : 0x9a6d45, false);
    root.userData.gun.visible = false;
    const pack = box(
      type === "villager" ? 0.65 : 0.95,
      type === "villager" ? 0.7 : 1.15,
      0.6,
      type === "villager" ? 0x947544 : 0x555341,
    );
    pack.position.set(0, 1.45, 0.55);
    root.add(pack);
    if (type === "villager") {
      const hat = cylinder(0.62, 0.1, 0xc5a66b, 10);
      hat.position.y = 2.64;
      root.add(hat);
    } else {
      const roll = cylinder(0.2, 1.05, 0x998a63, 8);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 2.12, 0.65);
      root.add(roll);
    }
    return root;
  }
  if (MOB_TYPES[type].faction === "zombie") {
    const root = makeZombie(type === "brute");
    if (type === "brute") root.userData.baseScale = 1.08;
    if (type === "spitter") {
      root.userData.body.material.color.setHex(0x91a533);
      const sac = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 9, 7),
        mat(0x829a2d),
      );
      sac.position.set(0, 1.8, 0.5);
      root.add(sac);
    }
    return root;
  }
  const root = makeSoldier(
    type === "sniper" ? 0x7a7656 : type === "shield" ? 0x354454 : 0x536479,
    true,
  );
  if (type === "shield") {
    const shield = box(0.95, 1.55, 0.15, 0x354355);
    shield.position.set(-0.55, 1.45, -0.65);
    root.add(shield);
    const slit = box(0.48, 0.16, 0.17, 0x88c4cb);
    slit.position.set(-0.55, 1.96, -0.66);
    root.add(slit);
  }
  if (type === "sniper") {
    root.userData.gun.scale.z = 1.9;
    const scope = box(0.18, 0.18, 0.5, 0x20292a);
    scope.position.set(0.48, 1.82, -0.65);
    root.add(scope);
    const cape = box(1.1, 1.2, 0.16, 0x666944);
    cape.position.set(0, 1.4, 0.4);
    root.add(cape);
  }
  return root;
}

export function makeBoss(variant = 0) {
  const spec = BOSS_TYPES[variant],
    root = createActorModel("boss" + variant) || (variant === 2 ? makeSoldier(spec.color, true) : makeZombie(true));
  root.scale.setScalar(spec.scale);
  root.userData.baseScale = spec.scale;
  root.userData.bossVariant = variant;
  const bodyMaterial = root.userData.body?.material;
  const bodyColor = Array.isArray(bodyMaterial) ? bodyMaterial[0]?.color : bodyMaterial?.color;
  bodyColor?.setHex(spec.color);
  if (variant === 1) {
    for (const x of [-0.5, 0.5]) {
      const tank = cylinder(0.3, 1.7, 0x9bba30, 8);
      tank.position.set(x, 1.7, 0.7);
      root.add(tank);
    }
  }
  if (variant === 2) {
    const shield = box(1.5, 1.8, 0.28, 0x293646);
    shield.position.set(-0.75, 1.5, -0.65);
    root.add(shield);
    root.userData.gun?.scale.set(2, 2, 1.6);
  }
  for (const side of [-1, 1]) {
    const armor = box(0.65, 0.45, 0.9, 0x322d36);
    armor.position.set(side * 0.75, 2.04, 0);
    root.add(armor);
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(0.17, 0.65, 5),
      mat(0xd9b278),
    );
    spike.position.set(side * 0.75, 2.55, 0);
    root.add(spike);
  }
  return root;
}

export function makeZombie(brute = false) {
  const root = new THREE.Group();
  const legs = new THREE.Group();
  const body = box(
    brute ? 1.15 : 0.88,
    brute ? 1.45 : 1.18,
    brute ? 0.72 : 0.54,
    brute ? 0x39483a : 0x485044,
  );
  body.position.y = brute ? 1.58 : 1.48;
  body.rotation.x = 0.12;
  root.add(body);
  const shirt = box(
    brute ? 1.27 : 0.98,
    0.55,
    brute ? 0.78 : 0.6,
    brute ? 0x50362e : 0x57433d,
  );
  shirt.position.set(0, brute ? 1.72 : 1.57, -0.03);
  shirt.rotation.z = 0.05;
  root.add(shirt);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(brute ? 0.43 : 0.35, 9, 7),
    mat(brute ? 0x78906f : 0x87927c),
  );
  head.position.set(0, brute ? 2.62 : 2.35, -0.12);
  head.castShadow = true;
  root.add(head);
  for (const x of [brute ? -0.32 : -0.24, brute ? 0.32 : 0.24]) {
    const leg = box(brute ? 0.3 : 0.23, brute ? 0.82 : 0.7, 0.29, 0x272823);
    leg.position.set(x, brute ? 0.62 : 0.56, 0);
    legs.add(leg);
  }
  root.add(legs);
  for (const x of [brute ? -0.72 : -0.55, brute ? 0.72 : 0.55]) {
    const arm = box(brute ? 0.3 : 0.22, brute ? 1.0 : 0.82, 0.24, 0x78866f);
    arm.position.set(x, brute ? 1.65 : 1.5, -0.46);
    arm.rotation.x = Math.PI / 2.5;
    root.add(arm);
  }
  if (brute) root.scale.setScalar(1.08);
  root.userData = { body, legs };
  return root;
}
