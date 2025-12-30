import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRegistrar, CommandRegistrarDeps, SessionCommandHandlers } from '../../../../core/CommandRegistrar';
import * as vscode from 'vscode';

// Mock vscode
const mockSubscriptions: any[] = [];
vi.mock('vscode', () => ({
  commands: {
    registerCommand: vi.fn().mockImplementation((command, handler) => {
      return { dispose: vi.fn(), command, handler };
    }),
    executeCommand: vi.fn(),
  },
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  ExtensionContext: vi.fn(),
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('CommandRegistrar', () => {
  let registrar: CommandRegistrar;
  let mockDeps: CommandRegistrarDeps;
  let mockSessionHandlers: SessionCommandHandlers;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptions.length = 0;

    mockDeps = {
      terminalManager: {
        sendInput: vi.fn(),
        getActiveTerminalId: vi.fn(),
      } as any,
      sidebarProvider: {
        splitTerminal: vi.fn(),
        killTerminal: vi.fn(),
        selectProfile: vi.fn(),
        openSettings: vi.fn(),
        sendMessageToWebview: vi.fn(),
      } as any,
      extensionPersistenceService: {
        clearSession: vi.fn(),
      } as any,
      fileReferenceCommand: {
        handleSendAtMention: vi.fn(),
        handleSendAllOpenFiles: vi.fn(),
      } as any,
      terminalCommand: {
        handleSendToTerminal: vi.fn(),
      } as any,
      copilotIntegrationCommand: {
        handleActivateCopilot: vi.fn(),
      } as any,
      shellIntegrationService: {
        getCommandHistory: vi.fn().mockReturnValue([]),
      } as any,
      keyboardShortcutService: {
        find: vi.fn(),
      } as any,
      telemetryService: {
        trackCommandExecuted: vi.fn(),
        trackError: vi.fn(),
      } as any,
    };

    mockSessionHandlers = {
      handleSaveSession: vi.fn(),
      handleRestoreSession: vi.fn(),
      handleClearSession: vi.fn(),
      handleTestScrollback: vi.fn(),
      diagnoseSessionData: vi.fn(),
    };

    mockContext = {
      subscriptions: mockSubscriptions,
    } as unknown as vscode.ExtensionContext;

    registrar = new CommandRegistrar(mockDeps, mockSessionHandlers);
  });

  describe('registerCommands', () => {
    it('should register all commands', () => {
      registrar.registerCommands(mockContext);

      // Check registration count (approximate)
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(19);
      expect(mockContext.subscriptions.length).toBe(19);
    });

    it('should register specific commands', () => {
      registrar.registerCommands(mockContext);

      const registeredCommands = (vscode.commands.registerCommand as any).mock.calls.map((call: any) => call[0]);
      
      expect(registeredCommands).toContain('secondaryTerminal.splitTerminal');
      expect(registeredCommands).toContain('secondaryTerminal.saveSession');
      expect(registeredCommands).toContain('secondaryTerminal.activateCopilot');
    });
  });

  describe('Command Execution', () => {
    let commandHandlers: Map<string, Function>;

    beforeEach(() => {
      commandHandlers = new Map();
      (vscode.commands.registerCommand as any).mockImplementation((command: string, handler: Function) => {
        commandHandlers.set(command, handler);
        return { dispose: vi.fn() };
      });
      registrar.registerCommands(mockContext);
    });

    const executeCommand = async (command: string, ...args: any[]) => {
      const handler = commandHandlers.get(command);
      if (handler) {
        await handler(...args);
      } else {
        throw new Error(`Command ${command} not registered`);
      }
    };

    it('should execute splitTerminal', async () => {
      await executeCommand('secondaryTerminal.splitTerminal');
      expect(mockDeps.sidebarProvider?.splitTerminal).toHaveBeenCalled();
    });

    it('should execute saveSession', async () => {
      await executeCommand('secondaryTerminal.saveSession');
      expect(mockSessionHandlers.handleSaveSession).toHaveBeenCalled();
    });

    it('should execute sendToTerminal', async () => {
      await executeCommand('secondaryTerminal.sendToTerminal', 'text');
      expect(mockDeps.terminalCommand?.handleSendToTerminal).toHaveBeenCalledWith('text');
    });

    it('should track telemetry on success', async () => {
      await executeCommand('secondaryTerminal.splitTerminal');
      expect(mockDeps.telemetryService?.trackCommandExecuted).toHaveBeenCalledWith('secondaryTerminal.splitTerminal', true);
    });

    it('should track telemetry and errors on failure', async () => {
      const error = new Error('Test Error');
      (mockDeps.sidebarProvider as any).splitTerminal.mockImplementation(() => { throw error; });

      await expect(executeCommand('secondaryTerminal.splitTerminal')).rejects.toThrow('Test Error');
      
      expect(mockDeps.telemetryService?.trackCommandExecuted).toHaveBeenCalledWith('secondaryTerminal.splitTerminal', false);
      expect(mockDeps.telemetryService?.trackError).toHaveBeenCalledWith(error, 'command:secondaryTerminal.splitTerminal');
    });
  });
});
