/**
 * Mock implementation of node-pty for testing environments
 */

export interface IPty {
  pid: number;
  cols: number;
  rows: number;
  handleFlowControl: boolean;
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitCode: number, signal?: number) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  clear?: () => void;
}

export class MockPty implements IPty {
  pid = 1234;
  cols = 80;
  rows = 24;
  handleFlowControl = false;

  private dataCallback?: (data: string) => void;
  private exitCallback?: (exitCode: number, signal?: number) => void;

  onData(callback: (data: string) => void): void {
    this.dataCallback = callback;
  }

  onExit(callback: (exitCode: number, signal?: number) => void): void {
    this.exitCallback = callback;
  }

  write(data: string): void {
    // Echo back for testing
    if (this.dataCallback) {
      this.dataCallback(data);
    }
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  kill(_signal?: string): void {
    if (this.exitCallback) {
      this.exitCallback(0);
    }
  }

  clear(): void {
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

// Default exports for compatibility
export default {
  spawn,
};
