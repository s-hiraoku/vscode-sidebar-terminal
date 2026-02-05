/**
 * Tests for CLI Agent status display fix
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 *
 * Issue: ステータスが表示されない問題の修正
 * Fix: terminalId-based status updates instead of terminalName-based
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIManager } from '../../../../webview/managers/UIManager';
import * as HeaderFactoryModule from '../../../../webview/factories/HeaderFactory';
import type { TerminalHeaderElements } from '../../../../webview/factories/HeaderFactory';

// Mock the HeaderFactory module
vi.mock('../../../../webview/factories/HeaderFactory', async () => {
  const actual = await vi.importActual<typeof HeaderFactoryModule>(
    '../../../../webview/factories/HeaderFactory'
  );
  return {
    ...actual,
    HeaderFactory: {
      ...actual.HeaderFactory,
      removeCliAgentStatus: vi.fn(),
      insertCliAgentStatus: vi.fn(),
      setAiAgentToggleButtonVisibility: vi.fn(),
    },
  };
});

describe('CLI Agent Status Display Fix', () => {
  let uiManager: UIManager;
  let mockHeaderElements: TerminalHeaderElements;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    uiManager = new UIManager();

    // Mock DOM elements
    const mockContainer = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as Partial<HTMLElement>;

    const mockStatusSection = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      querySelectorAll: vi.fn().mockReturnValue([]),
    } as Partial<HTMLElement>;

    const mockNameSpan = {
      textContent: 'Terminal 1',
    } as Partial<HTMLSpanElement>;

    mockHeaderElements = {
      container: mockContainer as HTMLElement,
      titleSection: {} as HTMLDivElement,
      nameSpan: mockNameSpan as HTMLSpanElement,
      idSpan: {} as HTMLSpanElement,
      processingIndicator: null,
      statusSection: mockStatusSection as HTMLDivElement,
      statusSpan: null,
      indicator: null,
      controlsSection: {} as HTMLDivElement,
      aiAgentToggleButton: {} as HTMLButtonElement,
      splitButton: {} as HTMLButtonElement,
      closeButton: {} as HTMLButtonElement,
    };

    // Set up header elements cache
    (uiManager as any).headerElementsCache.set('terminal-1', mockHeaderElements);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateCliAgentStatusByTerminalId', () => {
    it('should update status for connected agent', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledWith(
        mockHeaderElements,
        'connected',
        'claude'
      );
      // Connected状態でも切り替えボタンは表示 (always visible)
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'connected'
      );
      expect(HeaderFactory.removeCliAgentStatus).not.toHaveBeenCalled();
    });

    it('should update status for disconnected agent', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'gemini');

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledWith(
        mockHeaderElements,
        'disconnected',
        'gemini'
      );
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'disconnected'
      );
      expect(HeaderFactory.removeCliAgentStatus).not.toHaveBeenCalled();
    });

    it('should remove status for none state', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert
      expect(HeaderFactory.removeCliAgentStatus).toHaveBeenCalledWith(mockHeaderElements);
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true
      );
      expect(HeaderFactory.insertCliAgentStatus).not.toHaveBeenCalled();
    });

    it('should handle non-existent terminal gracefully', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('non-existent-terminal', 'connected', 'claude');

      // Assert - should not call any HeaderFactory methods
      expect(HeaderFactory.insertCliAgentStatus).not.toHaveBeenCalled();
      expect(HeaderFactory.removeCliAgentStatus).not.toHaveBeenCalled();
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).not.toHaveBeenCalled();
    });
  });

  describe('Full State Sync Integration', () => {
    it('should handle multiple terminal status updates correctly', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Setup multiple terminals
      const mockHeaderElements2: TerminalHeaderElements = {
        ...mockHeaderElements,
        nameSpan: { textContent: 'Terminal 2' } as HTMLSpanElement,
      };

      const mockHeaderElements3: TerminalHeaderElements = {
        ...mockHeaderElements,
        nameSpan: { textContent: 'Terminal 3' } as HTMLSpanElement,
      };

      (uiManager as any).headerElementsCache.set('terminal-2', mockHeaderElements2);
      (uiManager as any).headerElementsCache.set('terminal-3', mockHeaderElements3);

      // Act - simulate full state sync
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');
      uiManager.updateCliAgentStatusByTerminalId('terminal-2', 'disconnected', 'gemini');
      uiManager.updateCliAgentStatusByTerminalId('terminal-3', 'none', null);

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledTimes(2); // connected + disconnected
      expect(HeaderFactory.removeCliAgentStatus).toHaveBeenCalledTimes(1); // none
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledTimes(3); // all terminals
    });
  });

  describe('Status Transition Scenarios', () => {
    it('should handle connected -> none transition correctly', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Setup initial connected state
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Reset spies
      vi.clearAllMocks();

      // Act - transition to none
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert
      expect(HeaderFactory.removeCliAgentStatus).toHaveBeenCalledWith(mockHeaderElements);
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true
      );
    });

    it('should handle disconnected -> connected transition correctly', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Setup initial disconnected state
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'claude');

      // Reset spies
      vi.clearAllMocks();

      // Act - transition to connected
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledWith(
        mockHeaderElements,
        'connected',
        'claude'
      );
      // Connected状態でも切り替えボタンは表示 (always visible)
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'connected'
      );
    });

    it('should handle none -> connected transition correctly', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Start with none state (no initial setup needed)

      // Act - transition to connected
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'gemini');

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledWith(
        mockHeaderElements,
        'connected',
        'gemini'
      );
      // Connected状態でも切り替えボタンは表示 (always visible)
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'connected'
      );
      expect(HeaderFactory.removeCliAgentStatus).not.toHaveBeenCalled();
    });
  });

  describe('Agent Type Handling', () => {
    it('should pass correct agent type for Claude', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledWith(
        mockHeaderElements,
        'connected',
        'claude'
      );
    });

    it('should pass correct agent type for Gemini', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'gemini');

      // Assert
      expect(HeaderFactory.insertCliAgentStatus).toHaveBeenCalledWith(
        mockHeaderElements,
        'connected',
        'gemini'
      );
    });

    it('should handle null agent type for none status', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert - removeCliAgentStatus should be called, agentType is irrelevant
      expect(HeaderFactory.removeCliAgentStatus).toHaveBeenCalledWith(mockHeaderElements);
    });
  });

  describe('AI Agent Toggle Button Visibility Rules', () => {
    it('should show toggle button for connected status (always visible)', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'connected'
      );
    });

    it('should show toggle button for disconnected status', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'gemini');

      // Assert
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'disconnected'
      );
    });

    it('should show toggle button for none status (always visible)', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'none', null);

      // Assert
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true
      );
    });

    it('should correctly handle connected -> disconnected -> connected transitions (always visible)', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Initial: connected (button visible)
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');
      vi.clearAllMocks();

      // Transition to disconnected (button still visible)
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'disconnected', 'claude');
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'disconnected'
      );
      vi.clearAllMocks();

      // Transition back to connected (button still visible)
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).toHaveBeenCalledWith(
        mockHeaderElements,
        true,
        'connected'
      );
    });
  });

  describe('Performance and Caching', () => {
    it('should use cached header elements efficiently', () => {
      // Setup spy on cache get
      const cacheGetSpy = vi.spyOn((uiManager as any).headerElementsCache, 'get');

      // Act
      uiManager.updateCliAgentStatusByTerminalId('terminal-1', 'connected', 'claude');

      // Assert
      expect(cacheGetSpy).toHaveBeenCalledWith('terminal-1');
    });

    it('should not perform unnecessary DOM operations when terminal not found', () => {
      const { HeaderFactory } = HeaderFactoryModule;
      // Act - try to update non-existent terminal
      uiManager.updateCliAgentStatusByTerminalId('non-existent', 'connected', 'claude');

      // Assert - no DOM operations should be performed
      expect(HeaderFactory.insertCliAgentStatus).not.toHaveBeenCalled();
      expect(HeaderFactory.removeCliAgentStatus).not.toHaveBeenCalled();
      expect(HeaderFactory.setAiAgentToggleButtonVisibility).not.toHaveBeenCalled();
    });
  });
});
