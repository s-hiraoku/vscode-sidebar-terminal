/**
 * WebView用テーマユーティリティ
 */

export const WEBVIEW_THEME_CONSTANTS = {
  DARK_THEME: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#000000',
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
    brightWhite: '#ffffff',
  },
  LIGHT_THEME: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    cursorAccent: '#ffffff',
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
};

export function getWebviewTheme(): { [key: string]: string } {
  // VS Code provides CSS variables for theme detection
  const style = getComputedStyle(document.body);

  // Get the background color and convert to RGB values
  const bgColor =
    style.getPropertyValue('--vscode-editor-background') ||
    style.getPropertyValue('--vscode-panel-background') ||
    style.backgroundColor;

  console.log('🎨 [WEBVIEW] Detected background color:', bgColor);

  // Check if dark theme by analyzing background color
  let isDark = true; // Default to dark

  if (bgColor) {
    // Handle hex colors
    if (bgColor.startsWith('#')) {
      const hex = bgColor.substring(1);
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      isDark = brightness < 128;
    }
    // Handle rgb/rgba colors
    else if (bgColor.includes('rgb')) {
      const values = bgColor.match(/\d+/g);
      if (values && values.length >= 3) {
        const r = parseInt(values[0] || '0');
        const g = parseInt(values[1] || '0');
        const b = parseInt(values[2] || '0');
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        isDark = brightness < 128;
      }
    }
    // Handle specific dark theme indicators
    else if (
      bgColor.includes('1e1e1e') ||
      bgColor.includes('2d2d30') ||
      bgColor.includes('252526')
    ) {
      isDark = true;
    }
    // Handle light theme indicators
    else if (
      bgColor.includes('ffffff') ||
      bgColor.includes('f3f3f3') ||
      bgColor.includes('fffffe')
    ) {
      isDark = false;
    }
  }

  console.log('🎨 [WEBVIEW] Theme detected as:', isDark ? 'dark' : 'light');

  const theme = isDark ? WEBVIEW_THEME_CONSTANTS.DARK_THEME : WEBVIEW_THEME_CONSTANTS.LIGHT_THEME;
  console.log('🎨 [WEBVIEW] Applied theme:', theme);

  return theme;
}
