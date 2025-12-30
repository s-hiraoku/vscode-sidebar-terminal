import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebViewSettingsManagerService } from '../../../../services/WebViewSettingsManagerService';
import * as vscode from 'vscode';

const mocks = vi.hoisted(() => {
  const mockConfigManager = {
    getCompleteTerminalSettings: vi.fn().mockReturnValue({}),
    getAltClickSettings: vi.fn().mockReturnValue({ altClickMovesCursor: false, multiCursorModifier: 'alt' }),
    getFontSize: vi.fn().mockReturnValue(12),
    getFontFamily: vi.fn().mockReturnValue('monospace'),
    getFontWeight: vi.fn().mockReturnValue('normal'),
    getFontWeightBold: vi.fn().mockReturnValue('bold'),
    getLineHeight: vi.fn().mockReturnValue(1.2),
    getLetterSpacing: vi.fn().mockReturnValue(0),
  };

  const mockConfiguration = {
    get: vi.fn(),
    update: vi.fn(),
  };

  const mockWorkspace = {
    getConfiguration: vi.fn().mockReturnValue(mockConfiguration),
    onDidChangeConfiguration: vi.fn(),
  };

  const mockCommands = {
    executeCommand: vi.fn(),
  };

  return {
    mockConfigManager,
    mockConfiguration,
    mockWorkspace,
    mockCommands,
  };
});

vi.mock('../../../../config/ConfigManager', () => ({
  getConfigManager: () => mocks.mockConfigManager,
}));

vi.mock('../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

vi.mock('../../../../utils/feedback', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('vscode', () => ({
  workspace: mocks.mockWorkspace,
  commands: mocks.mockCommands,
  ConfigurationTarget: { Global: 1 },
  Disposable: class { dispose() {} },
}));

describe('WebViewSettingsManagerService', () => {
  let service: WebViewSettingsManagerService;
  let mockSendMessage: any;
  let mockContext: any;
  let mockRequestPanelLocationDetection: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockContext = { subscriptions: [] };
    mockRequestPanelLocationDetection = vi.fn();

    // Default config values
    mocks.mockConfiguration.get.mockImplementation((key, defaultValue) => defaultValue);

    service = new WebViewSettingsManagerService(
      mockSendMessage,
      mockContext,
      mockRequestPanelLocationDetection
    );
  });

  describe('getCurrentSettings', () => {
    it('should return settings merged from config manager and vscode config', () => {
      mocks.mockConfigManager.getCompleteTerminalSettings.mockReturnValue({ cursorBlink: true });
      mocks.mockConfiguration.get.mockImplementation((key) => {
        if (key === 'enableCliAgentIntegration') return true;
        return undefined;
      });

      const settings = service.getCurrentSettings();
      expect(settings.cursorBlink).toBe(true);
      expect(settings.enableCliAgentIntegration).toBe(true);
    });
  });

  describe('getCurrentFontSettings', () => {
    it('should return font settings from config manager', () => {
      const fonts = service.getCurrentFontSettings();
      expect(fonts.fontSize).toBe(12);
      expect(fonts.fontFamily).toBe('monospace');
    });
  });

  describe('getCurrentPanelLocation', () => {
    it('should default to sidebar if dynamic split disabled', () => {
      mocks.mockConfiguration.get.mockImplementation((key, def) => {
        if (key === 'dynamicSplitDirection') return false;
        return def;
      });
      expect(service.getCurrentPanelLocation()).toBe('sidebar');
    });

    it('should return manual location if set', () => {
      mocks.mockConfiguration.get.mockImplementation((key, def) => {
        if (key === 'dynamicSplitDirection') return true;
        if (key === 'panelLocation') return 'panel';
        return def;
      });
      expect(service.getCurrentPanelLocation()).toBe('panel');
    });

    it('should default to sidebar for auto', () => {
      mocks.mockConfiguration.get.mockImplementation((key, def) => {
        if (key === 'dynamicSplitDirection') return true;
        if (key === 'panelLocation') return 'auto';
        return def;
      });
      expect(service.getCurrentPanelLocation()).toBe('sidebar');
    });
  });

  describe('updateSettings', () => {
    it('should update configuration', async () => {
      await service.updateSettings({ cursorBlink: false });
      expect(mocks.mockConfiguration.update).toHaveBeenCalledWith(
        'cursorBlink', 
        false, 
        vscode.ConfigurationTarget.Global
      );
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'settingsResponse'
      }));
    });
  });

  describe('setupConfigurationChangeListeners', () => {
    it('should register listener', () => {
      service.setupConfigurationChangeListeners();
      expect(mocks.mockWorkspace.onDidChangeConfiguration).toHaveBeenCalled();
      expect(mockContext.subscriptions).toHaveLength(1);
    });
  });

  describe('handlePanelLocationReport', () => {
    it('should update context and notify webview', async () => {
      await service.handlePanelLocationReport('panel');
      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
        'setContext', 
        'secondaryTerminal.panelLocation', 
        'panel'
      );
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'panelLocationUpdate',
        location: 'panel'
      }));
    });
  });
});
