/**
 * 共通ユーティリティ関数
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { TERMINAL_CONSTANTS, ERROR_MESSAGES } from '../constants';
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
 * 作業ディレクトリを取得
 */
export function getWorkingDirectory(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir();
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
