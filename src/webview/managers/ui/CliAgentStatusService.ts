/**
 * CLI Agent Status Service
 *
 * Extracted from UIManager for better maintainability.
 * Handles CLI Agent status display in terminal headers.
 */

import { HeaderFactory, TerminalHeaderElements } from '../../factories/HeaderFactory';
import { uiLogger } from '../../utils/ManagerLogger';

/**
 * Service for managing CLI Agent status display
 */
export class CliAgentStatusService {
  // Prevent rapid successive updates that could cause duplication
  private lastUpdateTimestamp = 0;
  private readonly UPDATE_DEBOUNCE_MS = 100;

  /**
   * Update CLI Agent status display in sidebar terminal headers (optimized)
   */
  public updateCliAgentStatusDisplay(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    headerElementsCache: Map<string, TerminalHeaderElements>,
    agentType: string | null = null
  ): void {
    // CLI Agentステータス更新は即座に処理する（デバウンスをスキップ）
    // 相互排他制御により短時間で複数のステータス変更が発生するため

    let updatedCount = 0;

    // キャッシュされたヘッダー要素を使用（高速）
    for (const [, headerElements] of headerElementsCache) {
      const terminalName = headerElements.nameSpan.textContent?.trim();
      const isTargetTerminal = terminalName === activeTerminalName;

      if (status === 'none') {
        // CLI Agent statusを削除 (全ターミナルから削除)
        HeaderFactory.removeCliAgentStatus(headerElements);
        // AI Agent切り替えボタンを常時表示 (none状態でも表示)
        HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true);
      } else if (isTargetTerminal) {
        // CLI Agent statusを挿入/更新 (該当ターミナルのみ)
        HeaderFactory.insertCliAgentStatus(headerElements, status, agentType);
        // AI Agent切り替えボタンを常時表示 (全ての状態で表示)
        HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, status);
      } else {
        // AI Agentステータスがないターミナルでもボタンを表示
        HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true);
      }
      updatedCount++;
    }

    if (updatedCount > 0) {
      uiLogger.info(
        `CLI Agent status updated: ${activeTerminalName} -> ${status} (${updatedCount} terminals)`
      );
    }
  }

  /**
   * Update CLI Agent status by terminal ID (for Full State Sync)
   */
  public updateCliAgentStatusByTerminalId(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    headerElementsCache: Map<string, TerminalHeaderElements>,
    agentType: string | null = null
  ): void {
    uiLogger.info(`Updating CLI Agent status: ${terminalId} -> ${status} (${agentType})`);

    // シンプルにステータス更新のみ実行 - 複雑な判定は省略
    const headerElements = headerElementsCache.get(terminalId);
    if (!headerElements) {
      uiLogger.warn(`No header elements found for terminal: ${terminalId}`);
      return;
    }

    // ステータスに応じてシンプルに更新
    if (status === 'connected') {
      HeaderFactory.insertCliAgentStatus(headerElements, 'connected', agentType);
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'connected');
    } else if (status === 'disconnected') {
      HeaderFactory.insertCliAgentStatus(headerElements, 'disconnected', agentType);
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true, 'disconnected');
    } else {
      // none状態
      HeaderFactory.removeCliAgentStatus(headerElements);
      HeaderFactory.setAiAgentToggleButtonVisibility(headerElements, true);
    }

    uiLogger.info(`CLI Agent status updated for terminal ${terminalId}: ${status}`);
  }

  /**
   * Check if CLI Agent update should be processed (debouncing)
   */
  public shouldProcessCliAgentUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdateTimestamp < this.UPDATE_DEBOUNCE_MS) {
      return false;
    }
    this.lastUpdateTimestamp = now;
    return true;
  }
}
