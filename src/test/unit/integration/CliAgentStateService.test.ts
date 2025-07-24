/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentStateService, CliAgentStatus } from '../../../integration/CliAgentStateService';

describe('CliAgentStateService', () => {
  let stateService: CliAgentStateService;
  let onStateChangeSpy: sinon.SinonSpy;

  beforeEach(() => {
    stateService = new CliAgentStateService();
    onStateChangeSpy = sinon.spy();
    stateService.onStateChange(onStateChangeSpy);
  });

  afterEach(() => {
    stateService.dispose();
  });

  describe('activateAgent', () => {
    it('should activate first agent as CONNECTED', () => {
      stateService.activateAgent('terminal1', 'claude');

      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);
      expect(stateService.getAgentType('terminal1')).to.equal('claude');

      const globalActive = stateService.getCurrentGloballyActiveAgent();
      expect(globalActive).to.deep.equal({ terminalId: 'terminal1', type: 'claude' });
    });

    it('should make new agent CONNECTED and previous one DISCONNECTED', () => {
      // First agent
      stateService.activateAgent('terminal1', 'claude');
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);

      // Second agent
      stateService.activateAgent('terminal2', 'gemini');
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.CONNECTED);

      const globalActive = stateService.getCurrentGloballyActiveAgent();
      expect(globalActive).to.deep.equal({ terminalId: 'terminal2', type: 'gemini' });
    });

    it('should emit state change events', () => {
      stateService.activateAgent('terminal1', 'claude');

      expect(onStateChangeSpy).to.have.been.calledWith({
        terminalId: 'terminal1',
        type: 'claude',
        status: CliAgentStatus.CONNECTED,
        previousStatus: CliAgentStatus.NONE,
      });
    });
  });

  describe('deactivateAgent', () => {
    it('should deactivate single agent', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.deactivateAgent('terminal1');

      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.NONE);
      expect(stateService.getCurrentGloballyActiveAgent()).to.equalNull();
    });

    it('should promote DISCONNECTED agent when CONNECTED is deactivated', () => {
      // Setup: terminal1=CONNECTED, terminal2=DISCONNECTED
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.CONNECTED);

      // Deactivate CONNECTED agent
      stateService.deactivateAgent('terminal2');

      // terminal1 should be promoted to CONNECTED
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.NONE);

      const globalActive = stateService.getCurrentGloballyActiveAgent();
      expect(globalActive).to.deep.equal({ terminalId: 'terminal1', type: 'claude' });
    });

    it('should promote most recent DISCONNECTED agent', () => {
      // Setup multiple agents
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      stateService.activateAgent('terminal3', 'claude');

      // All states: terminal1=DISCONNECTED, terminal2=DISCONNECTED, terminal3=CONNECTED
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal3')).to.equal(CliAgentStatus.CONNECTED);

      // Deactivate CONNECTED agent
      stateService.deactivateAgent('terminal3');

      // Most recent (terminal2) should be promoted
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.CONNECTED);
      expect(stateService.getStatus('terminal3')).to.equal(CliAgentStatus.NONE);
    });

    it('should emit state change events for deactivation and promotion', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      onStateChangeSpy.mockClear();

      stateService.deactivateAgent('terminal2');

      // Should emit 2 events: deactivation and promotion
      expect(onStateChangeSpy.callCount).to.equal(2);

      // Deactivation event
      expect(onStateChangeSpy).to.have.been.calledWith({
        terminalId: 'terminal2',
        type: null,
        status: CliAgentStatus.NONE,
        previousStatus: CliAgentStatus.CONNECTED,
      });

      // Promotion event
      expect(onStateChangeSpy).to.have.been.calledWith({
        terminalId: 'terminal1',
        type: 'claude',
        status: CliAgentStatus.CONNECTED,
        previousStatus: CliAgentStatus.DISCONNECTED,
      });
    });
  });

  describe('invariants', () => {
    it('should maintain single CONNECTED rule', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      stateService.activateAgent('terminal3', 'claude');

      const connectedAgents = stateService.getConnectedAgents();
      expect(connectedAgents).to.have.length(1);
      expect(connectedAgents[0].terminalId).to.equal('terminal3');
    });

    it('should never have all agents DISCONNECTED when agents exist', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');

      // Deactivate CONNECTED agent
      stateService.deactivateAgent('terminal2');

      // Should always have one CONNECTED
      const connectedAgents = stateService.getConnectedAgents();
      expect(connectedAgents).to.have.length(1);
    });
  });

  describe('edge cases', () => {
    it('should handle deactivating non-existent agent', () => {
      expect(() => stateService.deactivateAgent('nonexistent')).not.to.throw();
      expect(onStateChangeSpy.called).to.be.false;
    });

    it('should handle reactivating same agent', () => {
      stateService.activateAgent('terminal1', 'claude');
      onStateChangeSpy.mockClear();

      stateService.activateAgent('terminal1', 'claude');

      // Should maintain state and not emit unnecessary events
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);
    });

    it('should handle cleanupTerminal', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.cleanupTerminal('terminal1');

      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.NONE);
    });
  });
});
