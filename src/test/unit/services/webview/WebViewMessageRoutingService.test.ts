import * as assert from 'assert';
import * as sinon from 'sinon';
import { 
  WebViewMessageRoutingService,
  MessageHandler,
  MessageHandlerContext,
  DebugMessageHandler,
  InitializationMessageHandler,
  TerminalControlMessageHandler,
  SettingsMessageHandler,
  TerminalManagementMessageHandler,
  PanelLocationMessageHandler,
  CliAgentMessageHandler
} from '../../../../services/webview/WebViewMessageRoutingService';
import { WebviewMessage } from '../../../../types/common';
import { TERMINAL_CONSTANTS } from '../../../../constants';

describe('WebViewMessageRoutingService', () => {
  let service: WebViewMessageRoutingService;
  let mockContext: MessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create mock context
    mockContext = {
      terminalManager: {
        getTerminals: sandbox.stub().returns([]),
        createTerminal: sandbox.stub().returns('terminal-1'),
        getActiveTerminalId: sandbox.stub().returns('terminal-1'),
        setActiveTerminal: sandbox.stub(),
        sendInput: sandbox.stub(),
        resizeTerminal: sandbox.stub(),
        removeTerminal: sandbox.stub(),
        getTerminalById: sandbox.stub().returns({ id: 'terminal-1', name: 'Terminal 1' }),
        getCurrentState: sandbox.stub().returns({}),
      },
      sendMessage: sandbox.stub().resolves(),
      isInitialized: false,
      setInitialized: sandbox.stub(),
      initializeTerminal: sandbox.stub().resolves(),
      ensureMultipleTerminals: sandbox.stub(),
      splitTerminal: sandbox.stub(),
      openSettings: sandbox.stub(),
      killTerminal: sandbox.stub().resolves(),
      killSpecificTerminal: sandbox.stub().resolves(),
      deleteTerminalUnified: sandbox.stub().resolves(),
    };
    
    service = new WebViewMessageRoutingService();
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize with default handlers', () => {
      const stats = service.getHandlerStats();
      
      assert.ok(stats.totalHandlers > 0);
      assert.ok(stats.registeredCommands.length > 0);
      assert.ok(stats.debugCommands.length > 0);
    });

    it('should register all expected command categories', () => {
      const stats = service.getHandlerStats();
      
      // Debug commands
      assert.ok(stats.registeredCommands.includes('htmlScriptTest'));
      assert.ok(stats.registeredCommands.includes('timeoutTest'));
      assert.ok(stats.registeredCommands.includes('test'));
      
      // Initialization commands
      assert.ok(stats.registeredCommands.includes('webviewReady'));
      assert.ok(stats.registeredCommands.includes(TERMINAL_CONSTANTS.COMMANDS.READY));
      assert.ok(stats.registeredCommands.includes('requestInitialTerminal'));
      
      // Terminal control commands
      assert.ok(stats.registeredCommands.includes(TERMINAL_CONSTANTS.COMMANDS.INPUT));
      assert.ok(stats.registeredCommands.includes(TERMINAL_CONSTANTS.COMMANDS.RESIZE));
      
      // Settings commands
      assert.ok(stats.registeredCommands.includes('getSettings'));
      assert.ok(stats.registeredCommands.includes('updateSettings'));
      
      // Terminal management commands
      assert.ok(stats.registeredCommands.includes('createTerminal'));
      assert.ok(stats.registeredCommands.includes('splitTerminal'));
      assert.ok(stats.registeredCommands.includes('focusTerminal'));
      assert.ok(stats.registeredCommands.includes('killTerminal'));
      assert.ok(stats.registeredCommands.includes('deleteTerminal'));
    });
  });

  describe('Handler Registration', () => {
    let customHandler: MessageHandler;

    beforeEach(() => {
      customHandler = {
        supportedCommands: ['customCommand1', 'customCommand2'],
        handle: sandbox.stub().resolves()
      };
    });

    it('should register custom handlers', () => {
      service.registerHandler(customHandler);
      
      assert.ok(service.hasHandler('customCommand1'));
      assert.ok(service.hasHandler('customCommand2'));
      
      const stats = service.getHandlerStats();
      assert.ok(stats.registeredCommands.includes('customCommand1'));
      assert.ok(stats.registeredCommands.includes('customCommand2'));
    });

    it('should warn when overwriting existing handlers', () => {
      const duplicateHandler = {
        supportedCommands: ['test'], // Already handled by DebugMessageHandler
        handle: sandbox.stub().resolves()
      };
      
      // This should log a warning but still work
      service.registerHandler(duplicateHandler);
      
      assert.ok(service.hasHandler('test'));
    });

    it('should unregister handlers correctly', () => {
      service.registerHandler(customHandler);
      assert.ok(service.hasHandler('customCommand1'));
      
      service.unregisterHandler(customHandler);
      assert.ok(!service.hasHandler('customCommand1'));
      assert.ok(!service.hasHandler('customCommand2'));
    });

    it('should only unregister handlers that match', () => {
      const handler1 = {
        supportedCommands: ['sharedCommand'],
        handle: sandbox.stub().resolves()
      };
      
      const handler2 = {
        supportedCommands: ['sharedCommand'],
        handle: sandbox.stub().resolves()
      };
      
      service.registerHandler(handler1);
      service.registerHandler(handler2); // Overwrites handler1
      
      service.unregisterHandler(handler1); // Should not remove handler2
      assert.ok(service.hasHandler('sharedCommand'));
      
      service.unregisterHandler(handler2); // Should remove handler2
      assert.ok(!service.hasHandler('sharedCommand'));
    });
  });

  describe('Message Routing', () => {
    it('should route messages to correct handlers', async () => {
      const message: WebviewMessage = {
        command: 'test',
        data: 'test data'
      };
      
      await service.routeMessage(message, mockContext);
      
      // Should be handled by DebugMessageHandler - no easy way to verify without mocking
      // But we can check it doesn't throw
    });

    it('should handle unknown commands gracefully', async () => {
      const message = {
        command: 'unknownCommand' as any,
        data: 'some data'
      };
      
      // Should not throw
      await service.routeMessage(message, mockContext);
    });

    it('should propagate handler errors', async () => {
      const failingHandler = {
        supportedCommands: ['failingCommand'],
        handle: sandbox.stub().rejects(new Error('Handler failure'))
      };
      
      service.registerHandler(failingHandler);
      
      const message = {
        command: 'failingCommand' as any
      };
      
      await assert.rejects(
        service.routeMessage(message, mockContext),
        /Handler failure/
      );
    });

    it('should log debug information for debug commands', async () => {
      const debugMessage: WebviewMessage = {
        command: 'htmlScriptTest',
        data: 'debug test'
      };
      
      await service.routeMessage(debugMessage, mockContext);
      
      // Should log additional debug info - verified through console output
    });
  });

  describe('Handler Statistics', () => {
    it('should return accurate handler statistics', () => {
      const initialStats = service.getHandlerStats();
      const initialCount = initialStats.totalHandlers;
      
      const customHandler = {
        supportedCommands: ['stat1', 'stat2'],
        handle: sandbox.stub().resolves()
      };
      
      service.registerHandler(customHandler);
      
      const newStats = service.getHandlerStats();
      
      assert.strictEqual(newStats.totalHandlers, initialCount + 2);
      assert.ok(newStats.registeredCommands.includes('stat1'));
      assert.ok(newStats.registeredCommands.includes('stat2'));
      assert.ok(Array.isArray(newStats.debugCommands));
    });

    it('should return sorted command lists', () => {
      const stats = service.getHandlerStats();
      
      // Check that commands are sorted
      const sortedCommands = [...stats.registeredCommands].sort();
      assert.deepStrictEqual(stats.registeredCommands, sortedCommands);
      
      const sortedDebugCommands = [...stats.debugCommands].sort();
      assert.deepStrictEqual(stats.debugCommands, sortedDebugCommands);
    });
  });

  describe('dispose', () => {
    it('should clear all handlers on dispose', () => {
      const initialStats = service.getHandlerStats();
      assert.ok(initialStats.totalHandlers > 0);
      
      service.dispose();
      
      const finalStats = service.getHandlerStats();
      assert.strictEqual(finalStats.totalHandlers, 0);
      assert.strictEqual(finalStats.registeredCommands.length, 0);
      assert.strictEqual(finalStats.debugCommands.length, 0);
    });

    it('should not throw when disposed multiple times', () => {
      assert.doesNotThrow(() => {
        service.dispose();
        service.dispose();
      });
    });
  });
});

