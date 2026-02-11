
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

  describe('Drag and Drop', () => {
    it('should compute reorder based on current DOM order after previous reorders', () => {
      tabList.addTab({ id: 't1', name: 'T1', isActive: false, isClosable: true });
      tabList.addTab({ id: 't2', name: 'T2', isActive: false, isClosable: true });
      tabList.addTab({ id: 't3', name: 'T3', isActive: false, isClosable: true });

      // Simulate a prior reorder so DOM order differs from insertion order
      tabList.reorderTabs(['t2', 't3', 't1']);

      const tabsWrapper = container.querySelector('.terminal-tabs-wrapper') as HTMLElement;
      const tab2 = container.querySelector('[data-tab-id="t2"]') as HTMLElement;
      const tab3 = container.querySelector('[data-tab-id="t3"]') as HTMLElement;

      const rect = {
        left: 0,
        right: 100,
        width: 100,
        top: 0,
        bottom: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({})
      };

      tab3.getBoundingClientRect = () => rect;
      tabsWrapper.getBoundingClientRect = () => rect;

      const dataTransfer = { effectAllowed: '', setData: vi.fn(), getData: vi.fn() };
      const dragStart = new dom.window.Event('dragstart', { bubbles: true, cancelable: true }) as any;
      dragStart.dataTransfer = dataTransfer;
      tab2.dispatchEvent(dragStart);

      const dragOver = new dom.window.MouseEvent('dragover', { bubbles: true, clientX: 80 }) as any;
      dragOver.dataTransfer = dataTransfer;
      tab3.dispatchEvent(dragOver);

      const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true }) as any;
      drop.dataTransfer = dataTransfer;
      tab3.dispatchEvent(drop);

      expect(mockEvents.onTabReorder).toHaveBeenCalledWith(
        0,
        1,
        ['t3', 't2', 't1']
      );
    });
  });

  describe('Double-Click Rename', () => {
    it('should show rename input when tab label is double-clicked', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      // Need 2+ tabs for tabs to be visible
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('Terminal 1');
    });

    it('should NOT trigger rename when close button is double-clicked', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const closeBtn = container.querySelector('.terminal-tab-close') as HTMLElement;

      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      closeBtn.dispatchEvent(dblclickEvent);

      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;
      const input = tabEl.querySelector('input.terminal-tab-rename-input');
      expect(input).toBeNull();
    });

    it('should call onTabRename when Enter is pressed in rename input', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      // Trigger rename mode
      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      expect(input).not.toBeNull();

      // Type new name and press Enter
      input.value = 'New Name';
      const enterEvent = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(enterEvent);

      expect(mockEvents.onTabRename).toHaveBeenCalledWith('t1', 'New Name');
    });

    it('should restore original name when Escape is pressed in rename input', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      // Trigger rename mode
      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      input.value = 'Changed Name';

      const escapeEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      input.dispatchEvent(escapeEvent);

      expect(mockEvents.onTabRename).not.toHaveBeenCalled();
      // Label should be restored
      const label = tabEl.querySelector('.terminal-tab-label');
      expect(label?.textContent).toBe('Terminal 1');
    });

    it('should save name on blur from rename input after delay', () => {
      vi.useFakeTimers();
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      // Trigger rename mode
      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      input.value = 'Blurred Name';

      const blurEvent = new dom.window.Event('blur', { bubbles: false });
      input.dispatchEvent(blurEvent);

      // Not called immediately due to delayed blur pattern
      expect(mockEvents.onTabRename).not.toHaveBeenCalled();

      // After the delay expires, the rename should be committed
      vi.advanceTimersByTime(60);

      expect(mockEvents.onTabRename).toHaveBeenCalledWith('t1', 'Blurred Name');
      vi.useRealTimers();
    });

    it('should survive focus steal from terminal.focus() during rename', () => {
      vi.useFakeTimers();
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      // Trigger rename mode
      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.value = 'New Name';

      // Simulate terminal.focus() stealing focus (triggers blur on the input)
      const blurEvent = new dom.window.Event('blur', { bubbles: false });
      input.dispatchEvent(blurEvent);

      // Before the delay expires, re-focus the input (simulating the re-assert timeout).
      // In JSDOM, focus() alone may not fire the 'focus' event, so dispatch it explicitly.
      vi.advanceTimersByTime(30);
      input.focus();
      input.dispatchEvent(new dom.window.Event('focus', { bubbles: false }));

      // Now advance past the full delay
      vi.advanceTimersByTime(30);

      // Rename should NOT have been committed because input regained focus
      expect(mockEvents.onTabRename).not.toHaveBeenCalled();

      // Input should still be present in the DOM
      expect(tabEl.querySelector('input.terminal-tab-rename-input')).not.toBeNull();
      vi.useRealTimers();
    });

    it('should NOT trigger rename when input element is double-clicked', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      // Enter rename mode first
      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      expect(input).not.toBeNull();

      // Double-click the input itself should not cause issues
      const dblclickInput = new dom.window.MouseEvent('dblclick', { bubbles: true });
      input.dispatchEvent(dblclickInput);

      // Input should still be present (no error, no duplicate rename)
      expect(tabEl.querySelector('input.terminal-tab-rename-input')).not.toBeNull();
    });

    it('should call onTabRename exactly once when Enter triggers blur', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      input.value = 'New Name';

      // Enter calls finishRename, which removes input and triggers blur
      const enterEvent = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(enterEvent);

      // blur fires after replaceWith but finishRename guard prevents double call
      const blurEvent = new dom.window.Event('blur', { bubbles: false });
      input.dispatchEvent(blurEvent);

      expect(mockEvents.onTabRename).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onTabRename when name is empty or whitespace', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      input.value = '   ';

      const enterEvent = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(enterEvent);

      expect(mockEvents.onTabRename).not.toHaveBeenCalled();
    });

    it('should NOT call onTabRename when name is unchanged', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      // Name unchanged
      expect(input.value).toBe('Terminal 1');

      const enterEvent = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      input.dispatchEvent(enterEvent);

      expect(mockEvents.onTabRename).not.toHaveBeenCalled();
    });

    it('should preserve rename input when updateTab is called during rename', () => {
      tabList.addTab({ id: 't1', name: 'Terminal 1', isActive: true, isClosable: true });
      tabList.addTab({ id: 't2', name: 'Terminal 2', isActive: false, isClosable: true });
      const tabEl = container.querySelector('[data-tab-id="t1"]') as HTMLElement;

      // Enter rename mode
      const dblclickEvent = new dom.window.MouseEvent('dblclick', { bubbles: true });
      tabEl.dispatchEvent(dblclickEvent);

      const input = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.value = 'Editing...';

      // Simulate a concurrent update (e.g., theme change triggers updateTab)
      tabList.updateTab('t1', { isDirty: true });

      // Input should still be present
      const inputAfterUpdate = tabEl.querySelector('input.terminal-tab-rename-input') as HTMLInputElement;
      expect(inputAfterUpdate).not.toBeNull();
      expect(inputAfterUpdate.value).toBe('Editing...');
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
