export type Result<T, E = Error> = { ok: true; res: T } | { ok: false; err: E };

export type Task<T> = (signal: AbortSignal) => Promise<T>;

export type TaskStatus = 'pending' | 'working' | 'done';

export type TaskWrapper<T> = {
  task: Task<T>;
  status: TaskStatus;
  result: Result<T>;
  abortController: AbortController;
};
