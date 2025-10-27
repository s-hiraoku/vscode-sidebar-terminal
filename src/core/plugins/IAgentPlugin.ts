/**
 * AI Agent Plugin Interface
 *
 * Specialized plugin interface for AI agent detection and management.
 * Extends the base IPlugin with agent-specific capabilities.
 */

import type { IPlugin } from './IPlugin';

/**
 * AI agent detection result
 */
export interface AgentDetectionResult {
  /** Agent identifier (e.g., 'claude', 'copilot') */
  agentId: string;

  /** Detection confidence (0.0 to 1.0) */
  confidence: number;

  /** Detected agent version (if available) */
  version?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent state
 */
export enum AgentState {
  /** Agent not detected */
  Disconnected = 'disconnected',

  /** Agent detected and ready */
  Connected = 'connected',

  /** Agent actively processing */
  Active = 'active',

  /** Agent encountered an error */
  Error = 'error',
}

/**
 * Status indicator for WebView display
 */
export interface StatusIndicator {
  /** Display text */
  text: string;

  /** CSS color for indicator */
  color: string;

  /** Tooltip text */
  tooltip?: string;

  /** Icon class or emoji */
  icon?: string;
}

/**
 * AI Agent Plugin Interface
 */
export interface IAgentPlugin extends IPlugin {
  /**
   * Detect AI agent from terminal output
   *
   * @param output Terminal output text
   * @returns Detection result or null if no agent detected
   */
  detectAgent(output: string): AgentDetectionResult | null;

  /**
   * Get status indicator for current agent state
   *
   * @param state Current agent state
   * @returns Status indicator for display
   */
  getStatusIndicator(state: AgentState): StatusIndicator;

  /**
   * Determine if output processing should be accelerated
   *
   * @param state Current agent state
   * @returns True if buffer flushing should be accelerated
   */
  shouldAccelerate(state: AgentState): boolean;

  /**
   * Get agent-specific configuration
   * @returns Agent configuration object
   */
  getAgentConfig(): AgentConfig;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Whether agent detection is enabled */
  enabled: boolean;

  /** Detection pattern (regex string) */
  detectionPattern?: string;

  /** Detection confidence threshold (0.0 to 1.0) */
  threshold: number;

  /** Buffer flush interval when agent is active (milliseconds) */
  flushInterval?: number;

  /** Custom properties */
  [key: string]: unknown;
}
