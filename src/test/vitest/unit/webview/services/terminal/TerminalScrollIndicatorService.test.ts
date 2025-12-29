/**
 * TerminalScrollIndicatorService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalScrollIndicatorService } from '../../../../../../webview/services/terminal/TerminalScrollIndicatorService';

// Mock logger
vi.mock('../../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TerminalScrollIndicatorService', () => {
  let service: TerminalScrollIndicatorService;
  let mockTerminal: any;
  let mockContainer: HTMLElement;
  let mockViewport: HTMLElement;

  beforeEach(() => {
    service = new TerminalScrollIndicatorService();
    (TerminalScrollIndicatorService as any).stylesInjected = false;
    document.head.innerHTML = '';
    
    mockTerminal = {
      onScroll: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      scrollToBottom: vi.fn(),
    };
    
    mockContainer = document.createElement('div');
    mockViewport = document.createElement('div');
    mockViewport.className = 'xterm-viewport';
    mockContainer.appendChild(mockViewport);
  });

  describe('attach', () => {
    it('should create indicator element and append to container', () => {
      service.attach(mockTerminal, mockContainer, 't1');
      
      const indicator = mockContainer.querySelector('.terminal-scroll-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator?.textContent).toContain('Scroll');
    });

    it('should toggle visible class based on scroll position', () => {
      service.attach(mockTerminal, mockContainer, 't1');
      const indicator = mockContainer.querySelector('.terminal-scroll-indicator') as HTMLElement;
      
      // Mock "at bottom" (scrollTop + clientHeight >= scrollHeight - 2)
      Object.defineProperty(mockViewport, 'scrollTop', { value: 100, configurable: true });
      Object.defineProperty(mockViewport, 'clientHeight', { value: 100, configurable: true });
      Object.defineProperty(mockViewport, 'scrollHeight', { value: 200, configurable: true });
      
      // Trigger scroll
      mockViewport.dispatchEvent(new Event('scroll'));
      expect(indicator.classList.contains('visible')).toBe(false);
      
      // Mock "not at bottom"
      Object.defineProperty(mockViewport, 'scrollTop', { value: 50, configurable: true });
      mockViewport.dispatchEvent(new Event('scroll'));
      expect(indicator.classList.contains('visible')).toBe(true);
    });

    it('should scroll to bottom when clicked', () => {
      service.attach(mockTerminal, mockContainer, 't1');
      const indicator = mockContainer.querySelector('.terminal-scroll-indicator') as HTMLElement;
      
      indicator.click();
      
      expect(mockTerminal.scrollToBottom).toHaveBeenCalled();
      expect(mockViewport.scrollTop).toBe(mockViewport.scrollHeight);
    });

    it('should cleanup on dispose', () => {
      const cleanup = service.attach(mockTerminal, mockContainer, 't1');
      
      cleanup();
      
      expect(mockContainer.querySelector('.terminal-scroll-indicator')).toBeFalsy();
    });
  });
});