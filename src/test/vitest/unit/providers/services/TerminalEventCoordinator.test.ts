/**
 * TerminalEventCoordinator Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { TerminalEventCoordinator } from '../../../../../providers/services/TerminalEventCoordinator';

// Mock VS Code API
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key, def) => def),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
}));

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

// Mock UnifiedConfigurationService
const { mockUnifiedConfig } = vi.hoisted(() => ({
  mockUnifiedConfig: {
    getExtensionTerminalConfig: vi.fn().mockReturnValue({ cursorBlink: true, theme: 'auto' }),
    getCompleteTerminalSettings: vi.fn().mockReturnValue({ cursorBlink: true, theme: 'auto' }),
    getAltClickSettings: vi.fn().mockReturnValue({ altClickMovesCursor: true, multiCursorModifier: 'alt' }),
    getWebViewFontSettings: vi.fn().mockReturnValue({ fontSize: 14, fontFamily: 'monospace' }),
    isFeatureEnabled: vi.fn().mockReturnValue(true),
    get: vi.fn((section, key, def) => def),
  }
}));

vi.mock('../../../../../config/UnifiedConfigurationService', () => ({
  getUnifiedConfigurationService: vi.fn(() => mockUnifiedConfig),
}));

describe('TerminalEventCoordinator', () => {
  let coordinator: TerminalEventCoordinator;
  let mockTerminalManager: any;
  let mockSendMessage: any;
  let mockSendCliState: any;
  let mockInitState: any;

  beforeEach(() => {
    mockTerminalManager = {
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onExit: vi.fn(() => ({ dispose: vi.fn() })),
      onTerminalCreated: vi.fn(() => ({ dispose: vi.fn() })),
      onTerminalRemoved: vi.fn(() => ({ dispose: vi.fn() })),
      onStateUpdate: vi.fn(() => ({ dispose: vi.fn() })),
      onTerminalFocus: vi.fn(() => ({ dispose: vi.fn() })),
      onCliAgentStatusChange: vi.fn(() => ({ dispose: vi.fn() })),
    };
    
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    mockSendCliState = vi.fn();
    mockInitState = {
      isOutputAllowed: vi.fn().mockReturnValue(true),
    };

    coordinator = new TerminalEventCoordinator(
      mockTerminalManager,
      mockSendMessage,
      mockSendCliState,
      new Map(),
      mockInitState
    );
  });

  afterEach(() => {
    coordinator.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should setup all listeners', () => {
      coordinator.initialize();
      
      expect(mockTerminalManager.onData).toHaveBeenCalled();
      expect(mockTerminalManager.onExit).toHaveBeenCalled();
      expect(mockTerminalManager.onCliAgentStatusChange).toHaveBeenCalled();
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });
  });

  describe('Terminal Events', () => {
    beforeEach(() => {
      coordinator.setupTerminalEventListeners();
    });

    it('should forward terminal data to WebView when allowed', () => {
      const onDataHandler = mockTerminalManager.onData.mock.calls[0][0];
      mockInitState.isOutputAllowed.mockReturnValue(true);
      
      onDataHandler({ terminalId: 't1', data: 'hello' });
      
      expect(mockSendMessage).toHaveBeenCalledWith({
        command: 'output',
        terminalId: 't1',
        data: 'hello'
      });
    });

    it('should buffer output if not allowed and flush later', () => {
      const onDataHandler = mockTerminalManager.onData.mock.calls[0][0];
      mockInitState.isOutputAllowed.mockReturnValue(false);
      
      onDataHandler({ terminalId: 't1', data: 'buffered' });
      expect(mockSendMessage).not.toHaveBeenCalled();
      
      coordinator.flushBufferedOutput('t1');
      expect(mockSendMessage).toHaveBeenCalledWith({
        command: 'output',
        terminalId: 't1',
        data: 'buffered'
      });
    });

    it('should include displayModeOverride when provided on terminal instance', () => {
      const onCreatedHandler = mockTerminalManager.onTerminalCreated.mock.calls[0][0];

      onCreatedHandler({
        id: 't1',
        name: 'Terminal 1',
        number: 1,
        creationDisplayModeOverride: 'normal',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'terminalCreated',
          terminalId: 't1',
          config: expect.objectContaining({ displayModeOverride: 'normal' }),
        })
      );
    });

    it('should forward exit event', () => {
      const onExitHandler = mockTerminalManager.onExit.mock.calls[0][0];
      onExitHandler({ terminalId: 't1', exitCode: 0 });
      
      expect(mockSendMessage).toHaveBeenCalledWith({
        command: 'exit',
        terminalId: 't1',
        exitCode: 0
      });
    });

    it('should forward focus event', () => {
      const onFocusHandler = mockTerminalManager.onTerminalFocus.mock.calls[0][0];
      onFocusHandler('t1');
      
      expect(mockSendMessage).toHaveBeenCalledWith({
        command: 'focusTerminal',
        terminalId: 't1'
      });
    });
  });

  describe('Configuration Changes', () => {
    it('should debounce and send settings update', async () => {
      vi.useFakeTimers();
      coordinator.initialize();
      
      const configHandler = (vscode.workspace.onDidChangeConfiguration as any).mock.calls[0][0];
      
      // Simulate multiple changes
      configHandler({ affectsConfiguration: (key: string) => key === 'secondaryTerminal.theme' });
      configHandler({ affectsConfiguration: (key: string) => key === 'secondaryTerminal.cursorBlink' });
      
      expect(mockSendMessage).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'settingsResponse'
      }));
      vi.useRealTimers();
    });

    it('should send font settings update', async () => {
      vi.useFakeTimers();
      coordinator.initialize();
      const configHandler = (vscode.workspace.onDidChangeConfiguration as any).mock.calls[0][0];
      
      configHandler({ affectsConfiguration: (key: string) => key === 'terminal.integrated.fontSize' });
      
      vi.advanceTimersByTime(100);
      
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'fontSettingsUpdate'
      }));
      vi.useRealTimers();
    });
  });

  describe('CLI Agent Status', () => {
    it('should trigger full sync on status change', () => {
      coordinator.initialize();
      const onStatusChangeHandler = mockTerminalManager.onCliAgentStatusChange.mock.calls[0][0];
      
      onStatusChangeHandler({ terminalId: 't1', status: 'connected' });
      
      expect(mockSendCliState).toHaveBeenCalled();
    });
  });
});
