/**
 * AI Agent Plugin Interface
 *
 * Specialized plugin interface for AI agent detection and coordination.
 */

import type { IPlugin } from './IPlugin';

/**
 * Agent detection result
 */
export interface AgentDetectionResult {
  /** Whether an agent was detected */
  detected: boolean;
  /** Agent type (e.g., 'claude', 'copilot', 'gemini') */
  agentType: string | null;
  /** Confidence score (0-1) */
  confidence: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent plugin configuration
 */
export interface AgentPluginConfig {
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Detection patterns (regex patterns as strings) */
  patterns?: string[];
  /** Minimum confidence threshold (0-1) */
  confidenceThreshold?: number;
  /** Detection debounce time in milliseconds */
  debounceMs?: number;
}

/**
 * AI Agent Plugin Interface
 *
 * Plugins implementing this interface can detect and coordinate with AI CLI agents.
 */
export interface IAgentPlugin extends IPlugin {
  /**
   * Detect AI agent from terminal output
   *
   * @param terminalId Terminal ID
   * @param output Terminal output data
   * @returns Detection result
   */
  detect(terminalId: string, output: string): AgentDetectionResult;

  /**
   * Handle agent activation
   * Called when the agent is detected and confirmed active
   *
   * @param terminalId Terminal ID
   */
  onAgentActivated(terminalId: string): void;

  /**
   * Handle agent deactivation
   * Called when the agent is no longer detected
   *
   * @param terminalId Terminal ID
   */
  onAgentDeactivated(terminalId: string): void;

  /**
   * Get agent type identifier
   *
   * @returns Agent type string (e.g., 'claude', 'copilot')
   */
  getAgentType(): string;
}
