import { describe, it, expect } from 'vitest';
import { PerformanceManager } from '../../../../../webview/managers/PerformanceManager';


import { ResizeManager } from '../../../../../webview/utils/ResizeManager';
import { DOMUtils } from '../../../../../webview/utils/DOMUtils';

// Mock ResizeManager
vi.mock('../../../../../webview/utils/ResizeManager', () => ({
  ResizeManager: {
    debounceResize: vi.fn(),
    clearResize: vi.fn(),
  },
}));

// Mock DOMUtils
vi.mock('../../../../../webview/utils/DOMUtils', () => ({
  DOMUtils: {
    resetXtermInlineStyles: vi.fn(),
  },
}));

// Mock BaseManager
vi.mock('../../../../../webview/managers/BaseManager', () => {
  return {
    BaseManager: class {
      protected logger = vi.fn();
      protected dispose() {}
    },
  };
});

describe('PerformanceManager', () => {
  let manager: PerformanceManager;
  let mockTerminal: any;
  let mockCoordinator: any;
  let mockFitAddon: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockTerminal = {
      write: vi.fn(),
      resize: vi.fn(),
      buffer: {
        active: {
          cursorX: 10,
          cursorY: 5,
        },
      },
      element: {
        parentElement: {},
      },
    };

    mockCoordinator = {
      postMessageToExtension: vi.fn(),
    };

    mockFitAddon = {
      fit: vi.fn(),
    };

    manager = new PerformanceManager();
    manager.initializePerformance(mockCoordinator);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('bufferedWrite', () => {
    it('should write data to terminal', () => {
      manager.bufferedWrite('test data', mockTerminal, 'term-1');

      // 'test data' is length 9, which is <= 10 (isSmallInput), so it should flush immediately
      expect(mockTerminal.write).toHaveBeenCalledWith('test data');
    });

    it('should handle DSR query', () => {
      const dsrQuery = '\x1b[6n';
      manager.bufferedWrite(dsrQuery, mockTerminal, 'term-1');

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'input',
          terminalId: 'term-1',
          data: '\x1b[6;11R', // row 6 (5+1), col 11 (10+1)
        })
      );
    });

    it('should buffer moderate output if not urgent', () => {
        // Create a moderate output that isn't "small" but not "large" enough to force flush immediately
        // isSmallInput <= 10
        // isModerateOutput >= 50
        // isLargeOutput >= 500
        const data = 'a'.repeat(40); 
        manager.bufferedWrite(data, mockTerminal, 'term-1');
        
        expect(mockTerminal.write).not.toHaveBeenCalled();
        
        vi.advanceTimersByTime(100); // Advance time to trigger flush (default ~16ms)
        expect(mockTerminal.write).toHaveBeenCalledWith(data);
    });
  });
  
  describe('scheduleOutputBuffer', () => {
      it('should flush immediately for small input', () => {
          const smallInput = 'cmd';
          manager.scheduleOutputBuffer(smallInput, mockTerminal);
          expect(mockTerminal.write).toHaveBeenCalledWith(smallInput);
      });

      it('should flush immediately for large output', () => {
          const largeOutput = 'a'.repeat(600);
          manager.scheduleOutputBuffer(largeOutput, mockTerminal);
          expect(mockTerminal.write).toHaveBeenCalledWith(largeOutput);
      });
  });

  describe('debouncedResize', () => {
    it('should use ResizeManager to debounce resize', () => {
      manager.debouncedResize(100, 50, mockTerminal, mockFitAddon);

      expect(ResizeManager.debounceResize).toHaveBeenCalled();
      
      // Simulate the callback execution
      const callback = vi.mocked(ResizeManager.debounceResize).mock.calls[0][1];
      callback();

      expect(mockTerminal.resize).toHaveBeenCalledWith(100, 50);
      expect(DOMUtils.resetXtermInlineStyles).toHaveBeenCalled();
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });
  });

  describe('CliAgentMode', () => {
      it('should set and get mode', () => {
          expect(manager.getCliAgentMode()).toBe(false);
          manager.setCliAgentMode(true);
          expect(manager.getCliAgentMode()).toBe(true);
      });

      it('should flush buffer when disabling cli agent mode', () => {
        manager.setCliAgentMode(true);
        const data = 'a'.repeat(40);
        manager.bufferedWrite(data, mockTerminal, 'term-1');
        
        // Should be buffered
        expect(mockTerminal.write).not.toHaveBeenCalled();

        manager.setCliAgentMode(false);
        expect(mockTerminal.write).toHaveBeenCalledWith(data);
      });
  });

  describe('forceFlush', () => {
      it('should flush all buffers', () => {
          const data = 'a'.repeat(40);
          manager.bufferedWrite(data, mockTerminal, 'term-1');
          expect(mockTerminal.write).not.toHaveBeenCalled();

          manager.forceFlush();
          expect(mockTerminal.write).toHaveBeenCalledWith(data);
      });
  });

  describe('clearBuffers', () => {
      it('should clear buffers without writing', () => {
           const data = 'a'.repeat(40);
          manager.bufferedWrite(data, mockTerminal, 'term-1');
          
          manager.clearBuffers();
          vi.advanceTimersByTime(100);
          
          expect(mockTerminal.write).not.toHaveBeenCalled();
      });

      it('should clear CLI mode timeout buffers without throwing', () => {
          manager.setCliAgentMode(true);
          const data = 'a'.repeat(40);
          manager.bufferedWrite(data, mockTerminal, 'term-1');

          expect(() => manager.clearBuffers()).not.toThrow();
          vi.advanceTimersByTime(100);
          expect(mockTerminal.write).not.toHaveBeenCalled();
      });
  });

  describe('getBufferStats', () => {
    it('should return correct stats', () => {
        const data = 'a'.repeat(40);
        manager.bufferedWrite(data, mockTerminal, 'term-1');
        
        const stats = manager.getBufferStats();
        expect(stats.bufferSize).toBe(1);
        expect(stats.isFlushScheduled).toBe(true);
        expect(stats.currentTerminal).toBe(true);
    });
  });
});
