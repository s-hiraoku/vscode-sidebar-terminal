/**
 * Refactored CLI Agent Detection Service
 *
 * This service coordinates CLI Agent detection using separated components:
 * - CliAgentPatternDetector: Pattern matching logic
 * - CliAgentStateManager: State management and transitions
 * - CliAgentDetectionConfig: Configuration management
 * - CliAgentTerminationDetector: Enhanced termination detection
 * - CliAgentInputOutputDetector: Input/Output detection logic
 * - LRUCache: Caching for performance
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
import { CliAgentInputOutputDetector } from './CliAgentInputOutputDetector';
import { LRUCache } from '../utils/LRUCache';

export { CliAgentPatternDetector } from './CliAgentPatternDetector';
export { CliAgentStateManager } from './CliAgentStateManager';

export class CliAgentDetectionService implements ICliAgentDetectionService {
  public readonly patternDetector = new CliAgentPatternDetector();
  public readonly stateManager = new CliAgentStateManager();
  public readonly configManager = new CliAgentDetectionConfig();

  // 🆕 EXTRACTED SERVICES: Specialized detectors for better separation of concerns
  private readonly terminationDetector: CliAgentTerminationDetector;
  private readonly inputOutputDetector = new CliAgentInputOutputDetector();

  private detectionCache = new LRUCache<string, DetectionCacheEntry>(50);

  constructor() {
    // Initialize detection cache with configuration - store as cache entries
    const timestamp = Date.now();
    this.detectionCache.set('terminationGracePeriod', { result: null, timestamp }); // 1 second grace period
    this.detectionCache.set('aiActivityTimeout', { result: null, timestamp }); // 30 seconds timeout
    this.detectionCache.set('claudeActivityTimeout', { result: null, timestamp }); // 20 seconds for Claude specific
    this.detectionCache.set('maxShellPromptLength', { result: null, timestamp }); // Maximum shell prompt length
    this.detectionCache.set('relaxedModeEnabled', { result: null, timestamp }); // Enable relaxed detection mode

    // Initialize termination detector with shared cache
    this.terminationDetector = new CliAgentTerminationDetector(this.detectionCache);

    // Start heartbeat is called from TerminalManager after initialization
  }

  detectFromInput(terminalId: string, input: string): CliAgentDetectionResult | null {
    try {
      const trimmedInput = input.trim();
      log(
        `🎯 [INPUT-DEBUG] Processing input in terminal ${terminalId}: "${trimmedInput}" (raw: "${input}")`
      );
      const currentState = this.getAgentState(terminalId);
      log(`🎯 [INPUT-DEBUG] Current agent state: ${JSON.stringify(currentState)}`);

      if (!trimmedInput) {
        log(`❌ [INPUT-DEBUG] Empty input, skipping detection`);
        return null;
      }

      // Check cache first - TEMPORARILY DISABLED for debugging
      const cacheKey = `input:${terminalId}:${trimmedInput}`;
      log(
        `🔍 [CACHE-DEBUG] Cache temporarily disabled for debugging - processing fresh: "${trimmedInput}"`
      );

      let result: CliAgentDetectionResult | null = null;

      // 🔧 REFACTORED: Use extracted input detection service
      result = this.detectAgentFromInput(terminalId, trimmedInput);

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
    return this.processOutputDetection(terminalId, data);
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

  // 🔧 REFACTORED PRIVATE METHODS: Simplified and extracted logic

  /**
   * 🆕 EXTRACTED: Agent detection from input using specialized detector
   */
  private detectAgentFromInput(terminalId: string, trimmedInput: string): CliAgentDetectionResult | null {
    // Claude detection
    const claudeDetected = this.inputOutputDetector.detectClaudeFromInput(trimmedInput);
    if (claudeDetected.isDetected) {
      log(
        `🎯 [CLI-AGENT] Claude Code detected from input: "${trimmedInput}" in terminal ${terminalId}`
      );
      this.stateManager.setConnectedAgent(terminalId, 'claude');
      return {
        type: 'claude',
        confidence: claudeDetected.confidence,
        source: 'input',
        detectedLine: trimmedInput,
      };
    }

    // Gemini detection
    log(`🔍 [GEMINI-INPUT] Checking Gemini detection for: "${trimmedInput}"`);
    const geminiDetected = this.inputOutputDetector.detectGeminiFromInput(trimmedInput);
    log(`🔍 [GEMINI-INPUT] Detection result: ${JSON.stringify(geminiDetected)}`);

    if (geminiDetected.isDetected) {
      log(
        `🎯 [CLI-AGENT] Gemini CLI detected from input: "${trimmedInput}" in terminal ${terminalId}`
      );
      this.stateManager.setConnectedAgent(terminalId, 'gemini');
      return {
        type: 'gemini',
        confidence: geminiDetected.confidence,
        source: 'input',
        detectedLine: trimmedInput,
      };
    }

    // OpenAI Codex CLI detection
    log(`🔍 [CODEX-INPUT] Checking Codex CLI detection for: "${trimmedInput}"`);
    const codexDetected = this.inputOutputDetector.detectCodexFromInput(trimmedInput);
    log(`🔍 [CODEX-INPUT] Detection result: ${JSON.stringify(codexDetected)}`);

    if (codexDetected.isDetected) {
      log(
        `🎯 [CLI-AGENT] OpenAI Codex CLI detected from input: "${trimmedInput}" in terminal ${terminalId}`
      );
      this.stateManager.setConnectedAgent(terminalId, 'codex');
      return {
        type: 'codex',
        confidence: codexDetected.confidence,
        source: 'input',
        detectedLine: trimmedInput,
      };
    }

    // GitHub Copilot CLI detection
    log(`🔍 [COPILOT-INPUT] Checking GitHub Copilot CLI detection for: "${trimmedInput}"`);
    const copilotDetected = this.inputOutputDetector.detectCopilotFromInput(trimmedInput);
    log(`🔍 [COPILOT-INPUT] Detection result: ${JSON.stringify(copilotDetected)}`);

    if (copilotDetected.isDetected) {
      log(
        `🎯 [CLI-AGENT] GitHub Copilot CLI detected from input: "${trimmedInput}" in terminal ${terminalId}`
      );
      this.stateManager.setConnectedAgent(terminalId, 'copilot');
      return {
        type: 'copilot',
        confidence: copilotDetected.confidence,
        source: 'input',
        detectedLine: trimmedInput,
      };
    }

    return null;
  }

  /**
   * 🔧 REFACTORED: Simplified output detection using extracted services
   */
  private processOutputDetection(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(trimmed);
        const fullyCleanLine = cleanLine
          .replace(/[\u2502\u256d\u2570\u2500\u256f]/g, '') // Remove box characters only
          .trim();

        // 🔧 FIX: Allow shell prompts like "$" or "%" (single character)
        if (!fullyCleanLine || fullyCleanLine.length < 1) continue;

        // 🆕 UPDATE AI ACTIVITY TIMESTAMP: Track when we see AI-like output
        if (this.inputOutputDetector.looksLikeAIActivity(fullyCleanLine)) {
          this.detectionCache.set(`${terminalId}_lastAIOutput`, { result: null, timestamp: Date.now() });
        }

        // 🔧 IMPROVED TERMINATION DETECTION: Check for termination for connected terminals
        if (this.stateManager.isAgentConnected(terminalId)) {
          const terminationResult = this.terminationDetector.detectStrictTermination(terminalId, line);
          if (terminationResult.isTerminated) {
            // 🆕 ENHANCED VALIDATION: Add additional checks before terminating
            const isValidTermination = this.terminationDetector.validateTerminationSignal(
              terminalId,
              fullyCleanLine,
              terminationResult
            );

            if (isValidTermination) {
              log(
                `🔻 [CLI-AGENT] Validated termination detected for connected agent: "${fullyCleanLine}" in terminal ${terminalId}`
              );

              // 🔧 IMMEDIATE TERMINATION: No delay for validated termination
              // this.stateManager.setAgentTerminated(terminalId); // Disabled: Keep status always visible
              return null;
            } else {
              log(
                `⚠️ [CLI-AGENT] Ignoring potentially false termination signal: "${fullyCleanLine}" in terminal ${terminalId}`
              );
            }
          }
          // 🚨 IMPORTANT: Skip ALL further detection for connected agents to prevent state churn
          continue;
        }

        // Check for termination for disconnected agents as well
        const disconnectedAgents = this.stateManager.getDisconnectedAgents();
        if (disconnectedAgents.has(terminalId)) {
          // 🔧 IMPROVED: More lenient termination checking for disconnected agents
          log(
            `🔍 [TERMINATION-DEBUG] Checking termination for DISCONNECTED agent in terminal ${terminalId}: "${fullyCleanLine}"`
          );
          const terminationResult = this.terminationDetector.detectStrictTermination(terminalId, line);
          log(`🔍 [TERMINATION-DEBUG] Termination result: ${JSON.stringify(terminationResult)}`);

          if (terminationResult.isTerminated) {
            // 🆕 VALIDATION: Also validate termination for disconnected agents
            const isValidTermination = this.terminationDetector.validateTerminationSignal(
              terminalId,
              fullyCleanLine,
              terminationResult
            );

            if (isValidTermination) {
              log(
                `🔻 [TERMINATION] Setting DISCONNECTED agent as terminated in terminal ${terminalId}`
              );
              // 🆕 GRACE PERIOD: Small delay for disconnected agents to avoid race conditions
              // setTimeout(() => {
              //   this.stateManager.setAgentTerminated(terminalId); // Disabled: Keep status always visible
              //   log(
              //     `🔻 [CLI-AGENT] Disconnected agent termination validated and processed: "${fullyCleanLine}" in terminal ${terminalId}`
              //   );
              // }, 500); // Shorter grace period
            }

            return null; // Termination handled, no detection result needed
          }
          // 🔧 FIX: Allow startup detection for disconnected agents to detect re-connection
          // Do NOT skip startup detection here - disconnected agents can restart
        }

        // Check for startup patterns (for non-connected agents and disconnected agents that may restart)
        // Connected agents are already filtered out above to prevent state churn
        {
          // 🔧 REFACTORED: Use extracted output detection services
          // Claude startup detection
          if (this.inputOutputDetector.detectClaudeFromOutput(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] Claude Code startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'claude');
            // 🆕 RESET TIMER: Clear any existing termination timer
            this.detectionCache.set(`${terminalId}_lastAIOutput`, { result: null, timestamp: Date.now() });

            return {
              type: 'claude',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          }

          // Gemini startup detection
          log(`🔍 [GEMINI-OUTPUT] Checking Gemini startup detection for: "${fullyCleanLine}"`);
          const geminiStartupDetected = this.inputOutputDetector.detectGeminiFromOutput(fullyCleanLine);
          log(`🔍 [GEMINI-OUTPUT] Detection result: ${geminiStartupDetected}`);

          if (geminiStartupDetected) {
            log(
              `🚀 [CLI-AGENT] Gemini CLI startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'gemini');
            // 🆕 RESET TIMER: Clear any existing termination timer
            this.detectionCache.set(`${terminalId}_lastAIOutput`, { result: null, timestamp: Date.now() });

            return {
              type: 'gemini',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          } else {
            // Debug: Log why Gemini wasn't detected
            if (fullyCleanLine.toLowerCase().includes('gemini')) {
              log(
                `🔍 [GEMINI-DEBUG] Gemini keyword found but not detected as startup: "${fullyCleanLine}"`
              );
            }
          }

          // OpenAI Codex startup detection
          if (this.inputOutputDetector.detectCodexFromOutput(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] OpenAI Codex startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'codex');
            // 🆕 RESET TIMER: Clear any existing termination timer
            this.detectionCache.set(`${terminalId}_lastAIOutput`, { result: null, timestamp: Date.now() });

            return {
              type: 'codex',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          }

          // GitHub Copilot CLI startup detection
          if (this.inputOutputDetector.detectCopilotFromOutput(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] GitHub Copilot CLI startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'copilot');
            // 🆕 RESET TIMER: Clear any existing termination timer
            this.detectionCache.set(`${terminalId}_lastAIOutput`, { result: null, timestamp: Date.now() });

            return {
              type: 'copilot',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          }
        }
      }
    } catch (error) {
      log('ERROR: CLI Agent output detection failed:', error);
    }

    return null;
  }

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