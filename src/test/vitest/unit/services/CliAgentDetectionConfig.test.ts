import { describe, it, expect, beforeEach } from 'vitest';
import { CliAgentDetectionConfig } from '../../../../services/CliAgentDetectionConfig';

describe('CliAgentDetectionConfig', () => {
  let config: CliAgentDetectionConfig;

  beforeEach(() => {
    config = new CliAgentDetectionConfig();
  });

  it('should return default config', () => {
    const current = config.getConfig();
    expect(current.debounceMs).toBe(25);
    expect(current.maxBufferSize).toBe(50);
  });

  it('should update config partially', () => {
    config.updateConfig({ debounceMs: 50 });
    const current = config.getConfig();
    expect(current.debounceMs).toBe(50);
    expect(current.maxBufferSize).toBe(50); // remains default
  });
});
