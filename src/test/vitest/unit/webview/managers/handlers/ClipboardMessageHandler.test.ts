import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClipboardMessageHandler } from '../../../../../../webview/managers/handlers/ClipboardMessageHandler';
import type { IManagerCoordinator, TerminalInstance } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';
import type { MessageCommand } from '../../../../../../webview/managers/messageTypes';

describe('ClipboardMessageHandler', () => {
  let handler: ClipboardMessageHandler;
  let mockCoordinator: IManagerCoordinator;
  let mockLogger: ManagerLogger;
  let mockTerminal: { paste: ReturnType<typeof vi.fn> };
  let mockTerminalInstance: TerminalInstance;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as ManagerLogger;

    mockTerminal = {
      paste: vi.fn(),
    };

    mockTerminalInstance = {
      terminal: mockTerminal as any,
    } as TerminalInstance;

    mockCoordinator = {
      getTerminalInstance: vi.fn(),
      getActiveTerminalId: vi.fn(),
    } as unknown as IManagerCoordinator;

    // Spy on console.log to suppress noise or verify debugging output
    vi.spyOn(console, 'log').mockImplementation(() => {});

    handler = new ClipboardMessageHandler(mockLogger);
  });

  describe('handleMessage', () => {
    it('should handle clipboardContent command', () => {
      const msg: MessageCommand & { terminalId?: string; text?: string } = {
        command: 'clipboardContent',
        terminalId: 'term-1',
        text: 'paste me',
      };

      (mockCoordinator.getTerminalInstance as any).mockReturnValue(mockTerminalInstance);

      handler.handleMessage(msg, mockCoordinator);

      expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('term-1');
      expect(mockTerminal.paste).toHaveBeenCalledWith('paste me');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Pasting'));
    });

    it('should warn on unknown command', () => {
      const msg: MessageCommand = { command: 'unknown' };
      handler.handleMessage(msg, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown clipboard command'));
    });
  });

  describe('handleClipboardContent', () => {
    it('should ignore message with missing terminalId', () => {
      const msg: MessageCommand & { text?: string } = {
        command: 'clipboardContent',
        text: 'paste me',
      };
      
      handler.handleMessage(msg, mockCoordinator);
      
      expect(mockCoordinator.getTerminalInstance).not.toHaveBeenCalled();
      expect(mockTerminal.paste).not.toHaveBeenCalled();
    });

    it('should ignore message with missing text', () => {
      const msg: MessageCommand & { terminalId?: string } = {
        command: 'clipboardContent',
        terminalId: 'term-1',
      };
      
      handler.handleMessage(msg, mockCoordinator);
      
      expect(mockCoordinator.getTerminalInstance).not.toHaveBeenCalled();
      expect(mockTerminal.paste).not.toHaveBeenCalled();
    });

    it('should warn if terminal instance not found', () => {
      const msg: MessageCommand & { terminalId?: string; text?: string } = {
        command: 'clipboardContent',
        terminalId: 'term-1',
        text: 'paste me',
      };

      (mockCoordinator.getTerminalInstance as any).mockReturnValue(undefined);
      (mockCoordinator.getActiveTerminalId as any).mockReturnValue('term-2');

      handler.handleMessage(msg, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Terminal term-1 not found'));
      expect(mockTerminal.paste).not.toHaveBeenCalled();
    });
  });
});
