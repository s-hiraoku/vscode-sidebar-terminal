/**
 * Base Detection Strategy
 *
 * Abstract base class for CLI agent detection strategies.
 * Provides common validation and helper methods to eliminate code duplication.
 */

import { AgentDetectionStrategy, AgentDetectionResult } from './AgentDetectionStrategy';
import type { AgentType } from '../../types/shared';

export abstract class BaseDetectionStrategy implements AgentDetectionStrategy {
  abstract readonly agentType: AgentType;

  /**
   * Command prefixes that trigger this agent
   * Override in subclass to specify agent-specific commands
   */
  protected abstract getCommandPrefixes(): string[];

  /**
   * Output patterns that indicate agent startup
   * Override in subclass to specify agent-specific patterns
   */
  protected abstract getStartupPatterns(): string[];

  /**
   * Optional: Regex patterns for startup detection
   * Override if you need regex-based detection
   */
  protected getStartupRegexPatterns(): RegExp[] {
    return [];
  }

  /**
   * Keywords that suggest agent activity
   * Override in subclass to specify agent-specific keywords
   */
  protected abstract getActivityKeywords(): string[];

  /**
   * Detect agent from user input command
   */
  public detectFromInput(input: string): AgentDetectionResult {
    if (!this.validateInput(input)) {
      return { isDetected: false, confidence: 0 };
    }

    const line = input.toLowerCase();
    const prefixes = this.getCommandPrefixes();

    for (const prefix of prefixes) {
      if (line.startsWith(prefix) || line === prefix.trim()) {
        return {
          isDetected: true,
          confidence: 1.0,
          detectedLine: input,
        };
      }
    }

    return { isDetected: false, confidence: 0 };
  }

  /**
   * Detect agent from terminal output
   */
  public detectFromOutput(output: string): boolean {
    if (!this.validateOutput(output)) {
      return false;
    }

    // Check string patterns
    const patterns = this.getStartupPatterns();
    const hasPattern = patterns.some((pattern) => output.includes(pattern));

    // Check regex patterns
    const regexPatterns = this.getStartupRegexPatterns();
    const hasRegexMatch = regexPatterns.some((regex) => regex.test(output));

    return hasPattern || hasRegexMatch;
  }

  /**
   * Check if output indicates this agent is active
   */
  public isAgentActivity(output: string): boolean {
    if (!this.validateOutput(output)) {
      return false;
    }

    const lowerLine = output.toLowerCase();
    const keywords = this.getActivityKeywords();

    // Check if any keyword is present
    const hasKeyword = keywords.some((keyword) => lowerLine.includes(keyword.toLowerCase()));

    // Long output is usually agent activity
    const isLongOutput = output.length > 50;

    return hasKeyword || isLongOutput;
  }

  /**
   * Validate input string
   */
  protected validateInput(input: string): boolean {
    return input !== null && input !== undefined && typeof input === 'string';
  }

  /**
   * Validate output string
   */
  protected validateOutput(output: string): boolean {
    return output !== null && output !== undefined && typeof output === 'string';
  }
}
