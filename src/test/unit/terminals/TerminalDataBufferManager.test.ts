import { expect } from 'chai';
import * as sinon from 'sinon';
import '../../shared/TestSetup';
import * as vscode from 'vscode';
import { TerminalDataBufferManager } from '../../../terminals/TerminalDataBufferManager';
import type { TerminalEvent, TerminalInstance } from '../../../types/shared';

describe('TerminalDataBufferManager', () => {
  it('strips CSI 3 J (erase scrollback) even when split across chunks', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: sinon.stub(),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    const received: TerminalEvent[] = [];
    const sub = emitter.event((e) => received.push(e));

    bufferManager.bufferData('terminal-1', '\u001b[');
    bufferManager.bufferData('terminal-1', '3Jhello');
    bufferManager.flushBuffer('terminal-1');

    expect(received).to.have.length(1);
    expect(received[0]?.data).to.equal('hello');

    sub.dispose();
    bufferManager.dispose();
  });

  it('does not strip other CSI erase sequences (e.g. CSI 2 J)', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: sinon.stub(),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    const received: TerminalEvent[] = [];
    const sub = emitter.event((e) => received.push(e));

    bufferManager.bufferData('terminal-1', '\u001b[2Jhi');
    bufferManager.flushBuffer('terminal-1');

    expect(received).to.have.length(1);
    expect(received[0]?.data).to.equal('\u001b[2Jhi');

    sub.dispose();
    bufferManager.dispose();
  });

  it('preserves non-CSI ESC sequences across chunk boundaries', () => {
    const terminals = new Map<string, TerminalInstance>();
    terminals.set('terminal-1', { id: 'terminal-1', name: 'Terminal 1' } as TerminalInstance);

    const emitter = new vscode.EventEmitter<TerminalEvent>();
    const cliAgentService = {
      detectFromOutput: sinon.stub(),
    } as any;

    const bufferManager = new TerminalDataBufferManager(terminals, emitter, cliAgentService);

    const received: TerminalEvent[] = [];
    const sub = emitter.event((e) => received.push(e));

    bufferManager.bufferData('terminal-1', '\u001b');
    bufferManager.bufferData('terminal-1', 'X');
    bufferManager.flushBuffer('terminal-1');

    expect(received).to.have.length(1);
    expect(received[0]?.data).to.equal('\u001bX');

    sub.dispose();
    bufferManager.dispose();
  });
});

