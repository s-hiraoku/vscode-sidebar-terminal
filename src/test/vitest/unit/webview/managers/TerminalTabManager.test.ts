/**
 * TerminalTabManager Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalTabManager } from '../../../../../webview/managers/TerminalTabManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

// Mock dependencies
vi.mock('../../../../../webview/components/TerminalTabList', () => ({
  TerminalTabList: class {
    constructor(_container: any, _events: any) {}
    setModeIndicator = vi.fn();
    updateTab = vi.fn();
    addTab = vi.fn();
    removeTab = vi.fn();
    setActiveTab = vi.fn();
    reorderTabs = vi.fn();
    updateTheme = vi.fn();
    dispose = vi.fn();
  }
}));

vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

vi.mock('../../../../../utils/arrayUtils', () => ({
  arraysEqual: (a: any[], b: any[]) => JSON.stringify(a) === JSON.stringify(b),
}));

describe('TerminalTabManager', () => {
  let manager: TerminalTabManager;
  let mockCoordinator: IManagerCoordinator;
  let dom: JSDOM;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = new JSDOM('<!DOCTYPE html><div id="terminal-body"></div>');
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;

    mockCoordinator = {
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
    } as any;

    manager = new TerminalTabManager();
    manager.setCoordinator(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize and create tab container', () => {
      manager.initialize();
      const container = document.getElementById('terminal-tabs-container');
      expect(container).toBeDefined();
      expect(container?.classList.contains('terminal-tabs-root')).toBe(true);
    });

    it('should reuse existing container if marked', () => {
      const existing = document.createElement('div');
      existing.id = 'terminal-tabs-container';
      existing.setAttribute('data-tab-manager-initialized', 'true');
      document.getElementById('terminal-body')?.appendChild(existing);

      manager.initialize();
      expect(document.getElementById('terminal-tabs-container')).toBe(existing);
    });
  });

  describe('Tab Management', () => {
    it('should add a tab', () => {
      manager.addTab('t1', 'Term 1');
      expect(manager.getTabCount()).toBe(1);
      expect(manager.getAllTabs()[0].id).toBe('t1');
    });

    it('should update existing tab on add', () => {
      manager.addTab('t1', 'Term 1');
      manager.addTab('t1', 'Updated Name');
      
      expect(manager.getTabCount()).toBe(1);
      expect(manager.getAllTabs()[0].name).toBe('Updated Name');
    });

    it('should remove a tab', () => {
      manager.addTab('t1', 'Term 1');
      manager.removeTab('t1');
      
      expect(manager.getTabCount()).toBe(0);
    });

    it('should prevent removing last tab via close event', () => {
      manager.addTab('t1', 'Term 1');
      
      manager.onTabClose('t1');
      
      // Should show warning and NOT call remove/close logic
      const notifManager = mockCoordinator.getManagers().notification;
      expect(notifManager!.showWarning).toHaveBeenCalled();
      expect(mockCoordinator.closeTerminal).not.toHaveBeenCalled();
    });

    it('should activate tab', () => {
      manager.addTab('t1', 'Term 1');
      manager.addTab('t2', 'Term 2');
      
      manager.setActiveTab('t2');
      
      expect(manager.getActiveTabId()).toBe('t2');
    });
  });

  describe('Tab Events', () => {
    it('should handle tab click', () => {
      manager.addTab('t1', 'Term 1');
      manager.onTabClick('t1');
      
      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('t1');
    });

    it('should handle tab rename', () => {
      manager.addTab('t1', 'Old Name');
      manager.onTabRename('t1', 'New Name');
      
      expect(manager.getAllTabs()[0].name).toBe('New Name');
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'renameTerminal',
        newName: 'New Name'
      }));
    });

    it('should handle tab reorder', () => {
      manager.addTab('t1', '1');
      manager.addTab('t2', '2');
      
      manager.onTabReorder(0, 1, ['t2', 't1']);
      
      expect(manager.getAllTabs()[0].id).toBe('t2');
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'reorderTerminals',
        order: ['t2', 't1']
      }));
    });

    it('should handle new tab request', () => {
      manager.onNewTab();
      expect(mockCoordinator.createTerminal).toHaveBeenCalled();
    });
  });

  describe('Sync Tabs', () => {
    it('should sync tabs from extension state', () => {
      const tabs = [
        { id: 't1', name: 'Sync 1', isActive: true },
        { id: 't2', name: 'Sync 2', isActive: false }
      ];
      
      manager.syncTabs(tabs);
      
      expect(manager.getTabCount()).toBe(2);
      expect(manager.getActiveTabId()).toBe('t1');
    });

    it('should remove tabs not in sync state', () => {
      manager.addTab('old', 'Old');
      
      const tabs = [{ id: 'new', name: 'New', isActive: true }];
      manager.syncTabs(tabs);
      
      expect(manager.getTabCount()).toBe(1);
      expect(manager.getAllTabs()[0].id).toBe('new');
    });
  });
});
