/**
 * 共通ユーティリティ関数
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { TERMINAL_CONSTANTS } from '../constants';
import { TerminalConfig, TerminalInfo } from '../types/common';

/**
 * 設定を取得して正規化する
 */
export function getTerminalConfig(): TerminalConfig {
  const config = vscode.workspace.getConfiguration(TERMINAL_CONSTANTS.CONFIG_KEYS.SIDEBAR_TERMINAL);

  return {
    fontSize: config.get<number>(
      TERMINAL_CONSTANTS.CONFIG_KEYS.FONT_SIZE,
      TERMINAL_CONSTANTS.DEFAULT_FONT_SIZE
    ),
    fontFamily: config.get<string>(
      TERMINAL_CONSTANTS.CONFIG_KEYS.FONT_FAMILY,
      TERMINAL_CONSTANTS.DEFAULT_FONT_FAMILY
    ),
    maxTerminals: config.get<number>(
      TERMINAL_CONSTANTS.CONFIG_KEYS.MAX_TERMINALS,
      TERMINAL_CONSTANTS.DEFAULT_MAX_TERMINALS
    ),
    shell: config.get<string>(TERMINAL_CONSTANTS.CONFIG_KEYS.SHELL, ''),
    shellArgs: config.get<string[]>(TERMINAL_CONSTANTS.CONFIG_KEYS.SHELL_ARGS, []),
    defaultDirectory: config.get<string>('defaultDirectory', ''),
  };
}

/**
 * プラットフォームに応じたシェルを取得
 */
export function getShellForPlatform(customShell: string): string {
  if (customShell) {
    return customShell;
  }

  // VS Code の統合ターミナル設定をフォールバックとして使用
  const terminalConfig = vscode.workspace.getConfiguration(
    TERMINAL_CONSTANTS.CONFIG_KEYS.TERMINAL_INTEGRATED
  );

  switch (process.platform) {
    case TERMINAL_CONSTANTS.PLATFORMS.WINDOWS:
      return (
        terminalConfig.get<string>(TERMINAL_CONSTANTS.CONFIG_KEYS.SHELL_WINDOWS) ||
        process.env['COMSPEC'] ||
        'cmd.exe'
      );

    case TERMINAL_CONSTANTS.PLATFORMS.DARWIN:
      return (
        terminalConfig.get<string>(TERMINAL_CONSTANTS.CONFIG_KEYS.SHELL_OSX) ||
        process.env['SHELL'] ||
        '/bin/zsh'
      );

    default:
      return (
        terminalConfig.get<string>(TERMINAL_CONSTANTS.CONFIG_KEYS.SHELL_LINUX) ||
        process.env['SHELL'] ||
        '/bin/bash'
      );
  }
}

/**
 * ディレクトリが存在し、アクセス可能かを検証
 */
function validateDirectory(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    const isDirectory = stat.isDirectory();

    // Try to access the directory
    fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.X_OK);

    console.log('📁 [VALIDATE] Directory validation:', {
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
  const config = vscode.workspace.getConfiguration(TERMINAL_CONSTANTS.CONFIG_KEYS.SIDEBAR_TERMINAL);
  const customDir = config.get<string>('defaultDirectory', '');

  console.log('📁 [WORKDIR] Getting working directory...');
  console.log('📁 [WORKDIR] Custom directory from config:', customDir);

  if (customDir && customDir.trim()) {
    console.log('📁 [WORKDIR] Candidate custom directory:', customDir);
    if (validateDirectory(customDir.trim())) {
      console.log('📁 [WORKDIR] Using validated custom directory:', customDir);
      return customDir.trim();
    } else {
      console.warn('⚠️ [WORKDIR] Custom directory not accessible, trying alternatives');
    }
  }

  // Check workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders;
  console.log(
    '📁 [WORKDIR] Workspace folders:',
    workspaceFolders?.map((f) => f.uri.fsPath)
  );

  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0]?.uri.fsPath;
    console.log('📁 [WORKDIR] Candidate workspace root:', workspaceRoot);

    // Validate directory exists and is accessible
    if (workspaceRoot && validateDirectory(workspaceRoot)) {
      console.log('📁 [WORKDIR] Using validated workspace root:', workspaceRoot);
      return workspaceRoot;
    } else {
      console.warn('⚠️ [WORKDIR] Workspace root not accessible, trying alternatives');
    }
  }

  // Check active editor for file directory
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor && activeEditor.document.uri.scheme === 'file') {
    const activeFileDir = path.dirname(activeEditor.document.uri.fsPath);
    console.log('📁 [WORKDIR] Candidate active file directory:', activeFileDir);

    if (validateDirectory(activeFileDir)) {
      console.log('📁 [WORKDIR] Using validated active file directory:', activeFileDir);
      return activeFileDir;
    }
  }

  // Fallback to home directory
  const homeDir = os.homedir();
  console.log('📁 [WORKDIR] Using fallback home directory:', homeDir);

  // Final validation of home directory
  if (validateDirectory(homeDir)) {
    return homeDir;
  }

  // Last resort - current process directory
  const processDir = process.cwd();
  console.log('📁 [WORKDIR] Last resort - process cwd:', processDir);
  return processDir;
}

/**
 * ユニークなターミナルIDを生成
 */
export function generateTerminalId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * エラーメッセージを表示
 */
export function showErrorMessage(message: string, error?: unknown): void {
  const errorMessage = error ? `${message}: ${String(error)}` : message;
  void vscode.window.showErrorMessage(errorMessage);
}

/**
 * 警告メッセージを表示
 */
export function showWarningMessage(message: string): void {
  void vscode.window.showWarningMessage(message);
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
export function getFirstItem<T>(array: T[]): T | undefined {
  return array.length > 0 ? array[0] : undefined;
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
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}
