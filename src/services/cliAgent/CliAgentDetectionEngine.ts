/**
 * CLI Agent Detection Engine
 *
 * Unified detection logic for all CLI Agents.
 * Uses CliAgentPatternRegistry as the single source of pattern definitions.
 *
 * Responsibilities:
 * - Detect CLI Agent startup from input/output
 * - Detect CLI Agent termination
 * - Clean ANSI escape sequences
 * - Provide consistent detection across all services
 */

import { CliAgentPatternRegistry, AgentType, AgentPatternDefinition } from './CliAgentPatternRegistry';
import { terminal as log } from '../../utils/logger';

/**
 * Detection result interface
 */
export interface DetectionResult {
  /**
   * Whether an agent was detected
   */
  isDetected: boolean;

  /**
   * Detected agent type
   */
  agentType: AgentType | null;

  /**
   * Confidence score (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Detected line
   */
  detectedLine: string;

  /**
   * Detection source (input or output)
   */
  source: 'input' | 'output';

  /**
   * Detection reason (for debugging)
   */
  reason?: string;
}

/**
 * Termination detection result
 */
export interface TerminationDetectionResult {
  /**
   * Whether termination was detected
   */
  isTerminated: boolean;

  /**
   * Confidence score (0.0 to 1.0)
   */
  confidence: number;

  /**
   * Detected line
   */
  detectedLine: string;

  /**
   * Termination reason
   */
  reason: string;
}

/**
 * CLI Agent Detection Engine
 * Provides unified detection logic using centralized pattern registry
 */
export class CliAgentDetectionEngine {
  private static instance: CliAgentDetectionEngine;
  private readonly patternRegistry: CliAgentPatternRegistry;

  private constructor() {
    this.patternRegistry = CliAgentPatternRegistry.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CliAgentDetectionEngine {
    if (!CliAgentDetectionEngine.instance) {
      CliAgentDetectionEngine.instance = new CliAgentDetectionEngine();
    }
    return CliAgentDetectionEngine.instance;
  }

  /**
   * Detect CLI Agent from input command
   */
  public detectFromInput(input: string): DetectionResult {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return this.createNegativeResult('', 'input');
    }

    // Try to detect each agent type
    for (const agentType of this.patternRegistry.getAllAgentTypes()) {
      const patterns = this.patternRegistry.getAgentPatterns(agentType);
      if (!patterns) continue;

      const result = this.detectAgentFromInput(trimmedInput, patterns);
      if (result.isDetected) {
        log(`🎯 [DETECTION-ENGINE] ${agentType} detected from input: "${trimmedInput}"`);
        return result;
      }
    }

    return this.createNegativeResult(trimmedInput, 'input');
  }

  /**
   * Detect CLI Agent from output
   */
  public detectFromOutput(output: string): DetectionResult {
    const lines = output.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const cleanLine = this.cleanAnsiEscapeSequences(trimmed);
      const fullyCleanLine = cleanLine
        .replace(/[\u2502\u256d\u2570\u2500\u256f]/g, '')
        .trim();

      if (!fullyCleanLine || fullyCleanLine.length < 1) continue;

      // Try to detect each agent type
      for (const agentType of this.patternRegistry.getAllAgentTypes()) {
        const patterns = this.patternRegistry.getAgentPatterns(agentType);
        if (!patterns) continue;

        const result = this.detectAgentFromOutput(fullyCleanLine, patterns);
        if (result.isDetected) {
          log(`🚀 [DETECTION-ENGINE] ${agentType} detected from output: "${fullyCleanLine}"`);
          return result;
        }
      }
    }

