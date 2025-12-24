/**
 * ShellIntegrationMessageHandler Tests
 *
 * Tests for shell integration message handling
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ShellIntegrationMessageHandler } from '../../../../../../webview/managers/handlers/ShellIntegrationMessageHandler';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../../webview/managers/messageTypes';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

describe('ShellIntegrationMessageHandler', () => {
  let handler: ShellIntegrationMessageHandler;
  let mockCoordinator: IManagerCoordinator;
  let mockLogger: ManagerLogger;
  let dom: JSDOM;

  beforeEach(() => {
    // CRITICAL: Create JSDOM in beforeEach to prevent test pollution
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
    });

    // Set up global DOM
    (global as any).document = dom.window.document;
    (global as any).window = dom.window;
    (global as any).HTMLElement = dom.window.HTMLElement;

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ManagerLogger;

    // Create minimal mock coordinator
    mockCoordinator = {
      getActiveTerminalId: () => 'terminal-1',
      getAllTerminalInstances: () => new Map(),
      log: vi.fn(),
      postMessageToExtension: vi.fn(),
      shellIntegrationManager: {
        updateShellStatus: vi.fn(),
        updateWorkingDirectory: vi.fn(),
        showCommandHistory: vi.fn(),
      } as any,
      getManagers: () => ({
        performance: {} as any,
        input: {} as any,
        ui: {} as any,
        config: {} as any,
        message: {} as any,
        notification: {} as any,
      }),
    } as any;

    handler = new ShellIntegrationMessageHandler(mockLogger);
  });

  afterEach(() => {
    // CRITICAL: Use try-finally to ensure all cleanup happens
    try {
      handler.dispose();
    } finally {
      try {
        vi.restoreAllMocks();
      } finally {
        try {
          dom.window.close();
        } finally {
          delete (global as any).document;
          delete (global as any).window;
          delete (global as any).HTMLElement;
        }
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(handler).toBeDefined();
    });

    it('should return supported commands', () => {
      const commands = handler.getSupportedCommands();
      expect(commands).toBeInstanceOf(Array);
      expect(commands).toContain('shellStatus');
      expect(commands).toContain('cwdUpdate');
      expect(commands).toContain('commandHistory');
      expect(commands).toContain('find');
    });
  });

  describe('Shell Status Handling', () => {
    it('should handle shellStatus message', () => {
      const message: MessageCommand = {
        command: 'shellStatus',
        terminalId: 'terminal-1',
        status: 'ready',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle shellStatus without terminalId', () => {
      const message: MessageCommand = {
        command: 'shellStatus',
        status: 'ready',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });

    it('should handle shellStatus without status', () => {
      const message: MessageCommand = {
        command: 'shellStatus',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });
  });

  describe('CWD Update Handling', () => {
    it('should handle cwdUpdate message', () => {
      const message: MessageCommand = {
        command: 'cwdUpdate',
        terminalId: 'terminal-1',
        cwd: '/home/user/project',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle cwdUpdate without terminalId', () => {
      const message: MessageCommand = {
        command: 'cwdUpdate',
        cwd: '/home/user/project',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });

    it('should handle cwdUpdate without cwd', () => {
      const message: MessageCommand = {
        command: 'cwdUpdate',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });

    it('should handle cwdUpdate when shellIntegrationManager is not available', () => {
      const coordinatorWithoutShell = {
        ...mockCoordinator,
        shellIntegrationManager: undefined,
      };

      const message: MessageCommand = {
        command: 'cwdUpdate',
        terminalId: 'terminal-1',
        cwd: '/home/user/project',
      };

      handler.handleMessage(message, coordinatorWithoutShell);
      // Should not throw error
    });
  });

  describe('Command History Handling', () => {
    it('should handle commandHistory message', () => {
      const message: MessageCommand = {
        command: 'commandHistory',
        terminalId: 'terminal-1',
        history: [
          { command: 'ls -la', exitCode: 0 },
          { command: 'cd /home', exitCode: 0 },
        ],
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle commandHistory with duration info', () => {
      const message: MessageCommand = {
        command: 'commandHistory',
        terminalId: 'terminal-1',
        history: [{ command: 'npm test', exitCode: 0, duration: 1234 }],
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle commandHistory without terminalId', () => {
      const message: MessageCommand = {
        command: 'commandHistory',
        history: [],
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });

    it('should handle commandHistory without history', () => {
      const message: MessageCommand = {
        command: 'commandHistory',
        terminalId: 'terminal-1',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });
  });

  describe('Find/Search Handling', () => {
    beforeEach(() => {
      // Set up DOM for search UI tests
      const mainElement = document.createElement('div');
      mainElement.id = 'main';
      document.body.appendChild(mainElement);
    });

    afterEach(() => {
      // Clean up DOM
      const mainElement = document.getElementById('main');
      if (mainElement) {
        mainElement.remove();
      }

      // Clean up search container
      const searchContainer = document.getElementById('terminal-search-container');
      if (searchContainer) {
        searchContainer.remove();
      }

      // Clean up search styles
      const searchStyles = document.getElementById('terminal-search-styles');
      if (searchStyles) {
        searchStyles.remove();
      }
    });

    it('should handle find message', () => {
      const message: MessageCommand = {
        command: 'find',
        action: 'show',
      };

      handler.handleMessage(message, mockCoordinator);
      // Should not throw error
    });

    it('should handle find without active terminal', () => {
      const coordinatorWithoutTerminal = {
        ...mockCoordinator,
        getActiveTerminalId: () => null,
      };

      const message: MessageCommand = {
        command: 'find',
        action: 'show',
      };

      handler.handleMessage(message, coordinatorWithoutTerminal);
      // Should warn but not throw
    });

    it('should handle find without terminal instance', () => {
      const coordinatorWithoutInstance = {
        ...mockCoordinator,
        getAllTerminalInstances: () => new Map(),
      };

      const message: MessageCommand = {
        command: 'find',
        action: 'show',
      };

      handler.handleMessage(message, coordinatorWithoutInstance);
      // Should warn but not throw
    });
  });

  describe('Unknown Command Handling', () => {
    it('should handle unknown command gracefully', () => {
      const message: MessageCommand = {
        command: 'unknownShellCommand' as any,
      };

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      handler.dispose();
      // Should not throw error
    });

    it('should clean up search UI on dispose', () => {
      // Create search UI elements
      const searchContainer = document.createElement('div');
      searchContainer.id = 'terminal-search-container';
      document.body.appendChild(searchContainer);

      const searchStyles = document.createElement('style');
      searchStyles.id = 'terminal-search-styles';
      document.body.appendChild(searchStyles);

      handler.dispose();

      // Should remove search UI
      expect(document.getElementById('terminal-search-container')).toBeNull();
      expect(document.getElementById('terminal-search-styles')).toBeNull();
    });

    it('should be safe to dispose multiple times', () => {
      handler.dispose();
      handler.dispose();
      // Should not throw error
    });
  });

  describe('Error Resilience', () => {
    it('should handle missing shellIntegrationManager gracefully', () => {
      const coordinatorWithoutShell = {
        ...mockCoordinator,
        shellIntegrationManager: undefined,
      };

      const message: MessageCommand = {
        command: 'shellStatus',
        terminalId: 'terminal-1',
        status: 'ready',
      };

      handler.handleMessage(message, coordinatorWithoutShell);
      // Should not throw error
    });

    it('should handle malformed message data', () => {
      const message: MessageCommand = {
        command: 'shellStatus',
        // Missing required fields
      } as any;

      handler.handleMessage(message, mockCoordinator);
      // Should warn but not throw
    });
  });

  describe('Shell Integration Manager Methods', () => {
    it('should call updateShellStatus when available', () => {
      const updateShellStatusMock = vi.fn();
      mockCoordinator.shellIntegrationManager = {
        updateShellStatus: updateShellStatusMock,
      } as any;

      const message: MessageCommand = {
        command: 'shellStatus',
        terminalId: 'terminal-1',
        status: 'ready',
      };

      handler.handleMessage(message, mockCoordinator);
      expect(updateShellStatusMock).toHaveBeenCalled();
    });

    it('should call updateWorkingDirectory when available', () => {
      const updateWorkingDirectoryMock = vi.fn();
      mockCoordinator.shellIntegrationManager = {
        updateWorkingDirectory: updateWorkingDirectoryMock,
      } as any;

      const message: MessageCommand = {
        command: 'cwdUpdate',
        terminalId: 'terminal-1',
        cwd: '/test',
      };

      handler.handleMessage(message, mockCoordinator);
      expect(updateWorkingDirectoryMock).toHaveBeenCalled();
    });

    it('should call showCommandHistory when available', () => {
      const showCommandHistoryMock = vi.fn();
      mockCoordinator.shellIntegrationManager = {
        showCommandHistory: showCommandHistoryMock,
      } as any;

      const message: MessageCommand = {
        command: 'commandHistory',
        terminalId: 'terminal-1',
        history: [],
      };

      handler.handleMessage(message, mockCoordinator);
      expect(showCommandHistoryMock).toHaveBeenCalled();
    });
  });
});
