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
    // Initialize detection cache with configuration - store as cache entries
    const timestamp = Date.now();
    this.detectionCache.set('terminationGracePeriod', { result: null, timestamp }); // 1 second grace period
    this.detectionCache.set('aiActivityTimeout', { result: null, timestamp }); // 30 seconds timeout
    this.detectionCache.set('claudeActivityTimeout', { result: null, timestamp }); // 20 seconds for Claude specific
    this.detectionCache.set('maxShellPromptLength', { result: null, timestamp }); // Maximum shell prompt length
    this.detectionCache.set('relaxedModeEnabled', { result: null, timestamp }); // Enable relaxed detection mode

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

      // 🎯 UNIFIED APPROACH: Use relaxed detection for both connected and disconnected agents
      const lines = data.split(/\r?\n/);
      let terminationDetected = false;
      let detectedLine = '';
      let maxConfidence = 0;
      let reason = '';

      for (const line of lines) {
        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(line.trim());
        if (!cleanLine) continue;

        // 🔄 USE RELAXED DETECTION: Apply the same lenient logic for all cases
        const detectionResult = this.detectStrictTermination(terminalId, cleanLine);
        
        if (detectionResult.isTerminated && detectionResult.confidence > maxConfidence) {
          terminationDetected = true;
          detectedLine = detectionResult.detectedLine || '';
          maxConfidence = detectionResult.confidence;
          reason = detectionResult.reason;
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

      if (terminationDetected) {
        result = {
          isTerminated: true,
          confidence: maxConfidence,
          detectedLine,
          reason,
        };
      } else {
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
  forceReconnectAgent(
    terminalId: string,
    agentType: 'claude' | 'gemini' | 'codex' = 'claude',
    terminalName?: string
  ): boolean {
    log(
      `🔄 [MANUAL-RESET] User triggered force reconnect for terminal ${terminalId} as ${agentType}`
    );

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
      cacheKeys.forEach((key) => this.detectionCache.delete(key));
      log(`🧹 [MANUAL-RESET] Cleared ${cacheKeys.length} cache entries for terminal ${terminalId}`);

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
      cacheKeys.forEach((key) => this.detectionCache.delete(key));
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
          .replace(/[\u2502\u256d\u2570\u2500\u256f]/g, '') // Remove box characters only
          .trim();

        // 🔧 FIX: Allow shell prompts like "$" or "%" (single character)
        if (!fullyCleanLine || fullyCleanLine.length < 1) continue;

        // 🆕 UPDATE AI ACTIVITY TIMESTAMP: Track when we see AI-like output
        const lowerLine = fullyCleanLine.toLowerCase();
        const looksLikeAIActivity =
          lowerLine.includes('claude') ||
          lowerLine.includes('gemini') ||
          lowerLine.includes('assistant') ||
          lowerLine.includes('thinking') ||
          lowerLine.includes('analyzing') ||
          lowerLine.includes('working') ||
          lowerLine.includes('i am') ||
          lowerLine.includes("i'm") ||
          lowerLine.includes('let me') ||
          lowerLine.includes('i can') ||
          lowerLine.includes('i will') ||
          fullyCleanLine.length > 50; // Long outputs likely from AI

        if (looksLikeAIActivity) {
          this.detectionCache.set(`${terminalId}_lastAIOutput`, { result: null, timestamp: Date.now() });
        }

        // Check for termination first (for connected terminals ONLY)
        if (this.stateManager.isAgentConnected(terminalId)) {
          // 🔧 FIX: Use more relaxed termination detection for connected agents
          const terminationResult = this.detectStrictTermination(terminalId, line);
          if (terminationResult.isTerminated) {
            // 🆕 GRACE PERIOD: Add small delay before marking as terminated to avoid rapid state changes
            setTimeout(() => {
              this.stateManager.setAgentTerminated(terminalId);
              log(
                `🔻 [CLI-AGENT] Connected agent termination detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
              );
            }, 1000); // 1 second grace period
            
            return null; // Termination handled, no detection result needed
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
          const terminationResult = this.detectStrictTermination(terminalId, line);
          log(`🔍 [TERMINATION-DEBUG] Termination result: ${JSON.stringify(terminationResult)}`);

          if (terminationResult.isTerminated) {
            log(
              `🔻 [TERMINATION] Setting DISCONNECTED agent as terminated in terminal ${terminalId}`
            );
            // 🆕 GRACE PERIOD: Also add delay for disconnected agents
            setTimeout(() => {
              this.stateManager.setAgentTerminated(terminalId);
              log(
                `🔻 [CLI-AGENT] Disconnected agent termination detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
              );
            }, 1500); // Slightly longer for disconnected agents
            
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
          const geminiStartupDetected = this.patternDetector.detectGeminiStartup(fullyCleanLine);
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
          if (this.detectCodexFromOutput(fullyCleanLine)) {
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

    // Very explicit termination messages first (unchanged - keep these strong)
    if (this.hasVeryExplicitTerminationMessage(cleanLine)) {
      log(`✅ [TERMINATION] Explicit termination message detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 1.0,
        detectedLine: cleanLine,
        reason: 'Very explicit termination message',
      };
    }

    // Process crash indicators (unchanged - keep these strong)
    if (this.hasProcessCrashIndicator(cleanLine)) {
      log(`✅ [TERMINATION] Process crash detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 0.95,
        detectedLine: cleanLine,
        reason: 'Process crash detected',
      };
    }

    // 🎯 RELAXED DETECTION: Much more lenient shell prompt detection
    if (this.patternDetector.detectShellPrompt(cleanLine)) {
      const lowerLine = cleanLine.toLowerCase();

      // 🔄 REDUCED AI OUTPUT DETECTION: Only check for very obvious AI patterns
      const looksLikeAIOutput =
        lowerLine.includes('claude code') ||
        lowerLine.includes('gemini cli') ||
        lowerLine.includes('github copilot') ||
        lowerLine.includes('assistant:') ||
        lowerLine.includes('i am claude') ||
        lowerLine.includes('i am gemini') ||
        lowerLine.includes("i'm an ai") ||
        lowerLine.includes("i'm claude") ||
        lowerLine.includes("i'm gemini") ||
        lowerLine.includes('let me help') ||
        lowerLine.includes('i can help') ||
        lowerLine.includes('how can i help') ||
        lowerLine.includes('certainly! i') ||
        lowerLine.includes('sure! i') ||
        lowerLine.includes('of course! i') ||
        lowerLine.includes('thinking...') ||
        lowerLine.includes('analyzing...') ||
        lowerLine.includes('working on') ||
        // Remove most common words to reduce false positives
        cleanLine.includes('```') || // Code blocks
        cleanLine.includes('---') || // Markdown separators
        (cleanLine.includes('(') && cleanLine.includes(')') && cleanLine.length > 25) || // Complex expressions
        (cleanLine.includes('[') && cleanLine.includes(']') && cleanLine.length > 25) ||
        /^[A-Z][a-z]+:/.test(cleanLine) || // Likely explanatory text like "Error:" "Note:" etc
        (cleanLine.length > 40 && /[.!?]/.test(cleanLine)); // Long sentences

      // 🎯 MUCH MORE LENIENT: Detect termination more easily
      const isProbablyShellPrompt =
        cleanLine.length <= 50 && // Increased length limit significantly
        !looksLikeAIOutput &&
        (cleanLine.match(/^[a-z0-9._-]+@[a-z0-9.-]+:[~\/][^$]*\$\s*$/i) || // user@host:~$
          cleanLine.match(/^[a-z0-9._-]+@[a-z0-9.-]+\s*\$\s*$/i) || // user@host $
          cleanLine.match(/^[a-z0-9._-]+:\s*\$\s*$/i) || // hostname: $
          cleanLine.match(/^\$\s*$/) || // Just $
          cleanLine.match(/^%\s*$/) || // % (zsh)
          cleanLine.match(/^>\s*$/) || // > (some shells)
          cleanLine.match(/^PS\d+>\s*$/i) || // PowerShell
          cleanLine.match(/^C:\\.*>\s*$/i) || // Windows Command Prompt
          cleanLine.match(/^[a-z0-9._-]+\s*\$\s*$/i) || // Simple hostname $
          cleanLine.match(/^.*\s+\$\s*$/i) || // Any prompt ending with $
          cleanLine.match(/^.*\s+%\s*$/i) || // Any prompt ending with %
          // 🆕 MORE PATTERNS: Add additional common prompt patterns
          cleanLine.match(/^\s*[►▶]\s*$/i) || // Arrow prompts
          cleanLine.match(/^\s*[>]\s*$/i) || // Simple >
          cleanLine.match(/^In\s*\[\d+\]:\s*$/i) || // Jupyter/IPython style
          cleanLine.match(/^Out\s*\[\d+\]:\s*$/i) ||
          (cleanLine.length <= 10 && cleanLine.match(/[#$%>]+\s*$/)) // Short prompts
        );

      if (isProbablyShellPrompt) {
        log(`✅ [TERMINATION] Shell prompt detected (relaxed): "${cleanLine}"`);
        return {
          isTerminated: true,
          confidence: 0.6, // Reduced confidence but more lenient
          detectedLine: cleanLine,
          reason: 'Shell prompt detected (relaxed mode)',
        };
      } else {
        log(`⚠️ [TERMINATION] Possible AI output detected, ignoring: "${cleanLine}"`);
      }
    }

    // 🔄 KEEP: Claude-specific detection but make it more lenient
    if (this.detectClaudeSessionEnd(cleanLine)) {
      log(`✅ [TERMINATION] Claude session end detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 0.7, // Reduced from 0.9
        detectedLine: cleanLine,
        reason: 'Claude session termination',
      };
    }

    // 🆕 ADDITIONAL LENIENT PATTERNS: Add timeout-based detection
    // If we haven't seen AI output for a while, be more lenient
    const lastAIOutputEntry = this.detectionCache.get(`${terminalId}_lastAIOutput`);
    const timeSinceLastAIOutput = Date.now() - (lastAIOutputEntry?.timestamp || 0);
    if (timeSinceLastAIOutput > 30000) { // 30 seconds
      // After 30 seconds of no AI output, be much more lenient about shell prompts
      if (cleanLine.length <= 30 && 
          (cleanLine.includes('$') || cleanLine.includes('%') || cleanLine.includes('>')) &&
          !cleanLine.includes('claude') && !cleanLine.includes('gemini')) {
        log(`✅ [TERMINATION] Timeout-based shell prompt detected: "${cleanLine}"`);
        return {
          isTerminated: true,
          confidence: 0.5, // Low confidence but still detect
          detectedLine: cleanLine,
          reason: 'Timeout-based shell prompt detection',
        };
      }
    }

    log(`❌ [TERMINATION] No termination detected for: "${cleanLine}"`);
    return {
      isTerminated: false,
      confidence: 0,
      detectedLine: cleanLine,
      reason: 'No termination detected',
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

    // 🎯 RELAXED DETECTION: More lenient Claude termination patterns

    // 1. Expanded shell prompt patterns (more permissive)
    const shellPromptPatterns = [
      /^[a-z0-9._-]+@[a-z0-9.-]+:[~\/][^$]*\$\s*$/i, // user@host:~$ or user@host:/path$
      /^[a-z0-9._-]+@[a-z0-9.-]+\s*\$\s*$/i, // user@host $
      /^[a-z0-9._-]+:\s*\$\s*$/i, // hostname: $
      /^\$\s*$/, // Just $ (simple shell)
      /^%\s*$/, // % (zsh)
      /^>\s*$/, // > (some shells)
      /^PS\d+>\s*$/i, // PowerShell
      /^C:\\.*>\s*$/i, // Windows Command Prompt
      /^[a-z0-9._-]+\s*\$\s*$/i, // Simple hostname $
      /^.*\s+\$\s*$/i, // Any prompt ending with $
      /^.*\s+%\s*$/i, // Any prompt ending with %
    ];

    // 🔄 LESS STRICT: Allow more patterns that could be shell prompts
    const isLikelyShellPrompt =
      line.length <= 40 && // Increased from 20 to 40
      shellPromptPatterns.some((pattern) => pattern.test(line)) &&
      !line.includes('claude code') && // Only exclude very specific Claude patterns
      !line.includes('gemini cli') &&
      !line.includes('github copilot') &&
      !line.includes('how can i help') &&
      !line.includes('let me help') &&
      !line.includes('i am claude') &&
      !line.includes("i'm claude") &&
      !line.includes('thinking...') &&
      !line.includes('analyzing...') &&
      // Remove many restrictive filters to be more lenient
      !line.includes('```'); // Only exclude obvious code blocks

    // 2. Keep explicit termination messages (but add more patterns)
    const hasExplicitTermination =
      line === 'session ended' ||
      line === 'goodbye claude' ||
      line === 'claude session terminated' ||
      line === 'exiting claude' ||
      line === 'claude exited' ||
      line === 'connection closed' ||
      line === 'exit' || // 🆕 Add back simple "exit"
      line === 'quit' || // 🆕 Add "quit"
      line === 'goodbye' || // 🆕 Add "goodbye"
      line === 'bye' || // 🆕 Add "bye"
      line.includes('session terminated') || // 🆕 More flexible
      line.includes('connection closed') || // 🆕 More flexible
      line.includes('process exited'); // 🆕 More flexible

    // 3. Process completion (more permissive)
    const hasProcessCompletion =
      line === '[done]' ||
      line === '[finished]' ||
      line === 'done' ||
      line === 'finished' ||
      line === 'complete' || // 🆕 Add "complete"
      line === 'completed' || // 🆕 Add "completed"
      /^\[process exited with code \d+\]$/.test(line) ||
      /^process exited with code \d+$/.test(line) || // 🆕 Without brackets
      /^exited with code \d+$/.test(line); // 🆕 Shorter version

    // 4. More flexible session end indicators
    const hasSessionEndIndicator =
      /process exited with code \d+/i.test(line) || // More flexible matching
      line.includes('cleaning up') || // 🆕 More general cleanup
      line.includes('session closed') || // 🆕 More general session end
      line.includes('terminating') || // 🆕 Termination process
      line.includes('shutting down') || // 🆕 Shutdown process
      line.includes('disconnected'); // 🆕 Disconnection

    // 5. 🆕 TIME-BASED RELAXATION: If enough time has passed, be more lenient
    const isTimeBasedRelaxed = (() => {
      // If we haven't seen obvious AI activity in a while, allow simpler patterns
      const now = Date.now();
      const lastAIActivityEntry = this.detectionCache.get('lastClaudeActivity');
      const timeSinceActivity = now - (lastAIActivityEntry?.timestamp || 0);
      
      // After 20 seconds of no obvious Claude activity, be more lenient
      if (timeSinceActivity > 20000) {
        return line.length <= 30 && 
               (line.includes('$') || line.includes('%') || line.includes('>')) &&
               !line.includes('claude code') &&
               !line.includes('gemini cli');
      }
      return false;
    })();

    // 🎯 MORE PERMISSIVE LOGIC: Multiple ways to detect termination
    const shouldTerminate =
      hasExplicitTermination ||
      hasProcessCompletion ||
      hasSessionEndIndicator ||
      isLikelyShellPrompt ||
      isTimeBasedRelaxed; // 🆕 Add time-based relaxation

    // 🆕 UPDATE ACTIVITY TRACKING: Track when we see Claude-like activity
    if (line.includes('claude') || line.includes('thinking') || line.includes('analyzing') || 
        line.includes('let me') || line.includes('i can') || line.includes('i will')) {
      this.detectionCache.set('lastClaudeActivity', { result: null, timestamp: Date.now() });
    }

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
