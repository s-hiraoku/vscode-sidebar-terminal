/**
 * 共通ユーティリティ関数
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { TERMINAL_CONSTANTS } from '../constants';
import { TerminalInfo } from '../types/common';
import { TerminalConfig } from '../types/shared';
import { getUnifiedConfigurationService } from '../config/UnifiedConfigurationService';
import { log } from './logger';

/**
 * Safe process.cwd() that works in test environments
 * Returns current working directory or fallback value
 */
export function safeProcessCwd(fallback?: string): string {
  try {
    const cwd = process.cwd && typeof process.cwd === 'function' ? process.cwd() : null;
    // Don't use root directory as cwd
    if (cwd && cwd !== '/') {
      return cwd;
    }
    // Fallback to home directory instead of root
    return fallback || os.homedir();
  } catch {
    return fallback || os.homedir();
  }
}

/**
 * ディレクトリが存在し、アクセス可能かを検証
 */
export function validateDirectory(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    const isDirectory = stat.isDirectory();

    // Try to access the directory
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.X_OK);

    log('📁 [VALIDATE] Directory validation:', {
      path: dirPath,
      exists: true,
      isDirectory,
      accessible: true,
    });

    return isDirectory;
  } catch (error) {
    console.warn('⚠️ [VALIDATE] Directory validation failed:', {
      path: dirPath,
      error: String(error),
    });
    return false;
  }
}

/**
 * 作業ディレクトリを取得
 */
export function getWorkingDirectory(): string {
  const config = getUnifiedConfigurationService().getExtensionTerminalConfig();
  const customDir = config.defaultDirectory || '';

  log('📁 [WORKDIR] Getting working directory...');
  log('📁 [WORKDIR] Custom directory from config:', customDir);

  if (customDir && customDir.trim()) {
    log('📁 [WORKDIR] Candidate custom directory:', customDir);
    if (validateDirectory(customDir.trim())) {
      log('📁 [WORKDIR] Using validated custom directory:', customDir);
      return customDir.trim();
    } else {
      log('⚠️ [WORKDIR] Custom directory not accessible, trying alternatives');
    }
  }

  // Check workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  log(
    '📁 [WORKDIR] Workspace folders:',
    workspaceFolders?.map((f) => f.uri.fsPath)
  );

  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0]?.uri.fsPath;
    log('📁 [WORKDIR] Candidate workspace root:', workspaceRoot);

    // Validate directory exists and is accessible
    if (workspaceRoot && validateDirectory(workspaceRoot)) {
      log('📁 [WORKDIR] Using validated workspace root:', workspaceRoot);
      return workspaceRoot;
    } else {
      log('⚠️ [WORKDIR] Workspace root not accessible, trying alternatives');
    }
  }

  // Check active editor for file directory
  const activeEditor = vscode.window.activeTextEditor;
  if (
    activeEditor &&
    activeEditor.document &&
    activeEditor.document.uri &&
    activeEditor.document.uri.scheme === 'file'
  ) {
    const activeFileDir = path.dirname(activeEditor.document.uri.fsPath);
    log('📁 [WORKDIR] Candidate active file directory:', activeFileDir);

    if (validateDirectory(activeFileDir)) {
      log('📁 [WORKDIR] Using validated active file directory:', activeFileDir);
      return activeFileDir;
    }
  }

  // Fallback to home directory
  const homeDir = os.homedir();
  log('📁 [WORKDIR] Using fallback home directory:', homeDir);

  // Final validation of home directory
  if (validateDirectory(homeDir)) {
    return homeDir;
  }

  // Last resort - current process directory
  const processDir = safeProcessCwd();
  log('📁 [WORKDIR] Last resort - process cwd:', processDir);
  return processDir;
}

/**
 * ユニークなターミナルIDを生成
 */
export function generateTerminalId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * ターミナル情報を正規化
 */
export function normalizeTerminalInfo(terminal: {
  id: string;
  name: string;
  isActive: boolean;
}): TerminalInfo {
  return {
    id: terminal.id,
    name: terminal.name,
    isActive: terminal.isActive,
  };
}

/**
 * ターミナル名を生成
 */
export function generateTerminalName(index: number): string {
  return `${TERMINAL_CONSTANTS.TERMINAL_NAME_PREFIX} ${index}`;
}

/**
 * アクティブターミナルの管理ロジック
 */
export class ActiveTerminalManager {
  private activeTerminalId?: string;

  /**
   * アクティブターミナルを設定
   */
  public setActive(terminalId: string): void {
    this.activeTerminalId = terminalId;
  }

  /**
   * アクティブターミナルを取得
   */
  public getActive(): string | undefined {
    return this.activeTerminalId;
  }

  /**
   * アクティブターミナルをクリア
   */
  public clearActive(): void {
    this.activeTerminalId = undefined;
  }

  /**
   * アクティブターミナルが存在するかチェック
   */
  public hasActive(): boolean {
    return this.activeTerminalId !== undefined;
  }

  /**
   * 指定されたターミナルがアクティブかチェック
   */
  public isActive(terminalId: string): boolean {
    return this.activeTerminalId === terminalId;
  }
}

/**
 * nonceを生成
 */
export function generateNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < TERMINAL_CONSTANTS.NONCE_LENGTH; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * 配列から最初の要素を安全に取得
 */
export function getFirstItem<T>(array: T[] | null | undefined): T | undefined {
  return array && array.length > 0 ? array[0] : undefined;
}

/**
 * オブジェクトから最初の値を安全に取得
 */
export function getFirstValue<T>(map: Map<string, T>): T | undefined {
  const values = Array.from(map.values());
  return getFirstItem(values);
}

/**
 * 遅延実行
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全なJSON文字列化
 */
export function safeStringify(obj: unknown): string {
  try {
    const result = JSON.stringify(obj);
    return result !== undefined ? result : String(obj);
  } catch {
    return String(obj);
  }
}

// =============================================================================
// RESTORED FUNCTIONS - Required by existing code
// =============================================================================

/**
 * Get terminal configuration (restored from refactoring)
 */
export function getTerminalConfig(): TerminalConfig {
  const configService = getUnifiedConfigurationService();
  return configService.getExtensionTerminalConfig();
}

/**
 * Get shell for platform (restored from refactoring)
 */
export function getShellForPlatform(): string {
  const platform = os.platform();

  switch (platform) {
    case 'win32':
      return process.env.COMSPEC || 'cmd.exe';
    case 'darwin':
      return process.env.SHELL || '/bin/zsh';
    default: // linux, etc.
      return process.env.SHELL || '/bin/bash';
  }
}

/**
 * Show error message (restored from refactoring)
 */
export function showErrorMessage(
  message: string,
  ...items: string[]
): Thenable<string | undefined> {
  return vscode.window.showErrorMessage(message, ...items);
}

/**
 * Show warning message (restored from refactoring)
 */
export function showWarningMessage(
  message: string,
  ...items: string[]
): Thenable<string | undefined> {
  return vscode.window.showWarningMessage(message, ...items);
}
