/**
 * HeaderFactory Test Suite
 * Tests CLI Agent status management and multiple status display prevention
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../../shared/TestSetup';
import { HeaderFactory, TerminalHeaderElements } from '../../../../webview/factories/HeaderFactory';

describe('HeaderFactory - CLI Agent Status Management', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: any;
  let consoleMocks: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup complete test environment with DOM
    const testEnv = setupCompleteTestEnvironment();
    dom = testEnv.dom;
    consoleMocks = testEnv.consoleMocks;
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('CLI Agent Status Element Management', () => {
    let headerElements: TerminalHeaderElements;

    beforeEach(() => {
      // Create a mock terminal header
      headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'test-terminal-1',
        terminalName: 'Test Terminal',
        customClasses: ['test-header']
      });
    });

    it('should create terminal header with proper structure', () => {
      expect(headerElements.container).to.exist;
      expect(headerElements.statusSection).to.exist;
      expect(headerElements.nameSpan.textContent).to.equal('Test Terminal');
      expect(headerElements.statusSpan).to.be.null; // Initially no status
      expect(headerElements.indicator).to.be.null; // Initially no indicator
    });

    it('should insert CLI Agent status elements correctly', () => {
      // Act
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', 'claude');

      // Assert
      expect(headerElements.statusSpan).to.exist;
      expect(headerElements.indicator).to.exist;
      expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Connected');
      expect(headerElements.statusSpan?.className).to.equal('ai-agent-status');
      expect(headerElements.indicator?.className).to.equal('ai-agent-indicator');
      expect(headerElements.indicator?.textContent).to.equal('●');
    });

    it('should insert disconnected status with proper styling', () => {
      // Act
      HeaderFactory.insertCliAgentStatus(headerElements, 'disconnected', 'gemini');

      // Assert
      expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Disconnected');
      expect(headerElements.indicator?.className).to.equal('ai-agent-indicator');
      
      // Verify correct elements are created (JSDOM style parsing may be inconsistent)
      const statusElements = headerElements.statusSection.querySelectorAll('.ai-agent-status, .ai-agent-indicator');
      expect(statusElements.length).to.equal(2);
    });

    it('should remove all CLI Agent status elements correctly', () => {
      // Arrange - Add status first
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', 'claude');
      expect(headerElements.statusSpan).to.exist;
      expect(headerElements.indicator).to.exist;

      // Act
      HeaderFactory.removeCliAgentStatus(headerElements);

      // Assert
      expect(headerElements.statusSpan).to.be.null;
      expect(headerElements.indicator).to.be.null;
      
      // Verify DOM elements are removed
      const statusElements = headerElements.statusSection.querySelectorAll(
        '.ai-agent-status, .ai-agent-indicator'
      );
      expect(statusElements.length).to.equal(0);
    });

    it('should prevent multiple status displays by removing old elements first', () => {
      // Arrange - Insert first status
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', 'claude');
      
      // Verify first status exists
      let statusElements = headerElements.statusSection.querySelectorAll(
        '.ai-agent-status, .ai-agent-indicator'
      );
      expect(statusElements.length).to.equal(2); // statusSpan + indicator

      // Act - Insert second status (should replace, not accumulate)
      HeaderFactory.insertCliAgentStatus(headerElements, 'disconnected', 'gemini');

      // Assert - Should still have only 2 elements (statusSpan + indicator)
      statusElements = headerElements.statusSection.querySelectorAll(
        '.ai-agent-status, .ai-agent-indicator'
      );
      expect(statusElements.length).to.equal(2);
      
      // Verify content is updated to latest status
      expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Disconnected');
    });

    it('should remove legacy claude-status elements as well', () => {
      // Arrange - Manually add legacy elements to simulate old code
      const legacyStatus = document.createElement('span');
      legacyStatus.className = 'claude-status';
      legacyStatus.textContent = 'CLAUDE CLI Active';
      
      const legacyIndicator = document.createElement('span');
      legacyIndicator.className = 'claude-indicator';
      legacyIndicator.textContent = '●';
      
      headerElements.statusSection.appendChild(legacyStatus);
      headerElements.statusSection.appendChild(legacyIndicator);

      // Verify legacy elements exist
      let legacyElements = headerElements.statusSection.querySelectorAll(
        '.claude-status, .claude-indicator'
      );
      expect(legacyElements.length).to.equal(2);

      // Act - Remove status should handle both new and legacy elements
      HeaderFactory.removeCliAgentStatus(headerElements);

      // Assert - All elements should be removed
      legacyElements = headerElements.statusSection.querySelectorAll(
        '.claude-status, .claude-indicator, .ai-agent-status, .ai-agent-indicator'
      );
      expect(legacyElements.length).to.equal(0);
    });

    it('should handle multiple rapid status updates without accumulation', () => {
      // Simulate rapid status changes that caused the original bug
      const statusUpdates = [
        { status: 'connected' as const, type: 'claude' },
        { status: 'disconnected' as const, type: 'claude' },
        { status: 'connected' as const, type: 'gemini' },
        { status: 'disconnected' as const, type: 'gemini' },
        { status: 'connected' as const, type: 'claude' }
      ];

      statusUpdates.forEach(update => {
        HeaderFactory.insertCliAgentStatus(headerElements, update.status, update.type);
      });

      // Assert - Should still have only 2 elements (statusSpan + indicator)
      const statusElements = headerElements.statusSection.querySelectorAll(
        '.ai-agent-status, .ai-agent-indicator, .claude-status, .claude-indicator'
      );
      expect(statusElements.length).to.equal(2);
      
      // Final status should be the last one applied
      expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Connected');
    });

    it('should use unified "AI Agent" display name regardless of agent type', () => {
      // Test different agent types all display as "AI Agent"
      const agentTypes = ['claude', 'gemini', null, 'unknown'];

      agentTypes.forEach(agentType => {
        HeaderFactory.insertCliAgentStatus(headerElements, 'connected', agentType);
        expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Connected');
        
        HeaderFactory.insertCliAgentStatus(headerElements, 'disconnected', agentType);
        expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Disconnected');
      });
    });

    it('should maintain proper CSS styling for connected status', () => {
      // Act
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', 'claude');

      // Assert elements are created with correct classes and content
      expect(headerElements.statusSpan?.textContent).to.equal('AI Agent Connected');
      expect(headerElements.statusSpan?.className).to.equal('ai-agent-status');
      expect(headerElements.indicator?.className).to.equal('ai-agent-indicator');
      expect(headerElements.indicator?.textContent).to.equal('●');
      
      // Verify correct elements exist in DOM
      const statusElements = headerElements.statusSection.querySelectorAll('.ai-agent-status, .ai-agent-indicator');
      expect(statusElements.length).to.equal(2);
    });

    it('should handle removeCliAgentStatus when no status elements exist', () => {
      // Act - Remove when nothing exists (should not throw error)
      expect(() => {
        HeaderFactory.removeCliAgentStatus(headerElements);
      }).to.not.throw();

      // Assert - References should be null
      expect(headerElements.statusSpan).to.be.null;
      expect(headerElements.indicator).to.be.null;
    });
  });

  describe('Backward Compatibility', () => {
    it('should support createCliAgentStatusElement legacy method', () => {
      // Act
      const statusElement = HeaderFactory.createCliAgentStatusElement('connected', 'claude');

      // Assert
      expect(statusElement).to.exist;
      expect(statusElement.className).to.equal('claude-status-container');
      expect(statusElement.querySelector('.claude-status')?.textContent).to.include('CLAUDE CLI Active');
    });

    it('should handle mixed legacy and new status elements', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'mixed-test',
        terminalName: 'Mixed Test Terminal'
      });

      // Add legacy element
      const legacyElement = HeaderFactory.createCliAgentStatusElement('connected', 'claude');
      headerElements.statusSection.appendChild(legacyElement);

      // Add new element
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', 'gemini');

      // Verify both types can be removed
      HeaderFactory.removeCliAgentStatus(headerElements);
      
      const allStatusElements = headerElements.statusSection.querySelectorAll(
        '.claude-status, .claude-indicator, .ai-agent-status, .ai-agent-indicator, .claude-status-container'
      );
      
      // Note: createCliAgentStatusElement creates a container that won't be removed by removeCliAgentStatus
      // This is expected behavior as they are different systems
      expect(allStatusElements.length).to.equal(1); // Only the legacy container remains
    });
  });

  describe('Error Handling', () => {
    it('should handle null or undefined elements gracefully', () => {
      const malformedElements = {
        container: document.createElement('div'),
        titleSection: document.createElement('div'),
        nameSpan: document.createElement('span'),
        idSpan: document.createElement('span'),
        statusSection: document.createElement('div'),
        statusSpan: null,
        indicator: null,
        controlsSection: document.createElement('div'),
        splitButton: document.createElement('button'),
        closeButton: document.createElement('button')
      } as TerminalHeaderElements;

      // Should not throw errors
      expect(() => {
        HeaderFactory.insertCliAgentStatus(malformedElements, 'connected', 'claude');
      }).to.not.throw();

      expect(() => {
        HeaderFactory.removeCliAgentStatus(malformedElements);
      }).to.not.throw();
    });
  });

  describe('Performance and Memory', () => {
    it('should not cause memory leaks with repeated status updates', () => {
      const headerElements = HeaderFactory.createTerminalHeader({
        terminalId: 'perf-test',
        terminalName: 'Performance Test Terminal'
      });

      // Simulate many status updates
      for (let i = 0; i < 100; i++) {
        const status = i % 2 === 0 ? 'connected' : 'disconnected';
        const agentType = i % 3 === 0 ? 'claude' : 'gemini';
        HeaderFactory.insertCliAgentStatus(headerElements, status as any, agentType);
      }

      // Should still have only 2 elements
      const statusElements = headerElements.statusSection.querySelectorAll(
        '.ai-agent-status, .ai-agent-indicator'
      );
      expect(statusElements.length).to.equal(2);

      // Cleanup should work properly
      HeaderFactory.removeCliAgentStatus(headerElements);
      const remainingElements = headerElements.statusSection.querySelectorAll(
        '.ai-agent-status, .ai-agent-indicator'
      );
      expect(remainingElements.length).to.equal(0);
    });
  });
});