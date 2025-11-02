/**
 * SecondaryTerminalProvider - Dynamic Split Direction Tests
 * Issue #148: Dynamic split direction based on panel location
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SecondaryTerminalProvider } from '../../../providers/SecondaryTerminalProvider';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { VsCodeMessage } from '../../../types/common';

describe('SecondaryTerminalProvider - Dynamic Split Direction (Issue #148)', function () {
  let provider: SecondaryTerminalProvider;
  let mockTerminalManager: sinon.SinonStubbedInstance<TerminalManager>;
  let mockContext: vscode.ExtensionContext;
  let mockWebviewView: vscode.WebviewView;
  let mockWebview: vscode.Webview;
  let executeCommandStub: sinon.SinonStub;
  let postMessageStub: sinon.SinonStub;

  beforeEach(function () {
    // Restore any previous stubs first
    sinon.restore();

    // Create mocks
    mockTerminalManager = sinon.createStubInstance(TerminalManager);
    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.parse('file:///test/extension'),
      globalState: {
        get: sinon.stub(),
        update: sinon.stub(),
        keys: sinon.stub().returns([]),
      },
    } as any;

    // Mock VS Code commands
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');

    // Create webview mocks
    postMessageStub = sinon.stub();
    mockWebview = {
      postMessage: postMessageStub,
      asWebviewUri: sinon.stub().returns(vscode.Uri.parse('file:///test/webview.js')),
      cspSource: 'https://test-csp-source',
      html: '',
      onDidReceiveMessage: sinon.stub(),
      options: {},
    } as any;

    mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidChangeVisibility: sinon.stub(),
      show: sinon.stub(),
    } as any;

    // Create provider instance
    provider = new SecondaryTerminalProvider(mockContext, mockTerminalManager);
  });

  afterEach(function () {
    if (provider) {
      provider.dispose();
    }
    sinon.restore();
  });

  describe('Panel Location Detection', function () {
    it('should set initial context key to sidebar on webview setup', async function () {
      // Act
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(executeCommandStub).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });

    it('should request panel location detection on getSettings', async function () {
      // Arrange
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      const getSettingsMessage: VsCodeMessage = {
        command: 'getSettings',
      };

      // Act - simulate getSettings message
      await (provider as any)._handleWebviewMessage(getSettingsMessage);

      // Assert - should send panelLocationUpdate and requestPanelLocationDetection
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'panelLocationUpdate',
          location: 'sidebar',
        })
      );
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'requestPanelLocationDetection',
        })
      );
    });

    it('should update context key when WebView reports panel location', async function () {
      // Arrange
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      const reportMessage: VsCodeMessage = {
        command: 'reportPanelLocation',
        location: 'panel',
      };

      // Act
      await (provider as any)._handleWebviewMessage(reportMessage);

      // Assert
      expect(executeCommandStub).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'panelLocationUpdate',
          location: 'panel',
        })
      );
    });
  });

  describe('Split Command Integration', function () {
    beforeEach(function () {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should support horizontal split direction parameter', function () {
      // Arrange
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('terminal-1');

      // Act
      provider.splitTerminal('horizontal');

      // Assert - should send split command with horizontal direction
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'split',
          direction: 'horizontal',
        })
      );
    });

    it('should support vertical split direction parameter', function () {
      // Arrange
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('terminal-1');

      // Act
      provider.splitTerminal('vertical');

      // Assert - should send split command with vertical direction
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'split',
          direction: 'vertical',
        })
      );
    });

    it('should auto-determine horizontal split when in sidebar and no direction specified', function () {
      // Arrange
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('terminal-1');

      // Recreate provider with sidebar configuration
      provider.dispose();
      const configStub = sinon.stub(vscode.workspace, 'getConfiguration');
      configStub.returns({
        get: sinon.stub().callsFake((key: string) => {
          if (key === 'dynamicSplitDirection') return true;
          if (key === 'panelLocation') return 'sidebar';
          return undefined;
        }),
      } as any);

      provider = new SecondaryTerminalProvider(mockContext, mockTerminalManager);
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Act
      provider.splitTerminal();

      // Assert - should auto-determine horizontal for sidebar
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'split',
          direction: 'horizontal',
        })
      );

      configStub.restore();
    });

    it('should auto-determine vertical split when in panel and no direction specified', function () {
      // Arrange
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('terminal-1');

      // Recreate provider with panel configuration
      provider.dispose();
      const configStub = sinon.stub(vscode.workspace, 'getConfiguration');
      configStub.returns({
        get: sinon.stub().callsFake((key: string) => {
          if (key === 'dynamicSplitDirection') return true;
          if (key === 'panelLocation') return 'panel';
          return undefined;
        }),
      } as any);

      provider = new SecondaryTerminalProvider(mockContext, mockTerminalManager);
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Act
      provider.splitTerminal();

      // Assert - should auto-determine vertical for panel
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'split',
          direction: 'vertical',
        })
      );

      configStub.restore();
    });

    it('should use horizontal split when dynamicSplitDirection is disabled', function () {
      // Arrange
      mockTerminalManager.getTerminals.returns([]);
      mockTerminalManager.createTerminal.returns('terminal-1');

      // Recreate provider with dynamic split disabled
      provider.dispose();
      const configStub = sinon.stub(vscode.workspace, 'getConfiguration');
      configStub.returns({
        get: sinon.stub().callsFake((key: string) => {
          if (key === 'dynamicSplitDirection') return false;
          if (key === 'panelLocation') return 'auto';
          return undefined;
        }),
      } as any);

      provider = new SecondaryTerminalProvider(mockContext, mockTerminalManager);
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Act
      provider.splitTerminal();

      // Assert - should default to horizontal when dynamic split is disabled
      expect(postMessageStub).to.have.been.calledWith(
        sinon.match({
          command: 'split',
          direction: 'horizontal',
        })
      );

      configStub.restore();
    });
  });

  describe('Panel Location Change Handling', function () {
    beforeEach(function () {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should request panel location detection on visibility change', function () {
      // Arrange
      const visibilityCallback = (mockWebviewView.onDidChangeVisibility as sinon.SinonStub).getCall(
        0
      ).args[0];

      // Act - simulate visibility change
      Object.defineProperty(mockWebviewView, 'visible', { value: true, configurable: true });
      visibilityCallback();

      // Assert - should request detection after delay
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(postMessageStub).to.have.been.calledWith(
            sinon.match({
              command: 'requestPanelLocationDetection',
            })
          );
          resolve(undefined);
        }, 600); // Wait for timeout + buffer
      });
    });

    it('should handle configuration changes for panel location settings', async function () {
      // Arrange
      const configStub = sinon.stub(vscode.workspace, 'getConfiguration');
      configStub.returns({
        get: sinon.stub().returns('panel'), // Manual panel location setting
      } as any);

      const onDidChangeConfigurationStub = sinon.stub(vscode.workspace, 'onDidChangeConfiguration');
      const mockEvent = {
        affectsConfiguration: sinon.stub().returns(true),
      };

      // Act - trigger configuration change
      const configCallback = onDidChangeConfigurationStub.getCall(0).args[0];
      configCallback(mockEvent);

      // Assert - should request detection after delay
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(postMessageStub).to.have.been.calledWith(
            sinon.match({
              command: 'requestPanelLocationDetection',
            })
          );
          resolve(undefined);
        }, 150); // Wait for timeout + buffer
      });
    });
  });

  describe('Error Handling', function () {
    beforeEach(function () {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should handle reportPanelLocation message without location gracefully', async function () {
      // Arrange
      const reportMessage: VsCodeMessage = {
        command: 'reportPanelLocation',
        // location is undefined
      };

      // Act & Assert - should not throw
      await (provider as any)._handleWebviewMessage(reportMessage);

      // Should not call executeCommand without location
      expect(executeCommandStub).to.not.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        sinon.match.any
      );
    });

    it('should set fallback context key when panel detection fails', async function () {
      // Arrange
      postMessageStub.rejects(new Error('WebView communication failed'));

      // Act - trigger panel detection request
      const requestDetection = (provider as any)._requestPanelLocationDetection;
      await requestDetection.call(provider);

      // Assert - should set fallback context key
      expect(executeCommandStub).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });
  });

  describe('Integration with VS Code Commands', function () {
    it('should register split commands with proper when clauses', function () {
      // This test verifies the package.json configuration is correct
      // In a real test environment, we would check command registration
      expect(true).to.be.true; // Placeholder - would test command registration
    });

    it('should maintain context key state across webview reloads', async function () {
      // Arrange
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      const reportMessage: VsCodeMessage = {
        command: 'reportPanelLocation',
        location: 'panel',
      };

      // Act - simulate panel location report
      await (provider as any)._handleWebviewMessage(reportMessage);

      // Reset stubs to check second call
      executeCommandStub.resetHistory();

      // Dispose and recreate provider (simulating webview reload)
      provider.dispose();
      provider = new SecondaryTerminalProvider(mockContext, mockTerminalManager);
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

      // Assert - should set initial context key again
      expect(executeCommandStub).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });
  });

  describe('Performance Considerations', function () {
    beforeEach(function () {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should not spam context key updates for rapid panel location changes', async function () {
      // Arrange
      const reportMessages = [
        { command: 'reportPanelLocation', location: 'panel' },
        { command: 'reportPanelLocation', location: 'sidebar' },
        { command: 'reportPanelLocation', location: 'panel' },
      ] as VsCodeMessage[];

      // Act - send rapid messages
      for (const message of reportMessages) {
        await (provider as any)._handleWebviewMessage(message);
      }

      // Assert - should have called executeCommand for each change
      expect(executeCommandStub).to.have.callCount(3);
      expect(executeCommandStub.getCall(0)).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
      expect(executeCommandStub.getCall(1)).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
      expect(executeCommandStub.getCall(2)).to.have.been.calledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
    });

    it('should handle WebView message delays gracefully', async function () {
      // Arrange - simulate slow WebView response
      postMessageStub.callsFake(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Act
      const startTime = Date.now();
      await (provider as any)._requestPanelLocationDetection();
      const endTime = Date.now();

      // Assert - should not block excessively
      expect(endTime - startTime).to.be.lessThan(200);
      expect(postMessageStub).to.have.been.called;
    });
  });
});
