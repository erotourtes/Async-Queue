import { EventEmitter } from 'stream';
import {
  AbortException,
  ConcurentModificationException,
  TimeoutException,
} from './errors';
import { Result, Task, TaskWrapper } from '@t/all';
import { Err, Ok, identity, pipe, taskFactory } from './utils';
import stream from 'stream';

class AsyncQueue<T> implements AsyncIterable<Result<T>> {
  private waitingQueue: TaskWrapper<T>[] = [];
  private workingTasks: TaskWrapper<T>[] = [];

  private running: number = 0;

  private isLocked = false;

  private ee = new EventEmitter();

  constructor(
    private readonly concurency: number = 1,
    private readonly timeout: number = 0,
  ) {}

  /**
   * Add tasks to the queue
   * @param tasks tasks to add to the queue
   * @throws {ConcurentModificationException} if the queue is locked, cannot add tasks while iterating
   */
  enqueue(...tasks: Task<T>[]) {
    if (this.isLocked) {
      throw new ConcurentModificationException();
    }

    tasks.forEach((task) => this.enqueueTask(task));
  }

  onTaskDone(listener: (result: Result<T>) => void) {
    this.ee.on(AsyncQueue.TASK_DONE, listener);
  }

  onTaskError(listener: (error: Error) => void) {
    this.ee.on(AsyncQueue.TASK_ERROR, listener);
  }

  onTaskSuccess(listener: (result: T) => void) {
    this.ee.on(AsyncQueue.TASK_SUCCESS, listener);
  }

  onTaskTimeout(listener: () => void) {
    this.ee.on(AsyncQueue.TASK_TIMEOUT, listener);
  }

