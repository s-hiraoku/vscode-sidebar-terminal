import { ICliAgentDetectionConfig, DetectionConfig } from '../interfaces/CliAgentService';

/**
 * Configuration manager for CLI Agent detection system
 */
export class CliAgentDetectionConfig implements ICliAgentDetectionConfig {
  private config: DetectionConfig = {
    debounceMs: 25,
    cacheTtlMs: 1000,
    maxBufferSize: 50,
    skipMinimalData: true,
  };

  getConfig(): DetectionConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
