import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContainerVisibilityService } from '../../../../../../webview/managers/container/ContainerVisibilityService';

describe('ContainerVisibilityService', () => {
  let service: ContainerVisibilityService;
  let terminalBody: HTMLElement;
  let terminalsWrapper: HTMLElement;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ContainerVisibilityService();

    // Setup DOM
    terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    
    terminalsWrapper = document.createElement('div');
    terminalsWrapper.id = 'terminals-wrapper';
    
    document.body.appendChild(terminalBody);
    document.body.appendChild(terminalsWrapper);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    service.clearHiddenStorage();
  });

  describe('isElementVisible', () => {
    it('should return true for visible elements', () => {
      const el = document.createElement('div');
      expect(service.isElementVisible(el)).toBe(true);
    });

    it('should return false for display: none', () => {
      const el = document.createElement('div');
      el.style.display = 'none';
      expect(service.isElementVisible(el)).toBe(false);
    });

    it('should return false for hidden-mode class', () => {
      const el = document.createElement('div');
      el.classList.add('hidden-mode');
      expect(service.isElementVisible(el)).toBe(false);
    });
  });

  describe('getHiddenStorage', () => {
    it('should create storage if missing', () => {
      const storage = service.getHiddenStorage(terminalBody, true);
      expect(storage).not.toBeNull();
      expect(storage?.id).toBe('terminal-hidden-storage');
      expect(storage?.style.display).toBe('none');
      expect(terminalBody.contains(storage!)).toBe(true);
    });

    it('should reuse existing storage', () => {
      const s1 = service.getHiddenStorage(terminalBody, true);
      const s2 = service.getHiddenStorage(terminalBody, true);
      expect(s1).toBe(s2);
    });
  });

  describe('enforceFullscreenState', () => {
    it('should show active terminal and hide others', () => {
      const t1 = document.createElement('div');
      t1.className = 'terminal-container';
      t1.setAttribute('data-terminal-id', 'term-1');
      
      const t2 = document.createElement('div');
      t2.className = 'terminal-container';
      t2.setAttribute('data-terminal-id', 'term-2');
      
      terminalBody.appendChild(t1);
      terminalBody.appendChild(t2);

      service.enforceFullscreenState('term-1', terminalBody, new Map());

      expect(t1.style.display).toBe('flex');
      expect(t1.classList.contains('terminal-container--fullscreen')).toBe(true);
      expect(terminalsWrapper.contains(t1)).toBe(true);

      expect(t2.style.display).toBe('none');
      expect(t2.classList.contains('hidden-mode')).toBe(true);
      
      const storage = document.getElementById('terminal-hidden-storage');
      expect(storage?.contains(t2)).toBe(true);
    });

    it('should remove split artifacts', () => {
      const artifact = document.createElement('div');
      artifact.setAttribute('data-terminal-wrapper-id', 'wrap-1');
      terminalBody.appendChild(artifact);

      service.enforceFullscreenState(null, terminalBody, new Map());

      expect(terminalBody.contains(artifact)).toBe(false);
    });
  });

  describe('normalizeTerminalBody', () => {
    it('should move containers back from storage', () => {
      const t1 = document.createElement('div');
      t1.className = 'terminal-container';
      const storage = service.getHiddenStorage(terminalBody, true)!;
      storage.appendChild(t1);

      const cache = new Map([['t1', t1]]);
      service.normalizeTerminalBody(terminalBody, cache);

      expect(terminalsWrapper.contains(t1)).toBe(true);
      expect(t1.classList.contains('terminal-container--fullscreen')).toBe(false);
    });
  });

  describe('show/hideContainer', () => {
    it('showContainer should update styles', () => {
      const t1 = document.createElement('div');
      t1.style.display = 'none';
      t1.classList.add('hidden-mode');
      
      service.showContainer(t1);
      
      expect(t1.style.display).toBe('flex');
      expect(t1.classList.contains('hidden-mode')).toBe(false);
    });

    it('hideContainer should move to storage', () => {
      const t1 = document.createElement('div');
      terminalsWrapper.appendChild(t1);
      
      service.hideContainer(t1, terminalBody);
      
      expect(t1.style.display).toBe('none');
      expect(t1.classList.contains('hidden-mode')).toBe(true);
      const storage = document.getElementById('terminal-hidden-storage');
      expect(storage?.contains(t1)).toBe(true);
    });
  });
});
