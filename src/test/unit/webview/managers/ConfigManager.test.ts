/**
 * ConfigManager Test Suite - Settings management, validation, and persistence
 *
 * TDD Pattern: Covers settings loading, saving, validation, and normalization
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';

// Mock VS Code API
const mockVscodeState: Record<string, unknown> = {};
(global as any).vscode = {
  getState: () => mockVscodeState,
  setState: (state: unknown) => Object.assign(mockVscodeState, state),
};

import { ConfigManager } from '../../../../webview/managers/ConfigManager';
import { PartialTerminalSettings, WebViewFontSettings } from '../../../../types/shared';

describe('ConfigManager', () => {
  let configManager: ConfigManager;

  beforeEach(() => {
    // Reset mock state
    Object.keys(mockVscodeState).forEach((key) => delete mockVscodeState[key]);

    configManager = new ConfigManager();
  });

  afterEach(() => {
    configManager.dispose();
    sinon.restore();
  });

  describe('Initialization', () => {
    it('should create instance correctly', () => {
      expect(configManager).to.be.instanceOf(ConfigManager);
    });

    it('should have default settings', () => {
      const settings = configManager.getCurrentSettings();
      expect(settings).to.exist;
      expect(settings.fontSize).to.equal(14);
      expect(settings.theme).to.equal('auto');
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

      expect(settings.fontSize).to.equal(18);
      expect(settings.fontFamily).to.equal('JetBrains Mono');
      expect(settings.theme).to.equal('dark');
    });

    it('should use defaults when no saved settings exist', () => {
      const settings = configManager.loadSettings();

      expect(settings.fontSize).to.equal(14);
      expect(settings.theme).to.equal('auto');
    });

    it('should handle corrupted state gracefully', () => {
      (global as any).vscode.getState = () => {
        throw new Error('State corrupted');
      };

      const settings = configManager.loadSettings();

      // Should return defaults on error
      expect(settings.fontSize).to.equal(14);
      expect(settings.theme).to.equal('auto');

      // Restore normal behavior
      (global as any).vscode.getState = () => mockVscodeState;
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

      expect(mockVscodeState.terminalSettings).to.exist;
      expect((mockVscodeState.terminalSettings as PartialTerminalSettings).fontSize).to.equal(16);
    });

    it('should validate settings before saving', () => {
      const invalidSettings: PartialTerminalSettings = {
        fontSize: 5, // Too small (min 8)
        scrollback: -100, // Invalid
      };

      configManager.saveSettings(invalidSettings);

      const saved = mockVscodeState.terminalSettings as PartialTerminalSettings;
      expect(saved.fontSize).to.equal(14); // Should fall back to default
      expect(saved.scrollback).to.equal(2000); // Should fall back to default
    });

    it('should handle save errors gracefully', () => {
      (global as any).vscode.setState = () => {
        throw new Error('Save failed');
      };

      // Should not throw
      expect(() => {
        configManager.saveSettings({ fontSize: 16 });
      }).to.not.throw();

      // Restore normal behavior
      (global as any).vscode.setState = (state: unknown) =>
        Object.assign(mockVscodeState, state);
    });
  });

  describe('Settings Validation', () => {
    it('should validate fontSize within range', () => {
      const settings = configManager.loadSettings();

      // Too small
      configManager.saveSettings({ fontSize: 4 });
      expect(configManager.getCurrentSettings().fontSize).to.equal(14);

      // Too large
      configManager.saveSettings({ fontSize: 100 });
      expect(configManager.getCurrentSettings().fontSize).to.equal(14);

      // Valid range
      configManager.saveSettings({ fontSize: 20 });
      expect(configManager.getCurrentSettings().fontSize).to.equal(20);
    });

    it('should validate theme values', () => {
      // Valid themes
      configManager.saveSettings({ theme: 'dark' });
      expect(configManager.getCurrentSettings().theme).to.equal('dark');

      configManager.saveSettings({ theme: 'light' });
      expect(configManager.getCurrentSettings().theme).to.equal('light');

      configManager.saveSettings({ theme: 'auto' });
      expect(configManager.getCurrentSettings().theme).to.equal('auto');

      // Invalid theme
      configManager.saveSettings({ theme: 'invalid' as any });
      expect(configManager.getCurrentSettings().theme).to.equal('auto');
    });

    it('should validate scrollback range', () => {
      // Valid scrollback
      configManager.saveSettings({ scrollback: 5000 });
      expect(configManager.getCurrentSettings().scrollback).to.equal(5000);

      // Too large
      configManager.saveSettings({ scrollback: 200000 });
      expect(configManager.getCurrentSettings().scrollback).to.equal(2000);

      // Negative
      configManager.saveSettings({ scrollback: -100 });
      expect(configManager.getCurrentSettings().scrollback).to.equal(2000);
    });

    it('should validate boolean settings', () => {
      configManager.saveSettings({ cursorBlink: true });
      expect(configManager.getCurrentSettings().cursorBlink).to.be.true;

      configManager.saveSettings({ cursorBlink: false });
      expect(configManager.getCurrentSettings().cursorBlink).to.be.false;

      // Non-boolean should use default
      configManager.saveSettings({ cursorBlink: 'yes' as any });
      expect(configManager.getCurrentSettings().cursorBlink).to.be.true;
    });

    it('should validate maxTerminals range', () => {
      // Valid range
      configManager.saveSettings({ maxTerminals: 3 });
      expect(configManager.getCurrentSettings().maxTerminals).to.equal(3);

      // Too small
      configManager.saveSettings({ maxTerminals: 0 });
      expect(configManager.getCurrentSettings().maxTerminals).to.equal(5);

      // Too large
      configManager.saveSettings({ maxTerminals: 20 });
      expect(configManager.getCurrentSettings().maxTerminals).to.equal(5);
    });

    it('should validate cursor settings', () => {
      configManager.saveSettings({
        cursor: { style: 'underline', blink: false },
      });

      const settings = configManager.getCurrentSettings();
      expect(settings.cursor?.style).to.equal('underline');
      expect(settings.cursor?.blink).to.be.false;
    });

    it('should validate cursor style values', () => {
      // Valid styles
      configManager.saveSettings({ cursor: { style: 'block', blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).to.equal('block');

      configManager.saveSettings({ cursor: { style: 'underline', blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).to.equal('underline');

      configManager.saveSettings({ cursor: { style: 'bar', blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).to.equal('bar');

      // Invalid style
      configManager.saveSettings({ cursor: { style: 'invalid' as any, blink: true } });
      expect(configManager.getCurrentSettings().cursor?.style).to.equal('block');
    });

    it('should validate multiCursorModifier', () => {
      configManager.saveSettings({ multiCursorModifier: 'ctrl' });
      expect(configManager.getCurrentSettings().multiCursorModifier).to.equal('ctrl');

      configManager.saveSettings({ multiCursorModifier: 'invalid' as any });
      expect(configManager.getCurrentSettings().multiCursorModifier).to.equal('alt');
    });

    it('should validate shell args as array', () => {
      configManager.saveSettings({ shellArgs: ['--login', '-i'] });
      expect(configManager.getCurrentSettings().shellArgs).to.deep.equal(['--login', '-i']);

      // Filter non-strings
      configManager.saveSettings({ shellArgs: ['valid', 123 as any, 'also-valid'] as any });
      const args = configManager.getCurrentSettings().shellArgs;
      expect(args).to.deep.equal(['valid', 'also-valid']);
    });
  });

  describe('Font Settings', () => {
    it('should get current font settings', () => {
      const fontSettings = configManager.getCurrentFontSettings();

      expect(fontSettings.fontSize).to.be.a('number');
      expect(fontSettings.fontFamily).to.be.a('string');
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
      expect(currentSettings.fontSize).to.equal(18);
      expect(currentSettings.fontFamily).to.equal('Fira Code');
    });

    it('should validate font settings', () => {
      const terminals = new Map();

      // Invalid font size
      configManager.applyFontSettings({ fontSize: 4, fontFamily: '' }, terminals);
      const settings = configManager.getCurrentFontSettings();
      expect(settings.fontSize).to.equal(14); // Default
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
      expect(fontSettings.fontSize).to.equal(20);
      expect(fontSettings.fontFamily).to.equal('Monaco');
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

      expect(mockTerminal1.options['cursorBlink']).to.be.true;
      expect(mockTerminal1.options['scrollback']).to.equal(5000);
      expect(mockTerminal2.options['cursorBlink']).to.be.true;
      expect(mockTerminal2.options['scrollback']).to.equal(5000);
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
      }).to.not.throw();
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

      expect(mockTerminal.options['altClickMovesCursor']).to.be.true;
    });

    it('should disable Alt+Click when modifier is not alt', () => {
      const mockTerminal = { options: {} as Record<string, unknown> };
      const terminals = new Map([['term-1', { terminal: mockTerminal }]]);

      configManager.updateAltClickSetting(terminals as any, {
        altClickMovesCursor: true,
        multiCursorModifier: 'ctrl',
      });

      expect(mockTerminal.options['altClickMovesCursor']).to.be.false;
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
      }).to.not.throw();
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

      expect(defaultSettings.fontSize).to.equal(14);
      expect(defaultSettings.theme).to.equal('auto');
      expect(defaultSettings.scrollback).to.equal(2000);
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

      expect(parsed.settings).to.exist;
      expect(parsed.settings.fontSize).to.equal(16);
      expect(parsed.fontSettings).to.exist;
      expect(parsed.timestamp).to.be.a('string');
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

      expect(imported.fontSize).to.equal(18);
      expect(imported.theme).to.equal('light');
      expect(imported.scrollback).to.equal(3000);
    });

    it('should validate imported settings', () => {
      const backup = JSON.stringify({
        settings: {
          fontSize: 4, // Invalid
          scrollback: -100, // Invalid
        },
      });

      const imported = configManager.importSettings(backup);

      expect(imported.fontSize).to.equal(14); // Default
      expect(imported.scrollback).to.equal(2000); // Default
    });

    it('should throw on invalid import format', () => {
      expect(() => {
        configManager.importSettings('{}');
      }).to.throw('Invalid settings format');

      expect(() => {
        configManager.importSettings('invalid json');
      }).to.throw();
    });
  });

  describe('Dispose', () => {
    it('should save settings on dispose', () => {
      configManager.saveSettings({ fontSize: 20 });
      configManager.dispose();

      // Settings should be saved
      expect((mockVscodeState.terminalSettings as PartialTerminalSettings).fontSize).to.equal(20);
    });
  });
});
