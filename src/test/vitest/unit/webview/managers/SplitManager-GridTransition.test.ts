/**
 * SplitManager Grid Transition Tests
 *
 * Tests for layout mode detection and grid/flex transitions
 * when terminal count crosses the grid threshold (6).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SplitManager } from '../../../../../webview/managers/SplitManager';
import type { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

// Mock dependencies
vi.mock('../../../../../webview/utils/ManagerLogger');
vi.mock('../../../../../webview/utils/NotificationUtils');

function createMockCoordinator(): IManagerCoordinator {
  return {
    getActiveTerminalId: vi.fn().mockReturnValue(null),
    getTerminalContainerManager: vi.fn().mockReturnValue({
      getContainerOrder: vi.fn().mockReturnValue([]),
      applyDisplayState: vi.fn(),
      clearSplitArtifacts: vi.fn(),
    }),
    getManagers: vi.fn().mockReturnValue({ tabs: null }),
    refitAllTerminals: vi.fn(),
  } as unknown as IManagerCoordinator;
}

function createMockTerminal(): { terminal: Terminal; fitAddon: FitAddon } {
  return {
    terminal: {
      dispose: vi.fn(),
      refresh: vi.fn(),
      rows: 24,
    } as unknown as Terminal,
    fitAddon: {
      fit: vi.fn(),
    } as unknown as FitAddon,
  };
}

describe('SplitManager - Grid Transition', () => {
  let splitManager: SplitManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '<div id="terminal-body"></div>';
    mockCoordinator = createMockCoordinator();
    splitManager = new SplitManager(mockCoordinator);
    splitManager.initialize();
  });

  afterEach(() => {
    splitManager.dispose();
    document.body.innerHTML = '';
  });

  describe('getLayoutMode', () => {
    it('should return single-row when not in split mode', () => {
      expect(splitManager.getLayoutMode()).toBe('single-row');
    });

    it('should return single-row for 5 terminals in panel split mode', () => {
      splitManager.isSplitMode = true;
      splitManager.setPanelLocation('panel');

      for (let i = 1; i <= 5; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
      }

      expect(splitManager.getLayoutMode()).toBe('single-row');
    });

    it('should return grid-2-row for 6 terminals in panel split mode', () => {
      splitManager.isSplitMode = true;
      splitManager.setPanelLocation('panel');

      for (let i = 1; i <= 6; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
      }

      expect(splitManager.getLayoutMode()).toBe('grid-2-row');
    });

    it('should return grid-2-row for 10 terminals in panel split mode', () => {
      splitManager.isSplitMode = true;
      splitManager.setPanelLocation('panel');

      for (let i = 1; i <= 10; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
      }

      expect(splitManager.getLayoutMode()).toBe('grid-2-row');
    });

    it('should return single-row for 6 terminals in sidebar split mode', () => {
      splitManager.isSplitMode = true;
      splitManager.setPanelLocation('sidebar');

      for (let i = 1; i <= 6; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
      }

      expect(splitManager.getLayoutMode()).toBe('single-row');
    });

    it('should return single-row for 6 terminals not in split mode', () => {
      splitManager.isSplitMode = false;
      splitManager.setPanelLocation('panel');

      for (let i = 1; i <= 6; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
      }

      expect(splitManager.getLayoutMode()).toBe('single-row');
    });
  });

  describe('5→6 transition', () => {
    it('should transition from single-row to grid-2-row when adding 6th terminal', () => {
      splitManager.isSplitMode = true;
      splitManager.setPanelLocation('panel');

      for (let i = 1; i <= 5; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
      }
      expect(splitManager.getLayoutMode()).toBe('single-row');

      // Add 6th terminal
      const { terminal, fitAddon } = createMockTerminal();
      splitManager.setTerminal('t6', { terminal, fitAddon, id: 't6' });
      expect(splitManager.getLayoutMode()).toBe('grid-2-row');
    });
  });

  describe('6→5 transition', () => {
    it('should transition from grid-2-row to single-row when removing to 5 terminals', () => {
      splitManager.isSplitMode = true;
      splitManager.setPanelLocation('panel');

      for (let i = 1; i <= 6; i++) {
        const { terminal, fitAddon } = createMockTerminal();
        splitManager.setTerminal(`t${i}`, { terminal, fitAddon, id: `t${i}` });
        splitManager.setTerminalContainer(`t${i}`, document.createElement('div'));
      }
      expect(splitManager.getLayoutMode()).toBe('grid-2-row');

      // Remove 6th terminal (which also removes from terminals map)
      splitManager.removeTerminal('t6');

      // After removal, should be back to single-row
      expect(splitManager.getLayoutMode()).toBe('single-row');
    });
  });
});
