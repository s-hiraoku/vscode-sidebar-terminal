/**
 * ShellIntegrationService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ShellIntegrationService } from '../../../../services/ShellIntegrationService';

// Mock dependencies
const mockTerminalManager = {
  updateTerminalCwd: vi.fn(),
};

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  terminal: vi.fn(),
}));

// Mock common utils
vi.mock('../../../../utils/common', () => ({
  safeProcessCwd: vi.fn().mockReturnValue('/mock/cwd'),
}));

// Mock VS Code API
vi.mock('vscode', () => ({
  commands: {
    executeCommand: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key, def) => def),
    })),
  },
  window: {
    showWarningMessage: vi.fn(),
  },
}));

describe('ShellIntegrationService', () => {
  let service: ShellIntegrationService;
  let mockContext: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockContext = {
      globalState: {
        get: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new ShellIntegrationService(mockTerminalManager as any, mockContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('OSC Sequence Processing', () => {
    const termId = 'term-1';

    it('should detect command start', () => {
      service.processTerminalData(termId, '\x1b]633;A\x07');
      expect(service.isExecuting(termId)).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminal.updateShellStatus',
        { terminalId: termId, status: 'executing' }
      );
    });

    it('should detect command execution even with arguments', () => {
      service.processTerminalData(termId, '\x1b]633;B;ls -la\x07');
      // currentCommand is private, but we can verify it by finishing the command
      service.processTerminalData(termId, '\x1b]633;C;0\x07');
      const history = service.getCommandHistory(termId);
      expect(history[0].command).toBe('ls -la');
    });

    it('should detect command completion with exit code', () => {
      service.processTerminalData(termId, '\x1b]633;A\x07'); // Start
      service.processTerminalData(termId, '\x1b]633;B;ls\x07'); // Exec
      
      vi.advanceTimersByTime(100);
      
      service.processTerminalData(termId, '\x1b]633;C;0\x07'); // Finish success
      
      const history = service.getCommandHistory(termId);
      expect(history).toHaveLength(1);
      expect(history[0].command).toBe('ls');
      expect(history[0].exitCode).toBe(0);
      
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminal.updateShellStatus',
        { terminalId: termId, status: 'success' }
      );
    });

    it('should detect CWD change', () => {
      service.processTerminalData(termId, '\x1b]633;P;Cwd=/new/path\x07');
      
      expect(service.getCurrentCwd(termId)).toBe('/new/path');
      expect(mockTerminalManager.updateTerminalCwd).toHaveBeenCalledWith(termId, '/new/path');
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminal.updateCwd',
        { terminalId: termId, cwd: '/new/path' }
      );
    });
  });

  describe('Fallback Detection', () => {
    const termId = 'term-fallback';

    it('should detect prompt via pattern', () => {
      service.processTerminalData(termId, '\x1b]633;A\x07'); // Set executing true first
      expect(service.isExecuting(termId)).toBe(true);
      
      // Send typical prompt
      service.processTerminalData(termId, 'user@host:~$ ');
      
      expect(service.isExecuting(termId)).toBe(false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'secondaryTerminal.updateShellStatus',
        { terminalId: termId, status: 'ready' }
      );
    });

    it('should detect cd command pattern', () => {
      service.processTerminalData(termId, 'cd /tmp/test\n');
      
      expect(service.getCurrentCwd(termId)).toBe('/tmp/test');
    });
  });

  describe('Shell Injection', () => {
    it('should inject bash/zsh integration', async () => {
      const pty = { write: vi.fn() };
      (vscode.window.showWarningMessage as any).mockResolvedValue('Allow');
      
      await service.injectShellIntegration('t1', '/bin/bash', pty);
      
      expect(pty.write).toHaveBeenCalledWith(expect.stringContaining('__vsc_prompt_cmd'));
    });

    it('should inject fish integration', async () => {
      const pty = { write: vi.fn() };
      (vscode.window.showWarningMessage as any).mockResolvedValue('Allow');
      
      await service.injectShellIntegration('t1', '/usr/bin/fish', pty);
      
      expect(pty.write).toHaveBeenCalledWith(expect.stringContaining('__vsc_prompt'));
    });

    it('should inject powershell integration', async () => {
      const pty = { write: vi.fn() };
      (vscode.window.showWarningMessage as any).mockResolvedValue('Allow');
      
      await service.injectShellIntegration('t1', 'pwsh.exe', pty);
      
      expect(pty.write).toHaveBeenCalledWith(expect.stringContaining('__VSCode-Prompt-Start'));
    });

    it('should respect permission denial', async () => {
      const pty = { write: vi.fn() };
      (vscode.window.showWarningMessage as any).mockResolvedValue('Deny');
      
      await service.injectShellIntegration('t1', '/bin/bash', pty);
      
      expect(pty.write).not.toHaveBeenCalled();
    });

    it('should persist permission choice', async () => {
      const pty = { write: vi.fn() };
      (vscode.window.showWarningMessage as any).mockResolvedValue('Always Allow');
      
      await service.injectShellIntegration('t1', '/bin/bash', pty);
      
      expect(mockContext.globalState.update).toHaveBeenCalledWith('shellIntegrationPermission', true);
    });
  });

  describe('Lifecycle', () => {
    it('should clear state on dispose terminal', () => {
      service.processTerminalData('t1', '\x1b]633;A\x07');
      expect(service.isExecuting('t1')).toBe(true);
      
      service.disposeTerminal('t1');
      expect(service.isExecuting('t1')).toBe(false); // New state created on access, default false
    });

    it('should clear all state on dispose', () => {
      service.processTerminalData('t1', '\x1b]633;A\x07');
      service.dispose();
      expect(service.isExecuting('t1')).toBe(false);
    });
  });
});
