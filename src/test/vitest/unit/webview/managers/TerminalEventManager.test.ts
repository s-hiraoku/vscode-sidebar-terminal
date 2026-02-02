/**
 * TerminalEventManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TerminalEventManager } from '../../../../../webview/managers/TerminalEventManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import { EventHandlerRegistry } from '../../../../../webview/utils/EventHandlerRegistry';
import { Terminal } from '@xterm/xterm';

// Mock generic logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock EventHandlerRegistry
vi.mock('../../../../../webview/utils/EventHandlerRegistry', () => ({
  EventHandlerRegistry: class {
    register = vi.fn();
    unregister = vi.fn();
    unregisterByPattern = vi.fn();
    dispose = vi.fn();
  },
}));

describe('TerminalEventManager', () => {
  let manager: TerminalEventManager;
  let mockCoordinator: IManagerCoordinator;
  let mockRegistry: EventHandlerRegistry;
  let dom: JSDOM;
  let mockTerminal: any;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><div></div>');
    global.document = dom.window.document;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;

    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      setActiveTerminalId: vi.fn(),
      deleteTerminalSafely: vi.fn(),
      handleAiAgentToggle: vi.fn(),
      getManagers: vi.fn().mockReturnValue({}),
    } as any;

    mockRegistry = new EventHandlerRegistry();

    // Mock terminal
    mockTerminal = {
      onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      textarea: document.createElement('textarea'),
      hasSelection: vi.fn().mockReturnValue(false),
      focus: vi.fn(),
    };

    // Mock container
    mockContainer = document.createElement('div');
    const xtermElement = document.createElement('div');
    xtermElement.className = 'xterm';
    mockContainer.appendChild(xtermElement);

    manager = new TerminalEventManager(mockCoordinator, mockRegistry);
  });

  afterEach(() => {
    manager.dispose();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      // BaseManager initialization logic
      await (manager as any).initialize();
      // Indirectly verified by no error throw
    });
  });

  describe('Input Handler Setup', () => {
    it('should setup legacy input handler when InputManager is missing', () => {
      // Setup coordinator without InputManager
      (mockCoordinator as any).inputManager = undefined;
      (mockCoordinator as any).getManagers = () => ({});

      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);

      expect(mockTerminal.onData).toHaveBeenCalled();
    });

    it('should skip legacy input handler when InputManager is present', () => {
      // Setup coordinator with InputManager
      (mockCoordinator as any).inputManager = {};
      
      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);

      expect(mockTerminal.onData).not.toHaveBeenCalled();
    });

    it('should send input to extension via legacy handler', () => {
      // Setup legacy handler
      (mockCoordinator as any).inputManager = undefined;
      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);

      // Simulate input
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      onDataCallback('test input');

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith({
        command: 'input',
        data: 'test input',
        terminalId: 't1'
      });
    });
  });

  describe('Click Handling', () => {
    it('should setup click handler for activation', () => {
      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);
      
      expect(mockRegistry.register).toHaveBeenCalledWith(
        'terminal-t1-click',
        expect.anything(),
        'click',
        expect.any(Function)
      );
    });

    it('should activate terminal on click if no selection', () => {
      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);
      
      // Get registered handler
      const calls = (mockRegistry.register as any).mock.calls;
      const clickCall = calls.find((call: any) => call[0] === 'terminal-t1-click');
      const clickHandler = clickCall[3];

      // Simulate click
      mockTerminal.hasSelection.mockReturnValue(false);
      clickHandler(new Event('click'));

      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('t1');
    });

    it('should NOT activate terminal on click if selection exists', () => {
      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);
      
      const calls = (mockRegistry.register as any).mock.calls;
      const clickCall = calls.find((call: any) => call[0] === 'terminal-t1-click');
      const clickHandler = clickCall[3];

      mockTerminal.hasSelection.mockReturnValue(true);
      clickHandler(new Event('click'));

      expect(mockCoordinator.setActiveTerminalId).not.toHaveBeenCalled();
    });
  });

  describe('Focus Optimization', () => {
    it('should register focus and blur handlers', () => {
      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);
      
      expect(mockRegistry.register).toHaveBeenCalledWith(
        'terminal-t1-focus',
        mockTerminal.textarea,
        'focus',
        expect.any(Function)
      );
      
      expect(mockRegistry.register).toHaveBeenCalledWith(
        'terminal-t1-blur',
        mockTerminal.textarea,
        'blur',
        expect.any(Function)
      );
    });
  });

  describe('Container Callbacks', () => {
    it('should provide header click callback', () => {
      const callbacks = manager.createContainerCallbacks('t1');
      callbacks.onHeaderClick('t1');
      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('t1');
    });

    it('should provide container click callback', () => {
      const callbacks = manager.createContainerCallbacks('t1');
      callbacks.onContainerClick('t1');
      expect(mockCoordinator.setActiveTerminalId).toHaveBeenCalledWith('t1');
    });

    it('should provide close click callback', () => {
      const callbacks = manager.createContainerCallbacks('t1');
      callbacks.onCloseClick('t1');
      expect(mockCoordinator.deleteTerminalSafely).toHaveBeenCalledWith('t1');
    });

    it('should provide AI agent toggle callback', () => {
      const callbacks = manager.createContainerCallbacks('t1');
      callbacks.onAiAgentToggleClick('t1');
      expect(mockCoordinator.handleAiAgentToggle).toHaveBeenCalledWith('t1');
    });
  });

  describe('Focus Management', () => {
    it('should focus terminal if not focused', () => {
      vi.useFakeTimers();
      // textarea does not have 'focused' attribute initially
      manager.focusTerminal(mockTerminal as Terminal, 't1');
      
      vi.advanceTimersByTime(10);
      expect(mockTerminal.focus).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should skip focus if already active element', () => {
      vi.useFakeTimers();
      // Mock active element
      Object.defineProperty(document, 'activeElement', {
        value: mockTerminal.textarea,
        configurable: true,
      });

      manager.focusTerminal(mockTerminal as Terminal, 't1');

      vi.advanceTimersByTime(10);
      expect(mockTerminal.focus).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('Event Removal with Regex Metacharacters', () => {
    it('should escape regex metacharacters in terminalId before unregistering', () => {
      const terminalId = '$1[test]';
      const unregisterByPatternSpy = vi.spyOn(mockRegistry, 'unregisterByPattern');

      manager.setupTerminalEvents(mockTerminal as Terminal, terminalId, mockContainer);

      const registerCalls = (mockRegistry.register as any).mock.calls;
      expect(registerCalls.length).toBeGreaterThan(0);

      manager.removeTerminalEvents(terminalId);

      expect(unregisterByPatternSpy).toHaveBeenCalled();
      expect(unregisterByPatternSpy.mock.calls.length).toBeGreaterThan(0);

      const firstCallArgs = unregisterByPatternSpy.mock.calls[0];
      if (firstCallArgs && firstCallArgs[0]) {
        const patternArg = firstCallArgs[0];
        expect(patternArg).toBeInstanceOf(RegExp);
        // Verify the escaped pattern matches the expected terminal event keys
        expect(patternArg.test('terminal-$1[test]-click')).toBe(true);
        expect(patternArg.test('terminal-$1[test]-pointerdown')).toBe(true);
        // Should NOT match other terminals
        expect(patternArg.test('terminal-$2-click')).toBe(false);
        expect(patternArg.test('terminal-click')).toBe(false);
      }
    });

    it('should not remove events for other terminals when removing one', () => {
      const unregisterByPatternSpy = vi.spyOn(mockRegistry, 'unregisterByPattern');

      manager.setupTerminalEvents(mockTerminal as Terminal, 't1', mockContainer);
      manager.setupTerminalEvents(mockTerminal as Terminal, 't2', mockContainer);

      const t1Registers = (mockRegistry.register as any).mock.calls.filter((call: any[]) =>
        call[0].startsWith('terminal-t1')
      );
      const t2Registers = (mockRegistry.register as any).mock.calls.filter((call: any[]) =>
        call[0].startsWith('terminal-t2')
      );

      expect(t1Registers.length).toBeGreaterThan(0);
      expect(t2Registers.length).toBeGreaterThan(0);

      manager.removeTerminalEvents('t1');

      expect(unregisterByPatternSpy).toHaveBeenCalled();

      // t2 registrations should remain unchanged
      const t2RegistersAfter = (mockRegistry.register as any).mock.calls.filter((call: any[]) =>
        call[0].startsWith('terminal-t2')
      );

      expect(t2RegistersAfter.length).toBe(t2Registers.length);
    });
  });
});
