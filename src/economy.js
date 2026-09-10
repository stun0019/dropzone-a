import { runtime } from "./runtime.js";
import { BOSS_TYPES, LOOT_MEAN, RTP, LOOT_TABLE } from "./config.js";

export function lootMean(bot) {
  return (
    (bot.type === "boss"
      ? (BOSS_TYPES[bot.variant].min + BOSS_TYPES[bot.variant].max) / 2
      : LOOT_MEAN) * (bot.rewardScale || 1)
  );
}

export function captureProbability(bot, count = 1) {
  return RTP / (count * lootMean(bot));
}

export function rollMobLoot(bot) {
  if (bot.type !== "boss") {
    const loot = rollLoot();
    loot.odds *= bot.rewardScale || 1;
    if (bot.rewardScale > 1) loot.label = "懸賞 · " + loot.label;
    return loot;
  }
  const spec = BOSS_TYPES[bot.variant];
  return {
    type: "armor",
    label: spec.name + "戰利品",
    odds: Math.floor(runtime.rand(spec.min, spec.max + 1)),
  };
}

export function rollLoot() {
  let roll = Math.random();
  const t = LOOT_TABLE.find((t) => (roll -= t.weight) < 0) || LOOT_TABLE.at(-1);
  return {
    type: t.type,
    label: t.label,
    odds: Math.floor(runtime.rand(t.min, t.max + 1)),
  };
}
