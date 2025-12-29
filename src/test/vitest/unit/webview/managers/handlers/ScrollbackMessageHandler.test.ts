/**
 * ScrollbackMessageHandler Unit Tests
 *
 * Tests for scrollback extraction, restoration, and progress tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScrollbackMessageHandler, ScrollbackLine } from '../../../../../../webview/managers/handlers/ScrollbackMessageHandler';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageQueue } from '../../../../../../webview/utils/MessageQueue';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

// Mock dependencies
vi.mock('../../../../../../webview/services/TerminalCreationService', () => ({
  TerminalCreationService: {
    markTerminalRestoring: vi.fn(),
    markTerminalRestored: vi.fn(),
  },
}));

describe('ScrollbackMessageHandler', () => {
  let handler: ScrollbackMessageHandler;
  let mockMessageQueue: MessageQueue;
  let mockLogger: ManagerLogger;
  let mockCoordinator: IManagerCoordinator;

  // Mock terminal with buffer
  const createMockTerminal = (lines: string[] = []) => {
    const mockBuffer = {
      active: {
        length: lines.length,
        viewportY: 0,
        baseY: 0,
        getLine: vi.fn((i: number) => {
          if (i >= 0 && i < lines.length) {
            return {
              translateToString: vi.fn((trim?: boolean) => (trim ? lines[i]?.trim() : lines[i]) ?? ''),
            };
          }
          return null;
        }),
      },
    };

    return {
      buffer: mockBuffer,
      write: vi.fn((data: string, callback?: () => void) => {
        if (callback) callback();
      }),
      writeln: vi.fn(),
      hasSelection: vi.fn(() => false),
      getSelection: vi.fn(() => ''),
    };
  };

  // Mock SerializeAddon
  const createMockSerializeAddon = (content: string) => ({
    serialize: vi.fn(() => content),
  });

  beforeEach(() => {
    // Create mock message queue
    mockMessageQueue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    } as unknown as MessageQueue;

    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ManagerLogger;

    // Create mock coordinator
    mockCoordinator = {
      getTerminalInstance: vi.fn(),
      getSerializeAddon: vi.fn(),
      postMessageToExtension: vi.fn(),
      getActiveTerminalId: vi.fn(() => 'terminal-1'),
      setActiveTerminalId: vi.fn(),
    } as unknown as IManagerCoordinator;

    // Create handler
    handler = new ScrollbackMessageHandler(mockMessageQueue, mockLogger);
  });

  afterEach(() => {
    handler.dispose();
    vi.clearAllMocks();
  });

  describe('getSupportedCommands', () => {
    it('should return all supported command types', () => {
      const commands = handler.getSupportedCommands();

      expect(commands).toContain('getScrollback');
      expect(commands).toContain('restoreScrollback');
      expect(commands).toContain('scrollbackProgress');
      expect(commands).toContain('extractScrollbackData');
      expect(commands).toContain('restoreTerminalSessions');
      expect(commands).toHaveLength(5);
    });
  });

  describe('handleMessage', () => {
    it('should handle getScrollback command', async () => {
      const mockTerminal = createMockTerminal(['line1', 'line2']);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        { command: 'getScrollback', terminalId: 'terminal-1', maxLines: 100 },
        mockCoordinator
      );

      expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('terminal-1');
    });

    it('should handle restoreScrollback command', async () => {
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: ['line1', 'line2'],
        },
        mockCoordinator
      );

      expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('terminal-1');
    });

    it('should handle scrollbackProgress command', async () => {
      await handler.handleMessage(
        {
          command: 'scrollbackProgress',
          scrollbackProgress: {
            terminalId: 'terminal-1',
            progress: 50,
            currentLines: 500,
            totalLines: 1000,
            stage: 'restoring',
          },
        },
        mockCoordinator
      );

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('50%'));
    });

    it('should log warning for unknown command', async () => {
      await handler.handleMessage(
        { command: 'unknownCommand' },
        mockCoordinator
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown scrollback command'));
    });
  });

  describe('getScrollback extraction', () => {
    it('should extract scrollback using SerializeAddon when available', async () => {
      const mockTerminal = createMockTerminal([]);
      const mockSerializeAddon = createMockSerializeAddon('line1\nline2\nline3');

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(mockSerializeAddon as any);

      await handler.handleMessage(
        { command: 'getScrollback', terminalId: 'terminal-1', maxLines: 1000 },
        mockCoordinator
      );

      expect(mockSerializeAddon.serialize).toHaveBeenCalled();
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'scrollbackDataCollected',
          terminalId: 'terminal-1',
        })
      );
    });

    it('should fallback to buffer extraction when SerializeAddon not available', async () => {
      const mockTerminal = createMockTerminal(['line1', 'line2']);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(undefined);

      await handler.handleMessage(
        { command: 'getScrollback', terminalId: 'terminal-1', maxLines: 1000 },
        mockCoordinator
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SerializeAddon not available')
      );
    });

    it('should handle missing terminal ID', async () => {
      await handler.handleMessage(
        { command: 'getScrollback' },
        mockCoordinator
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No terminal ID provided')
      );
    });

    it('should handle terminal not found', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue(null);

      await handler.handleMessage(
        { command: 'getScrollback', terminalId: 'non-existent' },
        mockCoordinator
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Terminal instance not found')
      );
    });

    it('should use default maxLines of 1000 when not specified', async () => {
      const mockTerminal = createMockTerminal(['line1']);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        { command: 'getScrollback', terminalId: 'terminal-1' },
        mockCoordinator
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('max 1000 lines')
      );
    });
  });

  describe('restoreScrollback', () => {
    it('should restore scrollback content to terminal', async () => {
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: ['line1', 'line2', 'line3'],
        },
        mockCoordinator
      );

      // Should use writeln for all but last line, write for last
      expect(mockTerminal.writeln).toHaveBeenCalledTimes(2);
      expect(mockTerminal.write).toHaveBeenCalledTimes(1);
    });

    it('should handle string scrollback content (legacy format)', async () => {
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: 'line1\nline2\nline3',
        },
        mockCoordinator
      );

      expect(mockTerminal.writeln).toHaveBeenCalled();
    });

    it('should handle ScrollbackLine array format', async () => {
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      const scrollbackLines: ScrollbackLine[] = [
        { content: 'line1', type: 'output' },
        { content: 'line2', type: 'input' },
        { content: 'line3', type: 'error' },
      ];

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: scrollbackLines,
        },
        mockCoordinator
      );

      expect(mockTerminal.writeln).toHaveBeenCalledTimes(2);
      expect(mockTerminal.write).toHaveBeenCalledWith('line3');
    });

    it('should prevent duplicate restoration', async () => {
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      // First restoration
      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: ['line1'],
        },
        mockCoordinator
      );

      // Reset mock call counts
      mockTerminal.write.mockClear();
      mockTerminal.writeln.mockClear();

      // Second restoration should be skipped
      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: ['line2'],
        },
        mockCoordinator
      );

      // Should not write anything on duplicate
      expect(mockTerminal.write).not.toHaveBeenCalled();
      expect(mockTerminal.writeln).not.toHaveBeenCalled();
    });

    it('should handle missing scrollback content', async () => {
      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
        },
        mockCoordinator
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Invalid scrollback restore request',
        expect.any(Object)
      );
    });

    it('should send confirmation after successful restoration', async () => {
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-1',
          scrollbackContent: ['line1', 'line2'],
        },
        mockCoordinator
      );

      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'scrollbackRestored',
          terminalId: 'terminal-1',
          restoredLines: 2,
        })
      );
    });
  });

  describe('extractScrollbackData', () => {
    it('should extract scrollback and send to extension', async () => {
      const mockTerminal = createMockTerminal(['line1', 'line2']);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
        serializeAddon: createMockSerializeAddon('line1\nline2'),
      } as any);

      await handler.handleMessage(
        {
          command: 'extractScrollbackData',
          terminalId: 'terminal-1',
          requestId: 'req-123',
          maxLines: 500,
        },
        mockCoordinator
      );

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'scrollbackDataCollected',
          terminalId: 'terminal-1',
          requestId: 'req-123',
        })
      );
    });

    it('should handle missing requestId', async () => {
      await handler.handleMessage(
        {
          command: 'extractScrollbackData',
          terminalId: 'terminal-1',
        },
        mockCoordinator
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing terminalId or requestId')
      );
    });

    it('should send empty response when terminal not found', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue(null);

      await handler.handleMessage(
        {
          command: 'extractScrollbackData',
          terminalId: 'terminal-1',
          requestId: 'req-123',
        },
        mockCoordinator
      );

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'scrollbackDataCollected',
          scrollbackData: [],
        })
      );
    });
  });

  describe('restoreTerminalSessions (batch)', () => {
    it('should restore multiple terminals', async () => {
      const mockTerminal1 = createMockTerminal([]);
      const mockTerminal2 = createMockTerminal([]);

      // Mock getTerminalInstance to return terminals for both IDs
      vi.mocked(mockCoordinator.getTerminalInstance).mockImplementation((id: string) => {
        if (id === 'terminal-1') return { terminal: mockTerminal1 } as any;
        if (id === 'terminal-2') return { terminal: mockTerminal2 } as any;
        return null;
      });

      await handler.handleMessage(
        {
          command: 'restoreTerminalSessions',
          terminals: [
            { terminalId: 'terminal-1', scrollbackData: ['line1'], restoreScrollback: true },
            { terminalId: 'terminal-2', scrollbackData: ['line2'], restoreScrollback: true },
          ],
        },
        mockCoordinator
      );

      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSessionsRestored',
          terminalsRestored: 2,
          terminalsFailed: 0,
        })
      );
    });

    it('should skip terminals without scrollback data', async () => {
      await handler.handleMessage(
        {
          command: 'restoreTerminalSessions',
          terminals: [
            { terminalId: 'terminal-1', restoreScrollback: false },
            { terminalId: 'terminal-2', scrollbackData: [], restoreScrollback: true },
          ],
        },
        mockCoordinator
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('no scrollback data')
      );
    });

    it('should handle empty terminals array', async () => {
      await handler.handleMessage(
        {
          command: 'restoreTerminalSessions',
          terminals: [],
        },
        mockCoordinator
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No terminals provided')
      );
    });

    it('should handle terminals without terminalId', async () => {
      await handler.handleMessage(
        {
          command: 'restoreTerminalSessions',
          terminals: [
            { scrollbackData: ['line1'], restoreScrollback: true },
          ],
        },
        mockCoordinator
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('missing terminalId')
      );
    });
  });

  describe('scrollbackProgress', () => {
    it('should log progress information', async () => {
      await handler.handleMessage(
        {
          command: 'scrollbackProgress',
          scrollbackProgress: {
            terminalId: 'terminal-1',
            progress: 75,
            currentLines: 750,
            totalLines: 1000,
            stage: 'loading',
          },
        },
        mockCoordinator
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('75%')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('750/1000')
      );
    });

    it('should handle missing progress information', async () => {
      await handler.handleMessage(
        { command: 'scrollbackProgress' },
        mockCoordinator
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('No progress information provided')
      );
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      // Create and use handler
      const testHandler = new ScrollbackMessageHandler(mockMessageQueue, mockLogger);

      // Dispose should not throw
      expect(() => testHandler.dispose()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle extraction errors gracefully', async () => {
      // When getLine throws, the error is caught and logged, but still sends scrollbackDataCollected with empty data
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: {
          buffer: {
            active: {
              length: 1,
              viewportY: 0,
              baseY: 0,
              getLine: vi.fn(() => {
                throw new Error('Buffer access error');
              }),
            },
          },
          write: vi.fn((_, cb) => cb?.()),
        },
      } as any);

      await handler.handleMessage(
        { command: 'getScrollback', terminalId: 'terminal-1' },
        mockCoordinator
      );

      // The error is caught inside extractScrollbackFromXterm and re-thrown,
      // then caught in handleGetScrollback which sends error message
      expect(mockMessageQueue.enqueue).toHaveBeenCalled();
      // Check that the error was logged
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle restoration errors and still mark as restored', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue(null);

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-error',
          scrollbackContent: ['line1'],
        },
        mockCoordinator
      );

      // Should send error message
      expect(mockMessageQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'error',
        })
      );

      // Subsequent restoration should be skipped (marked as restored even on error)
      const mockTerminal = createMockTerminal([]);
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      await handler.handleMessage(
        {
          command: 'restoreScrollback',
          terminalId: 'terminal-error',
          scrollbackContent: ['line2'],
        },
        mockCoordinator
      );

      // Should not attempt to write (skipped as already "restored")
      expect(mockTerminal.write).not.toHaveBeenCalled();
    });
  });
});
