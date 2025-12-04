/**
 * Unified Theme Type Definitions
 * Centralized theme types to eliminate duplication across the codebase
 */

/**
 * Basic theme colors interface for UI elements
 */
export interface ThemeColors {
  background: string;
  foreground: string;
  border: string;
}

/**
 * Complete terminal theme configuration
 * Used by xterm.js and terminal rendering
 */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent?: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * Terminal theme data (alias for backward compatibility)
 * @deprecated Use TerminalTheme instead
 */
export type TerminalThemeData = TerminalTheme;

/**
 * Theme constants for dark theme
 * Based on VS Code's default dark terminal colors
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts
 */
export const DARK_THEME: TerminalTheme = {
  background: '#1e1e1e', // VS Code editor background (more visible than pure black)
  foreground: '#cccccc',
  cursor: '#aeafad',
  cursorAccent: '#000000',
  selection: 'rgba(38, 79, 120, 0.5)', // VS Code selection with transparency
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
};

/**
 * Theme constants for light theme
 * Based on VS Code's default light terminal colors
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts
 */
export const LIGHT_THEME: TerminalTheme = {
  background: '#ffffff', // VS Code light editor background
  foreground: '#333333',
  cursor: '#000000',
  cursorAccent: '#ffffff',
  selection: 'rgba(173, 214, 255, 0.5)', // VS Code selection with transparency
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
};

/**
 * UI color constants
 */
export const THEME_UI_COLORS = {
  ACTIVE_BORDER_COLOR: '#007acc',
  INACTIVE_BORDER_COLOR: '#464647',
  SEPARATOR_COLOR: '#464647',
} as const;

/**
 * Get terminal theme based on VS Code theme detection
 */
export function detectVSCodeTheme(settings?: { theme?: string }): TerminalTheme {
  // Settings-based theme selection
  if (settings?.theme === 'light') {
    return LIGHT_THEME;
  } else if (settings?.theme === 'dark') {
    return DARK_THEME;
  }

  // VS Code body class detection (only for 'auto' or undefined theme)
  const body = document.body;
  const classList = body.classList;

  if (classList.contains('vscode-light')) {
    return LIGHT_THEME;
  }

  // Default to dark theme
  return DARK_THEME;
}
