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
 * CLI Agent検出サービス（シンプルで確実な実装）
 *
 * 設計原則:
 * - 誤検出よりも見逃しを減らす
 * - シンプルで理解しやすいロジック
 * - 明確な検出条件
 */
export class CliAgentDetectionService {
  // 起動コマンドパターン（厳密）
  private static readonly COMMAND_PATTERNS = {
    claude: /^claude(\s|$)/i,
    gemini: /^gemini(\s|$)/i,
  };

  // 起動時の出力パターン（確実な検出用）
  private static readonly STARTUP_PATTERNS = {
    claude: [
      /claude code/i,
      /anthropic/i,
      /human:/i,
      /assistant:/i,
    ],
    gemini: [
      /gemini/i,
      /google/i,
      /user:/i,
      /model:/i,
    ],
  };

  // 終了パターン（確実なもののみ）
  private static readonly EXIT_PATTERNS = [
    // Ctrl+C による中断（最確実）
    /keyboardinterrupt/i,
    /sigint received/i,
    /\^c/i,
    
    // プロセス終了・kill関連
    /process terminated/i,
    /process exited/i,
    /process killed/i,
    /connection lost/i,
    /killed/i,
    /terminated/i,
    /sigterm/i,
    /sigkill/i,
    /exit code/i,
    /command not found/i,
    /no such file or directory/i,
    
    // CLI Agent特有の終了メッセージ
    /goodbye/i,
    /session ended/i,
    /session closed/i,
    /disconnected/i,
  ];

  // プロンプトパターン（シェルに戻ったかの判定）
  private static readonly SHELL_PROMPT_PATTERNS = [
    /^\$\s*$/m,           // bash prompt
    /^%\s*$/m,            // zsh prompt  
    /^>\s*$/m,            // cmd prompt
    /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+:\S+\$\s*$/m, // user@host:path$
  ];

  /**
   * コマンド入力からCLI Agent検出
   */
  public detectFromCommand(command: string): DetectionResult | null {
    if (!command || typeof command !== 'string') {
      return null;
    }

    const cleanCommand = command.trim().toLowerCase();
    
    // Claude Code検出
    if (CliAgentDetectionService.COMMAND_PATTERNS.claude.test(cleanCommand)) {
      log(`🔍 [CLI-AGENT-DETECTION] Claude Code detected from command: ${command}`);
      return { type: 'claude', confidence: 1.0 };
    }

    // Gemini検出
    if (CliAgentDetectionService.COMMAND_PATTERNS.gemini.test(cleanCommand)) {
      log(`🔍 [CLI-AGENT-DETECTION] Gemini detected from command: ${command}`);
      return { type: 'gemini', confidence: 1.0 };
    }

    return null;
  }

  /**
   * 出力からCLI Agent検出（起動確認用）
   */
  public detectFromOutput(output: string): DetectionResult | null {
    if (!output || typeof output !== 'string') {
      return null;
    }

    const cleanOutput = output.toLowerCase();

    // Claude Code検出
    for (const pattern of CliAgentDetectionService.STARTUP_PATTERNS.claude) {
      if (pattern.test(cleanOutput)) {
        log(`🔍 [CLI-AGENT-DETECTION] Claude Code detected from output pattern: ${pattern.source}`);
        return { type: 'claude', confidence: 0.8 };
      }
    }

    // Gemini検出
    for (const pattern of CliAgentDetectionService.STARTUP_PATTERNS.gemini) {
      if (pattern.test(cleanOutput)) {
        log(`🔍 [CLI-AGENT-DETECTION] Gemini detected from output pattern: ${pattern.source}`);
        return { type: 'gemini', confidence: 0.8 };
      }
    }

    return null;
  }

  /**
   * CLI Agent終了検出（シンプルで確実）
   */
  public detectExit(output: string): boolean {
    if (!output || typeof output !== 'string') {
      return false;
    }

    const cleanOutput = output.toLowerCase().trim();

    // 短すぎる出力は無視（killシグナルなどの短い出力も検出するため閾値を下げる）
    if (cleanOutput.length < 2) {
      return false;
    }

    // 終了パターンをチェック
    for (const pattern of CliAgentDetectionService.EXIT_PATTERNS) {
      if (pattern.test(cleanOutput)) {
        log(`🔚 [CLI-AGENT-DETECTION] Exit pattern detected: ${pattern.source}`);
        return true;
      }
    }

    return false;
  }

  /**
   * シェルプロンプトへの復帰検出
   */
  public detectShellPromptReturn(recentOutput: string[]): boolean {
    if (!recentOutput || recentOutput.length === 0) {
      return false;
    }

    // 最新の出力行をチェック
    const latestLines = recentOutput.slice(-3).join('\n');
    
    for (const pattern of CliAgentDetectionService.SHELL_PROMPT_PATTERNS) {
      if (pattern.test(latestLines)) {
        log(`🔚 [CLI-AGENT-DETECTION] Shell prompt return detected: ${pattern.source}`);
        return true;
      }
    }

    return false;
  }

  /**
   * デバッグ用：検出パターンの一覧を取得
   */
  public getPatterns() {
    return {
      commands: CliAgentDetectionService.COMMAND_PATTERNS,
      startup: CliAgentDetectionService.STARTUP_PATTERNS,
      exit: CliAgentDetectionService.EXIT_PATTERNS,
      shellPrompt: CliAgentDetectionService.SHELL_PROMPT_PATTERNS,
    };
  }
}