import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SplitLayoutService } from '../../../../../../webview/managers/container/SplitLayoutService';

// Mock dependencies
vi.mock('../../../../../../webview/utils/ManagerLogger');

describe('SplitLayoutService', () => {
  let service: SplitLayoutService;
  let terminalBody: HTMLElement;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SplitLayoutService();

    // Setup DOM
    terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    document.body.appendChild(terminalBody);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('ensureTerminalsWrapper', () => {
    it('should create terminals-wrapper if missing', () => {
      const wrapper = service.ensureTerminalsWrapper(terminalBody);
      expect(wrapper.id).toBe('terminals-wrapper');
      expect(terminalBody.contains(wrapper)).toBe(true);
    });

    it('should reuse existing terminals-wrapper', () => {
      const w1 = document.createElement('div');
      w1.id = 'terminals-wrapper';
      terminalBody.appendChild(w1);

      const w2 = service.ensureTerminalsWrapper(terminalBody);
      expect(w1).toBe(w2);
    });
  });

  describe('createSplitWrapper', () => {
    it('should create wrapper with correct attributes', () => {
      const terminalId = 't1';
      const wrapper = service.createSplitWrapper(terminalId, 'vertical');
      
      expect(wrapper.className).toBe('terminal-split-wrapper');
      expect(wrapper.getAttribute('data-terminal-wrapper-id')).toBe(terminalId);
      expect(wrapper.style.display).toBe('flex');
    });

    it('should set width 100% for vertical split', () => {
      const wrapper = service.createSplitWrapper('t1', 'vertical');
      expect(wrapper.style.width).toBe('100%');
    });

    it('should set height 100% for horizontal split', () => {
      const wrapper = service.createSplitWrapper('t1', 'horizontal');
      expect(wrapper.style.height).toBe('100%');
    });
  });

  describe('activateSplitLayout', () => {
    it('should build layout for multiple terminals', () => {
      const t1 = document.createElement('div');
      t1.id = 'container-1';
      const t2 = document.createElement('div');
      t2.id = 'container-2';
      
      const containers = new Map([
        ['term-1', t1],
        ['term-2', t2]
      ]);

      service.activateSplitLayout(
        terminalBody,
        ['term-1', 'term-2'],
        'horizontal',
        (id) => containers.get(id)
      );

      const wrapper = document.getElementById('terminals-wrapper')!;
      expect(wrapper.style.flexDirection).toBe('row'); // horizontal split -> row
      
      const wrappers = wrapper.querySelectorAll('.terminal-split-wrapper');
      expect(wrappers.length).toBe(2);
      expect(wrappers[0].contains(t1)).toBe(true);
      expect(wrappers[1].contains(t2)).toBe(true);
      
      expect(t1.classList.contains('terminal-container--split')).toBe(true);
    });
  });

  describe('removeSplitArtifacts', () => {
    it('should remove wrappers and resizers', () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-terminal-wrapper-id', 't1');
      terminalBody.appendChild(wrapper);
      
      const resizer = document.createElement('div');
      resizer.className = 'split-resizer';
      terminalBody.appendChild(resizer);

      service.removeSplitArtifacts(terminalBody);

      expect(terminalBody.contains(wrapper)).toBe(false);
      expect(terminalBody.contains(resizer)).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should cache and remove wrappers', () => {
      const el = document.createElement('div');
      service.cacheWrapper('t1', el);
      expect(service.getWrapper('t1')).toBe(el);
      
      service.removeWrapper('t1');
      expect(service.getWrapper('t1')).toBeUndefined();
    });
  });
});
