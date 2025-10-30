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
 */
export const DARK_THEME: TerminalTheme = {
  background: '#0c0c0c', // VS Code standard terminal background
  foreground: '#cccccc',
  cursor: '#cccccc',
  cursorAccent: '#000000',
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
};

/**
 * Theme constants for light theme
 */
export const LIGHT_THEME: TerminalTheme = {
  background: '#f8f8f8', // VS Code standard light terminal background
  foreground: '#333333',
  cursor: '#333333',
  cursorAccent: '#ffffff',
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
 * Get CSS variable value from VS Code
 */
function getCSSVariable(name: string, fallback: string): string {
  if (typeof window === 'undefined' || !document.documentElement) {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Get terminal theme from VS Code CSS variables
 * This dynamically reads the current VS Code theme colors
 */
export function getVSCodeThemeColors(): TerminalTheme {
  return {
    background: getCSSVariable('--vscode-terminal-background', '#1e1e1e'),
    foreground: getCSSVariable('--vscode-terminal-foreground', '#cccccc'),
    cursor: getCSSVariable('--vscode-terminalCursor-foreground', '#cccccc'),
    cursorAccent: getCSSVariable('--vscode-terminalCursor-background', '#000000'),
    selection: getCSSVariable('--vscode-terminal-selectionBackground', '#264f78'),
    black: getCSSVariable('--vscode-terminal-ansiBlack', '#000000'),
    red: getCSSVariable('--vscode-terminal-ansiRed', '#cd3131'),
    green: getCSSVariable('--vscode-terminal-ansiGreen', '#0dbc79'),
    yellow: getCSSVariable('--vscode-terminal-ansiYellow', '#e5e510'),
    blue: getCSSVariable('--vscode-terminal-ansiBlue', '#2472c8'),
    magenta: getCSSVariable('--vscode-terminal-ansiMagenta', '#bc3fbc'),
    cyan: getCSSVariable('--vscode-terminal-ansiCyan', '#11a8cd'),
    white: getCSSVariable('--vscode-terminal-ansiWhite', '#e5e5e5'),
    brightBlack: getCSSVariable('--vscode-terminal-ansiBrightBlack', '#666666'),
    brightRed: getCSSVariable('--vscode-terminal-ansiBrightRed', '#f14c4c'),
    brightGreen: getCSSVariable('--vscode-terminal-ansiBrightGreen', '#23d18b'),
    brightYellow: getCSSVariable('--vscode-terminal-ansiBrightYellow', '#f5f543'),
    brightBlue: getCSSVariable('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
    brightMagenta: getCSSVariable('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
    brightCyan: getCSSVariable('--vscode-terminal-ansiBrightCyan', '#29b8db'),
    brightWhite: getCSSVariable('--vscode-terminal-ansiBrightWhite', '#e5e5e5'),
  };
}

/**
 * Get terminal theme based on VS Code theme detection
 */
export function detectVSCodeTheme(settings?: { theme?: string }): TerminalTheme {
  // Settings-based theme selection with fallback to static themes
  if (settings?.theme === 'light') {
    return LIGHT_THEME;
  } else if (settings?.theme === 'dark') {
    return DARK_THEME;
  } else if (settings?.theme === 'auto' || !settings?.theme) {
    // Auto mode: Use dynamic VS Code theme colors
    return getVSCodeThemeColors();
  }

  // VS Code body class detection (fallback)
  const body = document.body;
  const classList = body.classList;

  if (classList.contains('vscode-light')) {
    return LIGHT_THEME;
  }

  // Default to dynamic theme
  return getVSCodeThemeColors();
}
