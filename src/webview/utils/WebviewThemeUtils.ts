/**
 * WebView用テーマユーティリティ
 */

export const WEBVIEW_THEME_CONSTANTS = {
  DARK_THEME: {
    background: '#0c0c0c', // 🎯 FIX: VS Code標準ターミナル背景色に変更
    foreground: '#cccccc',
    cursor: '#cccccc',
    selection: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5',
  },
  LIGHT_THEME: {
    background: '#f8f8f8', // 🎯 FIX: VS Code標準ライトターミナル背景色に変更
    foreground: '#333333',
    cursor: '#333333',
    selection: '#add6ff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  },
  // UI constants
  ACTIVE_BORDER_COLOR: '#007acc',
  INACTIVE_BORDER_COLOR: '#464647',
  SEPARATOR_COLOR: '#464647',
};

/**
 * Terminal theme type
 */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  [key: string]: string;
}

/**
 * VS Code テーマを取得
 */
export function getWebviewTheme(settings?: { theme?: string }): TerminalTheme {
  // Settings-based theme selection
  if (settings?.theme === 'light') {
    return WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
  } else if (settings?.theme === 'dark') {
    return WEBVIEW_THEME_CONSTANTS.DARK_THEME;
  }

  // VS Code の body クラスを確認してテーマを判定
  const body = document.body;
  const classList = body.classList;

  // VS Code は 'vscode-dark' または 'vscode-light' クラスを body に設定する
  if (classList.contains('vscode-dark')) {
    return WEBVIEW_THEME_CONSTANTS.DARK_THEME;
  } else if (classList.contains('vscode-light')) {
    return WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
  }

  // デフォルトはダークテーマ
  return WEBVIEW_THEME_CONSTANTS.DARK_THEME;
}
