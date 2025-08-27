/**
 * Integration test for CLI Agent status display fix
 *
 * Tests the complete flow from Extension -> WebView -> UI updates
 * ensuring status display works correctly after the terminalId-based fix
 */

import * as sinon from 'sinon';
import { expect } from 'chai';
import { RefactoredMessageManager } from '../../../webview/managers/RefactoredMessageManager';
import { UIManager } from '../../../webview/managers/UIManager';
import { HeaderFactory } from '../../../webview/factories/HeaderFactory';
import type { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';
import type { TerminalHeaderElements } from '../../../webview/factories/HeaderFactory';

describe('CLI Agent Status Display Integration', () => {
  let messageManager: RefactoredMessageManager;
  let uiManager: UIManager;
  let mockCoordinator: IManagerCoordinator;
  let sandbox: sinon.SinonSandbox;
  let mockHeaderElements: Map<string, TerminalHeaderElements>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    messageManager = new RefactoredMessageManager();
    uiManager = new UIManager();

    // Setup mock header elements for multiple terminals
    mockHeaderElements = new Map();

    for (let i = 1; i <= 3; i++) {
      const terminalId = `terminal-${i}`;
      const mockStatusSection = {
        appendChild: sandbox.stub(),
        removeChild: sandbox.stub(),
        querySelectorAll: sandbox.stub().returns([]),
      } as Partial<HTMLDivElement>;

      const mockHeaderElement: TerminalHeaderElements = {
        container: {} as HTMLDivElement,
        titleSection: {} as HTMLDivElement,
        nameSpan: { textContent: `Terminal ${i}` } as HTMLSpanElement,
        idSpan: {} as HTMLSpanElement,
        statusSection: mockStatusSection as HTMLDivElement,
        statusSpan: null,
        indicator: null,
        controlsSection: {} as HTMLDivElement,
        aiAgentToggleButton: {} as HTMLButtonElement,
        splitButton: {} as HTMLButtonElement,
        closeButton: {} as HTMLButtonElement,
      };

      mockHeaderElements.set(terminalId, mockHeaderElement);
      uiManager['headerElementsCache'].set(terminalId, mockHeaderElement);
    }

    // Mock coordinator with updateCliAgentStatus method
    mockCoordinator = {
      updateCliAgentStatus: sandbox.stub(),
      // Add other required coordinator methods as needed
    } as Partial<IManagerCoordinator> as IManagerCoordinator;

    // Mock HeaderFactory methods
    sandbox.stub(HeaderFactory, 'removeCliAgentStatus');
    sandbox.stub(HeaderFactory, 'insertCliAgentStatus');
    sandbox.stub(HeaderFactory, 'setAiAgentToggleButtonVisibility');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Full State Sync Message Processing', () => {
    it('should process full state sync with multiple terminal states correctly', () => {
      // Arrange - simulate full state sync message from Extension
      const fullStateSyncMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'claude' },
          'terminal-2': { status: 'disconnected', agentType: 'gemini' },
          'terminal-3': { status: 'none', agentType: null },
        },
      };

      // Act
      messageManager['handleCliAgentFullStateSyncMessage'](
        fullStateSyncMessage as Parameters<
          (typeof messageManager)['handleCliAgentFullStateSyncMessage']
        >[0],
        mockCoordinator
      );

      // Assert - verify updateCliAgentStatus was called for each terminal
      expect(mockCoordinator.updateCliAgentStatus).to.have.callCount(3);

      // Verify specific calls
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-1',
        'connected',
        'claude'
      );
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-2',
        'disconnected',
        'gemini'
      );
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-3',
        'none',
        null
      );
    });

    it('should handle empty terminal states gracefully', () => {
      // Arrange
      const emptyStateSyncMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {},
      };

      // Act
      messageManager['handleCliAgentFullStateSyncMessage'](
        emptyStateSyncMessage as any,
        mockCoordinator
      );

      // Assert
      expect(mockCoordinator.updateCliAgentStatus).to.not.have.been.called;
    });

    it('should handle missing terminalStates property gracefully', () => {
      // Arrange
      const invalidMessage = {
        command: 'cliAgentFullStateSync',
        // terminalStates is missing
      };

      // Act & Assert - should not throw
      expect(() => {
        messageManager['handleCliAgentFullStateSyncMessage'](
          invalidMessage as any,
          mockCoordinator
        );
      }).to.not.throw;

      expect(mockCoordinator.updateCliAgentStatus).to.not.have.been.called;
    });
  });

  describe('Agent Termination Flow', () => {
    it('should handle connected agent termination correctly', () => {
      // Arrange - start with connected state
      const initialStateMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'claude' },
          'terminal-2': { status: 'disconnected', agentType: 'gemini' },
        },
      };

      messageManager['handleCliAgentFullStateSyncMessage'](
        initialStateMessage as any,
        mockCoordinator
      );
      sandbox.resetHistory(); // Reset call counts

      // Act - simulate agent termination (connected -> none, disconnected -> connected)
      const terminationStateMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'none', agentType: null },
          'terminal-2': { status: 'connected', agentType: 'gemini' }, // auto-promoted
        },
      };

      messageManager['handleCliAgentFullStateSyncMessage'](
        terminationStateMessage as any,
        mockCoordinator
      );

      // Assert
      expect(mockCoordinator.updateCliAgentStatus).to.have.callCount(2);
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-1',
        'none',
        null
      );
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-2',
        'connected',
        'gemini'
      );
    });

    it('should handle disconnected agent termination correctly', () => {
      // Arrange - start with mixed state
      const initialStateMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'claude' },
          'terminal-2': { status: 'disconnected', agentType: 'gemini' },
          'terminal-3': { status: 'disconnected', agentType: 'claude' },
        },
      };

      messageManager['handleCliAgentFullStateSyncMessage'](
        initialStateMessage as any,
        mockCoordinator
      );
      sandbox.resetHistory();

      // Act - terminate disconnected agent (should not affect connected status)
      const terminationStateMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'claude' }, // remains connected
          'terminal-2': { status: 'none', agentType: null }, // terminated
          'terminal-3': { status: 'disconnected', agentType: 'claude' }, // remains disconnected
        },
      };

      messageManager['handleCliAgentFullStateSyncMessage'](
        terminationStateMessage as any,
        mockCoordinator
      );

      // Assert
      expect(mockCoordinator.updateCliAgentStatus).to.have.callCount(3);
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-1',
        'connected',
        'claude'
      );
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-2',
        'none',
        null
      );
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledWith(
        'terminal-3',
        'disconnected',
        'claude'
      );
    });
  });

  describe('Agent Type Transitions', () => {
    it('should handle agent type changes correctly', () => {
      // Arrange - start with Claude
      const initialMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'claude' },
        },
      };

      messageManager['handleCliAgentFullStateSyncMessage'](initialMessage as any, mockCoordinator);
      sandbox.resetHistory();

      // Act - switch to Gemini (simulate terminal restart)
      const switchMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'gemini' },
        },
      };

      messageManager['handleCliAgentFullStateSyncMessage'](switchMessage as any, mockCoordinator);

      // Assert
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledOnceWith(
        'terminal-1',
        'connected',
        'gemini'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle coordinator errors gracefully', () => {
      // Arrange
      mockCoordinator.updateCliAgentStatus = sandbox.stub().throws(new Error('Test error'));

      const message = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'connected', agentType: 'claude' },
        },
      };

      // Act & Assert - should not throw
      expect(() => {
        messageManager['handleCliAgentFullStateSyncMessage'](message as any, mockCoordinator);
      }).to.not.throw;
    });

    it('should handle malformed status values gracefully', () => {
      // Arrange
      const malformedMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'terminal-1': { status: 'invalid-status', agentType: 'claude' },
        },
      };

      // Act & Assert - should not throw
      expect(() => {
        messageManager['handleCliAgentFullStateSyncMessage'](
          malformedMessage as any,
          mockCoordinator
        );
      }).to.not.throw;

      // Should still attempt to call updateCliAgentStatus
      expect(mockCoordinator.updateCliAgentStatus).to.have.been.calledOnce;
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large number of terminals efficiently', () => {
      // Arrange - create many terminals
      const manyTerminals: Record<string, { status: string; agentType: string | null }> = {};

      for (let i = 1; i <= 50; i++) {
        manyTerminals[`terminal-${i}`] = {
          status: i === 1 ? 'connected' : i <= 10 ? 'disconnected' : 'none',
          agentType: i <= 10 ? (i % 2 === 0 ? 'claude' : 'gemini') : null,
        };
      }

      const largeStateMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: manyTerminals,
      };

      // Act
      const startTime = Date.now();
      messageManager['handleCliAgentFullStateSyncMessage'](
        largeStateMessage as any,
        mockCoordinator
      );
      const endTime = Date.now();

      // Assert
      expect(mockCoordinator.updateCliAgentStatus).to.have.callCount(50);
      expect(endTime - startTime).to.be.lessThan(100); // Should complete quickly
    });
  });
});
