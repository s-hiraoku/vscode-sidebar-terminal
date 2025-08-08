import { THEME_CONSTANTS } from '../constants';
import type { ThemeColors } from '../types/webview.types';

/**
 * テーマ関連のユーティリティクラス
 */
export const ThemeUtils = {
  /**
   * 現在のVS Codeテーマを検出
   */
  detectTheme(): 'dark' | 'light' {
    const style = getComputedStyle(document.body);

    const bgColor =
      style.getPropertyValue('--vscode-editor-background') ||
      style.getPropertyValue('--vscode-panel-background') ||
      style.backgroundColor;

    console.log('🎨 [THEME] Detected background color:', bgColor);

    let isDark = true; // Default to dark

    if (bgColor) {
      if (bgColor.startsWith('#')) {
        // Handle hex colors
        const hex = bgColor.substring(1);
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        isDark = brightness < 128;
      } else if (bgColor.includes('rgb')) {
        // Handle rgb/rgba colors
        const values = bgColor.match(/\d+/g);
        if (values && values.length >= 3) {
          const r = parseInt(values[0] || '0');
          const g = parseInt(values[1] || '0');
          const b = parseInt(values[2] || '0');
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          isDark = brightness < 128;
        }
      } else if (
        // Handle specific dark theme indicators
        bgColor.includes('1e1e1e') ||
        bgColor.includes('2d2d30') ||
        bgColor.includes('252526')
      ) {
        isDark = true;
      } else if (
        // Handle light theme indicators
        bgColor.includes('ffffff') ||
        bgColor.includes('f3f3f3') ||
        bgColor.includes('fffffe')
      ) {
        isDark = false;
      }
    }

    console.log('🎨 [THEME] Theme detected as:', isDark ? 'dark' : 'light');
    return isDark ? 'dark' : 'light';
  },

  /**
   * テーマに基づいて適切なカラーパレットを取得
   */
  getThemeColors(theme?: 'auto' | 'dark' | 'light'): ThemeColors {
    const detectedTheme = theme === 'auto' ? this.detectTheme() : theme || 'dark';

    const colors =
      detectedTheme === 'dark' ? THEME_CONSTANTS.DARK_THEME : THEME_CONSTANTS.LIGHT_THEME;

    console.log('🎨 [THEME] Applied theme colors:', colors);
    return colors;
  },

  /**
   * VS Code CSS変数から色を取得
   */
  getVSCodeColor(variableName: string, fallback: string): string {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(`--vscode-${variableName}`) || fallback;
  },

  /**
   * 色の明度を計算
   */
  calculateBrightness(color: string): number {
    // RGB値を抽出
    let r: number, g: number, b: number;

    if (color.startsWith('#')) {
      const hex = color.substring(1);
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    } else if (color.includes('rgb')) {
      const values = color.match(/\d+/g);
      if (!values || values.length < 3) return 0;
      r = parseInt(values[0] ?? '0');
      g = parseInt(values[1] ?? '0');
      b = parseInt(values[2] ?? '0');
    } else {
      return 0;
    }

    // 明度を計算（Y = 0.299*R + 0.587*G + 0.114*B）
    return (r * 299 + g * 587 + b * 114) / 1000;
  },

  /**
   * 色が暗いかどうか判定
   */
  isDarkColor(color: string): boolean {
    return this.calculateBrightness(color) < 128;
  },

  /**
   * アクセント色を生成
   */
  generateAccentColor(baseColor: string, factor: number = 0.2): string {
    const brightness = this.calculateBrightness(baseColor);
    const isDark = brightness < 128;

    // 簡易的な色調整（実際の実装では色空間変換が望ましい）
    return isDark ? this.lightenColor(baseColor, factor) : this.darkenColor(baseColor, factor);
  },

  /**
   * 色を明るくする
   */
  lightenColor(color: string, _factor: number): string {
    // 簡易実装：より正確な実装が必要な場合はcolor-manipulationライブラリを使用
    return color; // プレースホルダー
  },

  /**
   * 色を暗くする
   */
  darkenColor(color: string, _factor: number): string {
    // 簡易実装：より正確な実装が必要な場合はcolor-manipulationライブラリを使用
    return color; // プレースホルダー
  },
};
