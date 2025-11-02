// import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentWebViewService } from '../../../../services/webview/CliAgentWebViewService';
import { IMessageHandlerContext } from '../../../../services/webview/interfaces';

describe('CliAgentWebViewService', () => {
  let service: CliAgentWebViewService;
  let mockContext: IMessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new CliAgentWebViewService();

    // Create mock context
    mockContext = {
      extensionContext: {
        subscriptions: [],
      } as any,
      terminalManager: {
        getConnectedAgentTerminalId: sandbox.stub().returns('terminal-1'),
        getConnectedAgentType: sandbox.stub().returns('claude'),
        getDisconnectedAgents: sandbox
          .stub()
          .returns(new Map([['terminal-2', { type: 'gemini', lastSeen: Date.now() }]])),
        getTerminals: sandbox.stub().returns([
          { id: 'terminal-1', name: 'Terminal 1' },
          { id: 'terminal-2', name: 'Terminal 2' },
          { id: 'terminal-3', name: 'Terminal 3' },
        ]),
        onCliAgentStatusChange: sandbox.stub().returns({ dispose: sandbox.stub() }),
        switchAiAgentConnection: sandbox.stub().returns({
          success: true,
          newStatus: 'connected',
          agentType: 'claude',
        }),
      } as any,
      webview: undefined,
      sendMessage: sandbox.stub().resolves(),
      terminalIdMapping: new Map(),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize successfully', () => {
      const cliAgentService = new CliAgentWebViewService();
      expect(cliAgentService).to.be.instanceOf(CliAgentWebViewService);
    });
  });

  describe('sendStatusUpdate', () => {
    it('should send status update message', () => {
      service.sendStatusUpdate('Terminal 1', 'connected', 'claude', mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          activeTerminalName: 'Terminal 1',
          status: 'connected',
          agentType: 'claude',
        },
      });
    });

    it('should send status update with null values', () => {
      service.sendStatusUpdate(null, 'none', null, mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          activeTerminalName: null,
          status: 'none',
          agentType: null,
        },
      });
    });

    it('should handle sendMessage errors gracefully', async () => {
      (mockContext.sendMessage as sinon.SinonStub).rejects(new Error('Send message error'));

      // Should not throw
      service.sendStatusUpdate('Terminal 1', 'connected', 'claude', mockContext);

      // Give some time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should handle all status types', () => {
      const statuses: ('connected' | 'disconnected' | 'none')[] = [
        'connected',
        'disconnected',
        'none',
      ];

      statuses.forEach((status) => {
        service.sendStatusUpdate('Terminal 1', status, 'claude', mockContext);

        expect(mockContext.sendMessage).to.have.been.calledWith({
          command: 'cliAgentStatusUpdate',
          cliAgentStatus: {
            activeTerminalName: 'Terminal 1',
            status,
            agentType: 'claude',
          },
        });
      });
    });
  });

  describe('sendFullStateSync', () => {
    it('should send full state sync with all terminals', () => {
      service.sendFullStateSync(mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': {
            status: 'connected',
            agentType: 'claude',
            terminalName: 'Terminal 1',
          },
          'terminal-2': {
            status: 'disconnected',
            agentType: 'gemini',
            terminalName: 'Terminal 2',
          },
          'terminal-3': {
            status: 'none',
            agentType: null,
            terminalName: 'Terminal 3',
          },
        },
      });
    });

    it('should handle empty terminal list', () => {
      (mockContext.terminalManager.getTerminals as sinon.SinonStub).returns([]);

      service.sendFullStateSync(mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'cliAgentFullStateSync',
        terminalStates: {},
      });
    });

    it('should handle no connected agent', () => {
      (mockContext.terminalManager.getConnectedAgentTerminalId as sinon.SinonStub).returns(null);
      (mockContext.terminalManager.getConnectedAgentType as sinon.SinonStub).returns(null);

      service.sendFullStateSync(mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': {
            status: 'none',
            agentType: null,
            terminalName: 'Terminal 1',
          },
          'terminal-2': {
            status: 'disconnected',
            agentType: 'gemini',
            terminalName: 'Terminal 2',
          },
          'terminal-3': {
            status: 'none',
            agentType: null,
            terminalName: 'Terminal 3',
          },
        },
      });
    });

    it('should handle sendMessage errors gracefully', async () => {
      (mockContext.sendMessage as sinon.SinonStub).rejects(new Error('Send message error'));

      // Should not throw
      service.sendFullStateSync(mockContext);

      // Give some time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe('setupListeners', () => {
    it('should set up CLI Agent status change listeners', () => {
      const disposables = service.setupListeners(mockContext);

      expect(mockContext.terminalManager.onCliAgentStatusChange).to.have.been.called;
      expect(disposables).to.be.an('array');
      expect(disposables.length).to.be.greaterThan(0);
    });

    it('should add disposables to extension context', () => {
      service.setupListeners(mockContext);

      expect(mockContext.extensionContext.subscriptions.length).to.be.greaterThan(0);
    });

    it('should handle listener setup errors gracefully', () => {
      (mockContext.terminalManager.onCliAgentStatusChange as sinon.SinonStub).throws(
        new Error('Listener setup error')
      );

      const disposables = service.setupListeners(mockContext);

      expect(disposables).to.be.an('array');
      expect(disposables).to.be.empty;
    });
  });

  describe('clearListeners', () => {
    it('should clear all listeners', () => {
      const mockDisposable = { dispose: sandbox.stub() };
      (mockContext.terminalManager.onCliAgentStatusChange as sinon.SinonStub).returns(
        mockDisposable
      );

      // Set up listeners
      service.setupListeners(mockContext);

      // Clear listeners
      service.clearListeners();

      expect(mockDisposable.dispose).to.have.been.called;
    });

    it('should handle dispose errors gracefully', () => {
      const mockDisposable = {
        dispose: sandbox.stub().throws(new Error('Dispose error')),
      };
      (mockContext.terminalManager.onCliAgentStatusChange as sinon.SinonStub).returns(
        mockDisposable
      );

      // Set up listeners
      service.setupListeners(mockContext);

      // Clear listeners should not throw
      service.clearListeners();
    });
  });

  describe('handleSwitchAiAgent', () => {
    it('should handle successful AI agent switch', async () => {
      await service.handleSwitchAiAgent('terminal-1', 'connect', mockContext);

      expect(mockContext.terminalManager.switchAiAgentConnection).to.have.been.calledWith(
        'terminal-1'
      );
      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: true,
        newStatus: 'connected',
        agentType: 'claude',
      });
    });

    it('should handle failed AI agent switch', async () => {
      (mockContext.terminalManager.switchAiAgentConnection as sinon.SinonStub).returns({
        success: false,
        reason: 'No agent available',
        newStatus: 'none',
      });

      await service.handleSwitchAiAgent('terminal-1', 'connect', mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: false,
        reason: 'No agent available',
        newStatus: 'none',
      });
    });

    it('should handle switchAiAgentConnection errors', async () => {
      (mockContext.terminalManager.switchAiAgentConnection as sinon.SinonStub).throws(
        new Error('Switch error')
      );

      await service.handleSwitchAiAgent('terminal-1', 'connect', mockContext);

      expect(mockContext.sendMessage).to.have.been.calledWith({
        command: 'switchAiAgentResponse',
        terminalId: 'terminal-1',
        success: false,
        reason: 'Internal error occurred',
      });
    });
  });

  describe('getDebugInfo', () => {
    it('should return debug information', () => {
      const debugInfo = service.getDebugInfo(mockContext);

      expect(debugInfo).to.be.an('object');
      expect(debugInfo).to.have.property('connectedAgent');
      expect(debugInfo).to.have.property('disconnectedAgents');
      expect(debugInfo).to.have.property('activeListeners');
      expect(debugInfo).to.have.property('timestamp');
    });

    it('should include connected agent info', () => {
      const debugInfo = service.getDebugInfo(mockContext);

      expect((debugInfo as any).connectedAgent).to.deep.equal({
        id: 'terminal-1',
        type: 'claude',
      });
    });

    it('should include disconnected agents info', () => {
      const debugInfo = service.getDebugInfo(mockContext);

      expect((debugInfo as any).disconnectedAgents).to.be.an('array');
      expect((debugInfo as any).disconnectedAgents).to.have.length(1);
    });

    it('should handle errors gracefully', () => {
      (mockContext.terminalManager.getConnectedAgentTerminalId as sinon.SinonStub).throws(
        new Error('Debug error')
      );

      const debugInfo = service.getDebugInfo(mockContext);

      expect(debugInfo).to.have.property('error');
      expect(debugInfo).to.have.property('timestamp');
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', () => {
      const clearListenersSpy = sandbox.spy(service, 'clearListeners');

      service.dispose();

      expect(clearListenersSpy).to.have.been.called;
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent full state sync calls', () => {
      for (let i = 0; i < 5; i++) {
        service.sendFullStateSync(mockContext);
      }

      expect(mockContext.sendMessage).to.have.been.called;
    });
  });
});
