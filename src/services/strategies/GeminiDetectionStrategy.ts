/**
 * Gemini CLI Detection Strategy
 *
 * Implements agent-specific detection logic for Google Gemini CLI.
 * Handles input command detection and output pattern recognition.
 */

import { AgentDetectionStrategy, AgentDetectionResult } from './AgentDetectionStrategy';

export class GeminiDetectionStrategy implements AgentDetectionStrategy {
  readonly agentType = 'gemini' as const;

  detectFromInput(input: string): AgentDetectionResult {
    const line = input.toLowerCase();

    // Very high confidence patterns
    if (line.startsWith('gemini ') || line === 'gemini') {
      return {
        isDetected: true,
        confidence: 1.0,
        detectedLine: input
      };
    }

    // High confidence patterns
    if (line.includes('gemini code') || line.includes('gemini chat')) {
      return {
        isDetected: true,
        confidence: 0.95,
        detectedLine: input
      };
    }

    // Common gemini subcommands
    if (line.startsWith('gemini ') && this.hasGeminiSubcommand(line)) {
      return {
        isDetected: true,
        confidence: 0.95,
        detectedLine: input
      };
    }

    // Medium confidence patterns
    if (line.includes('gemini') && (line.includes('--help') || line.includes('-h'))) {
      return {
        isDetected: true,
        confidence: 0.9,
        detectedLine: input
      };
    }

    return { isDetected: false, confidence: 0 };
  }

  detectFromOutput(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    // Only detect Gemini ASCII art
    return this.detectGeminiAsciiArt(output);
  }

  isAgentActivity(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const lowerLine = output.toLowerCase();
    return (
      lowerLine.includes('gemini') ||
      lowerLine.includes('bard') ||
      lowerLine.includes('google ai') ||
      this.containsGeminiPatterns(output)
    );
  }

  private hasGeminiSubcommand(line: string): boolean {
    const subcommands = [
      'generate',
      'ask',
      'explain',
      'create',
      'analyze',
      'review',
      'chat',
      'code'
    ];

    return subcommands.some(cmd => line.includes(cmd));
  }

  private containsGeminiPatterns(output: string): boolean {
    const patterns = [
      /\bgemini\s+(is|here)\b/i,
      /\bgoogle\s+ai\b/i,
      /\bbard\s+(response|answer)\b/i,
    ];

    return patterns.some(pattern => pattern.test(output));
  }

  private detectGeminiAsciiArt(output: string): boolean {
    // Remove ANSI escape sequences and normalize whitespace
    const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').trim();

    // Very specific and unique patterns from the GEMINI ASCII art
    const uniquePatterns = [
      // First line: extremely specific pattern
      /███\s+█████████\s+██████████\s+██████\s+██████\s+█████\s+██████\s+█████\s+█████/,

      // Second line: also very unique
      /░░░███\s+███░░░░░███░░███░░░░░█░░██████\s+██████\s+░░███\s+░░██████\s+░░███\s+░░███/,

      // Last line before bottom: very distinctive
      /███░\s+░░█████████\s+██████████\s+█████\s+█████\s+█████\s+█████\s+░░█████\s+█████/,

      // Bottom line: completely unique
      /░░░\s+░░░░░░░░░\s+░░░░░░░░░░\s+░░░░░\s+░░░░░\s+░░░░░\s+░░░░░\s+░░░░░\s+░░░░░/,

      // Check for the specific progression pattern (indentation gets smaller)
      /\s*███\s+.*█████████.*██████████/,  // First line pattern
      /\s*░░░███\s+.*███░░░░░███/,          // Second line pattern with indentation
      /\s{2,}░░░███\s+.*███\s+░░░/,         // Third line with more indentation
      /\s{4,}░░░███\s+.*░███\s+░██████/,    // Fourth line with even more indentation

      // Very simple but unique: the specific sequence at the end
      /░░█████\s+█████$/,                   // End of second-to-last line
      /░░░░░\s+░░░░░$/                      // End of last line
    ];

    // Also check for the unique indentation pattern
    const lines = cleanOutput.split(/\r?\n/);

    // Look for the specific indentation progression in consecutive lines
    let hasIndentationPattern = false;
    for (let i = 0; i < lines.length - 3; i++) {
      const line1 = lines[i];
      const line2 = lines[i + 1];
      const line3 = lines[i + 2];
      const line4 = lines[i + 3];

      // Check if we have the specific indentation pattern
      if (
        line1 && /^\s*███\s+/.test(line1) &&           // Starts with minimal spaces + ███
        line2 && /^\s*░░░███\s+/.test(line2) &&        // Starts with minimal spaces + ░░░███
        line3 && /^\s{2,}░░░███\s+/.test(line3) &&     // Starts with 2+ spaces + ░░░███
        line4 && /^\s{4,}░░░███\s+/.test(line4)        // Starts with 4+ spaces + ░░░███
      ) {
        hasIndentationPattern = true;
        break;
      }
    }

    // Check for any of the unique patterns
    const hasUniquePattern = uniquePatterns.some(pattern => pattern.test(cleanOutput));

    return hasUniquePattern || hasIndentationPattern;
  }
}