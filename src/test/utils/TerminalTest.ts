import { BaseTest } from './BaseTest';
import * as sinon from 'sinon';

/**
 * Specialized base class for Terminal-related tests
 *
 * Features:
 * - Mock terminal creation
 * - Terminal data simulation
 * - Process lifecycle helpers
 * - Terminal state management
 *
 * Usage:
 * ```typescript
 * class MyTerminalTest extends TerminalTest {
 *   protected override setup(): void {
 *     super.setup();
 *     // Custom terminal setup
 *   }
 * }
 * ```
 */
export abstract class TerminalTest extends BaseTest {
  protected mockTerminals: Map<number, MockTerminal> = new Map();
  protected nextTerminalId: number = 1;

  protected override setup(): void {
    super.setup();
  }

  protected override teardown(): void {
    this.mockTerminals.clear();
    this.nextTerminalId = 1;
    super.teardown();
  }

  /**
   * Create a mock terminal
   */
  protected createMockTerminal(options?: Partial<MockTerminalOptions>): MockTerminal {
    const id = options?.id ?? this.nextTerminalId++;
    const name = options?.name ?? `Terminal ${id}`;

    const terminal: MockTerminal = {
      id,
      name,
      number: id,
      cwd: options?.cwd ?? '/home/user',
      isActive: options?.isActive ?? false,
      processState: options?.processState ?? 'running',
      data: [],
      pty: this.createMockPty(),
      write: this.sandbox.stub(),
      clear: this.sandbox.stub(),
      dispose: this.sandbox.stub(),
      focus: this.sandbox.stub(),
      onData: this.sandbox.stub(),
      onExit: this.sandbox.stub(),
    };

    this.mockTerminals.set(id, terminal);
    return terminal;
  }

  /**
   * Create mock PTY (pseudo-terminal)
   */
  protected createMockPty(): MockPty {
    return {
      onData: this.sandbox.stub(),
      onExit: this.sandbox.stub(),
      write: this.sandbox.stub(),
      resize: this.sandbox.stub(),
      kill: this.sandbox.stub(),
      pid: 12345,
    };
  }

  /**
   * Simulate terminal data output
   */
  protected simulateTerminalData(terminalId: number, data: string): void {
    const terminal = this.mockTerminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    terminal.data.push(data);

    // Call onData handler if registered
    const onDataHandler = terminal.onData.getCall(0)?.args[0];
    if (onDataHandler) {
      onDataHandler(data);
    }
  }

  /**
   * Simulate terminal exit
   */
  protected simulateTerminalExit(
    terminalId: number,
    exitCode: number = 0
  ): void {
    const terminal = this.mockTerminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    terminal.processState = 'exited';

    // Call onExit handler if registered
    const onExitHandler = terminal.onExit.getCall(0)?.args[0];
    if (onExitHandler) {
      onExitHandler(exitCode);
    }
  }

  /**
   * Get all terminal data as string
   */
  protected getTerminalOutput(terminalId: number): string {
    const terminal = this.mockTerminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    return terminal.data.join('');
  }

  /**
   * Clear terminal data
   */
  protected clearTerminalData(terminalId: number): void {
    const terminal = this.mockTerminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    terminal.data = [];
  }

  /**
   * Assert terminal received data
   */
  protected assertTerminalReceivedData(
    terminalId: number,
    expectedData: string | RegExp
  ): void {
    const output = this.getTerminalOutput(terminalId);

    if (typeof expectedData === 'string') {
      if (!output.includes(expectedData)) {
        throw new Error(
          `Expected terminal ${terminalId} to receive "${expectedData}", ` +
          `but got: "${output}"`
        );
      }
    } else {
      if (!expectedData.test(output)) {
        throw new Error(
          `Expected terminal ${terminalId} output to match ${expectedData}, ` +
          `but got: "${output}"`
        );
      }
    }
  }

  /**
   * Create terminal session data
   */
  protected createSessionData(terminalId: number): TerminalSessionData {
    const terminal = this.mockTerminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    return {
      id: terminal.id,
      name: terminal.name,
      number: terminal.number,
      cwd: terminal.cwd,
      scrollback: terminal.data,
      isActive: terminal.isActive,
      lastActivity: Date.now(),
    };
  }

  /**
   * Wait for terminal to be ready
   */
  protected async waitForTerminalReady(
    terminalId: number,
    timeout: number = 1000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const terminal = this.mockTerminals.get(terminalId);
      if (terminal && terminal.processState === 'running') {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    throw new Error(`Timeout waiting for terminal ${terminalId} to be ready`);
  }
}

/**
 * Mock Terminal interface
 */
export interface MockTerminal {
  id: number;
  name: string;
  number: number;
  cwd: string;
  isActive: boolean;
  processState: 'running' | 'exited' | 'killed';
  data: string[];
  pty: MockPty;
  write: sinon.SinonStub;
  clear: sinon.SinonStub;
  dispose: sinon.SinonStub;
  focus: sinon.SinonStub;
  onData: sinon.SinonStub;
  onExit: sinon.SinonStub;
}

/**
 * Mock PTY interface
 */
export interface MockPty {
  onData: sinon.SinonStub;
  onExit: sinon.SinonStub;
  write: sinon.SinonStub;
  resize: sinon.SinonStub;
  kill: sinon.SinonStub;
  pid: number;
}

/**
 * Mock terminal options
 */
export interface MockTerminalOptions {
  id: number;
  name: string;
  cwd: string;
  isActive: boolean;
  processState: 'running' | 'exited' | 'killed';
}

/**
 * Terminal session data
 */
export interface TerminalSessionData {
  id: number;
  name: string;
  number: number;
  cwd: string;
  scrollback: string[];
  isActive: boolean;
  lastActivity: number;
}
