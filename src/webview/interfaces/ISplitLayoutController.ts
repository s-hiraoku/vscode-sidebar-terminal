/**
 * Split Layout Controller Interface
 *
 * SplitManagerがDisplayModeManagerに提供する
 * 分割レイアウト制御インターフェース
 *
 * 目的:
 * - SplitManagerの巨大なインターフェースから必要な機能のみ抽出
 * - DisplayModeManagerとの責務境界を明確化
 * - テスト時のモック作成を容易化
 */

/**
 * 分割レイアウト制御インターフェース
 *
 * DisplayModeManagerが分割モードを制御するために必要な
 * 最小限のメソッドセット
 */
export interface ISplitLayoutController {
  /**
   * 現在分割モードかどうか
   */
  isSplitMode: boolean;

  /**
   * 分割モードを準備
   * @param direction 分割方向 ('horizontal' | 'vertical')
   */
  prepareSplitMode(direction: 'horizontal' | 'vertical'): void;

  /**
   * 分割モードを解除
   * すべてのターミナルを通常レイアウトに戻す
   */
  exitSplitMode(): void;

  /**
   * 分割されたターミナルのマップを取得
   * @returns 分割ターミナルID -> HTMLElement のマップ
   */
  getSplitTerminals(): Map<string, HTMLElement>;

  /**
   * 分割ターミナルのサイズを再配分
   * @param newHeight 新しい高さ（ピクセル）
   */
  redistributeSplitTerminals(newHeight: number): void;

  /**
   * パネル位置に基づいて最適な分割方向を取得
   * @param location パネルの位置 ('sidebar' | 'panel')
   * @returns 最適な分割方向
   */
  getOptimalSplitDirection(location: 'sidebar' | 'panel' | string): 'vertical' | 'horizontal';
}
