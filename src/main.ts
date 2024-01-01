import AsyncQueue from '@/asyncQueue';
import { setTimeout } from 'timers/promises';

async function main() {
  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    console.log('task', i);
    await setTimeout(100);
    return i;
  });
  const queue = AsyncQueue.from(tasks, 3);


      setTimeout(100).then(() => {
          queue.enqueue(async () => {
            await setTimeout(100);
            return 10;
          });
      });
  for await (const result of queue) {
    console.log('result', result);
    if (result instanceof Error) {
      throw result;
    }
  }
}

main();
