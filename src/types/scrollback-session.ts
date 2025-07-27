/**
 * ターミナル履歴（scrollback）復元機能の型定義
 * Issue #126の実装用
 */

import { SimpleTerminalInfo, SimpleSessionData } from './simple-session';

/**
 * Scrollback履歴データの単一行
 */
export interface ScrollbackLine {
  /** 行の内容（ANSI escape codesを含む） */
  content: string;
  /** 行の種類（出力/入力/エラーなど） */
  type?: 'output' | 'input' | 'error';
  /** タイムスタンプ */
  timestamp?: number;
}

/**
 * ターミナルのScrollback履歴全体
 */
export interface TerminalScrollback {
  /** ターミナルID */
  terminalId: string;
  /** 履歴行の配列 */
  lines: ScrollbackLine[];
  /** カーソル位置 */
  cursorPosition?: {
    x: number;
    y: number;
  };
  /** 圧縮フラグ */
  compressed?: boolean;
  /** 元のサイズ（圧縮時） */
  originalSize?: number;
}

/**
 * 履歴を含む拡張ターミナル情報
 */
export interface ExtendedTerminalInfo extends SimpleTerminalInfo {
  /** Scrollback履歴データ */
  scrollback?: TerminalScrollback;
  /** 履歴が利用可能かどうか */
  hasScrollback: boolean;
}

/**
 * 履歴を含む拡張セッションデータ
 */
export interface ExtendedSessionData extends SimpleSessionData {
  /** 拡張ターミナル情報 */
  terminals: ExtendedTerminalInfo[];
  /** 全体の設定 */
  scrollbackConfig: {
    /** 復元する最大行数 */
    maxLines: number;
    /** 圧縮を使用するかどうか */
    useCompression: boolean;
    /** 最大ストレージサイズ（バイト） */
    maxStorageSize: number;
  };
}

/**
 * Scrollback復元の設定オプション
 */
export interface ScrollbackRestoreOptions {
  /** 復元する行数（デフォルト: 1000） */
  maxLines?: number;
  /** 復元を有効にするかどうか */
  enabled?: boolean;
  /** 圧縮を使用するかどうか */
  useCompression?: boolean;
  /** 段階的ロード（大量データ用） */
  progressiveLoad?: boolean;
}

/**
 * Scrollback復元の進捗情報
 */
export interface ScrollbackRestoreProgress {
  /** 処理中のターミナルID */
  terminalId: string;
  /** 進捗率（0-100） */
  progress: number;
  /** 現在処理中の行数 */
  currentLines: number;
  /** 総行数 */
  totalLines: number;
  /** 段階（'loading' | 'decompressing' | 'restoring'） */
  stage: 'loading' | 'decompressing' | 'restoring';
}

/**
 * Scrollback復元結果
 */
export interface ScrollbackRestoreResult {
  /** 復元成功フラグ */
  success: boolean;
  /** 復元されたターミナル数 */
  restoredTerminals?: number;
  /** 復元された総行数 */
  restoredLines?: number;
  /** 圧縮されたデータのサイズ */
  compressedSize?: number;
  /** 展開後のサイズ */
  expandedSize?: number;
  /** エラーメッセージ */
  error?: string;
  /** 警告メッセージ */
  warnings?: string[];
}

/**
 * Scrollback保存結果
 */
export interface ScrollbackSaveResult {
  /** 保存成功フラグ */
  success: boolean;
  /** 保存されたターミナル数 */
  savedTerminals?: number;
  /** 保存された総行数 */
  savedLines?: number;
  /** 圧縮率（元サイズに対する割合） */
  compressionRatio?: number;
  /** 保存されたファイルサイズ */
  fileSize?: number;
  /** エラーメッセージ */
  error?: string;
}