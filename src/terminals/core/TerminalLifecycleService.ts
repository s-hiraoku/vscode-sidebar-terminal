import { TerminalCommandQueue } from './TerminalCommandQueue';

export class TerminalLifecycleService {
  private readonly queue = new TerminalCommandQueue();
  private readonly terminalsBeingKilled = new Set<string>();

  public enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return this.queue.enqueue(operation);
  }

  public markBeingKilled(terminalId: string): void {
    this.terminalsBeingKilled.add(terminalId);
  }

  public unmarkBeingKilled(terminalId: string): void {
    this.terminalsBeingKilled.delete(terminalId);
  }

  public isBeingKilled(terminalId: string): boolean {
    return this.terminalsBeingKilled.has(terminalId);
  }

  public clear(): void {
    this.terminalsBeingKilled.clear();
  }
}
