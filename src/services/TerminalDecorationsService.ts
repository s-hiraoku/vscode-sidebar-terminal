/**
 * Terminal Decorations Service - VS Code standard command result decorations
 * Provides visual indicators for command success/failure like VS Code integrated terminal
 */

import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';

export interface CommandDecoration {
  terminalId: string;
  commandId: string;
  line: number;
  status: 'success' | 'error' | 'running';
  exitCode?: number;
  timestamp: number;
  command?: string;
}

export interface DecorationSettings {
  enabled: boolean;
  showInGutter: boolean;
  showInOverviewRuler: boolean;
  successColor: string;
  errorColor: string;
  runningColor: string;
}

export class TerminalDecorationsService {
  private readonly _decorations = new Map<string, CommandDecoration[]>();
  private readonly _decorationEmitter = new vscode.EventEmitter<{
    terminalId: string;
    decorations: CommandDecoration[];
  }>();
  private _settings: DecorationSettings;

  public readonly onDecorationsChanged = this._decorationEmitter.event;

  constructor() {
    this._settings = this.loadSettings();

    // Monitor configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('secondaryTerminal.decorations') ||
        e.affectsConfiguration('terminal.integrated.shellIntegration.decorationsEnabled')
      ) {
        this._settings = this.loadSettings();
        log('🎨 [DECORATIONS] Settings updated:', this._settings);
      }
    });
  }

  /**
   * Load decoration settings from VS Code configuration
   */
  private loadSettings(): DecorationSettings {
    const config = vscode.workspace.getConfiguration();

    // Check VS Code standard setting first
    const vscodeDecorations = config.get<boolean>(
      'terminal.integrated.shellIntegration.decorationsEnabled',
      true
    );
    const sidebarConfig = config.get<any>('secondaryTerminal.decorations', {});

    return {
      enabled: sidebarConfig.enabled ?? vscodeDecorations,
      showInGutter: sidebarConfig.showInGutter ?? true,
      showInOverviewRuler: sidebarConfig.showInOverviewRuler ?? true,
      successColor: sidebarConfig.successColor ?? '#00ff00',
      errorColor: sidebarConfig.errorColor ?? '#ff0000',
      runningColor: sidebarConfig.runningColor ?? '#ffff00',
    };
  }

  /**
   * Add command decoration for a terminal
   */
  public addDecoration(decoration: Omit<CommandDecoration, 'timestamp'>): void {
    if (!this._settings.enabled) {
      return;
    }

    const fullDecoration: CommandDecoration = {
      ...decoration,
      timestamp: Date.now(),
    };

    const terminalDecorations = this._decorations.get(decoration.terminalId) || [];
    terminalDecorations.push(fullDecoration);

    // Keep only last 100 decorations per terminal for performance
    if (terminalDecorations.length > 100) {
      terminalDecorations.splice(0, terminalDecorations.length - 100);
    }

    this._decorations.set(decoration.terminalId, terminalDecorations);

    log(
      `🎨 [DECORATIONS] Added ${decoration.status} decoration for terminal ${decoration.terminalId}: ${decoration.command || 'unknown'}`
    );

    this._decorationEmitter.fire({
      terminalId: decoration.terminalId,
      decorations: [...terminalDecorations],
    });
  }

  /**
   * Update running command to completed status
   */
  public completeCommand(terminalId: string, commandId: string, exitCode: number): void {
    const decorations = this._decorations.get(terminalId);
    if (!decorations) return;

    const decoration = decorations.find((d) => d.commandId === commandId && d.status === 'running');
    if (decoration) {
      decoration.status = exitCode === 0 ? 'success' : 'error';
      decoration.exitCode = exitCode;

      log(`🎨 [DECORATIONS] Completed command ${commandId} with exit code ${exitCode}`);

      this._decorationEmitter.fire({
        terminalId,
        decorations: [...decorations],
      });
    }
  }

  /**
   * Get decorations for a terminal
   */
  public getDecorations(terminalId: string): CommandDecoration[] {
    return this._decorations.get(terminalId) || [];
  }

  /**
   * Clear decorations for a terminal
   */
  public clearDecorations(terminalId: string): void {
    this._decorations.delete(terminalId);
    this._decorationEmitter.fire({
      terminalId,
      decorations: [],
    });
    log(`🎨 [DECORATIONS] Cleared decorations for terminal ${terminalId}`);
  }

  /**
   * Get current decoration settings
   */
  public getSettings(): DecorationSettings {
    return { ...this._settings };
  }

  /**
   * Process shell integration output for command decorations
   */
  public processShellIntegrationData(terminalId: string, data: string): void {
    if (!this._settings.enabled) return;

    // VS Code shell integration escape sequences
    const commandStartPattern = /\x1b]633;A(?:;(.*))??\x07/;
    const commandEndPattern = /\x1b]633;D(?:;(\d+))?\x07/;

    // Command start (A sequence)
    const commandStartMatch = data.match(commandStartPattern);
    if (commandStartMatch) {
      const command = commandStartMatch[1] || 'unknown';
      const commandId = `${terminalId}-${Date.now()}`;

      this.addDecoration({
        terminalId,
        commandId,
        line: 0, // Will be updated with actual line number from WebView
        status: 'running',
        command,
      });
      return;
    }

    // Command end (D sequence)
    const commandEndMatch = data.match(commandEndPattern);
    if (commandEndMatch) {
      const exitCode = parseInt(commandEndMatch[1] || '0', 10);

      // Find the most recent running command for this terminal
      const decorations = this._decorations.get(terminalId) || [];
      const runningDecoration = decorations
        .filter((d) => d.status === 'running')
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (runningDecoration) {
        this.completeCommand(terminalId, runningDecoration.commandId, exitCode);
      }
    }
  }

  /**
   * Generate CSS classes for decorations
   */
  public generateDecorationCSS(): string {
    if (!this._settings.enabled) return '';

    return `
      .terminal-command-decoration {
        position: absolute;
        left: 0;
        width: 4px;
        height: 1em;
        pointer-events: none;
      }
      
      .terminal-command-decoration.success {
        background-color: ${this._settings.successColor};
      }
      
      .terminal-command-decoration.error {
        background-color: ${this._settings.errorColor};
      }
      
      .terminal-command-decoration.running {
        background-color: ${this._settings.runningColor};
        animation: terminal-running-pulse 1.5s ease-in-out infinite;
      }
      
      @keyframes terminal-running-pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      .terminal-overview-ruler-decoration {
        width: 2px;
        position: absolute;
        right: 0;
      }
      
      .terminal-overview-ruler-decoration.success {
        background-color: ${this._settings.successColor};
      }
      
      .terminal-overview-ruler-decoration.error {
        background-color: ${this._settings.errorColor};
      }
      
      .terminal-overview-ruler-decoration.running {
        background-color: ${this._settings.runningColor};
      }
    `;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._decorationEmitter.dispose();
    this._decorations.clear();
    log('🧹 [DECORATIONS] Service disposed');
  }
}
