/**
 * TerminalDataBufferManager Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import { TerminalDataBufferManager } from '../../../../terminals/TerminalDataBufferManager';
import type { TerminalEvent, TerminalInstance } from '../../../../types/shared';

describe('TerminalDataBufferManager', () => {
  it('strips CSI 3 J (erase scrollback) even when split across chunks', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: vi.fn(),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    const received: TerminalEvent[] = [];
    const sub = emitter.event((e) => received.push(e));

    bufferManager.bufferData('terminal-1', '\u001b[');
    bufferManager.bufferData('terminal-1', '3Jhello');
    bufferManager.flushBuffer('terminal-1');

    expect(received).toHaveLength(1);
    expect(received[0]?.data).toBe('hello');

    sub.dispose();
    bufferManager.dispose();
  });

  it('does not strip other CSI erase sequences (e.g. CSI 2 J)', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: vi.fn(),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    const received: TerminalEvent[] = [];
    const sub = emitter.event((e) => received.push(e));

    bufferManager.bufferData('terminal-1', '\u001b[2Jhi');
    bufferManager.flushBuffer('terminal-1');

    expect(received).toHaveLength(1);
    expect(received[0]?.data).toBe('\u001b[2Jhi');

    sub.dispose();
    bufferManager.dispose();
  });

  it('preserves non-CSI ESC sequences across chunk boundaries', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: vi.fn(),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    const received: TerminalEvent[] = [];
    const sub = emitter.event((e) => received.push(e));

    bufferManager.bufferData('terminal-1', '\u001b');
    bufferManager.bufferData('terminal-1', 'X');
    bufferManager.flushBuffer('terminal-1');

    expect(received).toHaveLength(1);
    expect(received[0]?.data).toBe('\u001bX');

    sub.dispose();
    bufferManager.dispose();
  });

  it('runs termination detection when an agent is active', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: vi.fn(),
      detectTermination: vi.fn(),
      getAgentState: vi.fn().mockReturnValue({ status: 'connected', agentType: 'claude' }),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    bufferManager.bufferData('terminal-1', 'user@host:~$ ');
    bufferManager.flushBuffer('terminal-1');

    expect(cliAgentService.detectFromOutput).toHaveBeenCalledWith('terminal-1', 'user@host:~$ ');
    expect(cliAgentService.detectTermination).toHaveBeenCalledWith(
      'terminal-1',
      'user@host:~$ '
    );

    bufferManager.dispose();
  });

  it('skips termination detection when no agent is active', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: vi.fn(),
      detectTermination: vi.fn(),
      getAgentState: vi.fn().mockReturnValue({ status: 'none', agentType: null }),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    bufferManager.bufferData('terminal-1', 'plain shell output');
    bufferManager.flushBuffer('terminal-1');

    expect(cliAgentService.detectFromOutput).toHaveBeenCalledWith('terminal-1', 'plain shell output');
    expect(cliAgentService.detectTermination).not.toHaveBeenCalled();

    bufferManager.dispose();
  });

  it('calls cli agent methods with service binding intact', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();

    class BoundCliService {
      public readonly detectFromOutput = vi.fn();
      public readonly detectTermination = vi.fn();

      getAgentState(id: string): { status: 'connected' | 'none'; agentType: string | null } {
        this.detectFromOutput(id, 'state-check');
        return { status: 'connected', agentType: 'claude' };
      }
    }

    const cliAgentService = new BoundCliService() as any;
    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    bufferManager.bufferData('terminal-1', 'user@host:~$ ');
    bufferManager.flushBuffer('terminal-1');

    expect(cliAgentService.detectTermination).toHaveBeenCalledWith(
      'terminal-1',
      'user@host:~$ '
    );

    bufferManager.dispose();
  });
});
