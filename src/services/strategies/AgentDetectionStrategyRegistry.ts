/**
 * Agent Detection Strategy Registry
 *
 * Manages registration and retrieval of agent detection strategies.
 * Provides a centralized way to access strategy implementations for different CLI agents.
 */

import * as vscode from 'vscode';
import { AgentDetectionStrategy } from './AgentDetectionStrategy';
import { ClaudeDetectionStrategy } from './ClaudeDetectionStrategy';
import { GeminiDetectionStrategy } from './GeminiDetectionStrategy';
import { CodexDetectionStrategy } from './CodexDetectionStrategy';
import { CopilotDetectionStrategy } from './CopilotDetectionStrategy';

export class AgentDetectionStrategyRegistry implements vscode.Disposable {
  private strategies = new Map<string, AgentDetectionStrategy>();
  private disposed = false;

  constructor() {
    this.registerDefaultStrategies();
  }

  /**
   * Register default strategies for all supported agents
   */
  private registerDefaultStrategies(): void {
    this.register(new ClaudeDetectionStrategy());
    this.register(new GeminiDetectionStrategy());
    this.register(new CodexDetectionStrategy());
    this.register(new CopilotDetectionStrategy());
  }

  /**
   * Register a new agent detection strategy
   * @param strategy Strategy implementation to register
   */
  register(strategy: AgentDetectionStrategy): void {
    this.strategies.set(strategy.agentType, strategy);
  }

  /**
   * Get strategy for specific agent type
   * @param agentType Agent type to get strategy for
   * @returns Strategy implementation or undefined if not found
   */
  getStrategy(agentType: string): AgentDetectionStrategy | undefined {
    return this.strategies.get(agentType);
  }

  /**
   * Get all registered strategies
   * @returns Array of all registered strategy implementations
   */
  getAllStrategies(): AgentDetectionStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get all supported agent types
   * @returns Array of supported agent type names
   */
  getSupportedAgentTypes(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if an agent type is supported
   * @param agentType Agent type to check
   * @returns True if agent type has a registered strategy
   */
  isSupported(agentType: string): boolean {
    return this.strategies.has(agentType);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.strategies.clear();
  }
}
