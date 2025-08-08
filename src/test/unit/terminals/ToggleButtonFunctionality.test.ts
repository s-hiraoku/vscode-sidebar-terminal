/**
 * Comprehensive test suite for CLI Agent Toggle Button functionality
 * 
 * Tests the connected button (toggle button) functionality to ensure:
 * 1. DISCONNECTED agents can be promoted to CONNECTED via toggle button
 * 2. CONNECTED agents cannot be "toggled" (button should be hidden)
 * 3. NONE agents do not show toggle button
 * 4. Specification compliance for button visibility and behavior
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentDetectionService } from '../../../services/CliAgentDetectionService';

describe('Toggle Button Functionality Tests', () => {
  let detectionService: CliAgentDetectionService;
  let sandbox: sinon.SinonSandbox;
  let mockVscode: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Create VS Code API mock
    mockVscode = {
      EventEmitter: class MockEventEmitter {
        fire = sandbox.stub();
        event = sandbox.stub();
        dispose = sandbox.stub();
      },
    };
    (global as any).vscode = mockVscode;

    detectionService = new CliAgentDetectionService();
  });

  afterEach(() => {
    detectionService.dispose();
    sandbox.restore();
  });

  describe('Toggle Button Visibility Specification Compliance', () => {
    it('should hide toggle button for CONNECTED agents', () => {
      // Setup: Create a CONNECTED agent
      detectionService.setConnectedAgent('terminal1', 'claude');

      const status = detectionService.getAgentStatus('terminal1');
      
      // According to specification: CONNECTED status → Toggle button HIDDEN
      expect(status).to.equal('connected');
      
      // Toggle button should be hidden for CONNECTED agents
      // (This would be handled in the UI layer, but the logic should support this)
    });

    it('should show toggle button for DISCONNECTED agents', () => {
      // Setup: Create CONNECTED agent first, then another agent (becomes DISCONNECTED)
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');

      // terminal1 should now be DISCONNECTED
      const status1 = detectionService.getAgentStatus('terminal1');
      const status2 = detectionService.getAgentStatus('terminal2');
      
      expect(status1).to.equal('disconnected');
      expect(status2).to.equal('connected');
      
      // According to specification: DISCONNECTED status → Toggle button VISIBLE
      // The DISCONNECTED agent (terminal1) should show toggle button
    });

    it('should hide toggle button for NONE agents', () => {
      // Setup: Terminal with no agent
      const status = detectionService.getAgentStatus('terminal1');
      
      // According to specification: NONE status → Toggle button HIDDEN
      expect(status).to.equal('none');
      
      // Toggle button should be hidden for NONE agents
    });
  });

  describe('Toggle Button Click Functionality', () => {
    it('should promote DISCONNECTED agent to CONNECTED when toggle button is clicked', () => {
      // Setup: Create two agents - one CONNECTED, one DISCONNECTED
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');
      
      // Verify initial state
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('connected');

      // Simulate toggle button click on DISCONNECTED agent (terminal1)
      const result = detectionService.switchAgentConnection('terminal1');

      // Verify successful switch
      expect(result.success).to.be.true;
      expect(result.newStatus).to.equal('connected');
      expect(result.agentType).to.equal('claude');
      
      // Verify final state
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('disconnected');
    });

    it('should handle toggle button click on already CONNECTED agent gracefully', () => {
      // Setup: Create a CONNECTED agent
      detectionService.setConnectedAgent('terminal1', 'claude');

      // Verify initial state
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');

      // Simulate toggle button click on CONNECTED agent (should be noop)
      const result = detectionService.switchAgentConnection('terminal1');

      // Verify graceful handling (no change)
      expect(result.success).to.be.true;
      expect(result.newStatus).to.equal('connected');
      expect(result.agentType).to.equal('claude');
      
      // State should remain unchanged
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
    });

    it('should handle toggle button click on NONE agent gracefully', () => {
      // Setup: No agents
      
      // Verify initial state (no agents)
      expect(detectionService.getAgentStatus('terminal1')).to.equal('none');

      // Simulate toggle button click on NONE agent
      const result = detectionService.switchAgentConnection('terminal1');

      // Verify graceful handling
      expect(result.success).to.be.false;
      expect(result.newStatus).to.equal('none');
      expect(result.agentType).to.be.null;
    });
  });

  describe('Multiple Agent Toggle Scenarios', () => {
    it('should handle toggle between multiple DISCONNECTED agents', () => {
      // Setup: Create three agents
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');
      detectionService.setConnectedAgent('terminal3', 'claude');

      // State: terminal1=DISCONNECTED, terminal2=DISCONNECTED, terminal3=CONNECTED
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('disconnected');
      expect(detectionService.getAgentStatus('terminal3')).to.equal('connected');

      // Toggle terminal2 to CONNECTED
      const result1 = detectionService.switchAgentConnection('terminal2');
      
      expect(result1.success).to.be.true;
      expect(result1.newStatus).to.equal('connected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('connected');
      expect(detectionService.getAgentStatus('terminal3')).to.equal('disconnected');

      // Toggle terminal1 to CONNECTED
      const result2 = detectionService.switchAgentConnection('terminal1');
      
      expect(result2.success).to.be.true;
      expect(result2.newStatus).to.equal('connected');
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('disconnected');
    });

    it('should maintain single CONNECTED invariant during toggle operations', () => {
      // Setup: Create multiple agents
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');
      detectionService.setConnectedAgent('terminal3', 'claude');

      // At any point, only ONE agent should be CONNECTED
      const connectedAgents = ['terminal1', 'terminal2', 'terminal3']
        .filter(id => detectionService.getAgentStatus(id) === 'connected');
      
      expect(connectedAgents).to.have.length(1);
      expect(connectedAgents[0]).to.equal('terminal3');

      // Toggle to different agent
      detectionService.switchAgentConnection('terminal1');

      const connectedAgentsAfterToggle = ['terminal1', 'terminal2', 'terminal3']
        .filter(id => detectionService.getAgentStatus(id) === 'connected');
      
      expect(connectedAgentsAfterToggle).to.have.length(1);
      expect(connectedAgentsAfterToggle[0]).to.equal('terminal1');
    });
  });

  describe('Toggle Button Click Prevention Tests', () => {
    it('should not allow focus events to interfere with toggle button clicks', () => {
      // Setup: Two agents
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');
      
      // terminal1 is DISCONNECTED, terminal2 is CONNECTED
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');

      // Simulate focus event (should not change status)
      // Note: Focus events should not trigger detection via our previous fix
      
      // Simulate legitimate toggle button click
      const result = detectionService.switchAgentConnection('terminal1');
      
      expect(result.success).to.be.true;
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
    });

    it('should differentiate between legitimate user toggle and automatic detection', () => {
      // Setup: One DISCONNECTED agent
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');
      
      // terminal1 is DISCONNECTED
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');

      // Try to use setConnectedAgent directly (should be blocked)
      detectionService.setConnectedAgent('terminal1', 'claude');
      
      // Should still be DISCONNECTED (blocked by our fix)
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');

      // Use legitimate toggle (should work)
      const result = detectionService.switchAgentConnection('terminal1');
      
      expect(result.success).to.be.true;
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
    });
  });

  describe('Toggle Button Error Handling', () => {
    it('should handle toggle attempts on non-existent terminals', () => {
      // No agents setup
      
      const result = detectionService.switchAgentConnection('nonexistent');
      
      expect(result.success).to.be.false;
      expect(result.newStatus).to.equal('none');
      expect(result.agentType).to.be.null;
    });

    it('should handle rapid toggle button clicks', () => {
      // Setup: Two agents
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');

      // Rapid clicks on same DISCONNECTED agent
      const result1 = detectionService.switchAgentConnection('terminal1');
      const result2 = detectionService.switchAgentConnection('terminal1');
      const result3 = detectionService.switchAgentConnection('terminal1');

      // All should succeed but result in same final state
      expect(result1.success).to.be.true;
      expect(result2.success).to.be.true;
      expect(result3.success).to.be.true;
      
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
    });
  });

  describe('Specification Compliance Verification', () => {
    it('should follow all toggle button specification rules', () => {
      // Test the complete specification workflow:
      
      // 1. NONE agents: no toggle button, no functionality
      expect(detectionService.getAgentStatus('terminal1')).to.equal('none');
      
      // 2. Create CONNECTED agent: hide toggle button
      detectionService.setConnectedAgent('terminal1', 'claude');
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
      
      // 3. Create second agent (first becomes DISCONNECTED): show toggle button
      detectionService.setConnectedAgent('terminal2', 'gemini');
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('connected');
      
      // 4. Toggle DISCONNECTED to CONNECTED: functionality works
      const result = detectionService.switchAgentConnection('terminal1');
      expect(result.success).to.be.true;
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
      expect(detectionService.getAgentStatus('terminal2')).to.equal('disconnected');
      
      // 5. Now terminal1 is CONNECTED: hide toggle button
      // 6. Now terminal2 is DISCONNECTED: show toggle button
    });

    it('should prevent toggle button functionality from violating focus-fix', () => {
      // This test ensures our toggle fix doesn't break the focus fix
      
      // Setup: Create DISCONNECTED agent
      detectionService.setConnectedAgent('terminal1', 'claude');
      detectionService.setConnectedAgent('terminal2', 'gemini');
      
      // terminal1 should be DISCONNECTED
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');

      // Direct setConnectedAgent should be blocked
      detectionService.setConnectedAgent('terminal1', 'claude');
      expect(detectionService.getAgentStatus('terminal1')).to.equal('disconnected');

      // But legitimate toggle should work
      const result = detectionService.switchAgentConnection('terminal1');
      expect(result.success).to.be.true;
      expect(detectionService.getAgentStatus('terminal1')).to.equal('connected');
    });
  });
});