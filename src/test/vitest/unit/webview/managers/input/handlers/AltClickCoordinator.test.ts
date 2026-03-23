import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  AltClickCoordinator,
  IAltClickCoordinatorDeps,
} from '../../../../../../../webview/managers/input/handlers/AltClickCoordinator';

// Mock logger
vi.mock('../../../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('AltClickCoordinator', () => {
  let dom: JSDOM;
  let coordinator: AltClickCoordinator;
  let deps: IAltClickCoordinatorDeps;
  let mockEventRegistry: any;
  let mockStateManager: any;
  let mockNotificationManager: any;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    vi.stubGlobal('navigator', dom.window.navigator);

    mockEventRegistry = {
      register: vi.fn(),
      unregister: vi.fn(),
    };

    mockStateManager = {
      updateAltClickState: vi.fn(),
    };

    mockNotificationManager = {
      showAltClickFeedback: vi.fn(),
    };

    deps = {
      logger: vi.fn(),
      eventRegistry: mockEventRegistry,
      stateManager: mockStateManager,
    };

    coordinator = new AltClickCoordinator(deps);
  });

  afterEach(() => {
    coordinator.dispose();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    dom.window.close();
  });

  describe('isVSCodeAltClickEnabled', () => {
    it('should return true when altClickMovesCursor is true and multiCursorModifier is alt', () => {
      expect(
        coordinator.isVSCodeAltClickEnabled({
          altClickMovesCursor: true,
          multiCursorModifier: 'alt',
        })
      ).toBe(true);
    });

    it('should return false when altClickMovesCursor is false', () => {
      expect(coordinator.isVSCodeAltClickEnabled({ altClickMovesCursor: false })).toBe(false);
    });

    it('should return false when multiCursorModifier is not alt', () => {
      expect(
        coordinator.isVSCodeAltClickEnabled({
          altClickMovesCursor: true,
          multiCursorModifier: 'ctrlCmd',
        })
      ).toBe(false);
    });

    it('should return false when altClickMovesCursor is undefined', () => {
      expect(coordinator.isVSCodeAltClickEnabled({})).toBe(false);
    });
  });

  describe('updateAltClickSettings', () => {
    it('should update state when settings change to enabled', () => {
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      expect(coordinator.getAltClickState().isVSCodeAltClickEnabled).toBe(true);
    });

    it('should update state when settings change to disabled', () => {
      // Enable first
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      // Then disable
      coordinator.updateAltClickSettings({ altClickMovesCursor: false });
      expect(coordinator.getAltClickState().isVSCodeAltClickEnabled).toBe(false);
    });

    it('should call stateManager.updateAltClickState on change', () => {
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      expect(mockStateManager.updateAltClickState).toHaveBeenCalledWith({
        isVSCodeAltClickEnabled: true,
      });
    });

    it('should not call stateManager when value does not change', () => {
      // Both start as disabled (false), update to disabled again
      coordinator.updateAltClickSettings({ altClickMovesCursor: false });
      expect(mockStateManager.updateAltClickState).not.toHaveBeenCalled();
    });
  });

  describe('getAltClickState', () => {
    it('should return default state initially', () => {
      const state = coordinator.getAltClickState();
      expect(state.isVSCodeAltClickEnabled).toBe(false);
      expect(state.isAltKeyPressed).toBe(false);
    });

    it('should return a copy of the state', () => {
      const state1 = coordinator.getAltClickState();
      const state2 = coordinator.getAltClickState();
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe('setupAltKeyVisualFeedback', () => {
    it('should register keydown and keyup event handlers', () => {
      coordinator.setupAltKeyVisualFeedback();
      expect(mockEventRegistry.register).toHaveBeenCalledWith(
        'alt-key-down',
        document,
        'keydown',
        expect.any(Function)
      );
      expect(mockEventRegistry.register).toHaveBeenCalledWith(
        'alt-key-up',
        document,
        'keyup',
        expect.any(Function)
      );
    });

    it('should update isAltKeyPressed on keydown with alt', () => {
      coordinator.setupAltKeyVisualFeedback();
      // Get the registered keydown handler
      const keydownCall = mockEventRegistry.register.mock.calls.find(
        (call: any[]) => call[0] === 'alt-key-down'
      );
      const keydownHandler = keydownCall[3];

      keydownHandler({ altKey: true } as KeyboardEvent);
      expect(coordinator.getAltClickState().isAltKeyPressed).toBe(true);
    });

    it('should reset isAltKeyPressed on keyup without alt', () => {
      coordinator.setupAltKeyVisualFeedback();
      const keydownCall = mockEventRegistry.register.mock.calls.find(
        (call: any[]) => call[0] === 'alt-key-down'
      );
      const keyupCall = mockEventRegistry.register.mock.calls.find(
        (call: any[]) => call[0] === 'alt-key-up'
      );

      // Press alt
      keydownCall[3]({ altKey: true } as KeyboardEvent);
      expect(coordinator.getAltClickState().isAltKeyPressed).toBe(true);

      // Release alt
      keyupCall[3]({ altKey: false } as KeyboardEvent);
      expect(coordinator.getAltClickState().isAltKeyPressed).toBe(false);
    });
  });

  describe('updateTerminalCursors', () => {
    it('should set cursor to default when alt is pressed and alt-click enabled', () => {
      const terminal = dom.window.document.createElement('div');
      terminal.className = 'xterm';
      const container = dom.window.document.createElement('div');
      container.className = 'terminal-container';
      container.appendChild(terminal);
      dom.window.document.body.appendChild(container);

      // Enable alt-click and press alt
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      coordinator.setupAltKeyVisualFeedback();

      const keydownCall = mockEventRegistry.register.mock.calls.find(
        (call: any[]) => call[0] === 'alt-key-down'
      );
      keydownCall[3]({ altKey: true } as KeyboardEvent);

      expect(terminal.style.cursor).toBe('default');
    });

    it('should clear cursor when alt is not pressed', () => {
      const terminal = dom.window.document.createElement('div');
      terminal.className = 'xterm';
      const container = dom.window.document.createElement('div');
      container.className = 'terminal-container';
      container.appendChild(terminal);
      dom.window.document.body.appendChild(container);

      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      coordinator.setupAltKeyVisualFeedback();

      // Press and release
      const keydownCall = mockEventRegistry.register.mock.calls.find(
        (call: any[]) => call[0] === 'alt-key-down'
      );
      const keyupCall = mockEventRegistry.register.mock.calls.find(
        (call: any[]) => call[0] === 'alt-key-up'
      );

      keydownCall[3]({ altKey: true } as KeyboardEvent);
      keyupCall[3]({ altKey: false } as KeyboardEvent);

      expect(terminal.style.cursor).toBe('');
    });
  });

  describe('handleAltClick', () => {
    it('should show feedback when alt-click is enabled and notification manager set', () => {
      coordinator.setNotificationManager(mockNotificationManager);
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });

      const result = coordinator.handleAltClick(100, 200, 'terminal-1');
      expect(result).toBe(true);
      expect(mockNotificationManager.showAltClickFeedback).toHaveBeenCalledWith(100, 200);
    });

    it('should return false when alt-click is not enabled', () => {
      const result = coordinator.handleAltClick(100, 200, 'terminal-1');
      expect(result).toBe(false);
    });

    it('should work without notification manager', () => {
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });

      const result = coordinator.handleAltClick(100, 200, 'terminal-1');
      expect(result).toBe(true);
    });
  });

  describe('setNotificationManager', () => {
    it('should store the notification manager', () => {
      coordinator.setNotificationManager(mockNotificationManager);
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });

      coordinator.handleAltClick(50, 60, 'terminal-1');
      expect(mockNotificationManager.showAltClickFeedback).toHaveBeenCalledWith(50, 60);
    });
  });

  describe('dispose', () => {
    it('should reset alt-click state', () => {
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      expect(coordinator.getAltClickState().isVSCodeAltClickEnabled).toBe(true);

      coordinator.dispose();
      expect(coordinator.getAltClickState().isVSCodeAltClickEnabled).toBe(false);
      expect(coordinator.getAltClickState().isAltKeyPressed).toBe(false);
    });

    it('should clear notification manager reference', () => {
      coordinator.setNotificationManager(mockNotificationManager);
      coordinator.dispose();

      // After dispose, alt-click handling should not use notification manager
      coordinator.updateAltClickSettings({
        altClickMovesCursor: true,
        multiCursorModifier: 'alt',
      });
      coordinator.handleAltClick(100, 200, 'terminal-1');
      expect(mockNotificationManager.showAltClickFeedback).not.toHaveBeenCalled();
    });
  });
});
