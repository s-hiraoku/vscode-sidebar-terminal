/**
 * 🆕 CLI Agent Input/Output Detection Service
 *
 * Extracted from CliAgentDetectionService to provide specialized input and output
 * detection capabilities for various CLI agents (Claude, Gemini, Codex).
 */

import { terminal as log } from '../utils/logger';
import { CliAgentPatternDetector } from './CliAgentPatternDetector';

export interface AgentDetectionResult {
  isDetected: boolean;
  confidence: number;
}

export class CliAgentInputOutputDetector {
  private patternDetector = new CliAgentPatternDetector();

  /**
   * Detect Claude Code from input command
   */
  detectClaudeFromInput(input: string): AgentDetectionResult {
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

  /**
   * Detect Gemini CLI from input command
   */
  detectGeminiFromInput(input: string): AgentDetectionResult {
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
  detectCodexFromInput(input: string): AgentDetectionResult {
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
   * Detect Claude Code from output patterns
   */
  detectClaudeFromOutput(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    return this.patternDetector.detectClaudeStartup(output);
  }

  /**
   * Detect Gemini CLI from output patterns
   */
  detectGeminiFromOutput(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    return this.patternDetector.detectGeminiStartup(output);
  }

  /**
   * Detect OpenAI Codex CLI from output patterns
   */
  detectCodexFromOutput(output: string): boolean {
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

  /**
   * Check if output looks like AI activity for activity timestamp tracking
   */
  looksLikeAIActivity(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const lowerLine = output.toLowerCase();
    return (
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
      output.length > 50 // Long outputs likely from AI
    );
  }
}