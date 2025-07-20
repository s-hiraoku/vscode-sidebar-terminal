import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { VsCodeMessage, WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { getTerminalConfig, generateNonce, normalizeTerminalInfo } from '../utils/common';
import { showSuccess, showError, TerminalErrorHandler } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { getConfigManager } from '../config/ConfigManager';
import { PartialTerminalSettings, WebViewFontSettings } from '../types/shared';

export class SecondaryTerminalProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'secondaryTerminal';

  private _view?: vscode.WebviewView;
  private _webviewReady = false;
  private _pendingMessages: WebviewMessage[] = [];

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    log('🔧 [DEBUG] SecondaryTerminalProvider.resolveWebviewView called');
    
    // Check if this is a panel move (WebView already exists but container changed)
    const isPanelMove = this._view !== undefined && this._view.webview.html !== '';
    
    this._view = webviewView;

    // Enable scripts and set resource roots
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };

    // Set up visibility change handler for panel move detection
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && isPanelMove) {
        log('🔄 [DEBUG] WebView became visible after panel move - restoring state');
        this._restoreWebviewState();
      }
    }, null, this._extensionContext.subscriptions);

    // Only generate HTML if this is not a panel move or HTML is empty
    if (!isPanelMove || webviewView.webview.html === '') {
      try {
        const html = this._getHtmlForWebview(webviewView.webview);
        log('🔧 [DEBUG] Generated HTML length:', html.length);
        log('🔧 [DEBUG] Setting webview HTML...');
        webviewView.webview.html = html;
        log('✅ [DEBUG] HTML set successfully');
      } catch (error) {
        log('❌ [ERROR] Failed to generate HTML for webview:', error);
        TerminalErrorHandler.handleWebviewError(error);
        return;
      }
    } else {
      log('🔄 [DEBUG] Panel move detected - preserving HTML and restoring state');
      // Immediate state restoration for panel moves
      setTimeout(() => this._restoreWebviewState(), 100);
    }

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message: VsCodeMessage) => {
        log('📨 [DEBUG] Received message from webview:', message.command, message);
        await this._handleWebviewMessage(message);
      },
      null,
      this._extensionContext.subscriptions
    );

    // Set up terminal event listeners
    this._setupTerminalEventListeners();

    // Set up CLI Agent status change listeners
    this._setupCliAgentStatusListeners();

    // Set up configuration change listeners for VS Code standard settings
    this._setupConfigurationChangeListeners();

    // Do not force initial terminal creation here
    // Let _initializeTerminal handle it when webview is ready

    log('✅ [DEBUG] WebviewView setup completed');
  }

  public splitTerminal(): void {
    log('🔧 [DEBUG] Splitting terminal...');
    try {
      // Check if we can split (use configured terminal limit)
      const terminals = this._terminalManager.getTerminals();
      const config = getConfigManager().getExtensionTerminalConfig();
      const maxSplitTerminals = config.maxTerminals;

      log('🔧 [DEBUG] Current terminals:', terminals.length);
      log('🔧 [DEBUG] Max terminals allowed:', maxSplitTerminals);
      terminals.forEach((terminal, index) => {
        log(`🔧 [DEBUG] Terminal ${index + 1}: ${terminal.name} (ID: ${terminal.id})`);
      });

      if (terminals.length >= maxSplitTerminals) {
        log('⚠️ [DEBUG] Cannot split - already at maximum terminals:', terminals.length);
        showError(`Cannot split terminal: Maximum of ${maxSplitTerminals} terminals reached`);
        return;
      }

      // First send the SPLIT command to prepare the UI
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.SPLIT,
      });

      // Then create a new terminal which will be used as secondary
      const terminalId = this._terminalManager.createTerminal();
      log('✅ [DEBUG] Split terminal created with ID:', terminalId);

      // The terminal creation event will send TERMINAL_CREATED to webview
    } catch (error) {
      log('❌ [ERROR] Failed to split terminal:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  public openSettings(): void {
    log('⚙️ [DEBUG] Opening settings...');
    try {
      // Send message to webview to open settings panel
      void this._sendMessage({
        command: 'openSettings',
      });
      log('✅ [DEBUG] Settings open command sent');
    } catch (error) {
      log('❌ [ERROR] Failed to open settings:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  public killTerminal(): void {
    log('🔧 [DEBUG] Killing terminal...');
    try {
      const activeTerminalId = this._terminalManager.getActiveTerminalId();
      const terminals = this._terminalManager.getTerminals();

      log('🔧 [DEBUG] Active terminal ID:', activeTerminalId);
      log('🔧 [DEBUG] Total terminals:', terminals.length);
      log(
        '🔧 [DEBUG] Terminal list:',
        terminals.map((t) => t.id)
      );

      if (!activeTerminalId) {
        log('⚠️ [WARN] No active terminal to kill');
        TerminalErrorHandler.handleTerminalNotFound();
        return;
      }

      // Check terminal count protection - only protect if there's 1 terminal
      if (terminals.length <= 1) {
        log('🛡️ [WARN] Cannot kill terminal - only one terminal remaining');
        showError('Cannot close terminal: At least one terminal must remain open');
        return;
      }

      log('🔧 [DEBUG] Proceeding to kill active terminal:', activeTerminalId);

      // Check if confirmation is needed
      const settings = getConfigManager().getCompleteTerminalSettings();
      const confirmBeforeKill = settings.confirmBeforeKill || false;
      if (confirmBeforeKill) {
        void vscode.window
          .showWarningMessage(`Close terminal "${activeTerminalId}"?`, { modal: true }, 'Close')
          .then((selection) => {
            if (selection === 'Close') {
              void this._performKillTerminal(activeTerminalId);
            }
          });
      } else {
        void this._performKillTerminal(activeTerminalId);
      }
    } catch (error) {
      log('❌ [ERROR] Failed to kill terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  private async _performKillTerminal(terminalId: string): Promise<void> {
    try {
      log('🗑️ [PROVIDER] Performing kill for active terminal:', terminalId);

      // 新しいアーキテクチャ: 統一されたdeleteTerminalメソッドを使用
      const result = await this._terminalManager.deleteTerminal(terminalId, { source: 'panel' });

      if (result.success) {
        log('✅ [PROVIDER] Terminal killed successfully:', terminalId);
        showSuccess(`Terminal ${terminalId} closed`);

        // 状態更新はonStateUpdateイベントで自動的に送信される
      } else {
        log('⚠️ [PROVIDER] Failed to kill terminal:', result.reason);
        showError(result.reason || 'Failed to close terminal');
      }
    } catch (error) {
      log('❌ [PROVIDER] Failed to perform kill terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  private async _performKillSpecificTerminal(terminalId: string): Promise<void> {
    try {
      log('🗑️ [PROVIDER] Performing kill for specific terminal:', terminalId);

      // 新しいアーキテクチャ: 統一されたdeleteTerminalメソッドを使用
      const result = await this._terminalManager.deleteTerminal(terminalId, { source: 'header' });

      if (result.success) {
        log('✅ [PROVIDER] Specific terminal killed successfully:', terminalId);
        showSuccess(`Terminal ${terminalId} closed`);

        // 状態更新はonStateUpdateイベントで自動的に送信される
      } else {
        log('⚠️ [PROVIDER] Failed to kill specific terminal:', result.reason);
        showError(result.reason || 'Failed to close terminal');
      }
    } catch (error) {
      log('❌ [PROVIDER] Failed to perform kill specific terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  public killSpecificTerminal(terminalId: string): void {
    log(`🗑️ [DEBUG] Killing specific terminal: ${terminalId}`);
    try {
      const terminals = this._terminalManager.getTerminals();
      const targetTerminal = terminals.find((t) => t.id === terminalId);

      if (!targetTerminal) {
        log(`⚠️ [WARN] Terminal ${terminalId} not found`);
        showError(`Terminal ${terminalId} not found`);
        return;
      }

      log('🔧 [DEBUG] Total terminals:', terminals.length);
      log(
        '🔧 [DEBUG] Terminal list:',
        terminals.map((t) => t.id)
      );

      // Check terminal count protection - only protect if there's 1 terminal
      if (terminals.length <= 1) {
        log('🛡️ [WARN] Cannot kill terminal - only one terminal remaining');
        showError('Cannot close terminal: At least one terminal must remain open');
        return;
      }

      log(`🔧 [DEBUG] Proceeding to kill specific terminal: ${terminalId}`);

      // Check if confirmation is needed
      const settings = getConfigManager().getCompleteTerminalSettings();
      const confirmBeforeKill = settings.confirmBeforeKill || false;
      if (confirmBeforeKill) {
        void vscode.window
          .showWarningMessage(`Close terminal "${terminalId}"?`, { modal: true }, 'Close')
          .then((selection) => {
            if (selection === 'Close') {
              void this._performKillSpecificTerminal(terminalId);
            }
          });
      } else {
        void this._performKillSpecificTerminal(terminalId);
      }
    } catch (error) {
      log(`❌ [ERROR] Failed to kill specific terminal ${terminalId}:`, error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  public async _initializeTerminal(): Promise<void> {
    log('🔧 [DEBUG] Initializing terminal...');
    log('🔧 [DEBUG] Terminal manager available:', !!this._terminalManager);
    log('🔧 [DEBUG] Webview available:', !!this._view);

    try {
      // Check if we have an active terminal
      const hasActive = this._terminalManager.hasActiveTerminal();
      log('🔧 [DEBUG] Has active terminal:', hasActive);

      let terminalId: string;
      if (!hasActive) {
        log('🔧 [DEBUG] No active terminal, creating new one...');
        try {
          terminalId = this._terminalManager.createTerminal();
          log('🔧 [DEBUG] New terminal created with ID:', terminalId);
        } catch (createError) {
          log('❌ [ERROR] Failed to create terminal:', createError);
          throw new Error(`Failed to create terminal: ${String(createError)}`);
        }
      } else {
        terminalId = this._terminalManager.getActiveTerminalId() || '';
        log('🔧 [DEBUG] Using existing active terminal:', terminalId);
      }

      if (!terminalId) {
        throw new Error('Failed to get or create terminal ID');
      }

      const config = getTerminalConfig();
      const terminals = this._terminalManager.getTerminals();

      log('🔧 [DEBUG] Terminal config:', config);
      log('🔧 [DEBUG] Available terminals:', terminals.length);
      log('🔧 [DEBUG] Active terminal ID:', terminalId);

      const initMessage = {
        command: TERMINAL_CONSTANTS.COMMANDS.INIT,
        config,
        terminals: terminals.map(normalizeTerminalInfo),
        activeTerminalId: terminalId,
      };

      log('🔧 [DEBUG] Sending init message to webview:', JSON.stringify(initMessage, null, 2));
      try {
        await this._sendMessage(initMessage);
        log('✅ [DEBUG] INIT message sent successfully');

        // Send font settings immediately after INIT to ensure webview has current font settings
        const fontSettings = this.getCurrentFontSettings();
        await this._sendMessage({
          command: 'fontSettingsUpdate',
          fontSettings,
        });
        log('✅ [DEBUG] Font settings sent during initialization:', fontSettings);
      } catch (sendError) {
        log('❌ [ERROR] Failed to send INIT message:', sendError);
        throw new Error(`Failed to send INIT message: ${String(sendError)}`);
      }
      log('✅ [DEBUG] Terminal initialization completed successfully');
    } catch (error) {
      log('❌ [ERROR] Failed to initialize terminal:', error);
      TerminalErrorHandler.handleTerminalCreationError(error);
      throw error;
    }
  }

  /**
   * Webviewメッセージを処理する
   */
  private async _handleWebviewMessage(message: VsCodeMessage): Promise<void> {
    log('📨 [DEBUG] Handling webview message:', message.command);
    log('📨 [DEBUG] Full message object:', JSON.stringify(message, null, 2));

    try {
      switch (message.command) {
        case 'htmlScriptTest':
          log('🔥 [DEBUG] ========== HTML INLINE SCRIPT TEST MESSAGE RECEIVED ==========');
          log('🔥 [DEBUG] HTML script communication is working!');
          log('🔥 [DEBUG] Message content:', message);
          break;

        case 'timeoutTest':
          log('🔥 [DEBUG] ========== HTML TIMEOUT TEST MESSAGE RECEIVED ==========');
          log('🔥 [DEBUG] Timeout test communication is working!');
          log('🔥 [DEBUG] Message content:', message);
          break;

        case 'test':
          log('🧪 [DEBUG] ========== TEST MESSAGE RECEIVED FROM WEBVIEW ==========');
          log('🧪 [DEBUG] Test message content:', message);
          log('🧪 [DEBUG] WebView communication is working!');

          // Send a test CLI Agent status update immediately
          log('🧪 [DEBUG] Sending test CLI Agent status update...');
          this.sendCliAgentStatusUpdate('Terminal 1', 'connected');

          setTimeout(() => {
            log('🧪 [DEBUG] Sending test CLI Agent status update (disconnected)...');
            this.sendCliAgentStatusUpdate('Terminal 1', 'disconnected');
          }, 2000);

          setTimeout(() => {
            log('🧪 [DEBUG] Sending test CLI Agent status update (none)...');
            this.sendCliAgentStatusUpdate(null, 'none');
          }, 4000);
          break;

        case 'webviewReady':
          log('🎉 [DEBUG] ========== WEBVIEW READY NOTIFICATION RECEIVED ==========');
          await this._handleWebviewReady();
          break;

        case TERMINAL_CONSTANTS.COMMANDS.READY:
          log('✅ [DEBUG] Traditional ready command received, handling webview ready...');
          await this._handleWebviewReady();

          // Initialize terminal if not done yet
          try {
            await this._initializeTerminal();
            log('✅ [DEBUG] Terminal initialization completed in message handler');
          } catch (initError) {
            log('❌ [ERROR] Terminal initialization failed in message handler:', initError);
            TerminalErrorHandler.handleTerminalCreationError(initError);
          }
          break;
        case TERMINAL_CONSTANTS.COMMANDS.INPUT:
          if (message.data) {
            log(
              '⌨️ [DEBUG] Terminal input:',
              message.data.length,
              'chars, data:',
              JSON.stringify(message.data),
              'terminalId:',
              message.terminalId
            );
            this._terminalManager.sendInput(message.data, message.terminalId);
          }
          break;
        case TERMINAL_CONSTANTS.COMMANDS.RESIZE:
          if (message.cols && message.rows) {
            log('📏 [DEBUG] Terminal resize:', message.cols, 'x', message.rows);
            this._terminalManager.resize(message.cols, message.rows, message.terminalId);
          }
          break;
        case TERMINAL_CONSTANTS.COMMANDS.SWITCH_TERMINAL:
          if (message.terminalId) {
            log('🔄 [DEBUG] Switching to terminal:', message.terminalId);
            this._terminalManager.setActiveTerminal(message.terminalId);
          }
          break;
        case 'splitTerminal':
          log('🔀 [DEBUG] Splitting terminal from webview...');
          this.splitTerminal();
          break;
        case 'getSettings': {
          log('⚙️ [DEBUG] Getting settings from webview...');
          const settings = this.getCurrentSettings();
          const fontSettings = this.getCurrentFontSettings();
          await this._sendMessage({
            command: 'settingsResponse',
            settings,
          });
          // Send font settings separately
          await this._sendMessage({
            command: 'fontSettingsUpdate',
            fontSettings,
          });
          break;
        }
        case 'updateSettings': {
          log('⚙️ [DEBUG] Updating settings from webview:', message.settings);
          if (message.settings) {
            await this.updateSettings(message.settings);
          }
          break;
        }
        case 'terminalClosed': {
          log('🗑️ [DEBUG] Terminal closed from webview:', message.terminalId);
          if (message.terminalId) {
            // Check if terminal still exists before removing
            const terminals = this._terminalManager.getTerminals();
            const terminalExists = terminals.some((t) => t.id === message.terminalId);

            if (terminalExists) {
              log('🗑️ [DEBUG] Removing terminal from extension side:', message.terminalId);
              this._terminalManager.removeTerminal(message.terminalId);
            } else {
              log('🔄 [DEBUG] Terminal already removed from extension side:', message.terminalId);
            }
          }
          break;
        }
        case 'killTerminal': {
          log('🗑️ [DEBUG] ========== KILL TERMINAL COMMAND RECEIVED ==========');
          log('🗑️ [DEBUG] Full message:', message);
          log('🗑️ [DEBUG] Message terminalId:', message.terminalId);

          // Check if specific terminal ID is provided
          if (message.terminalId) {
            log(`🗑️ [DEBUG] Killing specific terminal: ${message.terminalId}`);
            try {
              this.killSpecificTerminal(message.terminalId);
              log(`🗑️ [DEBUG] killSpecificTerminal completed for: ${message.terminalId}`);
            } catch (error) {
              log(`❌ [DEBUG] Error in killSpecificTerminal:`, error);
            }
          } else {
            log('🗑️ [DEBUG] Killing active terminal (no specific ID provided)');
            try {
              this.killTerminal();
              log('🗑️ [DEBUG] killTerminal completed');
            } catch (error) {
              log('❌ [DEBUG] Error in killTerminal:', error);
            }
          }
          break;
        }
        case 'deleteTerminal': {
          log('🗑️ [DEBUG] ========== DELETE TERMINAL COMMAND RECEIVED ==========');
          log('🗑️ [DEBUG] Full message:', message);

          const terminalId = message.terminalId as string;
          const requestSource = (message.requestSource as 'header' | 'panel') || 'panel';

          if (terminalId) {
            log(`🗑️ [DEBUG] Deleting terminal: ${terminalId} (source: ${requestSource})`);
            try {
              // 新しいアーキテクチャ: 統一されたdeleteTerminalメソッドを使用
              void this._terminalManager.deleteTerminal(terminalId, { source: requestSource });
              log(`🗑️ [DEBUG] deleteTerminal called for: ${terminalId}`);
            } catch (error) {
              log(`❌ [DEBUG] Error in deleteTerminal:`, error);
            }
          } else {
            log('❌ [DEBUG] No terminal ID provided for deleteTerminal');
          }
          break;
        }
        case 'terminalInteraction': {
          log(
            '⚡ [DEBUG] Terminal interaction received:',
            message.type,
            'terminalId:',
            message.terminalId
          );
          // Handle terminal interaction events from webview
          // This is informational - the webview is notifying us of user interactions
          break;
        }
        case 'requestStateRestoration': {
          log('🔄 [DEBUG] State restoration requested from WebView');
          try {
            await this._restoreWebviewState();
            log('✅ [DEBUG] State restoration completed');
          } catch (error) {
            log('❌ [ERROR] State restoration failed:', error);
          }
          break;
        }
        default:
          log('⚠️ [WARN] Unknown command received:', message.command);
      }
    } catch (error) {
      log('❌ [ERROR] Failed to handle webview message:', error);
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  /**
   * ターミナルイベントリスナーを設定する
   */
  private _setupTerminalEventListeners(): void {
    // Handle terminal output
    this._terminalManager.onData((event) => {
      if (event.data) {
        log(
          '📤 [DEBUG] Terminal output received:',
          event.data.length,
          'chars, terminalId:',
          event.terminalId
        );
        void this._sendMessage({
          command: TERMINAL_CONSTANTS.COMMANDS.OUTPUT,
          data: event.data,
          terminalId: event.terminalId,
        });
      }
    });

    // Handle terminal exit
    this._terminalManager.onExit((event) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.EXIT,
        exitCode: event.exitCode,
        terminalId: event.terminalId,
      });
    });

    // Handle terminal creation
    this._terminalManager.onTerminalCreated((terminal) => {
      log('🆕 [DEBUG] Terminal created:', terminal.id, terminal.name);
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_CREATED,
        terminalId: terminal.id,
        terminalName: terminal.name,
        config: getTerminalConfig(),
      });
    });

    // Handle terminal removal
    this._terminalManager.onTerminalRemoved((terminalId) => {
      void this._sendMessage({
        command: TERMINAL_CONSTANTS.COMMANDS.TERMINAL_REMOVED,
        terminalId,
      });
    });

    // 新しいアーキテクチャ: 状態更新イベントの処理
    this._terminalManager.onStateUpdate((state) => {
      void this._sendMessage({
        command: 'stateUpdate',
        state,
      });
    });

    // Note: CLI Agent status change events are handled by _setupCliAgentStatusListeners()
  }

  /**
   * Set up CLI Agent status change listeners
   */
  private _setupCliAgentStatusListeners(): void {
    log('🔧 [DEBUG] Setting up CLI Agent status change listeners...');

    // Listen to CLI Agent status changes from TerminalManager
    const claudeStatusDisposable = this._terminalManager.onCliAgentStatusChange((event) => {
      try {
        const terminal = this._terminalManager.getTerminal(event.terminalId);

        if (terminal) {
          const status = event.isActive ? 'connected' : 'disconnected';
          const agentType = this._terminalManager.getActiveAgentType(event.terminalId);
          const agentName = agentType ? `${agentType.toUpperCase()} CLI` : 'CLI Agent';
          
          log(`🔔 [PROVIDER] ${agentName} status: ${terminal.name} -> ${status}`);
          this.sendCliAgentStatusUpdate(terminal.name, status, agentType);
        } else {
          log(`⚠️ [PROVIDER] Terminal ${event.terminalId} not found for CLI Agent status change`);
          this.sendCliAgentStatusUpdate(null, 'none', null);
        }
      } catch (error) {
        log(
          `❌ [PROVIDER] CLI Agent status change error: ${error instanceof Error ? error.message : String(error)}`
        );
        if (error instanceof Error && error.stack) {
          log(`❌ [PROVIDER] Stack trace: ${error.stack}`);
        }
      }
    });

    log('✅ [DEBUG] CLI Agent status change listeners set up successfully');

    // Add to disposables
    this._extensionContext.subscriptions.push(claudeStatusDisposable);
  }

  /**
   * Set up configuration change listeners for VS Code standard settings
   */
  private _setupConfigurationChangeListeners(): void {
    // Monitor VS Code settings changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      let shouldUpdateSettings = false;
      let shouldUpdateFontSettings = false;

      // Check for general settings changes
      if (
        event.affectsConfiguration('editor.multiCursorModifier') ||
        event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.altClickMovesCursor') ||
        event.affectsConfiguration('secondaryTerminal.theme') ||
        event.affectsConfiguration('secondaryTerminal.cursorBlink')
      ) {
        shouldUpdateSettings = true;
      }

      // Check for font settings changes
      if (
        event.affectsConfiguration('terminal.integrated.fontSize') ||
        event.affectsConfiguration('terminal.integrated.fontFamily') ||
        event.affectsConfiguration('editor.fontSize') ||
        event.affectsConfiguration('editor.fontFamily')
      ) {
        shouldUpdateFontSettings = true;
      }

      if (shouldUpdateSettings) {
        log('⚙️ [DEBUG] VS Code settings changed, updating webview...');
        const settings = this.getCurrentSettings();
        void this._sendMessage({
          command: 'settingsResponse',
          settings,
        });
      }

      if (shouldUpdateFontSettings) {
        log('🎨 [DEBUG] VS Code font settings changed, updating webview...');
        const fontSettings = this.getCurrentFontSettings();
        void this._sendMessage({
          command: 'fontSettingsUpdate',
          fontSettings,
        });
      }
    });

    // Add to disposables
    this._extensionContext.subscriptions.push(configChangeDisposable);
  }

  /**
   * Handle WebView ready state
   */
  private async _handleWebviewReady(): Promise<void> {
    if (this._webviewReady) {
      log('⚠️ [DEBUG] WebView already marked as ready, skipping...');
      return;
    }

    log('🎉 [DEBUG] ========== WEBVIEW READY PROCESSING START ==========');
    this._webviewReady = true;
    log(`✅ [DEBUG] WebView marked as ready, pending messages: ${this._pendingMessages.length}`);

    // Send any pending messages
    if (this._pendingMessages.length > 0) {
      log(`📤 [DEBUG] Sending ${this._pendingMessages.length} pending messages...`);
      for (const pendingMessage of this._pendingMessages) {
        log(`📤 [DEBUG] Sending pending message: ${pendingMessage.command}`);
        await this._sendMessageDirect(pendingMessage);
      }
      this._pendingMessages = [];
      log('✅ [DEBUG] All pending messages sent');
    } else {
      log('ℹ️ [DEBUG] No pending messages to send');
    }

    log('🎉 [DEBUG] ========== WEBVIEW READY PROCESSING COMPLETE ==========');
  }

  /**
   * Webviewにメッセージを送信する
   */
  private async _sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      log('⚠️ [WARN] No webview available to send message');
      return;
    }

    // Check if WebView is ready
    if (!this._webviewReady) {
      log(`📋 [DEBUG] WebView not ready, queuing message: ${message.command}`);
      this._pendingMessages.push(message);
      log(`📋 [DEBUG] Pending messages count: ${this._pendingMessages.length}`);
      return;
    }

    await this._sendMessageDirect(message);
  }

  private async _sendMessageDirect(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      log('⚠️ [WARN] No webview available to send message');
      return;
    }

    try {
      log(`📤 [DEBUG] ========== SENDING MESSAGE TO WEBVIEW ==========`);
      log(`📤 [DEBUG] Message command: ${message.command}`);
      log(`📤 [DEBUG] Full message: ${JSON.stringify(message, null, 2)}`);
      log(
        `📤 [DEBUG] WebView state: visible=${this._view.visible}, viewType=${this._view.viewType}`
      );
      log(`📤 [DEBUG] WebView webview object exists: ${!!this._view.webview}`);
      log(`📤 [DEBUG] WebView ready: ${this._webviewReady}`);

      const result = await this._view.webview.postMessage(message);

      log(`✅ [DEBUG] postMessage call completed, result: ${result}`);
      log(`📤 [DEBUG] ========== MESSAGE SEND COMPLETE ==========`);
    } catch (error) {
      log('❌ [ERROR] Failed to send message to webview:', error);
      log('❌ [ERROR] Error details:', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'no stack',
      });
      TerminalErrorHandler.handleWebviewError(error);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    log('🔧 [DEBUG] Generating HTML for webview...');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionContext.extensionUri, 'dist', 'webview.js')
    );

    const nonce = generateNonce();

    log('🔧 [DEBUG] Script URI:', scriptUri.toString());
    log('🔧 [DEBUG] CSP nonce:', nonce);

    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
          webview.cspSource
        } 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource};">
        <!-- XTerm CSS is now bundled in webview.js -->
        <style>
            *, *::before, *::after {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            
            body {
                margin: 0;
                padding: 0;
                overflow: hidden;
                background-color: var(--vscode-editor-background, #1e1e1e);
                color: var(--vscode-foreground, #cccccc);
                font-family: var(--vscode-font-family, monospace);
                height: 100vh;
                display: flex;
                flex-direction: column;
                gap: 0;
            }
            
            /* Split layout container */
            .terminal-layout {
                width: 100%;
                height: 100vh;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            
            /* Split panes container */
            .split-container {
                flex: 1;
                display: flex;
                position: relative;
            }
            
            .split-container.horizontal {
                flex-direction: row;
            }
            
            .split-container.vertical {
                flex-direction: column;
            }
            
            /* Terminal panes */
            .terminal-pane {
                position: relative;
                background: #000;
                min-width: 200px;
                min-height: 100px;
                display: flex;
                flex-direction: column;
            }
            
            .terminal-pane.single {
                flex: 1;
            }
            
            .terminal-pane.split {
                flex: 1;
            }
            
            /* Resize splitter */
            .splitter {
                background: var(--vscode-widget-border, #454545);
                position: relative;
                z-index: 10;
            }
            
            .splitter.horizontal {
                width: 4px;
                cursor: col-resize;
                min-width: 4px;
            }
            
            .splitter.vertical {
                height: 4px;
                cursor: row-resize;
                min-height: 4px;
            }
            
            .splitter:hover {
                background: var(--vscode-focusBorder, #007acc);
            }
            
            .splitter.dragging {
                background: var(--vscode-focusBorder, #007acc);
            }
            
            /* Terminal containers */
            #terminal {
                flex: 1;
                width: 100%;
                background: #000;
                position: relative;
                overflow: hidden;
                margin: 0;
                padding: 0;
            }
            
            #terminal-body {
                flex: 1;
                width: 100%;
                height: 100%;
                background: #000;
                position: relative;
                overflow: hidden;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
            }
            
            .secondary-terminal {
                width: 100%;
                height: 100%;
                position: relative;
            }
            
            /* Terminal active border styles */
            .terminal-container {
                position: relative;
                width: 100%;
                height: 100%;
                border: 1px solid transparent !important;
                transition: border-color 0.2s ease-in-out;
            }
            
            .terminal-container.active {
                border-color: var(--vscode-focusBorder, #007acc) !important;
                border-width: 1px !important;
                border-style: solid !important;
            }
            
            .terminal-container.inactive {
                border-color: var(--vscode-widget-border, #454545) !important;
                opacity: 0.9;
            }
            
            /* Terminal body active border */
            #terminal-body.terminal-container.active {
                border-color: var(--vscode-focusBorder, #007acc) !important;
            }
            
            /* Individual terminal containers */
            div[data-terminal-container].terminal-container.active {
                border-color: var(--vscode-focusBorder, #007acc) !important;
            }
            
            /* Terminal pane border styles */
            .terminal-pane {
                position: relative;
                background: #000;
                min-width: 200px;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                border: 1px solid transparent;
                transition: border-color 0.2s ease-in-out;
            }
            
            .terminal-pane.active {
                border-color: var(--vscode-focusBorder, #007acc);
            }
            
            .terminal-pane.inactive {
                border-color: var(--vscode-widget-border, #454545);
                opacity: 0.8;
            }
            
            /* XTerm.js container fixes */
            .xterm {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
            }
            
            .xterm-viewport {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
            }
            
            .xterm-screen {
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
            }
            
            /* Terminal container fixes */
            [data-terminal-container] {
                margin: 0 !important;
                padding: 2px !important;
                height: 100% !important;
                flex: 1 !important;
            }
            
            /* Ensure full height usage */
            html, body {
                height: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* Split controls */
            .split-controls {
                position: absolute;
                top: 5px;
                right: 5px;
                z-index: 1000;
                display: flex;
                gap: 4px;
            }
            
            .split-btn {
                background: rgba(0, 0, 0, 0.7);
                color: var(--vscode-foreground, #cccccc);
                border: 1px solid var(--vscode-widget-border, #454545);
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                user-select: none;
            }
            
            .split-btn:hover {
                background: rgba(0, 0, 0, 0.9);
                border-color: var(--vscode-focusBorder, #007acc);
            }
            
            .split-btn.active {
                background: var(--vscode-button-background, #0e639c);
                border-color: var(--vscode-button-background, #0e639c);
            }
            
            /* CLI Agent status indicators */
            .terminal-name {
                color: var(--vscode-foreground) !important; /* Standard color */
                font-weight: normal;
            }
            
            /* CLI Agent indicator styles */
            .claude-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                line-height: 1;
            }
            
            .claude-indicator.claude-connected {
                color: #4CAF50; /* Green for connected */
                animation: blink 1.5s infinite;
            }
            
            .claude-indicator.claude-disconnected {
                color: #F44336; /* Red for disconnected */
                /* No animation - solid color */
            }
            
            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.3; }
                100% { opacity: 1; }
            }
            
            .loading {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                color: var(--vscode-foreground, #cccccc);
                font-family: var(--vscode-font-family, monospace);
                background: var(--vscode-editor-background, #1e1e1e);
            }
        </style>
    </head>
    <body>
        <div id="terminal-body">
            <!-- Simple terminal container -->
        </div>
        <script nonce="${nonce}">
            console.log('🔥 [HTML] ========== INLINE SCRIPT EXECUTING ==========');
            console.log('🔥 [HTML] Script execution time:', new Date().toISOString());
            console.log('🔥 [HTML] window available:', typeof window);
            console.log('🔥 [HTML] document available:', typeof document);
            
            // Acquire VS Code API once and store it globally for webview.js to use
            try {
                if (typeof window.acquireVsCodeApi === 'function') {
                    const vscode = window.acquireVsCodeApi();
                    window.vscodeApi = vscode;
                    console.log('✅ [HTML] VS Code API acquired and stored');
                } else {
                    console.log('❌ [HTML] acquireVsCodeApi not available');
                }
            } catch (error) {
                console.log('❌ [HTML] Error acquiring VS Code API:', error);
            }
            
            console.log('🔥 [HTML] Inline script completed');
            console.log('🔥 [HTML] About to load script:', '${scriptUri.toString()}');
            console.log('🔥 [HTML] VS Code API in window.vscodeApi:', !!window.vscodeApi);
            console.log('🔥 [HTML] VS Code API postMessage available:', typeof window.vscodeApi?.postMessage);
        </script>
        <script nonce="${nonce}" src="${scriptUri.toString()}" 
                onload="console.log('✅ [HTML] webview.js loaded successfully')"
                onerror="console.error('❌ [HTML] webview.js failed to load', event)"></script>
    </body>
    </html>`;

    log('✅ [DEBUG] HTML generation completed');
    return html;
  }

  private getCurrentSettings(): PartialTerminalSettings {
    const settings = getConfigManager().getCompleteTerminalSettings();
    const altClickSettings = getConfigManager().getAltClickSettings();

    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    return {
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      // VS Code standard settings for Alt+Click functionality
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
      // CLI Agent Code integration settings
      enableCliAgentIntegration: config.get<boolean>('enableCliAgentIntegration', true),
    };
  }

  private getCurrentFontSettings(): WebViewFontSettings {
    const configManager = getConfigManager();

    return {
      fontSize: configManager.getFontSize(),
      fontFamily: configManager.getFontFamily(),
    };
  }

  private async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      // Note: ConfigManager handles reading, but writing must still use VS Code API

      // Update VS Code settings (font settings are managed by VS Code directly)
      if (settings.cursorBlink !== undefined) {
        await config.update('cursorBlink', settings.cursorBlink, vscode.ConfigurationTarget.Global);
      }
      if (settings.theme) {
        await config.update('theme', settings.theme, vscode.ConfigurationTarget.Global);
      }
      if (settings.enableCliAgentIntegration !== undefined) {
        await config.update(
          'enableCliAgentIntegration',
          settings.enableCliAgentIntegration,
          vscode.ConfigurationTarget.Global
        );
        log(
          '🔧 [DEBUG] CLI Agent Code integration setting updated:',
          settings.enableCliAgentIntegration
        );
      }
      // Note: Font settings are read directly from VS Code's terminal/editor settings

      log('✅ [DEBUG] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings to apply changes
      await this._initializeTerminal();
    } catch (error) {
      log('❌ [ERROR] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
    }
  }

  /**
   * CLI Agent状態をWebViewに送信
   */
  public sendCliAgentStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
  ): void {
    try {
      const message = {
        command: 'claudeStatusUpdate' as const,
        claudeStatus: {
          activeTerminalName,
          status,
          agentType,
        },
      };

      log(`📤 [SIDEBAR-PROVIDER] Preparing CLI Agent status message: ${JSON.stringify(message)}`);
      void this._sendMessage(message);
      log(`✅ [SIDEBAR-PROVIDER] CLI Agent status update sent: ${activeTerminalName} -> ${status}`);
    } catch (error) {
      log('❌ [SIDEBAR-PROVIDER] Failed to send CLI Agent status update:', error);
    }
  }

  /**
   * Restore WebView state after panel move
   */
  private async _restoreWebviewState(): Promise<void> {
    try {
      log('🔄 [DEBUG] Starting WebView state restoration...');
      
      // Get current terminal state from TerminalManager
      const currentState = this._terminalManager.getCurrentState();
      log('🔄 [DEBUG] Current terminal state:', currentState);

      // Wait a bit for WebView to be ready
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send state restoration message to WebView
      const restoreMessage = {
        command: 'stateUpdate' as const,
        state: currentState,
      };

      log('🔄 [DEBUG] Sending state restoration message:', restoreMessage);
      await this._sendMessage(restoreMessage);

      // Also send current settings
      const settings = this._getCurrentSettings();
      const settingsMessage = {
        command: 'settingsResponse' as const,
        settings,
      };

      log('🔄 [DEBUG] Sending settings restoration message');
      await this._sendMessage(settingsMessage);

      // Send Alt+Click settings
      const altClickSettings = this._getAltClickSettings();
      const altClickMessage = {
        command: 'altClickSettings' as const,
        settings: altClickSettings,
      };

      log('🔄 [DEBUG] Sending Alt+Click settings restoration message');
      await this._sendMessage(altClickMessage);

      log('✅ [DEBUG] WebView state restoration completed successfully');
    } catch (error) {
      log('❌ [ERROR] Failed to restore WebView state:', error);
    }
  }

  /**
   * Get current settings for restoration
   */
  private _getCurrentSettings(): PartialTerminalSettings {
    const config = getConfigManager().getExtensionTerminalConfig();
    return {
      shell: config.shell || '',
      shellArgs: config.shellArgs || [],
      fontSize: config.fontSize || 14,
      fontFamily: config.fontFamily || 'monospace',
      theme: config.theme || 'dark',
      cursor: config.cursor || {
        style: 'block',
        blink: true,
      },
      maxTerminals: config.maxTerminals || 5,
      enableCliAgentIntegration: config.enableCliAgentIntegration || false,
    };
  }

  /**
   * Get Alt+Click settings for restoration
   */
  private _getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    const vsCodeAltClickSetting = vscode.workspace
      .getConfiguration('terminal.integrated')
      .get<boolean>('altClickMovesCursor', false);
    
    const vsCodeMultiCursorModifier = vscode.workspace
      .getConfiguration('editor')
      .get<string>('multiCursorModifier', 'alt');

    const extensionAltClickSetting = vscode.workspace
      .getConfiguration('secondaryTerminal')
      .get<boolean>('altClickMovesCursor', vsCodeAltClickSetting);

    return {
      altClickMovesCursor: extensionAltClickSetting,
      multiCursorModifier: vsCodeMultiCursorModifier,
    };
  }
}