describe('DebugMessageHandler', () => {
  let handler: DebugMessageHandler;
  let mockContext: MessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    handler = new DebugMessageHandler();
    mockContext = {
      sendMessage: sandbox.stub().resolves()
    } as any;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should support expected debug commands', () => {
    const expectedCommands = ['htmlScriptTest', 'timeoutTest', 'test'];
    assert.deepStrictEqual(handler.supportedCommands, expectedCommands);
  });

  it('should handle htmlScriptTest command', async () => {
    const message: WebviewMessage = { command: 'htmlScriptTest' };
    
    await handler.handle('htmlScriptTest', message, mockContext);
    
    // Should not throw - verification is through log output
  });

  it('should handle timeoutTest command', async () => {
    const message: WebviewMessage = { command: 'timeoutTest' };
    
    await handler.handle('timeoutTest', message, mockContext);
    
    // Should not throw - verification is through log output
  });

  it('should handle test command with initComplete type', async () => {
    const message: WebviewMessage & { type?: string } = { 
      command: 'test',
      type: 'initComplete'
    };
    
    await handler.handle('test', message, mockContext);
    
    // Should not throw - verification is through log output
  });

  it('should handle test command without type', async () => {
    const message: WebviewMessage = { command: 'test' };
    
    await handler.handle('test', message, mockContext);
    
    // Should not throw - verification is through log output
  });
});

