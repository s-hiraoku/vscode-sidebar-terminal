/**
 * TerminalContainerManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalContainerManager } from '../../../../../webview/managers/TerminalContainerManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

// Mock dependencies
vi.mock('../../../../../webview/managers/container/SplitLayoutService', () => ({
  SplitLayoutService: class {
    cacheWrapper = vi.fn();
    getWrapper = vi.fn();
    removeWrapper = vi.fn();
    getSplitResizers = vi.fn().mockReturnValue(new Set());
    refreshSplitArtifacts = vi.fn();
    activateGridLayout = vi.fn();
    activateSplitLayout = vi.fn();
    getSplitWrapperCache = vi.fn().mockReturnValue(new Map());
    getWrapperArea = vi.fn();
    deactivateGridLayout = vi.fn();
    clear = vi.fn();
    setCoordinator = vi.fn(); // 🔧 FIX: Added for split resizer initialization
  }
}));

vi.mock('../../../../../webview/managers/container/ContainerVisibilityService', () => ({
  ContainerVisibilityService: class {
    showContainer = vi.fn();
    hideContainer = vi.fn();
    enforceFullscreenState = vi.fn();
    normalizeTerminalBody = vi.fn();
    ensureContainerInBody = vi.fn();
    isElementVisible = vi.fn().mockReturnValue(true);
    clearHiddenStorage = vi.fn();
  }
}));

vi.mock('../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    resetXtermInlineStyles: vi.fn(),
  },
}));

vi.mock('../../../../../webview/utils/logger', () => ({
  webview: vi.fn(),
}));

describe('TerminalContainerManager', () => {
  let manager: TerminalContainerManager;
  let mockCoordinator: IManagerCoordinator;
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><div id="terminal-body"></div>', {
      url: 'http://localhost',
    });
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;

    mockCoordinator = {
      updatePanelLocationIfNeeded: vi.fn(),
    } as any;

    manager = new TerminalContainerManager(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Container Registration', () => {
    it('should register and unregister containers', () => {
      const container = document.createElement('div');
      document.body.appendChild(container); // Attach to DOM for document.contains check
      manager.registerContainer('t1', container);
      
      expect(manager.getContainer('t1')).toBe(container);
      expect(manager.getContainerMode('t1')).toBe('normal');
      
      manager.unregisterContainer('t1');
      expect(manager.getContainer('t1')).toBeNull();
    });

    it('should register split wrappers', () => {
      const wrapper = document.createElement('div');
      manager.registerSplitWrapper('t1', wrapper);
      
      expect(wrapper.classList.contains('split-terminal-container')).toBe(true);
      expect(wrapper.getAttribute('data-terminal-wrapper-id')).toBe('t1');
    });
  });

  describe('Visibility Control', () => {
    it('should set container visibility', () => {
      const container = document.createElement('div');
      document.body.appendChild(container); // Attach to DOM
      manager.registerContainer('t1', container);
      
      manager.setContainerVisibility('t1', true);
      // Detailed logic delegated to ContainerVisibilityService, verified via mock
      expect((manager as any).visibilityService.showContainer).toHaveBeenCalledWith(container);
      
      manager.setContainerVisibility('t1', false);
      expect((manager as any).visibilityService.hideContainer).toHaveBeenCalled();
    });

    it('should handle missing container gracefully', () => {
      // Should not throw
      manager.setContainerVisibility('unknown', true);
    });
  });

  describe('Display State Application', () => {
    it('should apply fullscreen mode', () => {
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      manager.registerContainer('t1', c1);
      manager.registerContainer('t2', c2);
      
      manager.applyDisplayState({
        mode: 'fullscreen',
        activeTerminalId: 't1',
        orderedTerminalIds: ['t1', 't2']
      });
      
      expect((manager as any).visibilityService.enforceFullscreenState).toHaveBeenCalled();
      expect(c1.classList.contains('terminal-container--fullscreen')).toBe(true);
      expect(c2.classList.contains('terminal-container--fullscreen')).toBe(false);
    });

    it('should apply split mode', () => {
      const c1 = document.createElement('div');
      manager.registerContainer('t1', c1);
      
      manager.applyDisplayState({
        mode: 'split',
        activeTerminalId: 't1',
        orderedTerminalIds: ['t1'],
        splitDirection: 'vertical'
      });
      
      expect((manager as any).splitLayoutService.activateSplitLayout).toHaveBeenCalled();
      expect(c1.classList.contains('terminal-container--split')).toBe(true);
    });

    it('should use horizontal single-row split in compact panel area even with 6 terminals', () => {
      const terminalBody = document.getElementById('terminal-body') as HTMLElement;
      Object.defineProperty(terminalBody, 'clientWidth', { value: 900, configurable: true });
      Object.defineProperty(terminalBody, 'clientHeight', { value: 800, configurable: true });

      for (let i = 1; i <= 6; i++) {
        const container = document.createElement('div');
        manager.registerContainer(`t${i}`, container);
      }

      manager.applyDisplayState({
        mode: 'split',
        activeTerminalId: 't1',
        orderedTerminalIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
        splitDirection: 'horizontal',
      });

      expect((manager as any).splitLayoutService.activateGridLayout).not.toHaveBeenCalled();
      expect((manager as any).splitLayoutService.activateSplitLayout).toHaveBeenCalledWith(
        terminalBody,
        ['t1', 't2', 't3', 't4', 't5', 't6'],
        'horizontal',
        expect.any(Function)
      );
    });

    it('should use grid layout in panel when area is large and terminals are 6+', () => {
      const terminalBody = document.getElementById('terminal-body') as HTMLElement;
      Object.defineProperty(terminalBody, 'clientWidth', { value: 1600, configurable: true });
      Object.defineProperty(terminalBody, 'clientHeight', { value: 1000, configurable: true });

      for (let i = 1; i <= 6; i++) {
        const container = document.createElement('div');
        manager.registerContainer(`t${i}`, container);
      }

      manager.applyDisplayState({
        mode: 'split',
        activeTerminalId: 't1',
        orderedTerminalIds: ['t1', 't2', 't3', 't4', 't5', 't6'],
        splitDirection: 'horizontal',
      });

      expect((manager as any).splitLayoutService.activateGridLayout).toHaveBeenCalled();
    });

    it('should apply normal mode', () => {
      const c1 = document.createElement('div');
      manager.registerContainer('t1', c1);
      
      manager.applyDisplayState({
        mode: 'normal',
        activeTerminalId: 't1',
        orderedTerminalIds: ['t1']
      });
      
      expect((manager as any).visibilityService.normalizeTerminalBody).toHaveBeenCalled();
      expect(c1.classList.contains('terminal-container--fullscreen')).toBe(false);
      expect(c1.classList.contains('terminal-container--split')).toBe(false);
    });
  });

  describe('Split Artifacts', () => {
    it('should clear split artifacts', () => {
      manager.clearSplitArtifacts();
      
      expect((manager as any).splitLayoutService.getSplitResizers).toHaveBeenCalled();
      expect((manager as any).splitLayoutService.getSplitWrapperCache).toHaveBeenCalled();
      expect((manager as any).visibilityService.normalizeTerminalBody).toHaveBeenCalled();
    });

    it('should clear grid and horizontal split classes from terminals-wrapper', () => {
      const terminalBody = document.getElementById('terminal-body') as HTMLElement;
      const terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      terminalsWrapper.classList.add('terminal-grid-layout', 'terminal-split-horizontal');
      terminalsWrapper.style.display = 'grid';
      terminalsWrapper.style.gridTemplateColumns = 'repeat(5, 1fr)';
      terminalsWrapper.style.gridTemplateRows = '1fr auto 1fr';
      terminalBody.appendChild(terminalsWrapper);

      manager.clearSplitArtifacts();

      expect(terminalsWrapper.classList.contains('terminal-grid-layout')).toBe(false);
      expect(terminalsWrapper.classList.contains('terminal-split-horizontal')).toBe(false);
      expect(terminalsWrapper.style.gridTemplateColumns).toBe('');
      expect(terminalsWrapper.style.gridTemplateRows).toBe('');
    });
  });

  describe('Container Management', () => {
    it('should discover existing containers on init', async () => {
      const existing = document.createElement('div');
      existing.className = 'terminal-container';
      existing.setAttribute('data-terminal-id', 'existing-1');
      document.body.appendChild(existing);
      
      await manager.initialize();
      
      expect(manager.getContainer('existing-1')).toBe(existing);
    });

    it('should reorder containers in DOM', () => {
      const parent = document.getElementById('terminal-body');
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      manager.registerContainer('t1', c1);
      manager.registerContainer('t2', c2);
      parent?.appendChild(c1);
      parent?.appendChild(c2);

      manager.reorderContainers(['t2', 't1']);

      expect(parent?.firstChild).toBe(c2);
      expect(parent?.lastChild).toBe(c1);
    });

    it('should update containerCache order after reordering (fixes split mode display order)', () => {
      const parent = document.getElementById('terminal-body');
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      const c3 = document.createElement('div');
      manager.registerContainer('t1', c1);
      manager.registerContainer('t2', c2);
      manager.registerContainer('t3', c3);
      parent?.appendChild(c1);
      parent?.appendChild(c2);
      parent?.appendChild(c3);

      // Initial order should be t1, t2, t3
      expect(manager.getContainerOrder()).toEqual(['t1', 't2', 't3']);

      // Reorder to t3, t1, t2 (simulating drag-drop)
      manager.reorderContainers(['t3', 't1', 't2']);

      // Cache order should now reflect the new order
      expect(manager.getContainerOrder()).toEqual(['t3', 't1', 't2']);
    });

    it('should preserve containers not in order array at the end', () => {
      const parent = document.getElementById('terminal-body');
      const c1 = document.createElement('div');
      const c2 = document.createElement('div');
      const c3 = document.createElement('div');
      manager.registerContainer('t1', c1);
      manager.registerContainer('t2', c2);
      manager.registerContainer('t3', c3);
      parent?.appendChild(c1);
      parent?.appendChild(c2);
      parent?.appendChild(c3);

      // Reorder with only t2, t1 (t3 not mentioned)
      manager.reorderContainers(['t2', 't1']);

      // t3 should be preserved at the end
      expect(manager.getContainerOrder()).toEqual(['t2', 't1', 't3']);
    });
  });

  describe('Diagnostics', () => {
    it('should provide debug info and snapshot', () => {
      const container = document.createElement('div');
      manager.registerContainer('t1', container);
      
      const info = manager.getDebugInfo();
      expect(info.cachedContainers).toBe(1);
      expect(info.modes['t1']).toBe('normal');
      
      const snapshot = manager.getDisplaySnapshot();
      expect(snapshot.registeredContainers).toBe(1);
    });
  });
});
