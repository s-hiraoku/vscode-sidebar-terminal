/**
 * 設定キャッシュ関連定数
 *
 * 設定値のキャッシュ、プロファイル自動検出、デフォルト値を定義する定数群
 */

export const CONFIG_CACHE_CONSTANTS = {
  // ========================================
  // キャッシュ設定
  // ========================================

  /** 設定キャッシュTTL（ミリ秒） - 5秒 */
  CACHE_TTL_MS: 5000,

  /** プロファイルキャッシュ有効期限（ミリ秒） - 1時間 */
  PROFILE_CACHE_EXPIRATION_MS: 3600000,

  // ========================================
  // フォント設定デフォルト
  // ========================================

  /** デフォルトフォントサイズ（ピクセル） */
  DEFAULT_FONT_SIZE: 14,

  /** デフォルトフォントファミリー */
  DEFAULT_FONT_FAMILY: 'monospace',

  /** デフォルトフォントウェイト */
  DEFAULT_FONT_WEIGHT: 'normal',

  /** デフォルトフォントウェイト（太字） */
  DEFAULT_FONT_WEIGHT_BOLD: 'bold',

  /** デフォルト行間隔 */
  DEFAULT_LINE_HEIGHT: 1.0,

  /** デフォルト文字間隔 */
  DEFAULT_LETTER_SPACING: 0,

  // ========================================
  // その他のデフォルト
  // ========================================

  /** デフォルトのターミナル数上限 */
  DEFAULT_MAX_TERMINALS: 5,
} as const;

/** 設定キャッシュ定数の型 */
export type ConfigCacheConstantsType = typeof CONFIG_CACHE_CONSTANTS;
