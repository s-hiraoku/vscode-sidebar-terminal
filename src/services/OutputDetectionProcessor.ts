/**
 * Output Detection Processor
 *
 * Specialized service for processing terminal output and detecting CLI agent patterns.
 * Handles line cleaning, activity tracking, and orchestrates strategy-based detection.
 */

import { terminal as log } from '../utils/logger';
import { CliAgentDetectionResult } from '../interfaces/CliAgentService';
import { CliAgentPatternDetector } from './CliAgentPatternDetector';
import { CliAgentStateManager } from './CliAgentStateManager';
import { CliAgentTerminationDetector } from './CliAgentTerminationDetector';
import { AgentDetectionStrategyRegistry } from './strategies/AgentDetectionStrategyRegistry';
import { LRUCache } from '../utils/LRUCache';

interface DetectionCacheEntry {
  result: CliAgentDetectionResult | null;
  timestamp: number;
}

export class OutputDetectionProcessor {
  private patternDetector = new CliAgentPatternDetector();
  private strategyRegistry = new AgentDetectionStrategyRegistry();

  constructor(
    private stateManager: CliAgentStateManager,
    private terminationDetector: CliAgentTerminationDetector,
    private detectionCache: LRUCache<string, DetectionCacheEntry>
  ) {}

  /**
   * Process terminal output data and detect CLI agent patterns
   * @param terminalId Terminal ID where output occurred
   * @param data Raw terminal output data
   * @returns Detection result or null if no agent detected
   */
  processOutput(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      const lines = data.split(/\r?\n/);

      for (const line of lines) {
        const result = this.processLine(terminalId, line);
        if (result) {
          return result;
        }
      }
    } catch (error) {
      log('ERROR: Output detection processing failed:', error);
    }

    return null;
  }

  /**
   * Process a single line of terminal output
   * @param terminalId Terminal ID
   * @param line Raw line to process
   * @returns Detection result or null
   */
  private processLine(terminalId: string, line: string): CliAgentDetectionResult | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(trimmed);
    const fullyCleanLine = this.removeBoxCharacters(cleanLine);

    // Skip empty lines after cleaning
    if (!fullyCleanLine || fullyCleanLine.length < 1) return null;

    // Update AI activity timestamp if this looks like AI output
    this.updateAIActivityTimestamp(terminalId, fullyCleanLine);

    // Handle connected agents - check for termination first
    if (this.stateManager.isAgentConnected(terminalId)) {
      return this.handleConnectedAgent(terminalId, line, fullyCleanLine);
    }

    // Handle disconnected agents - check for termination
    if (this.handleDisconnectedAgent(terminalId, line, fullyCleanLine)) {
      return null; // Termination handled
    }

    // Check for startup patterns for non-connected agents
    return this.detectStartupPatterns(terminalId, fullyCleanLine);
  }

  /**
   * Handle termination detection for connected agents
   */
  private handleConnectedAgent(terminalId: string, line: string, fullyCleanLine: string): CliAgentDetectionResult | null {
    const terminationResult = this.terminationDetector.detectStrictTermination(terminalId, line);

    if (terminationResult.isTerminated) {
      const isValidTermination = this.terminationDetector.validateTerminationSignal(
        terminalId,
        fullyCleanLine,
        terminationResult
      );

      if (isValidTermination) {
        log(
          `🔻 [CLI-AGENT] Validated termination detected for connected agent: "${fullyCleanLine}" in terminal ${terminalId}`
        );
        // Note: Actual termination setting is disabled to keep status always visible
        return null;
      } else {
        log(
          `⚠️ [CLI-AGENT] Ignoring potentially false termination signal: "${fullyCleanLine}" in terminal ${terminalId}`
        );
      }
    }

    // Skip further detection for connected agents to prevent state churn
    return null;
  }

  /**
   * Handle termination detection for disconnected agents
   */
  private handleDisconnectedAgent(terminalId: string, line: string, fullyCleanLine: string): boolean {
    const disconnectedAgents = this.stateManager.getDisconnectedAgents();
    if (!disconnectedAgents.has(terminalId)) {
      return false;
    }

    log(
      `🔍 [TERMINATION-DEBUG] Checking termination for DISCONNECTED agent in terminal ${terminalId}: "${fullyCleanLine}"`
    );

    const terminationResult = this.terminationDetector.detectStrictTermination(terminalId, line);
    log(`🔍 [TERMINATION-DEBUG] Termination result: ${JSON.stringify(terminationResult)}`);

    if (terminationResult.isTerminated) {
      const isValidTermination = this.terminationDetector.validateTerminationSignal(
        terminalId,
        fullyCleanLine,
        terminationResult
      );

      if (isValidTermination) {
        log(
          `🔻 [TERMINATION] Setting DISCONNECTED agent as terminated in terminal ${terminalId}`
        );
        // Note: Actual termination setting is disabled to keep status always visible
      }

      return true; // Termination handled
    }

    return false; // No termination detected
  }

  /**
   * Detect startup patterns using strategies
   */
  private detectStartupPatterns(terminalId: string, fullyCleanLine: string): CliAgentDetectionResult | null {
    const strategies = this.strategyRegistry.getAllStrategies();

    for (const strategy of strategies) {
      if (strategy.detectFromOutput(fullyCleanLine)) {
        log(
          `🚀 [CLI-AGENT] ${strategy.agentType} startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
        );

        this.stateManager.setConnectedAgent(terminalId, strategy.agentType);
        this.updateAIActivityTimestamp(terminalId, fullyCleanLine);

        return {
          type: strategy.agentType,
          confidence: 0.9,
          source: 'output',
          detectedLine: fullyCleanLine,
        };
      }
    }

    return null;
  }

  /**
   * Update AI activity timestamp for activity tracking
   */
  private updateAIActivityTimestamp(terminalId: string, line: string): void {
    const strategies = this.strategyRegistry.getAllStrategies();
    const isAIActivity = strategies.some(strategy => strategy.isAgentActivity(line));

    if (isAIActivity || line.length > 50) {
      this.detectionCache.set(`${terminalId}_lastAIOutput`, {
        result: null,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Remove box drawing characters from terminal output
   */
  private removeBoxCharacters(line: string): string {
    return line
      .replace(/[\u2502\u256d\u2570\u2500\u256f]/g, '') // Remove box characters only
      .trim();
  }
}