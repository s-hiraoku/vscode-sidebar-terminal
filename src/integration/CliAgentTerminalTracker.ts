import * as vscode from 'vscode';
import { extension as log } from '../utils/logger';
import type { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';

/**
 * CLI Agent Terminal情報を管理するインターフェース
 */
interface CliAgentTerminalInfo {
  terminalId: string;
  terminal: vscode.Terminal;
  originalName: string;
  isActive: boolean;
  startTime: Date;
}

/**
 * CLI Agent のターミナル検出・状態管理を行うクラス
 * - CLI Agent起動時のターミナル検出
 * - ターミナル名の状態管理 (○ IDE connected/disconnected)
 * - ターミナル削除時の自動昇格処理
 */
export class CliAgentTracker {
  private static instance: CliAgentTracker | undefined;
  private cliAgentTerminals = new Map<string, CliAgentTerminalInfo>();
  private disposables: vscode.Disposable[] = [];
  private sidebarProvider: SecondaryTerminalProvider | undefined;

  private constructor(private context: vscode.ExtensionContext) {
    this.setupEventListeners();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(context?: vscode.ExtensionContext): CliAgentTracker {
    if (!CliAgentTracker.instance && context) {
      CliAgentTracker.instance = new CliAgentTracker(context);
    }
    if (!CliAgentTracker.instance) {
      throw new Error('CliAgentTracker not initialized. Call getInstance with context first.');
    }
    return CliAgentTracker.instance;
  }

  /**
   * SecandarySidebarを設定
   */
  public setSidebarProvider(provider: SecondaryTerminalProvider): void {
    this.sidebarProvider = provider;
    log('🔧 [CLAUDE-TRACKER] SecandarySidebar reference set');
  }

  /**
   * VS Code ターミナルイベントのリスナーを設定
   * 注意: この機能は現在無効化されています。サイドバーターミナルのCLI Agent検出はTerminalManagerで行います。
   */
  private setupEventListeners(): void {
    log(
      '🔄 [CLAUDE-TRACKER] Event listeners disabled - CLI Agent detection moved to TerminalManager'
    );

    // VS Code標準ターミナルの監視は無効化
    // サイドバーターミナルのCLI Agent検出はTerminalManagerで実装されています

    // 将来的にVS Code標準ターミナルとの統合が必要な場合は、以下のコードを有効化してください：
    /*
    // CLI Agent コマンド開始監視
    const startListener = vscode.window.onDidStartTerminalShellExecution((event) => {
      log(`🔍 [CLAUDE-TRACKER] Shell execution started: ${event.execution.commandLine.value}`);
      this.handleCliAgentStart(event.execution);
    });

    // CLI Agent コマンド終了監視
    const endListener = vscode.window.onDidEndTerminalShellExecution((event) => {
      log(`🔍 [CLAUDE-TRACKER] Shell execution ended: ${event.execution.commandLine.value}`);
      this.handleCliAgentEnd(event.execution);
    });

    // ターミナル削除監視
    const closeListener = vscode.window.onDidCloseTerminal((terminal) => {
      log(`🔍 [CLAUDE-TRACKER] Terminal closed: ${terminal.name}`);
      this.handleTerminalClosed(terminal);
    });

    this.disposables.push(startListener, endListener, closeListener);
    this.context.subscriptions.push(...this.disposables);
    */

    log('✅ [CLAUDE-TRACKER] Event listener setup completed (monitoring disabled)');
  }

  /**
   * CLI Agent コマンド開始時の処理
   */
  private handleCliAgentStart(execution: vscode.TerminalShellExecution): void {
    const command = execution.commandLine.value.trim();
    log(`🔍 [CLAUDE-TRACKER] Handling command start: "${command}"`);

    // 設定チェック
    if (!this.isCliAgentIntegrationEnabled()) {
      log('⚠️ [CLAUDE-TRACKER] CLI Agent integration disabled in settings');
      return;
    }

    if (command.startsWith('claude')) {
      log(`🚀 [CLAUDE-TRACKER] CLI Agent command detected: ${command}`);

      // 実行中のターミナルを見つける（TerminalShellExecutionにはterminal参照がないため、現在アクティブなターミナルを使用）
      const currentTerminal = vscode.window.activeTerminal;
      const allTerminals = vscode.window.terminals;

      log(`🔍 [CLAUDE-TRACKER] Active terminal: ${currentTerminal?.name || 'none'}`);
      log(`🔍 [CLAUDE-TRACKER] Total terminals: ${allTerminals.length}`);
      allTerminals.forEach((terminal, index) => {
        log(
          `🔍 [CLAUDE-TRACKER] Terminal ${index}: ${terminal.name} (active: ${terminal === currentTerminal})`
        );
      });

      if (currentTerminal) {
        log(`🎯 [CLAUDE-TRACKER] Activating CLI Agent terminal: ${currentTerminal.name}`);
        this.activateCliAgentTerminal(currentTerminal);
      } else {
        log('⚠️ [CLAUDE-TRACKER] No active terminal found for CLI Agent command');
      }
    } else {
      log(`🔍 [CLAUDE-TRACKER] Command does not start with "claude": ${command}`);
    }
  }

  /**
   * ターミナル出力監視（CLI Agent特有のパターンを検出）
   */
  private handleTerminalOutput(terminal: vscode.Terminal, data: string): void {
    // CLI Agent特有のパターンを検出
    const claudePatterns = [
      'CLI Agent',
      'chat input field',
      'To start a conversation',
      'Welcome to CLI Agent',
      'Starting CLI Agent',
      'claude.ai',
    ];

    const hasCliAgentPattern = claudePatterns.some((pattern) =>
      data.toLowerCase().includes(pattern.toLowerCase())
    );

    if (hasCliAgentPattern) {
      log(
        `🔍 [CLAUDE-TRACKER] CLI Agent pattern detected in terminal ${terminal.name}: "${data.slice(0, 100)}..."`
      );

      // CLI Agentが実際に起動している可能性が高い
      if (!this.cliAgentTerminals.has(this.getTerminalId(terminal))) {
        log(
          `🚀 [CLAUDE-TRACKER] Activating CLI Agent terminal via output pattern: ${terminal.name}`
        );
        this.activateCliAgentTerminal(terminal);
      }
    }

    // デバッグ用：短いデータのみログ出力（パフォーマンス考慮）
    if (data.length < 50 && data.trim().length > 0) {
      log(`🔍 [CLAUDE-TRACKER] Terminal output (${terminal.name}): "${data.trim()}"`);
    }
  }

  /**
   * CLI Agent コマンド終了時の処理
   */
  private handleCliAgentEnd(execution: vscode.TerminalShellExecution): void {
    const command = execution.commandLine.value.trim();

    // 設定チェック
    if (!this.isCliAgentIntegrationEnabled()) {
      return;
    }

    if (command.startsWith('claude')) {
      // 実行中のターミナルを見つける（TerminalShellExecutionにはterminal参照がないため、現在アクティブなターミナルを使用）
      const currentTerminal = vscode.window.activeTerminal;

      if (currentTerminal) {
        const terminalId = this.getTerminalId(currentTerminal);
        const claudeInfo = this.cliAgentTerminals.get(terminalId);

        if (claudeInfo) {
          log(`🔄 [CLAUDE-TRACKER] CLI Agent terminated in terminal: ${terminalId}`);

          // 表示を元に戻す（IDE connected/disconnected 表示を削除）
          // ターミナル名を元に戻す
          this.restoreTerminalName(currentTerminal, claudeInfo.originalName);

          // 内部追跡から削除
          this.cliAgentTerminals.delete(terminalId);

          // WebViewに状態変更を通知
          this.notifyWebViewOfStatusChange();

          log(`✅ [CLAUDE-TRACKER] Terminal restored to: ${claudeInfo.originalName}`);
        }
      }
    }
  }

  /**
   * ターミナル削除時の処理
   */
  private handleTerminalClosed(closedTerminal: vscode.Terminal): void {
    if (!this.isCliAgentIntegrationEnabled()) {
      return;
    }

    const closedTerminalId = this.getTerminalId(closedTerminal);
    const claudeInfo = this.cliAgentTerminals.get(closedTerminalId);

    if (claudeInfo && claudeInfo.isActive) {
      // Connected ターミナルが削除された場合
      log(`🔄 [CLAUDE-TRACKER] Active CLI Agent terminal closed: ${closedTerminalId}`);

      // 内部追跡から削除
      this.cliAgentTerminals.delete(closedTerminalId);

      // Disconnected ターミナルの中から最も若い番号を昇格
      this.promoteOldestDisconnectedTerminal();

      // WebViewに状態変更を通知
      this.notifyWebViewOfStatusChange();
    } else if (claudeInfo) {
      // Disconnected ターミナルが削除された場合
      this.cliAgentTerminals.delete(closedTerminalId);

      // WebViewに状態変更を通知
      this.notifyWebViewOfStatusChange();

      log(`🗑️ [CLAUDE-TRACKER] Disconnected CLI Agent terminal removed: ${closedTerminalId}`);
    }
  }

  /**
   * 新しいターミナルをCLI Agent Activeターミナルとして設定
   */
  private activateCliAgentTerminal(newTerminal: vscode.Terminal): void {
    const newTerminalId = this.getTerminalId(newTerminal);
    const originalName = newTerminal.name;

    log(`🔧 [CLAUDE-TRACKER] Activating CLI Agent terminal: ${newTerminalId} (${originalName})`);

    // 1. 既存のconnectedターミナルをdisconnectedに変更
    log(`🔧 [CLAUDE-TRACKER] Deactivating existing CLI Agent terminals...`);
    this.deactivateAllCliAgentTerminals();

    // 2. 新しいターミナルを追跡開始
    log(`🔧 [CLAUDE-TRACKER] Adding terminal to tracking map: ${newTerminalId}`);
    this.cliAgentTerminals.set(newTerminalId, {
      terminalId: newTerminalId,
      terminal: newTerminal,
      originalName: originalName, // 元の名前を保存
      isActive: true,
      startTime: new Date(),
    });

    // 3. Connected表示を設定
    log(`🔧 [CLAUDE-TRACKER] Setting terminal status to connected`);
    this.setTerminalStatus(newTerminal, 'connected');

    // 4. WebViewに状態変更を通知
    log(`🔧 [CLAUDE-TRACKER] Notifying WebView of status change`);
    this.notifyWebViewOfStatusChange();

    log(
      `✅ [CLAUDE-TRACKER] CLI Agent activated in terminal: ${newTerminalId} (original: ${originalName})`
    );
    log(`🔍 [CLAUDE-TRACKER] Total tracked terminals: ${this.cliAgentTerminals.size}`);
  }

  /**
   * すべてのアクティブなCLI Agentターミナルを非アクティブにする
   */
  private deactivateAllCliAgentTerminals(): void {
    for (const [terminalId, info] of this.cliAgentTerminals) {
      if (info.isActive) {
        this.setTerminalStatus(info.terminal, 'disconnected');
        info.isActive = false;
        log(`🔄 [CLAUDE-TRACKER] Deactivated terminal: ${terminalId}`);
      }
    }
  }

  /**
   * 最も若い番号のDisconnectedターミナルをConnectedに昇格
   */
  private promoteOldestDisconnectedTerminal(): void {
    // Disconnected なターミナルを取得
    const disconnectedTerminals = Array.from(this.cliAgentTerminals.values()).filter(
      (info) => !info.isActive
    );

    if (disconnectedTerminals.length === 0) {
      log('ℹ️ [CLAUDE-TRACKER] No disconnected CLI Agent terminals to promote');
      return;
    }

    // ターミナル番号で昇順ソート（Terminal 1 < Terminal 2 < ...）
    disconnectedTerminals.sort((a, b) => {
      const numA = this.extractTerminalNumber(a.terminal.name);
      const numB = this.extractTerminalNumber(b.terminal.name);
      return numA - numB;
    });

    // 最も若い番号のターミナルを昇格
    const promotedTerminal = disconnectedTerminals[0];
    if (promotedTerminal) {
      this.setTerminalStatus(promotedTerminal.terminal, 'connected');
      promotedTerminal.isActive = true;

      log(`⬆️ [CLAUDE-TRACKER] Promoted terminal to connected: ${promotedTerminal.terminalId}`);
    }
  }

  /**
   * ターミナルのステータス表示を設定
   */
  private setTerminalStatus(terminal: vscode.Terminal, status: 'connected' | 'disconnected'): void {
    const terminalId = this.getTerminalId(terminal);
    const claudeInfo = this.cliAgentTerminals.get(terminalId);

    if (!claudeInfo) return;

    const baseName = claudeInfo.originalName;
    let newName: string;

    switch (status) {
      case 'connected':
        newName = `${baseName} ○ IDE connected`;
        claudeInfo.isActive = true;
        break;
      case 'disconnected':
        newName = `${baseName} ○ IDE disconnected`;
        claudeInfo.isActive = false;
        break;
    }

    // ターミナル名を更新する（VS Code APIの制限のため、直接的な名前変更は難しい）
    // 代替案として、内部で追跡し、ユーザーに視覚的フィードバックを提供
    log(`🎯 [CLAUDE-TRACKER] Terminal status updated: ${terminalId} -> ${status} (${newName})`);

    // Note: VS Codeのターミナル名は読み取り専用のため、
    // 実際の名前変更は制限されています。将来のAPIアップデートを待つ必要があります。
  }

  /**
   * ターミナル名を元に戻す
   */
  private restoreTerminalName(terminal: vscode.Terminal, originalName: string): void {
    // 現在のVS Code APIでは、ターミナル名の変更に制限があります
    // 代替案として内部状態のクリーンアップのみ行います
    log(`🔄 [CLAUDE-TRACKER] Terminal name would be restored to: ${originalName}`);

    // Note: 実際の名前の復元は現在のVS Code APIでは制限されています
  }

  /**
   * ターミナル名から番号を抽出
   */
  private extractTerminalNumber(terminalName: string): number {
    // "Terminal 3 ○ IDE disconnected" → 3
    const match = terminalName.match(/Terminal (\d+)/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return isNaN(num) ? 999 : num;
    }
    return 999; // 番号なしは最後に
  }

  /**
   * ターミナルの一意IDを取得
   */
  private getTerminalId(terminal: vscode.Terminal): string {
    // VS CodeのTerminalには直接的なIDがないため、名前とインデックスで識別
    // processIdは非同期のため、同期的な識別に名前を使用
    const terminals = vscode.window.terminals;
    const index = terminals.indexOf(terminal);
    return `terminal-${index}-${terminal.name}`;
  }

  /**
   * CLI Agent統合機能が有効かどうかを確認
   */
  private isCliAgentIntegrationEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return config.get<boolean>('enableCliAgentIntegration', true);
  }

  /**
   * WebViewにCLI Agent状態を通知
   */
  private notifyWebViewOfStatusChange(): void {
    log('🔔 [CLAUDE-TRACKER] Starting WebView notification process...');

    if (!this.sidebarProvider) {
      log('⚠️ [CLAUDE-TRACKER] SidebarProvider not available for WebView notification');
      return;
    }

    const activeTerminal = this.getActiveCliAgentTerminal();
    log(
      `🔍 [CLAUDE-TRACKER] Active CLI Agent terminal: ${activeTerminal ? activeTerminal.terminalId : 'none'}`
    );

    if (activeTerminal) {
      const terminalName = activeTerminal.originalName;
      log(`📤 [CLAUDE-TRACKER] Sending connected status to WebView: ${terminalName}`);
      this.sidebarProvider.sendCliAgentStatusUpdate(terminalName, 'connected');
      log(`✅ [CLAUDE-TRACKER] Notified WebView: ${terminalName} -> connected`);
    } else {
      // Check if any disconnected terminals exist
      const disconnectedTerminals = Array.from(this.cliAgentTerminals.values()).filter(
        (info) => !info.isActive
      );
      log(`🔍 [CLAUDE-TRACKER] Found ${disconnectedTerminals.length} disconnected terminals`);

      if (disconnectedTerminals.length > 0) {
        // Show disconnected status for the most recent terminal
        const latestTerminal = disconnectedTerminals.sort(
          (a, b) => b.startTime.getTime() - a.startTime.getTime()
        )[0];
        if (latestTerminal) {
          log(
            `📤 [CLAUDE-TRACKER] Sending disconnected status to WebView: ${latestTerminal.originalName}`
          );
          this.sidebarProvider.sendCliAgentStatusUpdate(
            latestTerminal.originalName,
            'disconnected'
          );
          log(
            `✅ [CLAUDE-TRACKER] Notified WebView: ${latestTerminal.originalName} -> disconnected`
          );
        }
      } else {
        // No CLI Agent terminals at all
        log('📤 [CLAUDE-TRACKER] Sending "none" status to WebView');
        this.sidebarProvider.sendCliAgentStatusUpdate(null, 'none');
        log('✅ [CLAUDE-TRACKER] Notified WebView: no CLI Agent terminals');
      }
    }
  }

  /**
   * 現在アクティブなCLI Agentターミナルを取得
   * 注意: VS Code標準ターミナルの監視は無効化されています。
   * サイドバーターミナルのCLI Agent検出はTerminalManager.isCliAgentActive()を使用してください。
   */
  public getActiveCliAgentTerminal(): CliAgentTerminalInfo | undefined {
    log(
      '⚠️ [CLAUDE-TRACKER] getActiveCliAgentTerminal called but VS Code terminal monitoring is disabled'
    );
    log(
      '💡 [CLAUDE-TRACKER] Use TerminalManager.isCliAgentActive() for sidebar terminal CLI Agent detection'
    );

    // VS Code標準ターミナルの監視は無効化されているため、常にundefinedを返す
    return undefined;
  }

  /**
   * すべてのCLI Agentターミナル情報を取得（デバッグ用）
   */
  public getAllCliAgentTerminals(): CliAgentTerminalInfo[] {
    return Array.from(this.cliAgentTerminals.values());
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    this.disposables.forEach((disposable: vscode.Disposable) => {
      disposable.dispose();
    });
    this.cliAgentTerminals.clear();
    CliAgentTracker.instance = undefined;
    log('🧹 [CLAUDE-TRACKER] Disposed and cleaned up');
  }
}
