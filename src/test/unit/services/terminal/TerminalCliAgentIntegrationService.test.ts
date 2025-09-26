import * as assert from 'assert';
import * as sinon from 'sinon';
import { TerminalCliAgentIntegrationService } from '../../../../services/terminal/TerminalCliAgentIntegrationService';
import { ICliAgentDetectionService } from '../../../../interfaces/CliAgentService';

describe('TerminalCliAgentIntegrationService', () => {
  let service: TerminalCliAgentIntegrationService;
  let mockCliAgentService: sinon.SinonStubbedInstance<ICliAgentDetectionService>;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create mock CLI Agent service
    mockCliAgentService = {
      startHeartbeat: sandbox.stub(),
      onCliAgentStatusChange: {} as any,
      getAgentState: sandbox.stub(),
      getConnectedAgent: sandbox.stub(),
      refreshAgentState: sandbox.stub(),
      detectFromOutput: sandbox.stub(),
      detectFromInput: sandbox.stub(),
      getDisconnectedAgents: sandbox.stub(),
      switchAgentConnection: sandbox.stub(),
      handleTerminalRemoved: sandbox.stub(),
      dispose: sandbox.stub(),
      detectTermination: sandbox.stub(),
      forceReconnectAgent: sandbox.stub(),
      clearDetectionError: sandbox.stub(),
      setAgentConnected: sandbox.stub(),
    };

    service = new TerminalCliAgentIntegrationService(mockCliAgentService);
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize with provided CLI agent service', () => {
      assert.ok(service);
    });

    it('should initialize with default CLI agent service', () => {
      const defaultService = new TerminalCliAgentIntegrationService();
      assert.ok(defaultService);
      defaultService.dispose();
    });
  });

  describe('startHeartbeat', () => {
    it('should start CLI Agent heartbeat', () => {
      service.startHeartbeat();

      assert.ok(mockCliAgentService.startHeartbeat.calledOnce);
    });
  });

  describe('isCliAgentConnected', () => {
    it('should return true when agent is connected', () => {
      mockCliAgentService.getAgentState.returns({ status: 'connected', agentType: 'claude' });

      const result = service.isCliAgentConnected('terminal1');

      assert.strictEqual(result, true);
      assert.ok(mockCliAgentService.getAgentState.calledWith('terminal1'));
    });

    it('should return false when agent is disconnected', () => {
      mockCliAgentService.getAgentState.returns({ status: 'disconnected', agentType: 'claude' });

      const result = service.isCliAgentConnected('terminal1');

      assert.strictEqual(result, false);
    });

    it('should return false when agent is none', () => {
      mockCliAgentService.getAgentState.returns({ status: 'none', agentType: null });

      const result = service.isCliAgentConnected('terminal1');

      assert.strictEqual(result, false);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getAgentState.throws(new Error('Test error'));

      const result = service.isCliAgentConnected('terminal1');

      assert.strictEqual(result, false);
    });
  });

  describe('isCliAgentRunning', () => {
    it('should return true when agent is connected', () => {
      mockCliAgentService.getAgentState.returns({ status: 'connected', agentType: 'claude' });

      const result = service.isCliAgentRunning('terminal1');

      assert.strictEqual(result, true);
    });

    it('should return true when agent is disconnected but running', () => {
      mockCliAgentService.getAgentState.returns({ status: 'disconnected', agentType: 'claude' });

      const result = service.isCliAgentRunning('terminal1');

      assert.strictEqual(result, true);
    });

    it('should return false when agent is none', () => {
      mockCliAgentService.getAgentState.returns({ status: 'none', agentType: null });

      const result = service.isCliAgentRunning('terminal1');

      assert.strictEqual(result, false);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getAgentState.throws(new Error('Test error'));

      const result = service.isCliAgentRunning('terminal1');

      assert.strictEqual(result, false);
    });
  });

  describe('getCurrentGloballyActiveAgent', () => {
    it('should return active agent info', () => {
      const agentInfo = { terminalId: 'terminal1', type: 'claude' };
      mockCliAgentService.getConnectedAgent.returns(agentInfo);

      const result = service.getCurrentGloballyActiveAgent();

      assert.deepStrictEqual(result, agentInfo);
    });

    it('should return null when no agent is connected', () => {
      mockCliAgentService.getConnectedAgent.returns(null);

      const result = service.getCurrentGloballyActiveAgent();

      assert.strictEqual(result, null);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.throws(new Error('Test error'));

      const result = service.getCurrentGloballyActiveAgent();

      assert.strictEqual(result, null);
    });
  });

  describe('refreshCliAgentState', () => {
    it('should refresh CLI Agent state successfully', () => {
      mockCliAgentService.refreshAgentState.returns(true);

      const result = service.refreshCliAgentState();

      assert.strictEqual(result, true);
      assert.ok(mockCliAgentService.refreshAgentState.calledOnce);
    });

    it('should handle refresh failure', () => {
      mockCliAgentService.refreshAgentState.returns(false);

      const result = service.refreshCliAgentState();

      assert.strictEqual(result, false);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.refreshAgentState.throws(new Error('Test error'));

      const result = service.refreshCliAgentState();

      assert.strictEqual(result, false);
    });
  });

  describe('handleTerminalOutputForCliAgent', () => {
    it('should detect from output', () => {
      service.handleTerminalOutputForCliAgent('terminal1', 'output data');

      assert.ok(mockCliAgentService.detectFromOutput.calledWith('terminal1', 'output data'));
    });

    it('should handle detection errors gracefully', () => {
      mockCliAgentService.detectFromOutput.throws(new Error('Detection error'));

      // Should not throw
      service.handleTerminalOutputForCliAgent('terminal1', 'output data');
    });
  });

  describe('handleTerminalInputForCliAgent', () => {
    it('should detect from input', () => {
      service.handleTerminalInputForCliAgent('terminal1', 'input data');

      assert.ok(mockCliAgentService.detectFromInput.calledWith('terminal1', 'input data'));
    });

    it('should handle detection errors gracefully', () => {
      mockCliAgentService.detectFromInput.throws(new Error('Detection error'));

      // Should not throw
      service.handleTerminalInputForCliAgent('terminal1', 'input data');
    });
  });

  describe('getAgentType', () => {
    it('should return agent type', () => {
      mockCliAgentService.getAgentState.returns({ status: 'connected', agentType: 'claude' });

      const result = service.getAgentType('terminal1');

      assert.strictEqual(result, 'claude');
    });

    it('should return null when no agent', () => {
      mockCliAgentService.getAgentState.returns({ status: 'none', agentType: null });

      const result = service.getAgentType('terminal1');

      assert.strictEqual(result, null);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getAgentState.throws(new Error('Test error'));

      const result = service.getAgentType('terminal1');

      assert.strictEqual(result, null);
    });
  });

  describe('getConnectedAgents', () => {
    it('should return connected agents', () => {
      const connectedAgent = { terminalId: 'terminal1', type: 'claude' };
      mockCliAgentService.getConnectedAgent.returns(connectedAgent);

      const result = service.getConnectedAgents();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.terminalId, 'terminal1');
      assert.strictEqual(result[0]?.agentInfo.type, 'claude');
    });

    it('should return empty array when no agents connected', () => {
      mockCliAgentService.getConnectedAgent.returns(null);

      const result = service.getConnectedAgents();

      assert.strictEqual(result.length, 0);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.throws(new Error('Test error'));

      const result = service.getConnectedAgents();

      assert.strictEqual(result.length, 0);
    });
  });

  describe('getDisconnectedAgents', () => {
    it('should return disconnected agents map', () => {
      const disconnectedMap = new Map([
        [
          'terminal1',
          { type: 'claude' as const, startTime: new Date(), terminalName: 'Terminal 1' },
        ],
      ]);
      mockCliAgentService.getDisconnectedAgents.returns(disconnectedMap);

      const result = service.getDisconnectedAgents();

      assert.strictEqual(result.size, 1);
      assert.ok(result.has('terminal1'));
    });

    it('should return empty map when no disconnected agents', () => {
      mockCliAgentService.getDisconnectedAgents.returns(new Map());

      const result = service.getDisconnectedAgents();

      assert.strictEqual(result.size, 0);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getDisconnectedAgents.throws(new Error('Test error'));

      const result = service.getDisconnectedAgents();

      assert.strictEqual(result.size, 0);
    });
  });

  describe('getConnectedAgentTerminalId', () => {
    it('should return connected agent terminal ID', () => {
      const connectedAgent = { terminalId: 'terminal1', type: 'claude' };
      mockCliAgentService.getConnectedAgent.returns(connectedAgent);

      const result = service.getConnectedAgentTerminalId();

      assert.strictEqual(result, 'terminal1');
    });

    it('should return null when no agent connected', () => {
      mockCliAgentService.getConnectedAgent.returns(null);

      const result = service.getConnectedAgentTerminalId();

      assert.strictEqual(result, null);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.throws(new Error('Test error'));

      const result = service.getConnectedAgentTerminalId();

      assert.strictEqual(result, null);
    });
  });

  describe('getConnectedAgentType', () => {
    it('should return connected agent type', () => {
      const connectedAgent = { terminalId: 'terminal1', type: 'gemini' };
      mockCliAgentService.getConnectedAgent.returns(connectedAgent);

      const result = service.getConnectedAgentType();

      assert.strictEqual(result, 'gemini');
    });

    it('should return null when no agent connected', () => {
      mockCliAgentService.getConnectedAgent.returns(null);

      const result = service.getConnectedAgentType();

      assert.strictEqual(result, null);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.getConnectedAgent.throws(new Error('Test error'));

      const result = service.getConnectedAgentType();

      assert.strictEqual(result, null);
    });
  });

  describe('handleTerminalRemoved', () => {
    it('should handle terminal removal', () => {
      service.handleTerminalRemoved('terminal1');

      assert.ok(mockCliAgentService.handleTerminalRemoved.calledWith('terminal1'));
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.handleTerminalRemoved.throws(new Error('Test error'));

      // Should not throw
      service.handleTerminalRemoved('terminal1');
    });
  });

  describe('switchAiAgentConnection', () => {
    it('should switch connection successfully', () => {
      const switchResult = {
        success: true,
        newStatus: 'connected' as const,
        agentType: 'claude' as const,
      };
      mockCliAgentService.switchAgentConnection.returns(switchResult);

      const result = service.switchAiAgentConnection('terminal1');

      assert.deepStrictEqual(result, switchResult);
      assert.ok(mockCliAgentService.switchAgentConnection.calledWith('terminal1'));
    });

    it('should handle switch failure', () => {
      const switchResult = {
        success: false,
        reason: 'Test failure',
        newStatus: 'none' as const,
        agentType: null,
      };
      mockCliAgentService.switchAgentConnection.returns(switchResult);

      const result = service.switchAiAgentConnection('terminal1');

      assert.deepStrictEqual(result, switchResult);
    });

    it('should handle errors gracefully', () => {
      mockCliAgentService.switchAgentConnection.throws(new Error('Switch error'));

      const result = service.switchAiAgentConnection('terminal1');

      assert.strictEqual(result.success, false);
      assert.ok(result.reason?.includes('Switch failed'));
      assert.strictEqual(result.newStatus, 'none');
      assert.strictEqual(result.agentType, null);
    });
  });

  describe('dispose', () => {
    it('should dispose CLI Agent service', () => {
      service.dispose();

      assert.ok(mockCliAgentService.dispose.calledOnce);
    });

    it('should handle disposal errors gracefully', () => {
      mockCliAgentService.dispose.throws(new Error('Dispose error'));

      // Should not throw
      service.dispose();
    });
  });

  describe('Event Emitter Integration', () => {
    it('should expose onCliAgentStatusChange event', () => {
      const eventEmitter = service.onCliAgentStatusChange;

      assert.strictEqual(eventEmitter, mockCliAgentService.onCliAgentStatusChange);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete CLI Agent lifecycle', () => {
      // Start heartbeat
      service.startHeartbeat();
      assert.ok(mockCliAgentService.startHeartbeat.calledOnce);

      // Detect from input
      service.handleTerminalInputForCliAgent('terminal1', 'claude-code "test"');
      assert.ok(mockCliAgentService.detectFromInput.called);

      // Check connection status
      mockCliAgentService.getAgentState.returns({ status: 'connected', agentType: 'claude' });
      assert.strictEqual(service.isCliAgentConnected('terminal1'), true);

      // Handle terminal removal
      service.handleTerminalRemoved('terminal1');
      assert.ok(mockCliAgentService.handleTerminalRemoved.calledWith('terminal1'));

      // Dispose
      service.dispose();
      assert.ok(mockCliAgentService.dispose.calledOnce);
    });

    it('should handle error scenarios throughout lifecycle', () => {
      // Make all methods throw errors
      Object.keys(mockCliAgentService).forEach((key) => {
        try {
          const method = mockCliAgentService[key as keyof typeof mockCliAgentService];
          if (method && typeof method === 'function' && 'throws' in method) {
            (method as sinon.SinonStub).throws(new Error('Test error'));
          }
        } catch (e) {
          // Ignore errors when setting up error scenarios
        }
      });

      // All operations should handle errors gracefully
      service.startHeartbeat();
      assert.strictEqual(service.isCliAgentConnected('terminal1'), false);
      assert.strictEqual(service.isCliAgentRunning('terminal1'), false);
      assert.strictEqual(service.getCurrentGloballyActiveAgent(), null);
      assert.strictEqual(service.refreshCliAgentState(), false);
      service.handleTerminalOutputForCliAgent('terminal1', 'data');
      service.handleTerminalInputForCliAgent('terminal1', 'data');
      assert.strictEqual(service.getAgentType('terminal1'), null);
      assert.strictEqual(service.getConnectedAgents().length, 0);
      assert.strictEqual(service.getDisconnectedAgents().size, 0);
      assert.strictEqual(service.getConnectedAgentTerminalId(), null);
      assert.strictEqual(service.getConnectedAgentType(), null);
      service.handleTerminalRemoved('terminal1');

      const switchResult = service.switchAiAgentConnection('terminal1');
      assert.strictEqual(switchResult.success, false);

      service.dispose();
    });
  });
});
