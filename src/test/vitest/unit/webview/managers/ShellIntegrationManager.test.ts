/**
 * ShellIntegrationManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ShellIntegrationManager } from '../../../../../webview/managers/ShellIntegrationManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import { Terminal } from '@xterm/xterm';

// Mock generic logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Mock ShellIntegrationAddon
vi.mock('../../../../../webview/addons/ShellIntegrationAddon', () => ({
  ShellIntegrationAddon: class {
    private manager: any;
    private history: any[] = [];
    private currentCommand: any = undefined;
    private active = true;
    private cwd = '/mock/cwd';

    constructor(manager: any) {
      this.manager = manager;
    }
    
    activate(term: any) {
      // no-op
    }
    
    dispose() {
      // no-op
    }

    getCurrentCommand() {
      return this.currentCommand;
    }

    getCommandHistory() {
      return this.history;
    }

    isActive() {
      return this.active;
    }

    getCurrentCwd() {
      return this.cwd;
    }

    clearHistory() {
      this.history = [];
    }
  }
}));

describe('ShellIntegrationManager', () => {
  let manager: ShellIntegrationManager;
  let mockCoordinator: IManagerCoordinator;
  let dom: JSDOM;
  let mockTerminal: Terminal;

  beforeEach(() => {
    vi.useFakeTimers();
    dom = new JSDOM('<!DOCTYPE html><div id="terminal-body"></div>');
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;

    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map()),
    } as any;

    mockTerminal = {
      loadAddon: vi.fn(),
      paste: vi.fn(),
    } as any;

    manager = new ShellIntegrationManager();
    manager.setCoordinator(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize shell integration for a terminal', () => {
      const termId = 't1';
      manager.initializeTerminalShellIntegration(mockTerminal, termId);
      
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
      
      // Verify state initialization
      const state = manager.getShellIntegrationState(termId);
      expect(state).toBeDefined();
      expect(state?.isActive).toBe(true);
    });

    it('should setup styles on construction', () => {
      // Constructor calls setupStyles
      const styleTags = document.head.getElementsByTagName('style');
      expect(styleTags.length).toBeGreaterThan(0);
      expect(styleTags[0].textContent).toContain('.shell-status-indicator');
    });
  });

  describe('Event Handling', () => {
    const termId = 't1';

    beforeEach(() => {
      manager.initializeTerminalShellIntegration(mockTerminal, termId);
    });

    it('should handle command start', () => {
      const command = { command: 'ls', cwd: '/test', timestamp: Date.now() };
      
      // Mock finding terminal ID (simplified in manager implementation to look up addon)
      // Since we can't easily mock the private map search without intrusive mocks, 
      // we rely on the fallback behavior or mock the addon's getCurrentCommand if needed.
      // However, the manager uses `findTerminalIdForCommand` which iterates addons.
      // We need the mock addon to return the command we are passing.
      
      // Access the mock addon instance if possible or assume the fallback works (first terminal)
      // Since 't1' is the only terminal, it should be found as fallback or match.
      
      manager.onCommandStart(command);
      
      // Verify status update via side effect (e.g. status indicator or logging)
      // Ideally we check internal state or coordinator calls
      // The manager updates statusMap and calls updateStatusIndicator
      // We can check if statusMap was updated by checking getShellIntegrationState?
      // getShellIntegrationState pulls from addon mostly, but also statusMap for exitCode.
      
      // Let's check if we can verify via updateShellStatus side effects (e.g. UI)
      // But UI elements are created on demand.
      
      // We can check if `updateShellStatus` was called effectively.
      // Since `updateShellStatus` is public, we can spy on it? No, it's on the same instance.
      
      // We can verify by checking if the visual indicator was created/updated.
      // We need to mock the DOM structure for the terminal header.
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);
      
      manager.onCommandStart(command);
      
      const indicator = header.querySelector('.shell-status-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.className).toContain('executing');
    });

    it('should handle command end (success)', () => {
      const command = { command: 'ls', cwd: '/test', timestamp: Date.now() };
      // Setup UI
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);

      manager.onCommandEnd(command, 0); // Success
      
      const indicator = header.querySelector('.shell-status-indicator');
      expect(indicator?.className).toContain('success');
      
      const state = manager.getShellIntegrationState(termId);
      expect(state?.lastExitCode).toBe(0);
    });

    it('should handle command end (error)', () => {
      const command = { command: 'ls', cwd: '/test', timestamp: Date.now() };
      // Setup UI
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);

      manager.onCommandEnd(command, 1); // Error
      
      const indicator = header.querySelector('.shell-status-indicator');
      expect(indicator?.className).toContain('error');
      
      // Should show notification via coordinator
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(expect.objectContaining({
        command: 'showNotification',
        type: 'warning'
      }));
    });

    it('should auto-reset status to ready after delay', () => {
      const command = { command: 'ls', cwd: '/test', timestamp: Date.now() };
      // Setup UI
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);

      manager.onCommandEnd(command, 0);
      expect(header.querySelector('.shell-status-indicator')?.className).toContain('success');
      
      vi.advanceTimersByTime(2000);
      
      expect(header.querySelector('.shell-status-indicator')?.className).toContain('ready');
    });
  });

  describe('UI Updates', () => {
    const termId = 't1';

    beforeEach(() => {
      manager.initializeTerminalShellIntegration(mockTerminal, termId);
      // Setup UI
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);
    });

    it('should update status indicator', () => {
      manager.updateShellStatus(termId, 'executing');
      const indicator = document.querySelector('.shell-status-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.className).toContain('executing');
    });

    it('should update CWD display', () => {
      manager.updateCwd(termId, '/home/user/project');
      const cwdDisplay = document.querySelector('.shell-cwd-display');
      expect(cwdDisplay).not.toBeNull();
      expect(cwdDisplay?.textContent).toBe('/home/user/project');
    });

    it('should format home directory in CWD display', () => {
      process.env.HOME = '/home/user';
      manager.updateCwd(termId, '/home/user/project');
      const cwdDisplay = document.querySelector('.shell-cwd-display');
      expect(cwdDisplay?.textContent).toBe('~/project');
    });
  });

  describe('Message Handling', () => {
    it('should handle updateShellStatus message', () => {
      // Setup UI
      const termId = 't1';
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);

      manager.handleMessage({
        command: 'updateShellStatus',
        terminalId: termId,
        status: 'error'
      } as any);

      const indicator = document.querySelector('.shell-status-indicator');
      expect(indicator?.className).toContain('error');
    });

    it('should handle updateCwd message', () => {
      const termId = 't1';
      // Setup UI
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);

      manager.handleMessage({
        command: 'updateCwd',
        terminalId: termId,
        cwd: '/new/cwd'
      } as any);

      const cwdDisplay = document.querySelector('.shell-cwd-display');
      expect(cwdDisplay?.textContent).toBe('/new/cwd');
    });
  });

  describe('Cleanup', () => {
    it('should dispose terminal resources', () => {
      const termId = 't1';
      manager.initializeTerminalShellIntegration(mockTerminal, termId);
      
      // Setup UI elements to verify removal
      const header = document.createElement('div');
      header.className = 'terminal-header';
      const container = document.createElement('div');
      container.setAttribute('data-terminal-id', termId);
      container.appendChild(header);
      document.body.appendChild(container);
      
      manager.updateShellStatus(termId, 'ready'); // Creates indicator
      
      manager.disposeTerminal(termId);
      
      expect(document.querySelector('.shell-status-indicator')).toBeNull(); // Should be removed
      const state = manager.getShellIntegrationState(termId);
      expect(state).toBeUndefined();
    });

    it('should dispose all resources', () => {
      manager.initializeTerminalShellIntegration(mockTerminal, 't1');
      manager.initializeTerminalShellIntegration(mockTerminal, 't2');
      
      manager.dispose();
      
      expect(manager.getShellIntegrationState('t1')).toBeUndefined();
      expect(manager.getShellIntegrationState('t2')).toBeUndefined();
    });
  });
});
