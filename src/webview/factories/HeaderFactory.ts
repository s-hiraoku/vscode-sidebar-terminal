/**
 * HeaderFactory - 統一されたターミナルヘッダー構造の作成
 * UIManagerとDOMManagerの構造不整合を解決
 */

import { DOMUtils } from '../utils/DOMUtils';
import { webview as log } from '../../utils/logger';

export interface TerminalHeaderElements {
  container: HTMLElement;
  titleSection: HTMLElement;
  nameSpan: HTMLElement;
  idSpan: HTMLElement;
  statusSection: HTMLElement;
  statusSpan: HTMLElement | null;
  indicator: HTMLElement | null;
  controlsSection: HTMLElement;
  aiAgentToggleButton: HTMLButtonElement | null;
  closeButton: HTMLButtonElement;
}

export interface HeaderConfig {
  terminalId: string;
  terminalName: string;
  customClasses?: string[];
}

/**
 * シンプルなヘッダー構造:
 * <div class="terminal-header">
 *   <div class="terminal-title">
 *     <span class="terminal-name">Terminal Name</span>
 *   </div>
 *   <div class="terminal-status">
 *     <!-- CLI Agent status elements inserted here -->
 *   </div>
 *   <div class="terminal-controls">
 *     <button class="terminal-control close-btn">✕</button>
 *   </div>
 * </div>
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class HeaderFactory {
  /**
   * 統一されたターミナルヘッダーを作成
   */
  public static createTerminalHeader(config: HeaderConfig): TerminalHeaderElements {
    const { terminalId, terminalName, customClasses = [] } = config;

    // メインコンテナ
    const container = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        backgroundColor: 'var(--vscode-tab-activeBackground)',
        borderBottom: '1px solid var(--vscode-tab-border)',
        fontSize: '11px',
        fontWeight: 'bold',
        color: 'var(--vscode-tab-activeForeground)',
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: '28px',
      },
      {
        'data-terminal-id': terminalId,
        className: ['terminal-header', ...customClasses].join(' '),
      }
    );

    // タイトルセクション
    const titleSection = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        flexGrow: '1',
        minWidth: '0', // flexアイテムの縮小を許可
      },
      {
        className: 'terminal-title',
      }
    );

    // ターミナル名
    const nameSpan = DOMUtils.createElement(
      'span',
      {
        flexGrow: '1',
        minWidth: '0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      {
        textContent: terminalName,
        className: 'terminal-name',
      }
    );

    // ダミーのidSpan（既存インターフェース互換性のため）
    const idSpan = DOMUtils.createElement(
      'span',
      { display: 'none' },
      { className: 'terminal-id' }
    );

    // ステータスセクション（CLI Agent用）
    const statusSection = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: '8px',
        flexShrink: '0',
      },
      {
        className: 'terminal-status',
      }
    );

    // コントロールセクション
    const controlsSection = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        marginLeft: '8px',
        flexShrink: '0',
      },
      {
        className: 'terminal-controls',
      }
    );

    // AI Agent切り替えボタン - より分かりやすいアイコンに変更
    const aiAgentToggleButton = DOMUtils.createElement(
      'button',
      {
        background: 'none',
        border: 'none',
        color: 'var(--vscode-tab-activeForeground)',
        cursor: 'pointer',
        fontSize: '12px',
        padding: '2px 4px',
        borderRadius: '2px',
        display: 'none', // Initially hidden - will be shown when AI Agent is detected
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0.7',
        transition: 'opacity 0.2s, background-color 0.2s, filter 0.2s',
        marginRight: '2px',
        width: '24px',
        height: '24px',
      },
      {
        innerHTML: '<span style="filter: brightness(1.5) saturate(1.3);">🔌</span>', // 接続を表すプラグアイコン（明るい色）
        className: 'terminal-control ai-agent-toggle-btn',
        title: 'Switch AI Agent Connection',
        'data-terminal-id': terminalId,
      }
    );

    // 閉じるボタン
    const closeButton = DOMUtils.createElement(
      'button',
      {
        background: 'none',
        border: 'none',
        color: 'var(--vscode-tab-activeForeground)',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '2px 4px',
        borderRadius: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0.7',
        transition: 'opacity 0.2s, background-color 0.2s',
      },
      {
        textContent: '✕',
        className: 'terminal-control close-btn',
        title: 'Close Terminal',
        'data-terminal-id': terminalId,
      }
    );

    // ホバーエフェクトを追加
    aiAgentToggleButton.addEventListener('mouseenter', () => {
      aiAgentToggleButton.style.opacity = '1';
      aiAgentToggleButton.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
    });

    aiAgentToggleButton.addEventListener('mouseleave', () => {
      aiAgentToggleButton.style.opacity = '0.7';
      aiAgentToggleButton.style.backgroundColor = 'transparent';
    });

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.opacity = '1';
      closeButton.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.opacity = '0.7';
      closeButton.style.backgroundColor = 'transparent';
    });

    // 要素を組み立て
    DOMUtils.appendChildren(titleSection, nameSpan);
    DOMUtils.appendChildren(controlsSection, aiAgentToggleButton, closeButton);
    DOMUtils.appendChildren(container, titleSection, statusSection, controlsSection);

    log(`🏗️ [HeaderFactory] Created unified header for terminal: ${terminalId}`);

    return {
      container,
      titleSection,
      nameSpan,
      idSpan,
      statusSection,
      statusSpan: null, // CLI Agent status要素はまだ作成されていない
      indicator: null, // CLI Agent indicator要素はまだ作成されていない
      controlsSection,
      aiAgentToggleButton,
      closeButton,
    };
  }

  /**
   * CLI Agent status要素を作成してstatusセクションに挿入
   */
  public static insertCliAgentStatus(
    elements: TerminalHeaderElements,
    status: 'connected' | 'disconnected',
    agentType: string | null = null
  ): void {
    // 既存のstatus要素を削除
    HeaderFactory.removeCliAgentStatus(elements);

    // 🚨 UNIFIED STATUS: Always use "AI Agent" to prevent flickering
    // User requested: "ステータス表示を'AI Agent'で統一しチカチカを防止"
    const agentDisplayName = 'AI Agent';

    const statusText =
      status === 'connected' ? `${agentDisplayName} Connected` : `${agentDisplayName} Disconnected`;
    const isConnected = status === 'connected';

    // ステータステキスト
    const statusSpan = DOMUtils.createElement(
      'span',
      {
        fontSize: '10px',
        color: 'var(--vscode-descriptionForeground)',
      },
      {
        textContent: statusText,
        className: 'ai-agent-status', // Renamed from claude-status to ai-agent-status
      }
    );

    // インジケーター
    const indicator = DOMUtils.createElement(
      'span',
      {
        fontSize: '8px',
        lineHeight: '1',
        color: isConnected ? '#4CAF50' : '#f44747',
        animation: isConnected ? 'blink 1s infinite' : 'none',
      },
      {
        textContent: '●',
        className: 'ai-agent-indicator', // Renamed from claude-indicator to ai-agent-indicator
      }
    );

    // statusセクションに追加
    DOMUtils.appendChildren(elements.statusSection, statusSpan, indicator);

    // 参照を更新
    elements.statusSpan = statusSpan;
    elements.indicator = indicator;

    log(
      `✅ [HeaderFactory] Inserted unified AI Agent status: ${status} (type: ${agentType || 'unknown'})`
    );
  }

  /**
   * CLI Agent status要素を削除
   */
  public static removeCliAgentStatus(elements: TerminalHeaderElements): void {
    const statusElements = elements.statusSection.querySelectorAll(
      '.claude-status, .claude-indicator, .ai-agent-status, .ai-agent-indicator'
    );
    statusElements.forEach((element) => element.remove());

    // 参照をクリア
    elements.statusSpan = null;
    elements.indicator = null;

    log(`🧹 [HeaderFactory] Removed CLI Agent status elements (updated selector)`);
  }

  /**
   * CLI Agent status要素を作成（レガシーサポート用）
   */
  public static createCliAgentStatusElement(
    status: 'connected' | 'disconnected',
    agentType: string | null = null
  ): HTMLElement {
    const isConnected = status === 'connected';
    const statusContainer = document.createElement('span');
    statusContainer.className = 'claude-status-container';

    const statusText = document.createElement('span');
    statusText.className = 'claude-status';
    // Agent type based display text
    const agentDisplayName = agentType
      ? agentType === 'claude'
        ? 'CLAUDE CLI'
        : 'GEMINI CLI'
      : 'CLI Agent';

    statusText.textContent = isConnected
      ? `${agentDisplayName} Active`
      : `${agentDisplayName} Inactive`;
    statusText.style.fontSize = '11px';
    statusText.style.color = isConnected ? '#007ACC' : '#666';
    statusText.style.fontWeight = 'bold';
    statusText.style.marginLeft = '10px';

    statusContainer.appendChild(statusText);
    return statusContainer;
  }

  /**
   * ヘッダーの名前を更新
   */
  public static updateTerminalName(elements: TerminalHeaderElements, newName: string): void {
    elements.nameSpan.textContent = newName;
    log(`🔄 [HeaderFactory] Updated terminal name: ${newName}`);
  }

  /**
   * ヘッダーのアクティブ状態を設定
   */
  public static setActiveState(elements: TerminalHeaderElements, isActive: boolean): void {
    const header = elements.container;
    if (isActive) {
      header.style.backgroundColor = 'var(--vscode-tab-activeBackground)';
      header.style.color = 'var(--vscode-tab-activeForeground)';
    } else {
      header.style.backgroundColor = 'var(--vscode-tab-inactiveBackground)';
      header.style.color = 'var(--vscode-tab-inactiveForeground)';
    }
    log(`🎯 [HeaderFactory] Set active state: ${isActive}`);
  }

  /**
   * AI Agent切り替えボタンの表示状態を制御
   * Issue #122: AI Agent detected時にのみボタンを表示
   */
  public static setAiAgentToggleButtonVisibility(
    elements: TerminalHeaderElements,
    visible: boolean,
    agentStatus?: 'connected' | 'disconnected'
  ): void {
    if (elements.aiAgentToggleButton) {
      elements.aiAgentToggleButton.style.display = visible ? 'flex' : 'none';

      // Update tooltip based on connection status
      if (visible && agentStatus) {
        const isConnected = agentStatus === 'connected';
        elements.aiAgentToggleButton.title = isConnected
          ? 'AI Agent Connected (click ignored)'
          : 'Connect AI Agent';
      }

      log(
        `🔄 [HeaderFactory] AI Agent toggle button visibility: ${visible} (status: ${agentStatus || 'none'})`
      );
    }
  }
}
