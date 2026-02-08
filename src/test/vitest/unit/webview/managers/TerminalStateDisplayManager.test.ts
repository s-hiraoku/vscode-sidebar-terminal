/**
 * TerminalStateDisplayManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalStateDisplayManager } from '../../../../../webview/managers/TerminalStateDisplayManager';
import { 
  IUIManager, 
  INotificationManager, 
  ITerminalTabManager, 
  ITerminalContainerManager 
} from '../../../../../webview/interfaces/ManagerInterfaces';
import { TerminalState } from '../../../../../types/shared';

// Mock generic logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('TerminalStateDisplayManager', () => {
  let manager: TerminalStateDisplayManager;
  let mockUIManager: IUIManager;
  let mockNotificationManager: INotificationManager;
  let mockTabManager: ITerminalTabManager;
  let mockContainerManager: ITerminalContainerManager;
  let dom: JSDOM;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <body>
        <div data-terminal-count></div>
        <div data-available-slots></div>
        <div data-terminal-status></div>
        <button data-action="create-terminal"></button>
        <div class="terminal-container" data-terminal-id="t1"></div>
        <div class="terminal-container" data-terminal-id="t2"></div>
      </body>
    `);
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.HTMLButtonElement = dom.window.HTMLButtonElement;

    mockUIManager = {
      updateSplitTerminalBorders: vi.fn(),
    } as any;

    mockNotificationManager = {
      showWarning: vi.fn(),
      clearWarnings: vi.fn(),
    } as any;

    mockTabManager = {
      hasPendingDeletion: vi.fn().mockReturnValue(false),
      getPendingDeletions: vi.fn().mockReturnValue(new Set()),
      syncTabs: vi.fn(),
    } as any;

    mockContainerManager = {
      reorderContainers: vi.fn(),
    } as any;

    manager = new TerminalStateDisplayManager(
      mockUIManager,
      mockNotificationManager,
      mockTabManager,
      mockContainerManager
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('State Updates', () => {
    const mockState: TerminalState = {
      terminals: [
        { id: 't1', name: 'Terminal 1', isActive: true },
        { id: 't2', name: 'Terminal 2', isActive: false }
      ],
      activeTerminalId: 't1',
      maxTerminals: 5,
      availableSlots: [3, 4, 5],
      config: {} as any
    };

    it('should update all UI elements from state', () => {
      manager.updateFromState(mockState);

      expect(mockContainerManager.reorderContainers).toHaveBeenCalledWith(['t1', 't2']);
      expect(mockTabManager.syncTabs).toHaveBeenCalled();
      expect(mockUIManager.updateSplitTerminalBorders).toHaveBeenCalledWith('t1');
      
      const countEl = document.querySelector('[data-terminal-count]');
      expect(countEl?.textContent).toBe('2/5');

      const slotsEl = document.querySelector('[data-available-slots]');
      expect(slotsEl?.textContent).toContain('Available: 3, 4, 5');
    });

    it('should highlight active terminal', () => {
      manager.updateFromState(mockState);

      const activeContainer = document.querySelector('[data-terminal-id="t1"]');
      expect(activeContainer?.classList.contains('active')).toBe(true);

      const inactiveContainer = document.querySelector('[data-terminal-id="t2"]');
      expect(inactiveContainer?.classList.contains('active')).toBe(false);
    });

    it('should handle errors gracefully', () => {
      // Force error by passing null state
      manager.updateFromState(null as any);
      // Should not throw, logs error internally
    });
  });

  describe('Creation State', () => {
    it('should enable creation button when slots available', () => {
      const state: TerminalState = {
        terminals: [],
        activeTerminalId: null,
        maxTerminals: 5,
        availableSlots: [1],
        config: {} as any
      };

      manager.updateCreationState(state);

      const button = document.querySelector('[data-action="create-terminal"]') as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      expect(button.title).toBe('Create new terminal');
      
      expect(mockNotificationManager.clearWarnings).toHaveBeenCalled();
    });

    it('should disable creation button when no slots available', () => {
      const state: TerminalState = {
        terminals: [{} as any],
        activeTerminalId: null,
        maxTerminals: 1,
        availableSlots: [],
        config: {} as any
      };

      manager.updateCreationState(state);

      const button = document.querySelector('[data-action="create-terminal"]') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.title).toBe('Maximum terminals reached');
      
      expect(mockNotificationManager.showWarning).toHaveBeenCalled();
      
      const statusEl = document.querySelector('[data-terminal-status]');
      expect(statusEl?.textContent).toContain('Terminal limit reached');
      expect(statusEl?.className).toContain('warning');
    });
  });

  describe('Tab Syncing', () => {
    it('should filter pending deletions during sync', () => {
      const state: TerminalState = {
        terminals: [
          { id: 't1', name: 'T1', isActive: true },
          { id: 't2', name: 'T2', isActive: false }
        ],
        activeTerminalId: 't1',
        maxTerminals: 5,
        availableSlots: [],
        config: {} as any
      };

      (mockTabManager.hasPendingDeletion as any).mockImplementation((id: string) => id === 't2');
      (mockTabManager.getPendingDeletions as any).mockReturnValue(new Set(['t2']));

      manager.updateFromState(state);

      expect(mockTabManager.syncTabs).toHaveBeenCalledWith([
        expect.objectContaining({ id: 't1' })
      ]);
      // t2 should be filtered out
      expect(mockTabManager.syncTabs).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 't2' })])
      );
    });
  });

  describe('Header Metadata Sync', () => {
    it('should sync terminal name to header during state update', () => {
      (mockUIManager as any).updateTerminalHeader = vi.fn();

      const state: TerminalState = {
        terminals: [
          { id: 't1', name: 'My Custom Name', isActive: true },
          { id: 't2', name: 'Terminal 2', isActive: false },
        ],
        activeTerminalId: 't1',
        maxTerminals: 5,
        availableSlots: [3, 4, 5],
        config: {} as any,
      };

      manager.updateFromState(state);

      expect((mockUIManager as any).updateTerminalHeader).toHaveBeenCalledWith(
        't1', 'My Custom Name', undefined
      );
      expect((mockUIManager as any).updateTerminalHeader).toHaveBeenCalledWith(
        't2', 'Terminal 2', undefined
      );
    });

    it('should sync both name and indicatorColor to header', () => {
      (mockUIManager as any).updateTerminalHeader = vi.fn();

      const state: TerminalState = {
        terminals: [
          { id: 't1', name: 'My Terminal', isActive: true, indicatorColor: '#FF0000' },
        ],
        activeTerminalId: 't1',
        maxTerminals: 5,
        availableSlots: [3, 4, 5],
        config: {} as any,
      };

      manager.updateFromState(state);

      expect((mockUIManager as any).updateTerminalHeader).toHaveBeenCalledWith(
        't1', 'My Terminal', '#FF0000'
      );
    });

    it('should sync name without indicatorColor when color is not set', () => {
      (mockUIManager as any).updateTerminalHeader = vi.fn();

      const state: TerminalState = {
        terminals: [
          { id: 't1', name: 'Renamed Terminal', isActive: true },
        ],
        activeTerminalId: 't1',
        maxTerminals: 5,
        availableSlots: [],
        config: {} as any,
      };

      manager.updateFromState(state);

      expect((mockUIManager as any).updateTerminalHeader).toHaveBeenCalledWith(
        't1', 'Renamed Terminal', undefined
      );
    });
  });

  describe('Optional Managers', () => {
    it('should handle missing managers gracefully', () => {
      const minimalManager = new TerminalStateDisplayManager(
        mockUIManager,
        mockNotificationManager,
        null, // No tab manager
        null  // No container manager
      );

      const state: TerminalState = {
        terminals: [{ id: 't1', name: 'T1', isActive: true }],
        activeTerminalId: 't1',
        maxTerminals: 5,
        availableSlots: [],
        config: {} as any
      };

      // Should not throw
      minimalManager.updateFromState(state);
    });
  });
});
