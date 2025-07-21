/**
 * リファクタリング後のWebViewメインエントリーポイント
 */

// CRITICAL: Add immediate diagnostic logging
console.log('🚀 [WEBVIEW-SCRIPT] ========== WEBVIEW.JS SCRIPT STARTED ==========');
console.log('🚀 [WEBVIEW-SCRIPT] Script execution time:', new Date().toISOString());
console.log('🚀 [WEBVIEW-SCRIPT] Window object exists:', typeof window !== 'undefined');
console.log('🚀 [WEBVIEW-SCRIPT] Document ready state:', document?.readyState);
console.log('🚀 [WEBVIEW-SCRIPT] VS Code API available:', typeof (window as any)?.acquireVsCodeApi);

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

// Types and constants
import type {
  WebviewMessage,
  VsCodeMessage,
  TerminalInteractionEvent,
  TerminalState,
} from '../types/common';
import { PartialTerminalSettings, WebViewFontSettings, TerminalConfig } from '../types/shared';
import { webview as log } from '../utils/logger';
import { SPLIT_CONSTANTS } from './constants/webview';
import { getWebviewTheme, WEBVIEW_THEME_CONSTANTS } from './utils/WebviewThemeUtils';
import { SplitManager } from './managers/SplitManager';
import { SettingsPanel } from './components/SettingsPanel';
import { NotificationManager } from './managers/NotificationManager';
import { ConfigManager } from './managers/ConfigManager';
import { PerformanceManager } from './managers/PerformanceManager';
import { UIManager } from './managers/UIManager';
import { InputManager } from './managers/InputManager';
import { MessageManager } from './managers/MessageManager';
import { TerminalInstance } from './interfaces/ManagerInterfaces';
import {
  showAltClickDisabledWarning as _showAltClickDisabledWarning,
  showTerminalInteractionWarning as _showTerminalInteractionWarning,
  setUIManager,
} from './utils/NotificationUtils';

// Type definitions
interface TerminalMessage extends WebviewMessage {
  terminalId?: string;
  terminalName?: string;
  data?: string;
  config?: TerminalConfig;
  activeTerminalId?: string;
  exitCode?: number;
  // settings は継承されたものを使用（PartialTerminalSettings）
}

