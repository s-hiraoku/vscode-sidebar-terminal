/**
 * リファクタリング後のWebViewメインエントリーポイント
 *
 * この実装は既存のmain.tsの代替として設計されており、
 * 将来的にmain.tsを置き換える予定です。
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

// 型定義のインポート
import type { WebviewMessage, VsCodeMessage, TerminalConfig } from './types/events.types';
import type { TerminalSettings } from './types/terminal.types';

// 型定義の追加
interface TerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  id: string;
  name: string;
}

interface InitMessage {
  command: string;
  config: TerminalConfig;
  activeTerminalId: string;
}

interface OutputMessage {
  command: string;
  data: string;
}

interface TerminalCreatedMessage {
  command: string;
  terminalId: string;
  terminalName: string;
}

interface SettingsMessage {
  command: string;
  settings: TerminalSettings;
}

// 定数のインポート
import { TERMINAL_CONSTANTS } from './constants';

// ユーティリティのインポート
import { DOMUtils } from './utils/DOMUtils';
import { ThemeUtils } from './utils/ThemeUtils';
import { ErrorHandler } from './utils/ErrorHandler';
import { PerformanceUtils } from './utils/PerformanceUtils';

// マネージャー・コンポーネントのインポート
import { StatusManager } from './managers/StatusManager';
import { HeaderManager } from './managers/HeaderManager';
import { SettingsPanel } from './components/SettingsPanel';

// グローバル変数の宣言
declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

const vscode = acquireVsCodeApi();

/**
 * 簡略化されたターミナルWebView管理クラス
 */
class TerminalWebviewManager {
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing = false;
  public activeTerminalId: string | null = null;

  // マネージャーインスタンス
  private statusManager: StatusManager;
  private headerManager: HeaderManager;
  private settingsPanel: SettingsPanel;

  // ターミナル管理
  public terminals = new Map<string, TerminalInstance>();

  constructor() {
    this.statusManager = new StatusManager();
    this.headerManager = new HeaderManager();
    this.settingsPanel = new SettingsPanel({
      onSettingsChange: (settings) => this.handleSettingsChange(settings),
      onClose: () => console.log('⚙️ [SETTINGS] Panel closed'),
    });

    // グローバルアクセス用
    (window as unknown as Record<string, unknown>).statusManager = this.statusManager;
    (window as unknown as Record<string, unknown>).terminalManager = this;
  }

  /**
   * 初期化
   */
  public initialize(): void {
    try {
      console.log('🎯 [MANAGER] Initializing TerminalWebviewManager');

      this.initializeDOM();
      this.setupMessageHandling();
      this.setupEventListeners();
      this.statusManager.initializeLayoutManagement();

      console.log('✅ [MANAGER] TerminalWebviewManager initialized');
    } catch (error) {
      ErrorHandler.getInstance().handleGenericError(
        error as Error,
        'TerminalWebviewManager.initialize'
      );
    }
  }

  /**
   * DOM初期化
   */
  private initializeDOM(): void {
    const container = DOMUtils.getElement('#terminal');
    if (!container) {
      throw new Error('Terminal container not found');
    }

    this.updateStatus('Initializing terminal interface');

    container.innerHTML = `
      <div id="terminal-header" style="
        display: flex;
        background: var(--vscode-tab-inactiveBackground, #2d2d30);
        border-bottom: 1px solid var(--vscode-tab-border, #333);
        padding: 4px 8px;
        gap: 4px;
        align-items: center;
        justify-content: space-between;
        min-height: 32px;
      ">
        <div id="terminal-tabs" style="
          display: flex;
          gap: 2px;
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        "></div>
      </div>
      <div id="terminal-body" style="
        flex: 1;
        background: #000;
        position: relative;
        height: calc(100% - 32px);
        min-height: 200px;
      ">
        <div id="terminal-placeholder" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #888;
          font-family: monospace;
          font-size: 14px;
          text-align: center;
        ">
          <div>Terminal Ready</div>
          <div style="font-size: 12px; margin-top: 8px;">Waiting for initialization...</div>
        </div>
      </div>
    `;

    this.terminalContainer = DOMUtils.getElement('#terminal-body');

    if (this.terminalContainer) {
      this.updateStatus('Terminal interface initialized', 'success');
      console.log('🎯 [MANAGER] Terminal container created successfully');
    } else {
      throw new Error('Failed to create terminal container');
    }

    // WebViewヘッダーを作成
    this.headerManager.createWebViewHeader();
  }

  /**
   * メッセージハンドリングの設定
   */
  private setupMessageHandling(): void {
    window.addEventListener('message', (event) => {
      const message = event.data as WebviewMessage;
      console.log('🎯 [MANAGER] Received message:', message.command);

      PerformanceUtils.measurePerformance(`Handle ${message.command}`, () => {
        void this.handleMessage(message);
      });
    });
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    // キーボードアクティビティでステータス再表示
    DOMUtils.addEventListenerSafe(document.documentElement, 'keydown', () => {
      this.statusManager.showLastStatusOnActivity();
    });

    // マウスアクティビティでステータス再表示
    DOMUtils.addEventListenerSafe(document.documentElement, 'click', (e) => {
      if (!(e.target as HTMLElement)?.closest('.status')) {
        this.statusManager.showLastStatusOnActivity();
      }
    });

    // ESCキーでステータス非表示
    DOMUtils.addEventListenerSafe(document.documentElement, 'keydown', (e) => {
      if (e.key === 'Escape') {
        this.statusManager.hideStatus();
      }
    });

    console.log('📱 [MANAGER] Event listeners set up');
  }

