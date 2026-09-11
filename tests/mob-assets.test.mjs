import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODEL_CONFIG, MOB_KEYS } from '../src/config.js';
for (const key of [...MOB_KEYS, 'boss0','boss1','boss2']) {
  const spec = MODEL_CONFIG[key];
  const asset = JSON.parse(fs.readFileSync('public/' + spec.path.replace(/^\.\//,'')));
  assert(asset.meshes?.length, key + ' has a mesh');
  assert(asset.buffers.every(b => !b.uri || b.uri.startsWith('data:')), key + ' has embedded buffers');
  if (!spec.vehicle) assert(asset.animations?.length, key + ' has animations');
  for (const name of Object.values(spec.clips || {})) assert(asset.animations.some(c => c.name === name), key + ': ' + name);
}
