import { describe, it, expect, vi } from 'vitest';

import { IntegratedSecondaryTerminalProvider } from '../../../../integration/IntegratedSecondaryTerminalProvider';
import { TerminalManager } from '../../../../terminals/TerminalManager';

// Mock VS Code
vi.mock('vscode', () => {
  const mockConfig = {
    get: vi.fn((key, def) => def),
    has: vi.fn(() => true),
    inspect: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  };
  return {
    workspace: {
      getConfiguration: vi.fn(() => mockConfig),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
      workspaceFolders: [],
    },
    window: {
      activeTextEditor: undefined,
    },
    Uri: {
      file: (p: string) => ({ fsPath: p, scheme: 'file', toString: () => `file://${p}` }),
      joinPath: (uri: any, ...parts: string[]) => ({ fsPath: `${uri.fsPath}/${parts.join('/')}`, scheme: 'file' }),
    },
    EventEmitter: class {
      event = vi.fn();
      fire = vi.fn();
    },
    Disposable: class {
      dispose = vi.fn();
      static from(..._args: any[]) { return { dispose: vi.fn() }; }
    },
  };
});
// Mock other dependencies
vi.mock('../../../../terminals/TerminalManager');
vi.mock('../../../../services/TerminalPersistenceService');
vi.mock('../../../../handlers/PersistenceMessageHandler', () => ({ 
  createPersistenceMessageHandler: vi.fn(() => ({ 
    registerMessageHandlers: vi.fn(),
    handlePersistenceMessage: vi.fn(),
  })),
}));
vi.mock('../../../../utils/logger');

describe('IntegratedSecondaryTerminalProvider', () => {
  let provider: IntegratedSecondaryTerminalProvider;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockWebviewView: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockContext = {
      extensionUri: { fsPath: '/test/uri' },
      subscriptions: [],
    };

    mockTerminalManager = {
      onStateUpdate: vi.fn(() => ({ dispose: vi.fn() })),
      onTerminalOutput: vi.fn(() => ({ dispose: vi.fn() })),
      createTerminal: vi.fn(),
      deleteTerminal: vi.fn().mockResolvedValue({ success: true }),
      setActiveTerminal: vi.fn(),
      getActiveTerminalId: vi.fn(),
      writeToTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
    };

    provider = new IntegratedSecondaryTerminalProvider(mockContext, mockTerminalManager as unknown as TerminalManager);

    mockWebviewView = {
      webview: {
        options: {},
        html: '',
        onDidReceiveMessage: vi.fn(),
        postMessage: vi.fn().mockResolvedValue(true),
      },
      onDidDispose: vi.fn(),
    };
  });

  describe('resolveWebviewView', () => {
    it('should configure webview and setup listeners', () => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      
      expect(mockWebviewView.webview.options.enableScripts).toBe(true);
      expect(mockWebviewView.webview.html).toContain('Terminal Webview');
      expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
      expect(mockWebviewView.onDidDispose).toHaveBeenCalled();
    });
  });

  describe('message handling', () => {
    let messageCallback: (msg: any) => Promise<void>;

    beforeEach(() => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
      messageCallback = mockWebviewView.webview.onDidReceiveMessage.mock.calls[0][0];
    });

    it('should handle webviewReady and send settings', async () => {
      await messageCallback({ command: 'webviewReady' });
      
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'settingsResponse' })
      );
    });

    it('should handle createTerminal', async () => {
      mockTerminalManager.createTerminal.mockReturnValue('new-id');
      await messageCallback({ command: 'createTerminal' });
      
      expect(mockTerminalManager.createTerminal).toHaveBeenCalled();
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'terminalCreated', terminalId: 'new-id' })
      );
    });

    it('should handle terminal input', async () => {
      await messageCallback({ command: 'input', terminalId: 't1', data: 'ls\n' });
      expect(mockTerminalManager.writeToTerminal).toHaveBeenCalledWith('t1', 'ls\n');
    });
  });

  describe('event listeners', () => {
    beforeEach(() => {
      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    });

    it('should forward state updates to webview', () => {
      const stateUpdateCallback = mockTerminalManager.onStateUpdate.mock.calls[0][0];
      const mockState = { terminals: [] };
      
      stateUpdateCallback(mockState);
      
      expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ command: 'stateUpdate', state: mockState })
      );
    });
  });

  describe('dispose', () => {
    it('should clear resources', () => {
      provider.dispose();
      // Verify internal state if possible, or just ensure it doesn't throw
    });
  });
});
