import { CliAgentStatus, CliAgentType, CliAgentInfo } from './CliAgentStateService';
import { terminal as log } from '../utils/logger';

/**
 * 表示用のターミナル情報
 */
export interface TerminalDisplayInfo {
  terminalId: string;
  name: string;
  agentInfo?: CliAgentInfo;
}

/**
 * 表示更新イベント
 */
export interface DisplayUpdateEvent {
  terminalId: string;
  displayName: string;
  status: CliAgentStatus;
  agentType: CliAgentType | null;
}

/**
 * CLI Agent表示同期サービス
 * 
 * 責務：
 * - ターミナル表示名の生成
 * - CLI Agent状態表示の統一管理
 * - Extension ↔ WebView間の表示データ同期
 * - 表示情報のフォーマット統一
 */
export class CliAgentDisplayService {
  private readonly _terminalNames = new Map<string, string>();
  private readonly _displayCache = new Map<string, DisplayUpdateEvent>();

  /**
   * ターミナル表示名を設定
   */
  public setTerminalName(terminalId: string, name: string): void {
    this._terminalNames.set(terminalId, name);
    log(`📝 [CLI-AGENT-DISPLAY] Set terminal name: ${terminalId} -> ${name}`);
  }

  /**
   * ターミナル表示名を取得
   */
  public getTerminalName(terminalId: string): string {
    return this._terminalNames.get(terminalId) || this._generateDefaultName(terminalId);
  }

  /**
   * CLI Agent状態に基づく表示更新データを生成
   */
  public generateDisplayUpdate(
    terminalId: string, 
    agentInfo: CliAgentInfo | null
  ): DisplayUpdateEvent {
    const terminalName = this.getTerminalName(terminalId);
    
    const displayUpdate: DisplayUpdateEvent = {
      terminalId,
      displayName: this._formatDisplayName(terminalName, agentInfo),
      status: agentInfo?.status || CliAgentStatus.NONE,
      agentType: agentInfo?.type || null,
    };

    // キャッシュに保存
    this._displayCache.set(terminalId, displayUpdate);
    
    log(`🔄 [CLI-AGENT-DISPLAY] Generated display update: ${terminalId} -> ${displayUpdate.displayName} (${displayUpdate.status})`);
    
    return displayUpdate;
  }

  /**
   * 全ターミナルの表示データを取得
   */
  public getAllDisplayData(): DisplayUpdateEvent[] {
    return Array.from(this._displayCache.values());
  }

  /**
   * 特定ターミナルの表示データを取得
   */
  public getDisplayData(terminalId: string): DisplayUpdateEvent | null {
    return this._displayCache.get(terminalId) || null;
  }

  /**
   * WebView向けのメッセージ形式を生成
   */
  public generateWebViewMessage(
    terminalId: string,
    agentInfo: CliAgentInfo | null
  ): {
    command: 'cliAgentStatusUpdate';
    cliAgentStatus: {
      activeTerminalName: string | null;
      status: string;
      agentType: string | null;
    };
  } {
    const displayUpdate = this.generateDisplayUpdate(terminalId, agentInfo);
    
    return {
      command: 'cliAgentStatusUpdate',
      cliAgentStatus: {
        activeTerminalName: displayUpdate.status !== CliAgentStatus.NONE ? displayUpdate.displayName : null,
        status: displayUpdate.status,
        agentType: displayUpdate.agentType,
      },
    };
  }

  /**
   * ターミナル削除時のクリーンアップ
   */
  public cleanupTerminal(terminalId: string): void {
    this._terminalNames.delete(terminalId);
    this._displayCache.delete(terminalId);
    log(`🧹 [CLI-AGENT-DISPLAY] Cleaned up terminal display data: ${terminalId}`);
  }

  /**
   * 全データのクリーンアップ
   */
  public dispose(): void {
    this._terminalNames.clear();
    this._displayCache.clear();
    log('🧹 [CLI-AGENT-DISPLAY] Disposed CLI Agent display service');
  }

  // =================== Private Methods ===================

  /**
   * デフォルトのターミナル名を生成
   */
  private _generateDefaultName(terminalId: string): string {
    // ターミナルIDから短縮名を生成
    const shortId = terminalId.slice(-4);
    return `Terminal ${shortId}`;
  }

  /**
   * 表示名をフォーマット
   */
  private _formatDisplayName(baseName: string, agentInfo: CliAgentInfo | null): string {
    if (!agentInfo || agentInfo.status === CliAgentStatus.NONE) {
      return baseName;
    }

    // CLI Agent情報を含む表示名を生成
    const agentDisplayName = this._getAgentDisplayName(agentInfo.type);
    const statusDisplayName = this._getStatusDisplayName(agentInfo.status);
    
    return `${baseName} [${agentDisplayName} ${statusDisplayName}]`;
  }

  /**
   * CLI Agent種別の表示名を取得
   */
  private _getAgentDisplayName(type: CliAgentType): string {
    switch (type) {
      case 'claude':
        return 'CLAUDE CLI';
      case 'gemini':
        return 'GEMINI CLI';
      default:
        return 'CLI AGENT';
    }
  }

  /**
   * 状態の表示名を取得
   */
  private _getStatusDisplayName(status: CliAgentStatus): string {
    switch (status) {
      case CliAgentStatus.CONNECTED:
        return 'Connected';
      case CliAgentStatus.DISCONNECTED:
        return 'Disconnected';
      case CliAgentStatus.NONE:
        return '';
      default:
        return status;
    }
  }
}