/**
 * TerminalFocusService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalFocusService } from '../../../../../../webview/services/terminal/TerminalFocusService';
import { setupCompleteTestEnvironment } from '../../../../../shared/TestSetup';

// Mock logger
vi.mock('../../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TerminalFocusService', () => {
  let service: TerminalFocusService;
  let mockTerminal: any;
  let mockContainer: HTMLElement;
  let mockTextarea: HTMLTextAreaElement;
  let testEnv: ReturnType<typeof setupCompleteTestEnvironment>;

  beforeEach(() => {
    testEnv = setupCompleteTestEnvironment();
    vi.useFakeTimers();
    service = new TerminalFocusService();
    
    mockTerminal = {
      focus: vi.fn(),
    };
    
    mockContainer = document.createElement('div');
    mockTextarea = document.createElement('textarea');
    mockTextarea.className = 'xterm-helper-textarea';
    mockContainer.appendChild(mockTextarea);
    
    // Stub requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (cb: any) => cb());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('ensureTerminalFocus', () => {
    it('should focus terminal and textarea immediately if available', () => {
      service.ensureTerminalFocus(mockTerminal, 't1', mockContainer);
      
      expect(mockTerminal.focus).toHaveBeenCalled();
      // focusTerminalTextarea has a 10ms verification timeout
      vi.advanceTimersByTime(10);
    });

    it('should retry if textarea is missing', () => {
      const emptyContainer = document.createElement('div');
      service.ensureTerminalFocus(mockTerminal, 't1', emptyContainer);
      
      expect(mockTerminal.focus).not.toHaveBeenCalled();
      
      // Add textarea after call
      emptyContainer.appendChild(mockTextarea);
      
      // Advance by retry delay (50ms)
      vi.advanceTimersByTime(50);
      
      expect(mockTerminal.focus).toHaveBeenCalled();
    });
  });

  describe('setupContainerFocusHandler', () => {
    it('should register click listener on container', () => {
      const spy = vi.spyOn(mockContainer, 'addEventListener');
      service.setupContainerFocusHandler(mockTerminal, 't1', mockContainer, mockContainer);
      
      expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
      
      // Trigger click
      mockContainer.click();
      expect(mockTerminal.focus).toHaveBeenCalled();
    });

    it('should ignore clicks on buttons', () => {
      service.setupContainerFocusHandler(mockTerminal, 't1', mockContainer, mockContainer);
      
      const btn = document.createElement('button');
      btn.className = 'terminal-control';
      mockContainer.appendChild(btn);
      
      btn.click();
      expect(mockTerminal.focus).not.toHaveBeenCalled();
    });

    it('should ignore clicks inside terminal header area', () => {
      service.setupContainerFocusHandler(mockTerminal, 't1', mockContainer, mockContainer);

      const header = document.createElement('div');
      header.className = 'terminal-header';
      const name = document.createElement('span');
      name.className = 'terminal-name';
      header.appendChild(name);
      mockContainer.appendChild(header);

      name.click();
      expect(mockTerminal.focus).not.toHaveBeenCalled();
    });
  });
});
