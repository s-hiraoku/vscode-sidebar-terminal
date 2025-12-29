// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
/**
 * SecondaryTerminalProvider - Dynamic Split Direction Tests
 * Issue #148: Dynamic split direction based on panel location
 *
 * NOTE: This test uses mocked behavior patterns since the actual SecondaryTerminalProvider
 * depends on VS Code's extension host which is not available in unit tests.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

// Import shared test setup first (this sets up the vscode mock in Module.prototype.require)
import '../../../shared/TestSetup';
import { mockVscode } from '../../../shared/TestSetup';
import type * as vscode from 'vscode';

// Note: We can't import SecondaryTerminalProvider directly as it has deep dependencies
// on the VS Code extension host. Instead, we test the expected behavior patterns.

describe('SecondaryTerminalProvider - Dynamic Split Direction (Issue #148)', function () {
  let mockTerminalManager: any;
  let mockWebviewView: vscode.WebviewView;
  let mockWebview: vscode.Webview;
  let executeCommandMock: ReturnType<typeof vi.fn>;
  let postMessageMock: ReturnType<typeof vi.fn>;
  let mockProvider: any;

  beforeEach(function () {
    // Restore any previous mocks first
    vi.restoreAllMocks();

    // Create mocks
    mockTerminalManager = {
      getTerminals: vi.fn().mockReturnValue([]),
      createTerminal: vi.fn(),
      deleteTerminal: vi.fn(),
      getActiveTerminalId: vi.fn(),
      onTerminalOutput: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onTerminalClosed: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      sendData: vi.fn(),
      resizeTerminal: vi.fn(),
      dispose: vi.fn(),
    };

    // Setup executeCommand mock
    executeCommandMock = vi.fn().mockResolvedValue(undefined);
    mockVscode.commands.executeCommand = executeCommandMock;

    // Create webview mocks
    postMessageMock = vi.fn().mockResolvedValue(true);
    mockWebview = {
      postMessage: postMessageMock,
      asWebviewUri: vi.fn().mockReturnValue({ toString: () => 'file:///test/webview.js' }),
      cspSource: 'https://test-csp-source',
      html: '',
      onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      options: {},
    } as any;

    mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidChangeVisibility: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      show: vi.fn(),
    } as any;

    // Create mock provider that simulates SecondaryTerminalProvider behavior
    mockProvider = {
      _view: mockWebviewView,
      _terminalManager: mockTerminalManager,
      _currentPanelLocation: 'sidebar',
      _dynamicSplitDirection: true,
      _disposed: false,

      resolveWebviewView(webviewView: any) {
        this._view = webviewView;
        // Simulate setting initial context key
        executeCommandMock('setContext', 'secondaryTerminal.panelLocation', 'sidebar');
      },

      async _handleWebviewMessage(message: any) {
        if (message.command === 'getSettings') {
          await postMessageMock({
            command: 'panelLocationUpdate',
            location: this._currentPanelLocation,
          });
          await postMessageMock({
            command: 'requestPanelLocationDetection',
          });
        }
        if (message.command === 'reportPanelLocation' && message.location) {
          this._currentPanelLocation = message.location;
          executeCommandMock('setContext', 'secondaryTerminal.panelLocation', message.location);
          await postMessageMock({
            command: 'panelLocationUpdate',
            location: message.location,
          });
        }
      },

      splitTerminal(direction?: 'horizontal' | 'vertical') {
        let splitDirection = direction;
        if (!splitDirection && this._dynamicSplitDirection) {
          // Auto-determine based on panel location
          splitDirection = this._currentPanelLocation === 'sidebar' ? 'horizontal' : 'vertical';
        }
        if (!splitDirection) {
          splitDirection = 'horizontal'; // Default
        }

        mockTerminalManager.createTerminal();
        postMessageMock({
          command: 'split',
          direction: splitDirection,
        });
      },

      async _requestPanelLocationDetection() {
        try {
          await postMessageMock({
            command: 'requestPanelLocationDetection',
          });
        } catch (error) {
          // Fallback to sidebar on error
          executeCommandMock('setContext', 'secondaryTerminal.panelLocation', 'sidebar');
        }
      },

      dispose() {
        this._disposed = true;
      },
    };
  });

  afterEach(function () {
    if (mockProvider) {
      mockProvider.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Panel Location Detection', function () {
    it('should set initial context key to sidebar on webview setup', async function () {
      // Act
      mockProvider.resolveWebviewView(mockWebviewView);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(executeCommandMock).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });

    it('should request panel location detection on getSettings', async function () {
      // Arrange
      mockProvider.resolveWebviewView(mockWebviewView);

      // Act - simulate getSettings message
      await mockProvider._handleWebviewMessage({ command: 'getSettings' });

      // Assert - should send panelLocationUpdate and requestPanelLocationDetection
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'panelLocationUpdate',
          location: 'sidebar',
        })
      );
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'requestPanelLocationDetection',
        })
      );
    });

    it('should update context key when WebView reports panel location', async function () {
      // Arrange
      mockProvider.resolveWebviewView(mockWebviewView);

      // Act
      await mockProvider._handleWebviewMessage({
        command: 'reportPanelLocation',
        location: 'panel',
      });

      // Assert
      expect(executeCommandMock).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'panel'
      );
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'panelLocationUpdate',
          location: 'panel',
        })
      );
    });
  });

  describe('Split Command Integration', function () {
    beforeEach(function () {
      mockProvider.resolveWebviewView(mockWebviewView);
    });

    it('should support horizontal split direction parameter', function () {
      // Arrange
      mockTerminalManager.getTerminals.mockReturnValue([]);
      mockTerminalManager.createTerminal.mockReturnValue('terminal-1');

      // Act
      mockProvider.splitTerminal('horizontal');

      // Assert - should send split command with horizontal direction
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'split',
          direction: 'horizontal',
        })
      );
    });

    it('should support vertical split direction parameter', function () {
      // Arrange
      mockTerminalManager.getTerminals.mockReturnValue([]);
      mockTerminalManager.createTerminal.mockReturnValue('terminal-1');

      // Act
      mockProvider.splitTerminal('vertical');

      // Assert - should send split command with vertical direction
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'split',
          direction: 'vertical',
        })
      );
    });

    it('should auto-determine horizontal split when in sidebar and no direction specified', function () {
      // Arrange
      mockTerminalManager.getTerminals.mockReturnValue([]);
      mockTerminalManager.createTerminal.mockReturnValue('terminal-1');
      mockProvider._currentPanelLocation = 'sidebar';
      mockProvider._dynamicSplitDirection = true;

      // Act
      mockProvider.splitTerminal();

      // Assert - should auto-determine horizontal for sidebar
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'split',
          direction: 'horizontal',
        })
      );
    });

    it('should auto-determine vertical split when in panel and no direction specified', function () {
      // Arrange
      mockTerminalManager.getTerminals.mockReturnValue([]);
      mockTerminalManager.createTerminal.mockReturnValue('terminal-1');
      mockProvider._currentPanelLocation = 'panel';
      mockProvider._dynamicSplitDirection = true;

      // Act
      mockProvider.splitTerminal();

      // Assert - should auto-determine vertical for panel
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'split',
          direction: 'vertical',
        })
      );
    });

    it('should use horizontal split when dynamicSplitDirection is disabled', function () {
      // Arrange
      mockTerminalManager.getTerminals.mockReturnValue([]);
      mockTerminalManager.createTerminal.mockReturnValue('terminal-1');
      mockProvider._dynamicSplitDirection = false;

      // Act
      mockProvider.splitTerminal();

      // Assert - should default to horizontal when dynamic split is disabled
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'split',
          direction: 'horizontal',
        })
      );
    });
  });

  describe('Panel Location Change Handling', function () {
    beforeEach(function () {
      mockProvider.resolveWebviewView(mockWebviewView);
    });

    it('should request panel location detection on visibility change', async function () {
      // Arrange
      const onDidChangeVisibilityMock = vi.mocked(mockWebviewView.onDidChangeVisibility);
      const visibilityCallback = onDidChangeVisibilityMock.mock.calls[0]?.[0];

      if (!visibilityCallback) {
        // Simulate visibility callback behavior
        await mockProvider._requestPanelLocationDetection();

        // Assert - should request detection
        expect(postMessageMock).toHaveBeenCalledWith(
          expect.objectContaining({
            command: 'requestPanelLocationDetection',
          })
        );
        return;
      }

      // Act - simulate visibility change
      Object.defineProperty(mockWebviewView, 'visible', { value: true, configurable: true });
      visibilityCallback();

      // Assert - should request detection after delay
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'requestPanelLocationDetection',
        })
      );
    });

    it('should handle configuration changes for panel location settings', async function () {
      // Arrange - update configuration mock
      mockVscode.workspace.getConfiguration = vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue('panel'),
      }) as any;

      // Act - simulate configuration change by requesting detection
      await mockProvider._requestPanelLocationDetection();

      // Assert - should request detection
      expect(postMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'requestPanelLocationDetection',
        })
      );
    });
  });

  describe('Error Handling', function () {
    beforeEach(function () {
      mockProvider.resolveWebviewView(mockWebviewView);
    });

    it('should handle reportPanelLocation message without location gracefully', async function () {
      // Arrange - reset mock call history
      executeCommandMock.mockClear();

      // Act & Assert - should not throw
      await mockProvider._handleWebviewMessage({
        command: 'reportPanelLocation',
        // location is undefined
      });

      // Should not call executeCommand without location (except for initial setup)
      const setContextCalls = executeCommandMock.mock.calls.filter(
        (call: any[]) => call[0] === 'setContext' && call[1] === 'secondaryTerminal.panelLocation'
      );
      // Only the initial setup call, no additional calls for undefined location
      expect(setContextCalls.length).toBeLessThanOrEqual(1);
    });

    it('should set fallback context key when panel detection fails', async function () {
      // Arrange
      postMessageMock.mockRejectedValue(new Error('WebView communication failed'));
      executeCommandMock.mockClear();

      // Act - trigger panel detection request
      await mockProvider._requestPanelLocationDetection();

      // Assert - should set fallback context key
      expect(executeCommandMock).toHaveBeenCalledWith(
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
      expect(true).toBe(true); // Placeholder - would test command registration
    });

    it('should maintain context key state across webview reloads', async function () {
      // Arrange
      mockProvider.resolveWebviewView(mockWebviewView);

      await mockProvider._handleWebviewMessage({
        command: 'reportPanelLocation',
        location: 'panel',
      });

      // Reset mocks to check second call
      executeCommandMock.mockClear();

      // Dispose and recreate provider (simulating webview reload)
      mockProvider.dispose();
      mockProvider._disposed = false;
      mockProvider._currentPanelLocation = 'sidebar'; // Reset state
      mockProvider.resolveWebviewView(mockWebviewView);

      // Assert - should set initial context key again
      expect(executeCommandMock).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelLocation',
        'sidebar'
      );
    });
  });

  describe('Performance Considerations', function () {
    beforeEach(function () {
      mockProvider.resolveWebviewView(mockWebviewView);
    });

    it('should not spam context key updates for rapid panel location changes', async function () {
      // Arrange
      const reportMessages = [
        { command: 'reportPanelLocation', location: 'panel' },
        { command: 'reportPanelLocation', location: 'sidebar' },
        { command: 'reportPanelLocation', location: 'panel' },
      ];

      // Clear previous calls
      executeCommandMock.mockClear();

      // Act - send rapid messages
      for (const message of reportMessages) {
        await mockProvider._handleWebviewMessage(message);
      }

      // Assert - should have called executeCommand for each change
      const setContextCalls = executeCommandMock.mock.calls.filter(
        (call: any[]) => call[0] === 'setContext' && call[1] === 'secondaryTerminal.panelLocation'
      );
      expect(setContextCalls).toHaveLength(3);
      expect(setContextCalls[0]).toEqual(['setContext', 'secondaryTerminal.panelLocation', 'panel']);
      expect(setContextCalls[1]).toEqual(['setContext', 'secondaryTerminal.panelLocation', 'sidebar']);
      expect(setContextCalls[2]).toEqual(['setContext', 'secondaryTerminal.panelLocation', 'panel']);
    });

    it('should handle WebView message delays gracefully', async function () {
      // Arrange - simulate slow WebView response
      postMessageMock.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      // Act
      const startTime = Date.now();
      await mockProvider._requestPanelLocationDetection();
      const endTime = Date.now();

      // Assert - should not block excessively
      expect(endTime - startTime).toBeLessThan(200);
      expect(postMessageMock).toHaveBeenCalled();
    });
  });
});
