/**
 * ConfigManager Test Suite - Settings management, validation, and persistence
 *
 * TDD Pattern: Covers settings loading, saving, validation, and normalization
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../../../../webview/managers/ConfigManager';
import { PartialTerminalSettings, WebViewFontSettings } from '../../../../../types/shared';

// Mock VS Code API
const mockVscodeState: Record<string, unknown> = {};
(globalThis as any).vscode = {
  getState: () => mockVscodeState,
  setState: (state: unknown) => Object.assign(mockVscodeState, state),
};

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset mock state
    Object.keys(mockVscodeState).forEach((key) => delete mockVscodeState[key]);

    configManager = new ConfigManager();
  });

  afterEach(() => {
    configManager.dispose();
  });

  describe('Initialization', () => {
    it('should create instance correctly', () => {
      expect(configManager).toBeInstanceOf(ConfigManager);
    });

    it('should have default settings', () => {
      const settings = configManager.getCurrentSettings();
      expect(settings).toBeDefined();
      expect(settings.fontSize).toBe(14);
      expect(settings.theme).toBe('auto');
      expect(settings.enableTerminalHeaderEnhancements).toBe(true);
    });
  });

  describe('Settings Loading', () => {
    it('should load settings from VS Code state', () => {
      const savedSettings = {
        fontSize: 18,
        fontFamily: 'JetBrains Mono',
        theme: 'dark',
      };
      mockVscodeState.terminalSettings = savedSettings;

      const settings = configManager.loadSettings();

      expect(settings.fontSize).toBe(18);
      expect(settings.fontFamily).toBe('JetBrains Mono');
      expect(settings.theme).toBe('dark');
    });

    it('should use defaults when no saved settings exist', () => {
      const settings = configManager.loadSettings();

      expect(settings.fontSize).toBe(14);
      expect(settings.theme).toBe('auto');
    });

    it('should handle corrupted state gracefully', () => {
      (globalThis as any).vscode.getState = () => {
        throw new Error('State corrupted');
      };

      const settings = configManager.loadSettings();

      // Should return defaults on error
      expect(settings.fontSize).toBe(14);
      expect(settings.theme).toBe('auto');

      // Restore normal behavior
      (globalThis as any).vscode.getState = () => mockVscodeState;
    });
  });

  describe('Settings Saving', () => {
    it('should save settings to VS Code state', () => {
      const settings: PartialTerminalSettings = {
        fontSize: 16,
        fontFamily: 'Fira Code',
        theme: 'light',
      };

      configManager.saveSettings(settings);

      expect(mockVscodeState.terminalSettings).toBeDefined();
      expect((mockVscodeState.terminalSettings as PartialTerminalSettings).fontSize).toBe(16);
    });

    it('should validate settings before saving', () => {
      const invalidSettings: PartialTerminalSettings = {
        fontSize: 5, // Too small (min 8)
        scrollback: -100, // Invalid
      };

      configManager.saveSettings(invalidSettings);

      const saved = mockVscodeState.terminalSettings as PartialTerminalSettings;
      expect(saved.fontSize).toBe(14); // Should fall back to default
      expect(saved.scrollback).toBe(2000); // Should fall back to default
    });

    it('should handle save errors gracefully', () => {
      (globalThis as any).vscode.setState = () => {
        throw new Error('Save failed');
      };

      // Should not throw
      expect(() => {
        configManager.saveSettings({ fontSize: 16 });
      }).not.toThrow();

      // Restore normal behavior
      (globalThis as any).vscode.setState = (state: unknown) =>
        Object.assign(mockVscodeState, state);
    });
  });

  describe('Settings Validation', () => {
    it('should validate fontSize within range', () => {
      // Too small
      configManager.saveSettings({ fontSize: 4 });
      expect(configManager.getCurrentSettings().fontSize).toBe(14);

      // Too large
      configManager.saveSettings({ fontSize: 100 });
      expect(configManager.getCurrentSettings().fontSize).toBe(14);

      // Valid range
      configManager.saveSettings({ fontSize: 20 });
      expect(configManager.getCurrentSettings().fontSize).toBe(20);
    });

    it('should validate theme values', () => {
      // Valid themes
      configManager.saveSettings({ theme: 'dark' });
      expect(configManager.getCurrentSettings().theme).toBe('dark');

      configManager.saveSettings({ theme: 'light' });
      expect(configManager.getCurrentSettings().theme).toBe('light');

      configManager.saveSettings({ theme: 'auto' });
      expect(configManager.getCurrentSettings().theme).toBe('auto');

      // Invalid theme
      configManager.saveSettings({ theme: 'invalid' as any });
      expect(configManager.getCurrentSettings().theme).toBe('auto');
    });

    it('should validate scrollback range', () => {
      // Valid scrollback
      configManager.saveSettings({ scrollback: 5000 });
      expect(configManager.getCurrentSettings().scrollback).toBe(5000);

      // Too large
      configManager.saveSettings({ scrollback: 200000 });
      expect(configManager.getCurrentSettings().scrollback).toBe(2000);

      // Negative
      configManager.saveSettings({ scrollback: -100 });
      expect(configManager.getCurrentSettings().scrollback).toBe(2000);
    });

    it('should validate boolean settings', () => {
      configManager.saveSettings({ cursorBlink: true });
      expect(configManager.getCurrentSettings().cursorBlink).toBe(true);

      configManager.saveSettings({ cursorBlink: false });
      expect(configManager.getCurrentSettings().cursorBlink).toBe(false);

      // Non-boolean should use default
      configManager.saveSettings({ cursorBlink: 'yes' as any });
      expect(configManager.getCurrentSettings().cursorBlink).toBe(true);
    });

    it('should validate enableTerminalHeaderEnhancements setting', () => {
      configManager.saveSettings({ enableTerminalHeaderEnhancements: false });
      expect(configManager.getCurrentSettings().enableTerminalHeaderEnhancements).toBe(false);

      configManager.saveSettings({ enableTerminalHeaderEnhancements: 'no' as any });
      expect(configManager.getCurrentSettings().enableTerminalHeaderEnhancements).toBe(true);
    });

    it('should validate maxTerminals range', () => {
      // Valid range
      configManager.saveSettings({ maxTerminals: 3 });
      expect(configManager.getCurrentSettings().maxTerminals).toBe(3);

      // Too small
      configManager.saveSettings({ maxTerminals: 0 });
      expect(configManager.getCurrentSettings().maxTerminals).toBe(5);

      // Too large
      configManager.saveSettings({ maxTerminals: 20 });
      expect(configManager.getCurrentSettings().maxTerminals).toBe(5);
    });

    it('should validate cursor settings', () => {
      configManager.saveSettings({
        cursor: { style: 'underline', blink: false },
      });

      const settings = configManager.getCurrentSettings();
      expect(settings.cursor?.style).toBe('underline');
      expect(settings.cursor?.blink).toBe(false);
    });

    it('should validate cursor style values', () => {
      // Valid styles
      configManager.saveSettings({ cursor: { style: 'block', blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).toBe('block');

      configManager.saveSettings({ cursor: { style: 'underline', blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).toBe('underline');

      configManager.saveSettings({ cursor: { style: 'bar', blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).toBe('bar');

      // Invalid style
      configManager.saveSettings({ cursor: { style: 'invalid' as any, blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).toBe('block');
    });

    it('should validate multiCursorModifier', () => {
      configManager.saveSettings({ multiCursorModifier: 'ctrl' });
      expect(configManager.getCurrentSettings().multiCursorModifier).toBe('ctrl');

      configManager.saveSettings({ multiCursorModifier: 'invalid' as any });
      expect(configManager.getCurrentSettings().multiCursorModifier).toBe('alt');
    });

    it('should validate shell args as array', () => {
      configManager.saveSettings({ shellArgs: ['--login', '-i'] });
      expect(configManager.getCurrentSettings().shellArgs).toEqual(['--login', '-i']);

      // Filter non-strings
      configManager.saveSettings({ shellArgs: ['valid', 123 as any, 'also-valid'] as any });
      const args = configManager.getCurrentSettings().shellArgs;
      expect(args).toEqual(['valid', 'also-valid']);
    });
  });

  describe('Font Settings', () => {
    it('should get current font settings', () => {
      const fontSettings = configManager.getCurrentFontSettings();

      expect(typeof fontSettings.fontSize).toBe('number');
      expect(typeof fontSettings.fontFamily).toBe('string');
    });

    it('should apply font settings', () => {
      const terminals = new Map();
      const mockTerminal = {
        terminal: { options: {} },
      };
      terminals.set('test-1', mockTerminal);

      const fontSettings: WebViewFontSettings = {
        fontSize: 18,
        fontFamily: 'Fira Code',
      };

      configManager.applyFontSettings(fontSettings, terminals);

      const currentSettings = configManager.getCurrentSettings();
      expect(currentSettings.fontSize).toBe(18);
      expect(currentSettings.fontFamily).toBe('Fira Code');
    });

    it('should validate font settings', () => {
      const terminals = new Map();

      // Invalid font size
      configManager.applyFontSettings({ fontSize: 4, fontFamily: '' }, terminals);
      const settings = configManager.getCurrentFontSettings();
      expect(settings.fontSize).toBe(14); // Default
    });

    it('should set font settings service', () => {
      const mockFontSettingsService = {
        getCurrentSettings: () => ({
          fontSize: 20,
          fontFamily: 'Monaco',
        }),
      };

      configManager.setFontSettingsService(mockFontSettingsService as any);

      const fontSettings = configManager.getCurrentFontSettings();
      expect(fontSettings.fontSize).toBe(20);
      expect(fontSettings.fontFamily).toBe('Monaco');
    });
  });

  describe('Apply Settings to Terminals', () => {
    it('should apply settings to all terminals', () => {
      const mockTerminal1 = { options: {} as Record<string, unknown> };
      const mockTerminal2 = { options: {} as Record<string, unknown> };
      const terminals = new Map([
        ['term-1', { terminal: mockTerminal1 }],
        ['term-2', { terminal: mockTerminal2 }],
      ]);

      const settings: PartialTerminalSettings = {
        cursorBlink: true,
        scrollback: 5000,
      };

      configManager.applySettings(settings, terminals as any);

      expect(mockTerminal1.options['cursorBlink']).toBe(true);
      expect(mockTerminal1.options['scrollback']).toBe(5000);
      expect(mockTerminal2.options['cursorBlink']).toBe(true);
      expect(mockTerminal2.options['scrollback']).toBe(5000);
    });

    it('should handle terminal apply errors gracefully', () => {
      const badTerminal = {
        get options() {
          throw new Error('Terminal error');
        },
      };
      const terminals = new Map([['term-1', { terminal: badTerminal }]]);

      expect(() => {
        configManager.applySettings({ scrollback: 1000 }, terminals as any);
      }).not.toThrow();
    });
  });

  describe('Alt+Click Setting', () => {
    it('should update Alt+Click setting for terminals', () => {
      const mockTerminal = { options: {} as Record<string, unknown> };
      const terminals = new Map([['term-1', { terminal: mockTerminal }]]);

      configManager.updateAltClickSetting(terminals as any, {
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });

      expect(mockTerminal.options['altClickMovesCursor']).toBe(true);
    });

    it('should disable Alt+Click when modifier is not alt', () => {
      const mockTerminal = { options: {} as Record<string, unknown> };
      const terminals = new Map([['term-1', { terminal: mockTerminal }]]);

      configManager.updateAltClickSetting(terminals as any, {
        altClickMovesCursor: true,
        multiCursorModifier: 'ctrl',
      });

      expect(mockTerminal.options['altClickMovesCursor']).toBe(false);
    });

    it('should handle update errors gracefully', () => {
      const badTerminal = {
        get options() {
          throw new Error('Terminal error');
        },
      };
      const terminals = new Map([['term-1', { terminal: badTerminal }]]);

      expect(() => {
        configManager.updateAltClickSetting(terminals as any, {
          altClickMovesCursor: true,
        });
      }).not.toThrow();
    });
  });

  describe('Reset to Defaults', () => {
    it('should reset all settings to defaults', () => {
      // First save custom settings
      configManager.saveSettings({
        fontSize: 20,
        theme: 'light',
        scrollback: 10000,
      });

      // Reset
      const defaultSettings = configManager.resetToDefaults();

      expect(defaultSettings.fontSize).toBe(14);
      expect(defaultSettings.theme).toBe('auto');
      expect(defaultSettings.scrollback).toBe(2000);
    });
  });

  describe('Export and Import', () => {
    it('should export settings as JSON', () => {
      configManager.saveSettings({
        fontSize: 16,
        theme: 'dark',
      });

      const exported = configManager.exportSettings();
      const parsed = JSON.parse(exported);

      expect(parsed.settings).toBeDefined();
      expect(parsed.settings.fontSize).toBe(16);
      expect(parsed.fontSettings).toBeDefined();
      expect(typeof parsed.timestamp).toBe('string');
    });

    it('should import settings from JSON', () => {
      const backup = JSON.stringify({
        settings: {
          fontSize: 18,
          theme: 'light',
          scrollback: 3000,
        },
      });

      const imported = configManager.importSettings(backup);

      expect(imported.fontSize).toBe(18);
      expect(imported.theme).toBe('light');
      expect(imported.scrollback).toBe(3000);
    });

    it('should validate imported settings', () => {
      const backup = JSON.stringify({
        settings: {
          fontSize: 4, // Invalid
          scrollback: -100, // Invalid
        },
      });

      const imported = configManager.importSettings(backup);

      expect(imported.fontSize).toBe(14); // Default
      expect(imported.scrollback).toBe(2000); // Default
    });

    it('should throw on invalid import format', () => {
      expect(() => {
        configManager.importSettings('{}');
      }).toThrow('Invalid settings format');

      expect(() => {
        configManager.importSettings('invalid json');
      }).toThrow();
    });
  });

  describe('Dispose', () => {
    it('should save settings on dispose', () => {
      configManager.saveSettings({ fontSize: 20 });
      configManager.dispose();

      // Settings should be saved
      expect((mockVscodeState.terminalSettings as PartialTerminalSettings).fontSize).toBe(20);
    });
  });
});
