import AsyncQueue from '@/asyncQueue';
import { setTimeout } from 'timers/promises';

async function main() {
  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    await setTimeout(100);
    return i;
  });
  const queue = AsyncQueue.from(tasks, 3);

  for await (const result of queue) {
    console.log(result);
    const { err, res } = result;
    if (err) {
      throw err;
    }
    console.log(res!);
  }
}

main();
