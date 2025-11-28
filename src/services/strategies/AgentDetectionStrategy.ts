/**
 * Agent Detection Strategy Interface
 *
 * Defines the contract for agent-specific detection strategies.
 * Each CLI agent (Claude, Gemini, Codex, GitHub Copilot) implements this interface
 * to provide specialized detection logic for input commands and output patterns.
 */

export interface AgentDetectionResult {
  isDetected: boolean;
  confidence: number;
  detectedLine?: string;
}

export interface AgentDetectionStrategy {
  /**
   * The agent type this strategy handles
   */
  readonly agentType: 'claude' | 'gemini' | 'codex' | 'copilot';

  /**
   * Detect agent from user input command
   * @param input User input command
   * @returns Detection result with confidence score
   */
  detectFromInput(input: string): AgentDetectionResult;

  /**
   * Detect agent from terminal output
   * @param output Terminal output line
   * @returns True if agent startup pattern detected
   */
  detectFromOutput(output: string): boolean;

  /**
   * Check if output indicates this agent is active
   * @param output Terminal output line
   * @returns True if output suggests agent activity
   */
  isAgentActivity(output: string): boolean;
}
