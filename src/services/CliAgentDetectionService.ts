/**
 * Refactored CLI Agent Detection Service
 *
 * This service coordinates CLI Agent detection using a clean strategy-based architecture:
 * - AgentDetectionStrategy: Strategy pattern for agent-specific detection logic
 * - InputDetectionProcessor: Specialized input command processing
 * - OutputDetectionProcessor: Specialized output pattern processing
 * - CliAgentStateManager: State management and transitions
 * - CliAgentTerminationDetector: Enhanced termination detection
 * - LRUCache: Caching for performance
 *
 * Benefits of refactoring:
 * - Reduced code duplication through strategy pattern
 * - Cleaner separation of concerns
 * - Improved testability and maintainability
 * - Better adherence to SOLID principles
 */

import { terminal as log } from '../utils/logger';
import {
  ICliAgentDetectionService,
  CliAgentDetectionResult,
  TerminationDetectionResult,
  CliAgentState,
  DetectionCacheEntry,
} from '../interfaces/CliAgentService';
import { CliAgentPatternDetector } from './CliAgentPatternDetector';
import { CliAgentStateManager } from './CliAgentStateManager';
import { CliAgentDetectionConfig } from './CliAgentDetectionConfig';
import { CliAgentTerminationDetector } from './CliAgentTerminationDetector';
import { InputDetectionProcessor } from './InputDetectionProcessor';
import { OutputDetectionProcessor } from './OutputDetectionProcessor';
import { LRUCache } from '../utils/LRUCache';

export { CliAgentPatternDetector } from './CliAgentPatternDetector';
export { CliAgentStateManager } from './CliAgentStateManager';
export { AgentDetectionStrategy } from './strategies/AgentDetectionStrategy';
export { AgentDetectionStrategyRegistry } from './strategies/AgentDetectionStrategyRegistry';

export class CliAgentDetectionService implements ICliAgentDetectionService {
  public readonly patternDetector = new CliAgentPatternDetector();
  public readonly stateManager = new CliAgentStateManager();
  public readonly configManager = new CliAgentDetectionConfig();

  // 🆕 STRATEGY-BASED ARCHITECTURE: Specialized processors for clean separation of concerns
  private readonly terminationDetector: CliAgentTerminationDetector;
  private readonly inputProcessor: InputDetectionProcessor;
  private readonly outputProcessor: OutputDetectionProcessor;

  private detectionCache = new LRUCache<string, DetectionCacheEntry>(50);

  constructor() {
    // Initialize detection cache with configuration - store as cache entries
    const timestamp = Date.now();
    this.detectionCache.set('terminationGracePeriod', { result: null, timestamp }); // 1 second grace period
    this.detectionCache.set('aiActivityTimeout', { result: null, timestamp }); // 30 seconds timeout
    this.detectionCache.set('claudeActivityTimeout', { result: null, timestamp }); // 20 seconds for Claude specific
    this.detectionCache.set('maxShellPromptLength', { result: null, timestamp }); // Maximum shell prompt length
    this.detectionCache.set('relaxedModeEnabled', { result: null, timestamp }); // Enable relaxed detection mode

    // Initialize specialized processors with shared dependencies
    this.terminationDetector = new CliAgentTerminationDetector(this.detectionCache);
    this.inputProcessor = new InputDetectionProcessor(this.stateManager);
    this.outputProcessor = new OutputDetectionProcessor(
      this.stateManager,
      this.terminationDetector,
      this.detectionCache
    );

    // Start heartbeat is called from TerminalManager after initialization
  }

