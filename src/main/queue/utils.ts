import { Result, Task, TaskStatus, TaskWrapper } from '@t/all';

export const taskFactory = <T>(
  task: Task<T>,
  status: TaskStatus = 'pending',
): TaskWrapper<T> => ({
  task,
  status,
  result: { ok: false, err: new Error('task not finished') },
  abortController: new AbortController(),
});

export const pipe =
  <T>(...fns: ((arg: T) => T)[]) =>
  (arg: T) =>
    fns.reduce((acc, fn) => fn(acc), arg);

export const identity = <T>(arg: T) => arg;

export const Ok = <T>(res: T): Result<T, never> => ({ ok: true, res }) as const; // TODO: may be freeze it?

export const Err = <E>(err: E): Result<never, E> =>
  ({ ok: false, err }) as const;

export const unwrap = <T>(result: Result<T>) => {
  if (!result.ok) throw result.err;
  return result.res;
};
