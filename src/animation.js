import * as THREE from "three";

const aliases = {
  idle: ["idle", "stand", "breathing"],
  walk: ["walk", "walking"],
  run: ["run", "running", "jog"],
  shoot: ["shoot", "fire", "attack", "rifle"],
  hit: ["hit", "hurt", "damage"],
  death: ["death", "die", "dead"],
};

function normalized(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findClip(clips, names) {
  return clips.find((clip) => {
    const name = normalized(clip.name);
    return names.some((alias) => name.includes(alias));
  });
}

export function setupActorAnimation(actor, clips = []) {
  if (!clips.length || !actor) return actor;
  actor.userData.mixer = new THREE.AnimationMixer(actor);
  actor.userData.actions = {};
  for (const [key, names] of Object.entries(aliases)) {
    const clip = findClip(clips, names);
    if (clip) actor.userData.actions[key] = actor.userData.mixer.clipAction(clip);
  }
  actor.userData.currentAction = null;
  playAnimation(actor, "idle");
  return actor;
}

export function playAnimation(actor, name, fade = 0.16) {
  const action = actor?.userData?.actions?.[name];
  if (!action || actor.userData.currentAction === action) return;
  const previous = actor.userData.currentAction;
  action.reset().setLoop(name === "death" ? THREE.LoopOnce : THREE.LoopRepeat, name === "death" ? 1 : Infinity).fadeIn(fade).play();
  if (previous) previous.fadeOut(fade);
  actor.userData.currentAction = action;
}

export function updateAnimation(actor, dt) {
  actor?.userData?.mixer?.update(dt);
}
