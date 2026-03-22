import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalIOCoordinator } from '../../../../terminals/TerminalIOCoordinator';
import { ActiveTerminalManager } from '../../../../utils/common';
import { TerminalInstance } from '../../../../types/shared';
import { ICliAgentDetectionService } from '../../../../interfaces/CliAgentService';
import { CliAgentDetectionService } from '../../../../services/CliAgentDetectionService';

// Helper to create a mock terminal instance
function createMockTerminal(
  overrides: Partial<TerminalInstance> & { id: string; name: string }
): TerminalInstance {
  return {
    isActive: true,
    ...overrides,
  };
}

// Helper to create a mock CLI agent service
function createMockCliAgentService(): ICliAgentDetectionService {
  return {
    handleInputChunk: vi.fn(),
    handleOutputChunk: vi.fn(),
    getAgentState: vi.fn().mockReturnValue({ status: 'none', agentType: null }),
    dispose: vi.fn(),
    onDidChangeAgentState: vi.fn(),
  } as unknown as ICliAgentDetectionService;
}

// Helper to create coordinator with common setup
function createCoordinator(
  terminals: Map<string, TerminalInstance>,
  activeTerminalManager?: ActiveTerminalManager,
  cliAgentService?: ICliAgentDetectionService
) {
  const atm = activeTerminalManager ?? new ActiveTerminalManager();
  const cas = cliAgentService ?? createMockCliAgentService();
  return { coordinator: new TerminalIOCoordinator(terminals, atm, cas), atm, cas };
}

describe('TerminalIOCoordinator - PTY recovery', () => {
  it('retries using terminal.pty when primary is undefined and first write fails', () => {
    const ptyWrite = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('first write failed');
      })
      .mockImplementationOnce(() => undefined);

    const terminal = createMockTerminal({
      id: 'term-1',
      name: 'Test Terminal',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });

    const terminals = new Map<string, TerminalInstance>([['term-1', terminal]]);
    const activeTerminalManager = new ActiveTerminalManager();
    activeTerminalManager.setActive('term-1');

    const mockCliAgentService = createMockCliAgentService();

    const coordinator = new TerminalIOCoordinator(
      terminals,
      activeTerminalManager,
      mockCliAgentService
    );

    coordinator.sendInput('ls', 'term-1');

    expect(ptyWrite).toHaveBeenCalledTimes(2);
  });

  it('clears ptyProcess when recovery succeeds via terminal.pty', () => {
    const ptyProcessWrite = vi.fn(() => {
      throw new Error('ptyProcess write failed');
    });
    const ptyWrite = vi.fn();

    const terminal = createMockTerminal({
      id: 'term-1',
      name: 'Test Terminal',
      ptyProcess: { write: ptyProcessWrite } as unknown as TerminalInstance['ptyProcess'],
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });

    const terminals = new Map<string, TerminalInstance>([['term-1', terminal]]);
    const activeTerminalManager = new ActiveTerminalManager();
    activeTerminalManager.setActive('term-1');

    const mockCliAgentService = createMockCliAgentService();

    const coordinator = new TerminalIOCoordinator(
      terminals,
      activeTerminalManager,
      mockCliAgentService
    );

    coordinator.sendInput('pwd', 'term-1');

    expect(ptyWrite).toHaveBeenCalledTimes(1);
    expect(terminal.ptyProcess).toBeUndefined();
  });
});

describe('TerminalIOCoordinator - CLI agent input pipeline', () => {
  it('does not connect on keystrokes alone but connects when Enter submits the command', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 'term-1',
      name: 'Gemini Terminal',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });

    const terminals = new Map<string, TerminalInstance>([['term-1', terminal]]);
    const activeTerminalManager = new ActiveTerminalManager();
    activeTerminalManager.setActive('term-1');
    const cliAgentService = new CliAgentDetectionService();

    const coordinator = new TerminalIOCoordinator(
      terminals,
      activeTerminalManager,
      cliAgentService
    );

    for (const chunk of ['g', 'e', 'm', 'i', 'n', 'i']) {
      coordinator.sendInput(chunk, 'term-1');
      expect(cliAgentService.getAgentState('term-1')).toEqual({
        status: 'none',
        agentType: null,
      });
    }

    coordinator.sendInput('\r', 'term-1');

    expect(cliAgentService.getAgentState('term-1')).toEqual({
      status: 'connected',
      agentType: 'gemini',
    });

    cliAgentService.dispose();
  });
});

