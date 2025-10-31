import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { extension as log } from '../utils/logger';
import { safeProcessCwd } from '../utils/common';

/**
 * 統一ターミナル永続化サービス
 * Extension側でターミナルセッションの保存・復元を一元管理
 */
export interface TerminalSessionData {
  id: number;
  name: string;
  scrollback: string[];
  workingDirectory: string;
  shellCommand: string;
  isActive: boolean;
  cliAgentType?: 'claude' | 'gemini';
  lastActivity: number;
}

export interface SessionMetadata {
  version: string;
  timestamp: number;
  activeTerminalId: number;
  totalTerminals: number;
  cliAgentSessions: string[];
  userWorkspace: string;
}

export interface PersistenceSessionData {
  version: string;
  timestamp: number;
  activeTerminalId: number;
  terminals: TerminalSessionData[];
  metadata: SessionMetadata;
}

export class PersistenceError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'PersistenceError';
  }
}

export class UnifiedTerminalPersistenceService {
  private static readonly SESSION_KEY = 'unified-terminal-sessions-v1';
  private static readonly SESSION_VERSION = '1.0.0';
  private static readonly MAX_SESSION_AGE_DAYS = 7;
  private static readonly MAX_SCROLLBACK_LINES = 2000;
  private static readonly MAX_CONCURRENT_RESTORES = 3;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly terminalManager: TerminalManager
  ) {
    log('🔧 [PERSISTENCE] UnifiedTerminalPersistenceService initialized');
  }

  /**
   * ターミナルセッションを保存
   */
  async saveSession(terminals: any[]): Promise<void> {
    try {
      if (!terminals || terminals.length === 0) {
        log('📦 [PERSISTENCE] No terminals to save');
        return;
      }

      const sessionData: PersistenceSessionData = {
        version: UnifiedTerminalPersistenceService.SESSION_VERSION,
        timestamp: Date.now(),
        activeTerminalId: this.getActiveTerminalId(terminals),
        terminals: await this.serializeTerminals(terminals),
        metadata: {
          version: UnifiedTerminalPersistenceService.SESSION_VERSION,
          timestamp: Date.now(),
          activeTerminalId: this.getActiveTerminalId(terminals),
          totalTerminals: terminals.length,
          cliAgentSessions: this.detectCliAgentSessions(terminals),
          userWorkspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        },
      };

      // 圧縮して保存（メモリ効率化）
      const compressedData = this.compressSessionData(sessionData);
      await this.context.globalState.update(
        UnifiedTerminalPersistenceService.SESSION_KEY,
        compressedData
      );

      log(`📦 [PERSISTENCE] Session saved: ${terminals.length} terminals`);
    } catch (error) {
      log(`❌ [PERSISTENCE] Session save failed: ${error}`);
      throw new PersistenceError(
        `Failed to save session: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * ターミナルセッションを復元
   */
  async restoreSession(): Promise<any[]> {
    try {
      const sessionData = await this.loadSessionData();
      if (!sessionData || this.isSessionExpired(sessionData)) {
        log('📦 [PERSISTENCE] No valid session to restore');
        return [];
      }

      if (!this.validateSessionData(sessionData)) {
        log('❌ [PERSISTENCE] Invalid session data format');
        return [];
      }

      log(`📦 [PERSISTENCE] Restoring ${sessionData.terminals.length} terminals`);

      // 並列復元でパフォーマンス向上
      const restoredTerminals = await this.bulkTerminalRestore(sessionData.terminals);

      // アクティブターミナル復元
      if (restoredTerminals.length > 0) {
        await this.restoreActiveTerminal(sessionData.activeTerminalId, restoredTerminals);
      }

      log(
        `📦 [PERSISTENCE] Session restored: ${restoredTerminals.length}/${sessionData.terminals.length} terminals`
      );
      return restoredTerminals;
    } catch (error) {
      log(`❌ [PERSISTENCE] Session restore failed: ${error}`);
      throw new PersistenceError(
        `Failed to restore session: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * セッションクリーンアップ（古いセッション削除）
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const sessionData = await this.loadSessionData();
      if (sessionData && this.isSessionExpired(sessionData)) {
        await this.context.globalState.update(
          UnifiedTerminalPersistenceService.SESSION_KEY,
          undefined
        );
        log('📦 [PERSISTENCE] Expired session cleaned up');
      }
    } catch (error) {
      log(`❌ [PERSISTENCE] Cleanup failed: ${error}`);
    }
  }

  /**
   * ターミナルデータシリアライズ
   */
  private async serializeTerminals(terminals: any[]): Promise<TerminalSessionData[]> {
    const serializedTerminals: TerminalSessionData[] = [];

    for (const terminal of terminals) {
      try {
        const serialized: TerminalSessionData = {
          id: terminal.id || 0,
          name: terminal.name || `Terminal ${terminal.id}`,
          scrollback: this.truncateScrollback(terminal.scrollback || []),
          workingDirectory: terminal.workingDirectory || safeProcessCwd(),
          shellCommand: terminal.shellCommand || '',
          isActive: terminal.isActive || false,
          cliAgentType: this.detectCliAgentType(terminal.scrollback || []),
          lastActivity: Date.now(),
        };

        serializedTerminals.push(serialized);
      } catch (error) {
        log(`⚠️ [PERSISTENCE] Failed to serialize terminal ${terminal.id}: ${error}`);
      }
    }

    return serializedTerminals;
  }

  /**
   * 並列ターミナル復元
   */
  private async bulkTerminalRestore(terminals: TerminalSessionData[]): Promise<any[]> {
    const results: any[] = [];
    const MAX_CONCURRENT = UnifiedTerminalPersistenceService.MAX_CONCURRENT_RESTORES;

    for (let i = 0; i < terminals.length; i += MAX_CONCURRENT) {
      const batch = terminals.slice(i, i + MAX_CONCURRENT);
      const batchPromises = batch.map((terminal) => this.restoreTerminal(terminal));

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          log(
            `⚠️ [PERSISTENCE] Terminal ${batch[index]?.id || 'unknown'} restore failed: ${result.reason}`
          );
        }
      });

      // バッチ間の遅延（システム負荷軽減）
      if (i + MAX_CONCURRENT < terminals.length) {
        await this.delay(100);
      }
    }

    return results.filter((terminal) => terminal !== null);
  }

  /**
   * 単一ターミナル復元
   */
  private async restoreTerminal(data: TerminalSessionData): Promise<any | null> {
    try {
      // ターミナル再作成
      const terminalId = this.terminalManager.createTerminal();

      // スクロールバック復元（分割送信でパフォーマンス向上）
      if (data.scrollback.length > 0) {
        await this.restoreScrollback(terminalId, data.scrollback);
      }

      // CLI Agent環境復元
      if (data.cliAgentType) {
        await this.restoreCliAgentEnvironment(terminalId, data.cliAgentType);
      }

      return {
        id: terminalId,
        name: data.name,
        scrollback: data.scrollback,
        workingDirectory: data.workingDirectory,
        isActive: data.isActive,
        cliAgentType: data.cliAgentType,
      };
    } catch (error) {
      log(`❌ [PERSISTENCE] Terminal ${data.id} restore failed: ${error}`);
      return null;
    }
  }

  /**
   * スクロールバック復元（高性能バッチ処理）
   */
  private async restoreScrollback(terminalId: string, scrollback: string[]): Promise<void> {
    if (scrollback.length === 0) return;

    const BATCH_SIZE = 50;
    const DELAY_MS = 10;

    for (let i = 0; i < scrollback.length; i += BATCH_SIZE) {
      const batch = scrollback.slice(i, i + BATCH_SIZE);
      const batchData = batch.join('\r\n') + '\r\n';

      this.terminalManager.sendInput(batchData, terminalId);

      if (i + BATCH_SIZE < scrollback.length) {
        await this.delay(DELAY_MS);
      }
    }

    // 復元完了通知
    this.terminalManager.sendInput('echo "Session restored"\r', terminalId);
  }

  /**
   * CLI Agent環境復元
   */
  private async restoreCliAgentEnvironment(
    terminalId: string,
    agentType: 'claude' | 'gemini'
  ): Promise<void> {
    const commands = {
      claude: ['echo "✨ Claude Code session restored"', 'echo "Previous session data available"'],
      gemini: ['echo "✨ Gemini Code session restored"', 'echo "Ready for new commands"'],
    };

    for (const command of commands[agentType]) {
      this.terminalManager.sendInput(command + '\r', terminalId);
      await this.delay(100);
    }
  }

  /**
   * アクティブターミナル復元
   */
  private async restoreActiveTerminal(activeId: number, terminals: any[]): Promise<void> {
    const activeTerminal = terminals.find((t) => t.id === activeId);
    if (activeTerminal) {
      // アクティブターミナル設定
      await this.terminalManager.setActiveTerminal(activeTerminal.id);
      log(`📦 [PERSISTENCE] Active terminal restored: ${activeTerminal.id}`);
    }
  }

  /**
   * ヘルパーメソッド
   */
  private getActiveTerminalId(terminals: any[]): number {
    const activeTerminal = terminals.find((t) => t.isActive);
    return activeTerminal ? activeTerminal.id : terminals[0]?.id || 1;
  }

  private detectCliAgentSessions(terminals: any[]): Array<'claude' | 'gemini'> {
    return terminals
      .map((t) => this.detectCliAgentType(t.scrollback || []))
      .filter((type): type is 'claude' | 'gemini' => type !== undefined);
  }

  private detectCliAgentType(scrollback: string[]): 'claude' | 'gemini' | undefined {
    const recentLines = scrollback.slice(-50).join('\n');

    if (/claude-code\s+["'].*?["']|anthropic\.com|Claude\s+Code/i.test(recentLines)) {
      return 'claude';
    }

    if (/gemini\s+code\s+["'].*?["']|Gemini\s+Code|google.*gemini/i.test(recentLines)) {
      return 'gemini';
    }

    return undefined;
  }

  private truncateScrollback(scrollback: string[]): string[] {
    return scrollback
      .slice(-UnifiedTerminalPersistenceService.MAX_SCROLLBACK_LINES)
      .filter((line) => line.trim().length > 0);
  }

  private compressSessionData(data: PersistenceSessionData): string {
    // 簡易圧縮（実装では更に最適化可能）
    return JSON.stringify(data);
  }

  private async loadSessionData(): Promise<PersistenceSessionData | null> {
    try {
      const rawData = this.context.globalState.get<string>(
        UnifiedTerminalPersistenceService.SESSION_KEY
      );

      if (!rawData) return null;

      // データ展開
      return JSON.parse(rawData) as PersistenceSessionData;
    } catch (error) {
      log(`❌ [PERSISTENCE] Failed to load session data: ${error}`);
      return null;
    }
  }

  private validateSessionData(data: PersistenceSessionData): boolean {
    return !!(
      data &&
      data.version &&
      data.timestamp &&
      Array.isArray(data.terminals) &&
      data.terminals.every(
        (t) => typeof t.id === 'number' && typeof t.name === 'string' && Array.isArray(t.scrollback)
      )
    );
  }

  private isSessionExpired(sessionData: PersistenceSessionData): boolean {
    const expiry = UnifiedTerminalPersistenceService.MAX_SESSION_AGE_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - sessionData.timestamp > expiry;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
