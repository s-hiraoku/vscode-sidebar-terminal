/**
 * InputFlushingService - Manages input buffering and flushing for terminal input
 * Extracted from InputManager to centralize input queuing, batching, and flushing logic.
 */

/**
 * Dependencies injected into InputFlushingService
 */
export interface IInputFlushingDependencies {
  /** Logger function */
  logger: (message: string) => void;
  /** Send flushed input to the extension/message manager */
  sendInput: (data: string, terminalId: string) => void;
}

/**
 * Pending input buffer entry for a terminal
 */
interface PendingInputEntry {
  data: string[];
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * InputFlushingService handles queuing input data per terminal,
 * batching characters, and flushing them either immediately or
 * after a microtask delay (setTimeout 0).
 */
export class InputFlushingService {
  private readonly deps: IInputFlushingDependencies;
  private readonly pendingInputBuffers = new Map<string, PendingInputEntry>();

  constructor(deps: IInputFlushingDependencies) {
    this.deps = deps;
  }

  /**
   * Queue input data for a terminal. If flushImmediately is true, the buffer
   * is flushed synchronously. Otherwise a microtask flush is scheduled.
   */
  public queueInputData(terminalId: string, data: string, flushImmediately: boolean): void {
    if (!terminalId || data.length === 0) {
      return;
    }

    let entry = this.pendingInputBuffers.get(terminalId);
    if (!entry) {
      entry = { data: [], timer: null };
      this.pendingInputBuffers.set(terminalId, entry);
    }

    entry.data.push(data);

    if (flushImmediately) {
      this.flushPendingInput(terminalId);
      return;
    }

    if (entry.timer !== null) {
      return;
    }

    entry.timer = setTimeout(() => {
      entry!.timer = null;
      this.flushPendingInput(terminalId);
    }, 0);
  }

  /**
   * Flush all pending input for a terminal, joining buffered data and sending it.
   */
  public flushPendingInput(terminalId: string): void {
    const entry = this.pendingInputBuffers.get(terminalId);
    if (!entry || entry.data.length === 0) {
      return;
    }

    if (entry.timer !== null) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }

    const payload = entry.data.join('');
    entry.data.length = 0;

    this.deps.sendInput(payload, terminalId);
  }

  /**
   * Determine if a key event should trigger immediate flushing.
   * Returns true for Enter, Backspace, Delete, and data containing newlines.
   */
  public shouldFlushImmediately(data: string, domEvent: KeyboardEvent): boolean {
    if (!data) {
      return true;
    }

    const immediateKeys = new Set(['Enter', 'Backspace', 'Delete']);
    if (immediateKeys.has(domEvent.key)) {
      return true;
    }

    return /[\r\n]/.test(data);
  }

  /**
   * Clear pending input buffers and timers for a specific terminal.
   * Called when a terminal is removed to prevent stale flushes.
   */
  public clearTerminalBuffer(terminalId: string): void {
    const pendingBuffer = this.pendingInputBuffers.get(terminalId);
    if (pendingBuffer) {
      if (pendingBuffer.timer !== null) {
        clearTimeout(pendingBuffer.timer);
      }
      pendingBuffer.data = [];
      this.pendingInputBuffers.delete(terminalId);
    }
  }

  /**
   * Dispose all pending input buffers and timers.
   */
  public dispose(): void {
    for (const entry of this.pendingInputBuffers.values()) {
      if (entry.timer !== null) {
        clearTimeout(entry.timer);
      }
      entry.data.length = 0;
    }
    this.pendingInputBuffers.clear();
  }
}
