/**
 * HeaderFactory Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeaderFactory } from '../../../../../webview/factories/HeaderFactory';

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

    it('should submit rename on blur', () => {
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
      input.dispatchEvent(new Event('blur', { bubbles: true }));

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
  });
});
