import { describe, it, expect, vi } from 'vitest';
import { TerminalIOCoordinator } from '../../../../terminals/TerminalIOCoordinator';
import { ActiveTerminalManager } from '../../../../utils/common';
import { TerminalInstance } from '../../../../types/shared';
import { ICliAgentDetectionService } from '../../../../interfaces/CliAgentService';
import { CliAgentDetectionService } from '../../../../services/CliAgentDetectionService';

describe('TerminalIOCoordinator - PTY recovery', () => {
  it('retries using terminal.pty when primary is undefined and first write fails', () => {
    const ptyWrite = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('first write failed');
      })
      .mockImplementationOnce(() => undefined);

    const terminal: TerminalInstance = {
      id: 'term-1',
      name: 'Test Terminal',
      isActive: true,
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    };

    const terminals = new Map<string, TerminalInstance>([['term-1', terminal]]);
    const activeTerminalManager = new ActiveTerminalManager();
    activeTerminalManager.setActive('term-1');

    const mockCliAgentService = {
      handleInputChunk: vi.fn(),
    } as unknown as ICliAgentDetectionService;

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

    const terminal: TerminalInstance = {
      id: 'term-1',
      name: 'Test Terminal',
      isActive: true,
      ptyProcess: { write: ptyProcessWrite } as unknown as TerminalInstance['ptyProcess'],
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    };

    const terminals = new Map<string, TerminalInstance>([['term-1', terminal]]);
    const activeTerminalManager = new ActiveTerminalManager();
    activeTerminalManager.setActive('term-1');

    const mockCliAgentService = {
      handleInputChunk: vi.fn(),
    } as unknown as ICliAgentDetectionService;

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
    const terminal: TerminalInstance = {
      id: 'term-1',
      name: 'Gemini Terminal',
      isActive: true,
      pty: { write: ptyWrite } as unknown as TerminalInstance['pty'],
    };

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
