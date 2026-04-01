/**
 * WebViewInitHandler Tests
 *
 * Tests for WebView initialization/handshake lifecycle handler extracted from
 * SecondaryTerminalProvider. Covers: theme resolution, webviewReady handshake,
 * webviewInitialized handshake, panel move reinit, and font settings init.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
  window: {
    activeColorTheme: { kind: 2 }, // Dark
    onDidChangeActiveColorTheme: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  },
  ColorThemeKind: {
    Light: 1,
    Dark: 2,
    HighContrast: 3,
    HighContrastLight: 4,
  },
  commands: {
    executeCommand: vi.fn(),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

import {
  WebViewInitHandler,
  IWebViewInitHandlerDependencies,
} from '../../../../../providers/handlers/WebViewInitHandler';
import { WebviewMessage } from '../../../../../types/common';

function createMockDeps(
  overrides?: Partial<IWebViewInitHandlerDependencies>
): IWebViewInitHandlerDependencies {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendVersionInfo: vi.fn(),
    getCurrentSettings: vi.fn().mockReturnValue({ theme: 'auto' }),
    getCurrentFontSettings: vi.fn().mockReturnValue({ fontSize: 14, fontFamily: 'monospace' }),
    orchestratorInitialize: vi.fn().mockResolvedValue(undefined),
    sendFullCliAgentStateSync: vi.fn(),
    initializeTerminal: vi.fn().mockResolvedValue(undefined),
    startPendingWatchdogs: vi.fn(),
    panelLocationHandlerHandleWebviewVisible: vi.fn(),
    ...overrides,
  };
}

describe('WebViewInitHandler', () => {
  let handler: WebViewInitHandler;
  let deps: IWebViewInitHandlerDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    handler = new WebViewInitHandler(deps);
  });

  describe('resolveInitialTheme', () => {
    it('should return explicit light theme when settings is light', () => {
      expect(handler.resolveInitialTheme('light')).toBe('light');
    });

    it('should return explicit dark theme when settings is dark', () => {
      expect(handler.resolveInitialTheme('dark')).toBe('dark');
    });

    it('should resolve auto to dark when VS Code is in dark mode', () => {
      // Default mock has Dark theme kind (2)
      const result = handler.resolveInitialTheme('auto');
      expect(result).toBe('dark');
    });

    it('should resolve auto to dark when theme is undefined', () => {
      const result = handler.resolveInitialTheme(undefined);
      expect(result).toBe('dark');
    });
  });

  describe('handleWebviewReady', () => {
    it('should send extensionReady message', () => {
      const message = { command: 'webviewReady' } as unknown as WebviewMessage;

      handler.handleWebviewReady(message);

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'extensionReady',
        })
      );
    });

    it('should mark as initialized after handling', () => {
      const message = { command: 'webviewReady' } as unknown as WebviewMessage;

      handler.handleWebviewReady(message);

      expect(handler.isInitialized).toBe(true);
    });

    it('should skip duplicate initialization', () => {
      const message = { command: 'webviewReady' } as unknown as WebviewMessage;

      handler.handleWebviewReady(message);
      handler.handleWebviewReady(message);

      // extensionReady should be sent only once
      const extensionReadyCalls = (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call[0] as WebviewMessage).command === ('extensionReady' as any)
      );
      expect(extensionReadyCalls).toHaveLength(1);
    });

    it('should flush pending messages after initialization', () => {
      // Queue a message before init
      handler.queueMessage({ command: 'stateUpdate' } as unknown as WebviewMessage);

      expect(deps.sendMessage).not.toHaveBeenCalled();

      handler.handleWebviewReady({ command: 'webviewReady' } as unknown as WebviewMessage);

      // extensionReady + flushed message
      expect(deps.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should send version info', () => {
      handler.handleWebviewReady({ command: 'webviewReady' } as unknown as WebviewMessage);

      expect(deps.sendVersionInfo).toHaveBeenCalled();
    });

    it('should start pending watchdogs', () => {
      handler.handleWebviewReady({ command: 'webviewReady' } as unknown as WebviewMessage);

      expect(deps.startPendingWatchdogs).toHaveBeenCalledWith(true);
    });
  });

  describe('handleWebviewInitialized', () => {
    it('should send settings before terminal creation', async () => {
      const message = { command: 'webviewInitialized' } as unknown as WebviewMessage;

      await handler.handleWebviewInitialized(message);

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'settingsResponse' })
      );
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'fontSettingsUpdate' })
      );
    });

    it('should call orchestrator initialize after sending settings', async () => {
      const message = { command: 'webviewInitialized' } as unknown as WebviewMessage;

      await handler.handleWebviewInitialized(message);

      expect(deps.orchestratorInitialize).toHaveBeenCalled();
    });

    it('should reinitialize after panel move when pending', async () => {
      handler.setPendingPanelMoveReinit(true);
      const message = { command: 'webviewInitialized' } as unknown as WebviewMessage;

      await handler.handleWebviewInitialized(message);

      // Should send init message for panel move reinit
      expect(deps.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ command: 'init' }));
      expect(deps.initializeTerminal).toHaveBeenCalled();
      expect(deps.sendFullCliAgentStateSync).toHaveBeenCalled();
    });

    it('should clear pending panel move flag after reinit', async () => {
      handler.setPendingPanelMoveReinit(true);
      const message = { command: 'webviewInitialized' } as unknown as WebviewMessage;

      await handler.handleWebviewInitialized(message);

      expect(handler.isPendingPanelMoveReinit).toBe(false);
    });
  });

  describe('reinitializeWebviewAfterPanelMove', () => {
    it('should send init message with timestamp', async () => {
      await handler.reinitializeWebviewAfterPanelMove();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'init',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should send font settings', async () => {
      await handler.reinitializeWebviewAfterPanelMove();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'fontSettingsUpdate' })
      );
    });

    it('should call initializeTerminal and sync agent state', async () => {
      await handler.reinitializeWebviewAfterPanelMove();

      expect(deps.initializeTerminal).toHaveBeenCalled();
      expect(deps.sendFullCliAgentStateSync).toHaveBeenCalled();
    });

    it('should still try initializeTerminal on error', async () => {
      (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

      await handler.reinitializeWebviewAfterPanelMove();

      expect(deps.initializeTerminal).toHaveBeenCalled();
    });
  });

  describe('initializeWithFontSettings', () => {
    it('should send init, font settings, then orchestrate', async () => {
      await handler.initializeWithFontSettings();

      const calls = (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
      const commands = calls.map((c: unknown[]) => (c[0] as WebviewMessage).command);

      expect(commands).toContain('init');
      expect(commands).toContain('fontSettingsUpdate');
      expect(deps.orchestratorInitialize).toHaveBeenCalled();
    });

    it('should still call orchestrator on sendMessage error', async () => {
      (deps.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

      await handler.initializeWithFontSettings();

      expect(deps.orchestratorInitialize).toHaveBeenCalled();
    });
  });

  describe('handleWebviewVisible', () => {
    it('should delegate to panel location handler', () => {
      handler.handleWebviewVisible();

      expect(deps.panelLocationHandlerHandleWebviewVisible).toHaveBeenCalled();
    });
  });

  describe('handleWebviewHidden', () => {
    it('should clear focus context', async () => {
      const vscode = await import('vscode');

      handler.handleWebviewHidden();

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminalFocus',
        false
      );
    });
  });

  describe('queueMessage / sendMessage', () => {
    it('should queue messages before initialization', async () => {
      const msg = { command: 'test' } as unknown as WebviewMessage;

      await handler.sendMessage(msg);

      // Should not send yet
      expect(deps.sendMessage).not.toHaveBeenCalled();
    });

    it('should send messages after initialization', async () => {
      handler.handleWebviewReady({ command: 'webviewReady' } as unknown as WebviewMessage);
      vi.clearAllMocks();

      const msg = { command: 'test' } as unknown as WebviewMessage;
      await handler.sendMessage(msg);

      expect(deps.sendMessage).toHaveBeenCalledWith(msg);
    });

    it('should always send extensionReady even before init', async () => {
      const msg = { command: 'extensionReady' } as unknown as WebviewMessage;

      await handler.sendMessage(msg);

      expect(deps.sendMessage).toHaveBeenCalledWith(msg);
    });
  });

  describe('reset', () => {
    it('should reset initialization state', () => {
      handler.handleWebviewReady({ command: 'webviewReady' } as unknown as WebviewMessage);
      expect(handler.isInitialized).toBe(true);

      handler.reset();

      expect(handler.isInitialized).toBe(false);
    });
  });
});
