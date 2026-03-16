import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InputDetectionProcessor } from '../../../../services/InputDetectionProcessor';

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('InputDetectionProcessor', () => {
  type StrategyRegistryStub = {
    getAllStrategies: ReturnType<typeof vi.fn>;
    getSupportedAgentTypes: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  type InputDetectionProcessorTestAccess = InputDetectionProcessor & {
    strategyRegistry: StrategyRegistryStub;
  };

  let processor: InputDetectionProcessor;
  let processorTestAccess: InputDetectionProcessorTestAccess;
  let stateManager: {
    isAgentConnected: ReturnType<typeof vi.fn>;
    getConnectedAgentType: ReturnType<typeof vi.fn>;
    setConnectedAgent: ReturnType<typeof vi.fn>;
  };
  let strategyRegistry: StrategyRegistryStub;

  beforeEach(() => {
    stateManager = {
      isAgentConnected: vi.fn().mockReturnValue(false),
      getConnectedAgentType: vi.fn().mockReturnValue(null),
      setConnectedAgent: vi.fn(),
    };

    processor = new InputDetectionProcessor(stateManager as never);
    processorTestAccess = processor as InputDetectionProcessorTestAccess;

    strategyRegistry = {
      getAllStrategies: vi.fn().mockReturnValue([]),
      getSupportedAgentTypes: vi.fn().mockReturnValue(['claude', 'gemini']),
      dispose: vi.fn(),
    };

    processorTestAccess.strategyRegistry = strategyRegistry;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips empty input without consulting strategies or state', () => {
    expect(processor.processInput('terminal-1', '   ')).toBeNull();

    expect(stateManager.isAgentConnected).not.toHaveBeenCalled();
    expect(strategyRegistry.getAllStrategies).not.toHaveBeenCalled();
    expect(stateManager.setConnectedAgent).not.toHaveBeenCalled();
  });

  it('connects the detected agent and returns trimmed input details', () => {
    const claudeStrategy = {
      agentType: 'claude',
      detectFromInput: vi.fn().mockReturnValue({
        isDetected: true,
        confidence: 0.91,
      }),
      detectFromOutput: vi.fn(),
      isAgentActivity: vi.fn(),
    };

    strategyRegistry.getAllStrategies.mockReturnValue([claudeStrategy]);
    stateManager.isAgentConnected.mockReturnValue(true);
    stateManager.getConnectedAgentType.mockReturnValue('gemini');

    const result = processor.processInput('terminal-1', '  claude --resume  ');

    expect(claudeStrategy.detectFromInput).toHaveBeenCalledWith('claude --resume');
    expect(stateManager.setConnectedAgent).toHaveBeenCalledWith('terminal-1', 'claude');
    expect(result).toEqual({
      type: 'claude',
      confidence: 0.91,
      source: 'input',
      detectedLine: 'claude --resume',
    });
  });

  it('prefers a strategy-provided detected line over the trimmed input', () => {
    const codexStrategy = {
      agentType: 'codex',
      detectFromInput: vi.fn().mockReturnValue({
        isDetected: true,
        confidence: 0.88,
        detectedLine: 'codex --model gpt-5',
      }),
      detectFromOutput: vi.fn(),
      isAgentActivity: vi.fn(),
    };

    strategyRegistry.getAllStrategies.mockReturnValue([codexStrategy]);

    const result = processor.processInput('terminal-2', ' codex ');

    expect(result).toEqual({
      type: 'codex',
      confidence: 0.88,
      source: 'input',
      detectedLine: 'codex --model gpt-5',
    });
  });

  it('returns null when no strategy detects an agent command', () => {
    const result = processor.processInput('terminal-3', 'ls -la');

    expect(result).toBeNull();
    expect(strategyRegistry.getAllStrategies).toHaveBeenCalledTimes(1);
    expect(stateManager.setConnectedAgent).not.toHaveBeenCalled();
  });

  it('delegates supported agent type lookup to the strategy registry', () => {
    expect(processor.getSupportedAgentTypes()).toEqual(['claude', 'gemini']);
    expect(strategyRegistry.getSupportedAgentTypes).toHaveBeenCalledTimes(1);
  });

  it('disposes the strategy registry only once', () => {
    processor.dispose();
    processor.dispose();

    expect(strategyRegistry.dispose).toHaveBeenCalledTimes(1);
  });
});
