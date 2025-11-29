export class TerminalCommandQueue {
  private queue: Promise<unknown> = Promise.resolve();

  public enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.queue.then(operation, operation);

    this.queue = run.then(
      () => undefined,
      () => undefined
    );

    return run;
  }
}
