/**
 * HeaderFactory Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HeaderFactory,
  HEADER_INDICATOR_COLOR_PALETTE,
} from '../../../../../webview/factories/HeaderFactory';

// Mock logger
vi.mock('../../../../../src/utils/logger', () => ({
  webview: vi.fn(),
}));

describe('HeaderFactory', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createTerminalHeader', () => {
    it('should create header structure with name', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'My Terminal',
      });
      
      expect(elements.container.getAttribute('data-terminal-id')).toBe('t1');
      expect(elements.nameSpan.textContent).toBe('My Terminal');
      expect(elements.container.className).toContain('terminal-header');
    });

    it('should include split button if requested', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Split Test',
        showSplitButton: true
      });
      
      expect(elements.splitButton).toBeTruthy();
      expect(elements.splitButton?.className).toContain('split-btn');
    });

    it('should handle click events', () => {
      const onHeaderClick = vi.fn();
      const onCloseClick = vi.fn();
      
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Event Test',
        onHeaderClick,
        onCloseClick
      });
      
      // Click header
      elements.container.click();
      expect(onHeaderClick).toHaveBeenCalledWith('t1');
      
      // Click close button
      elements.closeButton.click();
      expect(onCloseClick).toHaveBeenCalledWith('t1');
    });

    it('should handle hover effects', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Hover Test',
      });
      
      const btn = elements.closeButton;
      btn.dispatchEvent(new MouseEvent('mouseenter'));
      expect(btn.style.opacity).toBe('1');
      
      btn.dispatchEvent(new MouseEvent('mouseleave'));
      expect(btn.style.opacity).toBe('0.7');
    });
  });

  describe('Status Management', () => {
    let elements: any;

    beforeEach(() => {
      elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Status Test',
      });
    });

    it('should insert CLI Agent status', () => {
      HeaderFactory.insertCliAgentStatus(elements, 'connected', 'claude');
      
      expect(elements.statusSpan.textContent).toContain('AI Agent Connected');
      expect(elements.indicator.style.color.toLowerCase()).toBe('#4caf50');
    });

    it('should update status when called multiple times', () => {
      HeaderFactory.insertCliAgentStatus(elements, 'connected');
      HeaderFactory.insertCliAgentStatus(elements, 'disconnected');
      
      expect(elements.statusSpan.textContent).toContain('AI Agent Disconnected');
      expect(elements.statusSection.querySelectorAll('.ai-agent-status').length).toBe(1);
    });

    it('should remove status', () => {
      HeaderFactory.insertCliAgentStatus(elements, 'connected');
      HeaderFactory.removeCliAgentStatus(elements);
      
      expect(elements.statusSpan).toBeNull();
      expect(elements.statusSection.children.length).toBe(0);
    });
  });

  describe('UI Updates', () => {
    it('should update terminal name', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Old',
      });
      
      HeaderFactory.updateTerminalName(elements, 'New');
      expect(elements.nameSpan.textContent).toBe('New');
    });

    it('should update active state styles', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Active Test',
      });
      
      HeaderFactory.setActiveState(elements, true);
      expect(elements.container.style.backgroundColor).toContain('activeBackground');
      
      HeaderFactory.setActiveState(elements, false);
      expect(elements.container.style.backgroundColor).toContain('inactiveBackground');
    });

    it('should toggle AI Agent button visibility', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Button Test',
      });
      
      HeaderFactory.setAiAgentToggleButtonVisibility(elements, false);
      expect(elements.aiAgentToggleButton?.style.display).toBe('none');
      
      HeaderFactory.setAiAgentToggleButtonVisibility(elements, true, 'connected');
      expect(elements.aiAgentToggleButton?.style.display).toBe('flex');
      expect(elements.aiAgentToggleButton?.title).toContain('Connected');
    });
  });

  describe('Terminal Name Editing', () => {
    it('should not trigger header activation on second click of terminal-name double click', () => {
      const onRenameSubmit = vi.fn();
      const onHeaderClick = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onRenameSubmit,
        onHeaderClick,
      });

      elements.nameSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      elements.nameSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
      elements.nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));

      const input = elements.titleSection.querySelector('.terminal-name-edit-input');
      expect(onHeaderClick).toHaveBeenCalledTimes(1);
      expect(input).toBeTruthy();
    });

    it('should enter rename mode on terminal name double click', () => {
      const onRenameSubmit = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onRenameSubmit,
      });

      elements.nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const input = elements.titleSection.querySelector('.terminal-name-edit-input');
      expect(input).toBeTruthy();
      expect(onRenameSubmit).not.toHaveBeenCalled();
    });

    it('should submit rename on Enter', () => {
      const onRenameSubmit = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onRenameSubmit,
      });

      elements.nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const input = elements.titleSection.querySelector(
        '.terminal-name-edit-input'
      ) as HTMLInputElement;
      input.value = 'Renamed';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(onRenameSubmit).toHaveBeenCalledWith('t1', 'Renamed');
      expect(elements.nameSpan.textContent).toBe('Renamed');
    });

    it('should cancel rename on Escape', () => {
      const onRenameSubmit = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onRenameSubmit,
      });

      elements.nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const input = elements.titleSection.querySelector(
        '.terminal-name-edit-input'
      ) as HTMLInputElement;
      input.value = 'Renamed';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(onRenameSubmit).not.toHaveBeenCalled();
      expect(elements.nameSpan.textContent).toBe('Original');
    });

    it('should submit rename on blur', async () => {
      const onRenameSubmit = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onRenameSubmit,
      });

      elements.nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const input = elements.titleSection.querySelector(
        '.terminal-name-edit-input'
      ) as HTMLInputElement;
      input.value = 'Renamed By Blur';
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

      // blur handler uses requestAnimationFrame
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(onRenameSubmit).toHaveBeenCalledWith('t1', 'Renamed By Blur');
      expect(elements.nameSpan.textContent).toBe('Renamed By Blur');
    });

    it('should keep original name when submitting empty value', () => {
      const onRenameSubmit = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onRenameSubmit,
      });

      elements.nameSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const input = elements.titleSection.querySelector(
        '.terminal-name-edit-input'
      ) as HTMLInputElement;
      input.value = '   ';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(onRenameSubmit).not.toHaveBeenCalled();
      expect(elements.nameSpan.textContent).toBe('Original');
    });

    it('should NOT close editor when clicking a color palette button', async () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeTruthy();

      const pinkOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF69B4"]'
      ) as HTMLButtonElement;
      const input = elements.titleSection.querySelector('.terminal-name-edit-input') as HTMLInputElement;

      // Simulate: mousedown sets flag, focusout fires, click fires and re-focuses input
      pinkOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      pinkOption.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeTruthy();
      // Do not commit updates while the editor is still open.
      expect(onHeaderUpdate).not.toHaveBeenCalledWith('t1', { indicatorColor: '#FF69B4' });
    });

    it('should NOT close editor when focus moves from input to a palette button (blur path)', async () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });
      document.body.appendChild(elements.container);

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const editor = elements.titleSection.querySelector('.terminal-header-editor') as HTMLElement;
      expect(editor).toBeTruthy();

      const input = elements.titleSection.querySelector('.terminal-name-edit-input') as HTMLInputElement;
      const pinkOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF69B4"]'
      ) as HTMLButtonElement;
      expect(input).toBeTruthy();
      expect(pinkOption).toBeTruthy();

      input.focus();
      pinkOption.focus(); // activeElement moves within editor
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: pinkOption }));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeTruthy();
    });

    it('should NOT close editor when clicking the color palette area (non-button)', async () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeTruthy();

      const palette = elements.titleSection.querySelector(
        '.terminal-header-color-palette'
      ) as HTMLElement;
      const input = elements.titleSection.querySelector('.terminal-name-edit-input') as HTMLInputElement;

      // Simulate: clicking within palette background triggers input blur.
      palette.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      palette.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));

      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeTruthy();
    });

    it('should close editor when double-clicking the color palette area (non-button)', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeTruthy();

      const palette = elements.titleSection.querySelector(
        '.terminal-header-color-palette'
      ) as HTMLElement;
      palette.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(elements.titleSection.querySelector('.terminal-header-editor')).toBeNull();
      expect(elements.nameSpan.textContent).toBe('Original');
    });

    it('should commit indicator color when closing the editor (palette dblclick)', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const pinkOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF69B4"]'
      ) as HTMLButtonElement;
      pinkOption.click();

      const palette = elements.titleSection.querySelector(
        '.terminal-header-color-palette'
      ) as HTMLElement;
      palette.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(onHeaderUpdate).toHaveBeenCalledWith('t1', { indicatorColor: '#FF69B4' });
    });

    it('should apply enhanced visual styles to selected color option', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const pinkOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF69B4"]'
      ) as HTMLButtonElement;
      pinkOption.click();

      expect(pinkOption.style.outline).toContain('var(--vscode-focusBorder)');
      expect(pinkOption.style.outlineOffset).toBe('1px');
      expect(pinkOption.style.transform).toBe('scale(1)');
      expect(pinkOption.style.opacity).toBe('1');

      const redOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF0000"]'
      ) as HTMLButtonElement;
      expect(redOption.style.outline).toContain('none');
      expect(redOption.style.transform).toBe('scale(1)');
      expect(redOption.style.opacity).toBe('0.6');
    });

    it('should flash processing indicator when color is selected', () => {
      vi.useFakeTimers();
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });
      document.body.appendChild(elements.container);

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const indicator = elements.container.querySelector('.terminal-processing-indicator') as HTMLElement;
      const flow = elements.container.querySelector(
        '.terminal-processing-indicator-flow'
      ) as HTMLElement;
      expect(indicator.style.opacity).toBe('0');
      expect(flow.style.animation).toContain('infinite');

      const pinkOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF69B4"]'
      ) as HTMLButtonElement;
      pinkOption.click();

      expect(indicator.style.opacity).toBe('1');
      // Palette click should provide a single-run animation for quick color confirmation.
      expect(flow.style.animation).not.toContain('infinite');

      vi.advanceTimersByTime(600);
      expect(indicator.style.opacity).toBe('0');
      expect(flow.style.animation).toContain('infinite');

      vi.useRealTimers();
    });

    it('should open unified editor on header double click with color palette', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const editor = elements.titleSection.querySelector('.terminal-header-editor');
      const input = elements.titleSection.querySelector('.terminal-name-edit-input');
      const colorOptions = elements.titleSection.querySelectorAll('.terminal-header-color-option');

      expect(editor).toBeTruthy();
      expect(input).toBeTruthy();
      expect(colorOptions).toHaveLength(HEADER_INDICATOR_COLOR_PALETTE.length);
      expect(onHeaderUpdate).not.toHaveBeenCalled();
    });

    it('should update indicator color immediately from unified editor', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const pinkOption = elements.titleSection.querySelector(
        '[data-indicator-color="#FF69B4"]'
      ) as HTMLButtonElement;
      pinkOption.click();

      expect(onHeaderUpdate).not.toHaveBeenCalledWith('t1', { indicatorColor: '#FF69B4' });
      expect(elements.container.style.getPropertyValue('--terminal-indicator-color')).toBe('#FF69B4');
    });

    it('should provide OFF option and emit transparent indicator color', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
      });

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const offOption = elements.titleSection.querySelector(
        '[data-indicator-color="transparent"]'
      ) as HTMLButtonElement | null;
      expect(offOption).toBeTruthy();
      expect(offOption?.textContent).toBe('OFF');

      offOption?.click();

      expect(onHeaderUpdate).not.toHaveBeenCalledWith('t1', { indicatorColor: 'transparent' });
      expect(elements.container.style.getPropertyValue('--terminal-indicator-color')).toBe(
        'transparent'
      );
    });
  });

  describe('Processing Indicator', () => {
    it('should toggle processing indicator visibility', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Indicator Test',
      });

      const flow = elements.container.querySelector('.terminal-processing-indicator') as HTMLElement;
      expect(flow).toBeTruthy();
      expect(flow.style.opacity).toBe('0');

      HeaderFactory.setProcessingIndicatorActive(elements, true);
      expect(flow.style.opacity).toBe('1');

      HeaderFactory.setProcessingIndicatorActive(elements, false);
      expect(flow.style.opacity).toBe('0');
    });

    it('should expose agreed color palette including white', () => {
      expect(HEADER_INDICATOR_COLOR_PALETTE).toContain('#FFFFFF');
      expect(HEADER_INDICATOR_COLOR_PALETTE).toContain('transparent');
      expect(HEADER_INDICATOR_COLOR_PALETTE).toHaveLength(15);
    });

    it('should keep processing indicator hidden when header enhancements are disabled', () => {
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Indicator Disabled Test',
        headerEnhancementsEnabled: false,
      } as any);

      const flow = elements.container.querySelector('.terminal-processing-indicator') as HTMLElement;
      expect(flow).toBeTruthy();

      HeaderFactory.setProcessingIndicatorActive(elements, true);
      expect(flow.style.opacity).toBe('0');
    });
  });

  describe('Header Enhancements Toggle', () => {
    it('should open rename editor without color palette when header enhancements are disabled', () => {
      const onHeaderUpdate = vi.fn();
      const elements = HeaderFactory.createTerminalHeader({
        terminalId: 't1',
        terminalName: 'Original',
        onHeaderUpdate,
        headerEnhancementsEnabled: false,
      } as any);

      elements.container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const input = elements.titleSection.querySelector('.terminal-name-edit-input');
      const colorOptions = elements.titleSection.querySelectorAll('.terminal-header-color-option');

      expect(input).toBeTruthy();
      expect(colorOptions).toHaveLength(0);
      expect(onHeaderUpdate).not.toHaveBeenCalledWith('t1', expect.objectContaining({ indicatorColor: expect.any(String) }));
    });
  });
});