describe('TerminalIOCoordinator - sendInput', () => {
  it('forwards data to PTY via writeToPtyWithValidation', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    coordinator.sendInput('hello', 't1');

    expect(ptyWrite).toHaveBeenCalledWith('hello');
  });

  it('calls handleInputChunk on cliAgentService', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const cas = createMockCliAgentService();
    const { coordinator } = createCoordinator(terminals, undefined, cas);

    coordinator.sendInput('test-data', 't1');

    expect(cas.handleInputChunk).toHaveBeenCalledWith('t1', 'test-data');
  });

  it('attempts PTY recovery when primary write fails and recovery succeeds', () => {
    const failingWrite = vi.fn(() => {
      throw new Error('write error');
    });
    const recoveryWrite = vi.fn();

    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: { write: failingWrite } as unknown as TerminalInstance['ptyProcess'],
      pty: { write: recoveryWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    // Should not throw - recovery via pty succeeds
    coordinator.sendInput('data', 't1');

    expect(failingWrite).toHaveBeenCalledWith('data');
    expect(recoveryWrite).toHaveBeenCalledWith('data');
  });

  it('resolves terminal ID with explicit ID first', () => {
    const ptyWrite1 = vi.fn();
    const ptyWrite2 = vi.fn();
    const t1 = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite1 } as unknown as TerminalInstance['pty'],
    });
    const t2 = createMockTerminal({
      id: 't2',
      name: 'T2',
      pty: { write: ptyWrite2 } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([
      ['t1', t1],
      ['t2', t2],
    ]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t2'); // active is t2
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.sendInput('data', 't1'); // explicit t1

    expect(ptyWrite1).toHaveBeenCalledWith('data');
    expect(ptyWrite2).not.toHaveBeenCalled();
  });

  it('falls back to active terminal when no explicit ID given', () => {
    const ptyWrite = vi.fn();
    const t1 = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', t1]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.sendInput('data'); // no explicit ID

    expect(ptyWrite).toHaveBeenCalledWith('data');
  });

  it('falls back to first available terminal when no active terminal', () => {
    const ptyWrite = vi.fn();
    const t1 = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', t1]]);
    // No active terminal set
    const { coordinator, cas } = createCoordinator(terminals);

    coordinator.sendInput('data');

    expect(cas.handleInputChunk).toHaveBeenCalled();
    expect(ptyWrite).toHaveBeenCalledWith('data');
  });

  it('does nothing when no terminal is found', () => {
    const terminals = new Map<string, TerminalInstance>();
    const { coordinator, cas } = createCoordinator(terminals);

    coordinator.sendInput('data');

    expect(cas.handleInputChunk).not.toHaveBeenCalled();
  });

  it('does nothing when explicit terminal ID does not exist and no fallback', () => {
    const terminals = new Map<string, TerminalInstance>();
    const { coordinator, cas } = createCoordinator(terminals);

    coordinator.sendInput('data', 'nonexistent');

    expect(cas.handleInputChunk).not.toHaveBeenCalled();
  });
});

describe('TerminalIOCoordinator - resize', () => {
  it('validates dimensions and calls PTY resize', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { resize: ptyResize } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.resize(80, 24, 't1');

    expect(ptyResize).toHaveBeenCalledWith(80, 24);
  });

  it('handles missing terminal gracefully without throwing', () => {
    const terminals = new Map<string, TerminalInstance>();
    const atm = new ActiveTerminalManager();
    atm.setActive('nonexistent');
    const { coordinator } = createCoordinator(terminals, atm);

    // Should not throw
    expect(() => coordinator.resize(80, 24, 'nonexistent')).not.toThrow();
  });

  it('handles no terminal ID and no active terminal gracefully', () => {
    const terminals = new Map<string, TerminalInstance>();
    const { coordinator } = createCoordinator(terminals);

    expect(() => coordinator.resize(80, 24)).not.toThrow();
  });

  it('rejects negative dimensions', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { resize: ptyResize } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.resize(-1, 24, 't1');

    expect(ptyResize).not.toHaveBeenCalled();
  });

  it('rejects zero dimensions', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { resize: ptyResize } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.resize(0, 24, 't1');

    expect(ptyResize).not.toHaveBeenCalled();
  });

  it('rejects dimensions that are too large (cols > 500 or rows > 200)', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { resize: ptyResize } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.resize(501, 24, 't1');
    expect(ptyResize).not.toHaveBeenCalled();

    coordinator.resize(80, 201, 't1');
    expect(ptyResize).not.toHaveBeenCalled();
  });

  it('uses active terminal when no explicit ID is given', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { resize: ptyResize } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.resize(80, 24); // no explicit ID

    expect(ptyResize).toHaveBeenCalledWith(80, 24);
  });

  it('does not throw when PTY lacks resize method', () => {
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: vi.fn() } as unknown as TerminalInstance['pty'], // no resize method
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    expect(() => coordinator.resize(80, 24, 't1')).not.toThrow();
  });

  it('does not resize when ptyProcess is killed', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: { resize: ptyResize, killed: true } as unknown as TerminalInstance['ptyProcess'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    coordinator.resize(80, 24, 't1');

    expect(ptyResize).not.toHaveBeenCalled();
  });
});

