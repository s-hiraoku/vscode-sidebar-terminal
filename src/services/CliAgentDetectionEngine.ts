/**
 * CLI Agent Detection Engine
 *
 * Unified detection logic for CLI Agent startup, activity, and termination.
 * Uses CliAgentPatternRegistry as single source of truth for all patterns.
 *
 * This engine consolidates the logic from:
 * - InputDetectionProcessor
 * - OutputDetectionProcessor
 * - CliAgentTerminationDetector
 * - CliAgentPatternDetector
 *
 * Benefits:
 * - Single detection engine instead of multiple processors
 * - Consistent pattern matching across all detection types
 * - Reduced code duplication and maintenance overhead
 * - Improved performance through shared pattern registry
 */

import { terminal as log } from '../utils/logger';
import { CliAgentPatternRegistry, AgentType } from './CliAgentPatternRegistry';
import { LRUCache } from '../utils/LRUCache';

/**
 * Detection result for CLI agent operations
 */
export interface DetectionResult {
  /** Agent type that was detected */
  agentType: AgentType | null;

  /** Whether an agent was detected */
  isDetected: boolean;

  /** Confidence level (0.0 - 1.0) */
  confidence: number;

  /** Source of detection (input/output) */
  source: 'input' | 'output' | 'termination';

  /** The line that triggered detection */
  detectedLine?: string;

  /** Reason for detection/non-detection */
  reason?: string;
}

/**
 * Termination detection result
 */
export interface TerminationResult {
  /** Whether termination was detected */
  isTerminated: boolean;

  /** Confidence level (0.0 - 1.0) */
  confidence: number;

  /** The line that triggered termination */
  detectedLine: string;

  /** Reason for termination detection */
  reason: string;
}

/**
 * Cache entry for detection results
 */
interface DetectionCacheEntry {
  result: DetectionResult | null;
  timestamp: number;
}

/**
 * Unified CLI Agent Detection Engine
 */
export class CliAgentDetectionEngine {
  private readonly patternRegistry: CliAgentPatternRegistry;
  private readonly detectionCache: LRUCache<string, DetectionCacheEntry>;

  // Configuration
  private readonly CACHE_TTL_MS = 5000; // 5 seconds
  private readonly AI_ACTIVITY_TIMEOUT_MS = 10000; // 10 seconds
  private readonly TERMINATION_GRACE_PERIOD_MS = 2000; // 2 seconds

  constructor() {
    this.patternRegistry = new CliAgentPatternRegistry();
    this.detectionCache = new LRUCache<string, DetectionCacheEntry>(100);
  }

  /**
   * Detect CLI agent from user input command
   * @param terminalId Terminal ID where input occurred
   * @param input User input command
   * @returns Detection result
   */
  public detectFromInput(terminalId: string, input: string): DetectionResult {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return this.createNegativeResult('input', 'Empty input');
    }

