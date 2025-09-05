/**
 * Tests for CLI Agent status display fix
 *
 * Issue: ステータスが表示されない問題の修正
 * Fix: terminalId-based status updates instead of terminalName-based
 */

import * as sinon from 'sinon';
import { expect } from 'chai';
import { UIManager } from '../../../webview/managers/UIManager';
import { HeaderFactory } from '../../../webview/factories/HeaderFactory';
import type { TerminalHeaderElements } from '../../../webview/factories/HeaderFactory';

describe('CLI Agent Status Display Fix', () => {
  let uiManager: UIManager;
  let sandbox: sinon.SinonSandbox;
  let mockHeaderElements: TerminalHeaderElements;
  let mockRemoveStatusSpy: sinon.SinonStub;
  let mockInsertStatusSpy: sinon.SinonStub;
  let mockSetVisibilitySpy: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    uiManager = new UIManager();

    // Mock DOM elements
    const mockContainer = {
      querySelector: sandbox.stub(),
      querySelectorAll: sandbox.stub().returns([]),
    } as Partial<HTMLElement>;

    const mockStatusSection = {
      appendChild: sandbox.stub(),
      removeChild: sandbox.stub(),
      querySelectorAll: sandbox.stub().returns([]),
    } as Partial<HTMLElement>;

    const mockNameSpan = {
      textContent: 'Terminal 1',
    } as Partial<HTMLSpanElement>;

    mockHeaderElements = {
      container: mockContainer as HTMLElement,
      titleSection: {} as HTMLDivElement,
      nameSpan: mockNameSpan as HTMLSpanElement,
      idSpan: {} as HTMLSpanElement,
      statusSection: mockStatusSection as HTMLDivElement,
      statusSpan: null,
      indicator: null,
      controlsSection: {} as HTMLDivElement,
      aiAgentToggleButton: {} as HTMLButtonElement,
      splitButton: {} as HTMLButtonElement,
      closeButton: {} as HTMLButtonElement,
    };

    // Mock HeaderFactory static methods
    mockRemoveStatusSpy = sandbox.stub(HeaderFactory, 'removeCliAgentStatus');
    mockInsertStatusSpy = sandbox.stub(HeaderFactory, 'insertCliAgentStatus');
    mockSetVisibilitySpy = sandbox.stub(HeaderFactory, 'setAiAgentToggleButtonVisibility');

    // Set up header elements cache
    uiManager['headerElementsCache'].set('terminal-1', mockHeaderElements);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('updateCliAgentStatusByTerminalId', () => {
    it('should update status for connected agent', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(mockInsertStatusSpy.calledOnceWith(mockHeaderElements, 'connected', 'claude')).to.be
        .true;
      // Connected状態でも切り替えボタンは表示 (always visible)
      expect(mockSetVisibilitySpy.calledOnceWith(mockHeaderElements, true, 'connected')).to.be.true;
      expect(mockRemoveStatusSpy.called).to.be.false;
    });

    it('should update status for disconnected agent', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'gemini');

      // Assert
      expect(mockInsertStatusSpy.calledOnceWith(mockHeaderElements, 'disconnected', 'gemini')).to.be
        .true;
      expect(mockSetVisibilitySpy.calledOnceWith(mockHeaderElements, true, 'disconnected')).to.be
        .true;
      expect(mockRemoveStatusSpy.called).to.be.false;
    });

    it('should remove status for none state', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert
      expect(mockRemoveStatusSpy.calledOnceWith(mockHeaderElements)).to.be.true;
      expect(mockSetVisibilitySpy.calledOnceWith(mockHeaderElements, true)).to.be.true;
      expect(mockInsertStatusSpy.called).to.be.false;
    });

    it('should handle non-existent terminal gracefully', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('non-existent-terminal', 'connected', 'claude');

      // Assert - should not call any HeaderFactory methods
      expect(mockInsertStatusSpy.called).to.be.false;
      expect(mockRemoveStatusSpy.called).to.be.false;
      expect(mockSetVisibilitySpy.called).to.be.false;
    });
  });

  describe('Full State Sync Integration', () => {
    it('should handle multiple terminal status updates correctly', () => {
      // Setup multiple terminals
      const mockHeaderElements2: TerminalHeaderElements = {
        ...mockHeaderElements,
        nameSpan: { textContent: 'Terminal 2' } as HTMLSpanElement,
      };

      const mockHeaderElements3: TerminalHeaderElements = {
        ...mockHeaderElements,
        nameSpan: { textContent: 'Terminal 3' } as HTMLSpanElement,
      };

      uiManager['headerElementsCache'].set('terminal-2', mockHeaderElements2);
      uiManager['headerElementsCache'].set('terminal-3', mockHeaderElements3);

      // Act - simulate full state sync
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');
      uiManager.updateCliAgentStatusByTerminalId('terminal-2', 'disconnected', 'gemini');
      uiManager.updateCliAgentStatusByTerminalId('terminal-3', 'none', null);

      // Assert
      expect(mockInsertStatusSpy.callCount).to.equal(2); // connected + disconnected
      expect(mockRemoveStatusSpy.callCount).to.equal(1); // none
      expect(mockSetVisibilitySpy.callCount).to.equal(3); // all terminals
    });
  });

  describe('Status Transition Scenarios', () => {
    it('should handle connected -> none transition correctly', () => {
      // Setup initial connected state
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Reset spies
      mockInsertStatusSpy.resetHistory();
      mockRemoveStatusSpy.resetHistory();
      mockSetVisibilitySpy.resetHistory();

      // Act - transition to none
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert
      expect(mockRemoveStatusSpy.calledOnceWith(mockHeaderElements)).to.be.true;
      expect(mockSetVisibilitySpy.calledOnceWith(mockHeaderElements, true)).to.be.true;
    });

    it('should handle disconnected -> connected transition correctly', () => {
      // Setup initial disconnected state
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'claude');

      // Reset spies
      mockInsertStatusSpy.resetHistory();
      mockRemoveStatusSpy.resetHistory();
      mockSetVisibilitySpy.resetHistory();

      // Act - transition to connected
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(mockInsertStatusSpy.calledOnceWith(mockHeaderElements, 'connected', 'claude')).to.be
        .true;
      // Connected状態でも切り替えボタンは表示 (always visible)
      expect(mockSetVisibilitySpy.calledOnceWith(mockHeaderElements, true, 'connected')).to.be.true;
    });

    it('should handle none -> connected transition correctly', () => {
      // Start with none state (no initial setup needed)

      // Act - transition to connected
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'gemini');

      // Assert
      expect(mockInsertStatusSpy.calledOnceWith(mockHeaderElements, 'connected', 'gemini')).to.be
        .true;
      // Connected状態でも切り替えボタンは表示 (always visible)
      expect(mockSetVisibilitySpy.calledOnceWith(mockHeaderElements, true, 'connected')).to.be.true;
      expect(mockRemoveStatusSpy.called).to.be.false;
    });
  });

  describe('Agent Type Handling', () => {
    it('should pass correct agent type for Claude', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(mockInsertStatusSpy.calledWith(mockHeaderElements, 'connected', 'claude')).to.be.true;
    });

    it('should pass correct agent type for Gemini', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'gemini');

      // Assert
      expect(mockInsertStatusSpy.calledWith(mockHeaderElements, 'connected', 'gemini')).to.be.true;
    });

    it('should handle null agent type for none status', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert - removeCliAgentStatus should be called, agentType is irrelevant
      expect(mockRemoveStatusSpy.calledOnceWith(mockHeaderElements)).to.be.true;
    });
  });

  describe('AI Agent Toggle Button Visibility Rules', () => {
    it('should show toggle button for connected status (always visible)', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(mockSetVisibilitySpy.calledWith(mockHeaderElements, true, 'connected')).to.be.true;
    });

    it('should show toggle button for disconnected status', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'gemini');

      // Assert
      expect(mockSetVisibilitySpy.calledWith(mockHeaderElements, true, 'disconnected')).to.be.true;
    });

    it('should show toggle button for none status (always visible)', () => {
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert
      expect(mockSetVisibilitySpy.calledWith(mockHeaderElements, true)).to.be.true;
    });

    it('should correctly handle connected -> disconnected -> connected transitions (always visible)', () => {
      // Initial: connected (button visible)
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');
      mockSetVisibilitySpy.resetHistory();

      // Transition to disconnected (button still visible)
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'claude');
      expect(mockSetVisibilitySpy.calledWith(mockHeaderElements, true, 'disconnected')).to.be.true;
      mockSetVisibilitySpy.resetHistory();

      // Transition back to connected (button still visible)
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');
      expect(mockSetVisibilitySpy.calledWith(mockHeaderElements, true, 'connected')).to.be.true;
    });
  });

  describe('Performance and Caching', () => {
    it('should use cached header elements efficiently', () => {
      // Setup spy on cache get
      const cacheGetSpy = sandbox.spy(uiManager['headerElementsCache'], 'get');

      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(cacheGetSpy.calledOnceWith('terminal-1')).to.be.true;
    });

    it('should not perform unnecessary DOM operations when terminal not found', () => {
      // Act - try to update non-existent terminal
      uiManager.updateCliAgentStatusByTerminalId('non-existent', 'connected', 'claude');

      // Assert - no DOM operations should be performed
      expect(mockInsertStatusSpy.called).to.be.false;
      expect(mockRemoveStatusSpy.called).to.be.false;
      expect(mockSetVisibilitySpy.called).to.be.false;
    });
  });
});
