/**
 * DebugCoordinator Tests
 *
 * Tests for Debug/Diagnostics methods extracted from LightweightTerminalWebviewManager.
 * Covers: updateDebugDisplay, toggleDebugPanel, exportSystemDiagnostics, getManagerStats
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DebugCoordinator,
  IDebugCoordinatorDependencies,
} from '../../../../../webview/coordinators/DebugCoordinator';

function createMockDeps(): IDebugCoordinatorDependencies {
  return {
    debugPanelManager: {
      updateDisplay: vi.fn(),
      toggle: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
      exportDiagnostics: vi.fn().mockReturnValue({ status: 'ok' }),
      dispose: vi.fn(),
    },
    getSystemStatus: vi.fn().mockReturnValue({
      ready: true,
      state: null,
      pendingOperations: { deletions: [], creations: 0 },
    }),
    requestLatestState: vi.fn(),
    getTerminalStats: vi.fn().mockReturnValue({
      totalTerminals: 2,
      activeTerminalId: 'terminal-1',
      terminalIds: ['terminal-1', 'terminal-2'],
    }),
    getAgentStats: vi.fn().mockReturnValue({ connected: 1 }),
    getEventStats: vi.fn().mockReturnValue({ handlers: 5 }),
    getApiDiagnostics: vi.fn().mockReturnValue({ messages: 10 }),
    showWarning: vi.fn(),
    notificationManager: {
      showWarning: vi.fn(),
    },
  };
}

describe('DebugCoordinator', () => {
  let coordinator: DebugCoordinator;
  let deps: IDebugCoordinatorDependencies;

  beforeEach(() => {
    deps = createMockDeps();
    coordinator = new DebugCoordinator(deps);
  });

  describe('updateDebugDisplay', () => {
    it('should delegate to debugPanelManager.updateDisplay', () => {
      const state = {
        terminals: [],
        activeTerminalId: null,
        maxTerminals: 5,
        availableSlots: [1, 2, 3, 4, 5],
      };

      coordinator.updateDebugDisplay(state, 'test-operation');

      expect(deps.debugPanelManager.updateDisplay).toHaveBeenCalledWith(state, 'test-operation');
    });

    it('should pass operation name for logging', () => {
      const state = {
        terminals: [],
        activeTerminalId: null,
        maxTerminals: 5,
        availableSlots: [],
      };

      coordinator.updateDebugDisplay(state, 'state-update');

      expect(deps.debugPanelManager.updateDisplay).toHaveBeenCalledWith(state, 'state-update');
    });
  });

  describe('toggleDebugPanel', () => {
    it('should delegate to debugPanelManager.toggle', () => {
      const state = {
        terminals: [],
        activeTerminalId: null,
        maxTerminals: 5,
        availableSlots: [],
      };

      coordinator.toggleDebugPanel(state);

      expect(deps.debugPanelManager.toggle).toHaveBeenCalledWith(state);
    });

    it('should request latest state if panel becomes active and no state provided', () => {
      vi.mocked(deps.debugPanelManager.isActive).mockReturnValue(true);

      coordinator.toggleDebugPanel(undefined);

      expect(deps.requestLatestState).toHaveBeenCalled();
    });

    it('should not request state if panel is not active', () => {
      vi.mocked(deps.debugPanelManager.isActive).mockReturnValue(false);

      coordinator.toggleDebugPanel(undefined);

      expect(deps.requestLatestState).not.toHaveBeenCalled();
    });
  });

  describe('exportSystemDiagnostics', () => {
    it('should export diagnostics with system status', () => {
      coordinator.exportSystemDiagnostics(5);

      expect(deps.debugPanelManager.exportDiagnostics).toHaveBeenCalledWith(
        deps.getSystemStatus(),
        5
      );
    });
  });

  describe('getManagerStats', () => {
    it('should aggregate stats from all sources', () => {
      const stats = coordinator.getManagerStats();

      expect(stats).toEqual({
        terminals: deps.getTerminalStats(),
        cliAgents: deps.getAgentStats(),
        events: deps.getEventStats(),
        api: deps.getApiDiagnostics(),
      });
    });
  });

  describe('showTerminalLimitMessage', () => {
    it('should show warning via notification manager', () => {
      coordinator.showTerminalLimitMessage(5, 5);

      expect(deps.showWarning).toHaveBeenCalled();
    });
  });
});
