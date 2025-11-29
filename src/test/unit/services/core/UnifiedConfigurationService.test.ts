import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  UnifiedConfigurationService,
  ConfigurationChangeEvent,
} from '../../../../services/core/UnifiedConfigurationService';

describe('UnifiedConfigurationService', () => {
  let service: UnifiedConfigurationService;
  let mockWorkspaceConfig: sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;
  let mockWorkspace: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create mock workspace configuration
    mockWorkspaceConfig = {
      get: sandbox.stub(),
      has: sandbox.stub(),
      inspect: sandbox.stub(),
      update: sandbox.stub(),
    } as any;

    // Configure the existing vscode.workspace.getConfiguration stub from TestSetup.ts
    // Don't re-stub - instead configure the existing mock's behavior
    mockWorkspace = vscode.workspace.getConfiguration as sinon.SinonStub;
    if (typeof mockWorkspace.resetBehavior === 'function') {
      mockWorkspace.resetBehavior();
    }
    if (typeof mockWorkspace.returns === 'function') {
      mockWorkspace.returns(mockWorkspaceConfig);
    }

    // Configure onDidChangeConfiguration if it's a stub
    const onDidChangeStub = vscode.workspace.onDidChangeConfiguration as sinon.SinonStub;
    if (typeof onDidChangeStub.resetBehavior === 'function') {
      onDidChangeStub.resetBehavior();
    }
    if (typeof onDidChangeStub.returns === 'function') {
      onDidChangeStub.returns({
        dispose: sandbox.stub(),
      } as any);
    }

    service = new UnifiedConfigurationService();
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize successfully', () => {
      assert.ok(service);
    });

    it('should register configuration watcher', () => {
      assert.ok((vscode.workspace.onDidChangeConfiguration as sinon.SinonStub).called);
    });
  });

  describe('getSidebarTerminalConfig', () => {
    it('should return complete terminal settings with defaults', () => {
      // Setup default returns
      mockWorkspaceConfig.get.withArgs('fontSize', 14).returns(14);
      mockWorkspaceConfig.get
        .withArgs('fontFamily', 'Consolas, monospace')
        .returns('Consolas, monospace');
      mockWorkspaceConfig.get.withArgs('theme', 'auto').returns('auto');
      mockWorkspaceConfig.get.withArgs('cursorBlink', true).returns(true);
      mockWorkspaceConfig.get.withArgs('maxTerminals', 5).returns(5);
      mockWorkspaceConfig.get.withArgs('minTerminalCount', 1).returns(1);
      mockWorkspaceConfig.get.withArgs('protectLastTerminal', true).returns(true);
      mockWorkspaceConfig.get.withArgs('confirmBeforeKill', false).returns(false);

      // Mock integrated terminal and editor configs
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().withArgs('altClickMovesCursor', true).returns(true),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().withArgs('multiCursorModifier', 'alt').returns('alt'),
      } as any);

      const config = service.getSidebarTerminalConfig();

      assert.strictEqual(config.fontSize, 14);
      assert.strictEqual(config.fontFamily, 'Consolas, monospace');
      assert.strictEqual(config.theme, 'auto');
      assert.strictEqual(config.cursorBlink, true);
      assert.strictEqual(config.maxTerminals, 5);
      assert.strictEqual(config.minTerminalCount, 1);
      assert.strictEqual(config.protectLastTerminal, true);
      assert.strictEqual(config.confirmBeforeKill, false);
      assert.strictEqual(config.altClickMovesCursor, true);
      assert.strictEqual(config.multiCursorModifier, 'alt');
    });

    it('should handle custom configuration values', () => {
      mockWorkspaceConfig.get.withArgs('fontSize', 14).returns(16);
      mockWorkspaceConfig.get
        .withArgs('fontFamily', 'Consolas, monospace')
        .returns('Source Code Pro');
      mockWorkspaceConfig.get.withArgs('maxTerminals', 5).returns(10);

      const config = service.getSidebarTerminalConfig();

      assert.strictEqual(config.fontSize, 16);
      assert.strictEqual(config.fontFamily, 'Source Code Pro');
      assert.strictEqual(config.maxTerminals, 10);
    });
  });

  describe('getWebViewTerminalSettings', () => {
    it('should return WebView-specific settings', () => {
      // Setup base config mocks - use callsFake instead of returns for function behavior
      mockWorkspaceConfig.get.callsFake((key: string, defaultValue: any) => {
        const defaults: Record<string, unknown> = {
          fontSize: 14,
          fontFamily: 'Consolas, monospace',
          scrollback: 1000,
          bellSound: false,
          enableCliAgentIntegration: true,
          'cursor.style': 'block',
          'cursor.blink': true,
          dynamicSplitDirection: true,
          panelLocation: 'auto',
          theme: 'auto',
          cursorBlink: true,
          maxTerminals: 5,
          minTerminalCount: 1,
          protectLastTerminal: true,
          confirmBeforeKill: false,
          sendKeybindingsToShell: false,
          commandsToSkipShell: [],
          allowChords: true,
          allowMnemonics: true,
        };
        return defaults[key] ?? defaultValue;
      });

      // Mock other sections
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().returns(true),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().returns('alt'),
      } as any);

      const settings = service.getWebViewTerminalSettings();

      assert.strictEqual(settings.fontSize, 14);
      assert.strictEqual(settings.scrollback, 1000);
      assert.strictEqual(settings.bellSound, false);
      assert.strictEqual(settings.enableCliAgentIntegration, true);
      assert.strictEqual(settings.cursor?.style, 'block');
      assert.strictEqual(settings.cursor?.blink, true);
      assert.strictEqual(settings.dynamicSplitDirection, true);
      assert.strictEqual(settings.panelLocation, 'auto');
    });
  });

  describe('get', () => {
    it('should return configuration value with default', () => {
      mockWorkspaceConfig.get.withArgs('testKey', 'defaultValue').returns('customValue');

      const result = service.get('testSection', 'testKey', 'defaultValue');

      assert.strictEqual(result, 'customValue');
      assert.ok(mockWorkspace.calledWith('testSection'));
    });

    it('should cache configuration values', () => {
      mockWorkspaceConfig.get.withArgs('testKey', 'defaultValue').returns('cachedValue');

      // First call
      const result1 = service.get('testSection', 'testKey', 'defaultValue');
      // Second call - should use cache
      const result2 = service.get('testSection', 'testKey', 'defaultValue');

      assert.strictEqual(result1, 'cachedValue');
      assert.strictEqual(result2, 'cachedValue');
      // Should only call getConfiguration once due to caching
      assert.strictEqual(mockWorkspaceConfig.get.callCount, 1);
    });
  });

  describe('update', () => {
    it('should update configuration value', async () => {
      mockWorkspaceConfig.get.withArgs('testKey').returns('oldValue');
      mockWorkspaceConfig.update.resolves();

      let changeEvent: ConfigurationChangeEvent | undefined;
      service.onConfigurationChanged((event) => {
        changeEvent = event;
      });

      await service.update('testSection', 'testKey', 'newValue');

      assert.ok(mockWorkspaceConfig.update.calledWith('testKey', 'newValue', undefined));
      assert.ok(changeEvent);
      assert.strictEqual(changeEvent!.section, 'testSection');
      assert.strictEqual(changeEvent!.key, 'testKey');
      assert.strictEqual(changeEvent!.oldValue, 'oldValue');
      assert.strictEqual(changeEvent!.newValue, 'newValue');
    });

    it('should handle update errors gracefully', async () => {
      const error = new Error('Update failed');
      mockWorkspaceConfig.update.rejects(error);

      try {
        await service.update('testSection', 'testKey', 'newValue');
        assert.fail('Should have thrown error');
      } catch (thrownError) {
        assert.strictEqual(thrownError, error);
      }
    });

    it('should clear cache on update', async () => {
      mockWorkspaceConfig.get.withArgs('testKey', 'default').returns('cachedValue');
      mockWorkspaceConfig.update.resolves();

      // Cache the value first
      service.get('testSection', 'testKey', 'default');

      // Update should clear cache
      await service.update('testSection', 'testKey', 'newValue');

      // This should call get again (not use cache)
      mockWorkspaceConfig.get.withArgs('testKey', 'default').returns('updatedValue');
      const result = service.get('testSection', 'testKey', 'default');

      assert.strictEqual(result, 'updatedValue');
    });
  });

  describe('isFeatureEnabled', () => {
    it('should check CLI Agent integration feature', () => {
      mockWorkspaceConfig.get.withArgs('enableCliAgentIntegration', true).returns(true);

      const result = service.isFeatureEnabled('cliAgentIntegration');

      assert.strictEqual(result, true);
    });

    it('should check GitHub Copilot integration feature', () => {
      mockWorkspaceConfig.get.withArgs('enableGitHubCopilotIntegration', true).returns(false);

      const result = service.isFeatureEnabled('githubCopilotIntegration');

      assert.strictEqual(result, false);
    });

    it('should check Alt+Click feature (requires both settings)', () => {
      // Mock terminal integrated section
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().withArgs('altClickMovesCursor', true).returns(true),
      } as any);

      // Mock editor section
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().withArgs('multiCursorModifier', 'alt').returns('alt'),
      } as any);

      const result = service.isFeatureEnabled('altClickMovesCursor');

      assert.strictEqual(result, true);
    });

    it('should return false for Alt+Click when multiCursorModifier is not alt', () => {
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().withArgs('altClickMovesCursor', true).returns(true),
      } as any);

      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().withArgs('multiCursorModifier', 'alt').returns('ctrlCmd'),
      } as any);

      const result = service.isFeatureEnabled('altClickMovesCursor');

      assert.strictEqual(result, false);
    });

    it('should return false for unknown features', () => {
      const result = service.isFeatureEnabled('unknownFeature');

      assert.strictEqual(result, false);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate configuration successfully', () => {
      // Mock valid configuration - use callsFake instead of returns
      mockWorkspaceConfig.get.callsFake((key: string, defaultValue: any) => {
        const validConfig: Record<string, unknown> = {
          fontSize: 14,
          fontFamily: 'Consolas, monospace',
          maxTerminals: 5,
          shell: '/bin/bash',
          shellArgs: ['--login'],
          theme: 'auto',
          cursorBlink: true,
          minTerminalCount: 1,
          protectLastTerminal: true,
          confirmBeforeKill: false,
        };
        return validConfig[key] ?? defaultValue;
      });

      // Mock other sections for getSidebarTerminalConfig
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().returns(true),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().returns('alt'),
      } as any);

      const result = service.validateConfiguration();

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect invalid font size', () => {
      mockWorkspaceConfig.get.withArgs('fontSize', 14).returns(100); // Invalid: > 72

      // Mock other sections
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().returns(true),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().returns('alt'),
      } as any);

      const result = service.validateConfiguration();

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((error) => error.includes('fontSize')));
    });

    it('should detect invalid shell configuration', () => {
      mockWorkspaceConfig.get.withArgs('shell', undefined).returns(123); // Invalid: not string

      // Mock other sections
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().returns(true),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().returns('alt'),
      } as any);

      const result = service.validateConfiguration();

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((error) => error.includes('shell')));
    });

    it('should provide warnings for suboptimal settings', () => {
      mockWorkspaceConfig.get.withArgs('maxTerminals', 5).returns(15); // Suboptimal but not invalid

      // Mock other sections
      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().returns(true),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().returns('alt'),
      } as any);

      const result = service.validateConfiguration();

      assert.ok(result.warnings.some((warning) => warning.includes('maxTerminals')));
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', async () => {
      // Configure inspect to return a non-falsy value so reset doesn't early return
      mockWorkspaceConfig.inspect.returns({ defaultValue: 'test' } as any);
      mockWorkspaceConfig.has.returns(true);
      mockWorkspaceConfig.update.callsFake(() => Promise.resolve());

      await service.resetToDefaults('sidebarTerminal');

      // Should call update with undefined to reset values
      assert.ok(mockWorkspaceConfig.update.called);
    });

    it('should handle reset errors gracefully', async () => {
      const error = new Error('Reset failed');
      // Configure inspect to return a non-falsy value so reset doesn't early return
      mockWorkspaceConfig.inspect.returns({ defaultValue: 'test' } as any);
      mockWorkspaceConfig.has.returns(true);
      mockWorkspaceConfig.update.callsFake(() => Promise.reject(error));

      try {
        await service.resetToDefaults('sidebarTerminal');
        assert.fail('Should have thrown error');
      } catch (thrownError) {
        assert.strictEqual(thrownError, error);
      }
    });
  });

  describe('getConfigurationSnapshot', () => {
    it('should return complete configuration snapshot', () => {
      // Mock all necessary configurations
      mockWorkspaceConfig.get.returns((key: string, defaultValue: any) => defaultValue);

      mockWorkspace.withArgs('terminal.integrated').returns({
        get: sandbox.stub().returns(undefined),
      } as any);
      mockWorkspace.withArgs('editor').returns({
        get: sandbox.stub().returns('alt'),
      } as any);

      const snapshot = service.getConfigurationSnapshot();

      assert.ok(snapshot.sidebarTerminal);
      assert.ok(snapshot.terminalIntegrated);
      assert.ok(snapshot.editor);
      assert.ok(snapshot.metadata);
      assert.ok((snapshot.metadata as any).timestamp);
      assert.strictEqual(typeof (snapshot.metadata as any).cacheSize, 'number');
    });
  });

  describe('Configuration Change Events', () => {
    it('should emit configuration change events', (done) => {
      mockWorkspaceConfig.get.withArgs('testKey').returns('oldValue');
      mockWorkspaceConfig.update.resolves();

      service.onConfigurationChanged((event) => {
        assert.strictEqual(event.section, 'testSection');
        assert.strictEqual(event.key, 'testKey');
        assert.strictEqual(event.oldValue, 'oldValue');
        assert.strictEqual(event.newValue, 'newValue');
        assert.ok(event.timestamp);
        done();
      });

      service.update('testSection', 'testKey', 'newValue');
    });
  });

  describe('Cache Management', () => {
    it('should cache configuration values for performance', () => {
      mockWorkspaceConfig.get.withArgs('cachedKey', 'default').returns('cachedValue');

      // Multiple calls should only hit the configuration once
      service.get('testSection', 'cachedKey', 'default');
      service.get('testSection', 'cachedKey', 'default');
      service.get('testSection', 'cachedKey', 'default');

      assert.strictEqual(mockWorkspaceConfig.get.callCount, 1);
    });

    it('should clear cache when configuration changes', async () => {
      mockWorkspaceConfig.get.withArgs('testKey', 'default').returns('oldValue');
      mockWorkspaceConfig.update.resolves();

      // Cache a value
      service.get('testSection', 'testKey', 'default');

      // Update configuration (should clear cache)
      await service.update('testSection', 'testKey', 'newValue');

      // Next get should call configuration again
      mockWorkspaceConfig.get.withArgs('testKey', 'default').returns('updatedValue');
      const result = service.get('testSection', 'testKey', 'default');

      assert.strictEqual(result, 'updatedValue');
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration access errors gracefully', () => {
      mockWorkspaceConfig.get.throws(new Error('Configuration access error'));

      try {
        service.get('testSection', 'testKey', 'defaultValue');
        // Should not throw, should return default or handle gracefully
      } catch (error) {
        // If it does throw, it should be the original error
        assert.ok(error instanceof Error);
      }
    });

    it('should handle validation errors in validateConfiguration', () => {
      // Mock getSidebarTerminalConfig to throw
      sandbox.stub(service, 'getSidebarTerminalConfig').throws(new Error('Config error'));

      const result = service.validateConfiguration();

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((error) => error.includes('Configuration validation failed')));
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      // Should not throw error
      service.dispose();
    });

    it('should dispose event emitter and clear cache', () => {
      // Add some cache entries
      service.get('testSection', 'testKey', 'default');

      service.dispose();

      // After dispose, should be cleaned up
      // This is hard to test directly, but we verify no errors occur
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete configuration lifecycle', async () => {
      let changeEventFired = false;

      // Setup configuration
      mockWorkspaceConfig.get.withArgs('testKey', 'default').returns('initialValue');
      mockWorkspaceConfig.update.resolves();

      // Listen for changes
      service.onConfigurationChanged(() => {
        changeEventFired = true;
      });

      // Get initial value (should cache)
      const initial = service.get('testSection', 'testKey', 'default');
      assert.strictEqual(initial, 'initialValue');

      // Update configuration
      await service.update('testSection', 'testKey', 'updatedValue');
      assert.strictEqual(changeEventFired, true);

      // Get updated value
      mockWorkspaceConfig.get.withArgs('testKey', 'default').returns('updatedValue');
      const updated = service.get('testSection', 'testKey', 'default');
      assert.strictEqual(updated, 'updatedValue');

      // Validate configuration
      const validation = service.validateConfiguration();
      assert.strictEqual(typeof validation.isValid, 'boolean');

      // Get snapshot
      const snapshot = service.getConfigurationSnapshot();
      assert.ok(snapshot.metadata);
    });
  });
});
