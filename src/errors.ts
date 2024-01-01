
export class ConcurentModificationException extends Error {
  constructor() {
    super('Concurent modification: cannot enqueue while iterating');
  }
}
