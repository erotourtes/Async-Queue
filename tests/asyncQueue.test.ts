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

    const MIN_DURATION = 300; // 300ms is the minimum time for 10 tasks with concurency of 3 to finish
    assert.strictEqual(duration >= MIN_DURATION, true);
  });

  it('test iterator', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      await setTimeout(100);
      return i;
    });
    const queue = AsyncQueue.from(tasks, 3);

    const time = Date.now();
    for await (const result of queue) {
      if (result.ok) assert.strictEqual(result.res < 10, true);
    }
    const duration = Date.now() - time;

    assert.strictEqual(duration >= 300, true);
  });

  it('should throw error'),
    async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => async () => {
        await setTimeout(100);
        return i;
      });
      const queue = AsyncQueue.from(tasks, 3);

      setTimeout(100).then(() => {
        assert.throws(() => {
          queue.enqueue(async () => {
            await setTimeout(100);
            return 10;
          });
        });
      });
      for await (const result of queue) {
        if (result instanceof Error) {
          throw result;
        }
      }
    };
});
