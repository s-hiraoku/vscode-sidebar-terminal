/**
 * シンプルなターミナルセッション復元機能の型定義
 * 複雑性を排除し、確実に動作する最小限の実装
 */

/**
 * 単一ターミナルの基本情報（シンプル版）
 */
export interface SimpleTerminalInfo {
  /** ターミナルID */
  id: string;
  /** ターミナル名 */
  name: string;
  /** ターミナル番号（1-5） */
  number: number;
  /** 作業ディレクトリ */
  cwd: string;
  /** アクティブかどうか */
  isActive: boolean;
  /** Scrollback履歴データ（オプション） */
  scrollback?: Array<{
    content: string;
    type?: 'output' | 'input' | 'error';
    timestamp?: number;
  }>;
}

/**
 * シンプルなセッションデータ
 */
export interface SimpleSessionData {
  /** ターミナルの基本情報のみ */
  terminals: SimpleTerminalInfo[];
  /** アクティブターミナルID */
  activeTerminalId: string | null;
  /** 保存日時 */
  timestamp: number;
  /** バージョン（互換性チェック用） */
  version: string;
}

/**
 * セッション保存結果
 */
export interface SimpleSaveResult {
  success: boolean;
  terminalCount?: number;
  error?: string;
}

/**
 * セッション復元結果
 */
export interface SimpleRestoreResult {
  success: boolean;
  restoredCount?: number;
  skippedCount?: number;
  error?: string;
}
