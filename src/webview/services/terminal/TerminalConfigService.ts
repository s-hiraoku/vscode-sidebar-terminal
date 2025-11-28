/**
 * Terminal Configuration Service
 *
 * Extracted from TerminalCreationService for better maintainability.
 * Manages default terminal configuration and settings.
 */

import { ITerminalOptions, ITheme } from '@xterm/xterm';

/**
 * Extended terminal configuration for WebView xterm.js instance
 * Uses ITerminalOptions directly for xterm.js compatibility with addon flags
 */
export interface WebViewTerminalConfig extends ITerminalOptions {
  enableGpuAcceleration?: boolean;
  enableSearchAddon?: boolean;
  enableUnicode11?: boolean;
}

/**
 * VS Code Standard Terminal Configuration with all default values
 */
export const DEFAULT_TERMINAL_CONFIG: WebViewTerminalConfig = {
  // Basic appearance
  cursorBlink: true,
  fontFamily: 'monospace',
  fontSize: 14,
  fontWeight: 'normal' as const,
  fontWeightBold: 'bold' as const,
  lineHeight: 1.0,
  letterSpacing: 0,
  theme: {
    background: '#000000',
    foreground: '#ffffff',
  } as ITheme,

  // VS Code Standard Options - Core Features
  altClickMovesCursor: true,
  drawBoldTextInBrightColors: false,
  minimumContrastRatio: 1,
  tabStopWidth: 8,
  macOptionIsMeta: false,
  rightClickSelectsWord: true,

  // Scrolling and Navigation
  fastScrollModifier: 'alt' as const,
  fastScrollSensitivity: 5,
  scrollSensitivity: 1,
  scrollback: 2000,
  scrollOnUserInput: true,

  // Word and Selection
  wordSeparator: ' ()[]{}\'"`,;',

  // Rendering Options
  allowTransparency: false,
  rescaleOverlappingGlyphs: false,
  allowProposedApi: true,

  // Cursor Configuration
  cursorStyle: 'block' as const,
  cursorInactiveStyle: 'outline' as const,
  cursorWidth: 1,

  // Terminal Behavior
  convertEol: false,
  disableStdin: false,
  screenReaderMode: false,

  // Bell Configuration - xterm.js uses bellStyle, not bellSound
  // bellStyle: undefined,

  // Advanced Options
  windowOptions: {
    restoreWin: false,
    minimizeWin: false,
    setWinPosition: false,
    setWinSizePixels: false,
    raiseWin: false,
    lowerWin: false,
    refreshWin: false,
    setWinSizeChars: false,
    maximizeWin: false,
    fullscreenWin: false,
  },

  // Addon Configuration
  enableGpuAcceleration: true,
  enableSearchAddon: true,
  enableUnicode11: true,
};

/**
 * Service for managing terminal configuration
 */
export class TerminalConfigService {
  /**
   * Merge user config with default terminal configuration
   */
  public static mergeConfig(userConfig?: Partial<WebViewTerminalConfig>): WebViewTerminalConfig {
    return { ...DEFAULT_TERMINAL_CONFIG, ...userConfig };
  }

  /**
   * Get default terminal configuration
   */
  public static getDefaultConfig(): WebViewTerminalConfig {
    return { ...DEFAULT_TERMINAL_CONFIG };
  }

  /**
   * Validate terminal configuration
   */
  public static validateConfig(config: Partial<WebViewTerminalConfig>): boolean {
    // Basic validation for critical fields
    if (config.fontSize !== undefined && (config.fontSize < 6 || config.fontSize > 72)) {
      return false;
    }
    if (config.scrollback !== undefined && (config.scrollback < 0 || config.scrollback > 100000)) {
      return false;
    }
    if (config.lineHeight !== undefined && (config.lineHeight < 0.5 || config.lineHeight > 3)) {
      return false;
    }
    return true;
  }
}
