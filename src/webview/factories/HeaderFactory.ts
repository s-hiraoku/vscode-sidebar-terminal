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
  splitButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
}

export interface HeaderConfig {
  terminalId: string;
  terminalName: string;
  showId?: boolean;
  showSplitButton?: boolean;
  customClasses?: string[];
}

/**
 * 統一されたヘッダー構造:
 * <div class="terminal-header">
 *   <div class="terminal-title">
 *     <span class="terminal-icon">⚡</span>
 *     <span class="terminal-name">Terminal Name</span>
 *     <span class="terminal-id">(terminalId)</span>
 *   </div>
 *   <div class="terminal-status">
 *     <!-- CLI Agent status elements inserted here -->
 *   </div>
 *   <div class="terminal-controls">
 *     <button class="terminal-control split-btn">⊞</button>
 *     <button class="terminal-control close-btn">✕</button>
 *   </div>
 * </div>
 */
export class HeaderFactory {
  
  /**
   * 統一されたターミナルヘッダーを作成
   */
  public static createTerminalHeader(config: HeaderConfig): TerminalHeaderElements {
    const { terminalId, terminalName, showId = true, showSplitButton = true, customClasses = [] } = config;
    
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
        gap: '4px',
        flexGrow: '1',
        minWidth: '0', // flexアイテムの縮小を許可
      },
      {
        className: 'terminal-title',
      }
    );

    // アイコン
    const iconSpan = DOMUtils.createElement(
      'span',
      {
        fontSize: '12px',
        flexShrink: '0',
      },
      {
        textContent: '⚡',
        className: 'terminal-icon',
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

    // ターミナルID
    const idSpan = DOMUtils.createElement(
      'span',
      {
        fontSize: '9px',
        opacity: '0.7',
        flexShrink: '0',
        display: showId ? 'inline' : 'none',
      },
      {
        textContent: `(${terminalId})`,
        className: 'terminal-id',
      }
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

    // 分割ボタン
    const splitButton = DOMUtils.createElement(
      'button',
      {
        background: 'none',
        border: 'none',
        color: 'var(--vscode-tab-activeForeground)',
        cursor: 'pointer',
        fontSize: '11px',
        padding: '2px 4px',
        borderRadius: '2px',
        display: showSplitButton ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0.7',
        transition: 'opacity 0.2s, background-color 0.2s',
      },
      {
        textContent: '⊞',
        className: 'terminal-control split-btn',
        title: 'Split Terminal',
        'data-terminal-id': terminalId,
      }
    ) as HTMLButtonElement;

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
    ) as HTMLButtonElement;

    // ホバーエフェクトを追加
    [splitButton, closeButton].forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.opacity = '1';
        button.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.opacity = '0.7';
        button.style.backgroundColor = 'transparent';
      });
    });

    // 要素を組み立て
    DOMUtils.appendChildren(titleSection, iconSpan, nameSpan, idSpan);
    DOMUtils.appendChildren(controlsSection, splitButton, closeButton);
    DOMUtils.appendChildren(container, titleSection, statusSection, controlsSection);

    log(`🏗️ [HeaderFactory] Created unified header for terminal: ${terminalId}`);

    return {
      container,
      titleSection,
      nameSpan,
      idSpan,
      statusSection,
      statusSpan: null, // CLI Agent status要素はまだ作成されていない
      indicator: null,   // CLI Agent indicator要素はまだ作成されていない
      controlsSection,
      splitButton,
      closeButton,
    };
  }

  /**
   * CLI Agent status要素を作成してstatusセクションに挿入
   */
  public static insertCliAgentStatus(
    elements: TerminalHeaderElements,
    status: 'connected' | 'disconnected'
  ): void {
    // 既存のstatus要素を削除
    HeaderFactory.removeCliAgentStatus(elements);

    const statusText = status === 'connected' ? 'CLI Agent Code connected' : 'CLI Agent Code disconnected';
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
        className: 'claude-status',
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
        className: 'claude-indicator',
      }
    );

    // statusセクションに追加
    DOMUtils.appendChildren(elements.statusSection, statusSpan, indicator);

    // 参照を更新
    elements.statusSpan = statusSpan;
    elements.indicator = indicator;

    log(`✅ [HeaderFactory] Inserted CLI Agent status: ${status}`);
  }

  /**
   * CLI Agent status要素を削除
   */
  public static removeCliAgentStatus(elements: TerminalHeaderElements): void {
    const statusElements = elements.statusSection.querySelectorAll('.claude-status, .claude-indicator');
    statusElements.forEach(element => element.remove());
    
    // 参照をクリア
    elements.statusSpan = null;
    elements.indicator = null;

    log(`🧹 [HeaderFactory] Removed CLI Agent status elements`);
  }

  /**
   * CLI Agent status要素を作成（レガシーサポート用）
   */
  public static createCliAgentStatusElement(status: 'connected' | 'disconnected'): HTMLElement {
    const isConnected = status === 'connected';
    const statusContainer = document.createElement('span');
    statusContainer.className = 'claude-status-container';
    
    const statusText = document.createElement('span');
    statusText.className = 'claude-status';
    statusText.textContent = isConnected ? 'CLI Agent Active' : 'CLI Agent Inactive';
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
}