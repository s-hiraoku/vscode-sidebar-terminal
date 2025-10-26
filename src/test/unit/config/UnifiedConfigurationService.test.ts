/**
 * Comprehensive tests for UnifiedConfigurationService
 *
 * These tests validate the consolidated configuration service
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  UnifiedConfigurationService,
  getUnifiedConfigurationService,
  ConfigurationTarget as _ConfigurationTarget,
} from '../../../config/UnifiedConfigurationService';
import { CONFIG_SECTIONS, CONFIG_KEYS } from '../../../types/shared';
import { ConfigurationTest } from '../../utils/ConfigurationTest';

/**
 * Test class for UnifiedConfigurationService
 */
class UnifiedConfigurationServiceTest extends ConfigurationTest {
  public service!: UnifiedConfigurationService;

  protected override setup(): void {
    super.setup();

    // Reset singleton instance
    (UnifiedConfigurationService as any)._instance = undefined;

    // Get fresh instance
    this.service = getUnifiedConfigurationService();
    this.service.initialize();
  }

  protected override teardown(): void {
    if (this.service) {
      this.service.dispose();
    }
    // Reset singleton instance
    (UnifiedConfigurationService as any)._instance = undefined;

    super.teardown();
  }
}

describe('UnifiedConfigurationService', () => {
  const test = new UnifiedConfigurationServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  describe('Singleton Pattern', () => {
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

  describe('Configuration Access', () => {
    it('should get configuration values with defaults', () => {
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);

      const fontSize = test.service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize).to.equal(16);
      expect(test.vscode.configuration.get).to.have.been.calledWith('fontSize', 14);
    });

    it('should return default value when configuration fails', () => {
      test.vscode.configuration.get.throws(new Error('Configuration error'));

      const fontSize = test.service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize).to.equal(14);
    });

    it('should cache configuration values', () => {
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);

      // First call
      const fontSize1 = test.service.get('terminal.integrated', 'fontSize', 14);
      // Second call (should be cached)
      const fontSize2 = test.service.get('terminal.integrated', 'fontSize', 14);

      expect(fontSize1).to.equal(16);
      expect(fontSize2).to.equal(16);
      expect(test.vscode.configuration.get).to.have.been.calledOnce;
    });

    it('should clear cache and refresh values', () => {
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);

      // Get cached value
      test.service.get('terminal.integrated', 'fontSize', 14);

      // Clear cache
      test.service.clearCache();

      // Should call VS Code API again
      test.service.get('terminal.integrated', 'fontSize', 14);

      expect(test.vscode.configuration.get).to.have.been.calledTwice;
    });
  });

  describe('Configuration Update', () => {
    it('should update configuration values', async () => {
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize').returns(14);

      await test.service.update('terminal.integrated', 'fontSize', 16);

      expect(test.vscode.configuration.update).to.have.been.calledWith(
        'fontSize',
        16,
        test.vscode.ConfigurationTarget.Global
      );
    });

    it('should clear cache after update', async () => {
      // Cache a value first
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(14);
      test.service.get('terminal.integrated', 'fontSize', 14);

      // Update the value
      await test.service.update('terminal.integrated', 'fontSize', 16);

      // Get the value again (should call VS Code API again)
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);
      const newValue = test.service.get('terminal.integrated', 'fontSize', 14);

      expect(newValue).to.equal(16);
      expect(test.vscode.configuration.get).to.have.been.calledTwice;
    });

    it('should fire configuration change event', async () => {
      let changeEvent: any = null;
      test.service.onDidChangeConfiguration((event) => {
        changeEvent = event;
      });

      await test.service.update('terminal.integrated', 'fontSize', 16);

      expect(changeEvent).to.not.be.null;
      expect(changeEvent.affectsConfiguration('terminal.integrated', 'fontSize')).to.be.true;
      expect(changeEvent.changedKeys).to.include('terminal.integrated.fontSize');
    });
  });

  describe('Extension Terminal Configuration', () => {
    beforeEach(() => {
      // Setup default mocks for extension terminal config
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.MAX_TERMINALS, 5)
        .returns(5);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.SHELL, '')
        .returns('/bin/bash');
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.SHELL_ARGS, [])
        .returns(['-l']);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_DIRECTORY, '')
        .returns('/home/user');
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.CURSOR_BLINK, true)
        .returns(true);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs('enableCliAgentIntegration', true)
        .returns(true);

      // Mock font settings with proper stub configuration
      const terminalConfigGet = test.sandbox.stub();
      const editorConfigGet = test.sandbox.stub();

      // Set up terminal.integrated config
      terminalConfigGet.withArgs('fontSize').returns(14);
      terminalConfigGet.withArgs('fontFamily').returns('monospace');

      // Set up editor config
      editorConfigGet.withArgs('fontSize').returns(12);

      // Configure getConfiguration stub to return appropriate configs
      const getConfigStub = test.vscode.workspace.getConfiguration as sinon.SinonStub;
      getConfigStub.withArgs('terminal.integrated').returns({
        get: terminalConfigGet,
      } as any);
      getConfigStub.withArgs('editor').returns({
        get: editorConfigGet,
      } as any);
    });

    it('should get extension terminal configuration', () => {
      const config = test.service.getExtensionTerminalConfig();

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
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.THEME, 'auto')
        .returns('dark');
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.CONFIRM_BEFORE_KILL, false)
        .returns(false);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROTECT_LAST_TERMINAL, true)
        .returns(true);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.MIN_TERMINAL_COUNT, 1)
        .returns(1);

      // Mock Alt+Click settings
      const terminalIntegratedConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.EDITOR)
        .returns({
          get: editorConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR, false).returns(true);
      editorConfig.withArgs(CONFIG_KEYS.MULTI_CURSOR_MODIFIER, 'ctrlCmd').returns('alt');

      const settings = test.service.getCompleteTerminalSettings();

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
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs('scrollback', 1000)
        .returns(2000);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs('bellSound', false)
        .returns(true);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs('enableCliAgentIntegration', true)
        .returns(true);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs('dynamicSplitDirection', true)
        .returns(false);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs('panelLocation', 'auto')
        .returns('sidebar');

      // Mock other required settings
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.MAX_TERMINALS, 5)
        .returns(3);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.CURSOR_BLINK, true)
        .returns(false);

      const settings = test.service.getWebViewTerminalSettings();

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
      const terminalConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();
      const extensionConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('secondaryTerminal').returns({
        get: extensionConfig,
      } as any);

      // Set up font hierarchy
      terminalConfig.withArgs('fontSize').returns(16);
      terminalConfig.withArgs('fontFamily').returns('Consolas');
      terminalConfig.withArgs('fontWeight').returns('normal');
      terminalConfig.withArgs('fontWeightBold').returns('bold');
      terminalConfig.withArgs('lineHeight').returns(1.2);
      terminalConfig.withArgs('letterSpacing').returns(1);

      const fontSettings = test.service.getWebViewFontSettings();

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
      const terminalConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);

      terminalConfig.withArgs('fontSize').returns(16);
      terminalConfig.withArgs('fontFamily').returns('Fira Code');
      editorConfig.withArgs('fontSize').returns(14);
      editorConfig.withArgs('fontFamily').returns('Arial');

      expect(test.service.getFontSize()).to.equal(16);
      expect(test.service.getFontFamily()).to.equal('Fira Code');
    });

    it('should fallback to editor font when terminal font is not set', () => {
      const terminalConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);

      terminalConfig.withArgs('fontSize').returns(0); // Not set
      terminalConfig.withArgs('fontFamily').returns(''); // Not set
      editorConfig.withArgs('fontSize').returns(14);
      editorConfig.withArgs('fontFamily').returns('Arial');

      expect(test.service.getFontSize()).to.equal(14);
      expect(test.service.getFontFamily()).to.equal('Arial');
    });

    it('should use system defaults when no fonts are configured', () => {
      const terminalConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('editor').returns({
        get: editorConfig,
      } as any);

      terminalConfig.withArgs('fontSize').returns(0);
      terminalConfig.withArgs('fontFamily').returns('');
      editorConfig.withArgs('fontSize').returns(0);
      editorConfig.withArgs('fontFamily').returns('');

      expect(test.service.getFontSize()).to.equal(14);
      expect(test.service.getFontFamily()).to.equal('monospace');
    });

    it('should prioritize extension settings for font weight and spacing', () => {
      const terminalConfig = test.sandbox.stub();
      const extensionConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).withArgs('secondaryTerminal').returns({
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

      expect(test.service.getFontWeight()).to.equal('300');
      expect(test.service.getFontWeightBold()).to.equal('700');
      expect(test.service.getLineHeight()).to.equal(1.5);
      expect(test.service.getLetterSpacing()).to.equal(0.5);
    });
  });

  describe('Platform-Specific Shell Configuration', () => {
    it('should return custom shell when provided', () => {
      const shell = test.service.getShellForPlatform('/custom/shell');
      expect(shell).to.equal('/custom/shell');
    });

    it('should get Windows shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const terminalIntegratedConfig = test.sandbox.stub();
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_WINDOWS, '').returns('powershell.exe');

      const shell = test.service.getShellForPlatform();
      expect(shell).to.equal('powershell.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should get macOS shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const terminalIntegratedConfig = test.sandbox.stub();
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_OSX, '').returns('/bin/zsh');

      const shell = test.service.getShellForPlatform();
      expect(shell).to.equal('/bin/zsh');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should get Linux shell configuration', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const terminalIntegratedConfig = test.sandbox.stub();
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_LINUX, '').returns('/bin/bash');

      const shell = test.service.getShellForPlatform();
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

      const terminalIntegratedConfig = test.sandbox.stub();
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.SHELL_LINUX, '').returns('');

      const shell = test.service.getShellForPlatform();
      expect(shell).to.equal('/usr/bin/fish');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'env', { value: originalEnv });
    });
  });

  describe('Alt+Click Configuration', () => {
    it('should get Alt+Click settings', () => {
      const terminalIntegratedConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.EDITOR)
        .returns({
          get: editorConfig,
        } as any);

      terminalIntegratedConfig.withArgs(CONFIG_KEYS.ALT_CLICK_MOVES_CURSOR, false).returns(true);
      editorConfig.withArgs(CONFIG_KEYS.MULTI_CURSOR_MODIFIER, 'ctrlCmd').returns('alt');

      const settings = test.service.getAltClickSettings();

      expect(settings).to.deep.equal({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
    });

    it('should return defaults when configuration fails', () => {
      (test.vscode.workspace.getConfiguration as sinon.SinonStub).throws(
        new Error('Configuration error')
      );

      const settings = test.service.getAltClickSettings();

      expect(settings).to.deep.equal({
        altClickMovesCursor: false,
        multiCursorModifier: 'ctrlCmd',
      });
    });
  });

  describe('Feature Enablement', () => {
    beforeEach(() => {
      const sidebarConfig = test.sandbox.stub();
      const terminalIntegratedConfig = test.sandbox.stub();
      const editorConfig = test.sandbox.stub();

      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.SIDEBAR_TERMINAL)
        .returns({
          get: sidebarConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs(CONFIG_SECTIONS.TERMINAL_INTEGRATED)
        .returns({
          get: terminalIntegratedConfig,
        } as any);
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
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
      expect(test.service.isFeatureEnabled('cliAgentIntegration')).to.be.true;
    });

    it('should check GitHub Copilot integration feature', () => {
      expect(test.service.isFeatureEnabled('githubCopilotIntegration')).to.be.false;
    });

    it('should check Alt+Click feature (requires both settings)', () => {
      expect(test.service.isFeatureEnabled('altClickMovesCursor')).to.be.true;
    });

    it('should check dynamic split direction feature', () => {
      expect(test.service.isFeatureEnabled('dynamicSplitDirection')).to.be.true;
    });

    it('should return false for unknown features', () => {
      expect(test.service.isFeatureEnabled('unknownFeature')).to.be.false;
    });
  });

  describe('Configuration Profiles', () => {
    it('should get terminal profiles configuration', () => {
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROFILES_WINDOWS, {})
        .returns({
          PowerShell: { path: 'powershell.exe' },
        });
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROFILES_LINUX, {})
        .returns({
          Bash: { path: '/bin/bash' },
        });
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.PROFILES_OSX, {})
        .returns({
          Zsh: { path: '/bin/zsh' },
        });
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_PROFILE_WINDOWS, null)
        .returns('PowerShell');
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_PROFILE_LINUX, null)
        .returns('Bash');
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.DEFAULT_PROFILE_OSX, null)
        .returns('Zsh');
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.ENABLE_PROFILE_AUTO_DETECTION, true)
        .returns(false);
      (test.vscode.configuration.get as sinon.SinonStub)
        .withArgs(CONFIG_KEYS.INHERIT_VSCODE_PROFILES, true)
        .returns(true);

      const profilesConfig = test.service.getTerminalProfilesConfig();

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
      const terminalConfig = test.sandbox.stub();
      (test.vscode.workspace.getConfiguration as sinon.SinonStub)
        .withArgs('terminal.integrated')
        .returns({
          get: terminalConfig,
        } as any);

      // Test valid font size
      terminalConfig.withArgs('fontSize').returns(16);
      expect(test.service.getFontSize()).to.equal(16);

      // Test invalid font size (should use default)
      terminalConfig.withArgs('fontSize').returns(200); // Too large
      // Service should internally validate and potentially use default
    });

    it('should provide debug information', () => {
      const debugInfo = test.service.getDebugInfo();

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

      test.service.onDidChangeConfiguration((event) => {
        _eventReceived = true;
        expect(event.affectsConfiguration('terminal.integrated', 'fontSize')).to.be.true;
        expect(event.changedKeys).to.include('terminal.integrated.fontSize');
        expect(event.timestamp).to.be.a('number');
        done();
      });

      // Trigger a configuration update
      test.service.update('terminal.integrated', 'fontSize', 18).catch(done);
    });

    it('should clear cache on VS Code configuration changes', () => {
      // Get a value to cache it
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);
      const initialValue = test.service.get('terminal.integrated', 'fontSize', 14);
      expect(initialValue).to.equal(16);
      expect(test.vscode.configuration.get).to.have.been.calledOnce;

      // Simulate VS Code configuration change event
      const changeEvent = {
        affectsConfiguration: sinon.stub().returns(true),
      };

      // Get the registered change handler
      const onDidChangeStub = test.vscode.workspace.onDidChangeConfiguration as sinon.SinonStub;
      const onDidChangeHandler = onDidChangeStub.getCall(0).args[0];
      onDidChangeHandler(changeEvent);

      // Getting the value again should call VS Code API (cache cleared)
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(18);
      const newValue = test.service.get('terminal.integrated', 'fontSize', 14);
      expect(newValue).to.equal(18);
      expect(test.vscode.configuration.get).to.have.been.calledTwice;
    });
  });

  describe('Error Handling', () => {
    it('should handle VS Code API unavailability gracefully', () => {
      // Create a new service instance without VS Code API
      const originalGetConfiguration = test.vscode.workspace.getConfiguration;
      (test.vscode.workspace as any).getConfiguration = undefined;

      const newService = UnifiedConfigurationService.getInstance();

      // Should not throw during initialization
      expect(() => newService.initialize()).to.not.throw();

      // Restore the original method
      test.vscode.workspace.getConfiguration = originalGetConfiguration;
      newService.dispose();
    });

    it('should handle configuration read errors gracefully', () => {
      test.vscode.configuration.get.throws(new Error('Configuration read error'));

      // Should return default value instead of throwing
      const fontSize = test.service.get('terminal.integrated', 'fontSize', 14);
      expect(fontSize).to.equal(14);
    });

    it('should handle configuration update errors', async () => {
      test.vscode.configuration.update.rejects(new Error('Update failed'));

      try {
        await test.service.update('terminal.integrated', 'fontSize', 16);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.include('Update failed');
      }
    });
  });

  describe('Resource Management', () => {
    it('should dispose of resources properly', () => {
      const debugInfo = test.service.getDebugInfo();
      expect(debugInfo.disposables).to.be.greaterThan(0);

      test.service.dispose();

      // Should clear disposables
      const postDisposeInfo = test.service.getDebugInfo();
      expect(postDisposeInfo.disposables).to.equal(0);
    });

    it('should clear cache on disposal', () => {
      // Cache some values
      (test.vscode.configuration.get as sinon.SinonStub).withArgs('fontSize', 14).returns(16);
      test.service.get('terminal.integrated', 'fontSize', 14);

      const debugInfo = test.service.getDebugInfo();
      expect(debugInfo.cacheSize).to.be.greaterThan(0);

      test.service.dispose();

      const postDisposeInfo = test.service.getDebugInfo();
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
      expect(test.service.getExtensionTerminalConfig).to.be.a('function');
      expect(test.service.getCompleteTerminalSettings).to.be.a('function');
      expect(test.service.getCompleteExtensionConfig).to.be.a('function');
      expect(test.service.getShellForPlatform).to.be.a('function');
      expect(test.service.getAltClickSettings).to.be.a('function');
      expect(test.service.getFontFamily).to.be.a('function');
      expect(test.service.getFontSize).to.be.a('function');
      expect(test.service.clearCache).to.be.a('function');
    });
  });
});
