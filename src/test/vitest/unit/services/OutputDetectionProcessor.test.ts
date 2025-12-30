import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutputDetectionProcessor } from '../../../../services/OutputDetectionProcessor';
import { CliAgentStateManager } from '../../../../services/CliAgentStateManager';
import { CliAgentTerminationDetector } from '../../../../services/CliAgentTerminationDetector';
import { LRUCache } from '../../../../utils/LRUCache';

// Mock module dependencies
const mockCleanAnsiEscapeSequences = vi.fn((s) => s.trim());
const mockPatternDetectorDispose = vi.fn();

vi.mock('../../../../services/CliAgentPatternDetector', () => {
  return {
    CliAgentPatternDetector: class {
      cleanAnsiEscapeSequences = mockCleanAnsiEscapeSequences;
      dispose = mockPatternDetectorDispose;
    },
  };
});

const mockGetAllStrategies = vi.fn();
const mockRegistryDispose = vi.fn();

vi.mock('../../../../services/strategies/AgentDetectionStrategyRegistry', () => {
  return {
    AgentDetectionStrategyRegistry: class {
      getAllStrategies = mockGetAllStrategies;
      dispose = mockRegistryDispose;
    },
  };
});

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('OutputDetectionProcessor', () => {
  let processor: OutputDetectionProcessor;
  let mockStateManager: CliAgentStateManager;
  let mockTerminationDetector: CliAgentTerminationDetector;
  let mockCache: LRUCache<string, any>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockCleanAnsiEscapeSequences.mockImplementation((s) => s.trim());
    mockGetAllStrategies.mockReturnValue([]);

    // Mock params
    mockStateManager = {
      isAgentConnected: vi.fn().mockReturnValue(false),
      getDisconnectedAgents: vi.fn().mockReturnValue(new Set()),
      setConnectedAgent: vi.fn(),
    } as unknown as CliAgentStateManager;

    mockTerminationDetector = {
      detectStrictTermination: vi.fn().mockReturnValue({ isTerminated: false }),
      validateTerminationSignal: vi.fn().mockReturnValue(false),
    } as unknown as CliAgentTerminationDetector;

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
    } as unknown as LRUCache<string, any>;

    processor = new OutputDetectionProcessor(
      mockStateManager,
      mockTerminationDetector,
      mockCache
    );
  });

  describe('processOutput', () => {
    it('should return null for empty output', () => {
      expect(processor.processOutput('term-1', '')).toBeNull();
      expect(processor.processOutput('term-1', '   ')).toBeNull();
    });

    it('should detect startup patterns for non-connected agents', () => {
      mockGetAllStrategies.mockReturnValue([
        { 
          agentType: 'gemini',
          detectFromOutput: vi.fn().mockReturnValue(true),
          isAgentActivity: vi.fn().mockReturnValue(true),
        },
      ]);

      const result = processor.processOutput('term-1', 'Welcome to Gemini');
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('gemini');
      expect(mockStateManager.setConnectedAgent).toHaveBeenCalledWith('term-1', 'gemini');
    });

    it('should handle connected agent termination', () => {
      mockStateManager.isAgentConnected = vi.fn().mockReturnValue(true);
      mockTerminationDetector.detectStrictTermination = vi.fn().mockReturnValue({ 
        isTerminated: true, 
        confidence: 1.0 
      });
      mockTerminationDetector.validateTerminationSignal = vi.fn().mockReturnValue(true);

      const result = processor.processOutput('term-1', 'session ended');
      
      expect(result).toBeNull();
      expect(mockTerminationDetector.validateTerminationSignal).toHaveBeenCalled();
    });

    it('should handle disconnected agent termination', () => {
       mockStateManager.getDisconnectedAgents = vi.fn().mockReturnValue(new Set(['term-1']));
       
       mockTerminationDetector.detectStrictTermination = vi.fn().mockReturnValue({ 
        isTerminated: true, 
        confidence: 1.0 
      });
      mockTerminationDetector.validateTerminationSignal = vi.fn().mockReturnValue(true);

      const result = processor.processOutput('term-1', 'session ended');
      
      expect(result).toBeNull();
      expect(mockTerminationDetector.validateTerminationSignal).toHaveBeenCalled();
    });

    it('should update AI activity timestamp', () => {
       mockGetAllStrategies.mockReturnValue([
        { 
          agentType: 'gemini',
          detectFromOutput: vi.fn().mockReturnValue(true),
          isAgentActivity: vi.fn().mockReturnValue(true),
        },
      ]);
      
      processor.processOutput('term-1', 'Some AI output');
      expect(mockCache.set).toHaveBeenCalledWith('term-1_lastAIOutput', expect.any(Object));
    });
  });

  describe('dispose', () => {
    it('should dispose resources', () => {
      processor.dispose();
      expect(mockPatternDetectorDispose).toHaveBeenCalled();
      expect(mockRegistryDispose).toHaveBeenCalled();
      expect(mockCache.clear).toHaveBeenCalled();
    });
  });
});
