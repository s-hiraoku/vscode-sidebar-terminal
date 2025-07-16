/**
 * Mock implementation of node-pty for testing environments
 */

import type { IPty, IEvent, IDisposable } from '@homebridge/node-pty-prebuilt-multiarch';

export type { IPty };

class MockDisposable implements IDisposable {
  dispose(): void {
    // Mock implementation
  }
}

export class MockPty implements IPty {
  readonly pid = 1234;
  readonly cols = 80;
  readonly rows = 24;
  readonly process = 'bash';
  handleFlowControl = false;

  private dataCallback?: (data: string) => void;
  private exitCallback?: (event: { exitCode: number; signal?: number }) => void;

  readonly onData: IEvent<string> = (listener: (e: string) => void): IDisposable => {
    this.dataCallback = listener;
    return new MockDisposable();
  };

  readonly onExit: IEvent<{ exitCode: number; signal?: number }> = (
    listener: (e: { exitCode: number; signal?: number }) => void
  ): IDisposable => {
    this.exitCallback = listener;
    return new MockDisposable();
  };

  // Deprecated methods for backward compatibility
  on(event: 'data', listener: (data: string) => void): void;
  on(event: 'exit', listener: (exitCode: number, signal?: number) => void): void;
  on(
    event: string,
    listener: ((data: string) => void) | ((exitCode: number, signal?: number) => void)
  ): void {
    if (event === 'data') {
      this.dataCallback = listener as (data: string) => void;
    } else if (event === 'exit') {
      const exitListener = listener as (exitCode: number, signal?: number) => void;
      this.exitCallback = (e) => exitListener(e.exitCode, e.signal);
    }
  }

  write(data: string): void {
    // Echo back for testing
    if (this.dataCallback) {
      this.dataCallback(data);
    }
  }

  resize(cols: number, rows: number): void {
    // Override readonly properties for testing
    Object.defineProperty(this, 'cols', { value: cols });
    Object.defineProperty(this, 'rows', { value: rows });
  }

  kill(_signal?: string): void {
    if (this.exitCallback) {
      this.exitCallback({ exitCode: 0 });
    }
  }

  clear(): void {
    // Mock implementation
  }

  pause(): void {
    // Mock implementation
  }

  resume(): void {
    // Mock implementation
  }
}

export interface IWindowsPtyForkOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: { [key: string]: string };
  encoding?: string;
  useConpty?: boolean;
  conptyInheritCursor?: boolean;
}

export interface IUnixForkOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: { [key: string]: string };
  encoding?: string;
  uid?: number;
  gid?: number;
}

export function spawn(
  _file?: string,
  _args?: string[] | string,
  _options?: IWindowsPtyForkOptions | IUnixForkOptions
): IPty {
  return new MockPty();
}

// CommonJS compatibility
module.exports = {
  spawn,
  IPty: MockPty,
  IWindowsPtyForkOptions: {},
  IUnixForkOptions: {},
};
