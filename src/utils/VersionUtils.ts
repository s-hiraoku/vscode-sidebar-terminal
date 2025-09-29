import * as vscode from 'vscode';

/**
 * バージョン情報取得ユーティリティ
 */
export class VersionUtils {
  private static cachedVersion: string = '';

  /**
   * 拡張機能のバージョン情報を取得
   * @returns バージョン文字列（例: "0.1.104"）
   */
  public static getExtensionVersion(): string {
    if (this.cachedVersion) {
      return this.cachedVersion;
    }

    try {
      // 拡張機能のマニフェスト（package.json）からバージョンを取得
      const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
      if (extension?.packageJSON?.version) {
        this.cachedVersion = extension.packageJSON.version as string;
        return this.cachedVersion;
      }

      // フォールバック: 拡張機能が見つからない場合
      console.warn('[VersionUtils] Extension not found, returning fallback version');
      return 'Unknown';
    } catch (error) {
      console.error('[VersionUtils] Error getting extension version:', error);
      return 'Unknown';
    }
  }

  /**
   * フォーマットされたバージョン文字列を取得
   * @returns フォーマットされたバージョン（例: "v0.1.104"）
   */
  public static getFormattedVersion(): string {
    const version = this.getExtensionVersion();
    return version === 'Unknown' ? version : `v${version}`;
  }

  /**
   * 拡張機能の完全な表示名とバージョンを取得
   * @returns 表示名とバージョン（例: "Secondary Terminal v0.1.104"）
   */
  public static getExtensionDisplayInfo(): string {
    try {
      const extension = vscode.extensions.getExtension('s-hiraoku.vscode-sidebar-terminal');
      if (extension?.packageJSON) {
        const displayName = extension.packageJSON.displayName || 'Secondary Terminal';
        const version = this.getFormattedVersion();
        return `${displayName} ${version}`;
      }
      return `Secondary Terminal ${this.getFormattedVersion()}`;
    } catch (error) {
      console.error('[VersionUtils] Error getting extension display info:', error);
      return 'Secondary Terminal Unknown';
    }
  }

  /**
   * キャッシュをクリア（テスト用）
   */
  public static clearCache(): void {
    this.cachedVersion = '';
  }
}