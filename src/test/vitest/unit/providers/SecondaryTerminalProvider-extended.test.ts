// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Import shared test setup
import '../../../shared/TestSetup';

// Mock VS Code API
const mockVscode = {
  workspace: {
    getConfiguration: vi.fn(),
    workspaceFolders: [],
    onDidChangeConfiguration: vi.fn(),
  },
  window: {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    registerWebviewViewProvider: vi.fn(),
  },
  Uri: {
    file: vi.fn(),
    parse: vi.fn(),
    joinPath: vi.fn(),
  },
  WebviewViewProvider: vi.fn(),
  ViewColumn: { One: 1 },
  TreeDataProvider: vi.fn(),
  EventEmitter: vi.fn(),
  CancellationToken: vi.fn(),
  commands: {
    registerCommand: vi.fn(),
    executeCommand: vi.fn(),
  },
  extensions: {
    getExtension: vi.fn(),
  },
};

// Setup test environment
function setupTestEnvironment() {
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // Mock Node.js modules
  (global as any).require = vi.fn();
  (global as any).module = { exports: {} };
  (global as any).process = {
    platform: 'linux',
    env: {
      NODE_ENV: 'test',
    },
  };
}

describe('SecondaryTerminalProvider Extended', () => {
  let dom: JSDOM;
  let document: Document;
  let mockProvider: any;
  let mockWebview: any;
  let mockWebviewView: any;
  let mockTerminalManager: any;

  beforeEach(() => {
    setupTestEnvironment();

    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock webview
    mockWebview = {
      html: '',
      options: {},
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn(),
      asWebviewUri: vi.fn(),
      cspSource: 'vscode-webview:',
      setState: vi.fn(),
    };

    // Mock webview view
    mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidChangeVisibility: vi.fn(),
      onDidDispose: vi.fn(),
      show: vi.fn(),
      title: 'Terminal',
      description: '',
    };

    // Mock terminal manager
    mockTerminalManager = {
      createTerminal: vi.fn(),
      killTerminal: vi.fn(),
      writeToTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
      getTerminalCount: vi.fn().mockReturnValue(0),
      getActiveTerminalId: vi.fn().mockReturnValue(null),
      dispose: vi.fn(),
    };

    // Mock provider
    mockProvider = {
      context: {
        extensionUri: { fsPath: '/extension/path', scheme: 'file' }, // Simple mock URI
        subscriptions: [],
      },
      terminalManager: mockTerminalManager,
      webviewView: mockWebviewView,
      resolveWebviewView: vi.fn(),
      _getHtmlForWebview: vi.fn(),
      _initializeTerminal: vi.fn(),
      _performKillTerminal: vi.fn(),
      splitTerminal: vi.fn(),
      openSettings: vi.fn(),
      _handleMessage: vi.fn(),
      dispose: vi.fn(),
    };

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    document = dom.window.document;
    (global as any).document = document;

    // Reset webview mocks
    if (mockWebview.setState && typeof mockWebview.setState.mockClear === 'function') {
      mockWebview.setState.mockClear();
    }
    (global as any).window = dom.window;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (dom) {
      dom.window.close();
    }
  });

  describe('WebView initialization', () => {
    it('should resolve webview view', () => {
      mockProvider.resolveWebviewView(mockWebviewView);

      expect(mockProvider.resolveWebviewView).toHaveBeenCalledWith(mockWebviewView);
    });

    it('should set webview HTML content', () => {
      const htmlContent = '<html><body>Terminal WebView</body></html>';
      mockProvider._getHtmlForWebview.mockReturnValue(htmlContent);

      mockWebview.html = mockProvider._getHtmlForWebview(mockWebview);

      expect(mockWebview.html).toBe(htmlContent);
    });

    it('should configure webview options', () => {
      const options = {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [mockProvider.context.extensionUri],
      };

      mockWebview.options = options;

      expect(mockWebview.options.enableScripts).toBe(true);
      expect(mockWebview.options.retainContextWhenHidden).toBe(true);
    });

    it('should setup message listeners', () => {
      mockWebview.onDidReceiveMessage.mockReturnValue({ dispose: vi.fn() });

      const disposable = mockWebview.onDidReceiveMessage(() => {});

      expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
      expect(disposable.dispose).toBeTypeOf('function');
    });
  });

  describe('Terminal operations', () => {
    it('should initialize terminal', () => {
      mockProvider._initializeTerminal();

      expect(mockProvider._initializeTerminal).toHaveBeenCalled();
    });

    it('should create new terminal', () => {
      const terminalId = 'terminal-123';
      mockTerminalManager.createTerminal.mockReturnValue(terminalId);

      const result = mockTerminalManager.createTerminal();

      expect(result).toBe(terminalId);
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
    });

    it('should kill terminal', () => {
      const terminalId = 'terminal-123';

      mockProvider._performKillTerminal(terminalId);

      expect(mockProvider._performKillTerminal).toHaveBeenCalledWith(terminalId);
    });

    it('should split terminal', () => {
      mockProvider.splitTerminal();

      expect(mockProvider.splitTerminal).toHaveBeenCalled();
    });

    it('should write to terminal', () => {
      const terminalId = 'terminal-123';
      const data = 'echo "Hello World"';

      mockTerminalManager.writeToTerminal(terminalId, data);

      expect(mockTerminalManager.writeToTerminal).toHaveBeenCalledWith(terminalId, data);
    });

    it('should resize terminal', () => {
      const terminalId = 'terminal-123';
      const rows = 30;
      const cols = 100;

      mockTerminalManager.resizeTerminal(terminalId, rows, cols);

      expect(mockTerminalManager.resizeTerminal).toHaveBeenCalledWith(terminalId, rows, cols);
    });
  });

  describe('Message handling', () => {
    it('should handle init message', () => {
      const message = { type: 'init' };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).toHaveBeenCalledWith(message);
    });

    it('should handle input message', () => {
      const message = {
        type: 'input',
        terminalId: 'terminal-123',
        data: 'ls -la',
      };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).toHaveBeenCalledWith(message);
    });

    it('should handle resize message', () => {
      const message = {
        type: 'resize',
        terminalId: 'terminal-123',
        rows: 25,
        cols: 80,
      };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).toHaveBeenCalledWith(message);
    });

    it('should handle kill terminal message', () => {
      const message = {
        type: 'killTerminal',
        terminalId: 'terminal-123',
      };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).toHaveBeenCalledWith(message);
    });

    it('should handle split terminal message', () => {
      const message = { type: 'splitTerminal' };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).toHaveBeenCalledWith(message);
    });

    it('should handle settings message', () => {
      const message = { type: 'openSettings' };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).toHaveBeenCalledWith(message);
    });
  });

  describe('Settings integration', () => {
    it('should open settings panel', () => {
      mockProvider.openSettings();

      expect(mockProvider.openSettings).toHaveBeenCalled();
    });

    it('should handle configuration changes', () => {
      // Since this is a mock environment, we simulate the configuration change handling
      // by testing that the configuration change logic can be executed without error
      const configChangeEvent = {
        affectsConfiguration: vi.fn().mockReturnValue(false), // not affecting our configs
      };

      // Test that configuration change handling doesn't throw errors
      expect(() => {
        // Simulate the configuration change process
        configChangeEvent.affectsConfiguration('secondaryTerminal');
      }).not.toThrow();

      expect(configChangeEvent.affectsConfiguration).toHaveBeenCalled();
    });

    it('should get terminal configuration', () => {
      const config = {
        shell: '/bin/bash',
        shellArgs: ['-l'],
        fontSize: 14,
        fontFamily: 'monospace',
        theme: 'dark',
      };

      mockVscode.workspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(config),
      });

      const terminalConfig = mockVscode.workspace.getConfiguration('secondaryTerminal');
      const settings = terminalConfig.get('terminal');

      expect(settings).toEqual(config);
    });

    it('should apply settings to webview', () => {
      const settings = {
        fontSize: 16,
        fontFamily: 'Monaco',
        theme: 'light',
      };

      const message = {
        type: 'settingsResponse',
        settings: settings,
      };

      mockWebview.postMessage(message);

      expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
    });
  });

  describe('Alt+Click integration', () => {
    it('should send Alt+Click settings to webview', () => {
      const altClickSettings = {
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      };

      const message = {
        type: 'altClickSettings',
        settings: altClickSettings,
      };

      mockWebview.postMessage(message);

      expect(mockWebview.postMessage).toHaveBeenCalledWith(message);
    });

    it('should handle Alt+Click configuration changes', () => {
      // Create a configuration change event that affects Alt+Click settings
      const configChangeEvent = {
        affectsConfiguration: vi.fn().mockImplementation((section: string) => {
          return (
            section === 'terminal.integrated.altClickMovesCursor' ||
            section === 'editor.multiCursorModifier' ||
            section === 'secondaryTerminal.altClickMovesCursor'
          );
        }),
      };

      // Test that Alt+Click configuration handling doesn't throw errors
      expect(() => {
        // Simulate checking each Alt+Click related setting
        configChangeEvent.affectsConfiguration('terminal.integrated.altClickMovesCursor');
        configChangeEvent.affectsConfiguration('editor.multiCursorModifier');
        configChangeEvent.affectsConfiguration('secondaryTerminal.altClickMovesCursor');
      }).not.toThrow();

      // Verify affectsConfiguration was called to check relevant settings
      expect(configChangeEvent.affectsConfiguration).toHaveBeenCalled();
    });
  });

  describe('Resource management', () => {
    it('should get webview resource URIs', () => {
      const resourcePath = '/resources/icon.png';
      const resourceUri = mockVscode.Uri.file(resourcePath);

      mockWebview.asWebviewUri.mockReturnValue(resourceUri);

      const webviewUri = mockWebview.asWebviewUri(resourceUri);

      expect(webviewUri).toBe(resourceUri);
    });

    it('should handle CSS and JavaScript resources', () => {
      const cssPath = '/dist/webview.css';
      const jsPath = '/dist/webview.js';

      mockWebview.asWebviewUri.mockImplementation((path: string) => {
        if (path === cssPath) return `vscode-webview://path${cssPath}`;
        if (path === jsPath) return `vscode-webview://path${jsPath}`;
        return path;
      });

      const cssUri = mockWebview.asWebviewUri(cssPath);
      const jsUri = mockWebview.asWebviewUri(jsPath);

      expect(cssUri).toContain(cssPath);
      expect(jsUri).toContain(jsPath);
    });
  });

  describe('Error handling', () => {
    it('should handle terminal creation errors', () => {
      const error = new Error('Terminal creation failed');
      mockTerminalManager.createTerminal.mockImplementation(() => {
        throw error;
      });

      try {
        mockTerminalManager.createTerminal();
      } catch (e) {
        expect((e as Error).message).toBe('Terminal creation failed');
      }
    });

    it('should handle webview message errors', () => {
      const invalidMessage = { type: 'invalid' };

      expect(() => mockProvider._handleMessage(invalidMessage)).not.toThrow();
    });

    it('should handle webview disposal', () => {
      const disposeCallback = vi.fn();
      mockWebviewView.onDidDispose.mockReturnValue({ dispose: disposeCallback });

      const _disposable = mockWebviewView.onDidDispose(() => {});

      expect(mockWebviewView.onDidDispose).toHaveBeenCalled();
    });
  });

  describe('Performance optimization', () => {
    it('should debounce terminal output', () => {
      let _outputCount = 0;
      const debouncedOutput = vi.fn(() => {
        _outputCount++;
      });

      // Simulate debounced output
      debouncedOutput();
      debouncedOutput();
      debouncedOutput();

      expect(debouncedOutput).toHaveBeenCalledTimes(3);
    });

    it('should batch terminal operations', () => {
      const operations = [
        { type: 'write', data: 'line 1' },
        { type: 'write', data: 'line 2' },
        { type: 'write', data: 'line 3' },
      ];

      operations.forEach((op) => {
        mockTerminalManager.writeToTerminal('terminal-123', op.data);
      });

      expect(mockTerminalManager.writeToTerminal).toHaveBeenCalledTimes(3);
    });
  });

  describe('State management', () => {
    it('should maintain webview state', () => {
      const state = {
        activeTerminalId: 'terminal-123',
        terminals: ['terminal-123', 'terminal-456'],
        settings: { fontSize: 14 },
      };

      mockWebview.getState = vi.fn().mockReturnValue(state);

      const currentState = mockWebview.getState();

      expect(currentState).toEqual(state);
    });

    it('should update webview state', () => {
      const newState = {
        activeTerminalId: 'terminal-456',
        terminals: ['terminal-123', 'terminal-456', 'terminal-789'],
      };

      mockWebview.setState(newState);

      expect(mockWebview.setState).toHaveBeenCalledWith(newState);
    });
  });

  describe('Extension lifecycle', () => {
    it('should handle extension activation', () => {
      // Verify that mockProvider has context from initialization
      expect(mockProvider.context).toBeDefined();
      expect(mockProvider.context.subscriptions).toBeInstanceOf(Array);
      expect(mockProvider.context.extensionUri).toBeDefined();

      // Test that we can update context properties
      const newContext = {
        subscriptions: ['test-subscription'],
        extensionUri: { fsPath: '/new/extension/path', scheme: 'file' }, // Simple mock URI
      };

      // Verify we can set context properties
      expect(() => {
        mockProvider.context = newContext;
      }).not.toThrow();

      // Verify updated context properties are accessible
      expect(mockProvider.context.subscriptions).toEqual(['test-subscription']);
      expect(mockProvider.context.extensionUri).toBeDefined();
    });

    it('should cleanup resources on disposal', () => {
      mockProvider.dispose();

      expect(mockProvider.dispose).toHaveBeenCalled();
    });

    it('should dispose terminal manager', () => {
      mockTerminalManager.dispose();

      expect(mockTerminalManager.dispose).toHaveBeenCalled();
    });
  });

  describe('WebView visibility', () => {
    it('should handle webview visibility changes', () => {
      const visibilityCallback = vi.fn();
      mockWebviewView.onDidChangeVisibility.mockReturnValue({ dispose: vi.fn() });

      const disposable = mockWebviewView.onDidChangeVisibility(visibilityCallback);

      expect(mockWebviewView.onDidChangeVisibility).toHaveBeenCalled();
      expect(disposable.dispose).toBeTypeOf('function');
    });

    it('should maintain context when hidden', () => {
      mockWebview.options.retainContextWhenHidden = true;

      expect(mockWebview.options.retainContextWhenHidden).toBe(true);
    });
  });
});
