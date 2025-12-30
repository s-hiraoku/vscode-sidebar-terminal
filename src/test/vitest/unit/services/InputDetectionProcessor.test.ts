import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputDetectionProcessor } from '../../../../services/InputDetectionProcessor';
import { CliAgentStateManager } from '../../../../services/CliAgentStateManager';

// Mock dependencies
const mockGetAllStrategies = vi.fn();
const mockGetSupportedAgentTypes = vi.fn();
const mockDispose = vi.fn();

vi.mock('../../../../services/strategies/AgentDetectionStrategyRegistry', () => {
  return {
    AgentDetectionStrategyRegistry: class {
      getAllStrategies = mockGetAllStrategies;
      getSupportedAgentTypes = mockGetSupportedAgentTypes;
      dispose = mockDispose;
    },
  };
});

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('InputDetectionProcessor', () => {
  let processor: InputDetectionProcessor;
  let mockStateManager: CliAgentStateManager;

  beforeEach(() => {
    // Mock State Manager
    mockStateManager = {
      isAgentConnected: vi.fn().mockReturnValue(false),
      getConnectedAgentType: vi.fn().mockReturnValue(null),
      setConnectedAgent: vi.fn(),
    } as unknown as CliAgentStateManager;

    // Reset mocks
    mockGetAllStrategies.mockReturnValue([]);
    mockGetSupportedAgentTypes.mockReturnValue(['gemini', 'claude']);
    mockDispose.mockClear();

    processor = new InputDetectionProcessor(mockStateManager);
  });

  describe('processInput', () => {
    it('should return null for empty input', () => {
      expect(processor.processInput('term-1', '')).toBeNull();
      expect(processor.processInput('term-1', '   ')).toBeNull();
    });

    it('should return null if no strategy matches', () => {
      mockGetAllStrategies.mockReturnValue([
        { detectFromInput: vi.fn().mockReturnValue({ isDetected: false }) },
      ]);
      expect(processor.processInput('term-1', 'unknown command')).toBeNull();
    });

    it('should return result if strategy matches', () => {
      mockGetAllStrategies.mockReturnValue([
        { 
          agentType: 'gemini',
          detectFromInput: vi.fn().mockReturnValue({ isDetected: true, confidence: 1.0 }) 
        },
      ]);

      const result = processor.processInput('term-1', 'gemini');
      
      expect(result).not.toBeNull();
      expect(result?.type).toBe('gemini');
      expect(result?.confidence).toBe(1.0);
      expect(mockStateManager.setConnectedAgent).toHaveBeenCalledWith('term-1', 'gemini');
    });
  });

  describe('getSupportedAgentTypes', () => {
    it('should return supported types from registry', () => {
      expect(processor.getSupportedAgentTypes()).toEqual(['gemini', 'claude']);
    });
  });

  describe('dispose', () => {
    it('should dispose registry', () => {
      processor.dispose();
      expect(mockDispose).toHaveBeenCalled();
    });
  });
});
