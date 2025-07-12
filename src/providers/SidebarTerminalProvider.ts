import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { VsCodeMessage, WebviewMessage } from '../types/common';
import { TERMINAL_CONSTANTS } from '../constants';
import { getTerminalConfig, generateNonce, normalizeTerminalInfo } from '../utils/common';
import { showSuccess, showError, TerminalErrorHandler } from '../utils/feedback';
import { provider as log } from '../utils/logger';
import { getConfigManager } from '../config/ConfigManager';
import { PartialTerminalSettings } from '../types/shared';

export class SidebarTerminalProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'sidebarTerminal';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionContext: vscode.ExtensionContext,
    private readonly _terminalManager: TerminalManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    log('🔧 [DEBUG] SidebarTerminalProvider.resolveWebviewView called');
    this._view = webviewView;

    // Enable scripts and set resource roots
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionContext.extensionUri],
    };

    try {
      const html = this._getHtmlForWebview(webviewView.webview);
      log('🔧 [DEBUG] Generated HTML length:', html.length);
      log('🔧 [DEBUG] Setting webview HTML...');
      webviewView.webview.html = html;
      log('✅ [DEBUG] HTML set successfully');
    } catch (error) {
      log('❌ [ERROR] Failed to generate HTML for webview:', error);
      void vscode.window.showErrorMessage(`Failed to generate webview HTML: ${String(error)}`);
      return;
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
      void vscode.window.showErrorMessage(`Failed to split terminal: ${String(error)}`);
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
      void vscode.window.showErrorMessage(`Failed to open settings: ${String(error)}`);
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
              this._performKillTerminal(activeTerminalId);
            }
          });
      } else {
        this._performKillTerminal(activeTerminalId);
      }
    } catch (error) {
      log('❌ [ERROR] Failed to kill terminal:', error);
      showError(`Failed to close terminal: ${String(error)}`);
    }
  }

  private _performKillTerminal(terminalId: string): void {
    try {
      log('🗑️ [PROVIDER] Performing kill for active terminal:', terminalId);

      // Kill the terminal process in TerminalManager
      // Note: TerminalManager.killTerminal always kills the active terminal regardless of ID
      this._terminalManager.killTerminal(terminalId);

      // Notify webview to remove the terminal from UI
      void this._sendMessage({
        command: 'terminalRemoved',
        terminalId: terminalId,
      });

      log('✅ [PROVIDER] Terminal killed successfully:', terminalId);
      showSuccess(`Terminal ${terminalId} closed`);
    } catch (error) {
      log('❌ [PROVIDER] Failed to perform kill terminal:', error);
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
      } catch (sendError) {
        log('❌ [ERROR] Failed to send INIT message:', sendError);
        throw new Error(`Failed to send INIT message: ${String(sendError)}`);
      }
      log('✅ [DEBUG] Terminal initialization completed successfully');
    } catch (error) {
      log('❌ [ERROR] Failed to initialize terminal:', error);
      void vscode.window.showErrorMessage(`Failed to initialize terminal: ${String(error)}`);
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
        case TERMINAL_CONSTANTS.COMMANDS.READY:
          log('✅ [DEBUG] Webview is ready, initializing terminal...');
          try {
            await this._initializeTerminal();
            log('✅ [DEBUG] Terminal initialization completed in message handler');
          } catch (initError) {
            log('❌ [ERROR] Terminal initialization failed in message handler:', initError);
            void vscode.window.showErrorMessage(
              `Terminal initialization failed: ${String(initError)}`
            );
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
          await this._sendMessage({
            command: 'settingsResponse',
            settings,
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
        default:
          log('⚠️ [WARN] Unknown command received:', message.command);
      }
    } catch (error) {
      log('❌ [ERROR] Failed to handle webview message:', error);
      void vscode.window.showErrorMessage(`Failed to handle webview message: ${String(error)}`);
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
  }

  /**
   * Set up configuration change listeners for VS Code standard settings
   */
  private _setupConfigurationChangeListeners(): void {
    // Monitor editor.multiCursorModifier and terminal.integrated.altClickMovesCursor changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('editor.multiCursorModifier') ||
        event.affectsConfiguration('terminal.integrated.altClickMovesCursor') ||
        event.affectsConfiguration('sidebarTerminal.altClickMovesCursor')
      ) {
        log('⚙️ [DEBUG] VS Code standard settings changed, updating webview...');
        // Send updated settings to webview
        const settings = this.getCurrentSettings();
        void this._sendMessage({
          command: 'settingsResponse',
          settings,
        });
      }
    });

    // Add to disposables
    this._extensionContext.subscriptions.push(configChangeDisposable);
  }

  /**
   * Webviewにメッセージを送信する
   */
  private async _sendMessage(message: WebviewMessage): Promise<void> {
    if (!this._view) {
      log('⚠️ [WARN] No webview available to send message');
      return;
    }

    try {
      log('📤 [DEBUG] Sending message to webview:', message.command);
      await this._view.webview.postMessage(message);
    } catch (error) {
      log('❌ [ERROR] Failed to send message to webview:', error);
      void vscode.window.showErrorMessage(`Failed to send message to webview: ${String(error)}`);
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
        } 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
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
            console.log('🎯 [WEBVIEW] Script loaded');
        </script>
        <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
    </body>
    </html>`;

    log('✅ [DEBUG] HTML generation completed');
    return html;
  }

  private getCurrentSettings(): PartialTerminalSettings {
    const settings = getConfigManager().getCompleteTerminalSettings();
    const altClickSettings = getConfigManager().getAltClickSettings();

    return {
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      cursorBlink: settings.cursorBlink,
      theme: settings.theme || 'auto',
      // VS Code standard settings for Alt+Click functionality
      altClickMovesCursor: altClickSettings.altClickMovesCursor,
      multiCursorModifier: altClickSettings.multiCursorModifier,
    };
  }

  private async updateSettings(settings: PartialTerminalSettings): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('sidebarTerminal');
      // Note: ConfigManager handles reading, but writing must still use VS Code API

      // Update VS Code settings
      await config.update('fontSize', settings.fontSize, vscode.ConfigurationTarget.Global);
      await config.update('fontFamily', settings.fontFamily, vscode.ConfigurationTarget.Global);
      await config.update('cursorBlink', settings.cursorBlink, vscode.ConfigurationTarget.Global);
      if (settings.theme) {
        await config.update('theme', settings.theme, vscode.ConfigurationTarget.Global);
      }

      log('✅ [DEBUG] Settings updated successfully');
      showSuccess('Settings updated successfully');

      // Reinitialize terminal with new settings to apply changes
      await this._initializeTerminal();
    } catch (error) {
      log('❌ [ERROR] Failed to update settings:', error);
      showError(`Failed to update settings: ${String(error)}`);
    }
  }
}
