/**
 * DebugMessageHandler Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode (required by logger)
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
}));

// Mock logger to verify log calls
vi.mock('../../../../../utils/logger', () => ({
  provider: vi.fn(),
}));

import {
  DebugMessageHandler,
  IDebugMessageHandlerDependencies,
} from '../../../../../providers/handlers/DebugMessageHandler';
import { WebviewMessage } from '../../../../../types/common';
import { provider as log } from '../../../../../utils/logger';

function createMockDeps(isDebugEnabled = false): IDebugMessageHandlerDependencies {
  return {
    isDebugEnabled: vi.fn().mockReturnValue(isDebugEnabled),
  };
}

describe('DebugMessageHandler', () => {
  let handler: DebugMessageHandler;
  let deps: IDebugMessageHandlerDependencies;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    handler = new DebugMessageHandler(deps);
  });

  describe('handleHtmlScriptTest', () => {
    it('should log debug message with message content', () => {
      const message = { command: 'htmlScriptTest', data: 'test' } as unknown as WebviewMessage;

      handler.handleHtmlScriptTest(message);

      expect(log).toHaveBeenCalledWith(
        '🔥 [DEBUG] ========== HTML INLINE SCRIPT TEST MESSAGE RECEIVED =========='
      );
      expect(log).toHaveBeenCalledWith('🔥 [DEBUG] HTML script communication is working!');
      expect(log).toHaveBeenCalledWith('🔥 [DEBUG] Message content:', message);
    });
  });

  describe('handleTimeoutTest', () => {
    it('should log debug message with message content', () => {
      const message = { command: 'timeoutTest', data: 'test' } as unknown as WebviewMessage;

      handler.handleTimeoutTest(message);

      expect(log).toHaveBeenCalledWith(
        '🔥 [DEBUG] ========== HTML TIMEOUT TEST MESSAGE RECEIVED =========='
      );
      expect(log).toHaveBeenCalledWith('🔥 [DEBUG] Timeout test communication is working!');
      expect(log).toHaveBeenCalledWith('🔥 [DEBUG] Message content:', message);
    });
  });

  describe('handleDebugTest', () => {
    it('should log init complete when message type is initComplete', () => {
      const message = {
        command: 'test',
        type: 'initComplete',
      } as unknown as WebviewMessage;

      handler.handleDebugTest(message);

      expect(log).toHaveBeenCalledWith('🎆 [TRACE] ===============================');
      expect(log).toHaveBeenCalledWith('🎆 [TRACE] WEBVIEW CONFIRMS INIT COMPLETE!');
    });

    it('should log message data when debug is enabled', () => {
      const debugDeps = createMockDeps(true);
      const debugHandler = new DebugMessageHandler(debugDeps);
      const message = {
        command: 'test',
        type: 'initComplete',
      } as unknown as WebviewMessage;

      debugHandler.handleDebugTest(message);

      expect(log).toHaveBeenCalledWith('🎆 [TRACE] Message data:', message);
    });

    it('should not log message data when debug is disabled', () => {
      const message = {
        command: 'test',
        type: 'initComplete',
      } as unknown as WebviewMessage;

      handler.handleDebugTest(message);

      expect(log).not.toHaveBeenCalledWith('🎆 [TRACE] Message data:', message);
    });

    it('should not log anything when message type is not initComplete', () => {
      const message = {
        command: 'test',
        type: 'other',
      } as unknown as WebviewMessage;

      handler.handleDebugTest(message);

      expect(log).not.toHaveBeenCalledWith('🎆 [TRACE] ===============================');
    });

    it('should handle missing dependencies gracefully', () => {
      const noDepsHandler = new DebugMessageHandler();
      const message = {
        command: 'test',
        type: 'initComplete',
      } as unknown as WebviewMessage;

      // Should not throw
      noDepsHandler.handleDebugTest(message);
    });
  });
});
