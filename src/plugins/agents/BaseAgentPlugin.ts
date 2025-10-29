/**
 * Base Agent Plugin
 *
 * Abstract base class for AI agent detection plugins.
 * Provides common functionality for agent detection and lifecycle management.
 */

import type {
  IAgentPlugin,
  AgentDetectionResult,
  AgentPluginConfig,
} from '../../core/plugins/IAgentPlugin';
import type { PluginMetadata, PluginConfiguration, PluginState } from '../../core/plugins/IPlugin';
import { PluginState as PluginStateEnum } from '../../core/plugins/IPlugin';
import { terminal as log } from '../../utils/logger';

export abstract class BaseAgentPlugin implements IAgentPlugin {
  protected _state: PluginState = PluginStateEnum.Registered;
  protected _config: AgentPluginConfig = {
    enabled: true,
    confidenceThreshold: 0.7,
    debounceMs: 100,
  };

  constructor(public readonly metadata: PluginMetadata) {}

  get state(): PluginState {
    return this._state;
  }

  /**
   * Get detection patterns for this agent
   * Subclasses should override to provide specific patterns
   */
  protected abstract getDetectionPatterns(): RegExp[];

  /**
   * Get command prefixes for this agent
   * Subclasses should override to provide specific prefixes
   */
  protected abstract getCommandPrefixes(): string[];

  /**
   * Get activity keywords for this agent
   * Subclasses should override to provide specific keywords
   */
  protected abstract getActivityKeywords(): string[];

  async activate(): Promise<void> {
    if (this._state === PluginStateEnum.Active) {
      return;
    }

    try {
      log(`▶️ [PLUGIN] Activating ${this.metadata.name} plugin`);
      this._state = PluginStateEnum.Active;
      await this.onActivate();
      log(`✅ [PLUGIN] ${this.metadata.name} activated`);
    } catch (error) {
      log(`❌ [PLUGIN] Failed to activate ${this.metadata.name}:`, error);
      this._state = PluginStateEnum.Error;
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (this._state !== PluginStateEnum.Active) {
      return;
    }

    try {
      log(`⏸️ [PLUGIN] Deactivating ${this.metadata.name} plugin`);
      await this.onDeactivate();
      this._state = PluginStateEnum.Deactivated;
      log(`✅ [PLUGIN] ${this.metadata.name} deactivated`);
    } catch (error) {
      log(`❌ [PLUGIN] Failed to deactivate ${this.metadata.name}:`, error);
      throw error;
    }
  }

  configure(config: PluginConfiguration): void {
    this._config = {
      ...this._config,
      ...config,
    } as AgentPluginConfig;
    log(`⚙️ [PLUGIN] ${this.metadata.name} configured:`, this._config);
  }

  dispose(): void {
    if (this._state === PluginStateEnum.Active) {
      this.deactivate().catch((error) => {
        log(`⚠️ [PLUGIN] Error during disposal of ${this.metadata.name}:`, error);
      });
    }
    log(`🗑️ [PLUGIN] ${this.metadata.name} disposed`);
  }

  detect(terminalId: string, output: string): AgentDetectionResult {
    if (!this._config.enabled || this._state !== PluginStateEnum.Active) {
      return {
        detected: false,
        agentType: null,
        confidence: 0,
      };
    }

    // Check detection patterns
    const patterns = this.getDetectionPatterns();
    for (const pattern of patterns) {
      if (pattern.test(output)) {
        const confidence = 0.9; // High confidence for pattern match
        if (confidence >= (this._config.confidenceThreshold || 0.7)) {
          return {
            detected: true,
            agentType: this.getAgentType(),
            confidence,
            metadata: {
              pattern: pattern.source,
            },
          };
        }
      }
    }

    // Check for command prefixes
    const lowerOutput = output.toLowerCase();
    const commandPrefixes = this.getCommandPrefixes();
    for (const prefix of commandPrefixes) {
      if (lowerOutput.includes(prefix.toLowerCase())) {
        const confidence = 0.8; // Medium-high confidence for command prefix
        if (confidence >= (this._config.confidenceThreshold || 0.7)) {
          return {
            detected: true,
            agentType: this.getAgentType(),
            confidence,
            metadata: {
              commandPrefix: prefix,
            },
          };
        }
      }
    }

    // Check for activity keywords
    const keywords = this.getActivityKeywords();
    for (const keyword of keywords) {
      if (lowerOutput.includes(keyword.toLowerCase())) {
        const confidence = 0.6; // Lower confidence for keyword match
        if (confidence >= (this._config.confidenceThreshold || 0.7)) {
          return {
            detected: true,
            agentType: this.getAgentType(),
            confidence,
            metadata: {
              keyword,
            },
          };
        }
      }
    }

    return {
      detected: false,
      agentType: null,
      confidence: 0,
    };
  }

  onAgentActivated(terminalId: string): void {
    log(`🤖 [PLUGIN] ${this.metadata.name} activated in terminal: ${terminalId}`);
  }

  onAgentDeactivated(terminalId: string): void {
    log(`🤖 [PLUGIN] ${this.metadata.name} deactivated in terminal: ${terminalId}`);
  }

  abstract getAgentType(): string;

  /**
   * Hook for subclass-specific activation logic
   */
  protected async onActivate(): Promise<void> {
    // Subclasses can override
  }

  /**
   * Hook for subclass-specific deactivation logic
   */
  protected async onDeactivate(): Promise<void> {
    // Subclasses can override
  }
}
