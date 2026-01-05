/**
 * WebViewPersistenceService Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebViewPersistenceService } from '../../../../../webview/services/WebViewPersistenceService';
import { Terminal } from '@xterm/xterm';

// Mock dependencies
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    loadAddon = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onLineFeed = vi.fn().mockReturnValue({ dispose: vi.fn() });
    hasSelection = vi.fn().mockReturnValue(false);
    textarea = {};
    cols = 80;
    rows = 24;
    buffer = { active: { cursorX: 0, cursorY: 0, viewportY: 0 } };
    write = vi.fn((data, cb) => cb?.());
    scrollToBottom = vi.fn();
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-serialize', () => {
  class MockSerializeAddon {
    serialize = vi.fn().mockReturnValue('mocked-serialized-content');
  }
  return { SerializeAddon: MockSerializeAddon };
});

// Mock logger
vi.mock('../../../../../webview/utils/logger', () => ({
  webview: vi.fn(),
}));

describe('WebViewPersistenceService', () => {
  let service: WebViewPersistenceService;
  let mockTerminal: any;

  beforeEach(() => {
    vi.useFakeTimers();
    // Setup window.vscodeApi
    (window as any).vscodeApi = {
      postMessage: vi.fn(),
      getState: vi.fn(),
      setState: vi.fn(),
    };
    
    service = new WebViewPersistenceService();
    mockTerminal = new Terminal();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('addTerminal', () => {
    it('should register terminal and setup auto-save', () => {
      service.addTerminal('t1', mockTerminal);
      
      expect(service.hasTerminal('t1')).toBe(true);
      expect(mockTerminal.loadAddon).toHaveBeenCalled();
      expect(mockTerminal.onData).toHaveBeenCalled();
    });
  });

  describe('serializeTerminal', () => {
    it('should return serialized data with metadata', () => {
      service.addTerminal('t1', mockTerminal);
      const data = service.serializeTerminal('t1');
      
      expect(data).toBeTruthy();
      expect(data?.content).toBe('mocked-serialized-content');
      expect(data?.metadata.dimensions.cols).toBe(80);
    });
  });

  describe('restoreTerminalContent', () => {
    it('should write content back to terminal', () => {
      service.addTerminal('t1', mockTerminal);
      const success = service.restoreTerminalContent('t1', 'line1\nline2');
      
      expect(success).toBe(true);
      expect(mockTerminal.write).toHaveBeenCalledWith(expect.stringContaining('line1'), expect.any(Function));
    });
  });

  describe('saveSession', () => {
    it('should push message to extension', async () => {
      service.addTerminal('t1', mockTerminal);
      await service.saveSession();
      
      expect((window as any).vscodeApi.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'pushScrollbackData',
        terminalId: 't1'
      }));
    });
  });

  describe('Auto-Save', () => {
    it('should trigger save after data event and debounce delay', () => {
      service.addTerminal('t1', mockTerminal);
      const onDataHandler = mockTerminal.onData.mock.calls[0][0];
      
      onDataHandler('input');
      
      // Debounce delay is 3000ms
      vi.advanceTimersByTime(3000);
      
      expect((window as any).vscodeApi.postMessage).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should stop timers and clear references', () => {
      service.addTerminal('t1', mockTerminal);
      service.dispose();
      
      expect(service.getAvailableTerminals().length).toBe(0);
    });
  });
});
