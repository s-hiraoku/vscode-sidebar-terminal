import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitHandler } from '../../../../../../webview/managers/handlers/SplitHandler';

describe('SplitHandler', () => {
  let handler: SplitHandler;
  let mockLogger: any;
  let mockCoordinator: any;
  let mockSplitManager: any;
  let mockContainerManager: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockSplitManager = {
      splitTerminal: vi.fn(),
      terminals: new Map([['t1', {}], ['t2', {}]]),
      splitDirection: 'vertical',
    };

    mockContainerManager = {
      getContainerOrder: vi.fn().mockReturnValue(['t1', 't2']),
      applyDisplayState: vi.fn(),
    };

    mockCoordinator = {
      getSplitManager: vi.fn().mockReturnValue(mockSplitManager),
      getTerminalContainerManager: vi.fn().mockReturnValue(mockContainerManager),
      getActiveTerminalId: vi.fn().mockReturnValue('t1'),
    };

    handler = new SplitHandler(mockLogger);
  });

  it('should return supported commands', () => {
    const commands = handler.getSupportedCommands();
    expect(commands).toContain('split');
    expect(commands).toContain('relayoutTerminals');
  });

  describe('handleMessage', () => {
    it('should handle split with direction', () => {
      handler.handleMessage({ command: 'split', direction: 'horizontal' }, mockCoordinator);
      expect(mockSplitManager.splitTerminal).toHaveBeenCalledWith('horizontal');
    });

    it('should handle split with default direction', () => {
      handler.handleMessage({ command: 'split' }, mockCoordinator);
      expect(mockSplitManager.splitTerminal).toHaveBeenCalledWith('vertical');
    });

    it('should handle relayoutTerminals', () => {
      handler.handleMessage({ command: 'relayoutTerminals', direction: 'horizontal' }, mockCoordinator);
      
      expect(mockSplitManager.splitDirection).toBe('horizontal');
      expect(mockContainerManager.applyDisplayState).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'split',
        splitDirection: 'horizontal'
      }));
    });

    it('should skip relayout if less than 2 terminals', () => {
      mockSplitManager.terminals = new Map([['t1', {}]]);
      handler.handleMessage({ command: 'relayoutTerminals' }, mockCoordinator);
      
      expect(mockContainerManager.applyDisplayState).not.toHaveBeenCalled();
    });

    it('should warn if SplitManager is missing', () => {
      mockCoordinator.getSplitManager.mockReturnValue(null);
      handler.handleMessage({ command: 'split' }, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('SplitManager not available'));
    });
  });
});
