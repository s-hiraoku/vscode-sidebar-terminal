/**
 * ConfigManager Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { ConfigManager, getConfigManager } from '../../../../config/ConfigManager';

describe('ConfigManager', () => {
  let mockWorkspaceConfiguration: {
    get: ReturnType<typeof vi.fn>;
    has: ReturnType<typeof vi.fn>;
    inspect: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let configManager: ConfigManager;

  beforeEach(() => {
    // Clear singleton instance before creating new mocks
    const configManagerClass = ConfigManager as unknown as { _instance: ConfigManager | undefined };
    configManagerClass._instance = undefined;

    mockWorkspaceConfiguration = {
      get: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    };

    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue(
      mockWorkspaceConfiguration as unknown as vscode.WorkspaceConfiguration
    );

    configManager = getConfigManager();
  });

  afterEach(() => {
    // Clear singleton before restoring mocks
    const configManagerClass = ConfigManager as unknown as { _instance: ConfigManager | undefined };
    configManagerClass._instance = undefined;

    vi.restoreAllMocks();
  });

  describe('getExtensionTerminalConfig', () => {
    it('should return terminal configuration with defaults', () => {
      // Setup default values - need to return the default value when called with default parameter
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
        return defaultValue; // Return the default value passed by the ConfigManager
      });

      const config = configManager.getExtensionTerminalConfig();

      expect(config).toHaveProperty('maxTerminals', 5);
      expect(config).toHaveProperty('shell', '');
      expect(config).toHaveProperty('fontFamily', 'monospace');
      expect(config).toHaveProperty('fontSize', 14);
      expect(config).toHaveProperty('cursorBlink', true);
    });

    it('should return user-configured values', () => {
      // Setup specific values
      mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
        const values: Record<string, any> = {
          maxTerminals: 3,
          shell: '/bin/zsh',
          fontSize: 16,
          fontFamily: 'Courier New',
        };
        return values[key];
      });

      const config = configManager.getExtensionTerminalConfig();

      expect(config.maxTerminals).toBe(3);
      expect(config.shell).toBe('/bin/zsh');
      expect(config.fontSize).toBe(16);
      expect(config.fontFamily).toBe('Courier New');
    });

    it('should handle partial configuration', () => {
      // Only some values configured with proper default handling
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'maxTerminals') return 10;
        return defaultValue; // Return default for undefined keys
      });

      const config = configManager.getExtensionTerminalConfig();

      expect(config.maxTerminals).toBe(10);
      expect(config.shell).toBe('');
      expect(config.fontSize).toBe(14); // default
    });
  });

  describe('onConfigurationChange', () => {
    it('should register configuration change listener', () => {
      const callback = vi.fn();
      const mockDisposable = { dispose: vi.fn() };

      vi.spyOn(vscode.workspace, 'onDidChangeConfiguration').mockReturnValue(mockDisposable);

      const disposable = configManager.onConfigurationChange(callback);

      expect(disposable).toBe(mockDisposable);
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalledWith(callback);
    });
  });

  describe('clearCache', () => {
    it('should clear configuration cache', () => {
      // First get a config to populate cache
      mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
        if (key === 'maxTerminals') return 5;
        return undefined;
      });
      configManager.getExtensionTerminalConfig();

      // Verify cache has data
      const cacheInfo = configManager.getCacheInfo();
      expect(cacheInfo.size).toBeGreaterThan(0);

      // Clear cache
      configManager.clearCache();

      // Verify cache is empty
      const clearedCacheInfo = configManager.getCacheInfo();
      expect(clearedCacheInfo.size).toBe(0);
    });
  });

  describe('getCompleteTerminalSettings', () => {
    it('should return complete terminal settings with alt-click configuration', () => {
      mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
        const values: Record<string, any> = {
          altClickMovesCursor: true,
          multiCursorModifier: 'alt',
        };
        return values[key];
      });

      const settings = configManager.getCompleteTerminalSettings();

      expect(settings).toHaveProperty('altClickMovesCursor', true);
      expect(settings).toHaveProperty('multiCursorModifier', 'alt');
      expect(settings).toHaveProperty('confirmBeforeKill');
      expect(settings).toHaveProperty('protectLastTerminal');
    });
  });

  describe('getShellForPlatform', () => {
    it('should return platform-specific shell', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
        if (key === 'shell.windows') return 'powershell.exe';
        return undefined;
      });
      expect(configManager.getShellForPlatform()).toBe('powershell.exe');

      // Test macOS
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
        if (key === 'shell.osx') return '/bin/zsh';
        return undefined;
      });
      expect(configManager.getShellForPlatform()).toBe('/bin/zsh');

      // Test Linux
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      mockWorkspaceConfiguration.get.mockImplementation((key: string) => {
        if (key === 'shell.linux') return '/bin/bash';
        return undefined;
      });
      expect(configManager.getShellForPlatform()).toBe('/bin/bash');

      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });
  });
});
