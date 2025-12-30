import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  MessageRouter, 
  MessageSender, 
  MessageValidator,
  createWebViewMessageListener
} from '../../../../../webview/utils/MessageHandlingUtils';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('MessageHandlingUtils', () => {
  describe('MessageRouter', () => {
    let router: MessageRouter;

    beforeEach(() => {
      router = new MessageRouter('Test');
    });

    it('should register and route commands', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      router.register({ command: 'test', handler });

      const result = await router.route('test', { data: 1 });
      
      expect(result).toBe(true);
      expect(handler).toHaveBeenCalledWith({ data: 1 });
    });

    it('should return false for unknown commands', async () => {
      const result = await router.route('unknown', {});
      expect(result).toBe(false);
    });

    it('should handle handler errors', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Fail'));
      router.register({ command: 'fail', handler });

      const result = await router.route('fail', {});
      
      expect(result).toBe(false); // Should return false on error based on implementation
    });

    it('should clear handlers', () => {
      router.register({ command: 'test', handler: vi.fn() });
      router.clear();
      expect(router.getRegisteredCommands()).toEqual([]);
    });
  });

  describe('createWebViewMessageListener', () => {
    it('should route messages', async () => {
      const router = new MessageRouter('Test');
      const handler = vi.fn();
      router.register({ command: 'test', handler });
      
      const listener = createWebViewMessageListener(router);
      
      const event = new MessageEvent('message', {
        data: { command: 'test', payload: 'data' }
      });
      
      await listener(event);
      
      expect(handler).toHaveBeenCalledWith({ payload: 'data' });
    });

    it('should call onUnhandled if not routed', async () => {
      const router = new MessageRouter('Test');
      const onUnhandled = vi.fn();
      
      const listener = createWebViewMessageListener(router, onUnhandled);
      
      const event = new MessageEvent('message', {
        data: { command: 'unknown' }
      });
      
      await listener(event);
      
      expect(onUnhandled).toHaveBeenCalledWith(event);
    });
  });

  describe('MessageSender', () => {
    it('should post messages to vscode api', () => {
      const mockPostMessage = vi.fn();
      const sender = new MessageSender({ postMessage: mockPostMessage } as any, 'Test');
      
      sender.send('test', { foo: 'bar' });
      
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'test', foo: 'bar' });
    });

    it('should send sequential messages', () => {
      const mockPostMessage = vi.fn();
      const sender = new MessageSender({ postMessage: mockPostMessage } as any, 'Test');
      
      sender.sendSequential([
        { command: 'cmd1' },
        { command: 'cmd2', data: { val: 2 } }
      ]);
      
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      expect(mockPostMessage).toHaveBeenNthCalledWith(1, { command: 'cmd1' });
      expect(mockPostMessage).toHaveBeenNthCalledWith(2, { command: 'cmd2', val: 2 });
    });

    it('should check condition in sendIf', () => {
      const mockPostMessage = vi.fn();
      const sender = new MessageSender({ postMessage: mockPostMessage } as any, 'Test');
      
      sender.sendIf(true, 'trueCmd');
      sender.sendIf(false, 'falseCmd');
      sender.sendIf(() => true, 'funcTrueCmd');
      
      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'trueCmd' });
      expect(mockPostMessage).toHaveBeenCalledWith({ command: 'funcTrueCmd' });
    });
  });

  describe('MessageValidator', () => {
    it('should validate required fields', () => {
      const result = MessageValidator.validateRequired({ a: 1 }, ['a', 'b']);
      expect(result.isValid).toBe(false);
      expect(result.missingFields).toEqual(['b']);
      
      const resultValid = MessageValidator.validateRequired({ a: 1, b: 2 }, ['a', 'b']);
      expect(resultValid.isValid).toBe(true);
    });

    it('should validate terminal ID', () => {
      expect(MessageValidator.validateTerminalId('term-1')).toBe(true);
      expect(MessageValidator.validateTerminalId('')).toBe(false);
      expect(MessageValidator.validateTerminalId(123)).toBe(false);
    });

    it('should validate range', () => {
      expect(MessageValidator.validateRange(5, 0, 10)).toBe(true);
      expect(MessageValidator.validateRange(-1, 0, 10)).toBe(false);
      expect(MessageValidator.validateRange(11, 0, 10)).toBe(false);
      expect(MessageValidator.validateRange('5', 0, 10)).toBe(false);
    });
  });
});
