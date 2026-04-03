/**
 * Terminal Configuration Service
 *
 * Extracted from TerminalCreationService for better maintainability.
 * Manages default terminal configuration and settings.
 */

import { ITerminalOptions, ITheme } from '@xterm/xterm';
import { getVSCodeThemeColors } from '../../types/theme.types';

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
 * Detect platform for platform-specific defaults
 * Falls back to 'linux' in Node.js test environments where navigator is not available
 */
const detectPlatform = (): 'darwin' | 'linux' | 'win32' => {
  // Handle Node.js test environments where navigator is not available
  if (typeof navigator === 'undefined') {
    return 'linux'; // Default to linux for test environments
  }
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'darwin';
  if (userAgent.includes('linux')) return 'linux';
  return 'win32';
};

const parseHexColor = (color: string): { r: number; g: number; b: number } | null => {
  if (!color.startsWith('#')) {
    return null;
  }

  const hex = color.slice(1);
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }

  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
};

const parseRgbColor = (color: string): { r: number; g: number; b: number } | null => {
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
};

const isLightColor = (color: string): boolean | null => {
  const rgb = parseHexColor(color) ?? parseRgbColor(color);
  if (!rgb) {
    return null;
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance >= 0.5;
};

const resolveThemeType = (): 'light' | 'dark' => {
  if (typeof document !== 'undefined' && typeof getComputedStyle !== 'undefined') {
    const computedStyle = getComputedStyle(document.documentElement);
    const background =
      computedStyle.getPropertyValue('--vscode-terminal-background').trim() ||
      computedStyle.getPropertyValue('--vscode-editor-background').trim();
    const isLight = background ? isLightColor(background) : null;

    if (isLight !== null) {
      return isLight ? 'light' : 'dark';
    }
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'dark';
};

/**
 * VS Code Standard Terminal Configuration with all default values
 * Platform-specific adjustments are applied based on OS detection.
 *
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/terminalConfiguration.ts
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts
 */
const createDefaultTerminalConfig = (): WebViewTerminalConfig => {
  const platform = detectPlatform();
  const resolvedTheme = getVSCodeThemeColors(resolveThemeType());

  return {
    // Basic appearance - VS Code standard values
    cursorBlink: true,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontSize: platform === 'darwin' ? 12 : 14, // VS Code: 12 on macOS, 14 elsewhere
    fontWeight: 'normal' as const,
    fontWeightBold: 'bold' as const,
    lineHeight: platform === 'linux' ? 1.1 : 1.0, // VS Code: 1.1 on Linux for underline rendering
    letterSpacing: 0,
    theme: {
      background: resolvedTheme.background,
      foreground: resolvedTheme.foreground,
      cursor: resolvedTheme.cursor,
      cursorAccent: resolvedTheme.cursorAccent,
      selectionBackground: resolvedTheme.selectionBackground,
    } as ITheme,

    // VS Code Standard Options - Core Features
    altClickMovesCursor: true,
    drawBoldTextInBrightColors: true, // VS Code default: true
    minimumContrastRatio: 4.5, // WCAG AA compliance (VS Code default)
    tabStopWidth: 8,
    macOptionIsMeta: false,
    rightClickSelectsWord: true,

    // Scrolling and Navigation - VS Code values
    fastScrollModifier: 'alt' as const,
    fastScrollSensitivity: 5,
    scrollSensitivity: 1,
    scrollback: 2000, // Match package.json default (secondaryTerminal.scrollback)
    scrollOnUserInput: true,

    // Word and Selection - VS Code default separator
    wordSeparator: " ()[]{}',\"`─''|",

    // Rendering Options
    allowTransparency: false,
    rescaleOverlappingGlyphs: true, // VS Code default for better glyph rendering
    allowProposedApi: true,

    // Cursor Configuration - VS Code defaults
    cursorStyle: 'block' as const,
    cursorInactiveStyle: 'outline' as const,
    cursorWidth: 1,

    // Terminal Behavior
    convertEol: false,
    disableStdin: false,
    screenReaderMode: false,

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
};

export const DEFAULT_TERMINAL_CONFIG: WebViewTerminalConfig = createDefaultTerminalConfig();

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
