import { describe, it } from 'node:test';
import { setTimeout } from 'timers/promises';
import assert from 'node:assert';

import AsyncQueue from '@/asyncQueue';

describe('asyncQueue', () => {
  it('test concurency', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      await setTimeout(100);
      return i;
    });
    const queue = AsyncQueue.from(tasks, 3);

    const time = Date.now();
    await queue.wait();
    const duration = Date.now() - time;

    assert.strictEqual(duration >= 300, true);
  });
});
