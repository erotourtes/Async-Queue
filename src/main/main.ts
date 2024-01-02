import { AsyncQueue } from '@/queue/module';
import { setTimeout } from 'timers/promises';
import { Task } from './types/all';

/** Standart creation  */
function _create1() {
  const tasks: Task<number>[] = Array.from({ length: 10 }, (_, i) => async () => {
    await setTimeout(100);
    return i;
  });

  const queue = new AsyncQueue<number>(3, 150);
  queue.enqueue(...tasks);
}

/** Creation from Array */
function _create2() {
  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    await setTimeout(100);
    return i;
  });

  const queue = AsyncQueue.from(tasks, 3, 150);

  return queue;
}

/** Events */
function _events() {
  const queue = _create2();

  queue.onTaskDone((result) => {
    console.log(result);
  });

  queue.onTaskError((error) => {
    console.log(error);
  });

  queue.onTaskSuccess((value) => {
    console.log(value);
  });

  queue.onTaskTimeout(() => {
    console.log('timeout');
  });
}

/** Async Iterator */
async function _iterator() {
  const queue = _create2();

  for await (const result of queue) {
    console.log(result);
  }
}

/** Async Generator */
async function _generator() {
  const queue = _create2();

  const generator = queue.generator();
  for await (const result of generator) {
    console.log(result);
  }
}

/** ReadStream */
function _stream() {
  const queue = _create2();

  const readStream = queue.createReadStream();
  readStream.on('data', (chunk) => {
    console.log(chunk);
  });
}

/** abort */
function _abort() {
  const queue = _create2();

  const readStream = queue.createReadStream();
  readStream.on('data', (chunk) => {
    console.log(chunk);
  });
  readStream.on('end', () => {
    console.log('end');
  });

  setTimeout(200).then(() => {
    console.log('abort');
    queue.abort();
  });
}

async function main() {
  // _create1();
  // _create2();
  // _events();
  // await _iterator();
  // await _generator();
  // _stream();
  // _abort();
}

main();