describe('InitializationMessageHandler', () => {
  let handler: InitializationMessageHandler;
  let mockContext: MessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    handler = new InitializationMessageHandler();
    mockContext = {
      isInitialized: false,
      setInitialized: sandbox.stub(),
      initializeTerminal: sandbox.stub().resolves(),
      ensureMultipleTerminals: sandbox.stub(),
      terminalManager: {
        getTerminals: sandbox.stub().returns([]),
        createTerminal: sandbox.stub().returns('terminal-1'),
        setActiveTerminal: sandbox.stub(),
        getCurrentState: sandbox.stub().returns({})
      },
      sendMessage: sandbox.stub().resolves()
    } as any;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should support expected initialization commands', () => {
    const expectedCommands = ['webviewReady', TERMINAL_CONSTANTS.COMMANDS.READY, 'requestInitialTerminal'];
    assert.deepStrictEqual(handler.supportedCommands, expectedCommands);
  });

  it('should initialize when webviewReady and not already initialized', async () => {
    const message: WebviewMessage = { command: 'webviewReady' };
    
    await handler.handle('webviewReady', message, mockContext);
    
    assert.ok((mockContext.setInitialized as sinon.SinonStub).calledWith(true));
    assert.ok((mockContext.initializeTerminal as sinon.SinonStub).calledOnce);
  });

  it('should skip initialization if already initialized', async () => {
    mockContext.isInitialized = true;
    const message: WebviewMessage = { command: 'webviewReady' };
    
    await handler.handle('webviewReady', message, mockContext);
    
    assert.ok(!(mockContext.setInitialized as sinon.SinonStub).called);
    assert.ok(!(mockContext.initializeTerminal as sinon.SinonStub).called);
  });

  it('should handle initialization failure', async () => {
    mockContext.initializeTerminal = sandbox.stub().rejects(new Error('Init failed'));
    const message: WebviewMessage = { command: 'webviewReady' };
    
    await handler.handle('webviewReady', message, mockContext);
    
    assert.ok((mockContext.setInitialized as sinon.SinonStub).calledWith(false));
  });

  it('should create initial terminal when requested and none exist', async () => {
    const message: WebviewMessage = { command: 'requestInitialTerminal' };
    
    await handler.handle('requestInitialTerminal', message, mockContext);
    
    assert.ok((mockContext.terminalManager.createTerminal as sinon.SinonStub).calledOnce);
    assert.ok((mockContext.terminalManager.setActiveTerminal as sinon.SinonStub).calledWith('terminal-1'));
    assert.ok((mockContext.sendMessage as sinon.SinonStub).calledOnce);
  });

  it('should skip terminal creation if terminals already exist', async () => {
    mockContext.terminalManager.getTerminals = sandbox.stub().returns([{id: 'existing'}]);
    const message: WebviewMessage = { command: 'requestInitialTerminal' };
    
    await handler.handle('requestInitialTerminal', message, mockContext);
    
    assert.ok(!(mockContext.terminalManager.createTerminal as sinon.SinonStub).called);
  });
});