describe('TerminalIOCoordinator - writeToTerminal', () => {
  it('returns true on successful write', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    const result = coordinator.writeToTerminal('t1', 'hello');

    expect(result).toBe(true);
    expect(ptyWrite).toHaveBeenCalledWith('hello');
  });

  it('returns false when terminal is not found', () => {
    const terminals = new Map<string, TerminalInstance>();
    const { coordinator } = createCoordinator(terminals);

    const result = coordinator.writeToTerminal('nonexistent', 'hello');

    expect(result).toBe(false);
  });

  it('returns false when PTY has no write method', () => {
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: {} as unknown as TerminalInstance['pty'], // no write method
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    const result = coordinator.writeToTerminal('t1', 'hello');

    expect(result).toBe(false);
  });

  it('returns false when no PTY instance exists', () => {
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      // no pty or ptyProcess
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    const result = coordinator.writeToTerminal('t1', 'hello');

    expect(result).toBe(false);
  });

  it('returns false when write throws an exception', () => {
    const ptyWrite = vi.fn(() => {
      throw new Error('write error');
    });
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    const result = coordinator.writeToTerminal('t1', 'hello');

    expect(result).toBe(false);
  });

  it('prefers ptyProcess over pty when both exist', () => {
    const ptyProcessWrite = vi.fn();
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: { write: ptyProcessWrite } as unknown as TerminalInstance['ptyProcess'],
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    coordinator.writeToTerminal('t1', 'hello');

    expect(ptyProcessWrite).toHaveBeenCalledWith('hello');
    expect(ptyWrite).not.toHaveBeenCalled();
  });
});

