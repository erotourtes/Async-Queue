import AsyncQueue from '@/asyncQueue';
import {setTimeout } from 'timers/promises'

async function main() {
  const tasks = []

  for (let i = 0; i < 10; i++) {
    tasks.push(async () => {
      console.log(`task ${i} started`);
      await setTimeout(1000);
      return i;
    });
  }

  const queue = AsyncQueue.from(tasks, 3);

  queue.on(AsyncQueue.TASK_DONE, (result) => {
    console.log(`task ${result} done`);
  });

  await queue.wait();

  console.log('all tasks done');
}

main();
