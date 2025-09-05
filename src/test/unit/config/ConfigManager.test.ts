import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ConfigManager, getConfigManager } from '../../../config/ConfigManager';

describe('ConfigManager', () => {
  let sandbox: sinon.SinonSandbox;
  let mockWorkspaceConfiguration: sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;
  let configManager: ConfigManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Clear singleton instance before creating new stubs
    const configManagerClass = ConfigManager as unknown as { _instance: ConfigManager | undefined };
    configManagerClass._instance = undefined;

    mockWorkspaceConfiguration = {
      get: sandbox.stub(),
      has: sandbox.stub(),
      inspect: sandbox.stub(),
      update: sandbox.stub(),
    } as unknown as sinon.SinonStubbedInstance<vscode.WorkspaceConfiguration>;

    // Avoid double stubbing by checking if already stubbed
    const getConfigStub = vscode.workspace.getConfiguration as unknown as {
      isSinonProxy?: boolean;
    };
    if (!getConfigStub.isSinonProxy) {
      sandbox
        .stub(vscode.workspace, 'getConfiguration')
        .returns(mockWorkspaceConfiguration as vscode.WorkspaceConfiguration);
    } else {
      (vscode.workspace.getConfiguration as sinon.SinonStub).returns(
        mockWorkspaceConfiguration as vscode.WorkspaceConfiguration
      );
    }

    configManager = getConfigManager();
  });

  afterEach(() => {
    // Clear singleton before restoring stubs
    const configManagerClass = ConfigManager as unknown as { _instance: ConfigManager | undefined };
    configManagerClass._instance = undefined;

    sandbox.restore();
  });

  describe('getExtensionTerminalConfig', () => {
    it('should return terminal configuration with defaults', () => {
      // Setup default values - need to return the default value when called with default parameter
      mockWorkspaceConfiguration.get.callsFake((key: string, defaultValue?: any) => {
        return defaultValue; // Return the default value passed by the ConfigManager
      });

      const config = configManager.getExtensionTerminalConfig();

      expect(config).to.have.property('maxTerminals', 5);
      expect(config).to.have.property('shell', '');
      expect(config).to.have.property('fontFamily', 'monospace');
      expect(config).to.have.property('fontSize', 14);
      expect(config).to.have.property('cursorBlink', true);
    });

    it('should return user-configured values', () => {
      // Setup specific values
      mockWorkspaceConfiguration.get.withArgs('maxTerminals').returns(3);
      mockWorkspaceConfiguration.get.withArgs('shell').returns('/bin/zsh');
      mockWorkspaceConfiguration.get.withArgs('fontSize').returns(16);
      mockWorkspaceConfiguration.get.withArgs('fontFamily').returns('Courier New');

      const config = configManager.getExtensionTerminalConfig();

      expect(config.maxTerminals).to.equal(3);
      expect(config.shell).to.equal('/bin/zsh');
      expect(config.fontSize).to.equal(16);
      expect(config.fontFamily).to.equal('Courier New');
    });

    it('should handle partial configuration', () => {
      // Only some values configured with proper default handling
      mockWorkspaceConfiguration.get.callsFake((key: string, defaultValue?: any) => {
        if (key === 'maxTerminals') return 10;
        return defaultValue; // Return default for undefined keys
      });

      const config = configManager.getExtensionTerminalConfig();

      expect(config.maxTerminals).to.equal(10);
      expect(config.shell).to.equal('');
      expect(config.fontSize).to.equal(14); // default
    });
  });

  describe('onConfigurationChange', () => {
    it('should register configuration change listener', () => {
      const callback = sandbox.stub();
      const mockDisposable = { dispose: sandbox.stub() };
      
      // Check if already stubbed to avoid double stubbing
      const onDidChangeStub = vscode.workspace.onDidChangeConfiguration as any;
      if (!onDidChangeStub || !onDidChangeStub.isSinonProxy) {
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').returns(mockDisposable);
      } else {
        onDidChangeStub.returns(mockDisposable);
      }

      const disposable = configManager.onConfigurationChange(callback);

      expect(disposable).to.equal(mockDisposable);
      expect(vscode.workspace.onDidChangeConfiguration).to.have.been.calledWith(callback);
    });
  });

  describe('clearCache', () => {
    it('should clear configuration cache', () => {
      // First get a config to populate cache
      mockWorkspaceConfiguration.get.withArgs('maxTerminals').returns(5);
      configManager.getExtensionTerminalConfig();

      // Verify cache has data
      const cacheInfo = configManager.getCacheInfo();
      expect(cacheInfo.size).to.be.greaterThan(0);

      // Clear cache
      configManager.clearCache();

      // Verify cache is empty
      const clearedCacheInfo = configManager.getCacheInfo();
      expect(clearedCacheInfo.size).to.equal(0);
    });
  });

  describe('getCompleteTerminalSettings', () => {
    it('should return complete terminal settings with alt-click configuration', () => {
      mockWorkspaceConfiguration.get.withArgs('altClickMovesCursor').returns(true);
      mockWorkspaceConfiguration.get.withArgs('multiCursorModifier').returns('alt');

      const settings = configManager.getCompleteTerminalSettings();

      expect(settings).to.have.property('altClickMovesCursor', true);
      expect(settings).to.have.property('multiCursorModifier', 'alt');
      expect(settings).to.have.property('confirmBeforeKill');
      expect(settings).to.have.property('protectLastTerminal');
    });
  });

  describe('getShellForPlatform', () => {
    it('should return platform-specific shell', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

      // Test Windows
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      mockWorkspaceConfiguration.get.withArgs('shell.windows').returns('powershell.exe');
      expect(configManager.getShellForPlatform()).to.equal('powershell.exe');

      // Test macOS
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      mockWorkspaceConfiguration.get.withArgs('shell.osx').returns('/bin/zsh');
      expect(configManager.getShellForPlatform()).to.equal('/bin/zsh');

      // Test Linux
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      mockWorkspaceConfiguration.get.withArgs('shell.linux').returns('/bin/bash');
      expect(configManager.getShellForPlatform()).to.equal('/bin/bash');

      // Restore original platform
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });
  });
});
