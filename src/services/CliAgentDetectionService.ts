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

  getConnectedAgent(): { terminalId: string; type: 'claude' | 'gemini' } | null {
    const terminalId = this.stateManager.getConnectedAgentTerminalId();
    const type = this.stateManager.getConnectedAgentType();

    if (terminalId && type) {
      return { terminalId, type };
    }

    return null;
  }

  getDisconnectedAgents(): Map<string, { type: 'claude' | 'gemini'; startTime: Date }> {
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
      if (disconnectedAgents.has(terminalId)) {
        const agentInfo = disconnectedAgents.get(terminalId)!;
        this.stateManager.promoteDisconnectedAgentToConnected(terminalId);
        log(`🔄 [CLI-AGENT] Switched connection to terminal ${terminalId}`);
        return {
          success: true,
          newStatus: 'connected',
          agentType: agentInfo.type,
        };
      }

      const currentState = this.getAgentState(terminalId);
      log(`⚠️ [CLI-AGENT] Cannot switch to terminal ${terminalId}: not in disconnected state`);
      return {
        success: false,
        reason: 'Terminal is not in disconnected state',
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

    // 🔧 CRITICAL FIX: Enhanced shell prompt detection for Claude silent exits
    // Claude often exits silently, so we need to be more aggressive about shell prompt detection
    if (this.patternDetector.detectShellPrompt(cleanLine)) {
      const lowerLine = cleanLine.toLowerCase();
      const hasAgentKeywords = lowerLine.includes('claude') || lowerLine.includes('gemini');
      
      // 🚨 ENHANCED: More comprehensive AI output detection
      const looksLikeAIOutput =
        hasAgentKeywords &&
        (lowerLine.includes('assistant') ||
          lowerLine.includes('help you') ||
          lowerLine.includes('i am') ||
          lowerLine.includes("i'm") ||
          lowerLine.includes('let me') ||
          lowerLine.includes('i can') ||
          lowerLine.includes('i will') ||
          lowerLine.includes("i'll") ||
          lowerLine.includes('would you like') ||
          lowerLine.includes('how can i') ||
          lowerLine.includes('understand') ||
          lowerLine.includes('analyze') ||
          lowerLine.includes('looking at') ||
          lowerLine.includes('working on') ||
          lowerLine.includes('thinking') ||
          lowerLine.includes('response') ||
          lowerLine.includes('question') ||
          lowerLine.includes('request'));

      // 🚨 ADDITIONAL: Check for typical Claude conversational patterns
      const hasConversationalPattern = 
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
        lowerLine.includes('thank you');

      // 🚨 CLAUDE FIX: Be much more conservative with shell prompt detection
      // Only trigger termination if we're very confident it's NOT AI output
      if (cleanLine.length < 50 && // Much stricter length limit
          !looksLikeAIOutput && 
          !hasConversationalPattern &&
          !lowerLine.includes('...') && // Thinking indicators
          !lowerLine.includes('let') && // Common Claude phrase starts
          !lowerLine.includes('the') && // Common article usage in Claude responses
          !lowerLine.includes('to') &&  // Common preposition in Claude responses
          !lowerLine.includes('for')) { // Another common preposition
        log(`✅ [TERMINATION] Shell prompt detected (Claude silent exit): "${cleanLine}"`);
        return {
          isTerminated: true,
          confidence: 0.85, // Reduced confidence due to increased strictness
          detectedLine: cleanLine,
          reason: 'Shell prompt detected after Claude silent exit',
        };
      } else {
        log(`⚠️ [TERMINATION] Possible AI output or conversation detected, ignoring: "${cleanLine}"`);
      }
    }

    // 🆕 CLAUDE-SPECIFIC: Legitimate Claude session termination detection
    if (this.detectClaudeSessionEnd(cleanLine)) {
      log(`✅ [TERMINATION] Claude session end detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 0.95,
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
    const line = cleanLine.toLowerCase();
    return (
      line.includes('session ended') ||
      line.includes('connection closed') ||
      (line.includes('goodbye') &&
        (line.includes('claude') || line.includes('gemini') || line.includes('agent'))) || // 🔧 FIX: Context required
      line.includes('exiting claude') || // 🔧 FIX: Be more specific to avoid "exit" false positive
      line.includes('exiting gemini') ||
      line.includes('session terminated') || // 🔧 FIX: Be more specific
      line.includes('disconnected from') ||
      (line.includes('claude') && line.includes('exited')) ||
      (line.includes('gemini') && line.includes('exited')) ||
      line.includes('command not found: claude') ||
      line.includes('command not found: gemini') ||
      line.includes('no such file or directory') ||
      line.includes('process finished') ||
      line.includes('session completed') ||
      // 🔧 FIX: Add Gemini-specific termination messages from log
      line.includes('agent powering down') ||
      line.includes('powering down') ||
      (line.includes('agent') && line.includes('goodbye'))
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

    // 🚨 CRITICAL: Only detect genuine session termination patterns
    // Avoid false positives from user typing "exit", numbers, etc.

    // 1. Shell prompt return patterns (most reliable indicator)
    const shellPromptPatterns = [
      /^[a-z0-9._-]+@[a-z0-9.-]+:[~\/][^$]*\$\s*$/i, // user@host:~$ or user@host:/path$
      /^[a-z0-9._-]+@[a-z0-9.-]+\s*\$\s*$/i, // user@host $
      /^\$\s*$/, // Just $ (simple shell)
      /^%\s*$/, // % (zsh)
      /^>\s*$/, // > (some shells)
    ];

    const hasShellPrompt = shellPromptPatterns.some((pattern) => pattern.test(line));

    // 2. EOF signal is user input (Ctrl+D), not detectable from output
    // When user presses Ctrl+D, Claude exits and shell prompt appears

    // 3. Explicit Claude termination messages (if any)
    const hasExplicitTermination =
      line.includes('session ended') ||
      (line.includes('goodbye') && line.includes('claude')) ||
      line.includes('claude session terminated') ||
      line.includes('exiting claude');
      // 🚨 IMPORTANT: Do NOT match standalone "exit" - too generic and causes false positives

    // 4. Process completion with context (more restrictive)
    const hasProcessCompletion =
      // Only exact matches for process completion - no substring matching
      line === '[done]' ||
      line === '[finished]' ||
      line === 'done' ||
      line === 'finished' ||
      // Process exit with code
      /^\[process exited with code \d+\]$/.test(line) ||
      // Exit status codes (exact match only)
      /^exit status: \d+$/.test(line);

    // 5. Claude interactive session end indicators
    // When Claude exits, these interactive elements disappear
    const hasSessionEndIndicator =
      // Process exit status codes (when Claude terminates)
      /^\[process exited with code \d+\]$/i.test(line) ||
      // Terminal control sequence indicating session end
      line.includes('\x1b[?2004l') || // Bracketed paste mode disabled
      // Claude session cleanup messages
      line.includes('cleaning up claude session') ||
      line.includes('claude session closed');

    return (
      hasShellPrompt || hasExplicitTermination || hasProcessCompletion || hasSessionEndIndicator
    );
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
}
