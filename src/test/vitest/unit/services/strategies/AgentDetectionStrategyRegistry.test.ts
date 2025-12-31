import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentDetectionStrategyRegistry } from '../../../../../services/strategies/AgentDetectionStrategyRegistry';
import { AgentDetectionStrategy } from '../../../../../services/strategies/AgentDetectionStrategy';

// Mock strategy implementations
class MockStrategy implements AgentDetectionStrategy {
  constructor(public agentType: 'claude' | 'gemini' | 'codex' | 'copilot' | any) {}
  detectFromInput = vi.fn().mockReturnValue({ isDetected: false });
  detectFromOutput = vi.fn().mockReturnValue(false);
  isAgentActivity = vi.fn().mockReturnValue(false);
}

describe('AgentDetectionStrategyRegistry', () => {
  let registry: AgentDetectionStrategyRegistry;

  beforeEach(() => {
    registry = new AgentDetectionStrategyRegistry();
  });

  afterEach(() => {
    registry.dispose();
  });

  it('should register default strategies on initialization', () => {
    expect(registry.isSupported('claude')).toBe(true);
    expect(registry.isSupported('gemini')).toBe(true);
    expect(registry.isSupported('codex')).toBe(true);
    expect(registry.isSupported('copilot')).toBe(true);
  });

  it('should register a new strategy', () => {
    const customStrategy = new MockStrategy('custom');
    registry.register(customStrategy);
    expect(registry.isSupported('custom')).toBe(true);
    expect(registry.getStrategy('custom')).toBe(customStrategy);
  });

  it('should get a strategy by type', () => {
    const strategy = registry.getStrategy('claude');
    expect(strategy).toBeDefined();
    expect(strategy?.agentType).toBe('claude');
  });

  it('should return undefined for unknown strategy type', () => {
    expect(registry.getStrategy('unknown')).toBeUndefined();
  });

  it('should return all registered strategies', () => {
    const strategies = registry.getAllStrategies();
    expect(strategies.length).toBeGreaterThanOrEqual(4); // At least defaults
    expect(strategies.some(s => s.agentType === 'claude')).toBe(true);
  });

  it('should return all supported agent types', () => {
    const types = registry.getSupportedAgentTypes();
    expect(types).toContain('claude');
    expect(types).toContain('gemini');
  });

  it('should check if agent type is supported', () => {
    expect(registry.isSupported('claude')).toBe(true);
    expect(registry.isSupported('unknown')).toBe(false);
  });

  it('should clear strategies on dispose', () => {
    registry.dispose();
    expect(registry.getAllStrategies().length).toBe(0);
    expect(registry.isSupported('claude')).toBe(false);
  });

  it('should handle multiple calls to dispose', () => {
    registry.dispose();
    registry.dispose();
    expect(registry.getAllStrategies().length).toBe(0);
  });
});
