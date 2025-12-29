/**
 * TerminalInitializationCoordinator Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalInitializationCoordinator } from '../../../../providers/TerminalInitializationCoordinator';

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('TerminalInitializationCoordinator', () => {
  let coordinator: TerminalInitializationCoordinator;
  let mockTerminalManager: any;
  let mockActions: any;
  let mockPersistenceService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTerminalManager = {
      getTerminals: vi.fn().mockReturnValue([]),
    };
    
    mockActions = {
      initializeTerminal: vi.fn().mockResolvedValue(undefined),
      ensureMinimumTerminals: vi.fn(),
      sendInitializationComplete: vi.fn().mockResolvedValue(undefined),
      restoreLastSession: vi.fn().mockResolvedValue(false),
    };
    
    mockPersistenceService = {
      restoreSession: vi.fn().mockResolvedValue({ success: false }),
    };

    coordinator = new TerminalInitializationCoordinator(
      mockTerminalManager,
      mockActions,
      mockPersistenceService
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should create default terminals if no session exists', async () => {
      await coordinator.initialize();
      
      expect(mockActions.initializeTerminal).toHaveBeenCalled();
      expect(mockPersistenceService.restoreSession).toHaveBeenCalled();
      expect(mockActions.restoreLastSession).toHaveBeenCalled();
      expect(mockActions.ensureMinimumTerminals).toHaveBeenCalled();
      
      // Check completion message after timeout
      await vi.advanceTimersByTimeAsync(100);
      await vi.waitFor(() => {
        expect(mockActions.sendInitializationComplete).toHaveBeenCalled();
      });
    });

    it('should restore from extension persistence if available', async () => {
      mockPersistenceService.restoreSession.mockResolvedValue({ success: true, restoredCount: 2 });
      
      await coordinator.initialize();
      
      expect(mockPersistenceService.restoreSession).toHaveBeenCalled();
      expect(mockActions.restoreLastSession).not.toHaveBeenCalled();
      expect(mockActions.ensureMinimumTerminals).not.toHaveBeenCalled();
    });

    it('should restore from webview if extension persistence fails', async () => {
      mockPersistenceService.restoreSession.mockResolvedValue({ success: false });
      mockActions.restoreLastSession.mockResolvedValue(true);
      
      await coordinator.initialize();
      
      expect(mockPersistenceService.restoreSession).toHaveBeenCalled();
      expect(mockActions.restoreLastSession).toHaveBeenCalled();
      expect(mockActions.ensureMinimumTerminals).not.toHaveBeenCalled();
    });

    it('should skip restoration if terminals already exist', async () => {
      mockTerminalManager.getTerminals.mockReturnValue([{ id: 't1' }]);
      
      await coordinator.initialize();
      
      expect(mockPersistenceService.restoreSession).not.toHaveBeenCalled();
      expect(mockActions.ensureMinimumTerminals).not.toHaveBeenCalled();
    });

    it('should handle critical errors with emergency creation', async () => {
      mockActions.initializeTerminal.mockRejectedValue(new Error('Fatal'));
      
      await coordinator.initialize();
      
      expect(mockActions.ensureMinimumTerminals).toHaveBeenCalled();
    });
  });
});
