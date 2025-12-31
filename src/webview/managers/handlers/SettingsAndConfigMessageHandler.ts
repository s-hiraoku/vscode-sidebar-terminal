/**
 * Settings and Config Message Handler
 *
 * Handles settings, configuration, and state updates
 *
 * Refactored to extend RegistryBasedMessageHandler for consistent patterns.
 */

import { RegistryBasedMessageHandler } from './BaseMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';
import { WebViewFontSettings } from '../../../types/shared';
import { DARK_THEME, LIGHT_THEME } from '../../types/theme.types';

/**
 * Settings and Config Message Handler
 *
 * Responsibilities:
 * - Font settings updates
 * - General settings configuration
 * - Version information management
 * - State updates from extension
 */
export class SettingsAndConfigMessageHandler extends RegistryBasedMessageHandler {
  constructor(messageQueue: MessageQueue, logger: ManagerLogger) {
    // RegistryBasedMessageHandler only takes messageQueue and logger
    // We need to pass a dummy messageQueue or adapt
    super(messageQueue, logger);
  }

  /**
   * Register all handlers using the base class pattern
   */
  protected registerHandlers(): void {
    this.registerCommands({
      fontSettingsUpdate: (msg, coord) => this.handleFontSettingsUpdate(msg, coord),
      settingsResponse: (msg, coord) => this.handleSettingsResponse(msg, coord),
      openSettings: (_msg, coord) => coord.openSettings(),
      versionInfo: (msg, coord) => this.handleVersionInfo(msg, coord),
      stateUpdate: (msg, coord) => this.handleStateUpdate(msg, coord),
      themeChanged: (msg, coord) => this.handleThemeChanged(msg, coord),
    }, { category: 'settings' });
  }

  /**
   * Handle font settings update from extension
   */
  private handleFontSettingsUpdate(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const fontSettings = msg.fontSettings as WebViewFontSettings;

    if (fontSettings) {
      coordinator.applyFontSettings(fontSettings);
      this.emitTerminalInteractionEvent('font-settings-update', '', fontSettings, coordinator);
    }
  }

  /**
   * Handle settings response from extension
   */
  private handleSettingsResponse(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const settings = msg.settings;
    if (settings) {
      this.logger.info('Settings response received');
      if (typeof coordinator.applySettings === 'function') {
        coordinator.applySettings(settings);
      }
      this.emitTerminalInteractionEvent('settings-update', '', settings, coordinator);
    }
  }

  /**
   * Handle version info message from Extension
   */
  private handleVersionInfo(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const version = msg.version;
    if (
      version &&
      typeof version === 'string' &&
      typeof coordinator.setVersionInfo === 'function'
    ) {
      coordinator.setVersionInfo(version);
      this.logger.info(`Version info received: ${version}`);
    }
  }

  /**
   * Handle state update message
   */
  private handleStateUpdate(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const state = msg.state;
    if (state) {
      this.logger.info('State update received');

      if ('updateState' in coordinator && typeof coordinator.updateState === 'function') {
        coordinator.updateState(state);
      } else {
        this.logger.warn('updateState method not found on coordinator');
      }
    }
  }

  /**
   * Handle theme change message from Extension
   * This is triggered when VS Code theme changes and settings.theme is 'auto'
   */
  private handleThemeChanged(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const themeValue = msg.theme as 'light' | 'dark' | undefined;

    if (!themeValue) {
      this.logger.warn('themeChanged message missing theme value');
      return;
    }

    this.logger.info(`Theme changed to: ${themeValue}`);

    // Get actual VS Code theme colors from CSS variables
    const vsCodeTheme = this.getVSCodeThemeColors(themeValue);

    // Update all terminal themes with VS Code colors
    if (
      'updateAllTerminalThemes' in coordinator &&
      typeof coordinator.updateAllTerminalThemes === 'function'
    ) {
      coordinator.updateAllTerminalThemes(vsCodeTheme);
    }

    // Update UI components (header, borders, tabs)
    const managers = coordinator.getManagers();
    if (managers.ui && 'updateTheme' in managers.ui && typeof managers.ui.updateTheme === 'function') {
      managers.ui.updateTheme(vsCodeTheme);
    }

    this.emitTerminalInteractionEvent('theme-change', '', { theme: themeValue }, coordinator);
  }

  /**
   * Get VS Code theme colors from CSS variables
   * Falls back to predefined themes if CSS variables are not available
   */
  private getVSCodeThemeColors(themeType: 'light' | 'dark'): typeof DARK_THEME {
    const style = getComputedStyle(document.documentElement);

    // Helper to get CSS variable value with fallback
    const getCssVar = (varName: string, fallback: string): string => {
      const value = style.getPropertyValue(varName).trim();
      return value || fallback;
    };

    // Get base theme for fallbacks
    const baseTheme = themeType === 'dark' ? DARK_THEME : LIGHT_THEME;

    // Build theme from VS Code CSS variables
    return {
      background: getCssVar('--vscode-terminal-background',
                   getCssVar('--vscode-editor-background', baseTheme.background)),
      foreground: getCssVar('--vscode-terminal-foreground',
                   getCssVar('--vscode-editor-foreground', baseTheme.foreground)),
      cursor: getCssVar('--vscode-terminalCursor-foreground', baseTheme.cursor),
      cursorAccent: baseTheme.cursorAccent,
      selectionBackground: getCssVar('--vscode-terminal-selectionBackground', baseTheme.selectionBackground),
      // ANSI colors from VS Code
      black: getCssVar('--vscode-terminal-ansiBlack', baseTheme.black),
      red: getCssVar('--vscode-terminal-ansiRed', baseTheme.red),
      green: getCssVar('--vscode-terminal-ansiGreen', baseTheme.green),
      yellow: getCssVar('--vscode-terminal-ansiYellow', baseTheme.yellow),
      blue: getCssVar('--vscode-terminal-ansiBlue', baseTheme.blue),
      magenta: getCssVar('--vscode-terminal-ansiMagenta', baseTheme.magenta),
      cyan: getCssVar('--vscode-terminal-ansiCyan', baseTheme.cyan),
      white: getCssVar('--vscode-terminal-ansiWhite', baseTheme.white),
      brightBlack: getCssVar('--vscode-terminal-ansiBrightBlack', baseTheme.brightBlack),
      brightRed: getCssVar('--vscode-terminal-ansiBrightRed', baseTheme.brightRed),
      brightGreen: getCssVar('--vscode-terminal-ansiBrightGreen', baseTheme.brightGreen),
      brightYellow: getCssVar('--vscode-terminal-ansiBrightYellow', baseTheme.brightYellow),
      brightBlue: getCssVar('--vscode-terminal-ansiBrightBlue', baseTheme.brightBlue),
      brightMagenta: getCssVar('--vscode-terminal-ansiBrightMagenta', baseTheme.brightMagenta),
      brightCyan: getCssVar('--vscode-terminal-ansiBrightCyan', baseTheme.brightCyan),
      brightWhite: getCssVar('--vscode-terminal-ansiBrightWhite', baseTheme.brightWhite),
    };
  }

  /**
   * Emit terminal interaction event
   */
  private emitTerminalInteractionEvent(
    eventType: string,
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void {
    if (
      'emitTerminalInteractionEvent' in coordinator &&
      typeof coordinator.emitTerminalInteractionEvent === 'function'
    ) {
      coordinator.emitTerminalInteractionEvent(eventType, terminalId, data);
    }
  }
}