  detectFromInput(terminalId: string, input: string): CliAgentDetectionResult | null {
    try {
      // Check cache first
      const cacheKey = `input:${terminalId}:${input.trim()}`;
      const cached = this.detectionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 5000) { // 5 second cache
        return cached.result;
      }

      // 🎯 STRATEGY-BASED DETECTION: Use specialized input processor
      const result = this.inputProcessor.processInput(terminalId, input);

      // Cache the result
      this.detectionCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      log('ERROR: CLI Agent input detection failed:', error);
      return null;
    }
  }

  detectFromOutput(terminalId: string, data: string): CliAgentDetectionResult | null {
    // 🎯 STRATEGY-BASED DETECTION: Use specialized output processor
    return this.outputProcessor.processOutput(terminalId, data);
  }

  detectTermination(terminalId: string, data: string): TerminationDetectionResult {
    try {
      // Check if there is any agent to terminate
      const disconnectedAgents = this.stateManager.getDisconnectedAgents();
      const hasConnectedAgent = this.stateManager.isAgentConnected(terminalId);
      const hasDisconnectedAgent = disconnectedAgents.has(terminalId);

      if (!hasConnectedAgent && !hasDisconnectedAgent) {
        // No agent exists to terminate
        return {
          isTerminated: false,
          confidence: 0,
          detectedLine: '',
          reason: 'No agent exists to terminate',
        };
      }

      // 🎯 REFACTORED: Use enhanced termination detection with validation
      const lines = data.split(/\r?\n/);
      let terminationDetected = false;
      let detectedLine = '';
      let maxConfidence = 0;
      let reason = '';

      for (const line of lines) {
        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(line.trim());
        if (!cleanLine) continue;

        // 🔄 ENHANCED DETECTION: Use new termination detector with validation
        const detectionResult = this.terminationDetector.detectStrictTermination(terminalId, line);

        if (detectionResult.isTerminated) {
          // 🆕 VALIDATION: Check if termination signal is legitimate
          const isValidTermination = this.terminationDetector.validateTerminationSignal(
            terminalId,
            cleanLine,
            detectionResult
          );

          if (isValidTermination && detectionResult.confidence > maxConfidence) {
            terminationDetected = true;
            detectedLine = detectionResult.detectedLine || '';
            maxConfidence = detectionResult.confidence;
            reason = detectionResult.reason;
          }
        }

        // 🆕 ADDITIONAL PATTERNS: Add even more lenient fallback patterns
        if (!terminationDetected) {
          // Very simple shell prompt detection as last resort
          if (this.patternDetector.detectShellPrompt(cleanLine)) {
            const isSimplePrompt =
              cleanLine.length <= 20 &&
              !cleanLine.toLowerCase().includes('claude') &&
              !cleanLine.toLowerCase().includes('gemini') &&
              !cleanLine.toLowerCase().includes('help') &&
              !cleanLine.toLowerCase().includes('how') &&
              !cleanLine.toLowerCase().includes('what') &&
              (cleanLine.includes('$') || cleanLine.includes('%') || cleanLine.includes('>'));

            if (isSimplePrompt) {
              terminationDetected = true;
              detectedLine = cleanLine;
              maxConfidence = 0.4; // Low confidence fallback
              reason = 'Simple shell prompt fallback';
            }
          }
        }
      }

      const result: TerminationDetectionResult = terminationDetected ? {
        isTerminated: true,
        confidence: maxConfidence,
        detectedLine,
        reason,
      } : {
        isTerminated: false,
        confidence: 0,
        detectedLine: '',
        reason: 'No termination detected',
      };

      return result;
    } catch (error) {
      log('ERROR: CLI Agent termination detection failed:', error);
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: '',
        reason: 'Detection error',
      };
    }
  }

  getAgentState(terminalId: string): CliAgentState {
    // Check if terminal is connected
    if (this.stateManager.isAgentConnected(terminalId)) {
      return {
        status: 'connected',
        agentType: this.stateManager.getConnectedAgentType(),
      };
    }

    // Check if terminal is in disconnected state
    const disconnectedAgents = this.stateManager.getDisconnectedAgents();
    if (disconnectedAgents.has(terminalId)) {
      const agentInfo = disconnectedAgents.get(terminalId)!;
      return {
        status: 'disconnected',
        agentType: agentInfo.type,
      };
    }

    // Default to none
    return {
      status: 'none',
      agentType: null,
    };
  }

  getConnectedAgent(): { terminalId: string; type: 'claude' | 'gemini' | 'codex' | 'copilot' } | null {
    const terminalId = this.stateManager.getConnectedAgentTerminalId();
    const type = this.stateManager.getConnectedAgentType();

    if (terminalId && type) {
      return { terminalId, type: type as 'claude' | 'gemini' | 'codex' | 'copilot' };
    }

    return null;
  }

  getDisconnectedAgents(): Map<string, { type: 'claude' | 'gemini' | 'codex' | 'copilot'; startTime: Date }> {
    return this.stateManager.getDisconnectedAgents();
  }

  switchAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    try {
      // シンプル化: 常にconnectedステータスで成功を返す
      const agentType = 'claude'; // デフォルトでClaudeに設定

      // StateManagerに接続状態を設定
      this.stateManager.setConnectedAgent(terminalId, agentType);

      log(`✅ [CLI-AGENT] Agent connection activated for terminal ${terminalId} (${agentType})`);

      return {
        success: true,
        newStatus: 'connected',
        agentType: agentType,
      };
    } catch (error) {
      log('ERROR: CLI Agent connection switch failed:', error);
      return {
        success: false,
        reason: 'Connection switch failed',
        newStatus: 'none',
        agentType: null,
      };
    }
  }

  handleTerminalRemoved(terminalId: string): void {
    this.detectionCache.delete(terminalId);
    // 🔧 FIX: Use a separate method for actual terminal removal vs session termination
    this.stateManager.removeTerminalCompletely(terminalId);
  }

  /**
   * 🆕 MANUAL RESET: Force reconnect AI Agent when user clicks toggle button
   * This helps recover from detection errors by manually setting the agent as connected
   */
  forceReconnectAgent(
    terminalId: string,
    agentType: 'claude' | 'gemini' | 'codex' | 'copilot' = 'claude',
    terminalName?: string
  ): boolean {
    log(
      `🔄 [MANUAL-RESET] User triggered force reconnect for terminal ${terminalId} as ${agentType}`
    );

    try {
      // Clear any cached detection results for this terminal
      this.clearTerminalCache(terminalId);

      // Force reconnect via state manager
      const success = this.stateManager.forceReconnectAgent(terminalId, agentType, terminalName);

      if (success) {
        log(
          `✅ [MANUAL-RESET] Successfully force-reconnected ${agentType} in terminal ${terminalId}`
        );
        return true;
      } else {
        log(`❌ [MANUAL-RESET] Failed to force-reconnect ${agentType} in terminal ${terminalId}`);
        return false;
      }
    } catch (error) {
      log('❌ [MANUAL-RESET] Error during force reconnect:', error);
      return false;
    }
  }

  /**
   * 🆕 MANUAL RESET: Clear detection errors and reset terminal to clean state
   * Use this when detection gets confused and needs a fresh start
   */
  clearDetectionError(terminalId: string): boolean {
    log(`🧹 [MANUAL-RESET] User triggered detection error clear for terminal ${terminalId}`);

    try {
      // Clear all cached results for this terminal
      this.clearTerminalCache(terminalId);

      // Reset state via state manager
      const success = this.stateManager.clearDetectionError(terminalId);

      if (success) {
        log(`✅ [MANUAL-RESET] Successfully cleared detection errors for terminal ${terminalId}`);
        return true;
      } else {
        log(`⚠️ [MANUAL-RESET] No detection errors to clear for terminal ${terminalId}`);
        return false;
      }
    } catch (error) {
      log('❌ [MANUAL-RESET] Error during detection error clear:', error);
      return false;
    }
  }

  get onCliAgentStatusChange() {
    return this.stateManager.onStatusChange;
  }

  dispose(): void {
    this.stateManager.dispose();
  }

  public startHeartbeat(): void {
    // Validate connected agent state every 30 seconds
    setInterval(() => {
      this.stateManager.validateConnectedAgentState();
    }, 30000);
  }

  refreshAgentState(): boolean {
    return this.stateManager.refreshConnectedAgentState();
  }

  /**
   * 🔄 BACKWARD COMPATIBILITY: Set agent connected (delegates to state manager)
   * This method maintains compatibility with existing tests
   */
  setAgentConnected(terminalId: string, type: 'claude' | 'gemini' | 'codex' | 'copilot', terminalName?: string): void {
    this.stateManager.setConnectedAgent(terminalId, type, terminalName);
  }

  // 🎯 REFACTORED ARCHITECTURE: Complex logic moved to specialized processors
  // Input detection: InputDetectionProcessor (strategy-based)
  // Output detection: OutputDetectionProcessor (strategy-based)
  // Termination detection: CliAgentTerminationDetector (enhanced validation)


  /**
   * 🆕 UTILITY: Clear all cached detection results for a specific terminal
   */
  private clearTerminalCache(terminalId: string): void {
    const cacheKeys: string[] = [];
    // Simple iteration over cache - compatibility with older LRU cache versions
    try {
      (this.detectionCache as any).forEach((_value: any, key: string) => {
        if (key.includes(terminalId)) {
          cacheKeys.push(key);
        }
      });
    } catch (e) {
      // Fallback: clear entire cache if iteration fails
      this.detectionCache.clear();
      log(`⚠️ [CACHE-CLEAR] Cache iteration failed, cleared entire cache`);
    }
    cacheKeys.forEach((key) => this.detectionCache.delete(key));
    log(`🧹 [CACHE-CLEAR] Cleared ${cacheKeys.length} cache entries for terminal ${terminalId}`);
  }
}