describe('TerminalControlMessageHandler', () => {
  let handler: TerminalControlMessageHandler;
  let mockContext: MessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    handler = new TerminalControlMessageHandler();
    mockContext = {
      terminalManager: {
        sendInput: sandbox.stub(),
        resizeTerminal: sandbox.stub()
      }
    } as any;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should support terminal control commands', () => {
    const expectedCommands = [TERMINAL_CONSTANTS.COMMANDS.INPUT, TERMINAL_CONSTANTS.COMMANDS.RESIZE];
    assert.deepStrictEqual(handler.supportedCommands, expectedCommands);
  });

  it('should handle input command with data', async () => {
    const message: WebviewMessage = {
      command: TERMINAL_CONSTANTS.COMMANDS.INPUT,
      terminalId: 'terminal-1',
      data: 'test input'
    };
    
    await handler.handle(TERMINAL_CONSTANTS.COMMANDS.INPUT, message, mockContext);
    
    assert.ok((mockContext.terminalManager.sendInput as sinon.SinonStub).calledWith('terminal-1', 'test input'));
  });

  it('should skip input command without data', async () => {
    const message: WebviewMessage = {
      command: TERMINAL_CONSTANTS.COMMANDS.INPUT,
      terminalId: 'terminal-1'
    };
    
    await handler.handle(TERMINAL_CONSTANTS.COMMANDS.INPUT, message, mockContext);
    
    assert.ok(!(mockContext.terminalManager.sendInput as sinon.SinonStub).called);
  });

  it('should handle resize command with dimensions', async () => {
    const message: WebviewMessage = {
      command: TERMINAL_CONSTANTS.COMMANDS.RESIZE,
      terminalId: 'terminal-1',
      cols: 80,
      rows: 24
    };
    
    await handler.handle(TERMINAL_CONSTANTS.COMMANDS.RESIZE, message, mockContext);
    
    assert.ok((mockContext.terminalManager.resizeTerminal as sinon.SinonStub).calledWith('terminal-1', 80, 24));
  });

  it('should skip resize command without dimensions', async () => {
    const message: WebviewMessage = {
      command: TERMINAL_CONSTANTS.COMMANDS.RESIZE,
      terminalId: 'terminal-1'
    };
    
    await handler.handle(TERMINAL_CONSTANTS.COMMANDS.RESIZE, message, mockContext);
    
    assert.ok(!(mockContext.terminalManager.resizeTerminal as sinon.SinonStub).called);
  });
});

describe('TerminalManagementMessageHandler', () => {
  let handler: TerminalManagementMessageHandler;
  let mockContext: MessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    handler = new TerminalManagementMessageHandler();
    mockContext = {
      terminalManager: {
        createTerminal: sandbox.stub().returns('new-terminal'),
        getTerminalById: sandbox.stub().returns({id: 'new-terminal'}),
        getActiveTerminalId: sandbox.stub().returns('active-terminal'),
        setActiveTerminal: sandbox.stub(),
        getTerminals: sandbox.stub().returns([]),
        removeTerminal: sandbox.stub()
      },
      splitTerminal: sandbox.stub(),
      killTerminal: sandbox.stub().resolves(),
      killSpecificTerminal: sandbox.stub().resolves(),
      deleteTerminalUnified: sandbox.stub().resolves(),
      sendMessage: sandbox.stub().resolves()
    } as any;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should support terminal management commands', () => {
    const expectedCommands = ['createTerminal', 'splitTerminal', 'focusTerminal', 'terminalClosed', 'killTerminal', 'deleteTerminal'];
    assert.deepStrictEqual(handler.supportedCommands, expectedCommands);
  });

  it('should handle createTerminal command', async () => {
    const message: WebviewMessage = {
      command: 'createTerminal',
      terminalId: 'webview-terminal-1'
    };
    
    await handler.handle('createTerminal', message, mockContext);
    
    assert.ok((mockContext.terminalManager.createTerminal as sinon.SinonStub).calledOnce);
    assert.ok((mockContext.terminalManager.getTerminalById as sinon.SinonStub).calledWith('new-terminal'));
  });

  it('should handle splitTerminal command', async () => {
    const message: WebviewMessage = { command: 'splitTerminal' };
    
    await handler.handle('splitTerminal', message, mockContext);
    
    assert.ok((mockContext.splitTerminal as sinon.SinonStub).calledOnce);
  });

  it('should handle focusTerminal command', async () => {
    const message: WebviewMessage = {
      command: 'focusTerminal',
      terminalId: 'target-terminal'
    };
    
    await handler.handle('focusTerminal', message, mockContext);
    
    assert.ok((mockContext.terminalManager.setActiveTerminal as sinon.SinonStub).calledWith('target-terminal'));
  });

  it('should handle terminalClosed command when terminal exists', async () => {
    mockContext.terminalManager.getTerminals = sandbox.stub().returns([{id: 'existing-terminal'}]);
    const message: WebviewMessage = {
      command: 'terminalClosed',
      terminalId: 'existing-terminal'
    };
    
    await handler.handle('terminalClosed', message, mockContext);
    
    assert.ok((mockContext.terminalManager.removeTerminal as sinon.SinonStub).calledWith('existing-terminal'));
  });

  it('should handle killTerminal command with specific terminal ID', async () => {
    const message: WebviewMessage = {
      command: 'killTerminal',
      terminalId: 'specific-terminal'
    };
    
    await handler.handle('killTerminal', message, mockContext);
    
    assert.ok((mockContext.killSpecificTerminal as sinon.SinonStub).calledWith('specific-terminal'));
  });

  it('should handle killTerminal command without specific terminal ID', async () => {
    const message: WebviewMessage = { command: 'killTerminal' };
    
    await handler.handle('killTerminal', message, mockContext);
    
    assert.ok((mockContext.killTerminal as sinon.SinonStub).calledOnce);
  });

  it('should handle deleteTerminal command', async () => {
    const message: WebviewMessage = {
      command: 'deleteTerminal',
      terminalId: 'delete-terminal',
      requestSource: 'header'
    };
    
    await handler.handle('deleteTerminal', message, mockContext);
    
    assert.ok((mockContext.deleteTerminalUnified as sinon.SinonStub).calledWith('delete-terminal', 'header'));
  });

  it('should default to panel source for deleteTerminal', async () => {
    const message: WebviewMessage = {
      command: 'deleteTerminal',
      terminalId: 'delete-terminal'
    };
    
    await handler.handle('deleteTerminal', message, mockContext);
    
    assert.ok((mockContext.deleteTerminalUnified as sinon.SinonStub).calledWith('delete-terminal', 'panel'));
  });
});

