/**
 * Refactored CLI Agent Detection Service
 *
 * This service coordinates CLI Agent detection using separated components:
 * - CliAgentPatternDetector: Pattern matching logic
 * - CliAgentStateManager: State management and transitions
 * - CliAgentDetectionConfig: Configuration management
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
import { LRUCache } from '../utils/LRUCache';

export { CliAgentPatternDetector } from './CliAgentPatternDetector';
export { CliAgentStateManager } from './CliAgentStateManager';

export class CliAgentDetectionService implements ICliAgentDetectionService {
  public readonly patternDetector = new CliAgentPatternDetector();
  public readonly stateManager = new CliAgentStateManager();
  public readonly configManager = new CliAgentDetectionConfig();

  private detectionCache = new LRUCache<string, DetectionCacheEntry>(50);

  constructor() {
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
      // const cachedResult = this.detectionCache.get(cacheKey);
      // if (cachedResult && Date.now() - cachedResult.timestamp < this.configManager.getConfig().cacheTtlMs) {
      //   log(`🎯 [CLI-AGENT] Cache hit for input detection: "${trimmedInput}"`);
      //   return cachedResult.result;
      // }
      log(
        `🔍 [CACHE-DEBUG] Cache temporarily disabled for debugging - processing fresh: "${trimmedInput}"`
      );

      let result: CliAgentDetectionResult | null = null;

      // Claude detection
      const claudeDetected = this.detectClaudeFromInput(trimmedInput);
      if (claudeDetected.isDetected) {
        log(
          `🎯 [CLI-AGENT] Claude Code detected from input: "${trimmedInput}" in terminal ${terminalId}`
        );
        this.stateManager.setConnectedAgent(terminalId, 'claude');
        result = {
          type: 'claude',
          confidence: claudeDetected.confidence,
          source: 'input',
          detectedLine: trimmedInput,
        };
      }

      // Gemini detection
      if (!result) {
        log(`🔍 [GEMINI-INPUT] Checking Gemini detection for: "${trimmedInput}"`);
        const geminiDetected = this.detectGeminiFromInput(trimmedInput);
        log(`🔍 [GEMINI-INPUT] Detection result: ${JSON.stringify(geminiDetected)}`);

        if (geminiDetected.isDetected) {
          log(
            `🎯 [CLI-AGENT] Gemini CLI detected from input: "${trimmedInput}" in terminal ${terminalId}`
          );
          this.stateManager.setConnectedAgent(terminalId, 'gemini');
          result = {
            type: 'gemini',
            confidence: geminiDetected.confidence,
            source: 'input',
            detectedLine: trimmedInput,
          };
        }
      }

      // OpenAI Codex CLI detection
      if (!result) {
        log(`🔍 [CODEX-INPUT] Checking Codex CLI detection for: "${trimmedInput}"`);
        const codexDetected = this.detectCodexFromInput(trimmedInput);
        log(`🔍 [CODEX-INPUT] Detection result: ${JSON.stringify(codexDetected)}`);

        if (codexDetected.isDetected) {
          log(
            `🎯 [CLI-AGENT] OpenAI Codex CLI detected from input: "${trimmedInput}" in terminal ${terminalId}`
          );
          this.stateManager.setConnectedAgent(terminalId, 'codex');
          result = {
            type: 'codex',
            confidence: codexDetected.confidence,
            source: 'input',
            detectedLine: trimmedInput,
          };
        }
      }

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
      let result: TerminationDetectionResult;

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

      // For connected agents, use strict termination detection
      if (hasConnectedAgent) {
        result = this.detectStrictTermination(terminalId, data);
      } else if (hasDisconnectedAgent) {
        // For disconnected agents, use regular shell prompt detection
        const lines = data.split(/\r?\n/);
        let terminationDetected = false;
        let detectedLine = '';

        for (const line of lines) {
          const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(line.trim());
          if (cleanLine && this.patternDetector.detectShellPrompt(cleanLine)) {
            terminationDetected = true;
            detectedLine = cleanLine;
            break;
          }
        }

        if (terminationDetected) {
          result = {
            isTerminated: true,
            confidence: 0.8,
            detectedLine,
            reason: 'Shell prompt detected',
          };
        } else {
          result = {
            isTerminated: false,
            confidence: 0,
            detectedLine: '',
            reason: 'No termination detected',
          };
        }
      } else {
        // Fallback (shouldn't reach here)
        result = {
          isTerminated: false,
          confidence: 0,
          detectedLine: '',
          reason: 'No termination detected',
        };
      }

      // Note: State management is handled in processOutputDetection automatically
      // This method is primarily for testing/explicit termination checking

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

  getConnectedAgent(): { terminalId: string; type: 'claude' | 'gemini' | 'codex' } | null {
    const terminalId = this.stateManager.getConnectedAgentTerminalId();
    const type = this.stateManager.getConnectedAgentType();

    if (terminalId && type) {
      return { terminalId, type: type as 'claude' | 'gemini' | 'codex' };
    }

    return null;
  }

  getDisconnectedAgents(): Map<string, { type: 'claude' | 'gemini' | 'codex'; startTime: Date }> {
    return this.stateManager.getDisconnectedAgents();
  }

  switchAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    try {
      const disconnectedAgents = this.stateManager.getDisconnectedAgents();
      const currentState = this.getAgentState(terminalId);
      
      if (disconnectedAgents.has(terminalId)) {
        // Promote disconnected agent to connected
        const agentInfo = disconnectedAgents.get(terminalId)!;
        this.stateManager.promoteDisconnectedAgentToConnected(terminalId);
        log(`🔄 [CLI-AGENT] Switched connection to terminal ${terminalId} (from disconnected)`);
        return {
          success: true,
          newStatus: 'connected',
          agentType: agentInfo.type,
        };
      } else if (currentState.status === 'none') {
        // 🆕 NEW: Allow switching 'none' state terminals to connected (assume Claude by default)
        // This allows user to manually activate any terminal as an AI agent
        const agentType = 'claude'; // Default to Claude, could be made configurable
        this.stateManager.setConnectedAgent(terminalId, agentType);
        log(`🔄 [CLI-AGENT] Activated AI agent for terminal ${terminalId} (from none state)`);
        return {
          success: true,
          newStatus: 'connected',
          agentType: agentType,
        };
      } else if (currentState.status === 'connected') {
        // 🎯 IMPROVED: If already connected, this is essentially a no-op success
        // But if user clicks connected terminal, they may want to move connection to this terminal
        // In this case, we still call setConnectedAgent to trigger the state transitions
        const agentType = currentState.agentType || 'claude';
        this.stateManager.setConnectedAgent(terminalId, agentType);
        log(`🔄 [CLI-AGENT] Reaffirmed connection to terminal ${terminalId} (already connected)`);
        return {
          success: true,
          newStatus: 'connected',
          agentType: agentType,
        };
      }

      log(`⚠️ [CLI-AGENT] Cannot switch to terminal ${terminalId}: unknown state`);
      return {
        success: false,
        reason: 'Unknown terminal state',
        newStatus: currentState.status,
        agentType: currentState.agentType,
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
  forceReconnectAgent(terminalId: string, agentType: 'claude' | 'gemini' | 'codex' = 'claude', terminalName?: string): boolean {
    log(`🔄 [MANUAL-RESET] User triggered force reconnect for terminal ${terminalId} as ${agentType}`);
    
    try {
      // Clear any cached detection results for this terminal
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
        log(`⚠️ [MANUAL-RESET] Cache iteration failed, cleared entire cache`);
      }
      cacheKeys.forEach(key => this.detectionCache.delete(key));
      log(`🧹 [MANUAL-RESET] Cleared ${cacheKeys.length} cache entries for terminal ${terminalId}`);
      
      // Force reconnect via state manager
      const success = this.stateManager.forceReconnectAgent(terminalId, agentType, terminalName);
      
      if (success) {
        log(`✅ [MANUAL-RESET] Successfully force-reconnected ${agentType} in terminal ${terminalId}`);
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
        log(`⚠️ [MANUAL-RESET] Cache iteration failed, cleared entire cache`);
      }
      cacheKeys.forEach(key => this.detectionCache.delete(key));
      log(`🧹 [MANUAL-RESET] Cleared ${cacheKeys.length} cache entries for terminal ${terminalId}`);
      
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

  private processOutputDetection(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(trimmed);
        const fullyCleanLine = cleanLine
          .replace(/[│╭╰─╯]/g, '') // Remove box characters only
          .trim();

        // 🔧 FIX: Allow shell prompts like "$" or "%" (single character)
        if (!fullyCleanLine || fullyCleanLine.length < 1) continue;

        // Check for termination first (for connected terminals ONLY)
        if (this.stateManager.isAgentConnected(terminalId)) {
          // 🔧 FIX: Use more strict termination detection for connected agents
          const terminationResult = this.detectStrictTermination(terminalId, line);
          if (terminationResult.isTerminated) {
            this.stateManager.setAgentTerminated(terminalId);
            log(
              `🔻 [CLI-AGENT] Connected agent termination detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            return null; // Termination handled, no detection result needed
          }
          // 🚨 IMPORTANT: Skip ALL further detection for connected agents to prevent state churn
          continue;
        }

        // Check for termination for disconnected agents as well
        const disconnectedAgents = this.stateManager.getDisconnectedAgents();
        if (disconnectedAgents.has(terminalId)) {
          // 🔧 FIXED: Also check for termination in disconnected agents
          log(
            `🔍 [TERMINATION-DEBUG] Checking termination for DISCONNECTED agent in terminal ${terminalId}: "${fullyCleanLine}"`
          );
          const terminationResult = this.detectStrictTermination(terminalId, line);
          log(`🔍 [TERMINATION-DEBUG] Termination result: ${JSON.stringify(terminationResult)}`);

          if (terminationResult.isTerminated) {
            log(
              `🔻 [TERMINATION] Setting DISCONNECTED agent as terminated in terminal ${terminalId}`
            );
            this.stateManager.setAgentTerminated(terminalId);
            log(
              `🔻 [CLI-AGENT] Disconnected agent termination detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            return null; // Termination handled, no detection result needed
          }
          // Skip startup detection for disconnected agents - they're already known agents
          continue;
        }

        // Check for startup patterns (only for non-connected and non-disconnected agents)
        // Already filtered out disconnected agents above, so we can proceed directly
        {
          // Claude startup detection
          if (this.patternDetector.detectClaudeStartup(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] Claude Code startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'claude');

            return {
              type: 'claude',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          }

          // Gemini startup detection
          log(`🔍 [GEMINI-OUTPUT] Checking Gemini startup detection for: "${fullyCleanLine}"`);
          const geminiStartupDetected = this.patternDetector.detectGeminiStartup(fullyCleanLine);
          log(`🔍 [GEMINI-OUTPUT] Detection result: ${geminiStartupDetected}`);

          if (geminiStartupDetected) {
            log(
              `🚀 [CLI-AGENT] Gemini CLI startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'gemini');

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
          if (this.detectCodexFromOutput(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] OpenAI Codex startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'codex');

            return {
              type: 'codex',
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

  private detectStrictTermination(terminalId: string, line: string): TerminationDetectionResult {
    const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(line.trim());

    log(`🔍 [TERMINATION-DEBUG] Checking termination for terminal ${terminalId}: "${cleanLine}"`);

    // Very explicit termination messages first
    if (this.hasVeryExplicitTerminationMessage(cleanLine)) {
      log(`✅ [TERMINATION] Explicit termination message detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 1.0,
        detectedLine: cleanLine,
        reason: 'Very explicit termination message',
      };
    }

    // Process crash indicators
    if (this.hasProcessCrashIndicator(cleanLine)) {
      log(`✅ [TERMINATION] Process crash detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 0.95,
        detectedLine: cleanLine,
        reason: 'Process crash detected',
      };
    }

    // 🚨 REDUCED SENSITIVITY: Much more conservative shell prompt detection
    // Only detect termination if we have VERY clear shell prompt patterns
    if (this.patternDetector.detectShellPrompt(cleanLine)) {
      const lowerLine = cleanLine.toLowerCase();
      
      // 🚨 EXTENSIVE AI OUTPUT DETECTION: Greatly expanded to reduce false positives
      const looksLikeAIOutput =
        lowerLine.includes('claude') ||
        lowerLine.includes('gemini') ||
        lowerLine.includes('assistant') ||
        lowerLine.includes('help') ||
        lowerLine.includes('i am') ||
        lowerLine.includes("i'm") ||
        lowerLine.includes('let me') ||
        lowerLine.includes('i can') ||
        lowerLine.includes('i will') ||
        lowerLine.includes("i'll") ||
        lowerLine.includes('would you') ||
        lowerLine.includes('how can') ||
        lowerLine.includes('understand') ||
        lowerLine.includes('analyze') ||
        lowerLine.includes('looking') ||
        lowerLine.includes('working') ||
        lowerLine.includes('thinking') ||
        lowerLine.includes('response') ||
        lowerLine.includes('question') ||
        lowerLine.includes('request') ||
        lowerLine.includes('sure') ||
        lowerLine.includes('certainly') ||
        lowerLine.includes('absolutely') ||
        lowerLine.includes('of course') ||
        lowerLine.includes('definitely') ||
        lowerLine.includes('exactly') ||
        lowerLine.includes('perfect') ||
        lowerLine.includes('great') ||
        lowerLine.includes('excellent') ||
        lowerLine.includes('thanks') ||
        lowerLine.includes('thank') ||
        lowerLine.includes('please') ||
        lowerLine.includes('here') ||
        lowerLine.includes('this') ||
        lowerLine.includes('that') ||
        lowerLine.includes('with') ||
        lowerLine.includes('from') ||
        lowerLine.includes('will') ||
        lowerLine.includes('can') ||
        lowerLine.includes('would') ||
        lowerLine.includes('could') ||
        lowerLine.includes('should') ||
        lowerLine.includes('might') ||
        lowerLine.includes('may') ||
        lowerLine.includes('...') || // Thinking indicators
        lowerLine.includes('let') || // Common Claude phrase starts
        lowerLine.includes('the') || // Common articles
        lowerLine.includes('to') ||  // Common prepositions
        lowerLine.includes('for') ||
        lowerLine.includes('and') ||
        lowerLine.includes('or') ||
        lowerLine.includes('but') ||
        lowerLine.includes('if') ||
        lowerLine.includes('when') ||
        lowerLine.includes('where') ||
        lowerLine.includes('what') ||
        lowerLine.includes('why') ||
        lowerLine.includes('how') ||
        cleanLine.includes('(') ||   // Likely explanation or code
        cleanLine.includes(')') ||
        cleanLine.includes('[') ||
        cleanLine.includes(']') ||
        cleanLine.includes('{') ||
        cleanLine.includes('}') ||
        /\d/.test(cleanLine) ||      // Contains numbers (often in AI responses)
        cleanLine.includes(':') ||   // Colons often in explanations
        cleanLine.includes('=') ||   // Code or assignments
        cleanLine.length > 20;       // Longer lines are more likely AI output

      // 🚨 ULTRA-CONSERVATIVE: Only detect shell prompt if it's EXTREMELY clear
      // Must be very short, contain NO common words, and match exact shell patterns
      const isVeryObviousShellPrompt =
        cleanLine.length <= 15 &&    // Much shorter limit
        !looksLikeAIOutput &&
        (cleanLine.match(/^[a-z0-9._-]+@[a-z0-9.-]+:[~\/][^$]*\$\s*$/i) ||  // user@host:~$
         cleanLine.match(/^[a-z0-9._-]+@[a-z0-9.-]+\s*\$\s*$/i) ||          // user@host $
         cleanLine.match(/^\$\s*$/) ||                                       // Just $
         cleanLine.match(/^%\s*$/) ||                                        // % (zsh)
         cleanLine.match(/^>\s*$/));                                         // > (some shells)

      if (isVeryObviousShellPrompt) {
        log(`✅ [TERMINATION] Very obvious shell prompt detected: "${cleanLine}"`);
        return {
          isTerminated: true,
          confidence: 0.75,  // Reduced confidence to be more conservative
          detectedLine: cleanLine,
          reason: 'Very obvious shell prompt detected',
        };
      } else {
        log(`⚠️ [TERMINATION] Possible AI output detected, ignoring shell prompt: "${cleanLine}"`);
      }
    }

    // 🆕 CLAUDE-SPECIFIC: Only use if we have very clear Claude session termination
    if (this.detectClaudeSessionEnd(cleanLine)) {
      log(`✅ [TERMINATION] Claude session end detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 0.90,  // Slightly reduced
        detectedLine: cleanLine,
        reason: 'Claude session termination',
      };
    }

    log(`❌ [TERMINATION] No termination detected for: "${cleanLine}"`);
    return {
      isTerminated: false,
      confidence: 0,
      detectedLine: cleanLine,
      reason: 'No strict termination detected',
    };
  }

  private hasVeryExplicitTerminationMessage(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase().trim();
    
    // 🚨 ULTRA-STRICT: Only match VERY specific termination messages
    // Greatly reduced to prevent false positives
    
    return (
      // Exact session termination messages only
      line === 'session ended' ||
      line === 'connection closed' ||
      line === 'session terminated' ||
      line === 'session completed' ||
      line === 'process finished' ||
      
      // Agent-specific exact termination messages
      line === 'goodbye claude' ||
      line === 'goodbye gemini' ||
      line === 'exiting claude' ||
      line === 'exiting gemini' ||
      line === 'claude exited' ||
      line === 'gemini exited' ||
      line === 'claude session ended' ||
      line === 'gemini session ended' ||
      
      // Command not found (exact matches only)
      line === 'command not found: claude' ||
      line === 'command not found: gemini' ||
      line.includes('no such file or directory') ||
      
      // Process termination patterns (exact matches)
      line.includes('[process exited') ||
      line.includes('process terminated') ||
      
      // Agent powering down (exact context required)
      (line.includes('agent') && line.includes('powering down')) ||
      (line.includes('agent') && line === 'goodbye')
    );
  }

  private hasProcessCrashIndicator(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase();
    return (
      line.includes('segmentation fault') ||
      line.includes('core dumped') ||
      line.includes('fatal error') ||
      line.includes('panic:') ||
      line.includes('killed') ||
      line.includes('abort') ||
      line.includes('crashed') ||
      line.includes('exception') ||
      line.includes('stack overflow') ||
      line.includes('out of memory') ||
      line.includes('signal') ||
      line.includes('terminated unexpectedly')
    );
  }

  /**
   * 🆕 CLAUDE-SPECIFIC: Detect legitimate Claude session termination
   * Focus on genuine session end patterns, avoiding false positives from user input
   *
   * Key insight: When Claude exits, the interactive prompt disappears
   * and the shell prompt returns
   */
  private detectClaudeSessionEnd(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase().trim();

    // 🚨 ULTRA-CONSERVATIVE: Only detect VERY explicit Claude termination
    // Significantly reduced false positive detection

    // 1. Only exact shell prompt patterns with very strict matching
    const shellPromptPatterns = [
      /^[a-z0-9._-]+@[a-z0-9.-]+:[~\/][^$]*\$\s*$/i, // user@host:~$ or user@host:/path$
      /^[a-z0-9._-]+@[a-z0-9.-]+\s*\$\s*$/i,         // user@host $
      /^\$\s*$/,                                       // Just $ (simple shell)
      /^%\s*$/,                                        // % (zsh)
      /^>\s*$/,                                        // > (some shells)
    ];

    // 🚨 STRICT CHECK: Line must be very short and match exact patterns
    const isExactShellPrompt = line.length <= 20 && 
                               shellPromptPatterns.some((pattern) => pattern.test(line)) &&
                               !line.includes('claude') &&    // Don't match if contains "claude"
                               !line.includes('gemini') &&    // Don't match if contains "gemini"
                               !line.includes('help') &&      // Don't match common AI words
                               !line.includes('i') &&         // Don't match personal pronouns
                               !line.includes('you') &&
                               !line.includes('the') &&       // Don't match articles
                               !line.includes('to') &&        // Don't match prepositions
                               !/\d/.test(line) &&           // Don't match if contains numbers
                               !line.includes(':') &&        // Don't match colons (often in AI responses)
                               !line.includes('(') &&        // Don't match parentheses
                               !line.includes(')');

    // 2. Only VERY explicit Claude termination messages
    const hasExplicitTermination =
      line === 'session ended' ||                    // Exact match only
      line === 'goodbye claude' ||                   // Exact match only
      line === 'claude session terminated' ||       // Exact match only
      line === 'exiting claude' ||                  // Exact match only
      line === 'claude exited' ||                   // Exact match only
      line === 'connection closed';                 // Exact match only
    // 🚨 REMOVED: Generic "exit" matching to prevent false positives

    // 3. Process completion with EXACT context only
    const hasProcessCompletion =
      line === '[done]' ||                          // Exact match
      line === '[finished]' ||                     // Exact match
      line === 'done' ||                           // Exact match only if standalone
      line === 'finished' ||                      // Exact match only if standalone
      /^\[process exited with code \d+\]$/.test(line); // Exact pattern match

    // 4. VERY specific Claude session end indicators only
    const hasSessionEndIndicator =
      /^\[process exited with code \d+\]$/i.test(line) ||  // Process exit status
      line.includes('cleaning up claude session') ||        // Specific Claude cleanup
      line.includes('claude session closed');               // Specific Claude session end

    // 🚨 CONSERVATIVE LOGIC: Only trigger on very clear indicators
    const shouldTerminate = hasExplicitTermination || 
                           hasProcessCompletion ||
                           hasSessionEndIndicator ||
                           (isExactShellPrompt && line.length <= 10); // Very short shell prompts only

    return shouldTerminate;
  }

  private detectClaudeFromInput(input: string): { isDetected: boolean; confidence: number } {
    const line = input.toLowerCase();

    // Very high confidence patterns
    if (line.startsWith('claude ') || line === 'claude') {
      return { isDetected: true, confidence: 1.0 };
    }

    // High confidence patterns
    if (line.includes('claude-code') || line.includes('claude code')) {
      return { isDetected: true, confidence: 0.95 };
    }

    // Medium confidence patterns
    if (line.includes('claude') && (line.includes('--help') || line.includes('-h'))) {
      return { isDetected: true, confidence: 0.9 };
    }

    return { isDetected: false, confidence: 0 };
  }

  private detectGeminiFromInput(input: string): { isDetected: boolean; confidence: number } {
    const line = input.toLowerCase();

    // Very high confidence patterns
    if (line.startsWith('gemini ') || line === 'gemini') {
      return { isDetected: true, confidence: 1.0 };
    }

    // High confidence patterns
    if (line.includes('gemini code') || line.includes('gemini chat')) {
      return { isDetected: true, confidence: 0.95 };
    }

    // Common gemini subcommands
    if (
      line.startsWith('gemini ') &&
      (line.includes('generate') ||
        line.includes('ask') ||
        line.includes('explain') ||
        line.includes('create') ||
        line.includes('analyze') ||
        line.includes('review'))
    ) {
      return { isDetected: true, confidence: 0.95 };
    }

    // Medium confidence patterns
    if (line.includes('gemini') && (line.includes('--help') || line.includes('-h'))) {
      return { isDetected: true, confidence: 0.9 };
    }

    return { isDetected: false, confidence: 0 };
  }

  /**
   * Detect OpenAI Codex CLI from input command
   */
  private detectCodexFromInput(input: string): { isDetected: boolean; confidence: number } {
    const line = input.toLowerCase();

    // Very high confidence patterns - OpenAI Codex CLI commands
    if (line.startsWith('codex ') || line === 'codex') {
      return { isDetected: true, confidence: 1.0 };
    }

    // High confidence patterns - specific Codex CLI usage
    if (line.includes('@openai/codex') || line.includes('codex-cli')) {
      return { isDetected: true, confidence: 0.95 };
    }

    // Common Codex CLI subcommands and patterns
    if (
      line.startsWith('codex ') &&
      (line.includes('edit') ||
        line.includes('create') ||
        line.includes('fix') ||
        line.includes('explain') ||
        line.includes('review') ||
        line.includes('generate') ||
        line.includes('refactor') ||
        line.includes('debug') ||
        line.includes('test') ||
        line.includes('auto'))
    ) {
      return { isDetected: true, confidence: 0.95 };
    }

    // Medium confidence patterns - OpenAI references
    if (line.includes('codex') && (line.includes('--help') || line.includes('-h'))) {
      return { isDetected: true, confidence: 0.9 };
    }

    // Lower confidence - potential Codex CLI usage patterns
    if (line.includes('codex') && (line.includes('config') || line.includes('auth'))) {
      return { isDetected: true, confidence: 0.85 };
    }

    return { isDetected: false, confidence: 0 };
  }

  /**
   * Detect OpenAI Codex CLI from output patterns
   */
  private detectCodexFromOutput(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const lowerOutput = output.toLowerCase();

    // High confidence patterns - OpenAI Codex specific output
    if (lowerOutput.includes('openai codex')) {
      return true;
    }

    // OpenAI CLI tool patterns
    if (lowerOutput.includes('openai') && lowerOutput.includes('codex')) {
      return true;
    }

    // Codex CLI welcome messages
    if (
      lowerOutput.includes('codex cli') ||
      lowerOutput.includes('codex assistant') ||
      lowerOutput.includes('codex ai')
    ) {
      return true;
    }

    // OpenAI API patterns in output
    if (
      lowerOutput.includes('api.openai.com') ||
      (lowerOutput.includes('openai') && lowerOutput.includes('api'))
    ) {
      return true;
    }

    // Model references that indicate Codex
    if (
      lowerOutput.includes('code-davinci') ||
      lowerOutput.includes('text-davinci') ||
      lowerOutput.includes('gpt-3.5-turbo-instruct')
    ) {
      return true;
    }

    return false;
  }
}
