/**
 * SettingsMessageHandler Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode (required by logger and type-guards)
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
}));

import {
  SettingsMessageHandler,
  ISettingsMessageHandlerDependencies,
  ISettingsService,
} from '../../../../../providers/handlers/SettingsMessageHandler';
import { WebviewMessage } from '../../../../../types/common';
import { PartialTerminalSettings, WebViewFontSettings } from '../../../../../types/shared';

function createMockSettingsService(): ISettingsService {
  return {
    getCurrentSettings: vi.fn().mockReturnValue({
      theme: 'dark',
      cursorBlink: true,
      activeBorderMode: 'multipleOnly',
    } as PartialTerminalSettings),
    getCurrentFontSettings: vi.fn().mockReturnValue({
      fontSize: 14,
      fontFamily: 'monospace',
    } as WebViewFontSettings),
    updateSettings: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDeps(
  settingsService?: ISettingsService
): ISettingsMessageHandlerDependencies {
  const service = settingsService ?? createMockSettingsService();
  return {
    getSettingsService: vi.fn().mockReturnValue(service),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SettingsMessageHandler', () => {
  let handler: SettingsMessageHandler;
  let deps: ISettingsMessageHandlerDependencies;
  let settingsService: ISettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsService = createMockSettingsService();
    deps = createMockDeps(settingsService);
    handler = new SettingsMessageHandler(deps);
  });

  describe('handleGetSettings', () => {
    it('should send settingsResponse with current settings', async () => {
      await handler.handleGetSettings();

      expect(settingsService.getCurrentSettings).toHaveBeenCalled();
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'settingsResponse',
          settings: expect.objectContaining({ theme: 'dark' }),
        })
      );
    });

    it('should send fontSettingsUpdate with current font settings', async () => {
      await handler.handleGetSettings();

      expect(settingsService.getCurrentFontSettings).toHaveBeenCalled();
      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'fontSettingsUpdate',
          fontSettings: expect.objectContaining({ fontSize: 14 }),
        })
      );
    });

    it('should send both settings and font settings messages', async () => {
      await handler.handleGetSettings();

      expect(deps.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleUpdateSettings', () => {
    it('should delegate to settings service when message has settings', async () => {
      const message = {
        command: 'updateSettings',
        settings: { theme: 'light' } as PartialTerminalSettings,
      } as unknown as WebviewMessage;

      await handler.handleUpdateSettings(message);

      expect(settingsService.updateSettings).toHaveBeenCalledWith({ theme: 'light' });
    });

    it('should return early when message has no settings', async () => {
      const message = {
        command: 'updateSettings',
      } as unknown as WebviewMessage;

      await handler.handleUpdateSettings(message);

      expect(settingsService.updateSettings).not.toHaveBeenCalled();
    });

    it('should return early when settings is null', async () => {
      const message = {
        command: 'updateSettings',
        settings: null,
      } as unknown as WebviewMessage;

      await handler.handleUpdateSettings(message);

      expect(settingsService.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe('isSettingsChangeAffectingWebView', () => {
    function makeEvent(affectedConfig: string): { affectsConfiguration: (s: string) => boolean } {
      return {
        affectsConfiguration: (s: string) => s === affectedConfig,
      };
    }

    it('should return true for activeBorderMode changes', () => {
      const event = makeEvent('secondaryTerminal.activeBorderMode');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(true);
    });

    it('should return true for theme changes', () => {
      const event = makeEvent('secondaryTerminal.theme');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(true);
    });

    it('should return true for cursorBlink changes', () => {
      const event = makeEvent('secondaryTerminal.cursorBlink');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(true);
    });

    it('should return true for editor.multiCursorModifier changes', () => {
      const event = makeEvent('editor.multiCursorModifier');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(true);
    });

    it('should return true for altClickMovesCursor changes', () => {
      const event = makeEvent('terminal.integrated.altClickMovesCursor');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(true);
    });

    it('should return true for dynamicSplitDirection changes', () => {
      const event = makeEvent('secondaryTerminal.dynamicSplitDirection');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(true);
    });

    it('should return false for unrelated configuration changes', () => {
      const event = makeEvent('some.unrelated.setting');
      expect(handler.isSettingsChangeAffectingWebView(event as any)).toBe(false);
    });
  });

  describe('isFontSettingsChange', () => {
    function makeEvent(affectedConfig: string): { affectsConfiguration: (s: string) => boolean } {
      return {
        affectsConfiguration: (s: string) => s === affectedConfig,
      };
    }

    it('should return true for secondaryTerminal.fontSize changes', () => {
      const event = makeEvent('secondaryTerminal.fontSize');
      expect(handler.isFontSettingsChange(event as any)).toBe(true);
    });

    it('should return true for secondaryTerminal.fontFamily changes', () => {
      const event = makeEvent('secondaryTerminal.fontFamily');
      expect(handler.isFontSettingsChange(event as any)).toBe(true);
    });

    it('should return true for terminal.integrated.fontSize changes', () => {
      const event = makeEvent('terminal.integrated.fontSize');
      expect(handler.isFontSettingsChange(event as any)).toBe(true);
    });

    it('should return true for editor.fontSize changes', () => {
      const event = makeEvent('editor.fontSize');
      expect(handler.isFontSettingsChange(event as any)).toBe(true);
    });

    it('should return true for letterSpacing changes', () => {
      const event = makeEvent('secondaryTerminal.letterSpacing');
      expect(handler.isFontSettingsChange(event as any)).toBe(true);
    });

    it('should return false for unrelated configuration changes', () => {
      const event = makeEvent('some.unrelated.setting');
      expect(handler.isFontSettingsChange(event as any)).toBe(false);
    });
  });

  describe('sendSettingsUpdateToWebView', () => {
    it('should send settingsResponse with current settings', async () => {
      await handler.sendSettingsUpdateToWebView();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'settingsResponse',
          settings: expect.objectContaining({ theme: 'dark' }),
        })
      );
    });

    it('should call getCurrentSettings from settings service', async () => {
      await handler.sendSettingsUpdateToWebView();

      expect(settingsService.getCurrentSettings).toHaveBeenCalled();
    });
  });

  describe('sendFontSettingsUpdateToWebView', () => {
    it('should send fontSettingsUpdate with current font settings', async () => {
      await handler.sendFontSettingsUpdateToWebView();

      expect(deps.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'fontSettingsUpdate',
          fontSettings: expect.objectContaining({ fontSize: 14 }),
        })
      );
    });

    it('should call getCurrentFontSettings from settings service', async () => {
      await handler.sendFontSettingsUpdateToWebView();

      expect(settingsService.getCurrentFontSettings).toHaveBeenCalled();
    });
  });
});
