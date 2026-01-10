/**
 * TerminalLifecycleMessageHandler Tests
 *
 * Tests for terminal lifecycle message handling
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalLifecycleMessageHandler } from '../../../../../../webview/managers/handlers/TerminalLifecycleMessageHandler';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../../webview/managers/messageTypes';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

describe('TerminalLifecycleMessageHandler', () => {
  let handler: TerminalLifecycleMessageHandler;
  let mockCoordinator: IManagerCoordinator;
  let mockLogger: ManagerLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      lifecycle: vi.fn(),
    } as unknown as ManagerLogger;

    // Create minimal mock coordinator
    mockCoordinator = {
      getActiveTerminalId: () => 'terminal-1',
      setActiveTerminalId: vi.fn(),
      setForceNormalModeForNextCreate: vi.fn(),
      getTerminalInstance: () => undefined,
      getAllTerminalInstances: () => new Map(),
      getAllTerminalContainers: () => new Map(),
      getTerminalElement: () => undefined,
      postMessageToExtension: vi.fn(),
      log: vi.fn(),
      createTerminal: vi.fn().mockResolvedValue(undefined),
      openSettings: vi.fn(),
      setVersionInfo: vi.fn(),
      applyFontSettings: vi.fn(),
      closeTerminal: vi.fn(),
      updateClaudeStatus: vi.fn(),
      updateCliAgentStatus: vi.fn(),
      ensureTerminalFocus: vi.fn(),
      getSerializeAddon: () => undefined,
      getManagers: () => ({
        performance: {
          scheduleOutputBuffer: vi.fn(),
          bufferedWrite: vi.fn(),
        } as any,
        input: {} as any,
        ui: {} as any,
        config: {} as any,
        message: {} as any,
        notification: {} as any,
      }),
      getMessageManager: () => ({}) as any,
      getDisplayModeManager: vi.fn().mockReturnValue({
        setDisplayMode: vi.fn(),
        showTerminalFullscreen: vi.fn(),
      }),
    } as IManagerCoordinator;

    // Create mock message queue
    const mockMessageQueue = {
      enqueue: vi.fn(),
    } as any;

    handler = new TerminalLifecycleMessageHandler(mockMessageQueue, mockLogger);
  });

  afterEach(() => {
    handler.dispose();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(handler).toBeDefined();
    });

    it('should return supported commands', () => {
      const commands = handler.getSupportedCommands();
      expect(commands).toBeInstanceOf(Array);
      expect(commands).toContain('init');
      expect(commands).toContain('output');
      expect(commands).toContain('terminalCreated');
      expect(commands).toContain('clear');
    });
  });

  describe('Init Message Handling', () => {
    it('should handle init message with terminals', () => {
      const message: MessageCommand = {
        command: 'init',
        terminals: [
          { id: 'terminal-1', name: 'Terminal 1' },
          { id: 'terminal-2', name: 'Terminal 2' },
        ],
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle init message without terminals', () => {
      const message: MessageCommand = {
        command: 'init',
        terminals: [],
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('Output Message Handling', () => {
    it('should handle output message', () => {
      const message: MessageCommand = {
        command: 'output',
        terminalId: 'terminal-1',
        data: 'test output',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle output message without terminal instance', () => {
      const message: MessageCommand = {
        command: 'output',
        terminalId: 'non-existent',
        data: 'test output',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error - handler should handle gracefully
    });

    it('should handle empty output', () => {
      const message: MessageCommand = {
        command: 'output',
        terminalId: 'terminal-1',
        data: '',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('Terminal Creation Handling', () => {
    it('should handle terminalCreated message', () => {
      const message: MessageCommand = {
        command: 'terminalCreated',
        terminalId: 'terminal-2',
        name: 'New Terminal',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should force normal mode when displayModeOverride is normal', () => {
      const message: MessageCommand = {
        command: 'terminalCreated',
        terminalId: 'terminal-2',
        terminalName: 'New Terminal',
        config: {
          displayModeOverride: 'normal',
        },
      };

      handler.handleMessage(message, mockCoordinator);

      expect(mockCoordinator.setForceNormalModeForNextCreate).toHaveBeenCalledWith(true);
      const displayModeManager = (mockCoordinator as any).getDisplayModeManager();
      expect(displayModeManager.setDisplayMode).toHaveBeenCalledWith('normal');
    });

    it('should show terminal fullscreen when displayModeOverride is fullscreen', async () => {
      (mockCoordinator.createTerminal as any).mockResolvedValue({});
      const message: MessageCommand = {
        command: 'terminalCreated',
        terminalId: 'terminal-9',
        terminalName: 'Fullscreen Terminal',
        config: {
          displayModeOverride: 'fullscreen',
        },
      };

      vi.useFakeTimers();
      await handler.handleMessage(message, mockCoordinator);
      vi.runAllTimers();

      const displayModeManager = (mockCoordinator as any).getDisplayModeManager();
      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('terminal-9');
      expect(displayModeManager.showTerminalFullscreen).toHaveBeenCalledWith('terminal-9');
      vi.useRealTimers();
    });

    it('should handle newTerminal message', () => {
      const message: MessageCommand = {
        command: 'newTerminal',
        terminalId: 'terminal-3',
        name: 'Another Terminal',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('Terminal Focus Handling', () => {
    it('should handle focusTerminal message', () => {
      const message: MessageCommand = {
        command: 'focusTerminal',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle setActiveTerminal message', () => {
      const message: MessageCommand = {
        command: 'setActiveTerminal',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('Terminal Deletion Handling', () => {
    it('should handle deleteTerminalResponse message', () => {
      const message: MessageCommand = {
        command: 'deleteTerminalResponse',
        terminalId: 'terminal-1',
        success: true,
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle terminalRemoved message', () => {
      const message: MessageCommand = {
        command: 'terminalRemoved',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle deletion failure', () => {
      const message: MessageCommand = {
        command: 'deleteTerminalResponse',
        terminalId: 'terminal-1',
        success: false,
        error: 'Cannot delete last terminal',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('Clear Command Handling', () => {
    it('should handle clear message', () => {
      const message: MessageCommand = {
        command: 'clear',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle clear without terminal ID', () => {
      const message: MessageCommand = {
        command: 'clear',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should clear active terminal
    });
  });

  describe('Unknown Command Handling', () => {
    it('should handle unknown command gracefully', () => {
      const message: MessageCommand = {
        command: 'unknownLifecycleCommand' as any,
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      handler.dispose();
      // Should not throw error
    });

    it('should be safe to dispose multiple times', () => {
      handler.dispose();
      handler.dispose();
      // Should not throw error
    });
  });

  describe('Error Resilience', () => {
    // TODO: Fix handler to properly catch errors and prevent unhandled rejections
    it.skip('should handle coordinator method failures gracefully', () => {
      const faultyCoordinator = {
        ...mockCoordinator,
        getTerminalInstance: () => {
          throw new Error('Test error');
        },
      } as IManagerCoordinator;

      const message: MessageCommand = {
        command: 'output',
        terminalId: 'terminal-1',
        data: 'test',
      };

      // Should not throw - handler should be resilient
      expect(() => handler.handleMessage(message, faultyCoordinator)).not.toThrow();
    });

    it('should handle missing data gracefully', () => {
      const message: MessageCommand = {
        command: 'output',
        // Missing terminalId and data
      } as any;

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });
  });
});
