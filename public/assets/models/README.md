# Optional GLB model assets

Place optional runtime models in the folders below. The game keeps its
procedural model when a file is missing or cannot be loaded.

```text
player/player.glb
enemies/zombie.glb
enemies/soldier.glb
enemies/brute.glb
enemies/spitter.glb
enemies/shield.glb
enemies/sniper.glb
enemies/scavenger.glb
enemies/villager.glb
bosses/armor-tyrant.glb
bosses/toxic-beast.glb
bosses/heavy-warlord.glb
vehicles/jeep.glb
vehicles/tank.glb
weapons/rifle.glb
weapons/laser.glb
weapons/shotgun.glb
weapons/rocket.glb
weapons/grenade.glb
```

Recommended animation clips are `Idle`, `Walk`, `Run`, `Shoot`, `Hit`, and
`Death`. Names are matched case-insensitively and common Mixamo prefixes are
ignored. Weapon mount nodes can be named `GunMount`, `WeaponMount`,
`RightHand`, or `Hand_R`. If no mount exists, the configured local fallback
mount is used.
