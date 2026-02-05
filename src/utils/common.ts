/** Common utility functions for the extension. */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { TERMINAL_CONSTANTS } from '../constants';
import { TerminalInfo } from '../types/common';
import { TerminalConfig } from '../types/shared';
import { getUnifiedConfigurationService } from '../config/UnifiedConfigurationService';

/** Safe process.cwd() that works in test environments. */
export function safeProcessCwd(fallback?: string): string {
  try {
    const cwd = process.cwd && typeof process.cwd === 'function' ? process.cwd() : null;
    if (cwd && cwd !== '/') return cwd;
    return fallback || os.homedir();
  } catch {
    return fallback || os.homedir();
  }
}

/** Validates that a directory exists and is accessible. */
export function validateDirectory(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return false;
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Gets the working directory based on configuration and workspace. */
export function getWorkingDirectory(): string {
  const config = getUnifiedConfigurationService().getExtensionTerminalConfig();
  const customDir = config.defaultDirectory?.trim();

  // Try custom directory first
  if (customDir && validateDirectory(customDir)) {
    return customDir;
  }

  // Try workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0]?.uri.fsPath;
    if (workspaceRoot && validateDirectory(workspaceRoot)) {
      return workspaceRoot;
    }
  }

  // Try active editor's directory
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document?.uri?.scheme === 'file') {
    const activeFileDir = path.dirname(activeEditor.document.uri.fsPath);
    if (validateDirectory(activeFileDir)) {
      return activeFileDir;
    }
  }

  // Fallback to home directory
  const homeDir = os.homedir();
  if (validateDirectory(homeDir)) {
    return homeDir;
  }

  return safeProcessCwd();
}

export function generateTerminalId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function normalizeTerminalInfo(terminal: {
  id: string;
  name: string;
  isActive: boolean;
  indicatorColor?: string;
}): TerminalInfo {
  return {
    id: terminal.id,
    name: terminal.name,
    isActive: terminal.isActive,
    ...(terminal.indicatorColor ? { indicatorColor: terminal.indicatorColor } : {}),
  };
}

export function generateTerminalName(index: number): string {
  return `${TERMINAL_CONSTANTS.TERMINAL_NAME_PREFIX} ${index}`;
}

/** Manages active terminal state. */
export class ActiveTerminalManager {
  private activeTerminalId?: string;

  public setActive(terminalId: string): void { this.activeTerminalId = terminalId; }
  public getActive(): string | undefined { return this.activeTerminalId; }
  public clearActive(): void { this.activeTerminalId = undefined; }
  public hasActive(): boolean { return this.activeTerminalId !== undefined; }
  public isActive(terminalId: string): boolean { return this.activeTerminalId === terminalId; }
}

export function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < TERMINAL_CONSTANTS.NONCE_LENGTH; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getFirstItem<T>(array: T[] | null | undefined): T | undefined {
  return array && array.length > 0 ? array[0] : undefined;
}

export function getFirstValue<T>(map: Map<string, T>): T | undefined {
  return getFirstItem(Array.from(map.values()));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function safeStringify(obj: unknown): string {
  try {
    const result = JSON.stringify(obj);
    return result !== undefined ? result : String(obj);
  } catch {
    return String(obj);
  }
}

export function getTerminalConfig(): TerminalConfig {
  return getUnifiedConfigurationService().getExtensionTerminalConfig();
}

export function getShellForPlatform(): string {
  const platform = os.platform();
  if (platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  if (platform === 'darwin') return process.env.SHELL || '/bin/zsh';
  return process.env.SHELL || '/bin/bash';
}

export function showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(message, ...items);
}

export function showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  return vscode.window.showWarningMessage(message, ...items);
}
