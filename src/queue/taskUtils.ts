import { Task, TaskStatus, TaskWrapper } from '@t/all';

export const taskFactory = <T>(
  task: Task<T>,
  status: TaskStatus = 'pending',
): TaskWrapper<T> => ({
  task,
  status,
  result: { ok: false, err: new Error('task not finished') },
});
