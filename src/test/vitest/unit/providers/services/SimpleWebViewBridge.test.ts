/**
 * SimpleWebViewBridge Unit Tests
 */

import { describe, it, expect } from 'vitest';

import { SimpleWebViewBridge } from '../../../../../providers/services/SimpleWebViewBridge';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

describe('SimpleWebViewBridge', () => {
  let bridge: SimpleWebViewBridge;
  let mockWebview: any;
  let mockCallbacks: any;
  let mockView: any;

  beforeEach(() => {
    bridge = new SimpleWebViewBridge();
    
    mockWebview = {
      onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      postMessage: vi.fn().mockResolvedValue(true),
    };
    
    mockView = {
      webview: mockWebview,
    };
    
    mockCallbacks = {
      onWebViewReady: vi.fn(),
      onTerminalReady: vi.fn(),
      onTerminalCreationFailed: vi.fn(),
      onInput: vi.fn(),
      onResize: vi.fn(),
      onDeleteRequest: vi.fn(),
      onTerminalFocused: vi.fn(),
      onTerminalBlurred: vi.fn(),
      onTitleChange: vi.fn(),
    };
  });

  describe('View Management', () => {
    it('should set view and register message listener', () => {
      bridge.setView(mockView, mockCallbacks);
      expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should reset state on clearView', () => {
      bridge.setView(mockView, mockCallbacks);
      bridge.clearView();
      expect(bridge.isReady()).toBe(false);
    });
  });

  describe('Message Handling (Receive)', () => {
    beforeEach(() => {
      bridge.setView(mockView, mockCallbacks);
    });

    it('should handle webviewReady and notify extension', () => {
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'webviewReady' });
      
      expect(bridge.isReady()).toBe(true);
      expect(mockCallbacks.onWebViewReady).toHaveBeenCalled();
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'extensionReady'
      }));
    });

    it('should dispatch terminalReady to callbacks', () => {
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'terminalReady', terminalId: 't1', cols: 80, rows: 24 });
      
      expect(mockCallbacks.onTerminalReady).toHaveBeenCalledWith({
        terminalId: 't1',
        cols: 80,
        rows: 24
      });
    });

    it('should dispatch input to callbacks', () => {
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'input', terminalId: 't1', data: 'abc' });
      expect(mockCallbacks.onInput).toHaveBeenCalledWith('t1', 'abc');
    });

    it('should dispatch terminalFocused to callbacks', () => {
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'terminalFocused', terminalId: 't1' });
      expect(mockCallbacks.onTerminalFocused).toHaveBeenCalledWith('t1');
    });

    it('should dispatch terminalBlurred to callbacks', () => {
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'terminalBlurred', terminalId: 't1' });
      expect(mockCallbacks.onTerminalBlurred).toHaveBeenCalledWith('t1');
    });

    it('should handle unknown commands gracefully', () => {
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      // Should not throw
      handler({ command: 'unknown' });
    });
  });

  describe('Message Sending', () => {
    it('should queue messages if not ready', () => {
      bridge.setView(mockView, mockCallbacks);
      bridge.sendOutput('t1', 'hello');
      
      expect(mockWebview.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({
        command: 'output'
      }));
    });

    it('should flush queued messages when webviewReady is received', () => {
      bridge.setView(mockView, mockCallbacks);
      bridge.sendOutput('t1', 'hello');
      
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'webviewReady' });
      
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'output',
        data: 'hello'
      }));
    });

    it('should send immediately if ready', () => {
      bridge.setView(mockView, mockCallbacks);
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'webviewReady' });
      
      bridge.sendOutput('t1', 'now');
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'output',
        data: 'now'
      }));
    });
  });

  describe('Various Commands', () => {
    beforeEach(() => {
      bridge.setView(mockView, mockCallbacks);
      const handler = mockWebview.onDidReceiveMessage.mock.calls[0][0];
      handler({ command: 'webviewReady' });
    });

    it('should send createTerminal', () => {
      bridge.createTerminal('t1', 'Term 1', 1, { fontSize: 14 });
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'createTerminal',
        terminalId: 't1'
      }));
    });

    it('should send removeTerminal', () => {
      bridge.removeTerminal('t1');
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'removeTerminal'
      }));
    });

    it('should send focusTerminal', () => {
      bridge.focusTerminal('t1');
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'focusTerminal'
      }));
    });

    it('should send updateTheme', () => {
      bridge.updateTheme({ '--bg': '#000' });
      expect(mockWebview.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'updateTheme'
      }));
    });
  });
});