    // Check cache first
    const cacheKey = `input:${terminalId}:${trimmedInput}`;
    const cached = this.detectionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      if (cached.result) {
        return cached.result;
      }
    }

    log(`🎯 [INPUT-DETECTION] Processing input: "${trimmedInput}"`);

    // Use pattern registry to match command
    const agentType = this.patternRegistry.matchCommandInput(trimmedInput);

    if (agentType) {
      const result: DetectionResult = {
        agentType,
        isDetected: true,
        confidence: 1.0,
        source: 'input',
        detectedLine: trimmedInput,
        reason: `Command matched ${agentType} agent`,
      };

      // Cache the result
      this.detectionCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      log(`✅ [INPUT-DETECTION] Detected ${agentType} from input: "${trimmedInput}"`);
      return result;
    }

    const negativeResult = this.createNegativeResult('input', 'No agent command matched');

    // Cache negative result
    this.detectionCache.set(cacheKey, {
      result: negativeResult,
      timestamp: Date.now(),
    });

    return negativeResult;
  }

  /**
   * Detect CLI agent from terminal output
   * @param terminalId Terminal ID where output occurred
   * @param data Raw terminal output data
   * @returns Detection result
   */
  public detectFromOutput(terminalId: string, data: string): DetectionResult {
    try {
      const lines = data.split(/\r?\n/);

      for (const line of lines) {
        const result = this.processOutputLine(terminalId, line);
        if (result.isDetected) {
          return result;
        }
      }

      return this.createNegativeResult('output', 'No agent pattern matched');
    } catch (error) {
      log('ERROR: Output detection processing failed:', error);
      return this.createNegativeResult('output', 'Detection error');
    }
  }

  /**
   * Process a single line of terminal output
   * @param terminalId Terminal ID
   * @param line Raw output line
   * @returns Detection result
   */
  private processOutputLine(terminalId: string, line: string): DetectionResult {
    const trimmed = line.trim();
    if (!trimmed) {
      return this.createNegativeResult('output', 'Empty line');
    }

    // Clean ANSI escape sequences
    const cleanLine = this.patternRegistry.cleanAnsiEscapeSequences(trimmed);
    const fullyCleanLine = this.removeBoxCharacters(cleanLine);

    if (!fullyCleanLine || fullyCleanLine.length < 1) {
      return this.createNegativeResult('output', 'Empty after cleaning');
    }

    // Update AI activity timestamp
    this.updateAIActivityTimestamp(terminalId, fullyCleanLine);

    // Check for startup patterns
    const agentType = this.patternRegistry.matchStartupOutput(fullyCleanLine);

    if (agentType) {
      log(`🚀 [OUTPUT-DETECTION] Detected ${agentType} startup: "${fullyCleanLine}"`);

      return {
        agentType,
        isDetected: true,
        confidence: 0.9,
        source: 'output',
        detectedLine: fullyCleanLine,
        reason: `Startup pattern matched for ${agentType}`,
      };
    }

    return this.createNegativeResult('output', 'No startup pattern matched');
  }

  /**
   * Detect CLI agent termination
   * @param terminalId Terminal ID
   * @param data Terminal output data
   * @param currentAgentType Current connected agent type (optional)
   * @returns Termination detection result
   */
  public detectTermination(
    terminalId: string,
    data: string,
    currentAgentType?: AgentType
  ): TerminationResult {
    try {
      const lines = data.split(/\r?\n/);
      let maxConfidence = 0;
      let bestResult: TerminationResult | null = null;

      for (const line of lines) {
        const cleanLine = this.patternRegistry.cleanAnsiEscapeSequences(line.trim());
        if (!cleanLine) continue;

        const result = this.detectStrictTermination(terminalId, cleanLine, currentAgentType);

        if (result.isTerminated && result.confidence > maxConfidence) {
          maxConfidence = result.confidence;
          bestResult = result;
        }
      }

      return (
        bestResult || {
          isTerminated: false,
          confidence: 0,
          detectedLine: '',
          reason: 'No termination detected',
        }
      );
    } catch (error) {
      log('ERROR: Termination detection failed:', error);
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: '',
        reason: 'Detection error',
      };
    }
  }

  /**
   * Strict termination detection with validation
   * @param terminalId Terminal ID
   * @param cleanLine Cleaned output line
   * @param agentType Current agent type (optional)
   * @returns Termination result
   */
  private detectStrictTermination(
    terminalId: string,
    cleanLine: string,
    agentType?: AgentType
  ): TerminationResult {
    // 1. Check explicit termination patterns (highest confidence)
    if (this.patternRegistry.isTerminationPattern(cleanLine, agentType)) {
      log(`✅ [TERMINATION] Explicit termination detected: "${cleanLine}"`);
      return {
        isTerminated: true,
        confidence: 1.0,
        detectedLine: cleanLine,
        reason: 'Explicit termination pattern',
      };
    }

    // 2. Check shell prompt patterns
    if (this.patternRegistry.isShellPrompt(cleanLine)) {
      const lowerLine = cleanLine.toLowerCase();

      // Check if this looks like AI output (reduce false positives)
      const looksLikeAIOutput =
        this.patternRegistry.isAgentActivity(cleanLine) ||
        lowerLine.includes('thinking...') ||
        lowerLine.includes('analyzing...') ||
        cleanLine.includes('```') ||
        (cleanLine.includes('[') && cleanLine.includes(']') && cleanLine.length > 25);

      if (!looksLikeAIOutput && cleanLine.length <= 50) {
        // Validate with recent AI activity check
        const isValid = this.validateTerminationSignal(terminalId, 0.6);

        if (isValid) {
          log(`✅ [TERMINATION] Shell prompt detected: "${cleanLine}"`);
          return {
            isTerminated: true,
            confidence: 0.6,
            detectedLine: cleanLine,
            reason: 'Shell prompt detected',
          };
        } else {
          log(`⚠️ [TERMINATION] Shell prompt ignored (recent AI activity): "${cleanLine}"`);
        }
      }
    }

    // 3. Time-based lenient detection
    const lastAIOutputEntry = this.detectionCache.get(`${terminalId}_lastAIOutput`);
    const timeSinceLastAIOutput = Date.now() - (lastAIOutputEntry?.timestamp || 0);

    if (timeSinceLastAIOutput > 30000) {
      // 30 seconds timeout
      if (
        cleanLine.length <= 30 &&
        (cleanLine.includes('$') || cleanLine.includes('%') || cleanLine.includes('>')) &&
        !cleanLine.includes('claude') &&
        !cleanLine.includes('gemini')
      ) {
        log(`✅ [TERMINATION] Timeout-based detection: "${cleanLine}"`);
        return {
          isTerminated: true,
          confidence: 0.5,
          detectedLine: cleanLine,
          reason: 'Timeout-based detection',
        };
      }
    }

    return {
      isTerminated: false,
      confidence: 0,
      detectedLine: cleanLine,
      reason: 'No termination pattern matched',
    };
  }

  /**
   * Validate termination signal based on recent activity
   * @param terminalId Terminal ID
   * @param baseConfidence Base confidence of termination signal
   * @returns True if termination is valid
   */
  private validateTerminationSignal(terminalId: string, baseConfidence: number): boolean {
    // High confidence termination should always be valid
    if (baseConfidence >= 0.9) {
      return true;
    }

    // Check for recent AI activity
    const lastAIOutputEntry = this.detectionCache.get(`${terminalId}_lastAIOutput`);
    const timeSinceLastAIOutput = Date.now() - (lastAIOutputEntry?.timestamp || 0);

    // If we saw AI activity recently, require higher confidence
    if (timeSinceLastAIOutput < this.AI_ACTIVITY_TIMEOUT_MS) {
      log(
        `🔍 [VALIDATION] Recent AI activity (${timeSinceLastAIOutput}ms ago), requiring higher confidence`
      );
      return baseConfidence >= 0.8;
    }

    // Medium confidence with some time passed should be valid
    if (baseConfidence >= 0.6 && timeSinceLastAIOutput >= 5000) {
      return true;
    }

    // Default to false for low confidence
    return false;
  }

  /**
   * Update AI activity timestamp
   * @param terminalId Terminal ID
   * @param line Output line
   */
  private updateAIActivityTimestamp(terminalId: string, line: string): void {
    if (this.patternRegistry.isAgentActivity(line) || line.length > 50) {
      this.detectionCache.set(`${terminalId}_lastAIOutput`, {
        result: null,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Remove box drawing characters
   * @param line Input line
   * @returns Cleaned line
   */
  private removeBoxCharacters(line: string): string {
    return line.replace(/[\u2502\u256d\u2570\u2500\u256f]/g, '').trim();
  }

  /**
   * Create negative detection result
   * @param source Detection source
   * @param reason Reason for negative result
   * @returns Negative detection result
   */
  private createNegativeResult(
    source: 'input' | 'output' | 'termination',
    reason: string
  ): DetectionResult {
    return {
      agentType: null,
      isDetected: false,
      confidence: 0,
      source,
      reason,
    };
  }

  /**
   * Clear cache entries for a specific terminal
   * @param terminalId Terminal ID
   */
  public clearTerminalCache(terminalId: string): void {
    const keysToDelete: string[] = [];

    // Collect all keys related to this terminal
    // Note: LRUCache doesn't have forEach, so we need to work around it
    try {
      // Try to iterate if possible
      (this.detectionCache as any).forEach((_value: any, key: string) => {
        if (key.includes(terminalId)) {
          keysToDelete.push(key);
        }
      });
    } catch {
      // Fallback: clear entire cache if iteration fails
      this.detectionCache.clear();
      log(`🧹 [CACHE-CLEAR] Cleared entire cache (terminal ${terminalId})`);
      return;
    }

    // Delete collected keys
    keysToDelete.forEach((key) => this.detectionCache.delete(key));
    log(`🧹 [CACHE-CLEAR] Cleared ${keysToDelete.length} entries for terminal ${terminalId}`);
  }

  /**
   * Get the pattern registry instance
   * @returns Pattern registry
   */
  public getPatternRegistry(): CliAgentPatternRegistry {
    return this.patternRegistry;
  }
}
