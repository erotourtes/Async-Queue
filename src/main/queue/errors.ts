export class ConcurentModificationException extends Error {
  constructor() {
    super('Concurent modification: cannot enqueue while iterating');
  }
}

export class TimeoutException extends Error {
  constructor() {
    super('Task timeout');
  }
}

export class AbortException extends Error {
  constructor() {
    super('Task aborted');
  }
}