declare const acquireVsCodeApi: () => {
  postMessage: (message: VsCodeMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

// Use the globally stored VS Code API with fallback and safety checks
let vscode: any = null;

// Function to safely get VS Code API
function getVsCodeApi() {
  console.log('🔍 [WEBVIEW] getVsCodeApi called');
  console.log('🔍 [WEBVIEW] Current vscode variable:', !!vscode);
  console.log('🔍 [WEBVIEW] window.vscodeApi available:', !!(window as any).vscodeApi);
  console.log('🔍 [WEBVIEW] window.vscodeApi type:', typeof (window as any).vscodeApi);

  if (vscode) {
    console.log('🔍 [WEBVIEW] Returning cached vscode API');
    return vscode;
  }

  // Try to get from global storage first
  if ((window as any).vscodeApi) {
    vscode = (window as any).vscodeApi;
    console.log('📱 [WEBVIEW] Using globally stored VS Code API');
    console.log('📱 [WEBVIEW] VS Code API postMessage type:', typeof vscode.postMessage);
    return vscode;
  }

  // Should not reach here, but just in case
  console.log('❌ [WEBVIEW] No VS Code API available');
  return null;
}

// Main terminal management class
class TerminalWebviewManager {
  // IManagerCoordinator interface methods
  public getActiveTerminalId(): string | null {
    return this.activeTerminalId;
  }

  public getTerminalInstance(terminalId: string): TerminalInstance | undefined {
    return this.splitManager.getTerminals().get(terminalId);
  }

  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.splitManager.getTerminals();
  }

  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.splitManager.getTerminalContainers();
  }

  public postMessageToExtension(message: unknown): void {
    const api = getVsCodeApi();
    if (api) {
      api.postMessage(message as VsCodeMessage);
    } else {
      console.log('❌ [WEBVIEW] Cannot send message: No VS Code API available');
    }
  }

  public log(message: string, ...args: unknown[]): void {
    log(message, ...args);
  }

  public getManagers(): {
    performance: PerformanceManager;
    input: InputManager;
    ui: UIManager;
    config: ConfigManager;
    message: MessageManager;
    notification: NotificationManager;
  } {
    return {
      performance: this.performanceManager,
      input: this.inputManager,
      ui: this.uiManager,
      config: this.configManager,
      message: this.messageManager,
      notification: this.notificationManager,
    };
  }
  public terminal: Terminal | null = null;
  public fitAddon: FitAddon | null = null;
  public terminalContainer: HTMLElement | null = null;
  private isComposing: boolean = false;
  public activeTerminalId: string | null = null;

  // Performance optimization: Debounce resize operations (managed by PerformanceManager)
  private resizeDebounceTimer: number | null = null;
  private readonly RESIZE_DEBOUNCE_DELAY = SPLIT_CONSTANTS.RESIZE_DEBOUNCE_DELAY;

  // Managers
  private splitManager: SplitManager;
  private settingsPanel: SettingsPanel;
  private notificationManager: NotificationManager;
  private configManager: ConfigManager;
  private performanceManager: PerformanceManager;
  private uiManager: UIManager;
  private inputManager: InputManager;
  public messageManager: MessageManager;

  // Current settings (without font settings - they come from VS Code)
  private currentSettings: PartialTerminalSettings = {
    theme: 'auto',
    cursorBlink: true,
    altClickMovesCursor: true,
    multiCursorModifier: 'alt',
  };

  // Current font settings from VS Code
  private currentFontSettings: WebViewFontSettings = {
    fontSize: 14,
    fontFamily: 'monospace',
  };

  constructor() {
    this.splitManager = new SplitManager();
    this.settingsPanel = new SettingsPanel({
      onSettingsChange: (settings) => {
        this.applySettings(settings);
      },
    });
    this.notificationManager = new NotificationManager();
    this.configManager = new ConfigManager();
    this.performanceManager = new PerformanceManager();
    this.uiManager = new UIManager();

    // NotificationUtilsにUIManagerを設定
    setUIManager(this.uiManager);
    this.inputManager = new InputManager();
    this.messageManager = new MessageManager();

    // Setup notification styles on initialization
    this.notificationManager.setupNotificationStyles();

    // Setup InputManager with NotificationManager reference
    this.inputManager.setNotificationManager(this.notificationManager);

    // Load settings from VS Code state if available
    this.loadSettings();
  }

  public initializeSimpleTerminal(): void {
    const container = document.getElementById('terminal-body');
    if (!container) {
      log('Terminal container not found');
      return;
    }

    log('🎯 [WEBVIEW] Initializing simple terminal');

    // Use the existing terminal-body container
    this.terminalContainer = container;

    // Add terminal container class for border styling
    container.className = 'terminal-container active'; // Start as active
    container.setAttribute('data-terminal-id', 'primary');

    // Style the container (let CSS classes handle borders)
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      background: #000;
      width: 100%;
      height: 100%;
      overflow: hidden;
      margin: 0;
      padding: 0;
      gap: 0;
    `;

    // Add placeholder content
    container.innerHTML = `
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
    `;

    if (this.terminalContainer) {
      log('🎯 [WEBVIEW] Simple terminal container initialized successfully');
    } else {
      log('❌ [WEBVIEW] Failed to initialize terminal container');
    }

    // Setup input handling
    this.inputManager.setupIMEHandling();
    this.inputManager.setupAltKeyVisualFeedback();
  }

  public createTerminal(id: string, name: string, _config: TerminalConfig): void {
    log('🎯 [WEBVIEW] Creating terminal:', id, name);
    // Don't set active here - it will be set after the terminal is stored

    if (!this.terminalContainer) {
      // Try to get the container again
      this.terminalContainer = document.getElementById('terminal-body');
      if (!this.terminalContainer) {
        log('❌ [WEBVIEW] No terminal container available');
        return;
      }
      log('🎯 [WEBVIEW] Terminal container found on retry');
    }

    try {
      const terminalTheme = getWebviewTheme();
      log('🎨 [WEBVIEW] Creating terminal with theme:', terminalTheme);

      // Apply current settings to new terminal
      const terminalOptions = {
        fontSize: this.currentFontSettings.fontSize,
        fontFamily: this.currentFontSettings.fontFamily,
        theme:
          this.currentSettings.theme === 'auto'
            ? terminalTheme
            : this.currentSettings.theme === 'dark'
              ? WEBVIEW_THEME_CONSTANTS.DARK_THEME
              : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME,
        cursorBlink: this.currentSettings.cursorBlink,
        allowTransparency: true,
        scrollback: 10000,
        // VS Code standard: Enable Alt+Click cursor positioning
        altClickMovesCursor: this.inputManager.isVSCodeAltClickEnabled(this.currentSettings),
      };

      const terminal = new Terminal(terminalOptions);

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      // Clear placeholder
      const placeholder = document.getElementById('terminal-placeholder');
      if (placeholder) {
        placeholder.remove();
      }

      // Create terminal container div - unified logic for all terminals
      const terminalDiv = document.createElement('div');
      terminalDiv.setAttribute('data-terminal-container', 'terminal');
      terminalDiv.setAttribute('data-terminal-id', id);
      terminalDiv.id = `terminal-container-${id}`;
      terminalDiv.className = 'terminal-container';
      terminalDiv.tabIndex = -1; // Make focusable

      // Create terminal header using UIManager and HeaderFactory
      const terminalHeader = this.uiManager.createTerminalHeader(
        id,
        name || `Terminal ${id.slice(-4)}`
      );

      // Setup delete button event handler (HeaderFactory already created the button)
      const deleteButton = terminalHeader.querySelector('.close-btn') as HTMLButtonElement;

      // HeaderFactory already handles hover effects for the button

      // Setup delete button click handler
      if (deleteButton) {
        deleteButton.addEventListener(
          'click',
          (event) => {
            event.stopPropagation();
            try {
              // ヘッダの×ボタン用 - 指定されたターミナルを直接削除
              log(`🗑️ [HEADER] Deleting specific terminal: ${id}`);

              // 新しいアーキテクチャ: 統一された削除要求を送信（WebViewは判定しない）
              this.messageManager.sendDeleteTerminalMessage(id, 'header', this);
              log(`🗑️ [HEADER] Delete message sent to extension for: ${id}`);
            } catch (error) {
              log(`🗑️ [HEADER] Error sending delete message:`, error);
            }
          },
          true
        ); // Use capture phase
      }

      // Setup split button click handler
      const splitButton = terminalHeader.querySelector('.split-btn') as HTMLButtonElement;
      if (splitButton) {
        splitButton.addEventListener('click', (event) => {
          event.stopPropagation();
          try {
            log(`🔀 [HEADER] Split button clicked for terminal: ${id}`);
            // TODO: Implement split functionality using correct message method
            log(`🔀 [HEADER] Split functionality temporarily disabled`);
          } catch (error) {
            log(`❌ [HEADER] Error handling split button click:`, error);
          }
        });
      }

      // HeaderFactory already assembled the complete header structure

      // Create terminal content area
      const terminalContent = document.createElement('div');
      terminalContent.className = 'terminal-content';
      terminalContent.style.cssText = `
        flex: 1;
        overflow: hidden;
      `;

      terminalDiv.appendChild(terminalHeader);
      terminalDiv.appendChild(terminalContent);

      // Set split mode if this is the second terminal
      if (this.splitManager.getTerminals().size >= 1 && !this.splitManager.getIsSplitMode()) {
        this.splitManager.prepareSplitMode('vertical');
      }

      // Add to DOM first
      this.terminalContainer.appendChild(terminalDiv);

      // Register the container with split manager
      this.splitManager.getTerminalContainers().set(id, terminalDiv);

      // Apply flex-based styling to the new terminal (let CSS classes handle borders)
      terminalDiv.style.cssText = `
        width: 100%; 
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        margin: 0;
        padding: 2px;
        min-height: 100px;
        outline: none;
      `;
      log(`📐 [MAIN] Applied flex layout for terminal ${id}`);

      // CRITICAL: Apply flex layout to ALL terminals IMMEDIATELY (before terminal.open)
      log(
        `📐 [MAIN] Applying flex layout to all ${this.splitManager.getTerminalContainers().size} terminals IMMEDIATELY`
      );

      this.splitManager.getTerminalContainers().forEach((container, terminalId) => {
        // Update only necessary styles, don't override border styles
        container.style.width = '100%';
        container.style.flex = '1';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.overflow = 'hidden';
        container.style.margin = '0';
        container.style.padding = '2px';
        container.style.minHeight = '100px';
        container.style.outline = 'none';

        log(`📐 [MAIN] Applied flex layout to terminal ${terminalId}`);

        // Add click event if not already added
        if (!container.hasAttribute('data-click-handler')) {
          container.setAttribute('data-click-handler', 'true');
          container.addEventListener('click', () => {
            log(
              `🖱️ [CLICK] Terminal clicked: ${terminalId}, current active: ${this.activeTerminalId}`
            );

            // Always ensure the clicked terminal gets focus, even if it's already active
            this.ensureTerminalFocus(terminalId);

            // Switch terminals if different terminal is clicked
            if (this.activeTerminalId !== terminalId) {
              this.switchToTerminal(terminalId);
            }
          });
        }
      });

      // Force layout recalculation BEFORE opening terminal
      this.splitManager.getTerminalContainers().forEach((container) => {
        container.offsetHeight; // Force reflow
      });
      log(
        `📐 [MAIN] Forced layout recalculation for all ${this.splitManager.getTerminalContainers().size} containers`
      );

      const targetContainer = terminalContent;

      // Open terminal AFTER flex layout is applied
      setTimeout(() => {
        try {
          log(`🎨 [MAIN] Opening terminal ${id} after flex layout applied`);
          terminal.open(targetContainer);

          // Wait longer for DOM and flex layout to fully stabilize before fitting
          setTimeout(() => {
            // Force layout recalculation before fit
            targetContainer.offsetHeight; // Trigger reflow

            const terminalBody = document.getElementById('terminal-body');
            const terminalMain = document.getElementById('terminal');

            log(`🔧 [MAIN] Hierarchy sizes before fit:`, {
              terminal: terminalMain
                ? { w: terminalMain.offsetWidth, h: terminalMain.offsetHeight }
                : 'not found',
              terminalBody: terminalBody
                ? { w: terminalBody.offsetWidth, h: terminalBody.offsetHeight }
                : 'not found',
              targetContainer: { w: targetContainer.offsetWidth, h: targetContainer.offsetHeight },
              containerStyle: targetContainer.style.cssText,
              terminalCount: this.splitManager.getTerminalContainers().size,
            });

            fitAddon.fit();
            terminal.refresh(0, terminal.rows - 1);
            terminal.focus();

            // Add click event to xterm.js terminal area for reliable focus handling
            this.inputManager.addXtermClickHandler(terminal, id, targetContainer, this);

            // Only set as main terminal if it's the first one or not in split mode
            if (!this.splitManager.getIsSplitMode() || !this.terminal) {
              this.terminal = terminal;
              this.fitAddon = fitAddon;
            }

            // Switch to the newly created terminal
            this.switchToTerminal(id);

            // Re-fit ALL terminals to ensure consistent sizing
            setTimeout(() => {
              log(`🔧 [MAIN] Re-fitting ALL terminals for consistency`);
              this.splitManager.getTerminals().forEach((terminalData, terminalId) => {
                if (terminalData.fitAddon) {
                  const container = this.splitManager.getTerminalContainers().get(terminalId);
                  if (container) {
                    container.offsetHeight; // Force reflow
                    terminalData.fitAddon.fit();
                    log(
                      `🔧 [MAIN] Re-fitted terminal ${terminalId}, size: ${container.offsetWidth}x${container.offsetHeight}`
                    );
                  }
                }
              });
            }, 200);
          }, 500); // Increased delay for flex layout stabilization
        } catch (openError) {
          log('❌ [WEBVIEW] Error opening terminal:', openError);
        }
      }, 100);

      // Handle terminal input with IME support
      terminal.onData((data) => {
        // Don't block IME input - let xterm.js handle it naturally
        log('🌐 [INPUT] Terminal data received:', {
          data: data,
          length: data.length,
          isComposing: this.isComposing,
          charCodes: Array.from(data).map((c) => c.charCodeAt(0)),
        });

        const api = getVsCodeApi();
        if (api) {
          api.postMessage({
            command: 'input' as const,
            data,
            terminalId: this.activeTerminalId || id,
          });
        }
      });

      // Handle terminal focus events for border updates
      // Note: xterm.js doesn't have onFocus, we'll handle focus via DOM events
      terminalDiv.addEventListener(
        'focus',
        () => {
          log(`🔵 [FOCUS] Terminal ${id} received focus - updating borders`);
          this.setActiveTerminalId(id);
        },
        true
      );

      // Handle resize
      terminal.onResize((size) => {
        const api = getVsCodeApi();
        if (api) {
          api.postMessage({
            command: 'resize' as const,
            cols: size.cols,
            rows: size.rows,
            terminalId: id,
          });
        }
      });

      // Store terminal instance
      this.splitManager.setTerminal(id, {
        id,
        terminal,
        fitAddon,
        name,
        container: terminalDiv,
      });

      // Set this terminal as active and update borders
      this.setActiveTerminalId(id);

      // Performance optimization: Use debounced resize observer
      if (this.terminalContainer) {
        const resizeObserver = new ResizeObserver(() => {
          if (this.fitAddon && this.terminal) {
            this.debouncedResize(this.terminal.cols, this.terminal.rows);
          }
        });
        resizeObserver.observe(this.terminalContainer);
      }
    } catch (error) {
      log('❌ [WEBVIEW] Error creating terminal:', error);
    }
  }

  public switchToTerminal(id: string): void {
    log('🔄 [WEBVIEW] Switching to terminal:', id);

    this.setActiveTerminalId(id);

    // Apply consistent flex styling to all terminals (preserve CSS border classes)
    this.splitManager.getTerminalContainers().forEach((container, _terminalId) => {
      // Update only necessary styles, don't override border styles
      container.style.width = '100%';
      container.style.flex = '1';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.overflow = 'hidden';
      container.style.minHeight = '100px';
      container.style.margin = '0';
      container.style.padding = '2px';
      container.style.outline = 'none';
    });

    // Focus the active terminal and ensure proper fit
    const terminalData = this.splitManager.getTerminals().get(id);
    if (terminalData?.terminal) {
      // Apply immediate focus first
      try {
        terminalData.terminal.focus();
        log(`🎯 [SWITCH] Immediate focus applied to terminal ${id}`);
      } catch (error) {
        log(`⚠️ [SWITCH] Error applying immediate focus to terminal ${id}:`, error);
      }

      // Wait for CSS updates to be applied, then apply delayed focus and fit
      setTimeout(() => {
        const container = this.splitManager.getTerminalContainers().get(id);
        if (container) {
          // Force layout recalculation
          container.offsetHeight;

          log(`🔧 [SWITCH] Container size for terminal ${id}:`, {
            width: container.offsetWidth,
            height: container.offsetHeight,
          });
        }

        // Re-apply focus after layout changes
        try {
          terminalData.terminal.focus();
          if (terminalData.fitAddon) {
            terminalData.fitAddon.fit();
            log(`🔧 [SWITCH] Delayed focus and fit applied for terminal ${id}`);
          }
        } catch (error) {
          log(`⚠️ [SWITCH] Error applying delayed focus to terminal ${id}:`, error);
        }
      }, 50);
    }

    log('✅ [WEBVIEW] Switched to terminal:', id);
  }

  public closeTerminal(id?: string): void {
    // パネルのゴミ箱ボタン用 - アクティブターミナルを削除
    const activeTerminalId = this.activeTerminalId;
    log(
      '🗑️ [PANEL] Close terminal requested for:',
      id,
      'but will close active terminal:',
      activeTerminalId
    );

    if (!activeTerminalId) {
      log('⚠️ [PANEL] No active terminal to close');
      this.notificationManager.showTerminalKillError('No active terminal to close');
      return;
    }

    // 新しいアーキテクチャ: 統一された削除要求を送信（WebViewは判定しない）
    log('📤 [PANEL] Sending delete terminal message to extension');
    this.messageManager.sendDeleteTerminalMessage(activeTerminalId, 'panel', this);
  }

  // 削除中のターミナルを追跡（Extension側で管理されるまでの一時的な状態）
  private terminalsBeingClosed = new Set<string>();

  /**
   * 新しいアーキテクチャ: Extension からの状態更新を処理
   */
  public updateState(state: TerminalState): void {
    log('🔄 [WEBVIEW] ========== STATE UPDATE RECEIVED ==========');
    log('🔄 [WEBVIEW] New state:', state);

    if (!state || !state.terminals) {
      log('⚠️ [WEBVIEW] Invalid state received');
      return;
    }

    // 現在の状態をログ出力
    log('🔄 [WEBVIEW] Current terminals:', Array.from(this.splitManager.getTerminals().keys()));
    log('🔄 [WEBVIEW] Current active terminal:', this.activeTerminalId);

    // 新しい状態に基づいてUIを更新
    this.synchronizeWithState(state);
  }

  /**
   * 状態に基づいてUIを同期
   */
  private synchronizeWithState(state: TerminalState): void {
    log('🔄 [WEBVIEW] Synchronizing UI with state:', state);

    // 現在のターミナルリストと新しい状態を比較
    const currentTerminals = new Set(this.splitManager.getTerminals().keys());
    const newTerminals = new Set(state.terminals.map((t) => t.id));

    log('🔄 [WEBVIEW] Current terminal IDs:', Array.from(currentTerminals));
    log('🔄 [WEBVIEW] New terminal IDs:', Array.from(newTerminals));

    // 削除されたターミナルをUIから削除
    for (const terminalId of currentTerminals) {
      if (!newTerminals.has(terminalId)) {
        log(`🗑️ [WEBVIEW] Removing terminal from UI: ${terminalId}`);
        this.removeTerminalFromUI(terminalId);
      }
    }

    // 新しく追加されたターミナルをUIに追加
    for (const terminal of state.terminals) {
      if (!currentTerminals.has(terminal.id)) {
        log(`➕ [WEBVIEW] Adding terminal to UI: ${terminal.id}`);
        // 新しいターミナルは既にcreateTerminalで作成されているはず
        // ここでは特別な処理は不要
      }
    }

    // アクティブターミナルの更新
    if (state.activeTerminalId && state.activeTerminalId !== this.activeTerminalId) {
      log(
        `🎯 [WEBVIEW] Updating active terminal: ${this.activeTerminalId} -> ${state.activeTerminalId}`
      );
      this.switchToTerminal(state.activeTerminalId);
    }

    log('✅ [WEBVIEW] State synchronization completed');
  }

  /**
   * UIからターミナルを削除（状態同期用）
   */
  private removeTerminalFromUI(terminalId: string): void {
    try {
      // SplitManagerを使用してクリーンアップ
      this.splitManager.removeTerminal(terminalId);

      // UIManagerのヘッダーキャッシュもクリア
      this.uiManager.removeTerminalHeader(terminalId);

      log(`✅ [WEBVIEW] Terminal removed from UI: ${terminalId}`);
    } catch (error) {
      log(`❌ [WEBVIEW] Error removing terminal from UI:`, error);
    }
  }

  /**
   * Handle terminal removal notification from extension (UI cleanup only)
   */
  public handleTerminalRemovedFromExtension(id: string): void {
    log('🗑️ [WEBVIEW] ========== HANDLING TERMINAL REMOVAL FROM EXTENSION ==========');
    log('🗑️ [WEBVIEW] Terminal ID to remove:', id);
    log(
      '🗑️ [WEBVIEW] All terminals before removal:',
      Array.from(this.splitManager.getTerminals().keys())
    );
    log(
      '🗑️ [WEBVIEW] All containers before removal:',
      Array.from(this.splitManager.getTerminalContainers().keys())
    );

    // Remove from being closed tracking (if it exists)
    this.terminalsBeingClosed.delete(id);

    // Check if terminal exists in webview
    const terminalData = this.splitManager.getTerminals().get(id);
    const container = this.splitManager.getTerminalContainers().get(id);

    log('🗑️ [WEBVIEW] Terminal data exists:', !!terminalData);
    log('🗑️ [WEBVIEW] Container exists:', !!container);

    if (!terminalData && !container) {
      log('🔄 [WEBVIEW] Terminal already removed from webview:', id);
      return;
    }

    // UI cleanup only (no extension communication)
    // Use SplitManager's removeTerminal method for proper cleanup
    log('🗑️ [WEBVIEW] Calling SplitManager.removeTerminal for:', id);
    try {
      this.splitManager.removeTerminal(id);
      log('🗑️ [WEBVIEW] SplitManager.removeTerminal completed for:', id);
    } catch (error) {
      log('❌ [WEBVIEW] Error in SplitManager.removeTerminal:', error);
    }

    log(
      '🗑️ [WEBVIEW] All terminals after removal:',
      Array.from(this.splitManager.getTerminals().keys())
    );
    log(
      '🗑️ [WEBVIEW] All containers after removal:',
      Array.from(this.splitManager.getTerminalContainers().keys())
    );

    // Update remaining terminals layout
    const remainingTerminals = Array.from(this.splitManager.getTerminals().keys());
    log('🗑️ [WEBVIEW] Remaining terminals after extension removal:', remainingTerminals);

    // Apply flex layout to remaining terminals and trigger re-fit
    remainingTerminals.forEach((terminalId) => {
      const terminalContainer = this.splitManager.getTerminalContainers().get(terminalId);
      if (terminalContainer) {
        // Update only necessary styles, don't override border styles
        terminalContainer.style.width = '100%';
        terminalContainer.style.flex = '1';
        terminalContainer.style.display = 'flex';
        terminalContainer.style.flexDirection = 'column';
        terminalContainer.style.overflow = 'hidden';
        terminalContainer.style.minHeight = '100px';
        terminalContainer.style.margin = '0';
        terminalContainer.style.padding = '2px';
        terminalContainer.style.outline = 'none';

        // Force layout recalculation and re-fit terminal
        setTimeout(() => {
          terminalContainer.offsetHeight; // Force reflow
          const terminalInstance = this.splitManager.getTerminals().get(terminalId);
          if (terminalInstance && terminalInstance.fitAddon) {
            terminalInstance.fitAddon.fit();
            log(`🔧 [WEBVIEW] Re-fitted terminal ${terminalId} after removal`);
          }
        }, 100);
      }
    });

    // Handle active terminal change
    if (this.activeTerminalId === id) {
      if (remainingTerminals.length > 0) {
        const nextTerminalId = remainingTerminals[0];
        if (nextTerminalId) {
          this.switchToTerminal(nextTerminalId);
        }
      } else {
        this.activeTerminalId = null;
        this.uiManager.showTerminalPlaceholder();
      }
    }

    log('✅ [WEBVIEW] Terminal removal from extension handled:', id);
  }

  public writeToTerminal(data: string, terminalId?: string): void {
    // Determine which terminal to write to
    let targetTerminal = this.terminal;

    // First, try to use the specified terminal ID
    if (terminalId) {
      const terminalData = this.splitManager.getTerminals().get(terminalId);
      if (terminalData) {
        targetTerminal = terminalData.terminal;
        log(`📤 [WEBVIEW] Writing to specified terminal: ${terminalId}`);
      } else {
        log(
          `⚠️ [WEBVIEW] Specified terminal not found: ${terminalId}, falling back to active terminal`
        );
      }
    }

    // If no terminal ID specified or terminal not found, use active terminal
    if (!targetTerminal || (!terminalId && this.activeTerminalId)) {
      if (this.activeTerminalId) {
        const terminalData = this.splitManager.getTerminals().get(this.activeTerminalId);
        if (terminalData) {
          targetTerminal = terminalData.terminal;
          log(`📤 [WEBVIEW] Writing to active terminal: ${this.activeTerminalId}`);
        }
      }
    }

    if (targetTerminal) {
      // If a specific terminal ID is provided, write directly to avoid cross-terminal buffering issues
      if (terminalId) {
        targetTerminal.write(data);
        log(`📤 [WEBVIEW] Direct write to terminal ${terminalId}: ${data.length} chars`);
      } else {
        // Use PerformanceManager for buffering (active terminal only)
        this.performanceManager.scheduleOutputBuffer(data, targetTerminal);
      }
    } else {
      log('⚠️ [WEBVIEW] No terminal instance to write to');
    }
  }

  /**
   * Show notification in terminal overlay
   */
  private showNotificationInTerminal(message: string, type: 'info' | 'success' | 'warning'): void {
    const terminalBody = document.getElementById('terminal-body');
    if (!terminalBody) return;

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `claude-code-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 1000;
      max-width: 300px;
      opacity: 0.9;
      transition: opacity 0.3s ease;
      ${type === 'info' ? 'background: rgba(0, 122, 255, 0.8); color: white;' : ''}
      ${type === 'success' ? 'background: rgba(40, 167, 69, 0.8); color: white;' : ''}
      ${type === 'warning' ? 'background: rgba(255, 193, 7, 0.8); color: black;' : ''}
    `;

    // Remove existing notification
    const existingNotification = terminalBody.querySelector('.claude-code-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Add new notification
    terminalBody.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentElement) {
            notification.remove();
          }
        }, 300);
      }
    }, 3000);
  }

  /**
   * Emit terminal interaction event for logging
   */
  private emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data?: unknown
  ): void {
    const event: TerminalInteractionEvent = {
      type,
      terminalId,
      timestamp: Date.now(),
      data,
    };

    log(`📊 [INTERACTION] Event: ${type}`, event);
  }

  public debouncedResize(cols: number, rows: number): void {
    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
    }

    this.resizeDebounceTimer = window.setTimeout(() => {
      if (this.fitAddon && this.terminal) {
        this.terminal.resize(cols, rows);
        this.fitAddon.fit();
      }
      this.resizeDebounceTimer = null;
    }, this.RESIZE_DEBOUNCE_DELAY);
  }

  // Split functionality methods
  public initializeSplitControls(): void {
    log('🔀 [WEBVIEW] Split controls ready (using panel commands)');
  }

  public prepareSplitMode(direction: 'horizontal' | 'vertical'): void {
    this.splitManager.prepareSplitMode(direction);
  }

  public splitTerminal(direction: 'horizontal' | 'vertical'): void {
    this.splitManager.splitTerminal(direction);
  }

  public addNewTerminalToSplit(terminalId: string, terminalName: string): void {
    this.splitManager.addNewTerminalToSplit(terminalId, terminalName);
  }

  public setActiveTerminalId(terminalId: string): void {
    this.activeTerminalId = terminalId;
    log('🎯 [WEBVIEW] Active terminal ID set to:', terminalId);

    // Update terminal borders to highlight active terminal
    this.uiManager.updateTerminalBorders(terminalId, this.splitManager.getTerminalContainers());
  }

  // Getters for split manager integration
  public getIsSplitMode(): boolean {
    return this.splitManager.getIsSplitMode();
  }

  public getSplitManager(): SplitManager {
    return this.splitManager;
  }

  public switchToNextTerminal(): void {
    const terminalIds = Array.from(this.splitManager.getTerminals().keys());
    if (terminalIds.length <= 1) return;

    const currentIndex = terminalIds.indexOf(this.activeTerminalId || '');
    const nextIndex = (currentIndex + 1) % terminalIds.length;
    const nextTerminalId = terminalIds[nextIndex];

    if (nextTerminalId) {
      this.switchToTerminal(nextTerminalId);
    }
  }

  /**
   * Ensure the specified terminal has focus immediately
   */
  public ensureTerminalFocus(terminalId: string): void {
    log(`🎯 [FOCUS] Ensuring focus for terminal: ${terminalId}`);

    const terminalData = this.splitManager.getTerminals().get(terminalId);
    if (!terminalData?.terminal) {
      log(`⚠️ [FOCUS] Terminal not found: ${terminalId}`);
      return;
    }

    try {
      // Force focus immediately without delay
      terminalData.terminal.focus();
      log(`✅ [FOCUS] Focus applied to terminal: ${terminalId}`);

      // Also trigger fit to ensure proper rendering
      if (terminalData.fitAddon) {
        terminalData.fitAddon.fit();
        log(`📏 [FOCUS] Fit applied to terminal: ${terminalId}`);
      }
    } catch (error) {
      log(`❌ [FOCUS] Error focusing terminal ${terminalId}:`, error);
    }
  }

  public openSettings(): void {
    log('⚙️ [WEBVIEW] Opening settings panel with current settings:', this.currentSettings);
    try {
      this.settingsPanel.show(this.currentSettings);
      log('✅ [WEBVIEW] Settings panel show() called successfully');
    } catch (error) {
      log('❌ [WEBVIEW] Error opening settings panel:', error);
    }
  }

  public applySettings(settings: PartialTerminalSettings): void {
    // Update current settings
    this.currentSettings = { ...this.currentSettings, ...settings };

    // Save settings to VS Code state
    this.saveSettings();

    // Apply settings to all terminals (font settings are handled separately)
    this.splitManager.getTerminals().forEach((terminalData) => {
      if (terminalData.terminal) {
        const terminal = terminalData.terminal;
        if (settings.cursorBlink !== undefined) {
          terminal.options.cursorBlink = settings.cursorBlink;
        }

        // Apply theme if needed
        if (settings.theme && settings.theme !== 'auto') {
          terminal.options.theme =
            settings.theme === 'dark'
              ? WEBVIEW_THEME_CONSTANTS.DARK_THEME
              : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
        } else {
          // Auto theme - use current VS Code theme
          terminal.options.theme = getWebviewTheme();
        }

        // Refresh terminal to apply changes
        if (terminalData.fitAddon) {
          terminalData.fitAddon.fit();
        }
      }
    });

    // Update Alt+Click settings if they changed
    if (settings.altClickMovesCursor !== undefined || settings.multiCursorModifier !== undefined) {
      this.inputManager.updateAltClickSettings(settings);
    }

    // Also apply to the main terminal if it exists (font settings are handled separately)
    if (this.terminal) {
      const terminal = this.terminal;
      if (settings.cursorBlink !== undefined) {
        terminal.options.cursorBlink = settings.cursorBlink;
      }

      if (settings.theme && settings.theme !== 'auto') {
        terminal.options.theme =
          settings.theme === 'dark'
            ? WEBVIEW_THEME_CONSTANTS.DARK_THEME
            : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
      } else {
        terminal.options.theme = getWebviewTheme();
      }

      if (this.fitAddon) {
        this.fitAddon.fit();
      }
    }
  }

  /**
   * Apply font settings from VS Code to all terminals
   */
  public applyFontSettings(fontSettings: WebViewFontSettings): void {
    log('🎨 [WEBVIEW] Applying font settings from VS Code:', fontSettings);

    // Update current font settings
    this.currentFontSettings = { ...fontSettings };

    // Apply to all terminals using setOption() method
    this.splitManager.getTerminals().forEach((terminalData, terminalId) => {
      if (terminalData.terminal) {
        const terminal = terminalData.terminal;

        log(
          `🎨 [WEBVIEW] Updating terminal ${terminalId} fontSize: ${fontSettings.fontSize}, fontFamily: ${fontSettings.fontFamily}`
        );

        try {
          // Use options property to properly update xterm.js settings (v5.0+ API)
          terminal.options.fontSize = fontSettings.fontSize;
          terminal.options.fontFamily = fontSettings.fontFamily;

          // Refresh terminal to apply changes and refit
          if (terminalData.fitAddon) {
            terminalData.fitAddon.fit();
          }
          terminal.refresh(0, terminal.rows - 1);

          log(`✅ [WEBVIEW] Font settings applied to terminal ${terminalId}`);
        } catch (error) {
          log(`❌ [WEBVIEW] Error applying font settings to terminal ${terminalId}:`, error);
        }
      }
    });

    // Also apply to main terminal if it exists
    if (this.terminal) {
      log(
        `🎨 [WEBVIEW] Updating main terminal fontSize: ${fontSettings.fontSize}, fontFamily: ${fontSettings.fontFamily}`
      );

      try {
        // Use options property to properly update xterm.js settings (v5.0+ API)
        this.terminal.options.fontSize = fontSettings.fontSize;
        this.terminal.options.fontFamily = fontSettings.fontFamily;

        if (this.fitAddon) {
          this.fitAddon.fit();
        }
        this.terminal.refresh(0, this.terminal.rows - 1);

        log('✅ [WEBVIEW] Font settings applied to main terminal');
      } catch (error) {
        log('❌ [WEBVIEW] Error applying font settings to main terminal:', error);
      }
    }

    log('✅ [WEBVIEW] Font settings applied to all terminals using options property (v5.0+ API)');
  }

  /**
   * Update Claude status display in sidebar terminal headers
   */
  public updateClaudeStatus(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    log(`🔄 [WEBVIEW] ========== UPDATE CLAUDE STATUS CALLED ==========`);
    log(`🔄 [WEBVIEW] activeTerminalName: ${activeTerminalName}`);
    log(`🔄 [WEBVIEW] status: ${status}`);
    log(`🔄 [WEBVIEW] UIManager available: ${!!this.uiManager}`);
    log(
      `🔄 [WEBVIEW] UIManager.updateCliAgentStatusDisplay method: ${typeof this.uiManager.updateCliAgentStatusDisplay}`
    );

    try {
      this.uiManager.updateCliAgentStatusDisplay(activeTerminalName, status, agentType);
      log(`✅ [WEBVIEW] UIManager.updateCliAgentStatusDisplay called successfully`);
    } catch (error) {
      log(`❌ [WEBVIEW] Error calling UIManager.updateCliAgentStatusDisplay:`, error);
    }

    log(`🔄 [WEBVIEW] ========== UPDATE CLAUDE STATUS COMPLETE ==========`);
  }

  private loadSettings(): void {
    const loadedSettings = this.configManager.loadSettings();
    this.currentSettings = { ...this.currentSettings, ...loadedSettings };
  }

  private saveSettings(): void {
    this.configManager.saveSettings(this.currentSettings);
  }

  public dispose(): void {
    // PerformanceManager handles its own cleanup
    this.performanceManager.dispose();

    if (this.resizeDebounceTimer !== null) {
      window.clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }

    if (this.terminal) {
      this.terminal.dispose();
      this.terminal = null;
    }

    this.fitAddon = null;
    this.terminalContainer = null;
  }
}

// Global instance
const terminalManager = new TerminalWebviewManager();

// Expose to window for debugging and external access
(window as { terminalManager?: TerminalWebviewManager }).terminalManager = terminalManager;

// Debug: Check if addEventListener is available
log('🔧 [WEBVIEW] ========== SETTING UP MESSAGE LISTENER ==========');
log('🔧 [WEBVIEW] window object exists:', typeof window !== 'undefined');
log('🔧 [WEBVIEW] addEventListener available:', typeof window.addEventListener === 'function');
log('🔧 [WEBVIEW] document.readyState:', document.readyState);
log('🔧 [WEBVIEW] Current location:', window.location?.href);
log('🔧 [WEBVIEW] UserAgent:', navigator?.userAgent);

// Alternative event listener approach for debugging
window.onmessage = (event) => {
  log('🚨 [WEBVIEW-ALT] Alternative message listener fired!');
  log('🚨 [WEBVIEW-ALT] Event source:', event.source);
  log('🚨 [WEBVIEW-ALT] Event origin:', event.origin);
  log('🚨 [WEBVIEW-ALT] Event data:', event.data);
  log('🚨 [WEBVIEW-ALT] Event data command:', event.data?.command);

  // Skip general message display to reduce clutter

  if (event.data?.command === 'cliAgentStatusUpdate') {
    log('🎉 [WEBVIEW-ALT] *** CLI AGENT STATUS UPDATE DETECTED IN ALT LISTENER ***');
    log('🎉 [WEBVIEW-ALT] CLI Agent status data:', event.data.cliAgentStatus);

    // Skip Claude status display to reduce clutter

    // Debug: Check if the terminalManager is available and working
    if ((window as any).terminalManager) {
      // Skip TerminalManager available display

      try {
        // Manually call updateClaudeStatus to test
        (window as any).terminalManager.updateClaudeStatus(
          event.data.cliAgentStatus.activeTerminalName,
          event.data.cliAgentStatus.status
        );

        // Skip success display

        // Try again after a delay to see if DOM is ready
        setTimeout(() => {
          const names = document.querySelectorAll('.terminal-name');
          if (names.length > 0) {
            // Try updating again
            (window as any).terminalManager.updateClaudeStatus(
              event.data.cliAgentStatus.activeTerminalName,
              event.data.cliAgentStatus.status
            );
          }
        }, 1000); // Wait 1 second
      } catch (error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText =
          'position: fixed; top: 160px; right: 10px; background: red; color: white; padding: 5px; z-index: 9999; font-size: 12px;';
        errorDiv.textContent = `Error: ${String(error)}`;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 8000);
      }
    } else {
      const noManagerDiv = document.createElement('div');
      noManagerDiv.style.cssText =
        'position: fixed; top: 120px; right: 10px; background: #FFA500; color: black; padding: 5px; z-index: 9999; font-size: 12px; border: 1px solid black;';
      noManagerDiv.textContent = 'TerminalManager: NOT AVAILABLE';
      document.body.appendChild(noManagerDiv);
      setTimeout(() => noManagerDiv.remove(), 5000);
    }
  }
};

// Handle messages from the extension
window.addEventListener('message', (event) => {
  log('🎯 [WEBVIEW] ========== RAW MESSAGE RECEIVED ==========');
  log('🎯 [WEBVIEW] Event received at:', new Date().toISOString());
  log('🎯 [WEBVIEW] Event type:', event.type);
  log('🎯 [WEBVIEW] Event source:', event.source);
  log('🎯 [WEBVIEW] Event origin:', event.origin);
  log('🎯 [WEBVIEW] Event isTrusted:', event.isTrusted);

  try {
    const message = event.data as TerminalMessage;
    log('🎯 [WEBVIEW] Raw event.data:', event.data);
    log('🎯 [WEBVIEW] Message after cast:', message);
    log('🎯 [WEBVIEW] Message type:', typeof message);
    log('🎯 [WEBVIEW] Message command:', message?.command);
    log('🎯 [WEBVIEW] Message keys:', Object.keys(message || {}));

    if (message?.command === 'cliAgentStatusUpdate') {
      log('🔔 [WEBVIEW] *** CLI AGENT STATUS UPDATE MESSAGE DETECTED ***');
      log('🔔 [WEBVIEW] CLI Agent status data:', message.cliAgentStatus);
      log(
        '🔔 [WEBVIEW] CLI Agent status activeTerminalName:',
        message.cliAgentStatus?.activeTerminalName
      );
      log('🔔 [WEBVIEW] CLI Agent status status:', message.cliAgentStatus?.status);
    }

    // Delegate to MessageManager
    log('🎯 [WEBVIEW] About to call MessageManager.handleMessage...');
    log('🎯 [WEBVIEW] TerminalManager available:', !!terminalManager);
    log('🎯 [WEBVIEW] MessageManager available:', !!terminalManager.messageManager);

    terminalManager.messageManager.handleMessage(message, terminalManager);
    log('🎯 [WEBVIEW] MessageManager.handleMessage completed successfully');
  } catch (error) {
    log('❌ [WEBVIEW] Error processing message:', error);
    log('❌ [WEBVIEW] Error name:', error instanceof Error ? error.name : 'unknown');
    log('❌ [WEBVIEW] Error message:', error instanceof Error ? error.message : String(error));
    log('❌ [WEBVIEW] Error stack:', error instanceof Error ? error.stack : 'no stack');
  }

  log('🎯 [WEBVIEW] ========== RAW MESSAGE PROCESSING COMPLETE ==========');
});

log('✅ [WEBVIEW] Message listener registered successfully');

// Send ready notification to extension
log('📢 [WEBVIEW] Sending ready notification to extension...');
try {
  // Use globally stored VS Code API instead of acquiring again
  const api = getVsCodeApi();
  if (api) {
    log('📢 [WEBVIEW] Using globally stored VS Code API');
    log('📢 [WEBVIEW] vscode object:', typeof api);
    log('📢 [WEBVIEW] vscode.postMessage:', typeof api.postMessage);

    api.postMessage({
      command: 'webviewReady',
      timestamp: Date.now(),
    });
    log('✅ [WEBVIEW] Ready notification sent via vscode.postMessage');

    // Also send traditional ready message for backward compatibility
    setTimeout(() => {
      api.postMessage({
        command: 'ready',
      });
      log('✅ [WEBVIEW] Traditional ready notification sent as fallback');

      // Request state restoration (for panel moves or reconnection)
      api.postMessage({
        command: 'requestStateRestoration',
        timestamp: Date.now(),
      });
      log('🔄 [WEBVIEW] State restoration request sent');
    }, 10);
  } else {
    log('❌ [WEBVIEW] No VS Code API available in window.vscodeApi');
    log(
      '📢 [WEBVIEW] Available window properties:',
      Object.keys(window).filter((k) => k.includes('vscode') || k.includes('api'))
    );

    // Fallback: try to acquire VS Code API directly (will fail if already acquired)
    try {
      if (typeof (window as any).acquireVsCodeApi === 'function') {
        const fallbackVscode = (window as any).acquireVsCodeApi();
        log('📢 [WEBVIEW] Fallback: VS Code API acquired directly');
        fallbackVscode.postMessage({
          command: 'webviewReady',
          timestamp: Date.now(),
        });
      }
    } catch (fallbackError) {
      log('❌ [WEBVIEW] Fallback API acquisition also failed:', fallbackError);
    }
  }
} catch (error) {
  log('❌ [WEBVIEW] Failed to send ready notification:', error);
  log('❌ [WEBVIEW] Error details:', {
    name: error instanceof Error ? error.name : 'unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : 'no stack',
  });
}

// Test if console and logging is working in WebView context
log('🧪 [WEBVIEW] ========== WEBVIEW CONTEXT TEST ==========');
log('🧪 [WEBVIEW] Testing console.log function:', typeof console.log);
log('🧪 [WEBVIEW] Testing log function:', typeof log);
log('🧪 [WEBVIEW] Window location:', window.location.href);
log('🧪 [WEBVIEW] Document title:', document.title);
log('🧪 [WEBVIEW] Document body className:', document.body?.className);
log('🧪 [WEBVIEW] Is in VS Code webview context:', !!(window as any).acquireVsCodeApi);

// Try to send a test message immediately
log('🧪 [WEBVIEW] Attempting to send test message...');
try {
  const api = getVsCodeApi();
  if (api && typeof api.postMessage === 'function') {
    api.postMessage({
      command: 'test',
      message: 'WebView script is running and can send messages',
    });
    log('🧪 [WEBVIEW] Test message sent successfully using global vscodeApi');
  } else {
    log('❌ [WEBVIEW] No vscodeApi available for test message');
  }
} catch (error) {
  log('🧪 [WEBVIEW] Failed to send test message:', error);
}

log('🔧 [WEBVIEW] ========== MESSAGE LISTENER SETUP COMPLETE ==========');

// CRITICAL: Final script execution confirmation
console.log('🎉 [WEBVIEW-SCRIPT] ========== WEBVIEW.JS SCRIPT COMPLETED ==========');
console.log('🎉 [WEBVIEW-SCRIPT] Script completion time:', new Date().toISOString());
console.log('🎉 [WEBVIEW-SCRIPT] TerminalManager created:', !!terminalManager);
console.log('🎉 [WEBVIEW-SCRIPT] Message listeners set up successfully');

// Enhanced update status function
function updateStatus(_message: string, _type: 'info' | 'success' | 'error' = 'info'): void {}

// Activity listeners disabled to maintain toast behavior
function setupActivityListeners(): void {
  log('📱 [ACTIVITY] Activity listeners disabled to prevent status re-show');
  // Removed activity listeners that were causing status to re-appear
}

document.addEventListener('keydown', (e) => {
  // Ctrl+Tab to switch between terminals
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    terminalManager.switchToNextTerminal();
  }
});

// Notify extension that webview is ready
log('🎯 [WEBVIEW] Webview script starting...');
updateStatus('Webview script loaded');

setupActivityListeners();

function sendReadyMessage(): void {
  log('🎯 [WEBVIEW] Sending READY message to extension');
  log('🎯 [WEBVIEW] VS Code API available:', !!getVsCodeApi());
  log('🎯 [WEBVIEW] Terminal manager available:', !!terminalManager);
  log('🎯 [WEBVIEW] Message manager available:', !!terminalManager?.messageManager);
  updateStatus('Sending ready message to extension');
  try {
    terminalManager.messageManager.sendReadyMessage(terminalManager);
    log('✅ [WEBVIEW] READY message sent successfully');
    updateStatus('Ready message sent, waiting for response...');
  } catch (error) {
    log('❌ [WEBVIEW] Failed to send READY message:', error);
    updateStatus(`ERROR sending ready: ${String(error)}`);
  }
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus('DOM loaded, sending ready message');
    sendReadyMessage();
  });
} else {
  updateStatus('DOM ready, sending ready message');
  sendReadyMessage();
}
