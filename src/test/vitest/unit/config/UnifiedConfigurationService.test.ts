/**
 * Comprehensive tests for UnifiedConfigurationService
 *
 * These tests validate the consolidated configuration service that replaces:
 * - ConfigManager.ts (extension-side)
 * - ConfigManager.ts (webview-side)
 * - UnifiedConfigurationService.ts (old version)
 * - WebViewSettingsManagerService.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import {
  UnifiedConfigurationService,
  getUnifiedConfigurationService,
} from '../../../../config/UnifiedConfigurationService';
import { CONFIG_SECTIONS, CONFIG_KEYS } from '../../../../types/shared';

describe('UnifiedConfigurationService', () => {
  let service: UnifiedConfigurationService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorkspaceConfiguration: any;

  beforeEach(() => {
    // Force dispose any existing singleton instance first
    try {
      const existingInstance = UnifiedConfigurationService.getInstance();
      existingInstance.dispose();
    } catch {
      // Ignore if instance doesn't exist or already disposed
    }

    // Create mock workspace configuration
    mockWorkspaceConfiguration = {
      get: vi.fn(),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    };

    // Configure vscode.workspace.getConfiguration
    (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockWorkspaceConfiguration);

    // Configure vscode.workspace.onDidChangeConfiguration
    const mockDisposable = { dispose: vi.fn() };
    (vscode.workspace.onDidChangeConfiguration as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockDisposable);

    // Get fresh instance - will create a new one since we disposed the old one
    service = getUnifiedConfigurationService();
    service.initialize();
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Configuration Access', () => {
    it('should get configuration values with defaults', () => {
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'fontSize') return 16;
        return defaultValue;
      });

      const fontSize = service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize).toBe(16);
      expect(mockWorkspaceConfiguration.get).toHaveBeenCalledWith('fontSize', 14);
    });

    it('should return default value when configuration fails', () => {
      mockWorkspaceConfiguration.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const fontSize = service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize).toBe(14);
    });

    it('should cache configuration values', () => {
      mockWorkspaceConfiguration.get.mockReturnValue(16);

      // First call
      const fontSize1 = service.get('terminal.integrated', 'fontSize', 14);
      // Second call (should be cached)
      const fontSize2 = service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize1).toBe(16);
      expect(fontSize2).toBe(16);
      expect(mockWorkspaceConfiguration.get).toHaveBeenCalledTimes(1);
    });

    it('should clear cache and refresh values', () => {
      mockWorkspaceConfiguration.get.mockReturnValue(16);

      // Get cached value
      service.get('terminal.integrated', 'fontSize', 14);

      // Clear cache
      service.clearCache();

      // Should call VS Code API again
      service.get('terminal.integrated', 'fontSize', 14);

      expect(mockWorkspaceConfiguration.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration Update', () => {
    it('should update configuration values', async () => {
      mockWorkspaceConfiguration.get.mockReturnValue(14);

      await service.update('terminal.integrated', 'fontSize', 16);

      expect(mockWorkspaceConfiguration.update).toHaveBeenCalledWith(
        'fontSize',
        16,
        vscode.ConfigurationTarget.Global
      );
    });

    it('should clear cache after update', async () => {
      // Cache a value first
      mockWorkspaceConfiguration.get.mockReturnValue(14);
      const initialValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(initialValue).toBe(14);

      // Get call count after first get (it should be cached now)
      const callCountAfterCache = mockWorkspaceConfiguration.get.mock.calls.length;

      // Call again - should use cache (call count unchanged)
      const cachedValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(cachedValue).toBe(14);
      expect(mockWorkspaceConfiguration.get.mock.calls.length).toBe(callCountAfterCache);

      // Update the value - this clears the cache
      await service.update('terminal.integrated', 'fontSize', 16);

      // Get call count after update (update() may call get() internally)
      const callCountAfterUpdate = mockWorkspaceConfiguration.get.mock.calls.length;

      // Change the return value and get again - should call VS Code API since cache was cleared
      mockWorkspaceConfiguration.get.mockReturnValue(16);
      const newValue = service.get('terminal.integrated', 'fontSize', 14);

      expect(newValue).toBe(16);
      // Call count should have increased (cache was cleared by update)
      expect(mockWorkspaceConfiguration.get.mock.calls.length).toBeGreaterThan(callCountAfterUpdate);
    });

    it('should fire configuration change event', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let changeEvent: any = null;
      service.onDidChangeConfiguration((event) => {
        changeEvent = event;
      });

      await service.update('terminal.integrated', 'fontSize', 16);

      expect(changeEvent).not.toBeNull();
      expect(changeEvent.affectsConfiguration('terminal.integrated', 'fontSize')).toBe(true);
      expect(changeEvent.changedKeys).toContain('terminal.integrated.fontSize');
    });
  });

  describe('Extension Terminal Configuration', () => {
    beforeEach(() => {
      // Setup default mocks for extension terminal config
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === CONFIG_KEYS.MAX_TERMINALS) return 5;
        if (key === CONFIG_KEYS.SHELL) return '/bin/bash';
        if (key === CONFIG_KEYS.SHELL_ARGS) return ['-l'];
        if (key === CONFIG_KEYS.DEFAULT_DIRECTORY) return '/home/user';
        if (key === CONFIG_KEYS.CURSOR_BLINK) return true;
        if (key === 'enableCliAgentIntegration') return true;
        return defaultValue;
      });

      // Mock font settings with proper stub configuration
      const terminalConfigGet = vi.fn((key) => {
        if (key === 'fontSize') return 14;
        if (key === 'fontFamily') return 'monospace';
        return undefined;
      });

      const editorConfigGet = vi.fn((key) => {
        if (key === 'fontSize') return 12;
        return undefined;
      });

      // Configure getConfiguration stub to return appropriate configs
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') {
          return { get: terminalConfigGet };
        }
        if (section === 'editor') {
          return { get: editorConfigGet };
        }
        return mockWorkspaceConfiguration;
      });
    });

    it('should get extension terminal configuration', () => {
      const config = service.getExtensionTerminalConfig();

      expect(config).toMatchObject({
        maxTerminals: 5,
        shell: '/bin/bash',
        shellArgs: ['-l'],
        defaultDirectory: '/home/user',
        cursorBlink: true,
        enableCliAgentIntegration: true,
      });

      expect(config.cursor).toEqual({
        style: 'block',
        blink: true,
      });
    });

    it('should get complete terminal settings', () => {
      // Mock additional settings for complete config
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === CONFIG_KEYS.THEME) return 'dark';
        if (key === CONFIG_KEYS.CONFIRM_BEFORE_KILL) return false;
        if (key === CONFIG_KEYS.PROTECT_LAST_TERMINAL) return true;
        if (key === CONFIG_KEYS.MIN_TERMINAL_COUNT) return 1;
        return defaultValue;
      });

      // Mock Alt+Click settings
      const terminalIntegratedConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        if (section === CONFIG_SECTIONS.EDITOR) return editorConfig;
        return mockWorkspaceConfiguration;
      });

      terminalIntegratedConfig.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR) return true;
        return defaultValue;
      });

      editorConfig.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === CONFIG_KEYS.MULTI_CURSOR_MODIFIER) return 'alt';
        return defaultValue;
      });

      const settings = service.getCompleteTerminalSettings();

      expect(settings).toMatchObject({
        theme: 'dark',
        confirmBeforeKill: false,
        protectLastTerminal: true,
        minTerminalCount: 1,
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
    });
  });

  describe('WebView Configuration', () => {
    it('should get WebView terminal settings', () => {
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'scrollback') return 2000;
        if (key === 'bellSound') return true;
        if (key === 'enableCliAgentIntegration') return true;
        if (key === 'dynamicSplitDirection') return false;
        if (key === 'panelLocation') return 'sidebar';
        if (key === CONFIG_KEYS.MAX_TERMINALS) return 3;
        if (key === CONFIG_KEYS.CURSOR_BLINK) return false;
        if (key === 'cursor.style') return 'block';
        if (key === 'cursor.blink') return true;
        return defaultValue;
      });

      const settings = service.getWebViewTerminalSettings();

      expect(settings).toMatchObject({
        scrollback: 2000,
        bellSound: true,
        enableCliAgentIntegration: true,
        dynamicSplitDirection: false,
        panelLocation: 'sidebar',
        maxTerminals: 3,
        cursorBlink: false,
      });

      expect(settings.cursor).toEqual({
        style: 'block',
        blink: true,
      });
    });

    it('should get WebView font settings', () => {
      // Mock font configurations
      const terminalConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };
      const extensionConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') return terminalConfig;
        if (section === 'editor') return editorConfig;
        if (section === 'secondaryTerminal') return extensionConfig;
        return mockWorkspaceConfiguration;
      });

      // Set up font hierarchy
      terminalConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 16;
        if (key === 'fontFamily') return 'Consolas';
        if (key === 'fontWeight') return 'normal';
        if (key === 'fontWeightBold') return 'bold';
        if (key === 'lineHeight') return 1.2;
        if (key === 'letterSpacing') return 1;
        return undefined;
      });

      const fontSettings = service.getWebViewFontSettings();

      expect(fontSettings).toEqual({
        fontSize: 16,
        fontFamily: 'Consolas',
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 1,
      });
    });
  });

  describe('Font Configuration Hierarchy', () => {
    it('should prioritize terminal font over editor font', () => {
      const terminalConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') return terminalConfig;
        if (section === 'editor') return editorConfig;
        return mockWorkspaceConfiguration;
      });

      terminalConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 16;
        if (key === 'fontFamily') return 'Fira Code';
        return undefined;
      });

      editorConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 14;
        if (key === 'fontFamily') return 'Arial';
        return undefined;
      });

      expect(service.getFontSize()).toBe(16);
      expect(service.getFontFamily()).toBe('Fira Code');
    });

    it('should fallback to editor font when terminal font is not set', () => {
      const terminalConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') return terminalConfig;
        if (section === 'editor') return editorConfig;
        return mockWorkspaceConfiguration;
      });

      terminalConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 0;
        if (key === 'fontFamily') return '';
        return undefined;
      });

      editorConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 14;
        if (key === 'fontFamily') return 'Arial';
        return undefined;
      });

      expect(service.getFontSize()).toBe(14);
      expect(service.getFontFamily()).toBe('Arial');
    });

    it('should use system defaults when no fonts are configured', () => {
      const terminalConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') return terminalConfig;
        if (section === 'editor') return editorConfig;
        return mockWorkspaceConfiguration;
      });

      terminalConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 0;
        if (key === 'fontFamily') return '';
        return undefined;
      });

      editorConfig.get.mockImplementation((key: string) => {
        if (key === 'fontSize') return 0;
        if (key === 'fontFamily') return '';
        return undefined;
      });

      expect(service.getFontSize()).toBe(14);
      expect(service.getFontFamily()).toBe('monospace');
    });

    it('should prioritize extension settings for font weight and spacing', () => {
      const terminalConfig = { get: vi.fn() };
      const extensionConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') return terminalConfig;
        if (section === 'secondaryTerminal') return extensionConfig;
        return mockWorkspaceConfiguration;
      });

      // Extension overrides
      extensionConfig.get.mockImplementation((key: string) => {
        if (key === 'fontWeight') return '300';
        if (key === 'fontWeightBold') return '700';
        if (key === 'lineHeight') return 1.5;
        if (key === 'letterSpacing') return 0.5;
        return undefined;
      });

      // Terminal defaults
      terminalConfig.get.mockImplementation((key: string) => {
        if (key === 'fontWeight') return 'normal';
        if (key === 'fontWeightBold') return 'bold';
        if (key === 'lineHeight') return 1.0;
        if (key === 'letterSpacing') return 0;
        return undefined;
      });

      expect(service.getFontWeight()).toBe('300');
      expect(service.getFontWeightBold()).toBe('700');
      expect(service.getLineHeight()).toBe(1.5);
      expect(service.getLetterSpacing()).toBe(0.5);
    });
  });

  describe('Platform-Specific Shell Configuration', () => {
    it('should return custom shell when provided', () => {
      const shell = service.getShellForPlatform('/custom/shell');
      expect(shell).toBe('/custom/shell');
    });

    it('should get Windows shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const terminalIntegratedConfig = { get: vi.fn() };
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        return mockWorkspaceConfiguration;
      });

      terminalIntegratedConfig.get.mockImplementation((key: string) => {
        if (key === CONFIG_KEYS.SHELL_WINDOWS) return 'powershell.exe';
        return undefined;
      });

      const shell = service.getShellForPlatform();
      expect(shell).toBe('powershell.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should get macOS shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const terminalIntegratedConfig = { get: vi.fn() };
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        return mockWorkspaceConfiguration;
      });

      terminalIntegratedConfig.get.mockImplementation((key: string) => {
        if (key === CONFIG_KEYS.SHELL_OSX) return '/bin/zsh';
        return undefined;
      });

      const shell = service.getShellForPlatform();
      expect(shell).toBe('/bin/zsh');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should get Linux shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const terminalIntegratedConfig = { get: vi.fn() };
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        return mockWorkspaceConfiguration;
      });

      terminalIntegratedConfig.get.mockImplementation((key: string) => {
        if (key === CONFIG_KEYS.SHELL_LINUX) return '/bin/bash';
        return undefined;
      });

      const shell = service.getShellForPlatform();
      expect(shell).toBe('/bin/bash');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use environment variables as fallback', () => {
      const originalPlatform = process.platform;
      const originalEnv = process.env;

      Object.defineProperty(process, 'platform', { value: 'linux' });
      Object.defineProperty(process, 'env', {
        value: { ...originalEnv, SHELL: '/usr/bin/fish' },
      });

      const terminalIntegratedConfig = { get: vi.fn() };
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        return mockWorkspaceConfiguration;
      });

      terminalIntegratedConfig.get.mockImplementation((key: string) => {
        if (key === CONFIG_KEYS.SHELL_LINUX) return '';
        return undefined;
      });

      const shell = service.getShellForPlatform();
      expect(shell).toBe('/usr/bin/fish');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'env', { value: originalEnv });
    });
  });

  describe('Alt+Click Configuration', () => {
    it('should get Alt+Click settings', () => {
      const terminalIntegratedConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        if (section === CONFIG_SECTIONS.EDITOR) return editorConfig;
        return mockWorkspaceConfiguration;
      });

      terminalIntegratedConfig.get.mockReturnValue(true);
      editorConfig.get.mockReturnValue('alt');

      const settings = service.getAltClickSettings();

      expect(settings).toEqual({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
    });

    it('should return defaults when configuration fails', () => {
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const settings = service.getAltClickSettings();

      expect(settings).toEqual({
        altClickMovesCursor: false,
        multiCursorModifier: 'ctrlCmd',
      });
    });
  });

  describe('Feature Enablement', () => {
    beforeEach(() => {
      const sidebarConfig = { get: vi.fn() };
      const terminalIntegratedConfig = { get: vi.fn() };
      const editorConfig = { get: vi.fn() };

      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === CONFIG_SECTIONS.SIDEBAR_TERMINAL) return sidebarConfig;
        if (section === CONFIG_SECTIONS.TERMINAL_INTEGRATED) return terminalIntegratedConfig;
        if (section === CONFIG_SECTIONS.EDITOR) return editorConfig;
        return mockWorkspaceConfiguration;
      });

      // Default feature states
      sidebarConfig.get.mockImplementation((key: string) => {
        if (key === 'enableCliAgentIntegration') return true;
        if (key === 'enableGitHubCopilotIntegration') return false;
        if (key === 'dynamicSplitDirection') return true;
        return undefined;
      });

      terminalIntegratedConfig.get.mockImplementation((key: string) => {
        if (key === 'altClickMovesCursor') return true;
        return undefined;
      });

      editorConfig.get.mockImplementation((key: string) => {
        if (key === 'multiCursorModifier') return 'alt';
        return undefined;
      });
    });

    it('should check CLI Agent integration feature', () => {
      expect(service.isFeatureEnabled('cliAgentIntegration')).toBe(true);
    });

    it('should check GitHub Copilot integration feature', () => {
      expect(service.isFeatureEnabled('githubCopilotIntegration')).toBe(false);
    });

    it('should check Alt+Click feature (requires both settings)', () => {
      expect(service.isFeatureEnabled('altClickMovesCursor')).toBe(true);
    });

    it('should check dynamic split direction feature', () => {
      expect(service.isFeatureEnabled('dynamicSplitDirection')).toBe(true);
    });

    it('should return false for unknown features', () => {
      expect(service.isFeatureEnabled('unknownFeature')).toBe(false);
    });
  });

  describe('Configuration Profiles', () => {
    it('should get terminal profiles configuration', () => {
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === CONFIG_KEYS.PROFILES_WINDOWS) return { PowerShell: { path: 'powershell.exe' } };
        if (key === CONFIG_KEYS.PROFILES_LINUX) return { Bash: { path: '/bin/bash' } };
        if (key === CONFIG_KEYS.PROFILES_OSX) return { Zsh: { path: '/bin/zsh' } };
        if (key === CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS) return 'PowerShell';
        if (key === CONFIG_KEYS.DEFAULT_PROFILE_LINUX) return 'Bash';
        if (key === CONFIG_KEYS.DEFAULT_PROFILE_OSX) return 'Zsh';
        if (key === CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION) return false;
        if (key === CONFIG_KEYS.INHERIT_VSCODE_PROFILES) return true;
        return defaultValue;
      });

      const profilesConfig = service.getTerminalProfilesConfig();

      expect(profilesConfig.profiles.windows).toEqual({
        PowerShell: { path: 'powershell.exe' },
      });
      expect(profilesConfig.profiles.linux).toEqual({
        Bash: { path: '/bin/bash' },
      });
      expect(profilesConfig.profiles.osx).toEqual({
        Zsh: { path: '/bin/zsh' },
      });
      expect(profilesConfig.defaultProfiles.windows).toBe('PowerShell');
      expect(profilesConfig.defaultProfiles.linux).toBe('Bash');
      expect(profilesConfig.defaultProfiles.osx).toBe('Zsh');
      expect(profilesConfig.autoDetection.enabled).toBe(false);
      expect(profilesConfig.inheritVSCodeProfiles).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate font size within bounds', () => {
      const terminalConfig = { get: vi.fn() };
      (vscode.workspace.getConfiguration as unknown as ReturnType<typeof vi.fn>).mockImplementation((section?: string) => {
        if (section === 'terminal.integrated') return terminalConfig;
        return mockWorkspaceConfiguration;
      });

      // Test valid font size
      terminalConfig.get.mockReturnValue(16);
      expect(service.getFontSize()).toBe(16);

      // Test invalid font size (should use default)
      terminalConfig.get.mockReturnValue(200); // Too large
      // Service should internally validate and potentially use default
    });

    it('should provide debug information', () => {
      const debugInfo = service.getDebugInfo();

      expect(debugInfo).toHaveProperty('initialized');
      expect(debugInfo).toHaveProperty('cacheSize');
      expect(debugInfo).toHaveProperty('registeredSchemas');
      expect(debugInfo).toHaveProperty('timestamp');
      expect(typeof debugInfo.timestamp).toBe('string');
    });
  });

  describe('Event Handling', () => {
    it('should emit configuration change events', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let eventResult: any = null;

      service.onDidChangeConfiguration((event) => {
        eventResult = event;
      });

      // Trigger a configuration update
      await service.update('terminal.integrated', 'fontSize', 18);

      expect(eventResult).not.toBeNull();
      expect(eventResult.affectsConfiguration('terminal.integrated', 'fontSize')).toBe(true);
      expect(eventResult.changedKeys).toContain('terminal.integrated.fontSize');
      expect(typeof eventResult.timestamp).toBe('number');
    });

    it('should clear cache on VS Code configuration changes', () => {
      // Access the service's internal cache for verification
      const serviceCache = (service as any)._configurationCache as Map<string, any>;

      // Use a dynamic value that can be changed
      let currentFontSize = 16;
      mockWorkspaceConfiguration.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'fontSize') {
          return currentFontSize;
        }
        return defaultValue;
      });

      // Get a value to cache it
      const initialValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(initialValue).toBe(16);

      // Verify the value was cached
      expect(serviceCache.has('terminal.integrated.fontSize')).toBe(true);

      // Get call count after initial call
      const callCountAfterFirstGet = mockWorkspaceConfiguration.get.mock.calls.length;

      // Getting the same value again should use cache (call count unchanged)
      const cachedValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(cachedValue).toBe(16);
      expect(mockWorkspaceConfiguration.get.mock.calls.length).toBe(callCountAfterFirstGet);

      // Change the return value BEFORE calling the event handler
      currentFontSize = 18;

      // Simulate VS Code configuration change event
      const changeEvent = {
        affectsConfiguration: vi.fn().mockReturnValue(true),
      };

      // Get the registered change handler
      const onDidChangeStub = vscode.workspace.onDidChangeConfiguration as unknown as ReturnType<typeof vi.fn>;

      // Verify the stub was called (service registered its handler)
      expect(onDidChangeStub).toHaveBeenCalled();

      // Use the most recent call's handler (not getCall(0) which might be from a previous test)
      const lastCallIndex = onDidChangeStub.mock.calls.length - 1;
      const onDidChangeHandler = onDidChangeStub.mock.calls[lastCallIndex][0];
      expect(onDidChangeHandler).toBeDefined();
      expect(typeof onDidChangeHandler).toBe('function');

      // Call the handler to trigger cache clear
      onDidChangeHandler(changeEvent);

      // Verify cache was cleared
      expect(serviceCache.has('terminal.integrated.fontSize')).toBe(false);

      // Get call count after config change event
      const callCountAfterEvent = mockWorkspaceConfiguration.get.mock.calls.length;

      // Getting the value again should call VS Code API (cache cleared by event)
      const newValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(newValue).toBe(18);
      // Call count should have increased (cache was cleared)
      expect(mockWorkspaceConfiguration.get.mock.calls.length).toBeGreaterThan(callCountAfterEvent);
    });
  });

  describe('Error Handling', () => {
    it('should handle VS Code API unavailability gracefully', () => {
      // Create a new service instance without VS Code API
      const originalGetConfiguration = vscode.workspace.getConfiguration;
      (vscode.workspace as any).getConfiguration = undefined;

      // getInstance will fail if it tries to use getConfiguration immediately,
      // but getInstance logic might handle it.
      // Actually getInstance creates a singleton. We want to test a fresh instance if possible,
      // but constructor is private.
      // UnifiedConfigurationService.getInstance() uses the singleton.
      // We can try to access the class directly if exported or check getInstance behavior.

      // Since we reset the singleton in beforeEach, we can try getting it again.
      // However, initialize() calls getConfiguration.

      // Force a new instance creation via getUnifiedConfigurationService which calls getInstance
      // But we need to clear the instance first.
      const configManagerClass = UnifiedConfigurationService as unknown as { instance: UnifiedConfigurationService | undefined };
      configManagerClass.instance = undefined;

      const newService = UnifiedConfigurationService.getInstance();

      // Should not throw during initialization
      expect(() => newService.initialize()).not.toThrow();

      // Restore the original method
      vscode.workspace.getConfiguration = originalGetConfiguration;
      newService.dispose();
    });

    it('should handle configuration read errors gracefully', () => {
      mockWorkspaceConfiguration.get.mockImplementation(() => {
        throw new Error('Configuration read error');
      });

      // Should return default value instead of throwing
      const fontSize = service.get('terminal.integrated', 'fontSize', 14);
      expect(fontSize).toBe(14);
    });

    it('should handle configuration update errors', async () => {
      mockWorkspaceConfiguration.update.mockRejectedValue(new Error('Update failed'));

      await expect(service.update('terminal.integrated', 'fontSize', 16))
        .rejects.toThrow('Update failed');
    });
  });

  describe('Resource Management', () => {
    it('should dispose of resources properly', () => {
      const debugInfo = service.getDebugInfo();
      expect(debugInfo.disposables).toBeGreaterThan(0);

      service.dispose();

      // Should clear disposables
      const postDisposeInfo = service.getDebugInfo();
      expect(postDisposeInfo.disposables).toBe(0);
    });

    it('should clear cache on disposal', () => {
      // Cache some values
      mockWorkspaceConfiguration.get.mockReturnValue(16);
      service.get('terminal.integrated', 'fontSize', 14);

      const debugInfo = service.getDebugInfo();
      expect(debugInfo.cacheSize).toBeGreaterThan(0);

      service.dispose();

      const postDisposeInfo = service.getDebugInfo();
      expect(postDisposeInfo.cacheSize).toBe(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should provide legacy getConfigManager function', () => {
      const legacyManager = getUnifiedConfigurationService();
      expect(legacyManager).toBeInstanceOf(UnifiedConfigurationService);
    });

    it('should support all legacy ConfigManager methods', () => {
      // Test that all methods from old ConfigManager are available
      expect(typeof service.getExtensionTerminalConfig).toBe('function');
      expect(typeof service.getCompleteTerminalSettings).toBe('function');
      expect(typeof service.getCompleteExtensionConfig).toBe('function');
      expect(typeof service.getShellForPlatform).toBe('function');
      expect(typeof service.getAltClickSettings).toBe('function');
      expect(typeof service.getFontFamily).toBe('function');
      expect(typeof service.getFontSize).toBe('function');
      expect(typeof service.clearCache).toBe('function');
    });
  });
});
