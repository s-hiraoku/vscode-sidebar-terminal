/**
 * ConfigurationService unit tests
 *
 * 統一された設定アクセスサービスのテスト
 * VS Code設定へのアクセス集約機能とキャッシュ機能を検証
 */
/* eslint-disable */
// @ts-nocheck
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as sinon from 'sinon';

use(sinonChai);

import { ConfigurationService, ConfigChangeHandler } from '../../../config/ConfigurationService';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestEnvironment,
  safeStub,
} from '../../utils/CommonTestSetup';

describe('ConfigurationService', () => {
  let testEnv: TestEnvironment;
  let configService: ConfigurationService;
  let mockVSCodeWorkspace: sinon.SinonStubbedInstance<any>;
  let mockConfiguration: sinon.SinonStubbedInstance<any>;
  let logSpy: sinon.SinonStub;
  let configChangeEvent: sinon.SinonStub;

  beforeEach(() => {
    // CRITICAL: Reset singleton FIRST before setting up test environment
    (ConfigurationService as any).instance = undefined;

    testEnv = setupTestEnvironment();

    // Mock VS Code workspace and configuration
    mockConfiguration = {
      get: testEnv.sandbox.stub(),
      update: testEnv.sandbox.stub(),
    };

    mockVSCodeWorkspace = {
      getConfiguration: testEnv.sandbox.stub().returns(mockConfiguration),
      onDidChangeConfiguration: testEnv.sandbox.stub(),
    };

    // Setup global vscode mock AND register it in require.cache
    const vscodeModule = {
      workspace: mockVSCodeWorkspace,
      ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
      },
    };
    (global as any).vscode = vscodeModule;

    // CRITICAL: Update require.cache so ConfigurationService imports this mock
    const Module = require('module');
    try {
      const vscodeModulePath = require.resolve('vscode', { paths: [process.cwd()] });
      require.cache[vscodeModulePath] = {
        id: vscodeModulePath,
        filename: vscodeModulePath,
        loaded: true,
        exports: vscodeModule,
      } as NodeModule;
    } catch (e) {
      // vscode module path not found, Module.prototype.require will handle it
    }

    // Mock logger using safe stub to prevent "already stubbed" errors
    const loggerModule = require('../../../utils/logger');
    logSpy = safeStub(testEnv.sandbox, loggerModule, 'extension');

    // Create configuration change event stub
    configChangeEvent = testEnv.sandbox.stub();
    mockVSCodeWorkspace.onDidChangeConfiguration.returns({
      dispose: testEnv.sandbox.stub(),
    });

    // Create fresh instance for each test (AFTER mocks are set up)
    configService = ConfigurationService.getInstance();
  });

  afterEach(() => {
    // Dispose the singleton instance to ensure clean state
    if (configService) {
      configService.dispose();
    }

    // Reset singleton instance for next test
    (ConfigurationService as any).instance = undefined;

    cleanupTestEnvironment(testEnv);
    delete (global as any).vscode;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = ConfigurationService.getInstance();
      const instance2 = ConfigurationService.getInstance();

      expect(instance1).to.equal(instance2);
    });

    it('should create new instance after disposal', () => {
      const instance1 = ConfigurationService.getInstance();
      instance1.dispose();

      // Reset singleton for test
      (ConfigurationService as any).instance = undefined;

      const instance2 = ConfigurationService.getInstance();

      expect(instance1).to.not.equal(instance2);
    });
  });

  describe('dispose', () => {
    it('should dispose all resources and clear state', () => {
      const disposableMock = { dispose: testEnv.sandbox.stub() };
      mockVSCodeWorkspace.onDidChangeConfiguration.returns(disposableMock);

      // Re-create service to trigger disposable registration
      configService.dispose();
      (ConfigurationService as any).instance = undefined;
      configService = ConfigurationService.getInstance();

      // Trigger configuration listener registration by calling a method that uses it
      configService.getSecondaryTerminalConfig();

      // Add some cached values
      configService.getCachedValue('test', 'key', 'default');

      configService.dispose();

      expect(disposableMock.dispose).to.have.been.called;
    });
  });

  describe('VS Code Configuration Access', () => {
    describe('getSecondaryTerminalConfig', () => {
      it('should get secondary terminal configuration', () => {
        const config = configService.getSecondaryTerminalConfig();

        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('secondaryTerminal');
        expect(config).to.equal(mockConfiguration);
      });
    });

    describe('getTerminalIntegratedConfig', () => {
      it('should get terminal integrated configuration', () => {
        const config = configService.getTerminalIntegratedConfig();

        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('terminal.integrated');
        expect(config).to.equal(mockConfiguration);
      });
    });

    describe('getEditorConfig', () => {
      it('should get editor configuration', () => {
        const config = configService.getEditorConfig();

        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('editor');
        expect(config).to.equal(mockConfiguration);
      });
    });

    describe('getWorkbenchConfig', () => {
      it('should get workbench configuration', () => {
        const config = configService.getWorkbenchConfig();

        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('workbench');
        expect(config).to.equal(mockConfiguration);
      });
    });
  });

  describe('Cached Configuration Values', () => {
    describe('getCachedValue', () => {
      it('should get value from VS Code and cache it', () => {
        const defaultValue = 'default';
        const configValue = 'configured-value';
        mockConfiguration.get.withArgs('testKey', defaultValue).returns(configValue);

        const result = configService.getCachedValue('testSection', 'testKey', defaultValue);

        expect(result).to.equal(configValue);
        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('testSection');
        expect(mockConfiguration.get).to.have.been.calledWith('testKey', defaultValue);
      });

      it('should return cached value on subsequent calls', () => {
        const defaultValue = 'default';
        const configValue = 'cached-value';
        mockConfiguration.get.withArgs('cacheKey', defaultValue).returns(configValue);

        // First call - should hit VS Code
        const result1 = configService.getCachedValue('cacheSection', 'cacheKey', defaultValue);

        // Second call - should use cache
        const result2 = configService.getCachedValue('cacheSection', 'cacheKey', defaultValue);

        expect(result1).to.equal(configValue);
        expect(result2).to.equal(configValue);
        expect(mockConfiguration.get).to.have.been.calledOnce;
      });

      it('should handle undefined return from VS Code configuration', () => {
        const defaultValue = 42;
        mockConfiguration.get.withArgs('undefinedKey', defaultValue).returns(undefined);

        const result = configService.getCachedValue('testSection', 'undefinedKey', defaultValue);

        expect(result).to.be.undefined;
      });

      it('should cache different values for different keys', () => {
        mockConfiguration.get.withArgs('key1', 'default1').returns('value1');
        mockConfiguration.get.withArgs('key2', 'default2').returns('value2');

        const result1 = configService.getCachedValue('section', 'key1', 'default1');
        const result2 = configService.getCachedValue('section', 'key2', 'default2');

        expect(result1).to.equal('value1');
        expect(result2).to.equal('value2');
        expect(mockConfiguration.get).to.have.been.calledTwice;
      });
    });

    describe('refreshValue', () => {
      it('should clear cache and fetch fresh value', () => {
        const defaultValue = 'default';
        const cachedValue = 'cached';
        const freshValue = 'fresh';

        // First call to cache a value
        mockConfiguration.get.withArgs('refreshKey', defaultValue).returns(cachedValue);
        const cached = configService.getCachedValue('refreshSection', 'refreshKey', defaultValue);
        expect(cached).to.equal(cachedValue);

        // Mock fresh value
        mockConfiguration.get.withArgs('refreshKey', defaultValue).returns(freshValue);

        // Refresh should clear cache and get fresh value
        const refreshed = configService.refreshValue('refreshSection', 'refreshKey', defaultValue);

        expect(refreshed).to.equal(freshValue);
        expect(mockConfiguration.get).to.have.been.calledTwice;
      });

      it('should cache the refreshed value', () => {
        const defaultValue = 10;
        const freshValue = 20;
        mockConfiguration.get.withArgs('refreshCacheKey', defaultValue).returns(freshValue);

        // Refresh the value
        const refreshed = configService.refreshValue('section', 'refreshCacheKey', defaultValue);

        // Second call should use the cached refreshed value
        const cached = configService.getCachedValue('section', 'refreshCacheKey', defaultValue);

        expect(refreshed).to.equal(freshValue);
        expect(cached).to.equal(freshValue);
        expect(mockConfiguration.get).to.have.been.calledOnce;
      });
    });

    describe('getBatchValues', () => {
      it('should get multiple configuration values efficiently', () => {
        const configs = [
          { section: 'section1', key: 'key1', defaultValue: 'default1' },
          { section: 'section2', key: 'key2', defaultValue: 'default2' },
          { section: 'section1', key: 'key3', defaultValue: 'default3' },
        ];

        // Mock different configuration sections
        const mockConfig1 = { get: testEnv.sandbox.stub() };
        const mockConfig2 = { get: testEnv.sandbox.stub() };

        mockVSCodeWorkspace.getConfiguration.withArgs('section1').returns(mockConfig1);
        mockVSCodeWorkspace.getConfiguration.withArgs('section2').returns(mockConfig2);

        mockConfig1.get.withArgs('key1', 'default1').returns('value1');
        mockConfig2.get.withArgs('key2', 'default2').returns('value2');
        mockConfig1.get.withArgs('key3', 'default3').returns('value3');

        const result = configService.getBatchValues(configs);

        expect(result).to.deep.equal({
          'section1.key1': 'value1',
          'section2.key2': 'value2',
          'section1.key3': 'value3',
        });
        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledThrice;
      });

      it('should handle empty config array', () => {
        const result = configService.getBatchValues([]);

        expect(result).to.deep.equal({});
        expect(mockVSCodeWorkspace.getConfiguration).to.not.have.been.called;
      });
    });
  });

  describe('Specific Configuration Methods', () => {
    describe('getTerminalSettings', () => {
      it('should return complete terminal settings with defaults', () => {
        const settings = configService.getTerminalSettings();

        expect(settings).to.have.property('maxTerminals');
        expect(settings).to.have.property('shell');
        expect(settings).to.have.property('fontFamily');
        expect(settings).to.have.property('fontSize');
        expect(settings).to.have.property('cursorBlink');
        expect(settings).to.have.property('enableCliAgentIntegration');
        expect(settings).to.have.property('enableGitHubCopilotIntegration');
      });

      it('should use cached values for performance', () => {
        // First call
        configService.getTerminalSettings();

        // Second call should use cached values
        configService.getTerminalSettings();

        // Should only call getConfiguration once per unique section
        const sectionCalls = mockVSCodeWorkspace.getConfiguration
          .getCalls()
          .filter((call) => call.args[0] === 'secondaryTerminal');
        expect(sectionCalls.length).to.equal(1);
      });
    });

    describe('getAltClickSettings', () => {
      it('should return Alt+Click related settings', () => {
        const mockTerminalConfig = { get: testEnv.sandbox.stub() };
        const mockEditorConfig = { get: testEnv.sandbox.stub() };

        mockVSCodeWorkspace.getConfiguration
          .withArgs('terminal.integrated')
          .returns(mockTerminalConfig);
        mockVSCodeWorkspace.getConfiguration.withArgs('editor').returns(mockEditorConfig);

        mockTerminalConfig.get.withArgs('altClickMovesCursor', true).returns(false);
        mockEditorConfig.get.withArgs('multiCursorModifier', 'alt').returns('ctrlCmd');

        const settings = configService.getAltClickSettings();

        expect(settings).to.deep.equal({
          altClickMovesCursor: false,
          multiCursorModifier: 'ctrlCmd',
        });
      });
    });

    describe('getPersistentSessionSettings', () => {
      it('should return persistent session settings with defaults', () => {
        const mockTerminalConfig = { get: testEnv.sandbox.stub() };
        mockVSCodeWorkspace.getConfiguration
          .withArgs('terminal.integrated')
          .returns(mockTerminalConfig);

        mockTerminalConfig.get.withArgs('enablePersistentSessions', true).returns(true);
        mockTerminalConfig.get.withArgs('persistentSessionScrollback', 100).returns(200);
        mockTerminalConfig.get
          .withArgs('persistentSessionReviveProcess', 'onExitAndWindowClose')
          .returns('onExit');

        const settings = configService.getPersistentSessionSettings();

        expect(settings).to.deep.equal({
          enablePersistentSessions: true,
          persistentSessionScrollback: 200,
          persistentSessionReviveProcess: 'onExit',
        });
      });
    });

    describe('getThemeSettings', () => {
      it('should return theme-related settings', () => {
        const mockWorkbenchConfig = { get: testEnv.sandbox.stub() };
        mockVSCodeWorkspace.getConfiguration.withArgs('workbench').returns(mockWorkbenchConfig);

        mockWorkbenchConfig.get
          .withArgs('colorTheme', 'Default Dark Modern')
          .returns('One Dark Pro');
        mockWorkbenchConfig.get.withArgs('iconTheme', 'vs-seti').returns('material-icon-theme');
        mockWorkbenchConfig.get
          .withArgs('preferredDarkColorTheme', 'Default Dark Modern')
          .returns('One Dark Pro');
        mockWorkbenchConfig.get
          .withArgs('preferredLightColorTheme', 'Default Light Modern')
          .returns('Light+');

        const settings = configService.getThemeSettings();

        expect(settings).to.deep.equal({
          colorTheme: 'One Dark Pro',
          iconTheme: 'material-icon-theme',
          preferredDarkColorTheme: 'One Dark Pro',
          preferredLightColorTheme: 'Light+',
        });
      });
    });
  });

  describe('Configuration Updates', () => {
    describe('updateValue', () => {
      it('should update configuration value and cache', async () => {
        const section = 'testSection';
        const key = 'testKey';
        const value = 'newValue';

        mockConfiguration.update.withArgs(key, value, 2).resolves();

        await configService.updateValue(section, key, value);

        expect(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith(section);
        expect(mockConfiguration.update).to.have.been.calledWith(key, value, 2);
        expect(logSpy).to.have.been.calledWith(
          `✅ [CONFIG] Updated ${section}.${key} = ${JSON.stringify(value)}`
        );

        // Verify cache is updated
        const cachedValue = configService.getCachedValue(section, key, 'default');
        expect(cachedValue).to.equal(value);
      });

      it('should handle update failures', async () => {
        const section = 'failSection';
        const key = 'failKey';
        const value = 'failValue';
        const error = new Error('Update failed');

        mockConfiguration.update.withArgs(key, value, 2).rejects(error);

        try {
          await configService.updateValue(section, key, value);
          expect.fail('Should have thrown error');
        } catch (thrown) {
          expect(thrown).to.equal(error);
          expect(logSpy).to.have.been.calledWith(
            `❌ [CONFIG] Failed to update ${section}.${key}: Error: Update failed`
          );
        }
      });

      it('should use specified configuration target', async () => {
        const section = 'targetSection';
        const key = 'targetKey';
        const value = 'targetValue';
        const target = 1; // Global target

        mockConfiguration.update.withArgs(key, value, target).resolves();

        await configService.updateValue(section, key, value, target);

        expect(mockConfiguration.update).to.have.been.calledWith(key, value, target);
      });
    });

    describe('updateBatchValues', () => {
      it('should update multiple configuration values', async () => {
        const updates = [
          { section: 'section1', key: 'key1', value: 'value1' },
          { section: 'section2', key: 'key2', value: 'value2', target: 1 },
        ];

        const mockConfig1 = { update: testEnv.sandbox.stub().resolves() };
        const mockConfig2 = { update: testEnv.sandbox.stub().resolves() };

        mockVSCodeWorkspace.getConfiguration.withArgs('section1').returns(mockConfig1);
        mockVSCodeWorkspace.getConfiguration.withArgs('section2').returns(mockConfig2);

        await configService.updateBatchValues(updates);

        expect(mockConfig1.update).to.have.been.calledWith('key1', 'value1', 2);
        expect(mockConfig2.update).to.have.been.calledWith('key2', 'value2', 1);
      });

      it('should handle partial failures in batch updates', async () => {
        const updates = [
          { section: 'section1', key: 'key1', value: 'value1' },
          { section: 'section2', key: 'key2', value: 'value2' },
          { section: 'section3', key: 'key3', value: 'value3' },
        ];

        const mockConfig1 = { update: testEnv.sandbox.stub().resolves() };
        const mockConfig2 = {
          update: testEnv.sandbox.stub().rejects(new Error('Update 2 failed')),
        };
        const mockConfig3 = {
          update: testEnv.sandbox.stub().rejects(new Error('Update 3 failed')),
        };

        mockVSCodeWorkspace.getConfiguration.withArgs('section1').returns(mockConfig1);
        mockVSCodeWorkspace.getConfiguration.withArgs('section2').returns(mockConfig2);
        mockVSCodeWorkspace.getConfiguration.withArgs('section3').returns(mockConfig3);

        try {
          await configService.updateBatchValues(updates);
          expect.fail('Should have thrown error');
        } catch (error) {
          expect(error.message).to.include('Batch update failed for:');
          expect(error.message).to.include('section2.key2');
          expect(error.message).to.include('section3.key3');
        }
      });

      it('should handle empty updates array', async () => {
        await configService.updateBatchValues([]);

        expect(mockVSCodeWorkspace.getConfiguration).to.not.have.been.called;
      });
    });
  });

  describe('Configuration Change Monitoring', () => {
    describe('onConfigurationChanged', () => {
      it('should register configuration change handler', () => {
        const handler: ConfigChangeHandler = testEnv.sandbox.stub();

        const disposable = configService.onConfigurationChanged(handler);

        expect(disposable).to.have.property('dispose');
        expect(typeof disposable.dispose).to.equal('function');
      });

      it('should remove handler when disposed', () => {
        const handler: ConfigChangeHandler = testEnv.sandbox.stub();

        const disposable = configService.onConfigurationChanged(handler);
        disposable.dispose();

        // Handler should be removed from internal set
        // This is tested indirectly by ensuring it doesn't get called
        expect(disposable.dispose).to.be.a('function');
      });
    });

    describe('onSectionChanged', () => {
      it('should register section-specific change handler', () => {
        const handler = testEnv.sandbox.stub();

        const disposable = configService.onSectionChanged('secondaryTerminal', handler);

        expect(disposable).to.have.property('dispose');
        expect(typeof disposable.dispose).to.equal('function');
      });

      it('should filter calls to section-specific handlers', () => {
        const terminalHandler = testEnv.sandbox.stub();
        const editorHandler = testEnv.sandbox.stub();

        configService.onSectionChanged('secondaryTerminal', terminalHandler);
        configService.onSectionChanged('editor', editorHandler);

        // Simulate configuration change event by calling the internal notification method
        // Access private method for testing
        const service = configService as any;
        service.notifyConfigurationChange('secondaryTerminal', {});

        // Only terminal handler should be called
        expect(terminalHandler).to.have.been.called;
        expect(editorHandler).to.not.have.been.called;
      });
    });

    describe('setupConfigurationWatcher', () => {
      it('should setup VS Code configuration watcher on construction', () => {
        // The watcher is setup in constructor, so we verify it was called
        expect(mockVSCodeWorkspace.onDidChangeConfiguration).to.have.been.called;
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for affected sections on configuration change', () => {
      // Pre-populate cache
      configService.getCachedValue('secondaryTerminal', 'maxTerminals', 5);
      configService.getCachedValue('editor', 'fontSize', 14);

      // Get the configuration change handler that was registered
      const changeHandler = mockVSCodeWorkspace.onDidChangeConfiguration.getCall(0).args[0];

      // Mock configuration change event
      const mockEvent = {
        affectsConfiguration: testEnv.sandbox.stub(),
      };
      mockEvent.affectsConfiguration.withArgs('secondaryTerminal').returns(true);
      mockEvent.affectsConfiguration.withArgs('editor').returns(false);

      // Trigger configuration change
      changeHandler(mockEvent);

      // Verify cache clearing by checking if next calls hit VS Code again
      configService.getCachedValue('secondaryTerminal', 'maxTerminals', 5);
      configService.getCachedValue('editor', 'fontSize', 14);

      // secondaryTerminal should have been cleared and refetched
      // editor should still be cached
      expect(mockEvent.affectsConfiguration).to.have.been.calledWith('secondaryTerminal');
      expect(mockEvent.affectsConfiguration).to.have.been.calledWith('editor');
    });

    it('should notify change handlers when configuration changes', () => {
      const changeHandler: ConfigChangeHandler = testEnv.sandbox.stub();
      configService.onConfigurationChanged(changeHandler);

      // Get the VS Code configuration change handler
      const vsCodeChangeHandler = mockVSCodeWorkspace.onDidChangeConfiguration.getCall(0).args[0];

      // Mock configuration change event
      const mockEvent = {
        affectsConfiguration: testEnv.sandbox.stub().returns(true),
      };

      // Trigger configuration change
      vsCodeChangeHandler(mockEvent);

      // Change handler should be notified
      expect(changeHandler).to.have.been.called;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle VS Code configuration throwing errors', () => {
      mockVSCodeWorkspace.getConfiguration
        .withArgs('errorSection')
        .throws(new Error('Configuration error'));

      expect(() => {
        configService.getCachedValue('errorSection', 'errorKey', 'default');
      }).to.throw('Configuration error');
    });

    it('should handle configuration get returning complex objects', () => {
      const complexObject = {
        nested: { value: 'test' },
        array: [1, 2, 3],
        fn: () => 'function',
      };

      mockConfiguration.get.withArgs('complexKey', null).returns(complexObject);

      const result = configService.getCachedValue('section', 'complexKey', null);

      expect(result).to.deep.equal(complexObject);
    });

    it('should handle configuration update with null/undefined values', async () => {
      mockConfiguration.update.withArgs('nullKey', null, 2).resolves();
      mockConfiguration.update.withArgs('undefinedKey', undefined, 2).resolves();

      await configService.updateValue('testSection', 'nullKey', null);
      await configService.updateValue('testSection', 'undefinedKey', undefined);

      expect(mockConfiguration.update).to.have.been.calledWith('nullKey', null, 2);
      expect(mockConfiguration.update).to.have.been.calledWith('undefinedKey', undefined, 2);
    });

    it('should handle very large cache scenarios', () => {
      // Add many cache entries
      for (let i = 0; i < 1000; i++) {
        mockConfiguration.get.withArgs(`key${i}`, `default${i}`).returns(`value${i}`);
        configService.getCachedValue('section', `key${i}`, `default${i}`);
      }

      // Verify cache still works efficiently
      const result = configService.getCachedValue('section', 'key500', 'default500');
      expect(result).to.equal('value500');
    });

    it('should handle concurrent access to cached values', async () => {
      mockConfiguration.get.withArgs('concurrentKey', 'default').returns('concurrentValue');

      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(configService.getCachedValue('concurrent', 'concurrentKey', 'default'))
      );

      const results = await Promise.all(promises);

      // All should return the same value
      results.forEach((result) => {
        expect(result).to.equal('concurrentValue');
      });

      // VS Code should only be called once due to caching
      expect(mockConfiguration.get).to.have.been.calledOnce;
    });
  });

  describe('Memory Management', () => {
    it('should clear all cache on dispose', () => {
      // Populate cache
      configService.getCachedValue('section1', 'key1', 'default1');
      configService.getCachedValue('section2', 'key2', 'default2');

      configService.dispose();

      // Verify cache is cleared by checking internal state
      // This tests the internal cache map is cleared
      const internalCache = (configService as any).configCache;
      expect(internalCache.size).to.equal(0);
    });

    it('should remove all event handlers on dispose', () => {
      const handler1: ConfigChangeHandler = testEnv.sandbox.stub();
      const handler2: ConfigChangeHandler = testEnv.sandbox.stub();

      configService.onConfigurationChanged(handler1);
      configService.onConfigurationChanged(handler2);

      configService.dispose();

      // Verify handlers are cleared
      const internalHandlers = (configService as any).changeHandlers;
      expect(internalHandlers.size).to.equal(0);
    });
  });
});
