import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OutputDetectionProcessor } from '../../../../services/OutputDetectionProcessor';

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('OutputDetectionProcessor', () => {
  type StrategyRegistryStub = {
    getAllStrategies: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  type PatternDetectorStub = {
    cleanAnsiEscapeSequences: ReturnType<typeof vi.fn>;
  };
  type OutputDetectionProcessorTestAccess = OutputDetectionProcessor & {
    strategyRegistry: StrategyRegistryStub;
    patternDetector: PatternDetectorStub;
  };

  let processor: OutputDetectionProcessor;
  let processorTestAccess: OutputDetectionProcessorTestAccess;
  let stateManager: {
    isAgentConnected: ReturnType<typeof vi.fn>;
    getDisconnectedAgents: ReturnType<typeof vi.fn>;
    setConnectedAgent: ReturnType<typeof vi.fn>;
  };
  let terminationDetector: {
    detectStrictTermination: ReturnType<typeof vi.fn>;
    validateTerminationSignal: ReturnType<typeof vi.fn>;
  };
  let detectionCache: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let strategyRegistry: StrategyRegistryStub;
  let patternDetector: PatternDetectorStub;

  beforeEach(() => {
    stateManager = {
      isAgentConnected: vi.fn().mockReturnValue(false),
      getDisconnectedAgents: vi.fn().mockReturnValue(new Map()),
      setConnectedAgent: vi.fn(),
    };

    terminationDetector = {
      detectStrictTermination: vi.fn().mockReturnValue({
        isTerminated: false,
        confidence: 0,
        reason: 'none',
      }),
      validateTerminationSignal: vi.fn().mockReturnValue(false),
    };

    detectionCache = {
      set: vi.fn(),
      get: vi.fn(),
      clear: vi.fn(),
    };

    processor = new OutputDetectionProcessor(
      stateManager as never,
      terminationDetector as never,
      detectionCache as never
    );
    processorTestAccess = processor as OutputDetectionProcessorTestAccess;

    strategyRegistry = {
      getAllStrategies: vi.fn().mockReturnValue([]),
      dispose: vi.fn(),
    };

    patternDetector = {
      cleanAnsiEscapeSequences: vi.fn((line: string) => line),
    };

    processorTestAccess.strategyRegistry = strategyRegistry;
    processorTestAccess.patternDetector = patternDetector;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects startup output after stripping box characters', () => {
    const claudeStrategy = {
      agentType: 'claude',
      detectFromInput: vi.fn(),
      detectFromOutput: vi.fn((line: string) => line === 'Claude Code'),
      isAgentActivity: vi.fn().mockReturnValue(false),
    };

    strategyRegistry.getAllStrategies.mockReturnValue([claudeStrategy]);

    const result = processor.processOutput('terminal-1', '│ Claude Code │');

    expect(patternDetector.cleanAnsiEscapeSequences).toHaveBeenCalledWith('│ Claude Code │');
    expect(claudeStrategy.detectFromOutput).toHaveBeenCalledWith('Claude Code');
    expect(stateManager.setConnectedAgent).toHaveBeenCalledWith('terminal-1', 'claude');
    expect(result).toEqual({
      type: 'claude',
      confidence: 0.9,
      source: 'output',
      detectedLine: 'Claude Code',
    });
  });

  it('tracks recent AI activity for long output even without a startup match', () => {
    const idleStrategy = {
      agentType: 'claude',
      detectFromInput: vi.fn(),
      detectFromOutput: vi.fn().mockReturnValue(false),
      isAgentActivity: vi.fn().mockReturnValue(false),
    };

    strategyRegistry.getAllStrategies.mockReturnValue([idleStrategy]);
    vi.spyOn(Date, 'now').mockReturnValue(1234);

    expect(processor.processOutput('terminal-2', 'x'.repeat(60))).toBeNull();
    expect(detectionCache.set).toHaveBeenCalledWith('terminal-2_lastAIOutput', {
      result: null,
      timestamp: 1234,
    });
  });

  it('checks termination for connected agents and skips startup detection afterwards', () => {
    const strategy = {
      agentType: 'claude',
      detectFromInput: vi.fn(),
      detectFromOutput: vi.fn().mockReturnValue(true),
      isAgentActivity: vi.fn().mockReturnValue(false),
    };

    stateManager.isAgentConnected.mockReturnValue(true);
    strategyRegistry.getAllStrategies.mockReturnValue([strategy]);
    terminationDetector.detectStrictTermination.mockReturnValue({
      isTerminated: true,
      confidence: 1,
      reason: 'prompt',
    });
    terminationDetector.validateTerminationSignal.mockReturnValue(true);

    expect(processor.processOutput('terminal-3', 'user@host:~$ ')).toBeNull();

    expect(terminationDetector.detectStrictTermination).toHaveBeenCalledWith(
      'terminal-3',
      'user@host:~$ '
    );
    expect(terminationDetector.validateTerminationSignal).toHaveBeenCalledWith(
      'terminal-3',
      'user@host:~$',
      expect.objectContaining({ isTerminated: true })
    );
    expect(strategy.detectFromOutput).not.toHaveBeenCalled();
    expect(stateManager.setConnectedAgent).not.toHaveBeenCalled();
  });

  it('handles disconnected-agent termination before startup detection', () => {
    const strategy = {
      agentType: 'gemini',
      detectFromInput: vi.fn(),
      detectFromOutput: vi.fn().mockReturnValue(true),
      isAgentActivity: vi.fn().mockReturnValue(false),
    };

    stateManager.getDisconnectedAgents.mockReturnValue(
      new Map([
        [
          'terminal-4',
          {
            type: 'claude',
            startTime: new Date(),
          },
        ],
      ])
    );
    strategyRegistry.getAllStrategies.mockReturnValue([strategy]);
    terminationDetector.detectStrictTermination.mockReturnValue({
      isTerminated: true,
      confidence: 0.8,
      reason: 'prompt',
    });
    terminationDetector.validateTerminationSignal.mockReturnValue(true);

    expect(processor.processOutput('terminal-4', 'shell prompt')).toBeNull();

    expect(terminationDetector.detectStrictTermination).toHaveBeenCalledWith(
      'terminal-4',
      'shell prompt'
    );
    expect(strategy.detectFromOutput).not.toHaveBeenCalled();
    expect(stateManager.setConnectedAgent).not.toHaveBeenCalled();
  });

  it('returns null when output processing throws', () => {
    const invokeWithUnexpectedData = processor.processOutput as (
      terminalId: string,
      data: string | null
    ) => ReturnType<OutputDetectionProcessor['processOutput']>;

    expect(invokeWithUnexpectedData('terminal-5', null)).toBeNull();
  });

  it('disposes the strategy registry only once', () => {
    processor.dispose();
    processor.dispose();

    expect(strategyRegistry.dispose).toHaveBeenCalledTimes(1);
    expect(detectionCache.clear).toHaveBeenCalledTimes(1);
  });
});
