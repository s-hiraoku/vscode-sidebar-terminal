import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemMessageHandler } from '../../../../../messaging/handlers/SystemMessageHandler';
import { IMessageHandlerContext } from '../../../../../messaging/UnifiedMessageDispatcher';
import { WebviewMessage } from '../../../../../types/common';

describe('SystemMessageHandler', () => {
  let handler: SystemMessageHandler;
  let mockContext: IMessageHandlerContext;
  let mockCoordinator: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCoordinator = {
      applyFontSettings: vi.fn(),
      updateState: vi.fn(),
    };

    mockContext = {
      coordinator: mockCoordinator,
      postMessage: vi.fn().mockResolvedValue(undefined),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
    };

    handler = new SystemMessageHandler();
  });

  describe('handleInitMessage', () => {
    it('should request settings and emit webview-ready', async () => {
      await handler.handle({ command: 'init' }, mockContext);

      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'getSettings'
      }));
      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'terminalInteraction',
        type: 'webview-ready'
      }));
    });
  });

  describe('handleFontSettingsUpdate', () => {
    it('should apply font settings and emit event', async () => {
      const fontSettings = { fontSize: 14 };
      await handler.handle({ command: 'fontSettingsUpdate', fontSettings }, mockContext);

      expect(mockCoordinator.applyFontSettings).toHaveBeenCalledWith(fontSettings);
      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'terminalInteraction',
        type: 'font-settings-update',
        data: fontSettings
      }));
    });
  });

  describe('handleSettingsResponse', () => {
    it('should emit settings-update event', async () => {
      const settings = { theme: 'dark' };
      await handler.handle({ command: 'settingsResponse', settings }, mockContext);

      expect(mockContext.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'terminalInteraction',
        type: 'settings-update',
        data: settings
      }));
    });
  });

  describe('handleStateUpdate', () => {
    it('should call updateState on coordinator', async () => {
      const state = { mode: 'split' };
      await handler.handle({ command: 'stateUpdate', state }, mockContext);

      expect(mockCoordinator.updateState).toHaveBeenCalledWith(state);
    });
  });
});