  wait(): Promise<void> {
    if (this.running === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      // double resolve doesn't matter
      this.eventEmitter.once(AsyncQueue.ABORT, () => {
        resolve();
      });
      this.onTaskDone(() => {
        if (this.running === 0) {
          resolve();
        }
      });
    });
  }

  /**
    Force reset
    */
  abort(removeListeners: boolean = true): this {
    this.workingTasks
      .filter((t) => t.status === 'working')
      .forEach((t) => t.abortController.abort());

    this.waitingQueue = [];
    this.workingTasks = [];

    // this.running will be 0 after all tasks are aborted

    this.eventEmitter.emit(AsyncQueue.ABORT);

    if (removeListeners) {
      this.eventEmitter.removeAllListeners();
    }

    return this;
  }

  /**
    * Resets the queue

    * @throws {Error} if the queue is running, cannot reset while tasks are running
    * @throws {ConcurentModificationException} cannot reset while iterating
    */
  reset(removeAllListeners: boolean = true): this {
    if (this.running > 0) {
      throw new Error('cannot reset while tasks are running');
    }
    if (this.isLocked) {
      throw new ConcurentModificationException();
    }

    return this.abort(removeAllListeners);
  }

  [Symbol.asyncIterator](): AsyncIterator<Result<T>> {
    return new this.Iterator(this);
  }

  createReadStream(): stream.Readable {
    return stream.Readable.from({
      [Symbol.asyncIterator]: () => new this.Iterator(this, false),
    });
  }

  /**
   * Lock the queue, no more tasks can be added to the queue,
   * but the tasks that are already in the queue will still be executed
   * Useful when the queue is iterated
   */
  private lockQueue() {
    this.isLocked = true;
  }

  private unlockQueue() {
    this.isLocked = false;
  }

  private enqueueTask(task: Task<T>) {
    const modifiedTask = pipe<Task<T>>(
      this.timeout > 0 ? this.timeoutTask.bind(this) : identity,
      this.abortableTask.bind(this), // WTF: somehow abortableTask should be called after timeoutTask
    )(task);

    const taskWrapper = taskFactory<T>(modifiedTask);

    if (this.running < this.concurency) {
      return void this.runTask(taskWrapper);
    }

    this.waitingQueue.push(taskWrapper);
  }

  private abortableTask(task: Task<T>): Task<T> {
    return (signal: AbortSignal) =>
      new Promise<T>((resolve, reject) => {
        const listener = () => {
          reject(new AbortException());
          signal.removeEventListener('abort', listener);
        };
        signal.addEventListener('abort', listener);
        task(signal).then(resolve).catch(reject);
      });
  }

  private timeoutTask(task: Task<T>): Task<T> {
    return (signal: AbortSignal) =>
      new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new TimeoutException());
          this.ee.emit(AsyncQueue.TASK_TIMEOUT);
        }, this.timeout);

        task(signal)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            clearTimeout(timeoutId); // TODO: check if it's done immediately after .then or .catch
          });
      });
  }

  private async runTask(taskWrapper: TaskWrapper<T>) {
    if (this.running >= this.concurency) {
      throw new Error('too many tasks running');
    }

    this.workingTasks.push(taskWrapper);
    this.running++;

    taskWrapper.status = 'working';

    try {
      const result = await taskWrapper.task(taskWrapper.abortController.signal);
      this.handleTaskDone(taskWrapper);
      taskWrapper.result = Ok(result);
      this.ee.emit(AsyncQueue.TASK_SUCCESS, result);
    } catch (error) {
      this.handleTaskDone(taskWrapper);
      taskWrapper.result = Err(error as Error);
      this.ee.emit(AsyncQueue.TASK_ERROR, error);
    } finally {
      this.ee.emit(AsyncQueue.TASK_DONE, taskWrapper.result);
    }

    if (this.waitLength > 0) {
      const nextTask = this.waitingQueue.shift()!;
      this.runTask(nextTask);
    }
  }

  private handleTaskDone(taskWrapper: TaskWrapper<T>) {
    if (this.running <= 0) throw new Error('running cannot be negative');
    if (taskWrapper.status == 'done') return;

    this.running--;
    taskWrapper.status = 'done';
  }

  /**
   * @returns the number of waiting tasks
   */
  get waitLength() {
    return this.waitingQueue.length;
  }

  /**
   * @returns the number of tasks that are running or finished
   */
  get workingLength() {
    return this.workingTasks.length;
  }

  /**
   * @returns the number of tasks in the queue (waiting + working + done)
   */
  get length() {
    return this.waitLength + this.workingLength;
  }

  get eventEmitter() {
    return this.ee;
  }

  static from<T>(
    tasks: Task<T>[],
    concurency: number = 1,
    timeout: number = 0,
  ) {
    const queue = new AsyncQueue<T>(concurency, timeout);
    tasks.forEach((task) => queue.enqueue(task));
    return queue;
  }

  static TASK_DONE = 'task-done';
  static TASK_ERROR = 'task-error';
  static TASK_SUCCESS = 'task-success';
  static TASK_TIMEOUT = 'task-timeout';
  private static ABORT = 'abort';

  private Iterator = class Iterator implements AsyncIterator<Result<T>> {
    private curIndex = 0;
    private queue: AsyncQueue<T>;
    private isDone = false;

    constructor(
      queue: AsyncQueue<T>,
      private readonly shouldLock: boolean = true,
    ) {
      this.queue = queue;
      this.lockQueue();

      if (queue.running === 0) {
        this.isDone = true;
      }
    }

    next(): Promise<IteratorResult<Result<T>>> {
      if (this.isDone) {
        this.unlockQueue();
        return Promise.resolve({
          done: true,
          value: undefined,
        });
      }

      return new Promise((resolve) => {
        const listener = () => this.abortListener(resolve);
        this.queue.ee.once(AsyncQueue.ABORT, listener);

        this.queue.ee.once(AsyncQueue.TASK_DONE, (result) => {
          if (this.queue.running === 0) {
            this.isDone = true;
          }

          resolve({
            done: false,
            value: result,
          });
          this.curIndex++;

          this.queue.ee.removeListener(AsyncQueue.ABORT, listener);
        });
      });
    }

    private abortListener(resolve: (value: IteratorResult<Result<T>>) => void) {
      this.unlockQueue();
      this.isDone = true;
      resolve({
        done: true,
        value: undefined,
      });
    }

    private lockQueue() {
      if (this.shouldLock) this.queue.lockQueue();
    }

    private unlockQueue() {
      if (this.shouldLock) this.queue.unlockQueue();
    }
  };
}

export default AsyncQueue;
