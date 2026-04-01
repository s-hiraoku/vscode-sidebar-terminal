/**
 * MessageHandlerRegistrar Tests
 *
 * Verifies that all handler definitions are built and registered on the router.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

vi.mock('../../../../../constants', () => ({
  TERMINAL_CONSTANTS: {
    COMMANDS: {
      READY: 'ready',
      FOCUS_TERMINAL: 'focusTerminal_const',
      CREATE_TERMINAL: 'createTerminal_const',
      INPUT: 'input',
      RESIZE: 'resize',
      START_OUTPUT: 'startOutput',
    },
  },
}));

import {
  MessageHandlerRegistrar,
  IMessageHandlerRegistrarDependencies,
} from '../../../../../providers/handlers/MessageHandlerRegistrar';

function createMockDeps(): IMessageHandlerRegistrarDependencies {
  return {
    handleWebviewReady: vi.fn(),
    handleWebviewInitialized: vi.fn().mockResolvedValue(undefined),
    handleReportPanelLocation: vi.fn().mockResolvedValue(undefined),
    handleTerminalInitializationComplete: vi.fn().mockResolvedValue(undefined),
    handleTerminalReady: vi.fn().mockResolvedValue(undefined),
    handlePersistenceMessage: vi.fn().mockResolvedValue(undefined),
    handleLegacyPersistenceMessage: vi.fn().mockResolvedValue(undefined),
    terminalCommandHandlers: {
      handleFocusTerminal: vi.fn(),
      handleSplitTerminal: vi.fn(),
      handleCreateTerminal: vi.fn(),
      handleTerminalInput: vi.fn(),
      handleTerminalResize: vi.fn(),
      handleGetTerminalProfiles: vi.fn(),
      handleKillTerminal: vi.fn(),
      handleDeleteTerminal: vi.fn(),
      handleTerminalClosed: vi.fn(),
      handleOpenTerminalLink: vi.fn(),
      handleReorderTerminals: vi.fn(),
      handleRenameTerminal: vi.fn(),
      handleUpdateTerminalHeader: vi.fn(),
      handleRequestInitialTerminal: vi.fn(),
      handleTerminalInteraction: vi.fn(),
      handleClipboardRequest: vi.fn(),
      handleCopyToClipboard: vi.fn(),
      handlePasteImage: vi.fn(),
      handlePasteText: vi.fn(),
      handleSwitchAiAgent: vi.fn(),
    } as any,
    settingsMessageHandler: {
      handleGetSettings: vi.fn(),
      handleUpdateSettings: vi.fn(),
    } as any,
    scrollbackMessageHandler: {
      handlePushScrollbackData: vi.fn(),
      handleScrollbackDataCollected: vi.fn(),
      handleScrollbackRefreshRequest: vi.fn(),
    } as any,
    debugMessageHandler: {
      handleHtmlScriptTest: vi.fn(),
      handleTimeoutTest: vi.fn(),
      handleDebugTest: vi.fn(),
    } as any,
  };
}

function createMockRouter() {
  return {
    reset: vi.fn(),
    registerHandlers: vi.fn(),
    validateHandlers: vi.fn(),
    logRegisteredHandlers: vi.fn(),
  };
}

describe('MessageHandlerRegistrar', () => {
  let registrar: MessageHandlerRegistrar;
  let deps: IMessageHandlerRegistrarDependencies;
  let router: ReturnType<typeof createMockRouter>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    registrar = new MessageHandlerRegistrar(deps);
    router = createMockRouter();
  });

  describe('registerAll', () => {
    it('should reset the router before registering', () => {
      registrar.registerAll(router as any);

      expect(router.reset).toHaveBeenCalledOnce();
    });

    it('should register handlers on the router', () => {
      registrar.registerAll(router as any);

      expect(router.registerHandlers).toHaveBeenCalledOnce();
      const handlers = router.registerHandlers.mock.calls[0][0];
      expect(handlers.length).toBeGreaterThan(30);
    });

    it('should validate critical handlers', () => {
      registrar.registerAll(router as any);

      expect(router.validateHandlers).toHaveBeenCalledOnce();
      const criticalCommands = router.validateHandlers.mock.calls[0][0];
      expect(criticalCommands).toContain('terminalInitializationComplete');
      expect(criticalCommands).toContain('terminalReady');
    });

    it('should log registered handlers', () => {
      registrar.registerAll(router as any);

      expect(router.logRegisteredHandlers).toHaveBeenCalledOnce();
    });

    it('should include UI handlers', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const commands = handlers.map((h: any) => h.command);
      expect(commands).toContain('webviewReady');
      expect(commands).toContain('webviewInitialized');
      expect(commands).toContain('reportPanelLocation');
    });

    it('should include settings handlers', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const commands = handlers.map((h: any) => h.command);
      expect(commands).toContain('getSettings');
      expect(commands).toContain('updateSettings');
    });

    it('should include terminal handlers', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const commands = handlers.map((h: any) => h.command);
      expect(commands).toContain('splitTerminal');
      expect(commands).toContain('createTerminal');
      expect(commands).toContain('killTerminal');
      expect(commands).toContain('deleteTerminal');
      expect(commands).toContain('terminalFocused');
      expect(commands).toContain('terminalBlurred');
      expect(commands).toContain('terminalInitializationComplete');
      expect(commands).toContain('terminalReady');
    });

    it('should include persistence handlers', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const commands = handlers.map((h: any) => h.command);
      expect(commands).toContain('persistenceSaveSession');
      expect(commands).toContain('persistenceRestoreSession');
      expect(commands).toContain('pushScrollbackData');
      expect(commands).toContain('scrollbackDataCollected');
    });

    it('should include debug handlers', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const commands = handlers.map((h: any) => h.command);
      expect(commands).toContain('htmlScriptTest');
      expect(commands).toContain('timeoutTest');
      expect(commands).toContain('test');
    });

    it('should categorize handlers correctly', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const categories = new Set(handlers.map((h: any) => h.category));
      expect(categories).toContain('ui');
      expect(categories).toContain('settings');
      expect(categories).toContain('terminal');
      expect(categories).toContain('persistence');
      expect(categories).toContain('debug');
    });
  });

  describe('handler delegation', () => {
    it('should delegate webviewReady to deps', () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const webviewReadyHandler = handlers.find((h: any) => h.command === 'webviewReady');
      const msg = { command: 'webviewReady' } as any;
      webviewReadyHandler.handler(msg);

      expect(deps.handleWebviewReady).toHaveBeenCalledWith(msg);
    });

    it('should delegate terminalInitializationComplete to deps', async () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const initHandler = handlers.find((h: any) => h.command === 'terminalInitializationComplete');
      const msg = { command: 'terminalInitializationComplete', terminalId: '1' } as any;
      await initHandler.handler(msg);

      expect(deps.handleTerminalInitializationComplete).toHaveBeenCalledWith(msg);
    });

    it('should delegate persistence messages to deps', async () => {
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const saveHandler = handlers.find((h: any) => h.command === 'persistenceSaveSession');
      const msg = { command: 'persistenceSaveSession' } as any;
      await saveHandler.handler(msg);

      expect(deps.handlePersistenceMessage).toHaveBeenCalledWith(msg);
    });

    it('should set focus context on terminalFocused', async () => {
      const vscode = await import('vscode');
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const focusHandler = handlers.find((h: any) => h.command === 'terminalFocused');
      await focusHandler.handler({ command: 'terminalFocused', terminalId: '1' } as any);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminalFocus',
        true
      );
    });

    it('should clear focus context on terminalBlurred', async () => {
      const vscode = await import('vscode');
      registrar.registerAll(router as any);

      const handlers = router.registerHandlers.mock.calls[0][0];
      const blurHandler = handlers.find((h: any) => h.command === 'terminalBlurred');
      await blurHandler.handler({ command: 'terminalBlurred', terminalId: '1' } as any);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminalFocus',
        false
      );
    });
  });
});
