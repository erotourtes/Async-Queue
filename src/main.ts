import { AsyncQueue } from '@/queue/module';
import { setTimeout } from 'timers/promises';

async function main() {
  const tasks = Array.from(
    { length: 10 },
    (_, i) => async (signal: AbortSignal) => {
      await setTimeout(100);
      return i;
    },
  );
  const queue = AsyncQueue.from(tasks, 3, 500);

  queue.onTaskDone((result) => {
    console.log('done', result.ok);
  });

  queue.onTaskError((error) => {
    console.log('err', error.message);
  });

  queue.onTaskSuccess((result) => {
    console.log('suc', result);
  });

  queue.eventEmitter.on(AsyncQueue.TASK_TIMEOUT, (result) => {
    console.log('timeout', result);
  });

  setTimeout(150).then(() => {
    queue.abort();
  });

  console.log('wait');
  await queue.wait();
  console.log('done');

  // for await (const result of queue) {
  //   console.log(result);
  //   if (result.ok) console.log(result.res);
  // }
}

main();
