import { EventEmitter } from 'stream';
import { ConcurentModificationException } from './errors';

type TaskStatus = 'pending' | 'working' | 'done';

type Result<T, E = Error> = { ok: true; res: T } | { ok: false; err: E };

type TaskWrapper<T> = {
  task: Task<T>;
  status: TaskStatus;
  result: Result<T>;
};

const taskFactory = <T>(
  task: Task<T>,
  status: TaskStatus = 'pending',
): TaskWrapper<T> => ({
  task,
  status,
  result: { ok: false, err: new Error('task not finished') },
});

type Task<T> = () => Promise<T>;

class AsyncQueue<T> extends EventEmitter implements AsyncIterable<Result<T>> {
  private waitingQueue: TaskWrapper<T>[];
  private workingTasks: TaskWrapper<T>[];

  private running: number;

  private isLocked = false;

  // TODO: add timeout
  constructor(private readonly concurency: number = 1) {
    super();
    this.waitingQueue = [];
    this.workingTasks = [];
    this.running = 0;
  }

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

  wait() {
    if (this.running === 0) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.on(AsyncQueue.TASK_DONE, () => {
        if (this.running === 0) {
          resolve();
        }
      });
    });
  }

  reset() {
    if (this.running > 0) {
      throw new Error('cannot reset while tasks are running');
    }

    // TODO: add abort controller to abort running tasks

    this.waitingQueue = [];
    this.workingTasks = [];
    this.running = 0;
  }

  [Symbol.asyncIterator](): AsyncIterator<Result<T>> {
    this.lockQueue();
    return new this.Iterator(this);
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
    if (this.running < this.concurency) {
      const taskWrapper = taskFactory(task, 'working');
      return void this.runTask(taskWrapper);
    }

    const taskWrapper = taskFactory(task);
    this.waitingQueue.push(taskWrapper);
  }

  private async runTask(taskWrapper: TaskWrapper<T>) {
    if (this.running >= this.concurency) {
      throw new Error('too many tasks running');
    }

    this.workingTasks.push(taskWrapper);

    this.running++;

    await taskWrapper
      .task()
      .then((result) => {
        this.running--;
        taskWrapper.status = 'done';
        return result;
      })
      .then((result) => this.emitTaskSuccess(taskWrapper, result))
      .catch((error) => this.emitTaskError(taskWrapper, error))
      .finally(() => this.emitTaskDone(taskWrapper));

    if (this.waitLength > 0) {
      const nextTask = this.waitingQueue.shift()!;
      this.runTask(nextTask);
    }
  }

  private emitTaskError(taskWrapper: TaskWrapper<T>, error: Error) {
    taskWrapper.result = { ok: false, err: error };

    this.emit(AsyncQueue.TASK_ERROR, error);
  }

  private emitTaskSuccess(taskWrapper: TaskWrapper<T>, result: T) {
    taskWrapper.result = { ok: true, res: result };

    this.emit(AsyncQueue.TASK_SUCCESS, result);
  }

  private emitTaskDone(taskWrapper: TaskWrapper<T>) {
    this.emit(AsyncQueue.TASK_DONE, taskWrapper.result);
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

  static from<T>(tasks: Task<T>[], concurency: number = 1) {
    const queue = new AsyncQueue<T>(concurency);
    tasks.forEach((task) => queue.enqueue(task));
    return queue;
  }

  static TASK_DONE = 'task-done';
  static TASK_ERROR = 'task-error';
  static TASK_SUCCESS = 'task-success';
  static TASK_TIMEOUT = 'task-timeout';

  private Iterator = class Iterator implements AsyncIterator<Result<T>> {
    private curIndex = 0;
    private queue: AsyncQueue<T>;

    constructor(queue: AsyncQueue<T>) {
      this.queue = queue;
    }

    next(): Promise<IteratorResult<Result<T>>> {
      if (this.isDone) {
        this.queue.unlockQueue();
        return Promise.resolve({
          done: true,
          value: undefined,
        });
      }

      return new Promise((resolve) => {
        this.queue.once(AsyncQueue.TASK_DONE, (result) => {
          resolve({
            done: false,
            value: result,
          });
          this.curIndex++;
        });
      });
    }

    private get isDone() {
      return this.curIndex >= this.queue.length;
    }
  };
}

export default AsyncQueue;
