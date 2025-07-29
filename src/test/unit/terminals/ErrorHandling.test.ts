/**
 * Error Handling and Edge Cases Test Suite
 * ターミナル管理でのエラーハンドリングとエッジケースのテスト
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentDetectionService } from '../../../integration/CliAgentDetectionService';
import { CliAgentStateService, CliAgentStatus } from '../../../integration/CliAgentStateService';

describe('Error Handling and Edge Cases', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('CliAgentDetectionService Edge Cases', () => {
    let detectionService: CliAgentDetectionService;

    beforeEach(() => {
      detectionService = new CliAgentDetectionService();
    });

    it('should handle null and undefined input gracefully', () => {
      expect(detectionService.detectFromCommand(null)).to.be.null;
      expect(detectionService.detectFromCommand(undefined)).to.be.null;
      expect(detectionService.detectFromOutput(null as unknown as string)).to.be.null;
      expect(detectionService.detectFromOutput(undefined as unknown as string)).to.be.null;
    });

    it('should handle empty strings', () => {
      expect(detectionService.detectFromCommand('')).to.be.null;
      expect(detectionService.detectFromCommand('   ')).to.be.null;
      expect(detectionService.detectFromOutput('')).to.be.null;
    });

    it('should handle very long command strings', () => {
      const longCommand = 'claude ' + 'a'.repeat(10000);
      const result = detectionService.detectFromCommand(longCommand);
      expect(result).to.deep.equal({ type: 'claude', confidence: 1.0 });
    });

    it('should handle special characters and unicode', () => {
      expect(detectionService.detectFromCommand('claude --help 🤖')).to.deep.equal({
        type: 'claude',
        confidence: 1.0,
      });
      expect(detectionService.detectFromCommand('émini')).to.be.null;
      expect(detectionService.detectFromCommand('claude\n\t')).to.deep.equal({
        type: 'claude',
        confidence: 1.0,
      });
    });

    it('should handle malformed output patterns', () => {
      const malformedOutput = 'Human:\nAssistant incomplete';
      expect(detectionService.detectFromOutput(malformedOutput)).to.be.null;

      const partialWelcome = 'Welcome to Claude';
      expect(detectionService.detectFromOutput(partialWelcome)).to.be.null;
    });

    it('should detect case-insensitive commands', () => {
      expect(detectionService.detectFromCommand('CLAUDE')).to.deep.equal({
        type: 'claude',
        confidence: 1.0,
      });
      expect(detectionService.detectFromCommand('Gemini')).to.deep.equal({
        type: 'gemini',
        confidence: 1.0,
      });
    });

    it('should handle mixed content detection', () => {
      const mixedOutput = 'Some other text\\nHuman: Hello\\nAssistant: Hi!\\nMore text';
      expect(detectionService.detectFromOutput(mixedOutput)).to.deep.equal({
        type: 'claude',
        confidence: 0.8,
      });
    });
  });

  describe('CliAgentStateService Edge Cases', () => {
    let stateService: CliAgentStateService;
    let eventSpy: sinon.SinonSpy;

    beforeEach(() => {
      stateService = new CliAgentStateService();
      eventSpy = sandbox.spy();
      stateService.onStateChange(eventSpy);
    });

    afterEach(() => {
      stateService.dispose();
    });

    it('should handle duplicate activation of same agent', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal1', 'claude');

      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);
      expect(eventSpy.callCount).to.equal(2); // Both activations should emit events
    });

    it('should handle activation with different agent type', () => {
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal1', 'gemini');

      expect(stateService.getAgentType('terminal1')).to.equal('gemini');
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);
    });

    it('should handle deactivation of non-existent agent', () => {
      stateService.deactivateAgent('nonexistent');
      expect(eventSpy.called).to.be.false;
    });

    it('should maintain invariants under rapid state changes', () => {
      // Rapid activation/deactivation
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      stateService.deactivateAgent('terminal1');
      stateService.activateAgent('terminal3', 'claude');
      stateService.deactivateAgent('terminal2');

      // Only one should be CONNECTED
      const connectedAgents = Array.from(stateService.getAllAgentStates().entries()).filter(
        ([_, state]) => state.status === CliAgentStatus.CONNECTED
      );
      expect(connectedAgents).to.have.lengthOf(1);
      expect(connectedAgents[0]?.[0]).to.equal('terminal3');
    });

    it('should handle circular promotion scenario', () => {
      // Create multiple DISCONNECTED agents
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      stateService.activateAgent('terminal3', 'claude');

      // Now terminal1 and terminal2 are DISCONNECTED, terminal3 is CONNECTED
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.DISCONNECTED);
      expect(stateService.getStatus('terminal3')).to.equal(CliAgentStatus.CONNECTED);

      // Deactivate CONNECTED agent - should promote first DISCONNECTED
      stateService.deactivateAgent('terminal3');
      expect(stateService.getStatus('terminal1')).to.equal(CliAgentStatus.CONNECTED);
      expect(stateService.getStatus('terminal2')).to.equal(CliAgentStatus.DISCONNECTED);
    });

    it('should handle empty agent type strings gracefully', () => {
      expect(() => {
        stateService.activateAgent('terminal1', '' as 'claude');
      }).to.not.throw();
    });

    it('should handle very long terminal IDs', () => {
      const longTerminalId = 'terminal-' + 'x'.repeat(1000);
      stateService.activateAgent(longTerminalId, 'claude');
      expect(stateService.getStatus(longTerminalId)).to.equal(CliAgentStatus.CONNECTED);
    });
  });

  describe('Integration Error Scenarios', () => {
    it('should handle detection service errors gracefully', () => {
      const detectionService = new CliAgentDetectionService();
      const stateService = new CliAgentStateService();

      // Simulate detection service failure
      const originalDetect = detectionService.detectFromCommand.bind(detectionService);
      detectionService.detectFromCommand = () => {
        throw new Error('Detection failed');
      };

      expect(() => {
        detectionService.detectFromCommand('claude');
      }).to.throw('Detection failed');

      // Restore original method
      detectionService.detectFromCommand = originalDetect;

      // Verify normal operation is restored
      expect(detectionService.detectFromCommand('claude')).to.deep.equal({
        type: 'claude',
        confidence: 1.0,
      });

      stateService.dispose();
    });

    it('should handle memory constraints with many agents', () => {
      const stateService = new CliAgentStateService();
      const maxAgents = 1000;

      // Create many agents to test memory handling
      for (let i = 0; i < maxAgents; i++) {
        stateService.activateAgent(`terminal${i}`, i % 2 === 0 ? 'claude' : 'gemini');
      }

      // Verify only one is CONNECTED
      const allStates = stateService.getAllAgentStates();
      expect(allStates.size).to.equal(maxAgents);

      const connectedCount = Array.from(allStates.values()).filter(
        (state) => state.status === CliAgentStatus.CONNECTED
      ).length;
      expect(connectedCount).to.equal(1);

      // Clean up
      for (let i = 0; i < maxAgents; i++) {
        stateService.deactivateAgent(`terminal${i}`);
      }

      expect(stateService.getAllAgentStates().size).to.equal(0);
      stateService.dispose();
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle rapid concurrent state changes', async () => {
      const stateService = new CliAgentStateService();
      const promises: Promise<void>[] = [];

      // Simulate concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            setTimeout(() => {
              stateService.activateAgent(`terminal${i}`, i % 2 === 0 ? 'claude' : 'gemini');
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(promises);

      // Verify system integrity
      const connectedAgents = Array.from(stateService.getAllAgentStates().entries()).filter(
        ([_, state]) => state.status === CliAgentStatus.CONNECTED
      );
      expect(connectedAgents).to.have.lengthOf(1);

      stateService.dispose();
    });

    it('should handle interleaved activation and deactivation', () => {
      const stateService = new CliAgentStateService();

      // Interleave operations
      stateService.activateAgent('terminal1', 'claude');
      stateService.activateAgent('terminal2', 'gemini');
      stateService.deactivateAgent('terminal1');
      stateService.activateAgent('terminal3', 'claude');
      stateService.deactivateAgent('terminal2');
      stateService.activateAgent('terminal4', 'gemini');

      // Verify final state consistency
      const activeAgent = stateService.getCurrentGloballyActiveAgent();
      expect(activeAgent).to.not.be.null;
      expect(activeAgent?.terminalId).to.equal('terminal4');

      stateService.dispose();
    });
  });
});
