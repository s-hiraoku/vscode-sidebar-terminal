/**
 * WatchdogCoordinator Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock TerminalInitializationWatchdog
vi.mock(
  '../../../../../providers/services/TerminalInitializationWatchdog',
  () => {
    const MockWatchdog = vi.fn().mockImplementation(function(this: any) {
      this.start = vi.fn();
      this.stop = vi.fn();
      this.dispose = vi.fn();
    });
    return { TerminalInitializationWatchdog: MockWatchdog };
  }
);

import {
  WatchdogCoordinator,
  IWatchdogCoordinatorDependencies,
} from '../../../../../providers/services/WatchdogCoordinator';

const ackOptions = { timeout: 5000, maxAttempts: 3 };
const promptOptions = { timeout: 10000, maxAttempts: 2 };

function createMockDeps(): IWatchdogCoordinatorDependencies {
  return {
    getTerminal: vi.fn().mockReturnValue({ ptyProcess: {}, name: 'Test' }),
    initializeShellForTerminal: vi.fn(),
    telemetryService: {
      trackPerformance: vi.fn(),
    },
  };
}

describe('WatchdogCoordinator', () => {
  let coordinator: WatchdogCoordinator;
  let deps: IWatchdogCoordinatorDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    coordinator = new WatchdogCoordinator(deps, ackOptions, promptOptions);
  });

  describe('startForTerminal', () => {
    it('should track the phase for the terminal', () => {
      coordinator.startForTerminal('t1', 'ack', 'test');

      expect(coordinator.getPhase('t1')).toBe('ack');
    });
  });

  describe('stopForTerminal', () => {
    it('should clear the phase', () => {
      coordinator.startForTerminal('t1', 'ack', 'test');
      coordinator.stopForTerminal('t1', 'done');

      expect(coordinator.getPhase('t1')).toBeUndefined();
    });
  });

  describe('pending terminals', () => {
    it('should queue and start pending terminals', () => {
      coordinator.addPendingTerminal('t1');
      coordinator.addPendingTerminal('t2');

      // Should not start when not initialized
      coordinator.startPendingWatchdogs(false);
      expect(coordinator.getPhase('t1')).toBeUndefined();

      // Should start when initialized
      coordinator.startPendingWatchdogs(true);
      expect(coordinator.getPhase('t1')).toBe('ack');
      expect(coordinator.getPhase('t2')).toBe('ack');
    });
  });

  describe('safe mode', () => {
    it('should track safe mode state', () => {
      expect(coordinator.isInSafeMode('t1')).toBe(false);
    });

    it('should clear safe mode', () => {
      coordinator.clearSafeMode('t1');
      expect(coordinator.isInSafeMode('t1')).toBe(false);
    });
  });

  describe('initialization metrics', () => {
    it('should record init start and mark success', () => {
      coordinator.recordInitStart('t1');
      coordinator.markInitSuccess('t1');

      expect(deps.telemetryService?.trackPerformance).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'terminal.init',
          success: true,
        })
      );
    });
  });

  describe('dispose', () => {
    it('should clean up all state', () => {
      coordinator.addPendingTerminal('t1');
      coordinator.startForTerminal('t2', 'ack', 'test');
      coordinator.recordInitStart('t3');

      coordinator.dispose();

      expect(coordinator.getPhase('t2')).toBeUndefined();
      expect(coordinator.isInSafeMode('t1')).toBe(false);
    });
  });
});
