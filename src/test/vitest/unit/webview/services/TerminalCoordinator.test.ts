/**
 * TerminalCoordinator Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TerminalCoordinator } from '../../../../../webview/services/TerminalCoordinator';


// Mock Terminal and Addons
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    onResize = vi.fn().mockReturnValue({ dispose: vi.fn() });
    write = vi.fn((data, cb) => cb?.());
    scrollToBottom = vi.fn();
    resize = vi.fn();
    refresh = vi.fn();
    rows = 24;
    cols = 80;
    buffer = { active: { baseY: 0, viewportY: 0 } };
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn();
  }
  return { FitAddon: MockFitAddon };
});

// Mock logger
vi.mock('../../../../../webview/utils/logger', () => ({
  webview: vi.fn(),
}));

describe('TerminalCoordinator', () => {
  let coordinator: TerminalCoordinator;

  beforeEach(() => {
    coordinator = new TerminalCoordinator({
      maxTerminals: 5,
      defaultShell: '/bin/bash',
      workingDirectory: '/',
      debugMode: false
    });
  });

  afterEach(() => {
    coordinator.dispose();
    vi.clearAllMocks();
  });

  describe('createTerminal', () => {
    it('should create and store terminal instance', async () => {
      const terminalId = await coordinator.createTerminal();
      
      expect(terminalId).toBeDefined();
      expect(coordinator.getTerminalCount()).toBe(1);
      expect(coordinator.getTerminal(terminalId)).toBeTruthy();
    });

    it('should throw error if limit reached', async () => {
      // Set low limit
      (coordinator as any).config.maxTerminals = 1;
      await coordinator.createTerminal();
      
      await expect(coordinator.createTerminal()).rejects.toThrow('maximum of 1 terminals reached');
    });

    it('should emit onTerminalCreated event', async () => {
      const listener = vi.fn();
      coordinator.addEventListener('onTerminalCreated', listener);
      
      await coordinator.createTerminal();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Terminal Operations', () => {
    let t1Id: string;

    beforeEach(async () => {
      t1Id = await coordinator.createTerminal();
    });

    it('should activate terminal', () => {
      const _t2Id = 'terminal-2'; // mock expected next ID
      coordinator.activateTerminal(t1Id);
      
      const info = coordinator.getTerminalInfo(t1Id);
      expect(info?.isActive).toBe(true);
      expect(info?.container.style.display).toBe('block');
    });

    it('should write to terminal', () => {
      const terminal = coordinator.getTerminal(t1Id) as any;
      coordinator.writeToTerminal(t1Id, 'hello');
      
      expect(terminal.write).toHaveBeenCalledWith('hello', expect.any(Function));
    });

    it('should resize terminal', () => {
      const terminal = coordinator.getTerminal(t1Id) as any;
      coordinator.resizeTerminal(t1Id, 100, 40);
      
      expect(terminal.resize).toHaveBeenCalledWith(100, 40);
    });
  });

  describe('removeTerminal', () => {
    it('should dispose terminal and remove from collection', async () => {
      const id = await coordinator.createTerminal();
      const terminal = coordinator.getTerminal(id) as any;
      
      await coordinator.removeTerminal(id);
      
      expect(terminal.dispose).toHaveBeenCalled();
      expect(coordinator.hasTerminals()).toBe(false);
    });
  });
});
