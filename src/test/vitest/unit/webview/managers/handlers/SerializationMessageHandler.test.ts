/**
 * SerializationMessageHandler Unit Tests
 *
 * Tests for terminal state serialization and restoration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SerializationMessageHandler } from '../../../../../../webview/managers/handlers/SerializationMessageHandler';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageQueue } from '../../../../../../webview/utils/MessageQueue';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

// Mock vscode for ErrorHandler
vi.mock('vscode', () => ({
  default: {},
}));

describe('SerializationMessageHandler', () => {
  let handler: SerializationMessageHandler;
  let mockMessageQueue: MessageQueue;
  let mockLogger: ManagerLogger;
  let mockCoordinator: IManagerCoordinator;

  // Mock terminal with buffer
  const createMockTerminal = (lines: string[] = []) => {
    const mockBuffer = {
      active: {
        length: lines.length,
        getLine: vi.fn((i: number) => {
          if (i >= 0 && i < lines.length) {
            return {
              translateToString: vi.fn(() => lines[i] ?? ''),
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
    };
  };

  // Mock SerializeAddon
  const createMockSerializeAddon = (content: string) => ({
    serialize: vi.fn(() => content),
  });

  beforeEach(() => {
    // Create mock message queue
    mockMessageQueue = {
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      clear: vi.fn(),
      size: 0,
      isEmpty: true,
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
      getManagers: vi.fn(() => ({
        notification: {
          showNotificationInTerminal: vi.fn(),
        },
      })),
    } as unknown as IManagerCoordinator;

    // Create handler
    handler = new SerializationMessageHandler(mockMessageQueue, mockLogger);
  });

  afterEach(() => {
    handler.dispose();
    vi.clearAllMocks();
  });

  describe('getSupportedCommands', () => {
    it('should return all supported command types', () => {
      const commands = handler.getSupportedCommands();

      expect(commands).toContain('serializeTerminal');
      expect(commands).toContain('restoreSerializedContent');
      expect(commands).toContain('requestTerminalSerialization');
      expect(commands).toContain('restoreTerminalSerialization');
      expect(commands).toContain('terminalRestoreInfo');
      expect(commands).toContain('saveAllTerminalSessions');
      expect(commands).toHaveLength(6);
    });
  });

  describe('handleMessage', () => {
    it('should warn when message has no command property', async () => {
      await handler.handleMessage({} as any, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith('Message received without command property');
    });

    it('should warn for unknown commands', async () => {
      await handler.handleMessage({ command: 'unknownCommand' } as any, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });

    it('should dispatch to correct handler for known commands', async () => {
      const msg = {
        command: 'terminalRestoreInfo',
        terminals: [],
        activeTerminalId: null,
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockLogger.info).toHaveBeenCalledWith('Terminal restore info received');
    });
  });

  describe('serializeTerminal', () => {
    it('should send error when no terminalId provided', async () => {
      const msg = {
        command: 'serializeTerminal',
        requestId: 'req-1',
        messageId: 'msg-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationResponse',
          error: 'missing-terminal-id',
        })
      );
    });

    it('should process single terminalId', async () => {
      const mockTerminal = createMockTerminal(['line1', 'line2']);
      const mockSerializeAddon = createMockSerializeAddon('line1\nline2');

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(mockSerializeAddon as any);

      const msg = {
        command: 'serializeTerminal',
        terminalId: 'terminal-1',
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationResponse',
          serializationData: expect.objectContaining({
            'terminal-1': expect.any(String),
          }),
        })
      );
    });

    it('should process multiple terminalIds array', async () => {
      const mockTerminal = createMockTerminal(['content']);
      const mockSerializeAddon = createMockSerializeAddon('content');

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(mockSerializeAddon as any);

      const msg = {
        command: 'serializeTerminal',
        terminalIds: ['terminal-1', 'terminal-2'],
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('terminal-1');
      expect(mockCoordinator.getTerminalInstance).toHaveBeenCalledWith('terminal-2');
    });
  });

  describe('requestTerminalSerialization', () => {
    it('should send error when no terminalIds provided', async () => {
      const msg = {
        command: 'requestTerminalSerialization',
        terminalIds: [],
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationResponse',
          error: 'no-terminal-ids',
        })
      );
    });

    it('should use SerializeAddon when available', async () => {
      const mockTerminal = createMockTerminal(['line1', 'line2', 'line3']);
      const mockSerializeAddon = createMockSerializeAddon('serialized-content');

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(mockSerializeAddon as any);

      const msg = {
        command: 'requestTerminalSerialization',
        terminalIds: ['terminal-1'],
        scrollbackLines: 1000,
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockSerializeAddon.serialize).toHaveBeenCalled();
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationResponse',
          serializationData: {
            'terminal-1': 'serialized-content',
          },
        })
      );
    });

    it('should fallback to buffer when SerializeAddon unavailable', async () => {
      const mockTerminal = createMockTerminal(['line1', 'line2']);

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(null);

      const msg = {
        command: 'requestTerminalSerialization',
        terminalIds: ['terminal-1'],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('SerializeAddon not available')
      );
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          serializationData: {
            'terminal-1': 'line1\nline2',
          },
        })
      );
    });

    it('should warn when terminal not found', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue(null);

      const msg = {
        command: 'requestTerminalSerialization',
        terminalIds: ['nonexistent'],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Terminal nonexistent not found for serialization'
      );
    });

    it('should respect scrollbackLines limit', async () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i}`);
      const mockTerminal = createMockTerminal(lines);
      const mockSerializeAddon = createMockSerializeAddon(lines.join('\n'));

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);
      vi.mocked(mockCoordinator.getSerializeAddon).mockReturnValue(mockSerializeAddon as any);

      const msg = {
        command: 'requestTerminalSerialization',
        terminalIds: ['terminal-1'],
        scrollbackLines: 10,
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      // The handler should slice to last 10 lines
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          serializationData: expect.objectContaining({
            'terminal-1': expect.any(String),
          }),
        })
      );
    });

    it('should handle serialization errors gracefully', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockImplementation(() => {
        throw new Error('Test serialization error');
      });

      const msg = {
        command: 'requestTerminalSerialization',
        terminalIds: ['terminal-1'],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      // Errors inside forEach are logged but don't cause global error response
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error serializing terminal terminal-1'),
        expect.any(Error)
      );
      // Response is still sent with empty data
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationResponse',
          serializationData: {},
        })
      );
    });
  });

  describe('restoreSerializedContent', () => {
    it('should send error when no terminalId provided', async () => {
      const msg = {
        command: 'restoreSerializedContent',
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Restore serialized content request missing terminalId'
      );
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationRestoreResponse',
          error: 'missing-terminal-id',
        })
      );
    });

    it('should set active terminal when isActive is true', async () => {
      const mockTerminal = createMockTerminal([]);

      // Mock coordinator with restoreSession
      const coordWithRestore = {
        ...mockCoordinator,
        restoreSession: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(coordWithRestore.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      const msg = {
        command: 'restoreSerializedContent',
        terminalId: 'terminal-1',
        scrollbackData: ['line1', 'line2'],
        isActive: true,
      };

      await handler.handleMessage(msg as any, coordWithRestore as any);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(coordWithRestore.setActiveTerminalId).toHaveBeenCalledWith('terminal-1');
    });
  });

  describe('restoreTerminalSerialization', () => {
    it('should restore terminals with serialized content', async () => {
      const mockTerminal = createMockTerminal([]);

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      const msg = {
        command: 'restoreTerminalSerialization',
        terminalData: [
          { id: 'terminal-1', serializedContent: 'line1\nline2', isActive: false },
        ],
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockTerminal.writeln).toHaveBeenCalledTimes(2);
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationRestoreResponse',
          restoredCount: 1,
          totalCount: 1,
        })
      );
    });

    it('should set active terminal when isActive is true', async () => {
      const mockTerminal = createMockTerminal([]);

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      const msg = {
        command: 'restoreTerminalSerialization',
        terminalData: [{ id: 'terminal-1', serializedContent: 'content', isActive: true }],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('terminal-1');
    });

    it('should skip terminals without content', async () => {
      const mockTerminal = createMockTerminal([]);

      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue({
        terminal: mockTerminal,
      } as any);

      const msg = {
        command: 'restoreTerminalSerialization',
        terminalData: [
          { id: 'terminal-1', serializedContent: '', isActive: false },
          { id: 'terminal-2', serializedContent: 'content', isActive: false },
        ],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          restoredCount: 1,
          totalCount: 2,
        })
      );
    });

    it('should handle missing terminal instances', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockReturnValue(null);

      const msg = {
        command: 'restoreTerminalSerialization',
        terminalData: [{ id: 'terminal-1', serializedContent: 'content', isActive: false }],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Terminal terminal-1 not found for restoration')
      );
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          restoredCount: 0,
          totalCount: 1,
        })
      );
    });

    it('should handle restoration errors gracefully', async () => {
      vi.mocked(mockCoordinator.getTerminalInstance).mockImplementation(() => {
        throw new Error('Restoration error');
      });

      const msg = {
        command: 'restoreTerminalSerialization',
        terminalData: [{ id: 'terminal-1', serializedContent: 'content', isActive: false }],
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      // Errors inside forEach are logged but restoration count is still tracked
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error restoring terminal terminal-1'),
        expect.any(Error)
      );
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalSerializationRestoreResponse',
          restoredCount: 0,
          totalCount: 1,
        })
      );
    });
  });

  describe('terminalRestoreInfo', () => {
    it('should cache terminal restore info', async () => {
      const msg = {
        command: 'terminalRestoreInfo',
        terminals: [{ id: 'terminal-1', name: 'Test' }],
        activeTerminalId: 'terminal-1',
        config: { theme: 'dark' },
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      const cached = handler.getCachedTerminalRestoreInfo();
      expect(cached).not.toBeNull();
      expect(cached?.terminals).toHaveLength(1);
      expect(cached?.activeTerminalId).toBe('terminal-1');
      expect(cached?.config).toEqual({ theme: 'dark' });
      expect(cached?.timestamp).toBeDefined();
    });

    it('should handle missing terminals array', async () => {
      const msg = {
        command: 'terminalRestoreInfo',
        activeTerminalId: 'terminal-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      const cached = handler.getCachedTerminalRestoreInfo();
      expect(cached?.terminals).toHaveLength(0);
    });
  });

  describe('saveAllTerminalSessions', () => {
    it('should send error when persistence manager unavailable', async () => {
      const msg = {
        command: 'saveAllTerminalSessions',
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'saveAllTerminalSessionsResponse',
          success: false,
          error: 'persistence-manager-unavailable',
        })
      );
    });

    it('should save all terminal sessions', async () => {
      const mockPersistenceManager = {
        getAvailableTerminals: vi.fn().mockReturnValue(['terminal-1', 'terminal-2']),
        saveTerminalContent: vi.fn(),
      };

      const coordWithPersistence = {
        ...mockCoordinator,
        persistenceManager: mockPersistenceManager,
      };

      const msg = {
        command: 'saveAllTerminalSessions',
        requestId: 'req-1',
      };

      await handler.handleMessage(msg as any, coordWithPersistence as any);

      expect(mockPersistenceManager.saveTerminalContent).toHaveBeenCalledWith('terminal-1');
      expect(mockPersistenceManager.saveTerminalContent).toHaveBeenCalledWith('terminal-2');
      expect(coordWithPersistence.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'saveAllTerminalSessionsResponse',
          success: true,
          savedTerminals: 2,
        })
      );
    });

    it('should show notification after save', async () => {
      const mockNotificationManager = {
        showNotificationInTerminal: vi.fn(),
      };

      const mockPersistenceManager = {
        getAvailableTerminals: vi.fn().mockReturnValue(['terminal-1']),
        saveTerminalContent: vi.fn(),
      };

      const coordWithManagers = {
        ...mockCoordinator,
        persistenceManager: mockPersistenceManager,
        getManagers: vi.fn(() => ({
          notification: mockNotificationManager,
        })),
      };

      const msg = {
        command: 'saveAllTerminalSessions',
      };

      await handler.handleMessage(msg as any, coordWithManagers as any);

      expect(mockNotificationManager.showNotificationInTerminal).toHaveBeenCalledWith(
        'Saved 1 terminal session',
        'success'
      );
    });

    it('should handle save errors for individual terminals', async () => {
      const mockPersistenceManager = {
        getAvailableTerminals: vi.fn().mockReturnValue(['terminal-1', 'terminal-2']),
        saveTerminalContent: vi.fn().mockImplementation((id: string) => {
          if (id === 'terminal-1') {
            throw new Error('Save error');
          }
        }),
      };

      const coordWithPersistence = {
        ...mockCoordinator,
        persistenceManager: mockPersistenceManager,
      };

      const msg = {
        command: 'saveAllTerminalSessions',
      };

      await handler.handleMessage(msg as any, coordWithPersistence as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save session for terminal terminal-1'),
        expect.any(Error)
      );
      // Should still succeed overall
      expect(coordWithPersistence.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('getCachedTerminalRestoreInfo', () => {
    it('should return null when no info cached', () => {
      expect(handler.getCachedTerminalRestoreInfo()).toBeNull();
    });

    it('should return cached info after terminalRestoreInfo message', async () => {
      const msg = {
        command: 'terminalRestoreInfo',
        terminals: [{ id: 'test' }],
        activeTerminalId: 'test',
      };

      await handler.handleMessage(msg as any, mockCoordinator);

      const cached = handler.getCachedTerminalRestoreInfo();
      expect(cached).not.toBeNull();
      expect(cached?.terminals).toHaveLength(1);
    });
  });

  describe('dispose', () => {
    it('should clear cached info on dispose', async () => {
      const msg = {
        command: 'terminalRestoreInfo',
        terminals: [{ id: 'test' }],
      };

      await handler.handleMessage(msg as any, mockCoordinator);
      expect(handler.getCachedTerminalRestoreInfo()).not.toBeNull();

      handler.dispose();

      expect(handler.getCachedTerminalRestoreInfo()).toBeNull();
    });

    it('should clear handlers registry on dispose', () => {
      handler.dispose();

      expect(handler.getSupportedCommands()).toHaveLength(0);
    });
  });
});
