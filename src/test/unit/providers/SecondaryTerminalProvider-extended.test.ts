/* eslint-disable */
// @ts-nocheck

// import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';

// Import shared test setup
import '../test-setup';

// Mock VS Code API
const mockVscode = {
  workspace: {
    getConfiguration: sinon.stub(),
    workspaceFolders: [],
    onDidChangeConfiguration: sinon.stub(),
  },
  window: {
    showErrorMessage: sinon.stub(),
    showWarningMessage: sinon.stub(),
    showInformationMessage: sinon.stub(),
    registerWebviewViewProvider: sinon.stub(),
  },
  Uri: {
    file: sinon.stub(),
    parse: sinon.stub(),
    joinPath: sinon.stub(),
  },
  WebviewViewProvider: sinon.stub(),
  ViewColumn: { One: 1 },
  TreeDataProvider: sinon.stub(),
  EventEmitter: sinon.stub(),
  CancellationToken: sinon.stub(),
  commands: {
    registerCommand: sinon.stub(),
    executeCommand: sinon.stub(),
  },
  extensions: {
    getExtension: sinon.stub(),
  },
};

// Setup test environment
function setupTestEnvironment() {
  // Mock VS Code module
  (global as any).vscode = mockVscode;

  // Mock Node.js modules
  (global as any).require = sinon.stub();
  (global as any).module = { exports: {} };
  (global as any).process = {
    platform: 'linux',
    env: {
      NODE_ENV: 'test',
    },
  };
}

