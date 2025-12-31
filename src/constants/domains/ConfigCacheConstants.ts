/**
 * 設定キャッシュ関連定数
 *
 * 設定値のキャッシュ、プロファイル自動検出、セッションストレージを制御する定数群。
 *
 * @see SystemConstants.ts - 元の統合定数ファイル
 */

export const CONFIG_CACHE_CONSTANTS = {
  /**
   * 設定キャッシュTTL（ミリ秒）
   */
  CACHE_TTL_MS: 5000,

  /**
   * プロファイルキャッシュ有効期限（ミリ秒）
   */
  PROFILE_CACHE_EXPIRATION_MS: 3600000,

  /**
   * デフォルトフォントサイズ（ピクセル）
   */
  DEFAULT_FONT_SIZE: 14,

  /**
   * デフォルトフォントファミリー
   */
  DEFAULT_FONT_FAMILY: 'monospace',

  /**
   * デフォルトフォントウェイト
   */
  DEFAULT_FONT_WEIGHT: 'normal',

  /**
   * デフォルトフォントウェイト（太字）
   */
  DEFAULT_FONT_WEIGHT_BOLD: 'bold',

  /**
   * デフォルト行間隔
   */
  DEFAULT_LINE_HEIGHT: 1.0,

  /**
   * デフォルト文字間隔
   */
  DEFAULT_LETTER_SPACING: 0,

  /**
   * デフォルトのターミナル数上限
   */
  DEFAULT_MAX_TERMINALS: 5,
} as const;

export type ConfigCacheConstantsType = typeof CONFIG_CACHE_CONSTANTS;
