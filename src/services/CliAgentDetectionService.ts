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
      // For connected agents, use strict termination detection
      if (this.stateManager.isAgentConnected(terminalId)) {
        return this.detectStrictTermination(terminalId, data);
      }

      // For non-connected agents, use regular shell prompt detection
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(line.trim());
        if (cleanLine && this.patternDetector.detectShellPrompt(cleanLine)) {
          return {
            isTerminated: true,
            confidence: 0.8,
            detectedLine: cleanLine,
            reason: 'Shell prompt detected',
          };
        }
      }

      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: '',
        reason: 'No termination detected',
      };
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

        if (!fullyCleanLine || fullyCleanLine.length < 2) continue;

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

    // 🔧 FIXED: Use the improved shell prompt detection from patternDetector
    // This now has better filtering to avoid false positives from AI agent output
    if (this.patternDetector.detectShellPrompt(cleanLine)) {
      // Additional validation for connected agents to be extra sure
      // 🔧 FIX: Only filter out agent keywords if they appear to be AI output, not directory names
      const lowerLine = cleanLine.toLowerCase();
      const hasAgentKeywords = lowerLine.includes('claude') || lowerLine.includes('gemini');
      const looksLikeAIOutput =
        hasAgentKeywords &&
        (lowerLine.includes('assistant') ||
          lowerLine.includes('help you') ||
          lowerLine.includes('i am') ||
          lowerLine.includes("i'm"));

      if (cleanLine.length < 100 && !looksLikeAIOutput) {
        log(`✅ [TERMINATION] Shell prompt detected: "${cleanLine}"`);
        return {
          isTerminated: true,
          confidence: 0.9,
          detectedLine: cleanLine,
          reason: 'Shell prompt detected after agent exit',
        };
      } else {
        log(
          `⚠️ [TERMINATION] Shell prompt detected but filtered out due to AI output indicators: "${cleanLine}"`
        );
      }
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
      line.includes('goodbye') ||
      line.includes('exiting') ||
      line.includes('terminated') ||
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
