import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SettingsAndConfigMessageHandler } from '../../../../../../webview/managers/handlers/SettingsAndConfigMessageHandler';
import { MessageQueue } from '../../../../../../webview/utils/MessageQueue';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

// Mock vscode for ErrorHandler
vi.mock('vscode', () => ({
  default: {},
}));

describe('SettingsAndConfigMessageHandler', () => {
  let handler: SettingsAndConfigMessageHandler;
  let mockMessageQueue: MessageQueue;
  let mockLogger: ManagerLogger;
  let mockCoordinator: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockMessageQueue = {
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      clear: vi.fn(),
      size: 0,
      isEmpty: true,
    } as unknown as MessageQueue;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ManagerLogger;

    mockCoordinator = {
      applyFontSettings: vi.fn(),
      applySettings: vi.fn(),
      openSettings: vi.fn(),
      setVersionInfo: vi.fn(),
      updateState: vi.fn(),
      emitTerminalInteractionEvent: vi.fn(),
      updateAllTerminalThemes: vi.fn(),
      getManagers: vi.fn().mockReturnValue({ ui: { updateTheme: vi.fn() } }),
    };

    handler = new SettingsAndConfigMessageHandler(mockMessageQueue, mockLogger);
  });

  afterEach(() => {
    handler.dispose();
  });

  it('should return supported commands', () => {
    const commands = handler.getSupportedCommands();
    expect(commands).toContain('fontSettingsUpdate');
    expect(commands).toContain('settingsResponse');
    expect(commands).toContain('openSettings');
    expect(commands).toContain('themeChanged');
  });

  describe('handleMessage', () => {
    it('should handle fontSettingsUpdate', async () => {
      const fontSettings = { fontFamily: 'Arial' };
      await handler.handleMessage(
        { command: 'fontSettingsUpdate', fontSettings },
        mockCoordinator
      );

      expect(mockCoordinator.applyFontSettings).toHaveBeenCalledWith(fontSettings);
      expect(mockCoordinator.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        'font-settings-update',
        '',
        fontSettings
      );
    });

    it('should handle settingsResponse', async () => {
      const settings = { theme: 'dark' };
      await handler.handleMessage({ command: 'settingsResponse', settings }, mockCoordinator);

      expect(mockCoordinator.applySettings).toHaveBeenCalledWith(settings);
      expect(mockCoordinator.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        'settings-update',
        '',
        settings
      );
    });

    it('should handle openSettings', async () => {
      await handler.handleMessage({ command: 'openSettings' }, mockCoordinator);
      expect(mockCoordinator.openSettings).toHaveBeenCalled();
    });

    it('should handle versionInfo', async () => {
      await handler.handleMessage({ command: 'versionInfo', version: '1.0.0' }, mockCoordinator);
      expect(mockCoordinator.setVersionInfo).toHaveBeenCalledWith('1.0.0');
    });

    it('should handle stateUpdate', async () => {
      const state = { some: 'state' };
      await handler.handleMessage({ command: 'stateUpdate', state }, mockCoordinator);
      expect(mockCoordinator.updateState).toHaveBeenCalledWith(state);
    });

    it('should handle themeChanged', async () => {
      // Mock getComputedStyle for theme colors
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('#ffffff'),
      }) as unknown as typeof window.getComputedStyle;

      await handler.handleMessage({ command: 'themeChanged', theme: 'dark' }, mockCoordinator);

      expect(mockCoordinator.updateAllTerminalThemes).toHaveBeenCalled();
      expect(mockCoordinator.getManagers().ui.updateTheme).toHaveBeenCalled();

      window.getComputedStyle = originalGetComputedStyle;
    });

    it('should warn for unknown command', async () => {
      await handler.handleMessage({ command: 'unknownCommand' as any }, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });
  });

  describe('dispose', () => {
    it('should dispose cleanly', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
