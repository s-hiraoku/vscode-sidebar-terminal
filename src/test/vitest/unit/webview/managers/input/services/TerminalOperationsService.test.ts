import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalOperationsService } from '../../../../../../../webview/managers/input/services/TerminalOperationsService';

describe('TerminalOperationsService', () => {
  let service: TerminalOperationsService;
  let mockLogger: any;
  let mockEmit: any;
  let mockManager: any;
  let mockTerminal: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockLogger = vi.fn();
    mockEmit = vi.fn();
    
    service = new TerminalOperationsService(mockLogger, mockEmit);

    mockTerminal = {
      scrollLines: vi.fn(),
      scrollToTop: vi.fn(),
      scrollToBottom: vi.fn(),
      clear: vi.fn(),
      getSelection: vi.fn().mockReturnValue('selected text'),
      selectAll: vi.fn(),
      rows: 24,
    };

    mockManager = {
      getActiveTerminalId: vi.fn().mockReturnValue('term-1'),
      getTerminalInstance: vi.fn().mockReturnValue({
        terminal: mockTerminal
      }),
    };
  });

  describe('scrollTerminal', () => {
    it('should scroll up', () => {
      service.scrollTerminal('up', mockManager);
      expect(mockTerminal.scrollLines).toHaveBeenCalledWith(-1);
    });

    it('should scroll down', () => {
      service.scrollTerminal('down', mockManager);
      expect(mockTerminal.scrollLines).toHaveBeenCalledWith(1);
    });

    it('should scroll to top', () => {
      service.scrollTerminal('top', mockManager);
      expect(mockTerminal.scrollToTop).toHaveBeenCalled();
    });

    it('should scroll to bottom', () => {
      service.scrollTerminal('bottom', mockManager);
      expect(mockTerminal.scrollToBottom).toHaveBeenCalled();
    });

    it('should handle missing active terminal', () => {
      mockManager.getActiveTerminalId.mockReturnValue(null);
      service.scrollTerminal('up', mockManager);
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('No active terminal'));
    });
  });

  describe('clearTerminal', () => {
    it('should call terminal.clear', () => {
      service.clearTerminal(mockManager);
      expect(mockTerminal.clear).toHaveBeenCalled();
    });
  });

  describe('copySelection', () => {
    it('should emit copy-selection event if text is selected', () => {
      service.copySelection(mockManager);
      expect(mockEmit).toHaveBeenCalledWith(
        'copy-selection',
        'term-1',
        { text: 'selected text' },
        mockManager
      );
    });

    it('should log if no selection', () => {
      mockTerminal.getSelection.mockReturnValue('');
      service.copySelection(mockManager);
      expect(mockLogger).toHaveBeenCalledWith('No selection to copy');
    });
  });

  describe('paste', () => {
    it('should emit paste-request event', () => {
      service.paste(mockManager);
      expect(mockEmit).toHaveBeenCalledWith(
        'paste-request',
        'term-1',
        {},
        mockManager
      );
    });
  });

  describe('selectAll', () => {
    it('should call terminal.selectAll', () => {
      service.selectAll(mockManager);
      expect(mockTerminal.selectAll).toHaveBeenCalled();
    });
  });

  describe('Find operations', () => {
    it('focusFind should emit event', () => {
      service.focusFind(mockManager);
      expect(mockEmit).toHaveBeenCalledWith('focus-find', 'term-1', {}, mockManager);
    });

    it('findNext should emit event', () => {
      service.findNext(mockManager);
      expect(mockEmit).toHaveBeenCalledWith('find-next', 'term-1', {}, mockManager);
    });

    it('findPrevious should emit event', () => {
      service.findPrevious(mockManager);
      expect(mockEmit).toHaveBeenCalledWith('find-previous', 'term-1', {}, mockManager);
    });

    it('hideFind should emit event', () => {
      service.hideFind(mockManager);
      expect(mockEmit).toHaveBeenCalledWith('hide-find', 'term-1', {}, mockManager);
    });
  });

  describe('Navigation/Deletion operations', () => {
    it('deleteWordLeft should emit input event with Ctrl+W', () => {
      service.deleteWordLeft(mockManager);
      expect(mockEmit).toHaveBeenCalledWith(
        'input',
        'term-1',
        { data: '\x17' },
        mockManager
      );
    });

    it('moveToLineStart should emit input event with Ctrl+A', () => {
      service.moveToLineStart(mockManager);
      expect(mockEmit).toHaveBeenCalledWith(
        'input',
        'term-1',
        { data: '\x01' },
        mockManager
      );
    });
  });
});
