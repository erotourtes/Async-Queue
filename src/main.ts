import { AsyncQueue } from '@/queue/module';
import { setTimeout } from 'timers/promises';

async function main() {
  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    await setTimeout(100 * i);
    return i;
  });
  const queue = AsyncQueue.from(tasks, 3, 500);

  for await (const result of queue) {
    console.log(result);
    if (result.ok) console.log(result.res);
  }
}

main();
