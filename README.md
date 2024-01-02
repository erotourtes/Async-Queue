
# Async-Queue
An async queue for node.js. 

It allows you to run a limited number of tasks at the same time. 
Each task can be aborted. You can also specify a timeout for each task.

## Usage
### Creation
You can create a queue in two ways:
> Refer to [Tasks](#tasks) for more information about tasks

```typescript
const queue = new AsyncQueue<number>(3, 500);
queue.enque(...tasks);
```

```typescript
const queue = AsyncQueue.from(tasks, 3, 150);
```

---

### Events
#### Done
Notified when a task is successfully/unsucessfully finished
It recieves a `Result` object. Read more about it [here](#result)
```typescript
queue.onTaskDone((result) => {
  console.log(result);
});
```

#### Error
Notified when a task is unsucessfully finished
```typescript
queue.onTaskError((error) => {
  console.log(error);
});
```

#### Success
Notified when a task is sucessfully finished
```typescript
queue.onTaskSuccess((value) => {
  console.log(value);
});
```

#### Timeout
Notified when a task is timed out
```typescript
queue.onTaskTimeout(() => {
  console.log('timeout');
});
```

---

### Async iterator
The async iterator gets only the tasks finished after the iterator is created.
While the queue is iterating, it is locked and no new tasks can be enqueued.
```typescript
for await (const result of queue) {
  console.log(result);
}
```

---

### Async generator
The async generator acts like the async iterator
```typescript
const generator = queue.generator();
for await (const result of generator) {
  console.log(result);
}
```

---

### ReadStream
You can get a read stream from the queue. It does NOT lock the queue.
```typescript
const readStream = queue.createReadStream();
readStream.on('data', (chunk) => {
  console.log(chunk);
});
```

---

### Abort/Reset
You can abort the tasks in the queue. All the `pending` and `running` tasks will be aborted.
The `iterator` and `ReadStream` will be closed.
> Note: It is a developer's responsibility to close the resources.

Reset is a mild version of abort. It will only abort if there are no `pending` and `running` tasks.
```typescript
queue.abort();

// or safe abort
await queue.wait();
queue.reset();
```

---

### Result
The `result` is a special object. Inspired by [Result](https://doc.rust-lang.org/std/result/)
```typescript
export type Result<T, E = Error> = { ok: true; res: T } | { ok: false; err: E };
```

It allows safely get the result or the error of the task
```typescript
if (result.ok) {
  console.log(result.res);
} else {
  console.log(result.err);
}
```

---

### Tasks
Tasks are functions that return a promise.
```typescript
export type Task<T> = (signal: AbortSignal) => Promise<T>;
```
