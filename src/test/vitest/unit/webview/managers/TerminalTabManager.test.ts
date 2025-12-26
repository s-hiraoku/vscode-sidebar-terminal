import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalTabManager } from '../../../../../webview/managers/TerminalTabManager';

describe('TerminalTabManager', () => {
  let dom: JSDOM;
  let manager: TerminalTabManager;
  let mockCoordinator: any;

  beforeEach(() => {
    // Setup DOM
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="terminal-body"></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '0px' }));

    vi.useFakeTimers();

    // Mock coordinator
    mockCoordinator = {
      setActiveTerminalId: vi.fn(),
      createTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      deleteTerminalSafely: vi.fn(),
      postMessageToExtension: vi.fn(),
      getDisplayModeManager: vi.fn().mockReturnValue({
        getCurrentMode: vi.fn().mockReturnValue('normal'),
        setDisplayMode: vi.fn(),
        toggleSplitMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
        showAllTerminalsSplit: vi.fn()
      }),
      getManagers: vi.fn().mockReturnValue({
        terminalContainer: { reorderContainers: vi.fn() },
        notification: { showWarning: vi.fn() }
      })
    };

    manager = new TerminalTabManager();
    manager.setCoordinator(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('Initialization', () => {
    it('should create tab container in DOM on initialization', () => {
      manager.initialize();
      const container = document.getElementById('terminal-tabs-container');
      expect(container).not.toBeNull();
      expect(container?.parentNode?.id).toBe('terminal-body');
    });
  });

  describe('Tab Operations', () => {
    beforeEach(() => {
      manager.initialize();
    });

    it('should add tabs and update count', () => {
      manager.addTab('t1', 'Term 1');
      manager.addTab('t2', 'Term 2');
      expect(manager.getTabCount()).toBe(2);
    });

    it('should set active tab', () => {
      manager.addTab('t1', 'Term 1');
      manager.addTab('t2', 'Term 2');
      
      manager.setActiveTab('t2');
      expect(manager.getActiveTabId()).toBe('t2');
      expect(manager.getActiveTab()?.name).toBe('Term 2');
    });

    it('should remove tab and activate next available one', () => {
      manager.addTab('t1', 'Term 1');
      manager.addTab('t2', 'Term 2');
      manager.setActiveTab('t1');
      
      manager.removeTab('t1');
      
      expect(manager.getTabCount()).toBe(1);
      expect(manager.getActiveTabId()).toBe('t2');
      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('t2');
    });

    it('should prevent closing the last tab via UI event', () => {
      manager.addTab('t1', 'Term 1');
      
      manager.onTabClose('t1');
      
      expect(manager.getTabCount()).toBe(1);
      expect(mockCoordinator.getManagers().notification.showWarning).toHaveBeenCalled();
    });
  });

  describe('Sync and State', () => {
    it('should sync tabs from extension state', () => {
      manager.initialize();
      const tabInfos = [
        { id: 't1', name: 'Synced 1', isActive: false },
        { id: 't2', name: 'Synced 2', isActive: true }
      ];
      
      manager.syncTabs(tabInfos);
      
      expect(manager.getTabCount()).toBe(2);
      expect(manager.getActiveTabId()).toBe('t2');
      expect(manager.getAllTabs()[0].name).toBe('Synced 1');
    });

    it('should preserve tab order after sync', () => {
      manager.initialize();
      manager.addTab('t1', 'T1');
      manager.addTab('t2', 'T2');
      
      // Reverse order via sync
      manager.syncTabs([
        { id: 't2', name: 'T2', isActive: false },
        { id: 't1', name: 'T1', isActive: true }
      ]);
      
      const tabs = manager.getAllTabs();
      expect(tabs[0].id).toBe('t2');
      expect(tabs[1].id).toBe('t1');
    });
  });

  describe('User Interaction', () => {
    it('should handle new tab request', () => {
      manager.onNewTab();
      expect(mockCoordinator.createTerminal).toHaveBeenCalled();
    });

    it('should handle tab reorder', () => {
      manager.initialize();
      manager.addTab('t1', 'T1');
      manager.addTab('t2', 'T2');
      
      manager.onTabReorder(0, 1, ['t2', 't1']);
      
      expect(manager.getAllTabs()[0].id).toBe('t2');
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'reorderTerminals',
        order: ['t2', 't1']
      }));
    });

    it('should handle tab rename', () => {
      manager.initialize();
      manager.addTab('t1', 'Old Name');
      
      manager.onTabRename('t1', 'New Name');
      
      expect(manager.getAllTabs()[0].name).toBe('New Name');
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'renameTerminal',
        newName: 'New Name'
      }));
    });

    it('should handle mode toggle', () => {
      manager.initialize();
      manager.addTab('t1', 'T1');
      manager.addTab('t2', 'T2');
      manager.setActiveTab('t1');
      
      manager.onModeToggle();
      
      const displayManager = mockCoordinator.getDisplayModeManager();
      expect(displayManager.showTerminalFullscreen).toHaveBeenCalledWith('t1');
    });

    it('should update theme', () => {
      manager.initialize();
      const theme = { background: '#000', foreground: '#fff', cursor: '#fff' };
      
      // Should not throw and should propagate to tabList
      expect(() => manager.updateTheme(theme)).not.toThrow();
    });
  });
});