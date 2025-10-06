/**
 * WebView Theme Utilities
 * @deprecated Use theme.types.ts for unified theme definitions
 */

import {
  TerminalTheme,
  DARK_THEME,
  LIGHT_THEME,
  THEME_UI_COLORS,
  detectVSCodeTheme,
} from '../types/theme.types';

/**
 * WebView theme constants
 * @deprecated Import directly from theme.types.ts
 */
export const WEBVIEW_THEME_CONSTANTS = {
  DARK_THEME,
  LIGHT_THEME,
  ...THEME_UI_COLORS,
};

/**
 * Get WebView theme
 * @deprecated Use detectVSCodeTheme from theme.types.ts
 */
export function getWebviewTheme(settings?: { theme?: string }): TerminalTheme {
  return detectVSCodeTheme(settings);
}

// Re-export for backward compatibility
export { TerminalTheme, DARK_THEME, LIGHT_THEME, THEME_UI_COLORS };
