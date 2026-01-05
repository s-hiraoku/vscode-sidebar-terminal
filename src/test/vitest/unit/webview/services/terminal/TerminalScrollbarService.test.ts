/**
 * TerminalScrollbarService Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TerminalScrollbarService } from '../../../../../../webview/services/terminal/TerminalScrollbarService';
import { terminalLogger } from '../../../../../../webview/utils/ManagerLogger';

// Mock logger
vi.mock('../../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TerminalScrollbarService', () => {
  let service: TerminalScrollbarService;

  beforeEach(() => {
    service = new TerminalScrollbarService();
    // Reset singleton state
    (TerminalScrollbarService as any).stylesInjected = false;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('enableScrollbarDisplay', () => {
    it('should apply styles to viewport and screen', () => {
      const container = document.createElement('div');
      const viewport = document.createElement('div');
      viewport.className = 'xterm-viewport';
      const screen = document.createElement('div');
      screen.className = 'xterm-screen';
      
      container.appendChild(viewport);
      container.appendChild(screen);
      
      service.enableScrollbarDisplay(container, 't1');
      
      expect(viewport.style.position).toBe('absolute');
      expect(viewport.style.overflow).toBe('auto');
      expect(screen.style.position).toBe('relative');
      expect(screen.style.width).toBe('100%');
    });

    it('should inject styles into head only once', () => {
      const container = document.createElement('div');
      const viewport = document.createElement('div');
      viewport.className = 'xterm-viewport';
      container.appendChild(viewport);

      service.enableScrollbarDisplay(container, 't1');
      service.enableScrollbarDisplay(container, 't2');
      
      const styleElements = document.head.querySelectorAll('style#terminal-scrollbar-styles');
      expect(styleElements.length).toBe(1);
    });

    it('should warn if viewport is missing', () => {
      const container = document.createElement('div');
      
      service.enableScrollbarDisplay(container, 't1');
      
      expect(terminalLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Viewport not found'));
    });
  });
});
