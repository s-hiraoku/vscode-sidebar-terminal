
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

import { SecondaryTerminalProvider } from '../../../../providers/SecondaryTerminalProvider';

// Mock VS Code API
vi.mock('vscode', () => ({
  window: {
    onDidChangeActiveColorTheme: vi.fn(() => ({ dispose: vi.fn() })),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key) => {
        if (key === 'panelLocation') return 'sidebar';
        return undefined;
      }),
      inspect: vi.fn(() => ({
        key: 'test',
        defaultValue: false,
        globalValue: undefined,
        workspaceValue: undefined,
        workspaceFolderValue: undefined,
      })),
      affectsConfiguration: vi.fn().mockReturnValue(false),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
  },
  Disposable: class {
    dispose = vi.fn();
    static from(..._args: any[]) { return { dispose: vi.fn() }; }
  },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
  Uri: { 
    file: (path: string) => ({ fsPath: path, scheme: 'file', toString: () => `file://${path}` }),
    joinPath: (uri: any, ...parts: string[]) => {
      const newPath = `${uri.fsPath}/${parts.join('/')}`;
      return {
        ...uri,
        fsPath: newPath,
        toString: () => `file://${newPath}`
      };
    }
  },
}));

describe('SecondaryTerminalProvider', () => {
  let provider: SecondaryTerminalProvider | undefined;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockWebviewView: any;

  beforeEach(() => {
    mockContext = {
      extensionUri: { fsPath: '/test/path', scheme: 'file', toString: () => 'file:///test/path' },
      subscriptions: []
    };

    mockTerminalManager = {
      getTerminals: vi.fn().mockReturnValue([]),
      getTerminal: vi.fn(),
      getActiveTerminalId: vi.fn().mockReturnValue(null),
      setActiveTerminal: vi.fn(),
      renameTerminal: vi.fn().mockReturnValue(true),
      createTerminal: vi.fn().mockReturnValue('term-1'),
      onTerminalCreated: vi.fn(() => ({ dispose: vi.fn() })),
      onTerminalRemoved: vi.fn(() => ({ dispose: vi.fn() })),
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onExit: vi.fn(() => ({ dispose: vi.fn() })),
      onStateUpdate: vi.fn(() => ({ dispose: vi.fn() })),
      onTerminalFocus: vi.fn(() => ({ dispose: vi.fn() })),
      onCliAgentStatusChange: vi.fn(() => ({ dispose: vi.fn() })),
      getCurrentState: vi.fn().mockReturnValue({ terminals: [], availableSlots: [1, 2, 3], maxTerminals: 5 }),
      getConnectedAgentTerminalId: vi.fn(),
      getConnectedAgentType: vi.fn(),
      getDisconnectedAgents: vi.fn().mockReturnValue(new Map()),
    };

    mockWebviewView = {
      webview: {
        options: {},
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
        postMessage: vi.fn().mockResolvedValue(true),
        asWebviewUri: vi.fn((uri) => uri),
        cspSource: 'vscode-resource:',
        html: ''
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
      visible: true
    };

    provider = new SecondaryTerminalProvider(mockContext, mockTerminalManager);
  });

  afterEach(() => {
    if (provider) {
      provider.dispose();
    }
  });

  describe('Initialization', () => {
    it('should be created with all services', () => {
      expect(provider).toBeDefined();
    });

    it('should resolve webview view and set options', () => {
      provider!.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      
      expect(mockWebviewView.webview.options).toBeDefined();
      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should generate and set HTML content', () => {
      provider!.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      
      expect(mockWebviewView.webview.html).toContain('<!DOCTYPE html>');
      expect(mockWebviewView.webview.html).toContain('terminal-body');
    });
  });

  describe('Message Handling (Handshake)', () => {
    it('should handle webviewReady and send extensionReady', async () => {
      provider!.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      
      // Extract the message handler registered with webview
      const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
      
      await messageHandler({ command: 'webviewReady' });
      
      await vi.waitFor(() => {
        expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
          command: 'extensionReady'
        }));
      });
    });

    it('should handle webviewInitialized and start terminal init', async () => {
      provider!.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
      
      // Step 1: Handshake part 1
      await messageHandler({ command: 'webviewReady' });
      
      // Step 2: Handshake part 2
      await messageHandler({ command: 'webviewInitialized' });
      
      // Should send settings and init command
      await vi.waitFor(() => {
        expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
          command: 'settingsResponse'
        }));
        expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
          command: 'init'
        }));
      });
    });

    it('should route renameTerminal message to terminal command handlers', async () => {
      provider!.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      const messageHandler = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];

      await messageHandler({
        command: 'renameTerminal',
        terminalId: 'term-1',
        newName: 'Renamed from Header',
      });

      await vi.waitFor(() => {
        expect(mockTerminalManager.renameTerminal).toHaveBeenCalledWith(
          'term-1',
          'Renamed from Header'
        );
      });
    });
  });

  describe('Theme Sync', () => {
    it('should notify WebView when VS Code theme changes and mode is auto', () => {
      provider!.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      
      // Simulate theme change trigger
      const themeChangeCallback = (vscode.window.onDidChangeActiveColorTheme as any).mock.calls[0][0];
      themeChangeCallback({ kind: 2 }); // Dark theme
      
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'themeChanged',
        theme: 'dark'
      }));
    });
  });
});
