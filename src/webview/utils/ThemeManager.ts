/**
 * ThemeManager Utility
 * Centralized theme and styling management with VS Code integration
 */

import { ThemeColors, TerminalTheme, DARK_THEME } from '../types/theme.types';

/**
 * Centralized theme manager for VS Code integration
 * Provides consistent color management across all components
 */
export class ThemeManager {
  private static isInitialized = false;
  private static themeColors: ThemeColors = {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    border: '#454545',
  };

  /**
   * Initialize the theme manager
   */
  public static initialize(): void {
    try {
      if (this.isInitialized) {
        return;
      }

      // Update theme colors from CSS custom properties
      this.updateThemeColors();
      this.isInitialized = true;
    } catch (error) {
      console.warn('ThemeManager initialization failed:', error);
      // Continue with default colors
      this.isInitialized = true;
    }
  }

  /**
   * Get current theme colors
   */
  public static getThemeColors(): ThemeColors {
    if (!this.isInitialized) {
      this.initialize();
    }
    return { ...this.themeColors };
  }

  /**
   * Apply theme to an element
   */
  public static applyTheme(element: HTMLElement, customTheme?: Partial<ThemeColors>): void {
    if (!element) {
      return;
    }

    const colors = customTheme || this.getThemeColors();

    if (colors.background) {
      element.style.background = colors.background;
    }
    if (colors.foreground) {
      element.style.color = colors.foreground;
    }
    if (colors.border) {
      element.style.borderColor = colors.border;
    }
  }

  /**
   * Get VS Code CSS custom property value
   */
  public static getVSCodeColor(property: string, fallback: string = '#1e1e1e'): string {
    try {
      if (!property || typeof document === 'undefined') {
        return fallback;
      }

      const root = document.documentElement;
      if (!root || !getComputedStyle) {
        return fallback;
      }

      const value = getComputedStyle(root).getPropertyValue(property).trim();
      return value || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Create terminal theme from VS Code colors
   */
  public static createTerminalTheme(overrides?: Partial<TerminalTheme>): TerminalTheme {
    const colors = this.getThemeColors();

    // Use DARK_THEME as base and override with VS Code colors
    const defaultTheme: TerminalTheme = {
      ...DARK_THEME,
      background: colors.background,
      foreground: colors.foreground,
      cursor: this.getVSCodeColor('--vscode-terminalCursor-foreground', DARK_THEME.cursor),
      selection: this.getVSCodeColor('--vscode-terminal-selectionBackground', DARK_THEME.selection),
    };

    return { ...defaultTheme, ...overrides };
  }

  /**
   * Update element theme by selector
   */
  public static updateElementTheme(selector: string, styles: Partial<CSSStyleDeclaration>): void {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      elements.forEach((element) => {
        Object.assign(element.style, styles);
      });
    } catch (error) {
      console.warn('Failed to update element theme:', error);
    }
  }

  /**
   * Get all VS Code theme variables
   */
  public static getThemeVariables(): Record<string, string> {
    const variables: Record<string, string> = {};

    try {
      if (typeof document === 'undefined' || !getComputedStyle) {
        return variables;
      }

      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);

      // Common VS Code variables
      const vsCodeProperties = [
        '--vscode-editor-background',
        '--vscode-editor-foreground',
        '--vscode-widget-border',
        '--vscode-focusBorder',
        '--vscode-button-background',
        '--vscode-button-foreground',
        '--vscode-input-background',
        '--vscode-input-foreground',
        '--vscode-list-activeSelectionBackground',
        '--vscode-list-hoverBackground',
        '--vscode-terminal-foreground',
        '--vscode-terminal-background',
        '--vscode-terminalCursor-foreground',
        '--vscode-terminal-selectionBackground',
      ];

      vsCodeProperties.forEach((property) => {
        const value = computedStyle.getPropertyValue(property).trim();
        if (value) {
          variables[property] = value;
        }
      });
    } catch (error) {
      console.warn('Failed to get theme variables:', error);
    }

    return variables;
  }

  /**
   * Update theme colors from CSS custom properties
   */
  private static updateThemeColors(): void {
    this.themeColors = {
      background: this.getVSCodeColor('--vscode-editor-background', '#1e1e1e'),
      foreground: this.getVSCodeColor('--vscode-editor-foreground', '#d4d4d4'),
      border: this.getVSCodeColor('--vscode-widget-border', '#454545'),
    };
  }

  /**
   * Dispose of theme manager
   */
  public static dispose(): void {
    this.isInitialized = false;
    this.themeColors = {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      border: '#454545',
    };
  }
}
