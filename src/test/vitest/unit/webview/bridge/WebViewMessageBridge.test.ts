/**
 * WebViewMessageBridge Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebViewMessageBridge } from '../../../../../webview/bridge/WebViewMessageBridge';

describe('WebViewMessageBridge', () => {
  let bridge: WebViewMessageBridge;
  let mockVscodeApi: any;

  beforeEach(() => {
    mockVscodeApi = {
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    };
    
    vi.stubGlobal('acquireVsCodeApi', () => mockVscodeApi);
    bridge = new WebViewMessageBridge();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('Message Sending', () => {
    it('should send message to extension', () => {
      const msg = { command: 'test' };
      bridge.sendMessage(msg);
      expect(mockVscodeApi.postMessage).toHaveBeenCalledWith(msg);
    });
  });

  describe('Handler Registration', () => {
    it('should register and unregister handlers', () => {
      const handler = vi.fn();
      bridge.registerHandler('cmd', handler);
      
      expect(bridge.getHandlerCount()).toBe(1);
      expect(bridge.getRegisteredCommands()).toContain('cmd');
      
      bridge.unregisterHandler('cmd');
      expect(bridge.getHandlerCount()).toBe(0);
    });
  });

  describe('Message Processing', () => {
    it('should process message with registered handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      bridge.registerHandler('cmd', handler);
      
      const msg = { command: 'cmd' };
      const result = await bridge.processMessage(msg);
      
      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(msg);
    });

    it('should return failure if no handler registered', async () => {
      const result = await bridge.processMessage({ command: 'unknown' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No handler registered');
    });

    it('should handle errors in handlers', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Fail'));
      bridge.registerHandler('fail', handler);
      
      const result = await bridge.processMessage({ command: 'fail' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Fail');
    });
  });

  describe('Lifecycle', () => {
    it('should set ready state on initialize', async () => {
      expect(bridge.isReady()).toBe(false);
      await bridge.initialize();
      expect(bridge.isReady()).toBe(true);
    });

    it('should reset on dispose', () => {
      bridge.registerHandler('t', vi.fn());
      bridge.dispose();
      expect(bridge.getHandlerCount()).toBe(0);
      expect(bridge.isReady()).toBe(false);
    });
  });
});
