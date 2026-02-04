
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SplitManager } from '../../../../../webview/managers/SplitManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';

// Mock dependencies
vi.mock('../../../../../webview/utils/NotificationUtils', () => ({
  showSplitLimitWarning: vi.fn(),
}));

vi.mock('../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    resetXtermInlineStyles: vi.fn(),
    forceReflow: vi.fn(),
    clearContainerHeightStyles: vi.fn(),
  },
}));

vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  splitLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    lifecycle: vi.fn(),
  },
}));

describe('SplitManager', () => {
  let manager: SplitManager;
  let mockCoordinator: IManagerCoordinator;
  let mockContainerManager: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    mockContainerManager = {
      getContainerOrder: vi.fn().mockReturnValue(['t1', 't2']),
      applyDisplayState: vi.fn(),
      clearSplitArtifacts: vi.fn(),
    };

    mockCoordinator = {
      getTerminalContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getActiveTerminalId: vi.fn().mockReturnValue('t1'),
    } as any;

    // Reset document
    document.body.innerHTML = '<div id="terminal-body" style="height: 500px; width: 500px;"></div>';
    // Mock clientHeight/Width since JSDOM defaults to 0
    Object.defineProperty(document.getElementById('terminal-body'), 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(document.getElementById('terminal-body'), 'clientWidth', { value: 500, configurable: true });

    manager = new SplitManager(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('calculateSplitLayout', () => {
    it('should return valid layout info when splitting is possible', () => {
      // 0 current terminals, adding 1 -> total 1
      const result = manager.calculateSplitLayout();
      expect(result.canSplit).toBe(true);
      expect(result.terminalHeight).toBe(500); // 500 / 1
    });

    it('should handle multiple terminals', () => {
      // Add a mock terminal
      manager.terminals.set('t1', {} as any);
      
      // 1 current, adding 1 -> total 2
      const result = manager.calculateSplitLayout();
      expect(result.canSplit).toBe(true);
      expect(result.terminalHeight).toBe(250); // 500 / 2
    });

    it('should prevent split if max limit reached', () => {
      // Max is 10 (from constants)
      for (let i = 0; i < 10; i++) {
        manager.terminals.set(`t${i}`, {} as any);
      }
      
      const result = manager.calculateSplitLayout();
      expect(result.canSplit).toBe(false);
      expect(result.reason).toContain('Maximum');
    });

    it('should prevent split if terminal height too small', () => {
      // Reduce body height
      Object.defineProperty(document.getElementById('terminal-body'), 'clientHeight', { value: 50 });
      
      const result = manager.calculateSplitLayout();
      expect(result.canSplit).toBe(false);
      expect(result.reason).toContain('too small');
    });
  });

  describe('updateSplitDirection', () => {
    it('should update direction and panel location', () => {
      manager.updateSplitDirection('horizontal', 'panel');
      
      expect(manager.getCurrentPanelLocation()).toBe('panel');
      // @ts-ignore - access private
      expect(manager['splitDirection']).toBe('horizontal');
    });

    it('should apply new layout if in split mode', () => {
      manager.isSplitMode = true;
      manager.terminals.set('t1', {} as any);
      manager.terminals.set('t2', {} as any);
      
      manager.updateSplitDirection('horizontal', 'panel');
      
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalled();
    });
  });

  describe('calculateTerminalHeightPercentage', () => {
    it('should return 100% for single terminal', () => {
      expect(manager.calculateTerminalHeightPercentage()).toBe('100%');
    });

    it('should return 50% for two terminals', () => {
      manager.terminals.set('t1', {} as any);
      manager.terminals.set('t2', {} as any);
      expect(manager.calculateTerminalHeightPercentage()).toBe('50%');
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal and container', () => {
      const mockTerminal = { terminal: { dispose: vi.fn() } };
      const mockContainer = document.createElement('div');
      
      manager.setTerminal('t1', mockTerminal as any);
      manager.setTerminalContainer('t1', mockContainer);
      
      manager.removeTerminal('t1');
      
      expect(manager.getTerminals().has('t1')).toBe(false);
      expect(manager.getTerminalContainers().has('t1')).toBe(false);
      expect(mockTerminal.terminal.dispose).toHaveBeenCalled();
    });

    it('should update layout after removal if in split mode', () => {
      manager.isSplitMode = true;
      manager.terminals.set('t1', {} as any);
      manager.terminals.set('t2', {} as any);
      manager.terminals.set('t3', {} as any); // 3 terminals
      
      manager.removeTerminal('t3');
      
      vi.advanceTimersByTime(100);
      
      // Should still be in split mode and update layout
      expect(manager.isSplitMode).toBe(true);
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalled();
    });

    it('should exit split mode if terminals drop to 1', () => {
      manager.isSplitMode = true;
      manager.terminals.set('t1', {} as any);
      manager.terminals.set('t2', {} as any);
      
      manager.removeTerminal('t2');
      
      vi.advanceTimersByTime(100);
      
      expect(manager.isSplitMode).toBe(false);
    });
  });

  describe('redistributeSplitTerminals', () => {
    it('should redistribute heights', () => {
      manager.isSplitMode = true;
      const t1 = document.createElement('div');
      const t2 = document.createElement('div');
      
      // Add to DOM as container targets
      document.getElementById('terminal-body')?.appendChild(t1);
      document.getElementById('terminal-body')?.appendChild(t2);
      
      // Mark them as terminal containers
      t1.setAttribute('data-terminal-container', 'true');
      t2.setAttribute('data-terminal-container', 'true');
      
      manager.redistributeSplitTerminals(400);
      
      // 400px / 2 = 200px
      expect(t1.style.height).toBe('200px');
      expect(t2.style.height).toBe('200px');
    });

    it('should account for resizer and all flex gaps when redistributing split wrappers', () => {
      manager.isSplitMode = true;

      const terminalBody = document.getElementById('terminal-body')!;
      const terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      terminalsWrapper.style.paddingTop = '4px';
      terminalsWrapper.style.paddingBottom = '4px';
      terminalsWrapper.style.gap = '4px';
      terminalBody.appendChild(terminalsWrapper);

      const wrapper1 = document.createElement('div');
      const wrapper2 = document.createElement('div');
      const wrapper3 = document.createElement('div');
      wrapper1.setAttribute('data-terminal-wrapper-id', 't1');
      wrapper2.setAttribute('data-terminal-wrapper-id', 't2');
      wrapper3.setAttribute('data-terminal-wrapper-id', 't3');

      const resizer1 = document.createElement('div');
      const resizer2 = document.createElement('div');
      resizer1.className = 'split-resizer';
      resizer2.className = 'split-resizer';
      Object.defineProperty(resizer1, 'offsetHeight', { value: 4, configurable: true });
      Object.defineProperty(resizer2, 'offsetHeight', { value: 4, configurable: true });

      terminalsWrapper.append(wrapper1, resizer1, wrapper2, resizer2, wrapper3);

      manager.redistributeSplitTerminals(600);

      const h1 = parseInt(wrapper1.style.height, 10);
      const h2 = parseInt(wrapper2.style.height, 10);
      const h3 = parseInt(wrapper3.style.height, 10);
      const totalWrapperHeight = h1 + h2 + h3;
      const totalResizerHeight = 8;
      const totalGapHeight = 4 * 4; // 5 items => 4 gaps
      const totalPadding = 8;

      expect(totalWrapperHeight + totalResizerHeight + totalGapHeight + totalPadding).toBeLessThanOrEqual(600);
    });

    it('should assign remainder pixels to the last split wrapper', () => {
      manager.isSplitMode = true;

      const terminalBody = document.getElementById('terminal-body')!;
      const terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = 'terminals-wrapper';
      terminalsWrapper.style.paddingTop = '4px';
      terminalsWrapper.style.paddingBottom = '4px';
      terminalsWrapper.style.gap = '4px';
      terminalBody.appendChild(terminalsWrapper);

      const wrapper1 = document.createElement('div');
      const wrapper2 = document.createElement('div');
      const wrapper3 = document.createElement('div');
      wrapper1.setAttribute('data-terminal-wrapper-id', 't1');
      wrapper2.setAttribute('data-terminal-wrapper-id', 't2');
      wrapper3.setAttribute('data-terminal-wrapper-id', 't3');

      const resizer1 = document.createElement('div');
      const resizer2 = document.createElement('div');
      resizer1.className = 'split-resizer';
      resizer2.className = 'split-resizer';
      Object.defineProperty(resizer1, 'offsetHeight', { value: 4, configurable: true });
      Object.defineProperty(resizer2, 'offsetHeight', { value: 4, configurable: true });

      terminalsWrapper.append(wrapper1, resizer1, wrapper2, resizer2, wrapper3);

      manager.redistributeSplitTerminals(601);

      expect(wrapper1.style.height).toBe('189px');
      expect(wrapper2.style.height).toBe('189px');
      expect(wrapper3.style.height).toBe('191px');
    });
  });
});