describe('Integration Tests', () => {
  let service: WebViewMessageRoutingService;
  let mockContext: MessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new WebViewMessageRoutingService();
    
    mockContext = {
      terminalManager: {
        getTerminals: sandbox.stub().returns([]),
        createTerminal: sandbox.stub().returns('terminal-1'),
        getActiveTerminalId: sandbox.stub().returns('terminal-1'),
        setActiveTerminal: sandbox.stub(),
        sendInput: sandbox.stub(),
        resizeTerminal: sandbox.stub(),
        removeTerminal: sandbox.stub(),
        getTerminalById: sandbox.stub().returns({ id: 'terminal-1', name: 'Terminal 1' }),
        getCurrentState: sandbox.stub().returns({}),
      },
      sendMessage: sandbox.stub().resolves(),
      isInitialized: false,
      setInitialized: sandbox.stub(),
      initializeTerminal: sandbox.stub().resolves(),
      ensureMultipleTerminals: sandbox.stub(),
      splitTerminal: sandbox.stub(),
      openSettings: sandbox.stub(),
      killTerminal: sandbox.stub().resolves(),
      killSpecificTerminal: sandbox.stub().resolves(),
      deleteTerminalUnified: sandbox.stub().resolves(),
    };
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  it('should handle complete message flow for terminal operations', async () => {
    // Initialize WebView
    await service.routeMessage({ command: 'webviewReady' }, mockContext);
    assert.ok((mockContext.initializeTerminal as sinon.SinonStub).calledOnce);
    
    // Create terminal
    await service.routeMessage({ command: 'createTerminal', terminalId: 'web-1' }, mockContext);
    assert.ok((mockContext.terminalManager.createTerminal as sinon.SinonStub).calledOnce);
    
    // Send input
    await service.routeMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.INPUT,
      terminalId: 'terminal-1',
      data: 'ls -la'
    }, mockContext);
    assert.ok((mockContext.terminalManager.sendInput as sinon.SinonStub).calledWith('terminal-1', 'ls -la'));
    
    // Focus terminal
    await service.routeMessage({
      command: 'focusTerminal',
      terminalId: 'terminal-1'
    }, mockContext);
    assert.ok((mockContext.terminalManager.setActiveTerminal as sinon.SinonStub).calledWith('terminal-1'));
    
    // Delete terminal
    await service.routeMessage({
      command: 'deleteTerminal',
      terminalId: 'terminal-1',
      requestSource: 'header'
    }, mockContext);
    assert.ok((mockContext.deleteTerminalUnified as sinon.SinonStub).calledWith('terminal-1', 'header'));
  });

  it('should handle error recovery throughout message flow', async () => {
    // Simulate initialization failure
    mockContext.initializeTerminal = sandbox.stub().rejects(new Error('Init failed'));
    
    await service.routeMessage({ command: 'webviewReady' }, mockContext);
    
    // Should have attempted to reset initialization flag
    assert.ok((mockContext.setInitialized as sinon.SinonStub).calledWith(false));
    
    // Continue with other operations despite initialization failure
    await service.routeMessage({ command: 'test' }, mockContext);
    // Should not throw
  });
});