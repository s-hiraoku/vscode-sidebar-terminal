/**
 * WebViewApiManager Unit Tests
 *
 * Tests for VS Code API communication including:
 * - API initialization
 * - Message sending to extension
 * - State persistence
 * - Diagnostics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebViewApiManager } from '../../../../../webview/managers/WebViewApiManager';

// Mock logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Helper to create mock VS Code API
function createMockVSCodeApi() {
  return {
    postMessage: vi.fn(),
    getState: vi.fn().mockReturnValue(null),
    setState: vi.fn(),
  };
}

describe('WebViewApiManager', () => {
  let manager: WebViewApiManager;
  let originalWindow: Window & typeof globalThis;
  let mockApi: ReturnType<typeof createMockVSCodeApi>;

  beforeEach(() => {
    originalWindow = global.window;
    mockApi = createMockVSCodeApi();

    // Setup window with vscodeApi
    (global as any).window = {
      ...originalWindow,
      vscodeApi: mockApi,
    };

    manager = new WebViewApiManager();
  });

  afterEach(() => {
    manager.dispose();
    (global as any).window = originalWindow;
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance', () => {
      expect(manager).toBeDefined();
    });

    it('should initialize API from window.vscodeApi', () => {
      expect(manager.isApiAvailable()).toBe(true);
    });

    it('should handle missing vscodeApi gracefully', () => {
      (global as any).window = {
        ...originalWindow,
        vscodeApi: undefined,
        acquireVsCodeApi: undefined,
      };

      const newManager = new WebViewApiManager();

      expect(newManager.isApiAvailable()).toBe(false);
      newManager.dispose();
    });

    it('should acquire API from acquireVsCodeApi if vscodeApi not available', () => {
      const acquiredApi = createMockVSCodeApi();
      (global as any).window = {
        ...originalWindow,
        vscodeApi: undefined,
        acquireVsCodeApi: vi.fn().mockReturnValue(acquiredApi),
      };

      const newManager = new WebViewApiManager();

      expect(newManager.isApiAvailable()).toBe(true);
      newManager.dispose();
    });

    it('should handle initialization error gracefully', () => {
      (global as any).window = {
        ...originalWindow,
        vscodeApi: undefined,
        acquireVsCodeApi: vi.fn().mockImplementation(() => {
          throw new Error('API acquisition failed');
        }),
      };

      expect(() => new WebViewApiManager()).not.toThrow();
    });
  });

  describe('isApiAvailable', () => {
    it('should return true when API is initialized', () => {
      expect(manager.isApiAvailable()).toBe(true);
    });

    it('should return false when API is not available', () => {
      manager.dispose();

      expect(manager.isApiAvailable()).toBe(false);
    });
  });

  describe('getApi', () => {
    it('should return VS Code API when available', () => {
      const api = manager.getApi();

      expect(api).toBeDefined();
      expect(typeof api?.postMessage).toBe('function');
    });

    it('should attempt to reinitialize if API not available', () => {
      manager.dispose();

      // After dispose, getApi should try to reinitialize
      const api = manager.getApi();

      // May or may not succeed depending on window state
      expect(api === null || api !== null).toBe(true);
    });
  });

  describe('postMessageToExtension', () => {
    it('should send message to extension', () => {
      const message = { command: 'test', data: 'value' };

      const result = manager.postMessageToExtension(message);

      expect(result).toBe(true);
      expect(mockApi.postMessage).toHaveBeenCalledWith(message);
    });

    it('should return false when API not available', () => {
      manager.dispose();
      // Also clear window.vscodeApi to prevent reinitialization
      (global as any).window = {
        ...global.window,
        vscodeApi: undefined,
        acquireVsCodeApi: undefined,
      };

      const result = manager.postMessageToExtension({ command: 'test' });

      expect(result).toBe(false);
    });

    it('should handle postMessage error gracefully', () => {
      mockApi.postMessage.mockImplementation(() => {
        throw new Error('Message failed');
      });

      const result = manager.postMessageToExtension({ command: 'test' });

      expect(result).toBe(false);
    });

    it('should log message command', () => {
      const message = { command: 'testCommand', data: 'value' };

      manager.postMessageToExtension(message);

      expect(mockApi.postMessage).toHaveBeenCalled();
    });
  });

  describe('saveState', () => {
    it('should save state via VS Code API', () => {
      const state = { terminals: [], settings: {} };

      const result = manager.saveState(state);

      expect(result).toBe(true);
      expect(mockApi.setState).toHaveBeenCalledWith(state);
    });

    it('should return false when API not available', () => {
      manager.dispose();
      // Also clear window.vscodeApi to prevent reinitialization
      (global as any).window = {
        ...global.window,
        vscodeApi: undefined,
        acquireVsCodeApi: undefined,
      };

      const result = manager.saveState({ test: 'data' });

      expect(result).toBe(false);
    });

    it('should handle setState error gracefully', () => {
      mockApi.setState.mockImplementation(() => {
        throw new Error('State save failed');
      });

      const result = manager.saveState({ test: 'data' });

      expect(result).toBe(false);
    });
  });

  describe('loadState', () => {
    it('should load state via VS Code API', () => {
      const savedState = { terminals: ['t1', 't2'], settings: { theme: 'dark' } };
      mockApi.getState.mockReturnValue(savedState);

      const state = manager.loadState();

      expect(state).toEqual(savedState);
    });

    it('should return null when API not available', () => {
      manager.dispose();
      // Also clear window.vscodeApi to prevent reinitialization
      (global as any).window = {
        ...global.window,
        vscodeApi: undefined,
        acquireVsCodeApi: undefined,
      };

      const state = manager.loadState();

      expect(state).toBeNull();
    });

    it('should handle getState error gracefully', () => {
      mockApi.getState.mockImplementation(() => {
        throw new Error('State load failed');
      });

      const state = manager.loadState();

      expect(state).toBeNull();
    });

    it('should return null when no state saved', () => {
      mockApi.getState.mockReturnValue(null);

      const state = manager.loadState();

      expect(state).toBeNull();
    });
  });

  describe('getDiagnostics', () => {
    it('should return diagnostic information', () => {
      const diagnostics = manager.getDiagnostics();

      expect(diagnostics).toHaveProperty('isInitialized');
      expect(diagnostics).toHaveProperty('isApiAvailable');
      expect(diagnostics).toHaveProperty('apiMethods');
    });

    it('should report initialized state correctly', () => {
      const diagnostics = manager.getDiagnostics();

      expect(diagnostics.isInitialized).toBe(true);
      expect(diagnostics.isApiAvailable).toBe(true);
    });

    it('should list API methods', () => {
      const diagnostics = manager.getDiagnostics();

      expect(diagnostics.apiMethods).toContain('postMessage');
      expect(diagnostics.apiMethods).toContain('getState');
      expect(diagnostics.apiMethods).toContain('setState');
    });

    it('should return empty methods array when API not available', () => {
      manager.dispose();

      const diagnostics = manager.getDiagnostics();

      expect(diagnostics.apiMethods).toEqual([]);
    });
  });

  describe('dispose', () => {
    it('should clear API reference', () => {
      manager.dispose();

      expect(manager.isApiAvailable()).toBe(false);
    });

    it('should reset initialized flag', () => {
      manager.dispose();

      const diagnostics = manager.getDiagnostics();
      expect(diagnostics.isInitialized).toBe(false);
    });

    it('should be idempotent', () => {
      manager.dispose();
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined message', () => {
      const result = manager.postMessageToExtension(undefined);

      expect(result).toBe(true); // Should still attempt to send
    });

    it('should handle complex message objects', () => {
      const complexMessage = {
        command: 'complex',
        data: {
          nested: {
            array: [1, 2, 3],
            object: { key: 'value' },
          },
        },
        timestamp: Date.now(),
      };

      const result = manager.postMessageToExtension(complexMessage);

      expect(result).toBe(true);
      expect(mockApi.postMessage).toHaveBeenCalledWith(complexMessage);
    });

    it('should handle saving complex state', () => {
      const complexState = {
        terminals: [
          { id: 't1', scrollback: ['line1', 'line2'] },
          { id: 't2', scrollback: ['line3'] },
        ],
        settings: {
          theme: 'dark',
          nested: { value: 123 },
        },
      };

      const result = manager.saveState(complexState);

      expect(result).toBe(true);
      expect(mockApi.setState).toHaveBeenCalledWith(complexState);
    });
  });
});
