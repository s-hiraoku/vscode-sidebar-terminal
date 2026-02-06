/**
 * SettingsSyncService Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

import { SettingsSyncService } from '../../../../../providers/services/SettingsSyncService';

const { mockUnifiedConfig } = vi.hoisted(() => ({
  mockUnifiedConfig: {
    getCompleteTerminalSettings: vi.fn(),
    getWebViewFontSettings: vi.fn(),
    getExtensionTerminalConfig: vi.fn(),
    getWebViewTerminalSettings: vi.fn(),
    get: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    isFeatureEnabled: vi.fn(),
    getAltClickSettings: vi.fn(),
  },
}));

// Mock VS Code API
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      inspect: vi.fn(),
    })),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
}));

// Mock UnifiedConfigurationService
vi.mock('../../../../../config/UnifiedConfigurationService', () => ({
  getUnifiedConfigurationService: vi.fn(() => mockUnifiedConfig),
}));

// Mock feedback utils
vi.mock('../../../../../utils/feedback', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('SettingsSyncService', () => {
  let service: SettingsSyncService;
  let mockReinitializeCallback: any;

  beforeEach(() => {
    mockReinitializeCallback = vi.fn().mockResolvedValue(undefined);
    mockUnifiedConfig.update.mockResolvedValue(undefined);
    
    // Default mocks for migration check in constructor
    (vscode.workspace.getConfiguration as any).mockReturnValue({
      inspect: vi.fn().mockReturnValue({ globalValue: undefined }),
      update: vi.fn().mockResolvedValue(undefined),
    });

    service = new SettingsSyncService(mockReinitializeCallback);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Migration', () => {
    it('should migrate deprecated settings if found', () => {
      const mockConfig = {
        inspect: vi.fn().mockImplementation((key) => {
          if (key === 'highlightActiveBorder') {
            return { globalValue: true };
          }
          if (key === 'activeBorderMode') {
            return { globalValue: undefined };
          }
          return undefined;
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);

      // Re-create service to trigger constructor migration
      new SettingsSyncService();

      expect(mockConfig.update).toHaveBeenCalledWith(
        'activeBorderMode',
        'multipleOnly',
        expect.anything()
      );
    });

    it('should not migrate if new setting already exists', () => {
      const mockConfig = {
        inspect: vi.fn().mockImplementation((key) => {
          if (key === 'highlightActiveBorder') {
            return { globalValue: true };
          }
          if (key === 'activeBorderMode') {
            return { globalValue: 'all' }; // Already set
          }
          return undefined;
        }),
        update: vi.fn().mockResolvedValue(undefined),
      };
      (vscode.workspace.getConfiguration as any).mockReturnValue(mockConfig);

      new SettingsSyncService();

      expect(mockConfig.update).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentSettings', () => {
    it('should return combined settings from unified config', () => {
      mockUnifiedConfig.getCompleteTerminalSettings.mockReturnValue({
        cursorBlink: true,
        theme: 'dark',
      });
      mockUnifiedConfig.getAltClickSettings.mockReturnValue({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      mockUnifiedConfig.get.mockImplementation((section, key, def) => {
        if (key === 'scrollback') return 5000;
        if (key === 'activeBorderMode') return 'all';
        if (key === 'panelLocation') return 'sidebar';
        if (key === 'showHeaderModeIndicator') return false;
        return def;
      });
      mockUnifiedConfig.isFeatureEnabled.mockImplementation((feature) => {
        if (feature === 'cliAgentIntegration') return true;
        if (feature === 'dynamicSplitDirection') return false;
        if (feature === 'terminalHeaderEnhancements') return false;
        return false;
      });

      const settings = service.getCurrentSettings();

      expect(settings).toEqual({
        cursorBlink: true,
        theme: 'dark',
        scrollback: 5000,
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
        enableCliAgentIntegration: true,
        enableTerminalHeaderEnhancements: false,
        showHeaderModeIndicator: false,
        activeBorderMode: 'all',
        dynamicSplitDirection: false,
        panelLocation: 'sidebar',
      });
    });
  });

  describe('getCurrentFontSettings', () => {
    it('should delegate to unified config', () => {
      const mockFontSettings = { fontSize: 14, fontFamily: 'Courier' };
      mockUnifiedConfig.getWebViewFontSettings.mockReturnValue(mockFontSettings);

      const result = service.getCurrentFontSettings();

      expect(result).toBe(mockFontSettings);
      expect(mockUnifiedConfig.getWebViewFontSettings).toHaveBeenCalled();
    });
  });

  describe('getCompleteSettings', () => {
    it('should return complete settings', () => {
      mockUnifiedConfig.getExtensionTerminalConfig.mockReturnValue({
        shell: '/bin/bash',
        shellArgs: [],
        fontSize: 16,
        fontFamily: 'Monaco',
        cursor: { style: 'bar', blink: true },
        maxTerminals: 10,
        enableCliAgentIntegration: true,
        enableTerminalHeaderEnhancements: true,
        showHeaderModeIndicator: false,
      });
      mockUnifiedConfig.getWebViewTerminalSettings.mockReturnValue({
        theme: 'light',
        dynamicSplitDirection: true,
        panelLocation: 'bottom',
      });

      const settings = service.getCompleteSettings();

      expect(settings).toEqual({
        shell: '/bin/bash',
        shellArgs: [],
        fontSize: 16,
        fontFamily: 'Monaco',
        theme: 'light',
        cursor: { style: 'bar', blink: true },
        maxTerminals: 10,
        enableCliAgentIntegration: true,
        enableTerminalHeaderEnhancements: true,
        showHeaderModeIndicator: false,
        dynamicSplitDirection: true,
        panelLocation: 'bottom',
      });
    });
  });

  describe('updateSettings', () => {
    it('should update multiple settings and call reinitialize', async () => {
      const settingsToUpdate = {
        cursorBlink: false,
        theme: 'auto',
        enableCliAgentIntegration: false,
        enableTerminalHeaderEnhancements: false,
        showHeaderModeIndicator: false,
        activeBorderMode: 'none',
        dynamicSplitDirection: true,
        panelLocation: 'sidebar',
      } as any;

      await service.updateSettings(settingsToUpdate);

      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'cursorBlink', false);
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'theme', 'auto');
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'enableCliAgentIntegration', false);
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith(
        'secondaryTerminal',
        'enableTerminalHeaderEnhancements',
        false
      );
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith(
        'secondaryTerminal',
        'showHeaderModeIndicator',
        false
      );
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'activeBorderMode', 'none');
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'dynamicSplitDirection', true);
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'panelLocation', 'sidebar');
      
      expect(mockReinitializeCallback).toHaveBeenCalled();
    });

    it('should only update provided settings', async () => {
      await service.updateSettings({ theme: 'dark' });

      expect(mockUnifiedConfig.update).toHaveBeenCalledTimes(1);
      expect(mockUnifiedConfig.update).toHaveBeenCalledWith('secondaryTerminal', 'theme', 'dark');
    });

    it('should handle errors gracefully', async () => {
      const { showError } = await import('../../../../../utils/feedback');
      mockUnifiedConfig.update.mockRejectedValue(new Error('Update failed'));

      await service.updateSettings({ theme: 'dark' });

      expect(showError).toHaveBeenCalledWith(expect.stringContaining('Failed to update settings'));
    });
  });

  describe('getAltClickSettings', () => {
    it('should retrieve settings from vscode configuration', () => {
      const mockGet = vi.fn().mockImplementation((key, def) => {
        if (key === 'altClickMovesCursor') return true;
        if (key === 'multiCursorModifier') return 'ctrlCmd';
        return def;
      });
      
      (vscode.workspace.getConfiguration as any).mockReturnValue({
        get: mockGet
      });

      const result = service.getAltClickSettings();

      expect(result).toEqual({
        altClickMovesCursor: true,
        multiCursorModifier: 'ctrlCmd',
      });
    });
  });

  describe('setReinitializeCallback', () => {
    it('should update the reinitialize callback', async () => {
      const newCallback = vi.fn().mockResolvedValue(undefined);
      service.setReinitializeCallback(newCallback);
      
      await service.updateSettings({ theme: 'dark' });
      
      expect(newCallback).toHaveBeenCalled();
      expect(mockReinitializeCallback).not.toHaveBeenCalled();
    });
  });
});
