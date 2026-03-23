/**
 * TerminalStateCoordinator Tests
 *
 * Tests for terminal state management methods extracted from LightweightTerminalWebviewManager.
 * Covers: updateState, updateUIFromState, updateTerminalCreationState, updateDebugDisplay,
 *         showTerminalLimitMessage, requestLatestState, getCurrentCachedState,
 *         getSystemStatus, isSystemReady
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TerminalStateCoordinator,
  ITerminalStateCoordinatorDependencies,
} from '../../../../../webview/coordinators/TerminalStateCoordinator';
import { TerminalState } from '../../../../../types/shared';

function createMockDeps(): ITerminalStateCoordinatorDependencies {
  return {
    getCurrentTerminalState: vi.fn().mockReturnValue(null),
    setCurrentTerminalState: vi.fn(),
    getHasProcessedInitialState: vi.fn().mockReturnValue(false),
    setHasProcessedInitialState: vi.fn(),
    terminalOperationsUpdateState: vi.fn(),
    hasPendingCreations: vi.fn().mockReturnValue(false),
    getPendingCreationsCount: vi.fn().mockReturnValue(0),
    processPendingCreationRequests: vi.fn(),
    hasPendingDeletions: vi.fn().mockReturnValue(false),
    getPendingDeletions: vi.fn().mockReturnValue([]),
    updateFromState: vi.fn(),
    updateCreationState: vi.fn(),
    debugUpdateDisplay: vi.fn(),
    debugShowTerminalLimitMessage: vi.fn(),
    ensureSplitResizersOnInitialDisplay: vi.fn(),
    postMessageToExtension: vi.fn(),
  };
}

function createTestState(overrides: Partial<TerminalState> = {}): TerminalState {
  return {
    terminals: [{ id: '1', name: 'Terminal 1' }] as any[],
    activeTerminalId: '1',
    maxTerminals: 5,
    availableSlots: [2, 3, 4, 5],
    ...overrides,
  };
}

describe('TerminalStateCoordinator', () => {
  let coordinator: TerminalStateCoordinator;
  let deps: ITerminalStateCoordinatorDependencies;

  beforeEach(() => {
    deps = createMockDeps();
    coordinator = new TerminalStateCoordinator(deps);
  });

  describe('updateState', () => {
    it('should reject null state', () => {
      coordinator.updateState(null);

      expect(deps.terminalOperationsUpdateState).not.toHaveBeenCalled();
      expect(deps.setCurrentTerminalState).not.toHaveBeenCalled();
    });

    it('should reject non-object state', () => {
      coordinator.updateState('invalid');

      expect(deps.terminalOperationsUpdateState).not.toHaveBeenCalled();
    });

    it('should reject state with missing terminals array', () => {
      coordinator.updateState({ availableSlots: [], maxTerminals: 5 });

      expect(deps.terminalOperationsUpdateState).not.toHaveBeenCalled();
    });

    it('should reject state with missing availableSlots array', () => {
      coordinator.updateState({ terminals: [], maxTerminals: 5 });

      expect(deps.terminalOperationsUpdateState).not.toHaveBeenCalled();
    });

    it('should reject state with non-number maxTerminals', () => {
      coordinator.updateState({ terminals: [], availableSlots: [], maxTerminals: 'five' });

      expect(deps.terminalOperationsUpdateState).not.toHaveBeenCalled();
    });

    it('should process valid state and update cache', () => {
      const state = createTestState();
      // After setCurrentTerminalState is called, getCurrentTerminalState returns the new state
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.updateState(state);

      expect(deps.terminalOperationsUpdateState).toHaveBeenCalledWith(state);
      expect(deps.setCurrentTerminalState).toHaveBeenCalledWith({
        terminals: state.terminals,
        activeTerminalId: state.activeTerminalId,
        maxTerminals: state.maxTerminals,
        availableSlots: state.availableSlots,
      });
    });

    it('should update UI from state', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.updateState(state);

      expect(deps.updateFromState).toHaveBeenCalledWith(state);
    });

    it('should ensure split resizers on initial display', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);
      vi.mocked(deps.getHasProcessedInitialState).mockReturnValue(false);

      coordinator.updateState(state);

      expect(deps.ensureSplitResizersOnInitialDisplay).toHaveBeenCalledWith(state, true);
    });

    it('should pass isInitialStateSync=false when state was already processed', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);
      vi.mocked(deps.getHasProcessedInitialState).mockReturnValue(true);

      coordinator.updateState(state);

      expect(deps.ensureSplitResizersOnInitialDisplay).toHaveBeenCalledWith(state, false);
    });

    it('should update terminal creation state', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.updateState(state);

      expect(deps.updateCreationState).toHaveBeenCalledWith(state);
    });

    it('should update debug display', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.updateState(state);

      expect(deps.debugUpdateDisplay).toHaveBeenCalledWith(state, 'state-update');
    });

    it('should process pending creation requests when present', () => {
      vi.useFakeTimers();
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(true);
      vi.mocked(deps.getPendingCreationsCount).mockReturnValue(2);

      coordinator.updateState(state);

      vi.advanceTimersByTime(50);
      expect(deps.processPendingCreationRequests).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should not process pending creation requests when none pending', () => {
      vi.useFakeTimers();
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(false);

      coordinator.updateState(state);

      vi.advanceTimersByTime(50);
      expect(deps.processPendingCreationRequests).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should mark initial state as processed', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.updateState(state);

      expect(deps.setHasProcessedInitialState).toHaveBeenCalledWith(true);
    });
  });

  describe('updateUIFromState', () => {
    it('should delegate to updateFromState', () => {
      const state = createTestState();

      coordinator.updateUIFromState(state);

      expect(deps.updateFromState).toHaveBeenCalledWith(state);
    });
  });

  describe('updateTerminalCreationState', () => {
    it('should delegate to updateCreationState when state exists', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.updateTerminalCreationState();

      expect(deps.updateCreationState).toHaveBeenCalledWith(state);
    });

    it('should not call updateCreationState when no state', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(null);

      coordinator.updateTerminalCreationState();

      expect(deps.updateCreationState).not.toHaveBeenCalled();
    });
  });

  describe('updateDebugDisplay', () => {
    it('should delegate to debugUpdateDisplay with state-update source', () => {
      const state = createTestState();

      coordinator.updateDebugDisplay(state);

      expect(deps.debugUpdateDisplay).toHaveBeenCalledWith(state, 'state-update');
    });
  });

  describe('showTerminalLimitMessage', () => {
    it('should delegate to updateCreationState when currentState exists', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      coordinator.showTerminalLimitMessage(5, 5);

      expect(deps.updateCreationState).toHaveBeenCalledWith(state);
      expect(deps.debugShowTerminalLimitMessage).not.toHaveBeenCalled();
    });

    it('should delegate to debugShowTerminalLimitMessage when no currentState', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(null);

      coordinator.showTerminalLimitMessage(5, 5);

      expect(deps.debugShowTerminalLimitMessage).toHaveBeenCalledWith(5, 5);
      expect(deps.updateCreationState).not.toHaveBeenCalled();
    });
  });

  describe('requestLatestState', () => {
    it('should post requestState message to extension', () => {
      coordinator.requestLatestState();

      expect(deps.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'requestState',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('getCurrentCachedState', () => {
    it('should return null when no state cached', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(null);

      expect(coordinator.getCurrentCachedState()).toBeNull();
    });

    it('should return cached state', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);

      expect(coordinator.getCurrentCachedState()).toBe(state);
    });
  });

  describe('isSystemReady', () => {
    it('should return false when no cached state', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(null);
      vi.mocked(deps.hasPendingDeletions).mockReturnValue(false);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(false);

      expect(coordinator.isSystemReady()).toBe(false);
    });

    it('should return false when pending deletions exist', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(createTestState());
      vi.mocked(deps.hasPendingDeletions).mockReturnValue(true);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(false);

      expect(coordinator.isSystemReady()).toBe(false);
    });

    it('should return false when pending creations exist', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(createTestState());
      vi.mocked(deps.hasPendingDeletions).mockReturnValue(false);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(true);

      expect(coordinator.isSystemReady()).toBe(false);
    });

    it('should return true when state exists and no pending operations', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(createTestState());
      vi.mocked(deps.hasPendingDeletions).mockReturnValue(false);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(false);

      expect(coordinator.isSystemReady()).toBe(true);
    });
  });

  describe('getSystemStatus', () => {
    it('should return complete system status snapshot', () => {
      const state = createTestState();
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(state);
      vi.mocked(deps.hasPendingDeletions).mockReturnValue(false);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(false);
      vi.mocked(deps.getPendingDeletions).mockReturnValue([]);
      vi.mocked(deps.getPendingCreationsCount).mockReturnValue(0);

      const status = coordinator.getSystemStatus();

      expect(status).toEqual({
        ready: true,
        state: state,
        pendingOperations: {
          deletions: [],
          creations: 0,
        },
      });
    });

    it('should reflect pending operations in status', () => {
      vi.mocked(deps.getCurrentTerminalState).mockReturnValue(createTestState());
      vi.mocked(deps.hasPendingDeletions).mockReturnValue(true);
      vi.mocked(deps.hasPendingCreations).mockReturnValue(true);
      vi.mocked(deps.getPendingDeletions).mockReturnValue(['terminal-1']);
      vi.mocked(deps.getPendingCreationsCount).mockReturnValue(3);

      const status = coordinator.getSystemStatus();

      expect(status.ready).toBe(false);
      expect(status.pendingOperations.deletions).toEqual(['terminal-1']);
      expect(status.pendingOperations.creations).toBe(3);
    });
  });
});
