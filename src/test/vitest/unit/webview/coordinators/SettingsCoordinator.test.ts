/**
 * SettingsCoordinator Tests
 *
 * Tests for settings management methods extracted from LightweightTerminalWebviewManager.
 * Covers: applySettings, loadSettings, saveSettings, applyFontSettings,
 *         getCurrentFontSettings, openSettings, updateAllTerminalThemes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SettingsCoordinator,
  ISettingsCoordinatorDependencies,
} from '../../../../../webview/coordinators/SettingsCoordinator';

function createMockDeps(): ISettingsCoordinatorDependencies {
  return {
    getCurrentSettings: vi.fn().mockReturnValue({}),
    setCurrentSettings: vi.fn(),
    configManagerApplySettings: vi.fn(),
    configManagerGetCurrentSettings: vi.fn().mockReturnValue({}),
    hasConfigManager: vi.fn().mockReturnValue(true),
    getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
    getAllTerminalContainers: vi.fn().mockReturnValue(new Map()),
    getSplitTerminals: vi.fn().mockReturnValue(new Map()),
    setActiveBorderMode: vi.fn(),
    setTerminalHeaderEnhancementsEnabled: vi.fn(),
    updateTerminalBorders: vi.fn(),
    updateSplitTerminalBorders: vi.fn(),
    applyAllVisualSettings: vi.fn(),
    fontSettingsUpdateSettings: vi.fn(),
    fontSettingsGetCurrentSettings: vi.fn().mockReturnValue({
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 'normal',
      letterSpacing: 0,
      lineHeight: 1.2,
    }),
    loadState: vi.fn().mockReturnValue(null),
    saveState: vi.fn(),
    getActiveTerminalId: vi.fn().mockReturnValue(null),
    hasSettingsPanel: vi.fn().mockReturnValue(true),
    settingsPanelSetVersionInfo: vi.fn(),
    settingsPanelShow: vi.fn(),
    getVersionInfo: vi.fn().mockReturnValue('v0.1.0'),
  };
}

describe('SettingsCoordinator', () => {
  let coordinator: SettingsCoordinator;
  let deps: ISettingsCoordinatorDependencies;

  beforeEach(() => {
    deps = createMockDeps();
    coordinator = new SettingsCoordinator(deps);
  });

  describe('applySettings', () => {
    it('should merge settings with current settings and update state', () => {
      vi.mocked(deps.getCurrentSettings).mockReturnValue({ theme: 'dark' } as any);

      coordinator.applySettings({ fontSize: 16 } as any);

      expect(deps.setCurrentSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'dark',
          fontSize: 16,
          activeBorderMode: 'multipleOnly',
        })
      );
    });

    it('should use provided activeBorderMode when specified', () => {
      coordinator.applySettings({ activeBorderMode: 'always' } as any);

      expect(deps.setCurrentSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          activeBorderMode: 'always',
        })
      );
    });

    it('should update ConfigManager when available', () => {
      const instances = new Map([['t-1', { terminal: {} }]]) as any;
      vi.mocked(deps.getAllTerminalInstances).mockReturnValue(instances);

      coordinator.applySettings({ theme: 'light' } as any);

      expect(deps.configManagerApplySettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'light' }),
        instances
      );
    });

    it('should skip ConfigManager when not available', () => {
      vi.mocked(deps.hasConfigManager).mockReturnValue(false);

      coordinator.applySettings({ theme: 'light' } as any);

      expect(deps.configManagerApplySettings).not.toHaveBeenCalled();
    });

    it('should update active border mode on UI manager', () => {
      coordinator.applySettings({ activeBorderMode: 'never' } as any);

      expect(deps.setActiveBorderMode).toHaveBeenCalledWith('never');
    });

    it('should set terminal header enhancements enabled by default', () => {
      coordinator.applySettings({});

      expect(deps.setTerminalHeaderEnhancementsEnabled).toHaveBeenCalledWith(true);
    });

    it('should set terminal header enhancements disabled when explicitly false', () => {
      coordinator.applySettings({ enableTerminalHeaderEnhancements: false } as any);

      expect(deps.setTerminalHeaderEnhancementsEnabled).toHaveBeenCalledWith(false);
    });

    it('should update terminal borders when active terminal has containers', () => {
      vi.mocked(deps.getActiveTerminalId).mockReturnValue('t-1');
      const containers = new Map([['t-1', document.createElement('div')]]);
      vi.mocked(deps.getAllTerminalContainers).mockReturnValue(containers);

      coordinator.applySettings({});

      expect(deps.updateTerminalBorders).toHaveBeenCalledWith('t-1', containers);
    });

    it('should update split borders when active terminal has no containers', () => {
      vi.mocked(deps.getActiveTerminalId).mockReturnValue('t-1');
      vi.mocked(deps.getAllTerminalContainers).mockReturnValue(new Map());

      coordinator.applySettings({});

      expect(deps.updateSplitTerminalBorders).toHaveBeenCalledWith('t-1');
    });

    it('should apply visual settings to all terminal instances', () => {
      const mockTerminal = { options: {} };
      const instances = new Map([
        ['t-1', { terminal: mockTerminal, name: 'Terminal 1' }],
        ['t-2', { terminal: mockTerminal, name: 'Terminal 2' }],
      ]) as any;
      vi.mocked(deps.getAllTerminalInstances).mockReturnValue(instances);

      coordinator.applySettings({ theme: 'dark' } as any);

      expect(deps.applyAllVisualSettings).toHaveBeenCalledTimes(2);
    });

    it('should not throw when applyAllVisualSettings fails for a terminal', () => {
      const instances = new Map([['t-1', { terminal: {}, name: 'T1' }]]) as any;
      vi.mocked(deps.getAllTerminalInstances).mockReturnValue(instances);
      vi.mocked(deps.applyAllVisualSettings).mockImplementation(() => {
        throw new Error('Visual settings error');
      });

      expect(() => coordinator.applySettings({})).not.toThrow();
    });

    it('should not throw on error', () => {
      vi.mocked(deps.getCurrentSettings).mockImplementation(() => {
        throw new Error('Settings error');
      });

      expect(() => coordinator.applySettings({})).not.toThrow();
    });
  });

  describe('loadSettings', () => {
    it('should apply saved settings when available', () => {
      const savedSettings = { theme: 'dark', fontSize: 16 };
      vi.mocked(deps.loadState).mockReturnValue({ settings: savedSettings as any });

      const applySettingsSpy = vi.spyOn(coordinator, 'applySettings');
      coordinator.loadSettings();

      expect(applySettingsSpy).toHaveBeenCalledWith(savedSettings);
    });

    it('should apply saved font settings when available', () => {
      const savedFontSettings = { fontFamily: 'Fira Code', fontSize: 14 };
      vi.mocked(deps.loadState).mockReturnValue({
        fontSettings: savedFontSettings as any,
      });

      const applyFontSpy = vi.spyOn(coordinator, 'applyFontSettings');
      coordinator.loadSettings();

      expect(applyFontSpy).toHaveBeenCalledWith(savedFontSettings);
    });

    it('should handle null state gracefully', () => {
      vi.mocked(deps.loadState).mockReturnValue(null);

      expect(() => coordinator.loadSettings()).not.toThrow();
    });

    it('should not throw when loadState throws', () => {
      vi.mocked(deps.loadState).mockImplementation(() => {
        throw new Error('Load error');
      });

      expect(() => coordinator.loadSettings()).not.toThrow();
    });
  });

  describe('saveSettings', () => {
    it('should save current settings and font settings to state', () => {
      const currentSettings = { theme: 'dark' };
      const fontSettings = { fontFamily: 'monospace', fontSize: 14 };
      vi.mocked(deps.getCurrentSettings).mockReturnValue(currentSettings as any);
      vi.mocked(deps.fontSettingsGetCurrentSettings).mockReturnValue(fontSettings as any);

      coordinator.saveSettings();

      expect(deps.saveState).toHaveBeenCalledWith(
        expect.objectContaining({
          settings: currentSettings,
          fontSettings: fontSettings,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not throw when saveState throws', () => {
      vi.mocked(deps.saveState).mockImplementation(() => {
        throw new Error('Save error');
      });

      expect(() => coordinator.saveSettings()).not.toThrow();
    });
  });

  describe('applyFontSettings', () => {
    it('should delegate to fontSettingsUpdateSettings with split terminals', () => {
      const fontSettings = { fontFamily: 'Fira Code', fontSize: 16 } as any;
      const terminals = new Map([['t-1', { terminal: {} }]]) as any;
      vi.mocked(deps.getSplitTerminals).mockReturnValue(terminals);

      coordinator.applyFontSettings(fontSettings);

      expect(deps.fontSettingsUpdateSettings).toHaveBeenCalledWith(fontSettings, terminals);
    });

    it('should not throw on error', () => {
      vi.mocked(deps.fontSettingsUpdateSettings).mockImplementation(() => {
        throw new Error('Font error');
      });

      expect(() =>
        coordinator.applyFontSettings({ fontFamily: 'monospace' } as any)
      ).not.toThrow();
    });
  });

  describe('getCurrentFontSettings', () => {
    it('should return current font settings from service', () => {
      const expected = { fontFamily: 'Fira Code', fontSize: 16 } as any;
      vi.mocked(deps.fontSettingsGetCurrentSettings).mockReturnValue(expected);

      const result = coordinator.getCurrentFontSettings();

      expect(result).toBe(expected);
    });
  });

  describe('openSettings', () => {
    it('should show settings panel with merged settings', () => {
      const current = { theme: 'dark', fontSize: 14 };
      const base = { theme: 'auto', fontSize: 12, lineHeight: 1.2 };
      vi.mocked(deps.getCurrentSettings).mockReturnValue(current as any);
      vi.mocked(deps.configManagerGetCurrentSettings).mockReturnValue(base as any);

      coordinator.openSettings();

      expect(deps.settingsPanelSetVersionInfo).toHaveBeenCalledWith('v0.1.0');
      expect(deps.settingsPanelShow).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: 'dark',
          fontSize: 14,
          lineHeight: 1.2,
        })
      );
    });

    it('should not open when settings panel is not initialized', () => {
      vi.mocked(deps.hasSettingsPanel).mockReturnValue(false);

      coordinator.openSettings();

      expect(deps.settingsPanelShow).not.toHaveBeenCalled();
    });

    it('should use current settings as base when ConfigManager is not available', () => {
      vi.mocked(deps.hasConfigManager).mockReturnValue(false);
      vi.mocked(deps.getCurrentSettings).mockReturnValue({ theme: 'dark' } as any);

      coordinator.openSettings();

      expect(deps.settingsPanelShow).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' })
      );
    });

    it('should not throw on error', () => {
      vi.mocked(deps.hasSettingsPanel).mockImplementation(() => {
        throw new Error('Panel error');
      });

      expect(() => coordinator.openSettings()).not.toThrow();
    });
  });

  describe('updateAllTerminalThemes', () => {
    it('should update theme for all terminals with terminal instances', () => {
      const mockTerminal = { options: { theme: null as any } };
      const mockContainer = document.createElement('div');
      const xtermDiv = document.createElement('div');
      xtermDiv.classList.add('xterm');
      mockContainer.appendChild(xtermDiv);

      const terminals = new Map([
        ['t-1', { terminal: mockTerminal, container: mockContainer }],
      ]) as any;
      vi.mocked(deps.getSplitTerminals).mockReturnValue(terminals);

      const theme = { background: '#000000', foreground: '#ffffff' } as any;
      coordinator.updateAllTerminalThemes(theme);

      expect(mockTerminal.options.theme).toBe(theme);
      expect(mockContainer.style.backgroundColor).toBe('#000000');
    });

    it('should skip terminals without terminal instance', () => {
      const terminals = new Map([['t-1', { terminal: null, container: null }]]) as any;
      vi.mocked(deps.getSplitTerminals).mockReturnValue(terminals);

      expect(() =>
        coordinator.updateAllTerminalThemes({ background: '#000' } as any)
      ).not.toThrow();
    });

    it('should not throw on error', () => {
      vi.mocked(deps.getSplitTerminals).mockImplementation(() => {
        throw new Error('Theme error');
      });

      expect(() =>
        coordinator.updateAllTerminalThemes({ background: '#000' } as any)
      ).not.toThrow();
    });
  });
});
