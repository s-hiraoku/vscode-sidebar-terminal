import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TerminalClipboardHandler,
  ITerminalClipboardHandlerDeps,
} from '../../../../../../../webview/managers/input/handlers/TerminalClipboardHandler';

describe('TerminalClipboardHandler', () => {
  let handler: TerminalClipboardHandler;
  let mockDeps: ITerminalClipboardHandlerDeps;
  let mockManager: any;
  let mockTerminal: any;

  beforeEach(() => {
    mockTerminal = {
      hasSelection: vi.fn().mockReturnValue(false),
      getSelection: vi.fn().mockReturnValue(''),
      clearSelection: vi.fn(),
      selectAll: vi.fn(),
    };

    mockManager = {
      getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
      getTerminalInstance: vi.fn().mockReturnValue({
        terminal: mockTerminal,
        id: 'terminal-1',
        searchAddon: { findNext: vi.fn(), findPrevious: vi.fn() },
      }),
      postMessageToExtension: vi.fn(),
    };

    mockDeps = {
      logger: vi.fn(),
      terminalOperationsService: {
        clearTerminal: vi.fn(),
        deleteWordLeft: vi.fn(),
        deleteWordRight: vi.fn(),
        moveToLineStart: vi.fn(),
        moveToLineEnd: vi.fn(),
        sizeToContent: vi.fn(),
      } as any,
    };

    handler = new TerminalClipboardHandler(mockDeps);
  });

  describe('handleTerminalCopy', () => {
    it('should do nothing when no active terminal', () => {
      mockManager.getActiveTerminalId.mockReturnValue(null);
      handler.handleTerminalCopy(mockManager);
      expect(mockManager.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should do nothing when no terminal instance', () => {
      mockManager.getTerminalInstance.mockReturnValue(null);
      handler.handleTerminalCopy(mockManager);
      expect(mockManager.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should do nothing when no selection', () => {
      mockTerminal.hasSelection.mockReturnValue(false);
      handler.handleTerminalCopy(mockManager);
      expect(mockManager.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should copy selection and send to extension', () => {
      mockTerminal.hasSelection.mockReturnValue(true);
      mockTerminal.getSelection.mockReturnValue('selected text');

      handler.handleTerminalCopy(mockManager);

      expect(mockManager.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'copyToClipboard',
          terminalId: 'terminal-1',
          text: 'selected text',
        })
      );
      expect(mockTerminal.clearSelection).toHaveBeenCalled();
    });
  });

  describe('handleTerminalPaste', () => {
    it('should do nothing when no active terminal', () => {
      mockManager.getActiveTerminalId.mockReturnValue(null);
      handler.handleTerminalPaste(mockManager);
      expect(mockManager.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should request clipboard content from extension', () => {
      handler.handleTerminalPaste(mockManager);

      expect(mockManager.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'requestClipboardContent',
          terminalId: 'terminal-1',
        })
      );
    });
  });

  describe('handleTerminalSelectAll', () => {
    it('should do nothing when no active terminal', () => {
      mockManager.getActiveTerminalId.mockReturnValue(null);
      handler.handleTerminalSelectAll(mockManager);
      expect(mockTerminal.selectAll).not.toHaveBeenCalled();
    });

    it('should select all text in terminal', () => {
      handler.handleTerminalSelectAll(mockManager);
      expect(mockTerminal.selectAll).toHaveBeenCalled();
    });
  });

  describe('handleTerminalFind', () => {
    it('should do nothing when no active terminal', () => {
      mockManager.getActiveTerminalId.mockReturnValue(null);
      handler.handleTerminalFind(mockManager);
      // No error thrown
    });

    it('should do nothing when no search addon', () => {
      mockManager.getTerminalInstance.mockReturnValue({
        terminal: mockTerminal,
        searchAddon: null,
      });
      handler.handleTerminalFind(mockManager);
      // No error thrown
    });
  });

  describe('handleTerminalFindNext', () => {
    it('should call findNext on search addon', () => {
      const mockSearchAddon = { findNext: vi.fn(), findPrevious: vi.fn() };
      mockManager.getTerminalInstance.mockReturnValue({
        terminal: mockTerminal,
        searchAddon: mockSearchAddon,
      });

      handler.handleTerminalFindNext(mockManager);
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith('', { incremental: false });
    });

    it('should do nothing when no active terminal', () => {
      mockManager.getActiveTerminalId.mockReturnValue(null);
      handler.handleTerminalFindNext(mockManager);
      // No error
    });
  });

  describe('handleTerminalFindPrevious', () => {
    it('should call findPrevious on search addon', () => {
      const mockSearchAddon = { findNext: vi.fn(), findPrevious: vi.fn() };
      mockManager.getTerminalInstance.mockReturnValue({
        terminal: mockTerminal,
        searchAddon: mockSearchAddon,
      });

      handler.handleTerminalFindPrevious(mockManager);
      expect(mockSearchAddon.findPrevious).toHaveBeenCalledWith('', { incremental: false });
    });
  });

  describe('handleTerminalHideFind', () => {
    it('should log and not throw', () => {
      handler.handleTerminalHideFind(mockManager);
      expect(mockDeps.logger).toHaveBeenCalledWith('Hide terminal find requested');
    });
  });

  describe('handleTerminalClear', () => {
    it('should delegate to terminal operations service', () => {
      handler.handleTerminalClear(mockManager);
      expect(mockDeps.terminalOperationsService.clearTerminal).toHaveBeenCalledWith(mockManager);
    });
  });

  describe('Word deletion operations', () => {
    it('should delegate deleteWordLeft', () => {
      handler.handleTerminalDeleteWordLeft(mockManager);
      expect(mockDeps.terminalOperationsService.deleteWordLeft).toHaveBeenCalledWith(mockManager);
    });

    it('should delegate deleteWordRight', () => {
      handler.handleTerminalDeleteWordRight(mockManager);
      expect(mockDeps.terminalOperationsService.deleteWordRight).toHaveBeenCalledWith(mockManager);
    });
  });

  describe('Line movement operations', () => {
    it('should delegate moveToLineStart', () => {
      handler.handleTerminalMoveToLineStart(mockManager);
      expect(mockDeps.terminalOperationsService.moveToLineStart).toHaveBeenCalledWith(mockManager);
    });

    it('should delegate moveToLineEnd', () => {
      handler.handleTerminalMoveToLineEnd(mockManager);
      expect(mockDeps.terminalOperationsService.moveToLineEnd).toHaveBeenCalledWith(mockManager);
    });
  });

  describe('Size to content', () => {
    it('should delegate sizeToContent', () => {
      handler.handleTerminalSizeToContent(mockManager);
      expect(mockDeps.terminalOperationsService.sizeToContent).toHaveBeenCalledWith(mockManager);
    });
  });
});
