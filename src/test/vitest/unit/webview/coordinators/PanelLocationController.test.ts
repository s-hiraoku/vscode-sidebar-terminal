/**
 * PanelLocationController Tests
 *
 * Tests for panel location methods extracted from LightweightTerminalWebviewManager.
 * Covers: getCurrentPanelLocation, updatePanelLocationIfNeeded, getCurrentFlexDirection,
 *         setupPanelLocationSync (event listener and initial sync)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PanelLocationController,
  IPanelLocationControllerDependencies,
} from '../../../../../webview/coordinators/PanelLocationController';

function createMockDeps(): IPanelLocationControllerDependencies {
  return {
    messageManagerUpdatePanelLocationIfNeeded: vi.fn().mockReturnValue(false),
    messageManagerGetCurrentPanelLocation: vi.fn().mockReturnValue(null),
    messageManagerGetCurrentFlexDirection: vi.fn().mockReturnValue(null),
    splitManagerSetPanelLocation: vi.fn(),
    splitManagerUpdateSplitDirection: vi.fn(),
    splitManagerGetTerminalCount: vi.fn().mockReturnValue(0),
    displayModeManagerGetCurrentMode: vi.fn().mockReturnValue('normal'),
    displayModeManagerShowAllTerminalsSplit: vi.fn(),
  };
}

describe('PanelLocationController', () => {
  let controller: PanelLocationController;
  let deps: IPanelLocationControllerDependencies;

  beforeEach(() => {
    vi.useFakeTimers();
    deps = createMockDeps();
    // Mock document.getElementById
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
  });

  afterEach(() => {
    if (controller) {
      controller.dispose();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a PanelLocationController instance', () => {
      controller = new PanelLocationController(deps);
      expect(controller).toBeDefined();
    });
  });

  describe('getCurrentPanelLocation', () => {
    it('should delegate to messageManager', () => {
      vi.mocked(deps.messageManagerGetCurrentPanelLocation).mockReturnValue('sidebar');
      controller = new PanelLocationController(deps);

      const result = controller.getCurrentPanelLocation();

      expect(result).toBe('sidebar');
      expect(deps.messageManagerGetCurrentPanelLocation).toHaveBeenCalled();
    });

    it('should return panel when messageManager returns panel', () => {
      vi.mocked(deps.messageManagerGetCurrentPanelLocation).mockReturnValue('panel');
      controller = new PanelLocationController(deps);

      expect(controller.getCurrentPanelLocation()).toBe('panel');
    });

    it('should return null when messageManager returns null', () => {
      vi.mocked(deps.messageManagerGetCurrentPanelLocation).mockReturnValue(null);
      controller = new PanelLocationController(deps);

      expect(controller.getCurrentPanelLocation()).toBeNull();
    });
  });

  describe('updatePanelLocationIfNeeded', () => {
    it('should delegate to messageManager and return result', () => {
      vi.mocked(deps.messageManagerUpdatePanelLocationIfNeeded).mockReturnValue(true);
      controller = new PanelLocationController(deps);

      const result = controller.updatePanelLocationIfNeeded();

      expect(result).toBe(true);
      expect(deps.messageManagerUpdatePanelLocationIfNeeded).toHaveBeenCalled();
    });

    it('should return false when no update needed', () => {
      vi.mocked(deps.messageManagerUpdatePanelLocationIfNeeded).mockReturnValue(false);
      controller = new PanelLocationController(deps);

      expect(controller.updatePanelLocationIfNeeded()).toBe(false);
    });
  });

  describe('getCurrentFlexDirection', () => {
    it('should delegate to messageManager', () => {
      vi.mocked(deps.messageManagerGetCurrentFlexDirection).mockReturnValue('row');
      controller = new PanelLocationController(deps);

      const result = controller.getCurrentFlexDirection();

      expect(result).toBe('row');
      expect(deps.messageManagerGetCurrentFlexDirection).toHaveBeenCalled();
    });

    it('should return column when messageManager returns column', () => {
      vi.mocked(deps.messageManagerGetCurrentFlexDirection).mockReturnValue('column');
      controller = new PanelLocationController(deps);

      expect(controller.getCurrentFlexDirection()).toBe('column');
    });

    it('should return null when messageManager returns null', () => {
      vi.mocked(deps.messageManagerGetCurrentFlexDirection).mockReturnValue(null);
      controller = new PanelLocationController(deps);

      expect(controller.getCurrentFlexDirection()).toBeNull();
    });
  });

  describe('setupPanelLocationSync (event handling)', () => {
    it('should handle panel location changed event with sidebar location', () => {
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'sidebar' },
        })
      );

      expect(deps.splitManagerSetPanelLocation).toHaveBeenCalledWith('sidebar');
    });

    it('should handle panel location changed event with panel location', () => {
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'panel' },
        })
      );

      expect(deps.splitManagerSetPanelLocation).toHaveBeenCalledWith('panel');
    });

    it('should ignore events with invalid location', () => {
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'invalid' },
        })
      );

      expect(deps.splitManagerSetPanelLocation).not.toHaveBeenCalled();
    });

    it('should ignore events with no location', () => {
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: {},
        })
      );

      expect(deps.splitManagerSetPanelLocation).not.toHaveBeenCalled();
    });

    it('should show all terminals split when panel with multiple terminals and not fullscreen', () => {
      vi.mocked(deps.splitManagerGetTerminalCount).mockReturnValue(3);
      vi.mocked(deps.displayModeManagerGetCurrentMode).mockReturnValue('split');
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'panel' },
        })
      );

      expect(deps.displayModeManagerShowAllTerminalsSplit).toHaveBeenCalled();
    });

    it('should not show all terminals split when panel with fullscreen mode', () => {
      vi.mocked(deps.splitManagerGetTerminalCount).mockReturnValue(3);
      vi.mocked(deps.displayModeManagerGetCurrentMode).mockReturnValue('fullscreen');
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'panel' },
        })
      );

      expect(deps.displayModeManagerShowAllTerminalsSplit).not.toHaveBeenCalled();
    });

    it('should show all terminals split when sidebar in split mode', () => {
      vi.mocked(deps.splitManagerGetTerminalCount).mockReturnValue(2);
      vi.mocked(deps.displayModeManagerGetCurrentMode).mockReturnValue('split');
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'sidebar' },
        })
      );

      expect(deps.displayModeManagerShowAllTerminalsSplit).toHaveBeenCalled();
    });

    it('should update split direction when no special conditions met', () => {
      vi.mocked(deps.splitManagerGetTerminalCount).mockReturnValue(1);
      vi.mocked(deps.displayModeManagerGetCurrentMode).mockReturnValue('normal');
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'panel' },
        })
      );

      expect(deps.splitManagerUpdateSplitDirection).toHaveBeenCalledWith('horizontal', 'panel');
    });

    it('should update split direction to vertical for sidebar', () => {
      vi.mocked(deps.splitManagerGetTerminalCount).mockReturnValue(1);
      vi.mocked(deps.displayModeManagerGetCurrentMode).mockReturnValue('normal');
      controller = new PanelLocationController(deps);

      window.dispatchEvent(
        new CustomEvent('terminal-panel-location-changed', {
          detail: { location: 'sidebar' },
        })
      );

      expect(deps.splitManagerUpdateSplitDirection).toHaveBeenCalledWith('vertical', 'sidebar');
    });
  });

  describe('initial sync (setTimeout)', () => {
    it('should sync panel location from DOM after 250ms', () => {
      const mockElement = document.createElement('div');
      mockElement.classList.add('terminal-split-horizontal');
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

      controller = new PanelLocationController(deps);
      vi.advanceTimersByTime(250);

      expect(deps.splitManagerSetPanelLocation).toHaveBeenCalledWith('panel');
    });

    it('should detect sidebar from DOM when no horizontal class', () => {
      const mockElement = document.createElement('div');
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);

      controller = new PanelLocationController(deps);
      vi.advanceTimersByTime(250);

      expect(deps.splitManagerSetPanelLocation).toHaveBeenCalledWith('sidebar');
    });

    it('should not crash when terminals-wrapper not found', () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null);

      controller = new PanelLocationController(deps);

      expect(() => vi.advanceTimersByTime(250)).not.toThrow();
      expect(deps.splitManagerSetPanelLocation).not.toHaveBeenCalled();
    });

    it('should show all terminals split when panel with multiple terminals', () => {
      const mockElement = document.createElement('div');
      mockElement.classList.add('terminal-split-horizontal');
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement);
      vi.mocked(deps.splitManagerGetTerminalCount).mockReturnValue(2);
      vi.mocked(deps.displayModeManagerGetCurrentMode).mockReturnValue('normal');

      controller = new PanelLocationController(deps);
      vi.advanceTimersByTime(250);

      expect(deps.displayModeManagerShowAllTerminalsSplit).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should remove event listener on dispose', () => {
      controller = new PanelLocationController(deps);
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      controller.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'terminal-panel-location-changed',
        expect.any(Function)
      );
    });
  });
});
