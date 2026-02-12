/**
 * SplitLayoutService Grid Layout Tests
 *
 * Tests for the 2-row grid layout functionality for 6-10 terminals.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SplitLayoutService } from '../../../../../../webview/managers/container/SplitLayoutService';

// Mock dependencies
vi.mock('../../../../../../webview/utils/ManagerLogger');

describe('SplitLayoutService - Grid Layout', () => {
  let service: SplitLayoutService;
  let terminalBody: HTMLElement;

  function createContainers(count: number): Map<string, HTMLElement> {
    const containers = new Map<string, HTMLElement>();
    for (let i = 1; i <= count; i++) {
      const el = document.createElement('div');
      el.id = `container-${i}`;
      containers.set(`term-${i}`, el);
    }
    return containers;
  }

  function getTerminalIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `term-${i + 1}`);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SplitLayoutService();
    terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    document.body.appendChild(terminalBody);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('activateGridLayout', () => {
    it('should add terminal-grid-layout class to terminals-wrapper', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      const wrapper = document.getElementById('terminals-wrapper');
      expect(wrapper?.classList.contains('terminal-grid-layout')).toBe(true);
    });

    it('should not have terminal-split-horizontal class in grid mode', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      const wrapper = document.getElementById('terminals-wrapper');
      expect(wrapper?.classList.contains('terminal-split-horizontal')).toBe(false);
    });

    it('should set gridMode to true', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      expect(service.isGridMode()).toBe(true);
    });

    it('should create wrappers for all 6 terminals', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      const wrappers = document.querySelectorAll('[data-terminal-wrapper-id]');
      expect(wrappers.length).toBe(6);
    });

    it('should create wrappers for all 10 terminals', () => {
      const containers = createContainers(10);
      service.activateGridLayout(terminalBody, getTerminalIds(10), (id) => containers.get(id));

      const wrappers = document.querySelectorAll('[data-terminal-wrapper-id]');
      expect(wrappers.length).toBe(10);
    });

    it('should create a grid-row-resizer element', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      const resizer = document.querySelector('.grid-row-resizer');
      expect(resizer).not.toBeNull();
    });

    it('should set grid-template-columns based on max row count', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      const wrapper = document.getElementById('terminals-wrapper');
      // 6 terminals → 3+3, so max columns is 3
      expect(wrapper?.style.gridTemplateColumns).toBe('repeat(3, 1fr)');
    });

    it('should set grid-template-columns for 7 terminals (4+3)', () => {
      const containers = createContainers(7);
      service.activateGridLayout(terminalBody, getTerminalIds(7), (id) => containers.get(id));

      const wrapper = document.getElementById('terminals-wrapper');
      // 7 terminals → 4+3, so max columns is 4
      expect(wrapper?.style.gridTemplateColumns).toBe('repeat(4, 1fr)');
    });

    it('should set grid-template-columns for 10 terminals (5+5)', () => {
      const containers = createContainers(10);
      service.activateGridLayout(terminalBody, getTerminalIds(10), (id) => containers.get(id));

      const wrapper = document.getElementById('terminals-wrapper');
      // 10 terminals → 5+5, so max columns is 5
      expect(wrapper?.style.gridTemplateColumns).toBe('repeat(5, 1fr)');
    });

    it('should assign grid-row 1 to first row terminals', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      // First 3 terminals should be in grid-row 1
      for (let i = 1; i <= 3; i++) {
        const wrapper = document.querySelector(`[data-terminal-wrapper-id="term-${i}"]`) as HTMLElement;
        expect(wrapper?.style.gridRow).toBe('1');
      }
    });

    it('should assign grid-row 3 to second row terminals', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      // Last 3 terminals should be in grid-row 3 (row 2 is resizer)
      for (let i = 4; i <= 6; i++) {
        const wrapper = document.querySelector(`[data-terminal-wrapper-id="term-${i}"]`) as HTMLElement;
        expect(wrapper?.style.gridRow).toBe('3');
      }
    });

    it('should not create any .split-resizer elements', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      const resizers = document.querySelectorAll('.split-resizer');
      expect(resizers.length).toBe(0);
    });

    it('should handle empty terminal list', () => {
      service.activateGridLayout(terminalBody, [], () => undefined);
      expect(service.isGridMode()).toBe(false);
    });

    it('should cache wrappers', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      expect(service.getSplitWrapperCache().size).toBe(6);
    });
  });

  describe('deactivateGridLayout', () => {
    it('should remove terminal-grid-layout class', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      service.deactivateGridLayout();

      const wrapper = document.getElementById('terminals-wrapper');
      expect(wrapper?.classList.contains('terminal-grid-layout')).toBe(false);
    });

    it('should set gridMode to false', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      service.deactivateGridLayout();

      expect(service.isGridMode()).toBe(false);
    });

    it('should remove grid-row-resizer from DOM', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      service.deactivateGridLayout();

      const resizer = document.querySelector('.grid-row-resizer');
      expect(resizer).toBeNull();
    });

    it('should clear grid inline styles from wrappers', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      service.deactivateGridLayout();

      service.getSplitWrapperCache().forEach((wrapper) => {
        expect(wrapper.style.gridRow).toBe('');
        expect(wrapper.style.gridColumn).toBe('');
      });
    });

    it('should be a no-op when grid mode is not active', () => {
      expect(service.isGridMode()).toBe(false);
      service.deactivateGridLayout();
      expect(service.isGridMode()).toBe(false);
    });
  });

  describe('Grid → Flex transition', () => {
    it('should cleanly transition from grid to flex when removeSplitArtifacts is called', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      expect(service.isGridMode()).toBe(true);

      service.removeSplitArtifacts(terminalBody);

      expect(service.isGridMode()).toBe(false);
      expect(document.querySelectorAll('.grid-row-resizer').length).toBe(0);
      expect(document.querySelectorAll('[data-terminal-wrapper-id]').length).toBe(0);
    });
  });

  describe('createGridWrapper', () => {
    it('should create wrapper with correct grid-row for row 1', () => {
      const wrapper = service.createGridWrapper('t1', 0, 3, 3);
      expect(wrapper.style.gridRow).toBe('1');
      expect(wrapper.style.gridColumn).toBe('1');
    });

    it('should create wrapper with correct grid-row for row 2', () => {
      // index=3, row1Count=3 → row 2 (grid-row: 3), col 1
      const wrapper = service.createGridWrapper('t4', 3, 3, 3);
      expect(wrapper.style.gridRow).toBe('3');
      expect(wrapper.style.gridColumn).toBe('1');
    });

    it('should assign correct column indices', () => {
      // 7 terminals → row1=4, row2=3, maxColumns=4
      const w0 = service.createGridWrapper('t1', 0, 4, 4);
      const w1 = service.createGridWrapper('t2', 1, 4, 4);
      const w2 = service.createGridWrapper('t3', 2, 4, 4);
      const w3 = service.createGridWrapper('t4', 3, 4, 4);
      const w4 = service.createGridWrapper('t5', 4, 4, 4); // row 2, col 1
      const w5 = service.createGridWrapper('t6', 5, 4, 4); // row 2, col 2
      const w6 = service.createGridWrapper('t7', 6, 4, 4); // row 2, col 3

      expect(w0.style.gridColumn).toBe('1');
      expect(w1.style.gridColumn).toBe('2');
      expect(w2.style.gridColumn).toBe('3');
      expect(w3.style.gridColumn).toBe('4');
      expect(w4.style.gridColumn).toBe('1');
      expect(w5.style.gridColumn).toBe('2');
      expect(w6.style.gridColumn).toBe('3');
    });
  });

  describe('createGridRowResizer', () => {
    it('should create element with grid-row-resizer class', () => {
      const resizer = service.createGridRowResizer();
      expect(resizer.className).toBe('grid-row-resizer');
    });

    it('should have row-resize cursor', () => {
      const resizer = service.createGridRowResizer();
      expect(resizer.style.cursor).toBe('row-resize');
    });

    it('should span all columns', () => {
      const resizer = service.createGridRowResizer();
      expect(resizer.style.gridColumn).toBe('1 / -1');
    });

    it('should be placed on grid-row 2', () => {
      const resizer = service.createGridRowResizer();
      expect(resizer.style.gridRow).toBe('2');
    });
  });

  describe('clear', () => {
    it('should reset gridMode and gridRowResizer', () => {
      const containers = createContainers(6);
      service.activateGridLayout(terminalBody, getTerminalIds(6), (id) => containers.get(id));

      service.clear();

      expect(service.isGridMode()).toBe(false);
      expect(service.getGridRowResizer()).toBeNull();
    });
  });
});
