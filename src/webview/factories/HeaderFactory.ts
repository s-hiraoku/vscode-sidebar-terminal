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
  processingIndicator: HTMLElement | null;
  statusSection: HTMLElement;
  statusSpan: HTMLElement | null;
  indicator: HTMLElement | null;
  controlsSection: HTMLElement;
  aiAgentToggleButton: HTMLButtonElement | null;
  closeButton: HTMLButtonElement;
  splitButton?: HTMLButtonElement | null;
}

export interface HeaderConfig {
  terminalId: string;
  terminalName: string;
  customClasses?: string[];
  showSplitButton?: boolean;
  onRenameSubmit?: (terminalId: string, newName: string) => void;
  onHeaderUpdate?: (
    terminalId: string,
    updates: { newName?: string; indicatorColor?: string }
  ) => void;
  onHeaderClick?: (terminalId: string) => void;
  onCloseClick?: (terminalId: string) => void;
  onSplitClick?: (terminalId: string) => void;
  onAiAgentToggleClick?: (terminalId: string) => void;
  indicatorColor?: string;
  // Theme colors (optional - defaults to VS Code CSS variables)
  backgroundColor?: string;
  foregroundColor?: string;
}

export const HEADER_INDICATOR_COLOR_PALETTE = [
  '#FF0000',
  '#FF7F00',
  '#FFFF00',
  '#00FF00',
  '#00FFFF',
  '#0000FF',
  '#8B00FF',
  '#FF00FF',
  '#FF69B4',
  '#008080',
  '#4B0082',
  '#FFD700',
  '#00BFA6',
  '#FFFFFF',
] as const;

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

    // Use provided colors or fall back to VS Code CSS variables
    const bgColor = config.backgroundColor || 'var(--vscode-tab-activeBackground)';
    const fgColor = config.foregroundColor || 'var(--vscode-tab-activeForeground)';
    const indicatorColor = config.indicatorColor || '#00FFFF';

    // メインコンテナ
    const container = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: bgColor,
        borderBottom: '1px solid var(--vscode-tab-border)',
        fontSize: '11px',
        fontWeight: 'bold',
        color: fgColor,
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: '32px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      },
      {
        'data-terminal-id': terminalId,
        className: ['terminal-header', ...customClasses].join(' '),
      }
    );
    container.style.setProperty('--terminal-indicator-color', indicatorColor);

    HeaderFactory.ensureProcessingIndicatorStyles();

    const processingIndicator = DOMUtils.createElement(
      'div',
      {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        height: '2px',
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.12s ease',
      },
      {
        className: 'terminal-processing-indicator',
      }
    );

    const processingIndicatorFlow = DOMUtils.createElement(
      'div',
      {
        width: '42%',
        height: '100%',
        background:
          'linear-gradient(90deg, transparent 0%, var(--terminal-indicator-color) 22%, var(--terminal-indicator-color) 78%, transparent 100%)',
        transform: 'translateX(-130%)',
        animation: 'terminal-processing-flow 1.1s linear infinite',
      },
      {
        className: 'terminal-processing-indicator-flow',
      }
    );
    processingIndicator.appendChild(processingIndicatorFlow);

    // タイトルセクション
    const titleSection = DOMUtils.createElement(
      'div',
      {
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 auto',
        minWidth: '60px', // 最小幅を確保してテキストの省略を防ぐ
        maxWidth: '100%',
        overflow: 'hidden',
      },
      {
        className: 'terminal-title',
      }
    );

    // ターミナル名
    const nameSpan = DOMUtils.createElement(
      'span',
      {
        flex: '1 1 auto',
        minWidth: '0',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: fgColor,
      },
      {
        textContent: terminalName,
        className: 'terminal-name',
        title: terminalName,
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
        flex: '0 1 auto',
        minWidth: '0',
        maxWidth: '200px',
        overflow: 'hidden',
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
        gap: '4px',
        marginLeft: '8px',
        flex: '0 0 auto',
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
        color: fgColor,
        cursor: 'pointer',
        fontSize: '13px',
        padding: '4px',
        borderRadius: '3px',
        display: 'flex', // Always visible - changed from 'none' to support constant visibility
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0.7',
        transition: 'opacity 0.2s, background-color 0.2s, filter 0.2s',
        width: '24px',
        height: '24px',
        minWidth: '24px',
        minHeight: '24px',
        boxSizing: 'border-box',
      },
      {
        textContent: '📎', // AI Agentを表すクリップアイコン
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
        color: fgColor,
        cursor: 'pointer',
        fontSize: '14px',
        padding: '4px',
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: '0.7',
        transition: 'opacity 0.2s, background-color 0.2s',
        width: '24px',
        height: '24px',
        minWidth: '24px',
        minHeight: '24px',
        boxSizing: 'border-box',
      },
      {
        textContent: '✕',
        className: 'terminal-control close-btn',
        title: 'Close Terminal',
        'data-terminal-id': terminalId,
      }
    );

    // 分割ボタン (Split button)
    let splitButton: HTMLButtonElement | null = null;
    if (config.showSplitButton) {
      splitButton = DOMUtils.createElement(
        'button',
        {
          background: 'none',
          border: 'none',
          color: fgColor,
          cursor: 'pointer',
          fontSize: '14px',
          padding: '4px',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: '0.7',
          transition: 'opacity 0.2s, background-color 0.2s',
          width: '24px',
          height: '24px',
          minWidth: '24px',
          minHeight: '24px',
          boxSizing: 'border-box',
        },
        {
          textContent: '⊞',
          className: 'terminal-control split-btn',
          title: 'Split Terminal',
          'data-terminal-id': terminalId,
        }
      );
    }

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

    // Split button hover effects
    if (splitButton) {
      splitButton.addEventListener('mouseenter', () => {
        splitButton!.style.opacity = '1';
        splitButton!.style.backgroundColor = 'var(--vscode-toolbar-hoverBackground)';
      });

      splitButton.addEventListener('mouseleave', () => {
        splitButton!.style.opacity = '0.7';
        splitButton!.style.backgroundColor = 'transparent';
      });
    }

    // Add AI Agent toggle button click handler
    if (config.onAiAgentToggleClick) {
      aiAgentToggleButton.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation(); // Prevent header click event
        config.onAiAgentToggleClick!(terminalId);
        log(`📎 [HeaderFactory] AI Agent toggle button clicked for terminal: ${terminalId}`);
      });
    }

    // Add close button click handler with double-click protection
    if (config.onCloseClick) {
      let isClosing = false;
      closeButton.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation(); // Prevent header click event
        event.preventDefault();

        // 🔧 FIX: Prevent double-click from triggering multiple deletions
        if (isClosing) {
          log(`🗑️ [HeaderFactory] Close already in progress, ignoring: ${terminalId}`);
          return;
        }
        isClosing = true;

        log(`🗑️ [HeaderFactory] Close button clicked for terminal: ${terminalId}`);
        config.onCloseClick!(terminalId);

        // Reset after a short delay to allow re-click if needed
        setTimeout(() => {
          isClosing = false;
        }, 500);
      });
    }

    // Add split button click handler
    if (splitButton && config.onSplitClick) {
      splitButton.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation(); // Prevent header click event
        config.onSplitClick!(terminalId);
        log(`⊞ [HeaderFactory] Split button clicked for terminal: ${terminalId}`);
      });
    }

    // Add header click handler for terminal activation
    if (config.onHeaderClick) {
      container.addEventListener('click', (event: MouseEvent) => {
        // Prevent click if clicking on controls, rename input, or second click of double-click.
        // Keep single-click activation behavior intact.
        const target = event.target as HTMLElement;
        if (target.closest('.terminal-control')) {
          return;
        }
        if (target.closest('.terminal-name-edit-input')) {
          return;
        }
        if (target.closest('.terminal-header-editor')) {
          return;
        }
        if (event.detail >= 2) {
          return;
        }

        config.onHeaderClick!(terminalId);
        log(`🎯 [HeaderFactory] Header clicked, activating terminal: ${terminalId}`);
      });

      // Add visual feedback for clickable header
      container.style.cursor = 'pointer';
    }

    if (config.onRenameSubmit || config.onHeaderUpdate) {
      HeaderFactory.setupHeaderEditor({
        terminalId,
        container,
        titleSection,
        nameSpan,
        initialIndicatorColor: indicatorColor,
        onRenameSubmit: config.onRenameSubmit,
        onHeaderUpdate: config.onHeaderUpdate,
      });
    }

    // 要素を組み立て
    DOMUtils.appendChildren(titleSection, nameSpan);

    // Add buttons to controls section (splitButton before closeButton)
    if (splitButton) {
      DOMUtils.appendChildren(controlsSection, aiAgentToggleButton, splitButton, closeButton);
    } else {
      DOMUtils.appendChildren(controlsSection, aiAgentToggleButton, closeButton);
    }

    DOMUtils.appendChildren(container, processingIndicator, titleSection, statusSection, controlsSection);

    log(`🏗️ [HeaderFactory] Created unified header for terminal: ${terminalId}`);

    return {
      container,
      titleSection,
      nameSpan,
      idSpan,
      processingIndicator,
      statusSection,
      statusSpan: null, // CLI Agent status要素はまだ作成されていない
      indicator: null, // CLI Agent indicator要素はまだ作成されていない
      controlsSection,
      aiAgentToggleButton,
      closeButton,
      splitButton,
    };
  }

  private static setupHeaderEditor(params: {
    terminalId: string;
    container: HTMLElement;
    titleSection: HTMLElement;
    nameSpan: HTMLElement;
    initialIndicatorColor: string;
    onRenameSubmit?: (terminalId: string, newName: string) => void;
    onHeaderUpdate?: (
      terminalId: string,
      updates: { newName?: string; indicatorColor?: string }
    ) => void;
  }): void {
    const { terminalId, container, titleSection, nameSpan, onRenameSubmit, onHeaderUpdate } = params;
    let isEditing = false;
    let currentIndicatorColor = params.initialIndicatorColor;

    const openEditor = (event: MouseEvent): void => {
      const target = event.target as HTMLElement;
      if (target.closest('.terminal-control')) {
        return;
      }
      if (target.closest('.terminal-header-color-option')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isEditing) {
        return;
      }
      isEditing = true;

      const originalName = nameSpan.textContent?.trim() || '';

      const editor = document.createElement('div');
      editor.className = 'terminal-header-editor';
      editor.style.display = 'flex';
      editor.style.flexDirection = 'column';
      editor.style.gap = '6px';
      editor.style.width = '100%';
      editor.style.minWidth = '0';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'terminal-name-edit-input';
      input.value = originalName;
      input.title = originalName;
      input.style.background = 'var(--vscode-input-background)';
      input.style.color = 'var(--vscode-input-foreground)';
      input.style.border = '1px solid var(--vscode-input-border)';
      input.style.borderRadius = '3px';
      input.style.padding = '2px 6px';
      input.style.fontSize = '11px';
      input.style.lineHeight = '1.4';
      input.style.width = '100%';
      input.style.minWidth = '0';
      input.style.boxSizing = 'border-box';
      input.style.userSelect = 'text';

      const palette = document.createElement('div');
      palette.className = 'terminal-header-color-palette';
      palette.style.display = 'flex';
      palette.style.flexWrap = 'wrap';
      palette.style.gap = '4px';

      const refreshSelection = (): void => {
        const options = palette.querySelectorAll<HTMLButtonElement>('.terminal-header-color-option');
        options.forEach((option) => {
          const isSelected = option.dataset.indicatorColor === currentIndicatorColor;
          option.style.outline = isSelected ? '1px solid var(--vscode-focusBorder)' : '1px solid transparent';
          option.style.opacity = isSelected ? '1' : '0.78';
        });
      };

      HEADER_INDICATOR_COLOR_PALETTE.forEach((color) => {
        const colorButton = document.createElement('button');
        colorButton.type = 'button';
        colorButton.className = 'terminal-header-color-option';
        colorButton.dataset.indicatorColor = color;
        colorButton.title = color;
        colorButton.style.width = '14px';
        colorButton.style.height = '14px';
        colorButton.style.borderRadius = '50%';
        colorButton.style.border = '1px solid rgba(127, 127, 127, 0.6)';
        colorButton.style.padding = '0';
        colorButton.style.cursor = 'pointer';
        colorButton.style.backgroundColor = color;
        colorButton.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        colorButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          currentIndicatorColor = color;
          container.style.setProperty('--terminal-indicator-color', color);
          refreshSelection();
          onHeaderUpdate?.(terminalId, { indicatorColor: color });
          log(`🎨 [HeaderFactory] Indicator color updated: ${terminalId} -> ${color}`);
        });
        palette.appendChild(colorButton);
      });
      refreshSelection();

      const finalizeRename = (commit: boolean): void => {
        if (!isEditing) {
          return;
        }
        isEditing = false;

        const nextName = input.value.trim();
        const shouldCommit = commit && nextName.length > 0 && nextName !== originalName;

        if (editor.parentElement === titleSection) {
          titleSection.replaceChild(nameSpan, editor);
        } else if (!nameSpan.parentElement) {
          titleSection.appendChild(nameSpan);
        }

        if (shouldCommit) {
          nameSpan.textContent = nextName;
          nameSpan.setAttribute('title', nextName);
          onRenameSubmit?.(terminalId, nextName);
          onHeaderUpdate?.(terminalId, { newName: nextName });
          log(`✏️ [HeaderFactory] Terminal renamed via header: ${terminalId} -> ${nextName}`);
        } else {
          nameSpan.textContent = originalName;
          nameSpan.setAttribute('title', originalName);
        }
      };

      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('dblclick', (e) => e.stopPropagation());
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          finalizeRename(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finalizeRename(false);
        }
      });
      input.addEventListener('blur', () => finalizeRename(true));

      editor.appendChild(input);
      editor.appendChild(palette);

      if (nameSpan.parentElement === titleSection) {
        titleSection.replaceChild(editor, nameSpan);
      } else {
        titleSection.appendChild(editor);
      }

      input.focus();
      input.select();
      // Header single-click activation can enqueue terminal focus.
      // Re-assert focus on the rename input so double-click rename remains usable.
      window.setTimeout(() => {
        if (!isEditing) {
          return;
        }
        if (document.activeElement !== input) {
          input.focus();
          input.select();
        }
      }, 24);
    };

    nameSpan.addEventListener('dblclick', openEditor);
    container.addEventListener('dblclick', openEditor);
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
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
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
        flexShrink: '0',
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
        : agentType === 'gemini'
          ? 'GEMINI CLI'
          : agentType === 'codex'
            ? 'CODEX CLI'
            : 'CLI Agent'
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
    elements.nameSpan.setAttribute('title', newName);
    log(`🔄 [HeaderFactory] Updated terminal name: ${newName}`);
  }

  public static setIndicatorColor(elements: TerminalHeaderElements, color: string): void {
    elements.container.style.setProperty('--terminal-indicator-color', color);
    log(`🎨 [HeaderFactory] Updated indicator color: ${color}`);
  }

  public static setProcessingIndicatorActive(
    elements: TerminalHeaderElements,
    isActive: boolean
  ): void {
    if (!elements.processingIndicator) {
      return;
    }
    elements.processingIndicator.style.opacity = isActive ? '1' : '0';
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

  private static ensureProcessingIndicatorStyles(): void {
    if (document.getElementById('terminal-processing-indicator-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'terminal-processing-indicator-style';
    style.textContent = `
      @keyframes terminal-processing-flow {
        0% { transform: translateX(-130%); }
        100% { transform: translateX(250%); }
      }
    `;
    document.head.appendChild(style);
  }
}