  /**
   * メッセージ処理
   */
  private async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      switch (message.command) {
        case TERMINAL_CONSTANTS.COMMANDS.INIT:
          await this.handleInitMessage(message as InitMessage);
          break;
        case TERMINAL_CONSTANTS.COMMANDS.OUTPUT:
          this.handleOutputMessage(message as OutputMessage);
          break;
        case TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED:
          this.handleTerminalCreated(message as TerminalCreatedMessage);
          break;
        case TERMINAL_CONSTANTS.COMMANDS.CLEAR:
          this.handleClearCommand();
          break;
        case TERMINAL_CONSTANTS.COMMANDS.SETTINGS_RESPONSE:
          this.handleSettingsResponse(message as SettingsMessage);
          break;
        case 'getSettings':
          this.handleGetSettings();
          break;
        case 'settingsResponse':
          this.handleSettingsResponse(message as SettingsMessage);
          break;
        default:
          console.warn('⚠️ [MANAGER] Unknown command:', message.command);
      }
    } catch (error) {
      ErrorHandler.getInstance().handleCommunicationError(
        error as Error,
        `handleMessage.${message.command}`
      );
    }
  }

  /**
   * 初期化メッセージの処理
   */
  private async handleInitMessage(message: InitMessage): Promise<void> {
    this.updateStatus('Received initialization data');

    if (message.config && message.activeTerminalId) {
      this.activeTerminalId = message.activeTerminalId;

      // ターミナルを作成
      const terminal = await this.createTerminalInstance(
        message.activeTerminalId,
        'Terminal',
        message.config
      );

      if (terminal) {
        this.updateStatus('✅ Terminal ready', 'success');
      }
    }
  }

  /**
   * 出力メッセージの処理
   */
  private handleOutputMessage(message: OutputMessage): void {
    if (message.data && this.terminal) {
      this.terminal.write(message.data);
    }
  }

  /**
   * ターミナル作成イベントの処理
   */
  private handleTerminalCreated(message: TerminalCreatedMessage): void {
    console.log('🆕 [MANAGER] Terminal created:', message.terminalId);
    this.addTerminalTab(message.terminalId, message.terminalName || 'Terminal');
    this.headerManager.updateTerminalCountBadge();
  }

  /**
   * クリアコマンドの処理
   */
  private handleClearCommand(): void {
    if (this.terminal) {
      this.terminal.clear();
    }
  }

  /**
   * ターミナルインスタンスを作成
   */
  private async createTerminalInstance(
    id: string,
    name: string,
    config: TerminalConfig
  ): Promise<Terminal | null> {
    try {
      if (!this.terminalContainer) {
        throw new Error('Terminal container not available');
      }

      const theme = ThemeUtils.getThemeColors(config.theme as 'auto' | 'dark' | 'light');

      const terminal = new Terminal({
        fontSize: config.fontSize || 14,
        fontFamily: config.fontFamily || 'monospace',
        theme,
        cursorBlink: config.cursorBlink !== false,
        allowTransparency: true,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      // プレースホルダーを削除
      const placeholder = DOMUtils.getElement('#terminal-placeholder');
      if (placeholder) {
        DOMUtils.safeRemove(placeholder);
      }

      // ターミナルコンテナを作成
      const terminalDiv = DOMUtils.createElement(
        'div',
        {
          width: '100%',
          height: '100%',
        },
        {
          'data-terminal-container': 'primary',
          id: 'primary-terminal',
        }
      );

      this.terminalContainer.appendChild(terminalDiv);

      // ターミナルを開く
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          terminal.open(terminalDiv);

          setTimeout(() => {
            fitAddon.fit();
            terminal.focus();
            terminal.refresh(0, terminal.rows - 1);
            resolve();
          }, 100);
        }, 50);
      });

      this.terminal = terminal;
      this.fitAddon = fitAddon;

      this.setupTerminalInput(terminal);

      console.log('✅ [MANAGER] Terminal instance created successfully');
      return terminal;
    } catch (error) {
      ErrorHandler.getInstance().handleTerminalError(error as Error, 'createTerminalInstance');
      return null;
    }
  }

  /**
   * ターミナル入力を設定
   */
  private setupTerminalInput(terminal: Terminal): void {
    terminal.onData((data) => {
      if (!this.isComposing) {
        vscode.postMessage({
          command: TERMINAL_CONSTANTS.COMMANDS.INPUT,
          data,
          terminalId: this.activeTerminalId || 'terminal-initial',
        });
      }
    });

    terminal.onResize(({ cols, rows }) => {
      vscode.postMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.RESIZE,
        cols,
        rows,
        terminalId: this.activeTerminalId || 'terminal-initial',
      });
    });
  }

  /**
   * ターミナルタブを追加
   */
  private addTerminalTab(id: string, name: string): void {
    const tabsContainer = DOMUtils.getElement('#terminal-tabs');
    if (!tabsContainer || DOMUtils.exists(`#tab-${id}`)) {
      return;
    }

    const tab = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: 'var(--vscode-tab-inactiveBackground, #2d2d30)',
        border: '1px solid var(--vscode-tab-border, #333)',
        borderRadius: '3px 3px 0 0',
        cursor: 'pointer',
        fontSize: '12px',
        color: 'var(--vscode-tab-inactiveForeground, #969696)',
        maxWidth: '150px',
      },
      {
        id: `tab-${id}`,
      }
    );

    const tabLabel = DOMUtils.createElement(
      'span',
      {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: '1',
      },
      {
        textContent: name,
      }
    );

    tab.appendChild(tabLabel);
    tabsContainer.appendChild(tab);

    console.log('✅ [MANAGER] Added tab for terminal:', id, name);
    this.headerManager.updateTerminalCountBadge();
  }

  /**
   * 設定パネルを開く
   */
  public openSettingsPanel(): void {
    // 現在の設定を取得してパネルを表示
    vscode.postMessage({ command: TERMINAL_CONSTANTS.COMMANDS.GET_SETTINGS });
  }

  /**
   * 設定取得の処理
   */
  private handleGetSettings(): void {
    // 拡張機能に設定要求
    vscode.postMessage({ command: TERMINAL_CONSTANTS.COMMANDS.GET_SETTINGS });
  }

  /**
   * 設定レスポンスの処理
   */
  private handleSettingsResponse(message: SettingsMessage): void {
    if (message.settings) {
      this.settingsPanel.show(message.settings);
    }
  }

  /**
   * 設定変更の処理
   */
  private handleSettingsChange(settings: TerminalSettings): void {
    // 拡張機能に設定更新を送信
    vscode.postMessage({
      command: TERMINAL_CONSTANTS.COMMANDS.UPDATE_SETTINGS,
      settings,
    });

    // ターミナルに即座に適用
    this.applySettingsToTerminal(settings);
    this.updateStatus('Settings updated successfully', 'success');
  }

  /**
   * ターミナルに設定を適用
   */
  private applySettingsToTerminal(settings: TerminalSettings): void {
    if (!this.terminal) return;

    try {
      const theme = ThemeUtils.getThemeColors(settings.theme as 'auto' | 'dark' | 'light');

      this.terminal.options.fontSize = settings.fontSize;
      this.terminal.options.fontFamily = settings.fontFamily;
      this.terminal.options.cursorBlink = settings.cursorBlink;
      this.terminal.options.theme = theme;

      this.terminal.refresh(0, this.terminal.rows - 1);
      this.fitAddon?.fit();
    } catch (error) {
      ErrorHandler.getInstance().handleSettingsError(error as Error, 'applySettingsToTerminal');
    }
  }

  /**
   * ステータス更新のヘルパー
   */
  private updateStatus(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.statusManager.showStatus(message, type);
  }

  /**
   * クリーンアップ
   */
  public dispose(): void {
    this.statusManager.dispose();
    this.headerManager.dispose();
    this.settingsPanel.dispose();

    if (this.terminal) {
      this.terminal.dispose();
    }
  }
}

