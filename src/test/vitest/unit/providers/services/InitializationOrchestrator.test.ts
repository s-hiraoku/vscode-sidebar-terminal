/**
 * InitializationOrchestrator Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InitializationOrchestrator, InitializationPhase } from '../../../../../providers/services/InitializationOrchestrator';

const { mockTerminalCoordinator, mockMessageRouter } = vi.hoisted(() => ({
  mockTerminalCoordinator: {
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  mockMessageRouter: {
    setInitialized: vi.fn(),
    logRegisteredHandlers: vi.fn(),
  },
}));

const mockLifecycleManager = {};

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('InitializationOrchestrator', () => {
  let orchestrator: InitializationOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalCoordinator.initialize.mockResolvedValue(undefined);
    orchestrator = new InitializationOrchestrator(
      mockTerminalCoordinator as any,
      mockLifecycleManager as any,
      mockMessageRouter as any
    );
  });

  describe('Initial State', () => {
    it('should start in NOT_STARTED phase', () => {
      expect(orchestrator.getCurrentPhase()).toBe(InitializationPhase.NOT_STARTED);
      expect(orchestrator.isInitialized()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should complete all phases successfully', async () => {
      const result = await orchestrator.initialize();
      
      expect(result.success).toBe(true);
      expect(result.phase).toBe(InitializationPhase.COMPLETED);
      expect(orchestrator.isInitialized()).toBe(true);
      
      expect(mockMessageRouter.setInitialized).toHaveBeenCalledWith(true);
      expect(mockTerminalCoordinator.initialize).toHaveBeenCalled();
    });

    it('should track phase timings', async () => {
      await orchestrator.initialize();
      const timings = orchestrator.getPhaseTimings();
      
      expect(timings.has(InitializationPhase.WEBVIEW_SETUP)).toBe(true);
      expect(timings.has(InitializationPhase.MESSAGE_HANDLERS)).toBe(true);
      expect(timings.has(InitializationPhase.TERMINAL_SETUP)).toBe(true);
      expect(orchestrator.getTotalDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should skip initialization if already complete', async () => {
      await orchestrator.initialize();
      mockTerminalCoordinator.initialize.mockClear();
      
      const result = await orchestrator.initialize();
      expect(result.phase).toBe(InitializationPhase.COMPLETED);
      expect(mockTerminalCoordinator.initialize).not.toHaveBeenCalled();
    });

    it('should handle phase failure gracefully', async () => {
      const error = new Error('Setup failed');
      mockTerminalCoordinator.initialize.mockRejectedValue(error);
      
      const result = await orchestrator.initialize();
      
      expect(result.success).toBe(false);
      expect(result.phase).toBe(InitializationPhase.FAILED);
      expect(result.error).toBe(error);
      expect(orchestrator.isInitialized()).toBe(false);
    });
  });

  describe('Reset and Independent Init', () => {
    it('should initialize terminals independently', async () => {
      await orchestrator.initializeTerminals();
      expect(mockTerminalCoordinator.initialize).toHaveBeenCalled();
    });

    it('should allow re-initialization after reset', async () => {
      await orchestrator.initialize();
      orchestrator.reset();
      
      expect(orchestrator.isInitialized()).toBe(false);
      expect(orchestrator.getCurrentPhase()).toBe(InitializationPhase.NOT_STARTED);
      
      await orchestrator.initialize();
      expect(orchestrator.isInitialized()).toBe(true);
    });
  });
});
