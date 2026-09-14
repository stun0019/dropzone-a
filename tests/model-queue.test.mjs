import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withModelTimeout, runModelQueue } from '../src/modelQueue.js';

test('hung decoder settles and aborts its fetch', async () => {
  let signal;
  await assert.rejects(withModelTimeout(s => {
    signal = s;
    return new Promise(() => {});
  }, 15), /timed out/);
  assert.equal(signal.aborted, true);
});
test('queue bounds simultaneous work and processes all models', async () => {
  let active = 0, peak = 0;
  const completed = [];
  await runModelQueue([1, 2, 3, 4], 2, async key => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    completed.push(key); active--;
  });
  assert.equal(peak, 2);
  assert.deepEqual(completed.sort(), [1, 2, 3, 4]);
});
test('successful and failed tasks settle without waiting for timeout', async () => {
  assert.equal(await withModelTimeout(async () => 42), 42);
  await assert.rejects(withModelTimeout(async () => { throw new Error('404'); }), /404/);
});