describe('TerminalIOCoordinator - getTerminalInfo', () => {
  it('returns correct info including indicatorColor', () => {
    const terminal = createMockTerminal({
      id: 't1',
      name: 'My Terminal',
      isActive: true,
      indicatorColor: '#ff0000',
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    const info = coordinator.getTerminalInfo('t1');

    expect(info).toEqual({
      id: 't1',
      name: 'My Terminal',
      isActive: true,
      indicatorColor: '#ff0000',
    });
  });

  it('returns info without indicatorColor when not set', () => {
    const terminal = createMockTerminal({
      id: 't1',
      name: 'My Terminal',
      isActive: false,
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    const info = coordinator.getTerminalInfo('t1');

    expect(info).toEqual({
      id: 't1',
      name: 'My Terminal',
      isActive: false,
    });
    expect(info).not.toHaveProperty('indicatorColor');
  });

  it('returns undefined for unknown terminal', () => {
    const terminals = new Map<string, TerminalInstance>();
    const { coordinator } = createCoordinator(terminals);

    const info = coordinator.getTerminalInfo('nonexistent');

    expect(info).toBeUndefined();
  });
});

describe('TerminalIOCoordinator - resolveTerminalId (via sendInput)', () => {
  it('uses explicit ID when it exists in the map', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 'explicit',
      name: 'T1',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['explicit', terminal]]);
    const { coordinator, cas } = createCoordinator(terminals);

    coordinator.sendInput('x', 'explicit');

    expect(cas.handleInputChunk).toHaveBeenCalledWith('explicit', 'x');
  });

  it('falls back to active when explicit ID not in map', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 'active-t',
      name: 'Active',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['active-t', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('active-t');
    const { coordinator, cas } = createCoordinator(terminals, atm);

    coordinator.sendInput('x', 'nonexistent');

    expect(cas.handleInputChunk).toHaveBeenCalledWith('active-t', 'x');
  });

  it('falls back to first available when both explicit and active are invalid', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 'first',
      name: 'First',
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['first', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('invalid-active');
    const { coordinator, cas } = createCoordinator(terminals, atm);

    coordinator.sendInput('x', 'invalid-explicit');

    expect(cas.handleInputChunk).toHaveBeenCalledWith('first', 'x');
  });

  it('returns undefined when map is empty (no input sent)', () => {
    const terminals = new Map<string, TerminalInstance>();
    const { coordinator, cas } = createCoordinator(terminals);

    coordinator.sendInput('x');

    expect(cas.handleInputChunk).not.toHaveBeenCalled();
  });
});

describe('TerminalIOCoordinator - writeToPtyWithValidation retry logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('schedules a retry with exponential backoff when PTY is not ready', () => {
    // Terminal starts with no PTY
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      // no pty or ptyProcess initially
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    coordinator.sendInput('data', 't1');

    // After first delay (300ms * 1.5^0 = 300ms), retry should fire
    // Add a pty before the timer fires
    const ptyWrite = vi.fn();
    terminal.pty = { write: ptyWrite } as unknown as TerminalInstance['pty'];

    vi.advanceTimersByTime(300);

    expect(ptyWrite).toHaveBeenCalledWith('data');

    vi.useRealTimers();
  });

  it('gives up after MAX_PTY_RETRY_ATTEMPTS', () => {
    // Terminal will never have a PTY
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    coordinator.sendInput('data', 't1');

    // Advance through all retries: 300, 450, 675ms
    vi.advanceTimersByTime(300); // retry 1
    vi.advanceTimersByTime(450); // retry 2
    vi.advanceTimersByTime(675); // retry 3 - should stop (MAX_PTY_RETRY_ATTEMPTS = 3)

    // No further retries should be scheduled
    const pendingTimers = vi.getTimerCount();
    expect(pendingTimers).toBe(0);

    vi.useRealTimers();
  });

  it('does not write when ptyProcess is killed', () => {
    const ptyWrite = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: {
        write: ptyWrite,
        killed: true,
      } as unknown as TerminalInstance['ptyProcess'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    coordinator.sendInput('data', 't1');

    // writeToPtyWithValidation returns failure for killed process,
    // attemptPtyRecovery has no alternatives (pty is not set)
    // so the error is logged but ptyWrite should NOT be called
    expect(ptyWrite).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('TerminalIOCoordinator - attemptPtyRecovery (via sendInput)', () => {
  it('tries pty as alternative when ptyProcess fails', () => {
    const ptyProcessWrite = vi.fn(() => {
      throw new Error('ptyProcess broken');
    });
    const ptyWrite = vi.fn();

    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: { write: ptyProcessWrite } as unknown as TerminalInstance['ptyProcess'],
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    coordinator.sendInput('data', 't1');

    expect(ptyProcessWrite).toHaveBeenCalledWith('data');
    expect(ptyWrite).toHaveBeenCalledWith('data');
    // ptyProcess should be cleared after successful recovery
    expect(terminal.ptyProcess).toBeUndefined();
  });

  it('returns false when both ptyProcess and pty fail (logs error)', () => {
    const ptyProcessWrite = vi.fn(() => {
      throw new Error('ptyProcess broken');
    });
    const ptyWrite = vi.fn(() => {
      throw new Error('pty also broken');
    });

    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: { write: ptyProcessWrite } as unknown as TerminalInstance['ptyProcess'],
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    // Should not throw - error is caught and logged
    expect(() => coordinator.sendInput('data', 't1')).not.toThrow();
    expect(ptyProcessWrite).toHaveBeenCalled();
    expect(ptyWrite).toHaveBeenCalled();
  });

  it('returns false when only ptyProcess exists and it fails (no pty alternative)', () => {
    const ptyProcessWrite = vi.fn(() => {
      throw new Error('failed');
    });

    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      ptyProcess: { write: ptyProcessWrite } as unknown as TerminalInstance['ptyProcess'],
      // no pty
    });
    const terminals = new Map([['t1', terminal]]);
    const { coordinator } = createCoordinator(terminals);

    // Should not throw
    expect(() => coordinator.sendInput('data', 't1')).not.toThrow();
  });
});

describe('TerminalIOCoordinator - resizeTerminal', () => {
  it('returns true on successful resize', () => {
    const ptyResize = vi.fn();
    const terminal = createMockTerminal({
      id: 't1',
      name: 'T1',
      pty: { resize: ptyResize } as unknown as TerminalInstance['pty'],
    });
    const terminals = new Map([['t1', terminal]]);
    const atm = new ActiveTerminalManager();
    atm.setActive('t1');
    const { coordinator } = createCoordinator(terminals, atm);

    const result = coordinator.resizeTerminal('t1', 80, 24);

    expect(result).toBe(true);
    expect(ptyResize).toHaveBeenCalledWith(80, 24);
  });

  it('returns true even when resize fails internally (error is caught)', () => {
    const terminals = new Map<string, TerminalInstance>();
    const atm = new ActiveTerminalManager();
    const { coordinator } = createCoordinator(terminals, atm);

    // resizeTerminal catches errors internally and returns true
    // because resize() does not throw - it catches errors internally
    const result = coordinator.resizeTerminal('nonexistent', 80, 24);

    expect(result).toBe(true);
  });
});
