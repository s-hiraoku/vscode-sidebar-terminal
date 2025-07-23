import { CliAgentType } from './CliAgentStateService';
import { terminal as log } from '../utils/logger';

/**
 * 検出結果の型定義
 */
export interface DetectionResult {
  type: CliAgentType;
  confidence: number; // 0-1の信頼度
}

/**
 * CLI Agent検出サービス
 *
 * 責務：
 * - コマンド入力からのCLI Agent検出
 * - ターミナル出力からのCLI Agent検出
 * - 終了パターンの検出
 * - 検出パターンの管理
 */
export class CliAgentDetectionService {
  // 検出パターン定義
  private static readonly COMMAND_PATTERNS = {
    claude: /^(claude)(\s|$)/i,
    gemini: /^(gemini)(\s|$)/i,
  };

  private static readonly OUTPUT_PATTERNS = {
    claude: [
      /welcome to claude code/i,
      /claude code cli/i,
      /claude\.ai/i,
      /anthropic/i,
      /human:/i,
      /assistant:/i,
      /type your message/i,
      /to start a conversation/i,
    ],
    gemini: [
      /welcome to gemini/i,
      /gemini cli/i,
      /google ai/i,
      /bard/i,
      /user:/i,
      /model:/i,
      /enter your prompt/i,
      /gemini is ready/i,
    ],
  };

  private static readonly EXIT_PATTERNS = [
    // Claude Code特有の終了パターン
    /goodbye/i,
    /chat\s+ended/i,
    /session\s+terminated/i,
    /session\s+closed/i,
    /connection\s+closed/i,
    /claude\s+code\s+session\s+ended/i,
    /exiting\s+claude/i,

    // Gemini特有の終了パターン
    /gemini\s+session\s+ended/i,
    /exiting\s+gemini/i,

    // プロセス終了パターン（より具体的）
    /process\s+exit\s+code/i,
    /command\s+not\s+found:\s+(claude|gemini)/i,
    /^(claude|gemini):\s+command\s+not\s+found/i,

    // Ctrl+C による中断（より具体的）
    /keyboardinterrupt/i,
    /sigint/i,
  ];

  private static readonly PROMPT_PATTERNS = [
    /\$\s*$/, // bash prompt
    /%\s*$/, // zsh prompt
    />\s*$/, // cmd prompt
    /bash-[0-9.]+\$/, // bash version prompt
    /➜\s+/, // oh-my-zsh prompt
    /\[\w+@\w+\s+[^\]]+\]\$\s*$/, // [user@host dir]$ prompt
  ];

  /**
   * コマンド入力からCLI Agentを検出
   */
  public detectFromCommand(command: string): DetectionResult | null {
    if (!command || typeof command !== 'string') {
      return null;
    }

    const cleanCommand = command.trim().toLowerCase();

    // 各パターンをチェック
    for (const [type, pattern] of Object.entries(CliAgentDetectionService.COMMAND_PATTERNS)) {
      if (pattern.test(cleanCommand)) {
        log(`🔍 [CLI-AGENT-DETECTION] Detected ${type.toUpperCase()} CLI from command: ${command}`);
        return {
          type: type as CliAgentType,
          confidence: 1.0, // コマンドベースの検出は高信頼度
        };
      }
    }

    return null;
  }

  /**
   * ターミナル出力からCLI Agentを検出
   */
  public detectFromOutput(output: string): DetectionResult | null {
    if (!output || typeof output !== 'string') {
      return null;
    }

    const cleanOutput = output.toLowerCase();

    // 各タイプのパターンをチェック
    for (const [type, patterns] of Object.entries(CliAgentDetectionService.OUTPUT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(cleanOutput)) {
          const confidence = this._calculateOutputConfidence(cleanOutput, patterns);
          log(
            `🔍 [CLI-AGENT-DETECTION] Detected ${type.toUpperCase()} CLI from output pattern: ${pattern}`
          );
          return {
            type: type as CliAgentType,
            confidence,
          };
        }
      }
    }

    return null;
  }

  /**
   * 終了パターンを検出（より厳密なチェック）
   */
  public detectExit(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const cleanOutput = output.toLowerCase().trim();

    // 空の出力や非常に短い出力は無視
    if (cleanOutput.length < 3) {
      return false;
    }

    // CLI Agent特有の終了パターンのみチェック
    for (const pattern of CliAgentDetectionService.EXIT_PATTERNS) {
      if (pattern.test(cleanOutput)) {
        log(`🔍 [CLI-AGENT-DETECTION] Exit pattern detected: ${pattern.source}`);
        
        // 追加の安全チェック: 通常のシェルコマンドではないことを確認
        if (this._isLikelyShellCommand(cleanOutput)) {
          log(`🔍 [CLI-AGENT-DETECTION] False positive: looks like shell command`);
          continue;
        }
        
        return true;
      }
    }

    return false;
  }

  /**
   * 通常のシェルコマンドかどうかを判定（誤検出防止）
   */
  private _isLikelyShellCommand(output: string): boolean {
    // シェルコマンドっぽいパターン
    const shellCommandPatterns = [
      /^ls\s/,
      /^cd\s/,
      /^mkdir\s/,
      /^rm\s/,
      /^cp\s/,
      /^mv\s/,
      /^cat\s/,
      /^grep\s/,
      /^find\s/,
      /^ps\s/,
      /^kill\s/,
      /^npm\s/,
      /^node\s/,
      /^git\s/,
    ];

    return shellCommandPatterns.some(pattern => pattern.test(output));
  }

  /**
   * プロンプト復帰を検出
   */
  public detectPromptReturn(recentOutput: string[]): boolean {
    if (!recentOutput || recentOutput.length === 0) {
      return false;
    }

    // 最近の出力を結合して分析
    const combinedOutput = recentOutput.slice(-3).join('\n');

    for (const pattern of CliAgentDetectionService.PROMPT_PATTERNS) {
      if (pattern.test(combinedOutput)) {
        log(`🔍 [CLI-AGENT-DETECTION] Prompt return detected: ${pattern}`);
        return true;
      }
    }

    return false;
  }

  /**
   * 検出パターンの有効性を検証（テスト用）
   */
  public validatePatterns(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // コマンドパターンの検証
      for (const [type, pattern] of Object.entries(CliAgentDetectionService.COMMAND_PATTERNS)) {
        if (!(pattern instanceof RegExp)) {
          errors.push(`Invalid command pattern for ${type}: not a RegExp`);
        }
      }

      // 出力パターンの検証
      for (const [type, patterns] of Object.entries(CliAgentDetectionService.OUTPUT_PATTERNS)) {
        if (!Array.isArray(patterns)) {
          errors.push(`Invalid output patterns for ${type}: not an array`);
          continue;
        }

        patterns.forEach((pattern, index) => {
          if (!(pattern instanceof RegExp)) {
            errors.push(`Invalid output pattern for ${type}[${index}]: not a RegExp`);
          }
        });
      }
    } catch (error) {
      errors.push(`Pattern validation failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // =================== Private Methods ===================

  /**
   * 出力パターンマッチの信頼度を計算
   */
  private _calculateOutputConfidence(output: string, patterns: RegExp[]): number {
    let matches = 0;

    for (const pattern of patterns) {
      if (pattern.test(output)) {
        matches++;
      }
    }

    // マッチしたパターン数に基づいて信頼度を計算
    const baseConfidence = 0.7; // 基本信頼度
    const bonusConfidence = Math.min(matches * 0.1, 0.3); // 複数マッチのボーナス

    return Math.min(baseConfidence + bonusConfidence, 1.0);
  }
}
