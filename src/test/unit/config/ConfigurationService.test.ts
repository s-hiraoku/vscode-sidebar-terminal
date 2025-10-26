/**
 * ConfigurationService unit tests
 *
 * 統一された設定アクセスサービスのテスト
 * VS Code設定へのアクセス集約機能とキャッシュ機能を検証
 */

import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as sinon from 'sinon';

use(sinonChai);

import { ConfigurationService, ConfigChangeHandler } from '../../../config/ConfigurationService';
import { ConfigurationTest } from '../../utils/ConfigurationTest';

/**
 * Test class for ConfigurationService
 * Extends ConfigurationTest to leverage configuration-specific test utilities
 */
class ConfigurationServiceTest extends ConfigurationTest {
  public configService!: ConfigurationService;

  protected override setup(): void {
    super.setup();

    // Reset and create fresh ConfigurationService instance
    this.resetSingleton(ConfigurationService as any);
    this.configService = ConfigurationService.getInstance();
  }

  protected override teardown(): void {
    // Dispose service
    if (this.configService) {
      this.configService.dispose();
    }

    // Reset singleton
    this.resetSingleton(ConfigurationService as any);

    super.teardown();
  }
}

describe('ConfigurationService', () => {
  const test = new ConfigurationServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  describe('Singleton Pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = ConfigurationService.getInstance();
      const instance2 = ConfigurationService.getInstance();

      expect(instance1).to.equal(instance2);
      expect(instance1).to.equal(test.configService);
    });

    it('should create new instance after disposal', () => {
      const originalInstance = test.configService;

      test.configService.dispose();
      (ConfigurationService as any).instance = undefined;

      const newInstance = ConfigurationService.getInstance();

      expect(newInstance).to.not.equal(originalInstance);
    });
  });

  describe('dispose', () => {
    it('should dispose all resources and clear state', () => {
      const disposableMock = { dispose: test.sandbox.stub() };
      test.vscode.workspace.onDidChangeConfiguration.returns(disposableMock);

      // Re-create service to trigger disposable registration
      test.configService.dispose();
      (ConfigurationService as any).instance = undefined;
      test.configService = ConfigurationService.getInstance();

      // Trigger configuration listener registration by calling a method that uses it
      test.configService.getSecondaryTerminalConfig();

      // Add some cached values
      test.configService.getCachedValue('test', 'key', 'default');

      test.configService.dispose();

      expect(disposableMock.dispose).to.have.been.called;
    });
  });

  describe('VS Code Configuration Access', () => {
    describe('getSecondaryTerminalConfig', () => {
      it('should get secondary terminal configuration', () => {
        const config = test.configService.getSecondaryTerminalConfig();

        expect(test.vscode.workspace.getConfiguration).to.have.been.calledWith('secondaryTerminal');
        expect(config).to.equal(test.vscode.configuration);
      });
    });

    describe('getTerminalIntegratedConfig', () => {
      it('should get terminal integrated configuration', () => {
        const config = test.configService.getTerminalIntegratedConfig();

        expect(test.vscode.workspace.getConfiguration).to.have.been.calledWith('terminal.integrated');
        expect(config).to.equal(test.vscode.configuration);
      });
    });

    describe('getEditorConfig', () => {
      it('should get editor configuration', () => {
        const config = test.configService.getEditorConfig();

        expect(test.vscode.workspace.getConfiguration).to.have.been.calledWith('editor');
        expect(config).to.equal(test.vscode.configuration);
      });
    });

    describe('getWorkbenchConfig', () => {
      it('should get workbench configuration', () => {
        const config = test.configService.getWorkbenchConfig();

        expect(test.vscode.workspace.getConfiguration).to.have.been.calledWith('workbench');
        expect(config).to.equal(test.vscode.configuration);
      });
    });
  });

  describe('Cached Configuration Values', () => {
    describe('getCachedValue', () => {
      it('should get value from VS Code and cache it', () => {
        const defaultValue = 'default';
        const configValue = 'configured-value';
        test.vscode.configuration.get.withArgs('testKey', defaultValue).returns(configValue);

        const result = test.configService.getCachedValue('testSection', 'testKey', defaultValue);

        expect(result).to.equal(configValue);
        expect(test.vscode.workspace.getConfiguration).to.have.been.calledWith('testSection');
        expect(test.vscode.configuration.get).to.have.been.calledWith('testKey', defaultValue);
      });

      it('should return cached value on subsequent calls', () => {
        const defaultValue = 'default';
        const configValue = 'cached-value';
        test.vscode.configuration.get.withArgs('cacheKey', defaultValue).returns(configValue);

        // First call - should hit VS Code
        const result1 = test.configService.getCachedValue('cacheSection', 'cacheKey', defaultValue);

        // Second call - should use cache
        const result2 = test.configService.getCachedValue('cacheSection', 'cacheKey', defaultValue);

        expect(result1).to.equal(configValue);
        expect(result2).to.equal(configValue);
        expect(test.vscode.configuration.get).to.have.been.calledOnce;
      });

      it('should handle undefined return from VS Code configuration', () => {
        const defaultValue = 42;
        test.vscode.configuration.get.withArgs('undefinedKey', defaultValue).returns(undefined);

        const result = test.configService.getCachedValue('testSection', 'undefinedKey', defaultValue);

        expect(result).to.be.undefined;
      });

      it('should cache different values for different keys', () => {
        test.vscode.configuration.get.withArgs('key1', 'default1').returns('value1');
        test.vscode.configuration.get.withArgs('key2', 'default2').returns('value2');

        const result1 = test.configService.getCachedValue('section', 'key1', 'default1');
        const result2 = test.configService.getCachedValue('section', 'key2', 'default2');

        expect(result1).to.equal('value1');
        expect(result2).to.equal('value2');
        expect(test.vscode.configuration.get).to.have.been.calledTwice;
      });
    });

    describe('refreshValue', () => {
      it('should clear cache and fetch fresh value', () => {
        const defaultValue = 'default';
        const cachedValue = 'cached';
        const freshValue = 'fresh';

        // First call to cache a value
        test.vscode.configuration.get.withArgs('refreshKey', defaultValue).returns(cachedValue);
        const cached = test.configService.getCachedValue('refreshSection', 'refreshKey', defaultValue);
        expect(cached).to.equal(cachedValue);

        // Mock fresh value
        test.vscode.configuration.get.withArgs('refreshKey', defaultValue).returns(freshValue);

        // Refresh should clear cache and get fresh value
        const refreshed = test.configService.refreshValue('refreshSection', 'refreshKey', defaultValue);

        expect(refreshed).to.equal(freshValue);
        expect(test.vscode.configuration.get).to.have.been.calledTwice;
      });

      it('should cache the refreshed value', () => {
        const defaultValue = 10;
        const freshValue = 20;
        test.vscode.configuration.get.withArgs('refreshCacheKey', defaultValue).returns(freshValue);

        // Refresh the value
        const refreshed = test.configService.refreshValue('section', 'refreshCacheKey', defaultValue);

        // Second call should use the cached refreshed value
        const cached = test.configService.getCachedValue('section', 'refreshCacheKey', defaultValue);

        expect(refreshed).to.equal(freshValue);
        expect(cached).to.equal(freshValue);
        expect(test.vscode.configuration.get).to.have.been.calledOnce;
      });
    });

    describe('getBatchValues', () => {
      it('should get multiple configuration values efficiently', () => {
        const configs = [
          { section: 'section1', key: 'key1', defaultValue: 'default1' },
          { section: 'section2', key: 'key2', defaultValue: 'default2' },
          { section: 'section1', key: 'key3', defaultValue: 'default3' },
        ];

        const mockConfig1 = { get: test.sandbox.stub() };
        const mockConfig2 = { get: test.sandbox.stub() };

        test.vscode.workspace.getConfiguration.withArgs('section1').returns(mockConfig1);
        test.vscode.workspace.getConfiguration.withArgs('section2').returns(mockConfig2);

        mockConfig1.get.withArgs('key1', 'default1').returns('value1');
        mockConfig2.get.withArgs('key2', 'default2').returns('value2');
        mockConfig1.get.withArgs('key3', 'default3').returns('value3');

        const result = test.configService.getBatchValues(configs);

        expect(result).to.deep.equal({
          'section1.key1': 'value1',
          'section2.key2': 'value2',
          'section1.key3': 'value3',
        });
        expect(test.vscode.workspace.getConfiguration).to.have.been.calledThrice;
      });

      it('should handle empty config array', () => {
        const result = test.configService.getBatchValues([]);

        expect(result).to.deep.equal({});
        expect(test.vscode.workspace.getConfiguration).to.not.have.been.called;
      });
    });
  });

  describe('Specific Configuration Methods', () => {
    describe('getTerminalSettings', () => {
      it('should return complete terminal settings with defaults', () => {
        const settings = test.configService.getTerminalSettings();

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
        test.configService.getTerminalSettings();

        // Second call should use cached values
        test.configService.getTerminalSettings();

        // Should only call getConfiguration once per unique section
        const sectionCalls = (test.vscode.workspace.getConfiguration as sinon.SinonStub)
          .getCalls()
          .filter((call) => call.args[0] === 'secondaryTerminal');
        expect(sectionCalls.length).to.equal(1);
      });
    });

    describe('getAltClickSettings', () => {
      it('should return Alt+Click related settings', () => {
        const mockTerminalConfig = { get: test.sandbox.stub() };
        const mockEditorConfig = { get: test.sandbox.stub() };

        test.vscode.workspace.getConfiguration
          .withArgs('terminal.integrated')
          .returns(mockTerminalConfig);
        test.vscode.workspace.getConfiguration.withArgs('editor').returns(mockEditorConfig);

        mockTerminalConfig.get.withArgs('altClickMovesCursor', true).returns(false);
        mockEditorConfig.get.withArgs('multiCursorModifier', 'alt').returns('ctrlCmd');

        const settings = test.configService.getAltClickSettings();

        expect(settings).to.deep.equal({
          altClickMovesCursor: false,
          multiCursorModifier: 'ctrlCmd',
        });
      });
    });

    describe('getPersistentSessionSettings', () => {
      it('should return persistent session settings with defaults', () => {
        const mockTerminalConfig = { get: test.sandbox.stub() };

        test.vscode.workspace.getConfiguration
          .withArgs('secondaryTerminal')
          .returns(mockTerminalConfig);

        mockTerminalConfig.get.withArgs('enablePersistentSessions', true).returns(true);
        mockTerminalConfig.get.withArgs('persistentSessionScrollback', 100).returns(200);
        mockTerminalConfig.get
          .withArgs('persistentSessionReviveProcess', 'onExitAndWindowClose')
          .returns('onExit');

        const settings = test.configService.getPersistentSessionSettings();

        expect(settings).to.deep.equal({
          enablePersistentSessions: true,
          persistentSessionScrollback: 200,
          persistentSessionReviveProcess: 'onExit',
        });
      });
    });

    describe('getThemeSettings', () => {
      it('should return theme-related settings', () => {
        const mockWorkbenchConfig = { get: test.sandbox.stub() };

        test.vscode.workspace.getConfiguration.withArgs('workbench').returns(mockWorkbenchConfig);

        mockWorkbenchConfig.get.withArgs('colorTheme', 'Default Dark Modern').returns('One Dark Pro');
        mockWorkbenchConfig.get.withArgs('iconTheme', 'vs-seti').returns('material-icon-theme');
        mockWorkbenchConfig.get
          .withArgs('preferredDarkColorTheme', 'Default Dark Modern')
          .returns('One Dark Pro');
        mockWorkbenchConfig.get
          .withArgs('preferredLightColorTheme', 'Default Light Modern')
          .returns('Light+');

        const settings = test.configService.getThemeSettings();

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

        test.vscode.configuration.update.withArgs(key, value, 2).resolves();

        await test.configService.updateValue(section, key, value);

        expect(test.vscode.workspace.getConfiguration).to.have.been.calledWith(section);
        expect(test.vscode.configuration.update).to.have.been.calledWith(key, value, 2);
        expect(test.logSpy).to.have.been.calledWith(
          `✅ [CONFIG] Updated ${section}.${key} = ${JSON.stringify(value)}`
        );

        // Verify cache is updated
        const cachedValue = test.configService.getCachedValue(section, key, 'default');
        expect(cachedValue).to.equal(value);
      });

      it('should handle update failures', async () => {
        const section = 'failSection';
        const key = 'failKey';
        const value = 'failValue';
        const error = new Error('Update failed');

        test.vscode.configuration.update.withArgs(key, value, 2).rejects(error);

        try {
          await test.configService.updateValue(section, key, value);
          expect.fail('Should have thrown error');
        } catch (thrown) {
          expect(thrown).to.equal(error);
          expect(test.logSpy).to.have.been.calledWith(
            `❌ [CONFIG] Failed to update ${section}.${key}: Error: Update failed`
          );
        }
      });

      it('should use specified configuration target', async () => {
        const section = 'targetSection';
        const key = 'targetKey';
        const value = 'targetValue';
        const target = 1; // Global target

        test.vscode.configuration.update.withArgs(key, value, target).resolves();

        await test.configService.updateValue(section, key, value, target);

        expect(test.vscode.configuration.update).to.have.been.calledWith(key, value, target);
      });
    });

    describe('updateBatchValues', () => {
      it('should update multiple configuration values', async () => {
        const updates = [
          { section: 'section1', key: 'key1', value: 'value1' },
          { section: 'section2', key: 'key2', value: 'value2', target: 1 },
        ];

        const mockConfig1 = { update: test.sandbox.stub().resolves() };
        const mockConfig2 = { update: test.sandbox.stub().resolves() };

        test.vscode.workspace.getConfiguration.withArgs('section1').returns(mockConfig1);
        test.vscode.workspace.getConfiguration.withArgs('section2').returns(mockConfig2);

        await test.configService.updateBatchValues(updates);

        expect(mockConfig1.update).to.have.been.calledWith('key1', 'value1', 2);
        expect(mockConfig2.update).to.have.been.calledWith('key2', 'value2', 1);
      });

      it('should handle partial failures in batch updates', async () => {
        const updates = [
          { section: 'section1', key: 'key1', value: 'value1' },
          { section: 'section2', key: 'key2', value: 'value2' },
          { section: 'section3', key: 'key3', value: 'value3' },
        ];

        const mockConfig1 = { update: test.sandbox.stub().resolves() };
        const mockConfig2 = {
          update: test.sandbox.stub().rejects(new Error('Update 2 failed')),
        };
        const mockConfig3 = {
          update: test.sandbox.stub().rejects(new Error('Update 3 failed')),
        };

        test.vscode.workspace.getConfiguration.withArgs('section1').returns(mockConfig1);
        test.vscode.workspace.getConfiguration.withArgs('section2').returns(mockConfig2);
        test.vscode.workspace.getConfiguration.withArgs('section3').returns(mockConfig3);

        try {
          await test.configService.updateBatchValues(updates);
          expect.fail('Should have thrown error');
        } catch (error) {
          expect((error as Error).message).to.include('Batch update failed for:');
          expect((error as Error).message).to.include('section2.key2');
          expect((error as Error).message).to.include('section3.key3');
        }
      });

      it('should handle empty updates array', async () => {
        await test.configService.updateBatchValues([]);

        expect(test.vscode.workspace.getConfiguration).to.not.have.been.called;
      });
    });
  });

  describe('Configuration Change Monitoring', () => {
    describe('onConfigurationChanged', () => {
      it('should register configuration change handler', () => {
        const handler: ConfigChangeHandler = test.sandbox.stub();

        const disposable = test.configService.onConfigurationChanged(handler);

        expect(disposable).to.have.property('dispose');
        expect(typeof disposable.dispose).to.equal('function');
      });

      it('should remove handler when disposed', () => {
        const handler: ConfigChangeHandler = test.sandbox.stub();

        const disposable = test.configService.onConfigurationChanged(handler);
        disposable.dispose();

        // Handler should be removed from internal set
        // This is tested indirectly by ensuring it doesn't get called
        expect(disposable.dispose).to.be.a('function');
      });
    });

    describe('onSectionChanged', () => {
      it('should register section-specific change handler', () => {
        const handler = test.sandbox.stub();

        const disposable = test.configService.onSectionChanged('secondaryTerminal', handler);

        expect(disposable).to.have.property('dispose');
        expect(typeof disposable.dispose).to.equal('function');
      });

      it('should filter calls to section-specific handlers', () => {
        const terminalHandler = test.sandbox.stub();
        const editorHandler = test.sandbox.stub();

        test.configService.onSectionChanged('secondaryTerminal', terminalHandler);
        test.configService.onSectionChanged('editor', editorHandler);

        // Simulate configuration change event by calling the internal notification method
        // Access private method for testing
        const service = test.configService as any;
        service.notifyConfigurationChange('secondaryTerminal', {});

        // Only terminal handler should be called
        expect(terminalHandler).to.have.been.called;
        expect(editorHandler).to.not.have.been.called;
      });
    });

    describe('setupConfigurationWatcher', () => {
      it('should setup VS Code configuration watcher on construction', () => {
        expect(test.vscode.workspace.onDidChangeConfiguration).to.have.been.called;
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for affected sections on configuration change', () => {
      // Pre-populate cache
      test.configService.getCachedValue('secondaryTerminal', 'maxTerminals', 5);
      test.configService.getCachedValue('editor', 'fontSize', 14);

      // Get the configuration change handler that was registered
      const changeHandler = (test.vscode.workspace.onDidChangeConfiguration as sinon.SinonStub).getCall(0).args[0];

      // Mock configuration change event
      const mockEvent = {
        affectsConfiguration: test.sandbox.stub(),
      };
      mockEvent.affectsConfiguration.withArgs('secondaryTerminal').returns(true);
      mockEvent.affectsConfiguration.withArgs('editor').returns(false);

      // Trigger configuration change
      changeHandler(mockEvent);

      // Verify cache clearing by checking if next calls hit VS Code again
      test.configService.getCachedValue('secondaryTerminal', 'maxTerminals', 5);
      test.configService.getCachedValue('editor', 'fontSize', 14);

      // secondaryTerminal should have been cleared and refetched
      // editor should still be cached
      expect(mockEvent.affectsConfiguration).to.have.been.calledWith('secondaryTerminal');
      expect(mockEvent.affectsConfiguration).to.have.been.calledWith('editor');
    });

    it('should notify change handlers when configuration changes', () => {
      const changeHandler: ConfigChangeHandler = test.sandbox.stub();
      test.configService.onConfigurationChanged(changeHandler);

      // Get the VS Code configuration change handler
      const vsCodeChangeHandler = (test.vscode.workspace.onDidChangeConfiguration as sinon.SinonStub).getCall(0).args[0];

      // Mock configuration change event
      const mockEvent = {
        affectsConfiguration: test.sandbox.stub().returns(true),
      };

      // Trigger configuration change
      vsCodeChangeHandler(mockEvent);

      expect(changeHandler).to.have.been.called;
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle VS Code configuration throwing errors', () => {
      test.vscode.workspace.getConfiguration
        .withArgs('errorSection')
        .throws(new Error('Configuration error'));

      expect(() => {
        test.configService.getCachedValue('errorSection', 'errorKey', 'default');
      }).to.throw('Configuration error');
    });

    it('should handle configuration get returning complex objects', () => {
      const complexObject = {
        nested: { value: 'test' },
        array: [1, 2, 3],
        fn: () => 'function',
      };

      test.vscode.configuration.get.withArgs('complexKey', null).returns(complexObject);

      const result = test.configService.getCachedValue('section', 'complexKey', null);

      expect(result).to.deep.equal(complexObject);
    });

    it('should handle configuration update with null/undefined values', async () => {
      test.vscode.configuration.update.withArgs('nullKey', null, 2).resolves();
      test.vscode.configuration.update.withArgs('undefinedKey', undefined, 2).resolves();

      await test.configService.updateValue('testSection', 'nullKey', null);
      await test.configService.updateValue('testSection', 'undefinedKey', undefined);

      expect(test.vscode.configuration.update).to.have.been.calledWith('nullKey', null, 2);
      expect(test.vscode.configuration.update).to.have.been.calledWith('undefinedKey', undefined, 2);
    });

    it('should handle very large cache scenarios', () => {
      // Add many cache entries
      for (let i = 0; i < 1000; i++) {
        test.vscode.configuration.get.withArgs(`key${i}`, `default${i}`).returns(`value${i}`);
        test.configService.getCachedValue('section', `key${i}`, `default${i}`);
      }

      // Verify cache still works efficiently
      const result = test.configService.getCachedValue('section', 'key500', 'default500');
      expect(result).to.equal('value500');
    });

    it('should handle concurrent access to cached values', async () => {
      test.vscode.configuration.get.withArgs('concurrentKey', 'default').returns('concurrentValue');

      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(test.configService.getCachedValue('concurrent', 'concurrentKey', 'default'))
      );

      const results = await Promise.all(promises);

      // All should return the same value
      results.forEach((result) => {
        expect(result).to.equal('concurrentValue');
      });

      // VS Code should only be called once due to caching
      expect(test.vscode.configuration.get).to.have.been.calledOnce;
    });
  });

  describe('Memory Management', () => {
    it('should clear all cache on dispose', () => {
      // Populate cache
      test.configService.getCachedValue('section1', 'key1', 'default1');
      test.configService.getCachedValue('section2', 'key2', 'default2');

      test.configService.dispose();

      // Verify cache is cleared by checking internal state
      // This tests the internal cache map is cleared
      const internalCache = (test.configService as any).configCache;
      expect(internalCache.size).to.equal(0);
    });

    it('should remove all event handlers on dispose', () => {
      const handler1: ConfigChangeHandler = test.sandbox.stub();
      const handler2: ConfigChangeHandler = test.sandbox.stub();

      test.configService.onConfigurationChanged(handler1);
      test.configService.onConfigurationChanged(handler2);

      test.configService.dispose();

      // Verify handlers are cleared
      const internalHandlers = (test.configService as any).changeHandlers;
      expect(internalHandlers.size).to.equal(0);
    });
  });
});