// グローバルインスタンス
const terminalManager = new TerminalWebviewManager();

/**
 * Ready メッセージ送信
 */
function sendReadyMessage(): void {
  console.log('🎯 [MAIN] Sending READY message to extension');
  try {
    vscode.postMessage({ command: TERMINAL_CONSTANTS.COMMANDS.READY });
    console.log('✅ [MAIN] READY message sent successfully');
  } catch (error) {
    console.error('❌ [MAIN] Failed to send READY message:', error);
  }
}

/**
 * アプリケーション初期化
 */
function initializeApp(): void {
  try {
    console.log('🚀 [MAIN] Starting terminal webview application');

    terminalManager.initialize();

    console.log('✅ [MAIN] Application initialized successfully');
  } catch (error) {
    console.error('❌ [MAIN] Failed to initialize application:', error);
    ErrorHandler.getInstance().handleGenericError(error as Error, 'initializeApp');
  }
}

/**
 * DOM読み込み完了時の処理
 */
if (document.readyState === 'loading') {
  console.log('🎯 [MAIN] DOM is loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 [MAIN] DOMContentLoaded event fired');
    initializeApp();
    sendReadyMessage();
  });
} else {
  console.log('🎯 [MAIN] DOM is already ready');
  initializeApp();
  sendReadyMessage();
}

// エラーハンドリング
window.addEventListener('error', (event) => {
  ErrorHandler.getInstance().handleGenericError(
    new Error(event.message),
    `Global error at ${event.filename}:${event.lineno}`
  );
});

window.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.getInstance().handleGenericError(
    new Error(String(event.reason)),
    'Unhandled promise rejection'
  );
});
