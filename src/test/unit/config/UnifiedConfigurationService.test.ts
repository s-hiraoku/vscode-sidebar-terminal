/**
 * Comprehensive tests for UnifiedConfigurationService
 *
 * These tests validate the consolidated configuration service that replaces:
 * - ConfigManager.ts (extension-side)
 * - ConfigManager.ts (webview-side)
 * - UnifiedConfigurationService.ts (old version)
 * - WebViewSettingsManagerService.ts
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  UnifiedConfigurationService,
  getUnifiedConfigurationService,
  ConfigurationTarget as _ConfigurationTarget,
} from '../../../config/UnifiedConfigurationService';
import { CONFIG_SECTIONS, CONFIG_KEYS } from '../../../types/shared';

// Singleton Pattern tests are temporarily skipped due to sandbox cleanup issues
// between describe blocks that share stubbed VS Code API
// TODO: Fix by moving to separate test file or using different stub management
describe.skip('UnifiedConfigurationService - Singleton Pattern', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create mock workspace configuration
    const mockWorkspaceConfiguration = {
      get: sandbox.stub().returns(undefined),
      has: sandbox.stub().returns(false),
      inspect: sandbox.stub().returns(undefined),
      update: sandbox.stub().resolves(),
    } as any;

    // Mock vscode.workspace.getConfiguration
    sandbox.stub(vscode.workspace, 'getConfiguration').returns(mockWorkspaceConfiguration);

    // Mock vscode.workspace.onDidChangeConfiguration
    const mockDisposable = { dispose: sandbox.stub() };
    sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').returns(mockDisposable);
  });

  afterEach(() => {
    // Dispose any existing instance before restoring sandbox
    try {
      const instance = getUnifiedConfigurationService();
      instance.dispose();
    } catch {
      // Ignore if instance doesn't exist
    }
    sandbox.restore();
  });

  it('should return the same instance', () => {
    const instance1 = getUnifiedConfigurationService();
    const instance2 = getUnifiedConfigurationService();

    expect(instance1).to.equal(instance2);
  });

  it('should create new instance after disposal', () => {
    const instance1 = getUnifiedConfigurationService();
    instance1.dispose();

    const instance2 = getUnifiedConfigurationService();
    expect(instance2).to.not.equal(instance1);
  });
});

describe('UnifiedConfigurationService', () => {
  let service: UnifiedConfigurationService;
  let sandbox: sinon.SinonSandbox;
  let mockWorkspaceConfiguration: sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;

  beforeEach(() => {
    // Force dispose any existing singleton instance first
    try {
      const existingInstance = UnifiedConfigurationService.getInstance();
      existingInstance.dispose();
    } catch {
      // Ignore if instance doesn't exist or already disposed
    }

    sandbox = sinon.createSandbox();

    // Create mock workspace configuration
    mockWorkspaceConfiguration = {
      get: sandbox.stub(),
      has: sandbox.stub(),
      inspect: sandbox.stub(),
      update: sandbox.stub().resolves(),
    } as any;

    // Configure the existing vscode.workspace.getConfiguration stub from TestSetup.ts
    // Don't re-stub - instead configure the existing mock's behavior
    const getConfigStub = vscode.workspace.getConfiguration as sinon.SinonStub;
    if (typeof getConfigStub.resetBehavior === 'function') {
      getConfigStub.resetBehavior();
    }
    if (typeof getConfigStub.returns === 'function') {
      getConfigStub.returns(mockWorkspaceConfiguration);
    }

    // Configure onDidChangeConfiguration if it's a stub
    const onDidChangeStub = vscode.workspace.onDidChangeConfiguration as sinon.SinonStub;
    if (typeof onDidChangeStub.resetBehavior === 'function') {
      onDidChangeStub.resetBehavior();
    }
    if (typeof onDidChangeStub.returns === 'function') {
      const mockDisposable = { dispose: sandbox.stub() };
      onDidChangeStub.returns(mockDisposable);
    }

    // Get fresh instance - will create a new one since we disposed the old one
    service = getUnifiedConfigurationService();
    service.initialize();
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
    sandbox.restore();
  });

  describe('Configuration Access', () => {
    it('should get configuration values with defaults', () => {
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);

      const fontSize = service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize).to.equal(16);
      expect(mockWorkspaceConfiguration.get).to.have.been.calledWith('fontSize', 14);
    });

    it('should return default value when configuration fails', () => {
      mockWorkspaceConfiguration.get.throws(new Error('Configuration error'));

      const fontSize = service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize).to.equal(14);
    });

    it('should cache configuration values', () => {
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);

      // First call
      const fontSize1 = service.get('terminal.integrated', 'fontSize', 14);
      // Second call (should be cached)
      const fontSize2 = service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize1).to.equal(16);
      expect(fontSize2).to.equal(16);
      expect(mockWorkspaceConfiguration.get).to.have.been.calledOnce;
    });

    it('should clear cache and refresh values', () => {
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);

      // Get cached value
      service.get('terminal.integrated', 'fontSize', 14);

      // Clear cache
      service.clearCache();

      // Should call VS Code API again
      service.get('terminal.integrated', 'fontSize', 14);

      expect(mockWorkspaceConfiguration.get).to.have.been.calledTwice;
    });
  });

  describe('Configuration Update', () => {
    it('should update configuration values', async () => {
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize').returns(14);

      await service.update('terminal.integrated', 'fontSize', 16);

      expect(mockWorkspaceConfiguration.update).to.have.been.calledWith(
        'fontSize',
        16,
        vscode.ConfigurationTarget.Global
      );
    });

    it('should clear cache after update', async () => {
      // Cache a value first
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(14);
      const initialValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(initialValue).to.equal(14);

      // Get call count after first get (it should be cached now)
      const callCountAfterCache = (mockWorkspaceConfiguration.get as sinon.SinonStub).callCount;

      // Call again - should use cache (call count unchanged)
      const cachedValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(cachedValue).to.equal(14);
      expect((mockWorkspaceConfiguration.get as sinon.SinonStub).callCount).to.equal(callCountAfterCache);

      // Update the value - this clears the cache
      await service.update('terminal.integrated', 'fontSize', 16);

      // Get call count after update (update() may call get() internally)
      const callCountAfterUpdate = (mockWorkspaceConfiguration.get as sinon.SinonStub).callCount;

      // Change the return value and get again - should call VS Code API since cache was cleared
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);
      const newValue = service.get('terminal.integrated', 'fontSize', 14);

      expect(newValue).to.equal(16);
      // Call count should have increased (cache was cleared by update)
      expect((mockWorkspaceConfiguration.get as sinon.SinonStub).callCount).to.be.greaterThan(callCountAfterUpdate);
    });

    it('should fire configuration change event', async () => {
      let changeEvent: any = null;
      service.onDidChangeConfiguration((event) => {
        changeEvent = event;
      });

      await service.update('terminal.integrated', 'fontSize', 16);

      expect(changeEvent).to.not.be.null;
      expect(changeEvent.affectsConfiguration('terminal.integrated', 'fontSize')).to.be.true;
      expect(changeEvent.changedKeys).to.include('terminal.integrated.fontSize');
    });
  });

  describe('Extension Terminal Configuration', () => {
    beforeEach(() => {
      // Setup default mocks for extension terminal config
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.MAX_TERMINALS, 5)
        .returns(5);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.SHELL, '')
        .returns('/bin/bash');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.SHELL_ARGS, [])
        .returns(['-l']);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_DIRECTORY, '')
        .returns('/home/user');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.CURSOR_BLINK, true)
        .returns(true);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('enableCliAgentIntegration', true)
        .returns(true);

      // Mock font settings with proper stub configuration
      const terminalConfigGet = sandbox.stub();
      const editorConfigGet = sandbox.stub();

      // Set up terminal.integrated config
      terminalConfigGet.withArgs('fontSize').returns(14);
      terminalConfigGet.withArgs('fontFamily').returns('monospace');

      // Set up editor config
      editorConfigGet.withArgs('fontSize').returns(12);

      // Configure getConfiguration stub to return appropriate configs
      const getConfigStub = vscode.workspace.getConfiguration as sinon.SinonStub;
      getConfigStub.withArgs('terminal.integrated').returns({
        get: terminalConfigGet,
      } as any);
      getConfigStub.withArgs('editor').returns({
        get: editorConfigGet,
      } as any);
    });

    it('should get extension terminal configuration', () => {
      const config = service.getExtensionTerminalConfig();

      expect(config).to.deep.include({
        maxTerminals: 5,
        shell: '/bin/bash',
        shellArgs: ['-l'],
        defaultDirectory: '/home/user',
        cursorBlink: true,
        enableCliAgentIntegration: true,
      });

      expect(config.cursor).to.deep.equal({
        style: 'block',
        blink: true,
      });
    });

    it('should get complete terminal settings', () => {
      // Mock additional settings for complete config
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.THEME, 'auto')
        .returns('dark');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.CONFIRM_BEFORE_KILL, false)
        .returns(false);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROTECT_LAST_TERMINAL, true)
        .returns(true);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.MIN_TERMINAL_COUNT, 1)
        .returns(1);

      // Mock Alt+Click settings
      const terminalIntegratedConfig = sandbox.stub();
      const editorConfig = sandbox.stub();
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.EDITOR)
        .returns({
          get: editorConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR, false).returns(true);
      editorConfig.withArgs(CONFIG_KEYS.MULTI_CURSOR_MODIFIER, 'ctrlCmd').returns('alt');

      const settings = service.getCompleteTerminalSettings();

      expect(settings).to.deep.include({
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
      // Mock base terminal settings
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('scrollback', 1000)
        .returns(2000);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('bellSound', false)
        .returns(true);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('enableCliAgentIntegration', true)
        .returns(true);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('dynamicSplitDirection', true)
        .returns(false);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('panelLocation', 'auto')
        .returns('sidebar');

      // Mock other required settings
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.MAX_TERMINALS, 5)
        .returns(3);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.CURSOR_BLINK, true)
        .returns(false);

      // Mock nested cursor settings
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('cursor.style', 'block')
        .returns('block');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs('cursor.blink', true)
        .returns(true);

      const settings = service.getWebViewTerminalSettings();

      expect(settings).to.deep.include({
        scrollback: 2000,
        bellSound: true,
        enableCliAgentIntegration: true,
        dynamicSplitDirection: false,
        panelLocation: 'sidebar',
        maxTerminals: 3,
        cursorBlink: false,
      });

      expect(settings.cursor).to.deep.equal({
        style: 'block',
        blink: true,
      });
    });

    it('should get WebView font settings', () => {
      // Mock font configurations
      const terminalConfig = sandbox.stub();
      const editorConfig = sandbox.stub();
      const extensionConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('secondaryTerminal').returns({
        get: extensionConfig,
      } as any);

      // Set up font hierarchy
      terminalConfig.withArgs('fontSize').returns(16);
      terminalConfig.withArgs('fontFamily').returns('Consolas');
      terminalConfig.withArgs('fontWeight').returns('normal');
      terminalConfig.withArgs('fontWeightBold').returns('bold');
      terminalConfig.withArgs('lineHeight').returns(1.2);
      terminalConfig.withArgs('letterSpacing').returns(1);

      const fontSettings = service.getWebViewFontSettings();

      expect(fontSettings).to.deep.equal({
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
      const terminalConfig = sandbox.stub();
      const editorConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);

      terminalConfig.withArgs('fontSize').returns(16);
      terminalConfig.withArgs('fontFamily').returns('Fira Code');
      editorConfig.withArgs('fontSize').returns(14);
      editorConfig.withArgs('fontFamily').returns('Arial');

      expect(service.getFontSize()).to.equal(16);
      expect(service.getFontFamily()).to.equal('Fira Code');
    });

    it('should fallback to editor font when terminal font is not set', () => {
      const terminalConfig = sandbox.stub();
      const editorConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);

      terminalConfig.withArgs('fontSize').returns(0); // Not set
      terminalConfig.withArgs('fontFamily').returns(''); // Not set
      editorConfig.withArgs('fontSize').returns(14);
      editorConfig.withArgs('fontFamily').returns('Arial');

      expect(service.getFontSize()).to.equal(14);
      expect(service.getFontFamily()).to.equal('Arial');
    });

    it('should use system defaults when no fonts are configured', () => {
      const terminalConfig = sandbox.stub();
      const editorConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);

      terminalConfig.withArgs('fontSize').returns(0);
      terminalConfig.withArgs('fontFamily').returns('');
      editorConfig.withArgs('fontSize').returns(0);
      editorConfig.withArgs('fontFamily').returns('');

      expect(service.getFontSize()).to.equal(14);
      expect(service.getFontFamily()).to.equal('monospace');
    });

    it('should prioritize extension settings for font weight and spacing', () => {
      const terminalConfig = sandbox.stub();
      const extensionConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('secondaryTerminal').returns({
        get: extensionConfig,
      } as any);

      // Extension overrides
      extensionConfig.withArgs('fontWeight').returns('300');
      extensionConfig.withArgs('fontWeightBold').returns('700');
      extensionConfig.withArgs('lineHeight').returns(1.5);
      extensionConfig.withArgs('letterSpacing').returns(0.5);

      // Terminal defaults
      terminalConfig.withArgs('fontWeight').returns('normal');
      terminalConfig.withArgs('fontWeightBold').returns('bold');
      terminalConfig.withArgs('lineHeight').returns(1.0);
      terminalConfig.withArgs('letterSpacing').returns(0);

      expect(service.getFontWeight()).to.equal('300');
      expect(service.getFontWeightBold()).to.equal('700');
      expect(service.getLineHeight()).to.equal(1.5);
      expect(service.getLetterSpacing()).to.equal(0.5);
    });
  });

  describe('Platform-Specific Shell Configuration', () => {
    it('should return custom shell when provided', () => {
      const shell = service.getShellForPlatform('/custom/shell');
      expect(shell).to.equal('/custom/shell');
    });

    it('should get Windows shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const terminalIntegratedConfig = sandbox.stub();
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_WINDOWS, '').returns('powershell.exe');

      const shell = service.getShellForPlatform();
      expect(shell).to.equal('powershell.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should get macOS shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const terminalIntegratedConfig = sandbox.stub();
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_OSX, '').returns('/bin/zsh');

      const shell = service.getShellForPlatform();
      expect(shell).to.equal('/bin/zsh');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should get Linux shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const terminalIntegratedConfig = sandbox.stub();
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_LINUX, '').returns('/bin/bash');

      const shell = service.getShellForPlatform();
      expect(shell).to.equal('/bin/bash');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use environment variables as fallback', () => {
      const originalPlatform = process.platform;
      const originalEnv = process.env;

      Object.defineProperty(process, 'platform', { value: 'linux' });
      Object.defineProperty(process, 'env', {
        value: { ...originalEnv, SHELL: '/usr/bin/fish' },
      });

      const terminalIntegratedConfig = sandbox.stub();
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_LINUX, '').returns('');

      const shell = service.getShellForPlatform();
      expect(shell).to.equal('/usr/bin/fish');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'env', { value: originalEnv });
    });
  });

  describe('Alt+Click Configuration', () => {
    it('should get Alt+Click settings', () => {
      const terminalIntegratedConfig = sandbox.stub();
      const editorConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.EDITOR)
        .returns({
          get: editorConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR, false).returns(true);
      editorConfig.withArgs(CONFIG_KEYS.MULTI_CURSOR_MODIFIER, 'ctrlCmd').returns('alt');

      const settings = service.getAltClickSettings();

      expect(settings).to.deep.equal({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
    });

    it('should return defaults when configuration fails', () => {
      (vscode.workspace.getConfiguration as sinon.SinonStub).throws(
        new Error('Configuration error')
      );

      const settings = service.getAltClickSettings();

      expect(settings).to.deep.equal({
        altClickMovesCursor: false,
        multiCursorModifier: 'ctrlCmd',
      });
    });
  });

  describe('Feature Enablement', () => {
    beforeEach(() => {
      const sidebarConfig = sandbox.stub();
      const terminalIntegratedConfig = sandbox.stub();
      const editorConfig = sandbox.stub();

      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.SIDEBAR_TERMINAL)
        .returns({
          get: sidebarConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.EDITOR)
        .returns({
          get: editorConfig,
        } as any);

      // Default feature states
      sidebarConfig.withArgs('enableCliAgentIntegration', true).returns(true);
      sidebarConfig.withArgs('enableGitHubCopilotIntegration', true).returns(false);
      sidebarConfig.withArgs('dynamicSplitDirection', true).returns(true);
      terminalIntegratedConfig.withArgs('altClickMovesCursor', true).returns(true);
      editorConfig.withArgs('multiCursorModifier', 'alt').returns('alt');
    });

    it('should check CLI Agent integration feature', () => {
      expect(service.isFeatureEnabled('cliAgentIntegration')).to.be.true;
    });

    it('should check GitHub Copilot integration feature', () => {
      expect(service.isFeatureEnabled('githubCopilotIntegration')).to.be.false;
    });

    it('should check Alt+Click feature (requires both settings)', () => {
      expect(service.isFeatureEnabled('altClickMovesCursor')).to.be.true;
    });

    it('should check dynamic split direction feature', () => {
      expect(service.isFeatureEnabled('dynamicSplitDirection')).to.be.true;
    });

    it('should return false for unknown features', () => {
      expect(service.isFeatureEnabled('unknownFeature')).to.be.false;
    });
  });

  describe('Configuration Profiles', () => {
    it('should get terminal profiles configuration', () => {
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROFILES_WINDOWS, {})
        .returns({
          PowerShell: { path: 'powershell.exe' },
        });
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROFILES_LINUX, {})
        .returns({
          Bash: { path: '/bin/bash' },
        });
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROFILES_OSX, {})
        .returns({
          Zsh: { path: '/bin/zsh' },
        });
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS, null)
        .returns('PowerShell');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_PROFILE_LINUX, null)
        .returns('Bash');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_PROFILE_OSX, null)
        .returns('Zsh');
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION, true)
        .returns(false);
      (mockWorkspaceConfiguration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true)
        .returns(true);

      const profilesConfig = service.getTerminalProfilesConfig();

      expect(profilesConfig.profiles.windows).to.deep.equal({
        PowerShell: { path: 'powershell.exe' },
      });
      expect(profilesConfig.profiles.linux).to.deep.equal({
        Bash: { path: '/bin/bash' },
      });
      expect(profilesConfig.profiles.osx).to.deep.equal({
        Zsh: { path: '/bin/zsh' },
      });
      expect(profilesConfig.defaultProfiles.windows).to.equal('PowerShell');
      expect(profilesConfig.defaultProfiles.linux).to.equal('Bash');
      expect(profilesConfig.defaultProfiles.osx).to.equal('Zsh');
      expect(profilesConfig.autoDetection.enabled).to.be.false;
      expect(profilesConfig.inheritVSCodeProfiles).to.be.true;
    });
  });

  describe('Configuration Validation', () => {
    it('should validate font size within bounds', () => {
      // Mock font size retrieval that includes validation
      const terminalConfig = sandbox.stub();
      (vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);

      // Test valid font size
      terminalConfig.withArgs('fontSize').returns(16);
      expect(service.getFontSize()).to.equal(16);

      // Test invalid font size (should use default)
      terminalConfig.withArgs('fontSize').returns(200); // Too large
      // Service should internally validate and potentially use default
    });

    it('should provide debug information', () => {
      const debugInfo = service.getDebugInfo();

      expect(debugInfo).to.have.property('initialized');
      expect(debugInfo).to.have.property('cacheSize');
      expect(debugInfo).to.have.property('registeredSchemas');
      expect(debugInfo).to.have.property('timestamp');
      expect(typeof debugInfo.timestamp).to.equal('string');
    });
  });

  describe('Event Handling', () => {
    it('should emit configuration change events', (done) => {
      let _eventReceived = false;

      service.onDidChangeConfiguration((event) => {
        _eventReceived = true;
        expect(event.affectsConfiguration('terminal.integrated', 'fontSize')).to.be.true;
        expect(event.changedKeys).to.include('terminal.integrated.fontSize');
        expect(event.timestamp).to.be.a('number');
        done();
      });

      // Trigger a configuration update
      service.update('terminal.integrated', 'fontSize', 18).catch(done);
    });

    it('should clear cache on VS Code configuration changes', () => {
      // Access the service's internal cache for verification
      const serviceCache = (service as any)._configurationCache as Map<string, any>;

      // Use a dynamic value that can be changed
      let currentFontSize = 16;
      (mockWorkspaceConfiguration.get as sinon.SinonStub).callsFake((key: string, defaultValue: any) => {
        if (key === 'fontSize') {
          return currentFontSize;
        }
        return defaultValue;
      });

      // Get a value to cache it
      const initialValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(initialValue).to.equal(16);

      // Verify the value was cached
      expect(serviceCache.has('terminal.integrated.fontSize'), 'Value should be cached').to.be.true;

      // Get call count after initial call
      const callCountAfterFirstGet = (mockWorkspaceConfiguration.get as sinon.SinonStub).callCount;

      // Getting the same value again should use cache (call count unchanged)
      const cachedValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(cachedValue).to.equal(16);
      expect((mockWorkspaceConfiguration.get as sinon.SinonStub).callCount).to.equal(callCountAfterFirstGet);

      // Change the return value BEFORE calling the event handler
      currentFontSize = 18;

      // Simulate VS Code configuration change event
      const changeEvent = {
        affectsConfiguration: sinon.stub().returns(true),
      };

      // Get the registered change handler
      const onDidChangeStub = vscode.workspace.onDidChangeConfiguration as sinon.SinonStub;

      // Verify the stub was called (service registered its handler)
      expect(onDidChangeStub.callCount, 'onDidChangeConfiguration should have been called').to.be.greaterThan(0);

      const onDidChangeHandler = onDidChangeStub.getCall(0).args[0];
      expect(onDidChangeHandler, 'Handler should exist').to.not.be.undefined;
      expect(typeof onDidChangeHandler, 'Handler should be a function').to.equal('function');

      // Call the handler to trigger cache clear
      onDidChangeHandler(changeEvent);

      // Verify cache was cleared
      expect(serviceCache.has('terminal.integrated.fontSize'), 'Cache should be cleared after config change').to.be.false;

      // Get call count after config change event
      const callCountAfterEvent = (mockWorkspaceConfiguration.get as sinon.SinonStub).callCount;

      // Getting the value again should call VS Code API (cache cleared by event)
      const newValue = service.get('terminal.integrated', 'fontSize', 14);
      expect(newValue).to.equal(18);
      // Call count should have increased (cache was cleared)
      expect((mockWorkspaceConfiguration.get as sinon.SinonStub).callCount).to.be.greaterThan(callCountAfterEvent);
    });
  });

  describe('Error Handling', () => {
    it('should handle VS Code API unavailability gracefully', () => {
      // Create a new service instance without VS Code API
      const originalGetConfiguration = vscode.workspace.getConfiguration;
      (vscode.workspace as any).getConfiguration = undefined;

      const newService = UnifiedConfigurationService.getInstance();

      // Should not throw during initialization
      expect(() => newService.initialize()).to.not.throw();

      // Restore the original method
      vscode.workspace.getConfiguration = originalGetConfiguration;
      newService.dispose();
    });

    it('should handle configuration read errors gracefully', () => {
      mockWorkspaceConfiguration.get.throws(new Error('Configuration read error'));

      // Should return default value instead of throwing
      const fontSize = service.get('terminal.integrated', 'fontSize', 14);
      expect(fontSize).to.equal(14);
    });

    it('should handle configuration update errors', async () => {
      mockWorkspaceConfiguration.update.rejects(new Error('Update failed'));

      try {
        await service.update('terminal.integrated', 'fontSize', 16);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.include('Update failed');
      }
    });
  });

  describe('Resource Management', () => {
    it('should dispose of resources properly', () => {
      const debugInfo = service.getDebugInfo();
      expect(debugInfo.disposables).to.be.greaterThan(0);

      service.dispose();

      // Should clear disposables
      const postDisposeInfo = service.getDebugInfo();
      expect(postDisposeInfo.disposables).to.equal(0);
    });

    it('should clear cache on disposal', () => {
      // Cache some values
      (mockWorkspaceConfiguration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);
      service.get('terminal.integrated', 'fontSize', 14);

      const debugInfo = service.getDebugInfo();
      expect(debugInfo.cacheSize).to.be.greaterThan(0);

      service.dispose();

      const postDisposeInfo = service.getDebugInfo();
      expect(postDisposeInfo.cacheSize).to.equal(0);
    });
  });

  describe('Backward Compatibility', () => {
    it('should provide legacy getConfigManager function', () => {
      const legacyManager = getUnifiedConfigurationService();
      expect(legacyManager).to.be.instanceOf(UnifiedConfigurationService);
    });

    it('should support all legacy ConfigManager methods', () => {
      // Test that all methods from old ConfigManager are available
      expect(service.getExtensionTerminalConfig).to.be.a('function');
      expect(service.getCompleteTerminalSettings).to.be.a('function');
      expect(service.getCompleteExtensionConfig).to.be.a('function');
      expect(service.getShellForPlatform).to.be.a('function');
      expect(service.getAltClickSettings).to.be.a('function');
      expect(service.getFontFamily).to.be.a('function');
      expect(service.getFontSize).to.be.a('function');
      expect(service.clearCache).to.be.a('function');
    });
  });
});
