
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalTabList, TerminalTabEvents } from '../../../../../webview/components/TerminalTabList';

describe('TerminalTabList', () => {
  let dom: JSDOM;
  let container: HTMLElement;
  let tabList: TerminalTabList;
  let mockEvents: TerminalTabEvents;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
    vi.stubGlobal('getComputedStyle', dom.window.getComputedStyle);

    container = dom.window.document.getElementById('container')!;
    mockEvents = {
      onTabClick: vi.fn(),
      onTabClose: vi.fn(),
      onTabRename: vi.fn(),
      onTabReorder: vi.fn(),
      onNewTab: vi.fn(),
      onModeToggle: vi.fn()
    };

    tabList = new TerminalTabList(container, mockEvents);
  });

  afterEach(() => {
    tabList.dispose();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('UI Construction', () => {
    it('should initialize with correct classes and structure', () => {
      expect(container.className).toBe('terminal-tabs-container');
      expect(container.querySelector('.terminal-tabs-wrapper')).not.toBeNull();
    });
  });

  describe('Tab Management', () => {
    it('should add a tab element to the wrapper', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: false, isClosable: true });
      
      const tabEl = container.querySelector('[data-tab-id="t1"]');
      expect(tabEl).not.toBeNull();
      expect(tabEl?.textContent).toContain('Terminal 1');
    });

    it('should update active state correctly', () => {
      tabList.addTab({ id: 't1', name: 'T1', isActive: false, isClosable: true });
      tabList.addTab({ id: 't2', name: 'T2', isActive: false, isClosable: true });
      
      tabList.setActiveTab('t2');
      
      const t1El = container.querySelector('[data-tab-id="t1"]');
      const t2El = container.querySelector('[data-tab-id="t2"]');
      
      expect(t1El?.classList.contains('active')).toBe(false);
      expect(t2El?.classList.contains('active')).toBe(true);
      expect(t2El?.getAttribute('aria-selected')).toBe('true');
    });

    it('should remove a tab element', () => {
      tabList.addTab({ id: 't1', name: 'T1', isActive: false, isClosable: true });
      tabList.removeTab('t1');
      
      expect(container.querySelector('[data-tab-id="t1"]')).toBeNull();
    });
  });

  describe('Event Interaction', () => {
    it('should trigger onTabClick when a tab is clicked', () => {
      tabList.addTab({ id: 't1', name: 'T1', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;
      
      // Simulate click
      tabEl.click();
      
      expect(mockEvents.onTabClick).toHaveBeenCalledWith('t1');
    });

    it('should trigger onTabClose when close button is clicked', () => {
      tabList.addTab({ id: 't1', name: 'T1', isActive: false, isClosable: true });
      const closeBtn = container.querySelector('.terminal-tab-close') as HTMLElement;
      
      // Use MouseEvent to ensure delegation picks it up
      const event = new dom.window.MouseEvent('click', { bubbles: true });
      closeBtn.dispatchEvent(event);
      
      expect(mockEvents.onTabClose).toHaveBeenCalledWith('t1');
    });

    it('should trigger onModeToggle when indicator is clicked', () => {
      const indicator = container.querySelector('.terminal-mode-indicator') as HTMLElement;
      indicator.click();
      expect(mockEvents.onModeToggle).toHaveBeenCalled();
    });
  });

  describe('Visual State', () => {
    it('should update mode indicator', () => {
      tabList.setModeIndicator('fullscreen');
      const indicator = container.querySelector('.terminal-mode-indicator');
      expect(indicator?.getAttribute('data-mode')).toBe('fullscreen');
      expect(indicator?.getAttribute('aria-label')).toBe('Show all terminals');
    });

    it('should apply theme styles to tabs', () => {
      tabList.addTab({ id: 't1', name: 'T1', isActive: true, isClosable: true });
      const theme = { background: '#123456', foreground: '#ffffff', cursor: '#ffffff' };
      
      tabList.updateTheme(theme);
      
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;
      // Note: jsdom might not normalize colors, checking the set value
      expect(tabEl.style.backgroundColor).toBe('rgb(18, 52, 86)'); // #123456 in RGB
    });
  });
});
