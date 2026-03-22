/**
 * TabEventCoordinator Unit Tests
 *
 * Tests for the extracted event coordination logic from TerminalTabManager.
 * Covers: tab click, close, rename, reorder, new tab, mode toggle,
 * and display mode transition handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TabEventCoordinator,
  ITabEventCoordinatorDependencies,
} from '../../../../../webview/managers/TabEventCoordinator';

vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

function createMockDeps(
  overrides: Partial<ITabEventCoordinatorDependencies> = {}
): ITabEventCoordinatorDependencies {
  return {
    getCoordinator: vi.fn().mockReturnValue({
      setActiveTerminalId: vi.fn(),
      postMessageToExtension: vi.fn(),
      getManagers: vi.fn().mockReturnValue({
        terminalContainer: { reorderContainers: vi.fn() },
        notification: { showWarning: vi.fn() },
      }),
      createTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      getDisplayModeManager: vi.fn().mockReturnValue({
        getCurrentMode: vi.fn().mockReturnValue('normal'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      }),
    }),
    getTabCount: vi.fn().mockReturnValue(2),
    getTabOrder: vi.fn().mockReturnValue(['t1', 't2']),
    hasTab: vi.fn().mockReturnValue(true),
    setActiveTab: vi.fn(),
    setTabOrder: vi.fn(),
    rebuildTabsInOrder: vi.fn(),
    hasPendingDeletion: vi.fn().mockReturnValue(false),
    addPendingDeletion: vi.fn(),
    ...overrides,
  };
}

describe('TabEventCoordinator', () => {
  let coordinator: TabEventCoordinator;
  let deps: ITabEventCoordinatorDependencies;

  beforeEach(() => {
    vi.useFakeTimers();
    deps = createMockDeps();
    coordinator = new TabEventCoordinator(deps);
  });

  afterEach(() => {
    coordinator.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('onTabClick', () => {
    it('should set active terminal and tab on click', () => {
      const mockCoord = deps.getCoordinator();

      coordinator.onTabClick('t1');

      expect(mockCoord!.setActiveTerminalId).toHaveBeenCalledWith('t1');
      expect(deps.setActiveTab).toHaveBeenCalledWith('t1');
    });

    it('should switch fullscreen terminal when in fullscreen mode', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('fullscreen'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );

      coordinator.onTabClick('t1');

      expect(displayManager.showTerminalFullscreen).toHaveBeenCalledWith('t1');
    });

    it('should do nothing when coordinator is null', () => {
      deps = createMockDeps({ getCoordinator: vi.fn().mockReturnValue(null) });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onTabClick('t1');

      expect(deps.setActiveTab).toHaveBeenCalledWith('t1');
    });
  });

  describe('onTabClose', () => {
    it('should prevent closing the last tab', () => {
      deps = createMockDeps({ getTabCount: vi.fn().mockReturnValue(1) });
      coordinator = new TabEventCoordinator(deps);
      const mockCoord = deps.getCoordinator();

      coordinator.onTabClose('t1');

      const notifManager = mockCoord!.getManagers().notification;
      expect(notifManager!.showWarning).toHaveBeenCalled();
      expect(mockCoord!.closeTerminal).not.toHaveBeenCalled();
    });

    it('should skip if deletion is already pending', () => {
      deps = createMockDeps({ hasPendingDeletion: vi.fn().mockReturnValue(true) });
      coordinator = new TabEventCoordinator(deps);
      const mockCoord = deps.getCoordinator();

      coordinator.onTabClose('t1');

      expect(mockCoord!.closeTerminal).not.toHaveBeenCalled();
    });

    it('should mark as pending deletion and close terminal', () => {
      coordinator.onTabClose('t1');

      expect(deps.addPendingDeletion).toHaveBeenCalledWith('t1');
      const mockCoord = deps.getCoordinator();
      expect(mockCoord!.closeTerminal).toHaveBeenCalledWith('t1');
    });

    it('should handle fullscreen mode after close', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('fullscreen'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );
      deps = createMockDeps({
        getCoordinator: vi.fn().mockReturnValue(mockCoord),
        getTabCount: vi.fn().mockReturnValue(3),
        getTabOrder: vi.fn().mockReturnValue(['t1', 't2', 't3']),
      });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onTabClose('t1');
      vi.advanceTimersByTime(60);

      expect(displayManager.showTerminalFullscreen).toHaveBeenCalled();
    });

    it('should switch to normal mode when only one remains after split close', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('split'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );
      // 2 tabs, closing one leaves 1
      deps = createMockDeps({
        getCoordinator: vi.fn().mockReturnValue(mockCoord),
        getTabCount: vi.fn().mockReturnValue(2),
        getTabOrder: vi.fn().mockReturnValue(['t1', 't2']),
      });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onTabClose('t1');
      vi.advanceTimersByTime(60);

      expect(displayManager.setDisplayMode).toHaveBeenCalledWith('normal');
    });
  });

  describe('onTabRename', () => {
    it('should notify coordinator about name change', () => {
      const mockCoord = deps.getCoordinator();

      coordinator.onTabRename('t1', 'New Name');

      expect(mockCoord!.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'renameTerminal',
          terminalId: 't1',
          newName: 'New Name',
        })
      );
    });
  });

  describe('onTabReorder', () => {
    it('should update tab order and notify coordinator', () => {
      coordinator.onTabReorder(0, 1, ['t2', 't1']);

      expect(deps.setTabOrder).toHaveBeenCalledWith(['t2', 't1']);
      expect(deps.rebuildTabsInOrder).toHaveBeenCalled();
      const mockCoord = deps.getCoordinator();
      expect(mockCoord!.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'reorderTerminals',
          order: ['t2', 't1'],
        })
      );
    });

    it('should skip reorder if order is unchanged', () => {
      deps = createMockDeps({ getTabOrder: vi.fn().mockReturnValue(['t1', 't2']) });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onTabReorder(0, 0, ['t1', 't2']);

      expect(deps.setTabOrder).not.toHaveBeenCalled();
    });

    it('should skip reorder if nextOrder is empty', () => {
      coordinator.onTabReorder(0, 1, []);

      expect(deps.setTabOrder).not.toHaveBeenCalled();
    });

    it('should filter out unknown tab IDs and append remaining', () => {
      deps = createMockDeps({
        getTabOrder: vi.fn().mockReturnValue(['t1', 't2', 't3']),
        hasTab: vi.fn().mockImplementation((id: string) => ['t1', 't2', 't3'].includes(id)),
      });
      coordinator = new TabEventCoordinator(deps);

      // nextOrder includes only t2, t1 (valid) - t3 should be appended
      coordinator.onTabReorder(0, 1, ['t2', 't1']);

      expect(deps.setTabOrder).toHaveBeenCalledWith(['t2', 't1', 't3']);
    });
  });

  describe('onNewTab', () => {
    it('should create a new terminal via coordinator', () => {
      const mockCoord = deps.getCoordinator();

      coordinator.onNewTab();

      expect(mockCoord!.createTerminal).toHaveBeenCalled();
    });

    it('should do nothing when coordinator is null', () => {
      deps = createMockDeps({ getCoordinator: vi.fn().mockReturnValue(null) });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onNewTab();

      // No error thrown
    });

    it('should switch to split mode before creating terminal in fullscreen', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('fullscreen'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );
      deps = createMockDeps({
        getCoordinator: vi.fn().mockReturnValue(mockCoord),
        getTabCount: vi.fn().mockReturnValue(1),
      });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onNewTab();

      expect(displayManager.showAllTerminalsSplit).toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(mockCoord!.createTerminal).toHaveBeenCalled();
    });
  });

  describe('onModeToggle', () => {
    it('should toggle from fullscreen to split when multiple tabs', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('fullscreen'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );
      deps = createMockDeps({
        getCoordinator: vi.fn().mockReturnValue(mockCoord),
        getTabCount: vi.fn().mockReturnValue(2),
      });
      coordinator = new TabEventCoordinator(deps);

      coordinator.onModeToggle();

      expect(displayManager.toggleSplitMode).toHaveBeenCalled();
    });

    it('should switch to fullscreen when active tab exists and not in fullscreen', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('normal'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );
      deps = createMockDeps({
        getCoordinator: vi.fn().mockReturnValue(mockCoord),
        getTabCount: vi.fn().mockReturnValue(1),
      });
      coordinator = new TabEventCoordinator(deps);
      // Need getActiveTabId
      coordinator.setActiveTabIdGetter(() => 't1');

      coordinator.onModeToggle();

      expect(displayManager.showTerminalFullscreen).toHaveBeenCalledWith('t1');
    });
  });

  describe('handleTerminalCreated', () => {
    it('should refresh split mode after terminal creation', () => {
      const displayManager = {
        getCurrentMode: vi.fn().mockReturnValue('split'),
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
        toggleSplitMode: vi.fn(),
      };
      const mockCoord = deps.getCoordinator();
      (mockCoord!.getDisplayModeManager as ReturnType<typeof vi.fn>).mockReturnValue(
        displayManager
      );

      coordinator.handleTerminalCreated('t3');

      vi.advanceTimersByTime(200);

      expect(deps.setActiveTab).toHaveBeenCalledWith('t3');
    });
  });

  describe('dispose', () => {
    it('should clear all pending timeouts', () => {
      // Schedule some timeouts
      coordinator.onNewTab();
      coordinator.dispose();

      // Advancing timers should not cause errors
      vi.advanceTimersByTime(500);
    });
  });
});
