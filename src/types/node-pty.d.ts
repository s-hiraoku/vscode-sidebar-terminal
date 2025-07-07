/**
 * Type definitions for node-pty
 * Provides minimal type definitions for node-pty compatibility
 */

declare module 'node-pty' {
  export interface IPty {
    pid: number;
    cols: number;
    rows: number;
    handleFlowControl?: boolean;
    onData: (callback: (data: string) => void) => void;
    onExit: (callback: (event: number | { exitCode: number; signal?: number }) => void) => void;
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: (signal?: string) => void;
    clear?: () => void;
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
    file?: string,
    args?: string[] | string,
    options?: IWindowsPtyForkOptions | IUnixForkOptions
  ): IPty;
}