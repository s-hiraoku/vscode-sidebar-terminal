/**
 * Input Detection Processor
 *
 * Specialized service for processing user input and detecting CLI agent commands.
 * Uses strategy pattern to eliminate code duplication and provide clean separation of concerns.
 */

import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';
import { CliAgentDetectionResult } from '../interfaces/CliAgentService';
import { CliAgentStateManager } from './CliAgentStateManager';
import { AgentDetectionStrategyRegistry } from './strategies/AgentDetectionStrategyRegistry';

export class InputDetectionProcessor implements vscode.Disposable {
  private strategyRegistry = new AgentDetectionStrategyRegistry();
  private disposed = false;

  constructor(private stateManager: CliAgentStateManager) {}

  /**
   * Process user input and detect CLI agent commands
   * @param terminalId Terminal ID where input occurred
   * @param input User input command
   * @returns Detection result or null if no agent detected
   */
  processInput(terminalId: string, input: string): CliAgentDetectionResult | null {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      log(`❌ [INPUT-DEBUG] Empty input, skipping detection`);
      return null;
    }

    log(
      `🎯 [INPUT-DEBUG] Processing input in terminal ${terminalId}: "${trimmedInput}" (raw: "${input}")`
    );

    // Log current connected agent state
    const isConnected = this.stateManager.isAgentConnected(terminalId);
    const agentType = this.stateManager.getConnectedAgentType();
    log(`🎯 [INPUT-DEBUG] Current agent state - connected: ${isConnected}, type: ${agentType}`);

    // Try each strategy to detect agent commands
    const strategies = this.strategyRegistry.getAllStrategies();

    for (const strategy of strategies) {
      const result = strategy.detectFromInput(trimmedInput);

      if (result.isDetected) {
        log(
          `🎯 [CLI-AGENT] ${strategy.agentType} detected from input: "${trimmedInput}" in terminal ${terminalId}`
        );

        // Set agent as connected
        this.stateManager.setConnectedAgent(terminalId, strategy.agentType);

        return {
          type: strategy.agentType,
          confidence: result.confidence,
          source: 'input',
          detectedLine: result.detectedLine || trimmedInput,
        };
      }
    }

    return null;
  }

  /**
   * Get list of supported agent types
   * @returns Array of supported agent type names
   */
  getSupportedAgentTypes(): string[] {
    return this.strategyRegistry.getSupportedAgentTypes();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // Dispose of strategy registry if it has a dispose method
    if ('dispose' in this.strategyRegistry && typeof this.strategyRegistry.dispose === 'function') {
      this.strategyRegistry.dispose();
    }

    log(`🧹 [INPUT-PROCESSOR] Disposed InputDetectionProcessor`);
  }
}
