/**
 * CLI Agent Detection Service
 * CLI AgentとしてClaude、Geminiなどを検出するサービス
 */

export interface DetectionResult {
  type: 'claude' | 'gemini';
  confidence: number;
}

/**
 * CLI Agentの検出を行うサービス
 * コマンド、出力、終了パターンから各種AI Agentを検出
 */
export class CliAgentDetectionService {
  /**
   * コマンドラインからCLI Agentを検出
   */
  detectFromCommand(command: string | null | undefined): DetectionResult | null {
    if (!command || typeof command !== 'string' || command.trim() === '') {
      return null;
    }

    const trimmedCommand = command.trim().toLowerCase();

    // Claude Code detection
    if (trimmedCommand.startsWith('claude')) {
      return { type: 'claude', confidence: 1.0 };
    }

    // Gemini detection
    if (trimmedCommand.startsWith('gemini')) {
      return { type: 'gemini', confidence: 1.0 };
    }

    return null;
  }

  /**
   * 出力からCLI Agentを検出
   */
  detectFromOutput(output: string): DetectionResult | null {
    if (!output || typeof output !== 'string') {
      return null;
    }

    // Claude Code patterns
    if (
      output.includes('Welcome to Claude Code CLI') ||
      (output.includes('Human:') && output.includes('Assistant:'))
    ) {
      return { type: 'claude', confidence: 0.8 };
    }

    // Gemini patterns
    if (output.includes('Gemini AI') || output.includes('Google AI') || output.includes('Bard:')) {
      return { type: 'gemini', confidence: 0.8 };
    }

    return null;
  }

  /**
   * 終了パターンからCLI Agentの終了を検出
   */
  detectExit(output: string): DetectionResult | null {
    if (!output || typeof output !== 'string') {
      return null;
    }

    // Keyboard interrupt patterns
    if (output.includes('^C') || output.includes('KeyboardInterrupt')) {
      // Most CLI agents handle Ctrl+C
      return { type: 'claude', confidence: 0.6 };
    }

    // Process termination patterns
    if (output.includes('Process terminated') || output.includes('Session ended')) {
      return { type: 'claude', confidence: 0.5 };
    }

    return null;
  }
}