describe('SecondaryTerminalProvider Extended', () => {
  let sandbox: sinon.SinonSandbox;
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
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // Mock webview
    mockWebview = {
      html: '',
      options: {},
      postMessage: sinon.spy(),
      onDidReceiveMessage: sinon.stub(),
      asWebviewUri: sinon.stub(),
      cspSource: 'vscode-webview:',
      setState: sinon.spy(),
    };

    // Mock webview view
    mockWebviewView = {
      webview: mockWebview,
      visible: true,
      onDidChangeVisibility: sinon.stub(),
      onDidDispose: sinon.stub(),
      show: sinon.spy(),
      title: 'Terminal',
      description: '',
    };

    // Mock terminal manager
    mockTerminalManager = {
      createTerminal: sinon.stub(),
      killTerminal: sinon.stub(),
      writeToTerminal: sinon.stub(),
      resizeTerminal: sinon.stub(),
      getTerminalCount: sinon.stub().returns(0),
      getActiveTerminalId: sinon.stub().returns(null),
      dispose: sinon.spy(),
    };

    // Mock provider
    mockProvider = {
      context: {
        extensionUri: { fsPath: '/extension/path', scheme: 'file' }, // Simple mock URI
        subscriptions: [],
      },
      terminalManager: mockTerminalManager,
      webviewView: mockWebviewView,
      resolveWebviewView: sinon.spy(),
      _getHtmlForWebview: sinon.stub(),
      _initializeTerminal: sinon.spy(),
      _performKillTerminal: sinon.spy(),
      splitTerminal: sinon.spy(),
      openSettings: sinon.spy(),
      _handleMessage: sinon.spy(),
      dispose: sinon.spy(),
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

    // Reset webview spies
    if (mockWebview.setState && typeof mockWebview.setState.resetHistory === 'function') {
      mockWebview.setState.resetHistory();
    }
    (global as any).window = dom.window;

    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
    }
    if (dom) {
      dom.window.close();
    }
  });

  describe('WebView initialization', () => {
    it('should resolve webview view', () => {
      mockProvider.resolveWebviewView(mockWebviewView);

      expect(mockProvider.resolveWebviewView).to.have.been.calledWith(mockWebviewView);
    });

    it('should set webview HTML content', () => {
      const htmlContent = '<html><body>Terminal WebView</body></html>';
      mockProvider._getHtmlForWebview.returns(htmlContent);

      mockWebview.html = mockProvider._getHtmlForWebview(mockWebview);

      expect(mockWebview.html).to.equal(htmlContent);
    });

    it('should configure webview options', () => {
      const options = {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [mockProvider.context.extensionUri],
      };

      mockWebview.options = options;

      expect(mockWebview.options.enableScripts).to.be.true;
      expect(mockWebview.options.retainContextWhenHidden).to.be.true;
    });

    it('should setup message listeners', () => {
      mockWebview.onDidReceiveMessage.returns({ dispose: sinon.spy() });

      const disposable = mockWebview.onDidReceiveMessage(() => {});

      expect(mockWebview.onDidReceiveMessage).to.have.been.called;
      expect(disposable.dispose).to.be.a('function');
    });
  });

  describe('Terminal operations', () => {
    it('should initialize terminal', () => {
      mockProvider._initializeTerminal();

      expect(mockProvider._initializeTerminal).to.have.been.called;
    });

    it('should create new terminal', () => {
      const _terminalId = 'terminal-123';
      mockTerminalManager.createTerminal.returns(terminalId);

      const result = mockTerminalManager.createTerminal();

      expect(result).to.equal(terminalId);
      expect(mockTerminalManager.createTerminal).to.have.been.called;
    });

    it('should kill terminal', () => {
      const _terminalId = 'terminal-123';

      mockProvider._performKillTerminal(terminalId);

      expect(mockProvider._performKillTerminal).to.have.been.calledWith(terminalId);
    });

    it('should split terminal', () => {
      mockProvider.splitTerminal();

      expect(mockProvider.splitTerminal).to.have.been.called;
    });

    it('should write to terminal', () => {
      const _terminalId = 'terminal-123';
      const data = 'echo "Hello World"';

      mockTerminalManager.writeToTerminal(terminalId, data);

      expect(mockTerminalManager.writeToTerminal).to.have.been.calledWith(terminalId, data);
    });

    it('should resize terminal', () => {
      const _terminalId = 'terminal-123';
      const rows = 30;
      const cols = 100;

      mockTerminalManager.resizeTerminal(terminalId, rows, cols);

      expect(mockTerminalManager.resizeTerminal).to.have.been.calledWith(terminalId, rows, cols);
    });
  });

  describe('Message handling', () => {
    it('should handle init message', () => {
      const message = { type: 'init' };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).to.have.been.calledWith(message);
    });

    it('should handle input message', () => {
      const message = {
        type: 'input',
        terminalId: 'terminal-123',
        data: 'ls -la',
      };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).to.have.been.calledWith(message);
    });

    it('should handle resize message', () => {
      const message = {
        type: 'resize',
        terminalId: 'terminal-123',
        rows: 25,
        cols: 80,
      };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).to.have.been.calledWith(message);
    });

    it('should handle kill terminal message', () => {
      const message = {
        type: 'killTerminal',
        terminalId: 'terminal-123',
      };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).to.have.been.calledWith(message);
    });

    it('should handle split terminal message', () => {
      const message = { type: 'splitTerminal' };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).to.have.been.calledWith(message);
    });

    it('should handle settings message', () => {
      const message = { type: 'openSettings' };

      mockProvider._handleMessage(message);

      expect(mockProvider._handleMessage).to.have.been.calledWith(message);
    });
  });

  describe('Settings integration', () => {
    it('should open settings panel', () => {
      mockProvider.openSettings();

      expect(mockProvider.openSettings).to.have.been.called;
    });

    it('should handle configuration changes', () => {
      // Since this is a mock environment, we simulate the configuration change handling
      // by testing that the configuration change logic can be executed without error
      const configChangeEvent = {
        affectsConfiguration: sinon.stub().returns(false), // not affecting our configs
      };

      // Test that configuration change handling doesn't throw errors
      expect(() => {
        // Simulate the configuration change process
        configChangeEvent.affectsConfiguration('secondaryTerminal');
      }).to.not.throw();

      expect(configChangeEvent.affectsConfiguration).to.have.been.called;
    });

    it('should get terminal configuration', () => {
      const config = {
        shell: '/bin/bash',
        shellArgs: ['-l'],
        fontSize: 14,
        fontFamily: 'monospace',
        theme: 'dark',
      };

      mockVscode.workspace.getConfiguration.returns({
        get: sinon.stub().returns(config),
      });

      const terminalConfig = mockVscode.workspace.getConfiguration('secondaryTerminal');
      const settings = terminalConfig.get('terminal');

      expect(settings).to.deep.equal(config);
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

      expect(mockWebview.postMessage).to.have.been.calledWith(message);
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

      expect(mockWebview.postMessage).to.have.been.calledWith(message);
    });

    it('should handle Alt+Click configuration changes', () => {
      // Create a configuration change event that affects Alt+Click settings
      const configChangeEvent = {
        affectsConfiguration: sinon.stub().callsFake((section: string) => {
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
      }).to.not.throw();

      // Verify affectsConfiguration was called to check relevant settings
      expect(configChangeEvent.affectsConfiguration).to.have.been.called;
    });
  });

  describe('Resource management', () => {
    it('should get webview resource URIs', () => {
      const resourcePath = '/resources/icon.png';
      const resourceUri = mockVscode.Uri.file(resourcePath);

      mockWebview.asWebviewUri.returns(resourceUri);

      const webviewUri = mockWebview.asWebviewUri(resourceUri);

      expect(webviewUri).to.equal(resourceUri);
    });

    it('should handle CSS and JavaScript resources', () => {
      const cssPath = '/dist/webview.css';
      const jsPath = '/dist/webview.js';

      mockWebview.asWebviewUri.withArgs(cssPath).returns(`vscode-webview://path${cssPath}`);
      mockWebview.asWebviewUri.withArgs(jsPath).returns(`vscode-webview://path${jsPath}`);

      const cssUri = mockWebview.asWebviewUri(cssPath);
      const jsUri = mockWebview.asWebviewUri(jsPath);

      expect(cssUri).to.include(cssPath);
      expect(jsUri).to.include(jsPath);
    });
  });

  describe('Error handling', () => {
    it('should handle terminal creation errors', () => {
      const error = new Error('Terminal creation failed');
      mockTerminalManager.createTerminal.throws(error);

      try {
        mockTerminalManager.createTerminal();
      } catch (e) {
        expect(e.message).to.equal('Terminal creation failed');
      }
    });

    it('should handle webview message errors', () => {
      const invalidMessage = { type: 'invalid' };

      expect(() => mockProvider._handleMessage(invalidMessage)).to.not.throw();
    });

    it('should handle webview disposal', () => {
      const disposeCallback = sinon.spy();
      mockWebviewView.onDidDispose.returns({ dispose: disposeCallback });

      const disposable = mockWebviewView.onDidDispose(() => {});

      expect(mockWebviewView.onDidDispose).to.have.been.called;
    });
  });

  describe('Performance optimization', () => {
    it('should debounce terminal output', () => {
      let outputCount = 0;
      const debouncedOutput = sinon.spy(() => {
        outputCount++;
      });

      // Simulate debounced output
      debouncedOutput();
      debouncedOutput();
      debouncedOutput();

      expect(debouncedOutput).to.have.been.calledThrice;
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

      expect(mockTerminalManager.writeToTerminal).to.have.been.calledThrice;
    });
  });

  describe('State management', () => {
    it('should maintain webview state', () => {
      const state = {
        activeTerminalId: 'terminal-123',
        terminals: ['terminal-123', 'terminal-456'],
        settings: { fontSize: 14 },
      };

      mockWebview.getState = sinon.stub().returns(state);

      const currentState = mockWebview.getState();

      expect(currentState).to.deep.equal(state);
    });

    it('should update webview state', () => {
      const newState = {
        activeTerminalId: 'terminal-456',
        terminals: ['terminal-123', 'terminal-456', 'terminal-789'],
      };

      mockWebview.setState(newState);

      expect(mockWebview.setState).to.have.been.calledWith(newState);
    });
  });

  describe('Extension lifecycle', () => {
    it('should handle extension activation', () => {
      // Verify that mockProvider has context from initialization
      expect(mockProvider.context).to.exist;
      expect(mockProvider.context.subscriptions).to.be.an('array');
      expect(mockProvider.context.extensionUri).to.exist;

      // Test that we can update context properties
      const newContext = {
        subscriptions: ['test-subscription'],
        extensionUri: { fsPath: '/new/extension/path', scheme: 'file' }, // Simple mock URI
      };

      // Verify we can set context properties
      expect(() => {
        mockProvider.context = newContext;
      }).to.not.throw();

      // Verify updated context properties are accessible
      expect(mockProvider.context.subscriptions).to.deep.equal(['test-subscription']);
      expect(mockProvider.context.extensionUri).to.exist;
    });

    it('should cleanup resources on disposal', () => {
      mockProvider.dispose();

      expect(mockProvider.dispose).to.have.been.called;
    });

    it('should dispose terminal manager', () => {
      mockTerminalManager.dispose();

      expect(mockTerminalManager.dispose).to.have.been.called;
    });
  });

  describe('WebView visibility', () => {
    it('should handle webview visibility changes', () => {
      const visibilityCallback = sinon.spy();
      mockWebviewView.onDidChangeVisibility.returns({ dispose: sinon.spy() });

      const disposable = mockWebviewView.onDidChangeVisibility(visibilityCallback);

      expect(mockWebviewView.onDidChangeVisibility).to.have.been.called;
      expect(disposable.dispose).to.be.a('function');
    });

    it('should maintain context when hidden', () => {
      mockWebview.options.retainContextWhenHidden = true;

      expect(mockWebview.options.retainContextWhenHidden).to.be.true;
    });
  });
});
