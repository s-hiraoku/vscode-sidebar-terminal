/**
 * ThemeManager Utility
 * Centralized theme and styling management with VS Code integration
 */

/**
 * Theme colors interface
 */
export interface ThemeColors {
  background: string;
  foreground: string;
  border: string;
}

/**
 * Terminal theme configuration
 */
export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
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
 * Centralized theme manager for VS Code integration
 * Provides consistent color management across all components
 */
export class ThemeManager {
  private static isInitialized = false;
  private static themeColors: ThemeColors = {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    border: '#454545'
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
  public static applyTheme(
    element: HTMLElement,
    customTheme?: Partial<ThemeColors>
  ): void {
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
    } catch (error) {
      return fallback;
    }
  }

  /**
   * Create terminal theme from VS Code colors
   */
  public static createTerminalTheme(overrides?: Partial<TerminalTheme>): TerminalTheme {
    const colors = this.getThemeColors();

    const defaultTheme: TerminalTheme = {
      background: colors.background,
      foreground: colors.foreground,
      cursor: this.getVSCodeColor('--vscode-terminalCursor-foreground', '#ffffff'),
      selection: this.getVSCodeColor('--vscode-terminal-selectionBackground', '#264f78'),
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
      brightWhite: '#e5e5e5'
    };

    return { ...defaultTheme, ...overrides };
  }

  /**
   * Update element theme by selector
   */
  public static updateElementTheme(
    selector: string,
    styles: Partial<CSSStyleDeclaration>
  ): void {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      elements.forEach(element => {
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
        '--vscode-terminal-selectionBackground'
      ];

      vsCodeProperties.forEach(property => {
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
      border: this.getVSCodeColor('--vscode-widget-border', '#454545')
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
      border: '#454545'
    };
  }
}