    return this.createNegativeResult('', 'output');
  }

  /**
   * Detect CLI Agent termination from output
   */
  public detectTermination(
    output: string,
    agentType?: AgentType
  ): TerminationDetectionResult {
    const lines = output.split(/\r?\n/);
    let maxConfidence = 0;
    let detectedLine = '';
    let reason = '';

    for (const line of lines) {
      const cleanLine = this.cleanAnsiEscapeSequences(line.trim());
      if (!cleanLine) continue;

      // Very explicit termination messages (highest priority)
      const explicitResult = this.detectExplicitTermination(cleanLine, agentType);
      if (explicitResult.isTerminated && explicitResult.confidence > maxConfidence) {
        maxConfidence = explicitResult.confidence;
        detectedLine = explicitResult.detectedLine;
        reason = explicitResult.reason;
      }

      // Process crash indicators
      const crashResult = this.detectProcessCrash(cleanLine);
      if (crashResult.isTerminated && crashResult.confidence > maxConfidence) {
        maxConfidence = crashResult.confidence;
        detectedLine = crashResult.detectedLine;
        reason = crashResult.reason;
      }

      // Shell prompt detection (indicates agent exit)
      const shellPromptResult = this.detectShellPrompt(cleanLine);
      if (shellPromptResult.isTerminated && shellPromptResult.confidence > maxConfidence) {
        maxConfidence = shellPromptResult.confidence;
        detectedLine = shellPromptResult.detectedLine;
        reason = shellPromptResult.reason;
      }
    }

    return {
      isTerminated: maxConfidence > 0,
      confidence: maxConfidence,
      detectedLine,
      reason: reason || 'No termination detected',
    };
  }

  /**
   * Clean ANSI escape sequences from text
   */
  public cleanAnsiEscapeSequences(text: string): string {
    let cleaned = text;
    const cleaningPatterns = this.patternRegistry.getAnsiCleaningPatterns();

    for (const pattern of cleaningPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove carriage returns
    cleaned = cleaned.replace(/\r/g, '').trim();

    return cleaned;
  }

  /**
   * Detect specific agent from input
   */
  private detectAgentFromInput(
    input: string,
    patterns: AgentPatternDefinition
  ): DetectionResult {
    const line = input.toLowerCase();

    // Check exclusions first
    if (this.matchesExclusionPatterns(input, patterns)) {
      return this.createNegativeResult(input, 'input');
    }

    // Very high confidence: exact command execution
    if (line.startsWith(`${patterns.type} `) || line === patterns.type) {
      return {
        isDetected: true,
        agentType: patterns.type,
        confidence: 1.0,
        detectedLine: input,
        source: 'input',
        reason: `Exact ${patterns.type} command`,
      };
    }

    // High confidence: exact matches
    for (const exactMatch of patterns.startupPatterns.exactMatches) {
      if (input.includes(exactMatch)) {
        return {
          isDetected: true,
          agentType: patterns.type,
          confidence: 0.95,
          detectedLine: input,
          source: 'input',
          reason: `Exact match: ${exactMatch}`,
        };
      }
    }

    // Medium confidence: regex patterns
    for (const pattern of patterns.startupPatterns.regexPatterns) {
      if (pattern.test(input)) {
        return {
          isDetected: true,
          agentType: patterns.type,
          confidence: 0.9,
          detectedLine: input,
          source: 'input',
          reason: `Regex pattern matched`,
        };
      }
    }

    // Lower confidence: help flags
    if (line.includes(patterns.type) && (line.includes('--help') || line.includes('-h'))) {
      return {
        isDetected: true,
        agentType: patterns.type,
        confidence: 0.85,
        detectedLine: input,
        source: 'input',
        reason: 'Help flag detected',
      };
    }

    return this.createNegativeResult(input, 'input');
  }

  /**
   * Detect specific agent from output
   */
  private detectAgentFromOutput(
    output: string,
    patterns: AgentPatternDefinition
  ): DetectionResult {
    const line = output.toLowerCase();

    // Check exclusions first
    if (this.matchesExclusionPatterns(output, patterns)) {
      return this.createNegativeResult(output, 'output');
    }

    // Exact matches (highest confidence)
    for (const exactMatch of patterns.startupPatterns.exactMatches) {
      if (output.includes(exactMatch)) {
        return {
          isDetected: true,
          agentType: patterns.type,
          confidence: 0.95,
          detectedLine: output,
          source: 'output',
          reason: `Exact match: ${exactMatch}`,
        };
      }
    }

    // Regex patterns
    for (const pattern of patterns.startupPatterns.regexPatterns) {
      if (pattern.test(output)) {
        return {
          isDetected: true,
          agentType: patterns.type,
          confidence: 0.9,
          detectedLine: output,
          source: 'output',
          reason: 'Regex pattern matched',
        };
      }
    }

    // Model-specific patterns
    for (const modelPattern of patterns.startupPatterns.modelPatterns) {
      if (line.includes(modelPattern.toLowerCase())) {
        return {
          isDetected: true,
          agentType: patterns.type,
          confidence: 0.85,
          detectedLine: output,
          source: 'output',
          reason: `Model pattern matched: ${modelPattern}`,
        };
      }
    }

    // Combined keywords
    for (const combo of patterns.startupPatterns.combinedKeywords) {
      const allRequiredPresent = combo.required.every((keyword) =>
        line.includes(keyword.toLowerCase())
      );

      if (allRequiredPresent) {
        const optionalPresent = combo.optional
          ? combo.optional.some((keyword) => line.includes(keyword.toLowerCase()))
          : true;

        if (optionalPresent) {
          return {
            isDetected: true,
            agentType: patterns.type,
            confidence: 0.8,
            detectedLine: output,
            source: 'output',
            reason: `Combined keywords matched: ${combo.required.join(', ')}`,
          };
        }
      }
    }

    return this.createNegativeResult(output, 'output');
  }

  /**
   * Detect explicit termination messages
   */
  private detectExplicitTermination(
    cleanLine: string,
    agentType?: AgentType
  ): TerminationDetectionResult {
    const line = cleanLine.toLowerCase().trim();

    // Try agent-specific termination patterns first if agent type is provided
    if (agentType) {
      const patterns = this.patternRegistry.getAgentPatterns(agentType);
      if (patterns) {
        // Check explicit messages
        for (const message of patterns.terminationPatterns.explicitMessages) {
          if (line === message.toLowerCase() || line.includes(message.toLowerCase())) {
            return {
              isTerminated: true,
              confidence: 1.0,
              detectedLine: cleanLine,
              reason: `Explicit termination: ${message}`,
            };
          }
        }

        // Check process completion patterns
        for (const pattern of patterns.terminationPatterns.processCompletion) {
          if (pattern.test(cleanLine)) {
            return {
              isTerminated: true,
              confidence: 0.95,
              detectedLine: cleanLine,
              reason: 'Process completion pattern matched',
            };
          }
        }

        // Check session end indicators
        for (const indicator of patterns.terminationPatterns.sessionEndIndicators) {
          if (line.includes(indicator.toLowerCase())) {
            return {
              isTerminated: true,
              confidence: 0.9,
              detectedLine: cleanLine,
              reason: `Session end indicator: ${indicator}`,
            };
          }
        }
      }
    }

    // Generic termination messages (no agent type specified)
    const genericTerminationMessages = [
      'session ended',
      'connection closed',
      'session terminated',
      'session completed',
      'process finished',
    ];

    for (const message of genericTerminationMessages) {
      if (line === message || line.includes(message)) {
        return {
          isTerminated: true,
          confidence: 0.85,
          detectedLine: cleanLine,
          reason: `Generic termination: ${message}`,
        };
      }
    }

    return {
      isTerminated: false,
      confidence: 0,
      detectedLine: cleanLine,
      reason: 'No explicit termination detected',
    };
  }

  /**
   * Detect process crash indicators
   */
  private detectProcessCrash(cleanLine: string): TerminationDetectionResult {
    const line = cleanLine.toLowerCase();
    const crashIndicators = [
      'segmentation fault',
      'core dumped',
      'fatal error',
      'panic:',
      'killed',
      'abort',
      'crashed',
      'exception',
      'stack overflow',
      'out of memory',
      'signal',
      'terminated unexpectedly',
    ];

    for (const indicator of crashIndicators) {
      if (line.includes(indicator)) {
        return {
          isTerminated: true,
          confidence: 0.95,
          detectedLine: cleanLine,
          reason: `Process crash detected: ${indicator}`,
        };
      }
    }

    return {
      isTerminated: false,
      confidence: 0,
      detectedLine: cleanLine,
      reason: 'No crash detected',
    };
  }

  /**
   * Detect shell prompt (indicates agent has exited)
   */
  private detectShellPrompt(cleanLine: string): TerminationDetectionResult {
    // Skip empty lines
    if (!cleanLine || cleanLine.trim().length === 0) {
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: cleanLine,
        reason: 'Empty line',
      };
    }

    const shellPatterns = this.patternRegistry.getShellPromptPatterns();

    // Skip lines that are too long to be shell prompts
    if (cleanLine.length > shellPatterns.maxPromptLength) {
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: cleanLine,
        reason: 'Line too long for shell prompt',
      };
    }

    const lowerLine = cleanLine.toLowerCase();

    // Skip lines with AI output indicators
    for (const indicator of shellPatterns.aiOutputIndicators) {
      if (lowerLine.includes(indicator)) {
        return {
          isTerminated: false,
          confidence: 0,
          detectedLine: cleanLine,
          reason: `AI output indicator detected: ${indicator}`,
        };
      }
    }

    // Special handling for agent keywords
    if (
      (lowerLine.includes('claude') || lowerLine.includes('gemini') || lowerLine.includes('codex')) &&
      (lowerLine.includes('thinking') ||
        lowerLine.includes('response') ||
        lowerLine.includes('help you') ||
        lowerLine.includes('i am') ||
        lowerLine.includes("i'm") ||
        lowerLine.includes('what would you'))
    ) {
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: cleanLine,
        reason: 'Agent output detected',
      };
    }

    // Check shell prompt patterns
    for (const pattern of shellPatterns.promptPatterns) {
      if (pattern.test(cleanLine)) {
        return {
          isTerminated: true,
          confidence: 0.7,
          detectedLine: cleanLine,
          reason: 'Shell prompt pattern matched',
        };
      }
    }

    return {
      isTerminated: false,
      confidence: 0,
      detectedLine: cleanLine,
      reason: 'No shell prompt detected',
    };
  }

  /**
   * Check if line matches exclusion patterns
   */
  private matchesExclusionPatterns(
    line: string,
    patterns: AgentPatternDefinition
  ): boolean {
    const lowerLine = line.toLowerCase();

    // Check keyword exclusions
    for (const keyword of patterns.exclusionPatterns.keywords) {
      if (lowerLine.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Check regex exclusions
    for (const pattern of patterns.exclusionPatterns.regexPatterns) {
      if (pattern.test(line)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create negative detection result
   */
  private createNegativeResult(
    line: string,
    source: 'input' | 'output'
  ): DetectionResult {
    return {
      isDetected: false,
      agentType: null,
      confidence: 0,
      detectedLine: line,
      source,
      reason: 'No agent detected',
    };
  }
}
