import { Task, TaskStatus, TaskWrapper } from '@t/all';

export const taskFactory = <T>(
  task: Task<T>,
  status: TaskStatus = 'pending',
): TaskWrapper<T> => ({
  task,
  status,
  result: { ok: false, err: new Error('task not finished') },
  abortController: new AbortController(),
});

export const pipe = <T>(...fns: ((arg: T) => T)[]) => (arg: T) =>
  fns.reduce((acc, fn) => fn(acc), arg);

export const identity = <T>(arg: T) => arg;

export const Ok = <T>(res: T) => ({ ok: true, res } as const); // TODO: may be freeze it?

export const Err = <E>(err: E) => ({ ok: false, err } as const);
