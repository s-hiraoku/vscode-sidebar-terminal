/**
 * node-pty Mock for Vitest
 * Provides a complete mock of node-pty for testing terminal operations
 */

import { vi } from 'vitest';

export interface IPtyForkOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: { [key: string]: string | undefined };
  encoding?: string;
  handleFlowControl?: boolean;
  flowControlPause?: string;
  flowControlResume?: string;
}

export interface IPty {
  pid: number;
  cols: number;
  rows: number;
  process: string;
  handleFlowControl: boolean;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (exitCode: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  pause: () => void;
  resume: () => void;
  clear: () => void;
}

class MockPty implements IPty {
  pid = Math.floor(Math.random() * 10000) + 1000;
  cols = 80;
  rows = 24;
  process = 'mock-shell';
  handleFlowControl = false;

  private dataCallbacks: Array<(data: string) => void> = [];
  private exitCallbacks: Array<(exitCode: { exitCode: number; signal?: number }) => void> = [];
  private _killed = false;

  constructor(
    _file: string,
    _args: string[] | string,
    options?: IPtyForkOptions
  ) {
    if (options?.cols) this.cols = options.cols;
    if (options?.rows) this.rows = options.rows;
    if (options?.handleFlowControl !== undefined) this.handleFlowControl = options.handleFlowControl;
  }

  onData = vi.fn((callback: (data: string) => void) => {
    this.dataCallbacks.push(callback);
    return {
      dispose: () => {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) this.dataCallbacks.splice(index, 1);
      },
    };
  });

  onExit = vi.fn((callback: (exitCode: { exitCode: number; signal?: number }) => void) => {
    this.exitCallbacks.push(callback);
    return {
      dispose: () => {
        const index = this.exitCallbacks.indexOf(callback);
        if (index > -1) this.exitCallbacks.splice(index, 1);
      },
    };
  });

  write = vi.fn((_data: string) => {
    // Simulate echo back for testing
  });

  resize = vi.fn((cols: number, rows: number) => {
    this.cols = cols;
    this.rows = rows;
  });

  kill = vi.fn((_signal?: string) => {
    if (!this._killed) {
      this._killed = true;
      this.exitCallbacks.forEach(cb => cb({ exitCode: 0 }));
    }
  });

  pause = vi.fn();
  resume = vi.fn();
  clear = vi.fn();

  // Test helper methods
  _simulateData(data: string): void {
    this.dataCallbacks.forEach(cb => cb(data));
  }

  _simulateExit(exitCode: number, signal?: number): void {
    if (!this._killed) {
      this._killed = true;
      this.exitCallbacks.forEach(cb => cb({ exitCode, signal }));
    }
  }
}

export function spawn(
  file: string,
  args: string[] | string = [],
  options?: IPtyForkOptions
): IPty {
  return new MockPty(file, args, options);
}

export default {
  spawn,
};
