import { EventEmitter } from 'stream';

type TaskStatus = 'pending' | 'working' | 'done' | 'error';

type TaskWrapper<T> = {
  task: Task<T>;
  status: TaskStatus;
  result: T | Error;
};

const taskFactory = <T>(
  task: Task<T>,
  status: TaskStatus = 'pending',
): TaskWrapper<T> => ({
  task,
  status,
  result: new Error('not finished yet'),
});

type Task<T> = () => Promise<T>;

class AsyncQueue<T> extends EventEmitter {
  private queue: TaskWrapper<T>[];
  private completed: TaskWrapper<T>[];

  private running: number;

  // TODO: add timeout
  constructor(private readonly concurency: number = 1) {
    super();
    this.queue = [];
    this.completed = [];
    this.running = 0;
  }

  enqueue(task: Task<T>) {
    if (this.running < this.concurency) {
      const taskWrapper = taskFactory(task, 'working');
      return void this.runTask(taskWrapper);
    }

    const taskWrapper = taskFactory(task);
    this.queue.push(taskWrapper);
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

  private async runTask(taskWrapper: TaskWrapper<T>) {
    if (this.running >= this.concurency) {
      throw new Error('too many tasks running');
    }

    this.running++;

    await taskWrapper
      .task()
      .then((result) => this.handleTaskDone(taskWrapper, result))
      .catch((error) => void this.handleTaskError(taskWrapper, error));

    if (this.length > 0) {
      const nextTask = this.queue.shift()!;
      this.runTask(nextTask);
    }
  }

  private handleTaskError(taskWrapper: TaskWrapper<T>, error: Error) {
    this.running--;
    this.emit(AsyncQueue.TASK_ERROR, error);
    taskWrapper.status = 'error';
    taskWrapper.result = error;
    this.completed.push(taskWrapper);
  }

  private handleTaskDone(taskWrapper: TaskWrapper<T>, result: T) {
    this.running--;
    this.emit(AsyncQueue.TASK_DONE, result);
    taskWrapper.status = 'done';
    taskWrapper.result = result;
    this.completed.push(taskWrapper);
  }

  get length() {
    return this.queue.length;
  }

  static from<T>(tasks: Task<T>[], concurency: number = 1) {
    const queue = new AsyncQueue<T>(concurency);
    tasks.forEach((task) => queue.enqueue(task));
    return queue;
  }

  static TASK_DONE = 'task-done';
  static TASK_ERROR = 'task-error';
  static TASK_TIMEOUT = 'task-timeout';
}

export default AsyncQueue;
