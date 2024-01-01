import { AsyncQueue } from '@/queue/module';
import { setTimeout } from 'timers/promises';

async function main() {
  const tasks = Array.from(
    { length: 6 },
    (_, i) => async (signal: AbortSignal) => {
      await setTimeout(100);
      return i;
    },
  );
  const queue = AsyncQueue.from(tasks, 3, 500);

  setTimeout(150).then(() => {
    queue.abort();
  });

  console.log('wait');
  // await queue.wait();
  console.log('------------------done------------------');

  for await (const result of queue) {
    console.log('result', result);
  }

  for await (const result of queue) {
    console.log('result', result);
  }

  console.log('------------------done------------------');
}

main();
