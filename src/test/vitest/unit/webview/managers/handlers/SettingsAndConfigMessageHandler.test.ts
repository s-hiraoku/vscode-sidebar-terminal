import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsAndConfigMessageHandler } from '../../../../../../webview/managers/handlers/SettingsAndConfigMessageHandler';

describe('SettingsAndConfigMessageHandler', () => {
  let handler: SettingsAndConfigMessageHandler;
  let mockLogger: any;
  let mockCoordinator: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

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

    handler = new SettingsAndConfigMessageHandler(mockLogger);
  });

  it('should return supported commands', () => {
    const commands = handler.getSupportedCommands();
    expect(commands).toContain('fontSettingsUpdate');
    expect(commands).toContain('settingsResponse');
    expect(commands).toContain('openSettings');
    expect(commands).toContain('themeChanged');
  });

  describe('handleMessage', () => {
    it('should handle fontSettingsUpdate', () => {
      const fontSettings = { fontFamily: 'Arial' };
      handler.handleMessage({ command: 'fontSettingsUpdate', fontSettings }, mockCoordinator);
      
      expect(mockCoordinator.applyFontSettings).toHaveBeenCalledWith(fontSettings);
      expect(mockCoordinator.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        'font-settings-update', '', fontSettings
      );
    });

    it('should handle settingsResponse', () => {
      const settings = { theme: 'dark' };
      handler.handleMessage({ command: 'settingsResponse', settings }, mockCoordinator);
      
      expect(mockCoordinator.applySettings).toHaveBeenCalledWith(settings);
      expect(mockCoordinator.emitTerminalInteractionEvent).toHaveBeenCalledWith(
        'settings-update', '', settings
      );
    });

    it('should handle openSettings', () => {
      handler.handleMessage({ command: 'openSettings' }, mockCoordinator);
      expect(mockCoordinator.openSettings).toHaveBeenCalled();
    });

    it('should handle versionInfo', () => {
      handler.handleMessage({ command: 'versionInfo', version: '1.0.0' }, mockCoordinator);
      expect(mockCoordinator.setVersionInfo).toHaveBeenCalledWith('1.0.0');
    });

    it('should handle stateUpdate', () => {
      const state = { some: 'state' };
      handler.handleMessage({ command: 'stateUpdate', state }, mockCoordinator);
      expect(mockCoordinator.updateState).toHaveBeenCalledWith(state);
    });

    it('should handle themeChanged', () => {
      // Mock getComputedStyle for theme colors
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = vi.fn().mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('#ffffff')
      });

      handler.handleMessage({ command: 'themeChanged', theme: 'dark' }, mockCoordinator);
      
      expect(mockCoordinator.updateAllTerminalThemes).toHaveBeenCalled();
      expect(mockCoordinator.getManagers().ui.updateTheme).toHaveBeenCalled();
      
      window.getComputedStyle = originalGetComputedStyle;
    });
  });
});
