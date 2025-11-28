/**
 * 🆕 CLI Agent Termination Detection Service
 *
 * Extracted from CliAgentDetectionService to provide specialized termination detection
 * with enhanced validation and pattern matching capabilities.
 */

import { terminal as log } from '../utils/logger';
import { TerminationDetectionResult, DetectionCacheEntry } from '../interfaces/CliAgentService';
import { CliAgentPatternDetector } from './CliAgentPatternDetector';
import { LRUCache } from '../utils/LRUCache';

export class CliAgentTerminationDetector {
  private patternDetector = new CliAgentPatternDetector();
  private detectionCache: LRUCache<string, DetectionCacheEntry>;

  constructor(cache: LRUCache<string, DetectionCacheEntry>) {
    this.detectionCache = cache;
  }

  /**
   * 🆕 ENHANCED TERMINATION VALIDATION: Prevents premature agent termination
   * This method adds additional checks to ensure termination signals are legitimate
   */
  validateTerminationSignal(
    terminalId: string,
    cleanLine: string,
    terminationResult: TerminationDetectionResult
  ): boolean {
    // 1. High confidence termination should always be valid
    if (terminationResult.confidence >= 0.9) {
      return true;
    }

    // 2. Check for recent AI activity - if we saw AI output recently, be more cautious
    const lastAIOutputEntry = this.detectionCache.get(`${terminalId}_lastAIOutput`);
    const timeSinceLastAIOutput = Date.now() - (lastAIOutputEntry?.timestamp || 0);

    // If we saw AI activity within the last 10 seconds, require higher confidence
    if (timeSinceLastAIOutput < 10000) {
      log(
        `🔍 [VALIDATION] Recent AI activity detected (${timeSinceLastAIOutput}ms ago), requiring higher confidence`
      );
      return terminationResult.confidence >= 0.8;
    }

    // 3. Check for obvious shell prompts (these are usually valid)
    const isObviousShellPrompt = this.isObviousShellPrompt(cleanLine);
    if (isObviousShellPrompt) {
      return true;
    }

    // 4. Check for process completion indicators
    const hasProcessCompletion = this.hasProcessCompletionIndicator(cleanLine);
    if (hasProcessCompletion) {
      return true;
    }

    // 5. Medium confidence with some time passed should be valid
    if (terminationResult.confidence >= 0.6 && timeSinceLastAIOutput >= 5000) {
      return true;
    }

    // 6. Default to false for low confidence termination signals
    log(
      `🔍 [VALIDATION] Termination signal validation failed: confidence=${terminationResult.confidence}, timeSinceAI=${timeSinceLastAIOutput}ms`
    );
    return false;
  }

  /**
   * Detect strict termination with enhanced validation
   */
  detectStrictTermination(terminalId: string, line: string): TerminationDetectionResult {
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
      // Use precise patterns to prevent substring attacks while avoiding URL false positives
      const looksLikeAIOutput =
        /(^|\s)claude code(\s|$)/i.test(cleanLine) ||
        /(^|\s)gemini cli(\s|$)/i.test(cleanLine) ||
        /(^|\s)github copilot(\s|$)/i.test(cleanLine) ||
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
          (cleanLine.length <= 10 && cleanLine.match(/[#$%>]+\s*$/))); // Short prompts

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
    if (timeSinceLastAIOutput > 30000) {
      // 30 seconds
      // After 30 seconds of no AI output, be much more lenient about shell prompts
      if (
        cleanLine.length <= 30 &&
        (cleanLine.includes('$') || cleanLine.includes('%') || cleanLine.includes('>')) &&
        !cleanLine.includes('claude') &&
        !cleanLine.includes('gemini')
      ) {
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

  /**
   * Check if the line is an obvious shell prompt that indicates legitimate termination
   */
  private isObviousShellPrompt(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase().trim();

    // Very obvious shell prompt patterns
    return (
      // Standard shell prompts
      (/^[a-z0-9._-]+@[a-z0-9.-]+:[~\/][^$]*\$\s*$/i.test(line) || // user@host:~$
        /^[a-z0-9._-]+@[a-z0-9.-]+\s*\$\s*$/i.test(line) || // user@host $
        /^\$\s*$/.test(line) || // Just $
        /^%\s*$/.test(line) || // % (zsh)
        /^>\s*$/.test(line) || // > (some shells)
        /^PS\d+>\s*$/i.test(line) || // PowerShell
        /^C:\\.+>\s*$/i.test(line)) && // Windows Command Prompt
      // Exclude lines that look like AI responses
      !line.includes('claude') &&
      !line.includes('gemini') &&
      !line.includes('assistant') &&
      !line.includes('help') &&
      line.length < 50
    ); // Shell prompts are typically short
  }

  /**
   * Check if the line indicates process completion
   */
  private hasProcessCompletionIndicator(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase().trim();

    return (
      // Process completion patterns
      line === '[done]' ||
      line === '[finished]' ||
      line === 'done' ||
      line === 'finished' ||
      line === 'complete' ||
      line === 'completed' ||
      /^\[process exited with code \d+\]$/.test(line) ||
      /^process exited with code \d+$/.test(line) ||
      /^exited with code \d+$/.test(line) ||
      // Session end patterns
      line === 'session ended' ||
      line === 'connection closed' ||
      line === 'session terminated' ||
      line.includes('[process exited') ||
      line.includes('process terminated')
    );
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
      !/(^|\s)claude code(\s|$)/i.test(line) && // Only exclude very specific Claude patterns - prevent URL attacks
      !/(^|\s)gemini cli(\s|$)/i.test(line) &&
      !/(^|\s)github copilot(\s|$)/i.test(line) &&
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
        return (
          line.length <= 30 &&
          (line.includes('$') || line.includes('%') || line.includes('>')) &&
          !line.includes('claude code') &&
          !line.includes('gemini cli')
        );
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
    if (
      line.includes('claude') ||
      line.includes('thinking') ||
      line.includes('analyzing') ||
      line.includes('let me') ||
      line.includes('i can') ||
      line.includes('i will')
    ) {
      this.detectionCache.set('lastClaudeActivity', { result: null, timestamp: Date.now() });
    }

    return shouldTerminate;
  }
}
