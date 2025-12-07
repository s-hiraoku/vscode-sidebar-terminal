/**
 * Keyboard Shortcut Service - VS Code標準キーボードショートカット管理
 * VS Code の標準ターミナルキーボードショートカットに準拠した実装
 */

import * as vscode from 'vscode';
import { TerminalManager } from '../terminals/TerminalManager';
import { SecondaryTerminalProvider } from '../providers/SecondaryTerminalProvider';
import { terminal as log } from '../utils/logger';

export class KeyboardShortcutService {
  private readonly _disposables: vscode.Disposable[] = [];
  private readonly _terminalManager: TerminalManager;
  private _commandHistory: string[] = [];
  private _currentHistoryIndex: number = -1;
  private _searchBox: vscode.InputBox | null = null;

  constructor(terminalManager: TerminalManager) {
    this._terminalManager = terminalManager;
    this.registerCommands();
  }

  /**
   * Register all keyboard shortcut commands
   */
  private registerCommands(): void {
    // Terminal Focus & Creation
    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.focusTerminal', () => {
        this.focusTerminal();
      })
    );

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.createTerminal', () => {
        this.createTerminal();
      })
    );

    // Terminal Navigation
    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.focusNextTerminal', () => {
        this.focusNextTerminal();
      })
    );

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.focusPreviousTerminal', () => {
        this.focusPreviousTerminal();
      })
    );

    // Terminal Operations
    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.clearTerminal', () => {
        this.clearTerminal();
      })
    );

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.scrollToPreviousCommand', () => {
        this.scrollToPreviousCommand();
      })
    );

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.scrollToNextCommand', () => {
        this.scrollToNextCommand();
      })
    );

    // Text Operations
    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.selectAll', () => {
        this.selectAll();
      })
    );

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.copy', () => {
        this.copy();
      })
    );

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.paste', () => {
        this.paste();
      })
    );

    // Search Operations - Note: 'secondaryTerminal.find' is registered in ExtensionLifecycle.ts

    this._disposables.push(
      vscode.commands.registerCommand('secondaryTerminal.runRecentCommand', () => {
        this.runRecentCommand();
      })
    );

    // Terminal Number Direct Focus (Alt+1~5)
    for (let i = 1; i <= 5; i++) {
      this._disposables.push(
        vscode.commands.registerCommand(`secondaryTerminal.focusTerminal${i}`, () => {
          this.focusTerminalByNumber(i);
        })
      );
    }
  }

  /**
   * Focus the terminal view
   */
  private async focusTerminal(): Promise<void> {
    try {
      // Focus the secondary terminal view
      await vscode.commands.executeCommand('secondaryTerminal.focus');

      // Get the active terminal and focus it
      const activeTerminal = this._terminalManager.getActiveTerminalId();
      if (activeTerminal) {
        // Send focus event to webview
        this.sendWebviewCommand('focus', { terminalId: activeTerminal });
      }

      log('🎯 [KEYBOARD] Terminal focused');
    } catch (error) {
      log(`❌ [KEYBOARD] Failed to focus terminal: ${error}`);
    }
  }

  /**
   * Create a new terminal with default profile
   */
  private async createTerminal(): Promise<void> {
    try {
      // Check if we can use profile-based creation
      const defaultProfile = this._terminalManager.getDefaultProfile();

      let terminalId: string;
      if (defaultProfile && 'createTerminalWithProfile' in this._terminalManager) {
        // Use profile-based creation if available
        terminalId = await this._terminalManager.createTerminalWithProfile(defaultProfile);
      } else {
        // Fallback to standard creation
        terminalId = this._terminalManager.createTerminal();
      }

      if (terminalId) {
        log(`✅ [KEYBOARD] Created new terminal: ${terminalId}`);
        this._terminalManager.setActiveTerminal(terminalId);
      } else {
        vscode.window.showWarningMessage('Maximum number of terminals reached');
      }
    } catch (error) {
      log(`❌ [KEYBOARD] Failed to create terminal: ${error}`);
      vscode.window.showErrorMessage(`Failed to create terminal: ${error}`);
    }
  }

  /**
   * Focus the next terminal in the list
   */
  private focusNextTerminal(): void {
    const terminals = this._terminalManager.getTerminals();
    const activeTerminal = this._terminalManager.getActiveTerminalId();

    if (terminals.length === 0) return;

    const terminalIds = terminals.map((t) => t.id);
    const currentIndex = activeTerminal ? terminalIds.indexOf(activeTerminal) : -1;
    const nextIndex = (currentIndex + 1) % terminalIds.length;

    const nextTerminalId = terminalIds[nextIndex];
    if (nextTerminalId) {
      this._terminalManager.setActiveTerminal(nextTerminalId);

      this.sendWebviewCommand('focusTerminal', { terminalId: nextTerminalId });
      log(`🎯 [KEYBOARD] Focused next terminal: ${nextTerminalId}`);
    }
  }

  /**
   * Focus the previous terminal in the list
   */
  private focusPreviousTerminal(): void {
    const terminals = this._terminalManager.getTerminals();
    const activeTerminal = this._terminalManager.getActiveTerminalId();

    if (terminals.length === 0) return;

    const terminalIds = terminals.map((t) => t.id);
    const currentIndex = activeTerminal ? terminalIds.indexOf(activeTerminal) : 0;
    const prevIndex = (currentIndex - 1 + terminalIds.length) % terminalIds.length;

    const prevTerminalId = terminalIds[prevIndex];
    if (prevTerminalId) {
      this._terminalManager.setActiveTerminal(prevTerminalId);

      this.sendWebviewCommand('focusTerminal', { terminalId: prevTerminalId });
      log(`🎯 [KEYBOARD] Focused previous terminal: ${prevTerminalId}`);
    }
  }

  /**
   * Focus terminal by number (1-5)
   * If terminal with specified number does not exist, do nothing
   */
  private focusTerminalByNumber(number: number): void {
    const terminals = this._terminalManager.getTerminals();

    // Find terminal with matching number
    const targetTerminal = terminals.find((t) => t.number === number);

    if (!targetTerminal) {
      // Terminal does not exist - silently ignore
      log(`ℹ️ [KEYBOARD] No terminal with number ${number} exists`);
      return;
    }

    // Already active - no action needed
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (activeTerminal === targetTerminal.id) {
      return;
    }

    // Set active and notify WebView
    this._terminalManager.setActiveTerminal(targetTerminal.id);
    this.sendWebviewCommand('focusTerminal', { terminalId: targetTerminal.id });
    log(`🎯 [KEYBOARD] Focused terminal ${number}: ${targetTerminal.id}`);
  }

  /**
   * Clear the active terminal
   */
  private clearTerminal(): void {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    this.sendWebviewCommand('clearTerminal', { terminalId: activeTerminal });
    log(`🧹 [KEYBOARD] Cleared terminal: ${activeTerminal}`);
  }

  /**
   * Scroll to previous command (VS Code standard: Ctrl+Up)
   */
  private scrollToPreviousCommand(): void {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    this.sendWebviewCommand('scrollToPreviousCommand', { terminalId: activeTerminal });
    log(`⬆️ [KEYBOARD] Scrolled to previous command: ${activeTerminal}`);
  }

  /**
   * Scroll to next command (VS Code standard: Ctrl+Down)
   */
  private scrollToNextCommand(): void {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    this.sendWebviewCommand('scrollToNextCommand', { terminalId: activeTerminal });
    log(`⬇️ [KEYBOARD] Scrolled to next command: ${activeTerminal}`);
  }

  /**
   * Select all text in terminal
   */
  private selectAll(): void {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    this.sendWebviewCommand('selectAll', { terminalId: activeTerminal });
    log(`📋 [KEYBOARD] Selected all text: ${activeTerminal}`);
  }

  /**
   * Copy selected text
   */
  private copy(): void {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    this.sendWebviewCommand('copy', { terminalId: activeTerminal });
    log(`📋 [KEYBOARD] Copied text: ${activeTerminal}`);
  }

  /**
   * Paste from clipboard
   */
  private async paste(): Promise<void> {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    try {
      const clipboardText = await vscode.env.clipboard.readText();
      if (clipboardText && activeTerminal) {
        // Fix: sendInput signature is (data, terminalId), not (terminalId, data)
        this._terminalManager.sendInput(clipboardText, activeTerminal);
        log(`📋 [KEYBOARD] Pasted ${clipboardText.length} chars to terminal ${activeTerminal}`);
      }
    } catch (error) {
      log(`❌ [KEYBOARD] Failed to paste: ${error}`);
    }
  }

  /**
   * Open find box (VS Code standard: Ctrl+F)
   */
  public async find(): Promise<void> {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    const searchTerm = await vscode.window.showInputBox({
      placeHolder: 'Search in terminal...',
      prompt: 'Enter text to search',
    });

    if (searchTerm) {
      this.sendWebviewCommand('find', {
        terminalId: activeTerminal,
        searchTerm,
      });
      log(`🔍 [KEYBOARD] Searching for: ${searchTerm}`);
    }
  }

  /**
   * Run recent command (VS Code standard: Ctrl+R)
   */
  private async runRecentCommand(): Promise<void> {
    const activeTerminal = this._terminalManager.getActiveTerminalId();
    if (!activeTerminal) return;

    // Show quick pick with command history
    const recentCommands = this.getRecentCommands();

    if (recentCommands.length === 0) {
      vscode.window.showInformationMessage('No command history available');
      return;
    }

    const selected = await vscode.window.showQuickPick(recentCommands, {
      placeHolder: 'Select a recent command to run',
    });

    if (selected && activeTerminal) {
      // Fix: sendInput signature is (data, terminalId), not (terminalId, data)
      this._terminalManager.sendInput(selected + '\n', activeTerminal);
      log(`🔄 [KEYBOARD] Running recent command: ${selected}`);
    }
  }

  /**
   * Get recent commands from history
   */
  private getRecentCommands(): string[] {
    // This would be integrated with shell integration to get real command history
    // For now, return a placeholder array
    return this._commandHistory.slice(-20).reverse();
  }

  /**
   * Add command to history
   */
  public addToHistory(command: string): void {
    if (command && command.trim()) {
      this._commandHistory.push(command.trim());
      // Keep only last 100 commands
      if (this._commandHistory.length > 100) {
        this._commandHistory = this._commandHistory.slice(-100);
      }
    }
  }

  /**
   * Send command to webview
   */
  private sendWebviewCommand(command: string, data: Record<string, unknown>): void {
    if (
      this._webviewProvider &&
      'sendMessage' in this._webviewProvider &&
      typeof this._webviewProvider.sendMessage === 'function'
    ) {
      this._webviewProvider.sendMessage({ command, ...data });
      log(`📨 [KEYBOARD] Sent to webview: ${command}`, data);
    } else {
      log(`⚠️ [KEYBOARD] No webview provider available for command: ${command}`, data);
    }
  }

  /**
   * Set the webview provider for sending commands
   */
  private _webviewProvider: SecondaryTerminalProvider | null = null;

  public setWebviewProvider(provider: SecondaryTerminalProvider): void {
    this._webviewProvider = provider;
    log('🔗 [KEYBOARD] Webview provider connected');
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._disposables.forEach((d) => d.dispose());
    this._disposables.length = 0;
    this._searchBox?.dispose();
    log('🧹 [KEYBOARD] Service disposed');
  }
}
