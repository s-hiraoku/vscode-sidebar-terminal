import { ITerminalOptions, Terminal } from '@xterm/xterm';
import {
  PartialTerminalSettings,
  TerminalConfig,
  WebViewFontSettings,
} from '../../../types/shared';
import { IConfigManager } from '../../interfaces/ManagerInterfaces';
import { terminalLogger } from '../../utils/ManagerLogger';
import { getWebviewTheme } from '../../utils/WebviewThemeUtils';
import { TerminalConfigService, WebViewTerminalConfig } from './TerminalConfigService';

interface ICoordinatorDependencies {
  currentSettings?: PartialTerminalSettings;
}

export interface IDependencies {
  coordinator: ICoordinatorDependencies;
}

type TerminalConfigManager = Pick<IConfigManager, 'getCurrentFontSettings' | 'getCurrentSettings'>;

const FontDefaults = {
  FONT_WEIGHT: 'normal',
  FONT_WEIGHT_BOLD: 'bold',
  LINE_HEIGHT: 1,
  LETTER_SPACING: 0,
} as const;

const CssClasses = {
  XTERM: 'xterm',
  XTERM_VIEWPORT: 'xterm-viewport',
} as const;

const POST_RENDERER_SETUP_DELAY_MS = 200;

export class TerminalAppearanceService {
  constructor(private readonly dependencies: IDependencies) {}

  public prepareTerminalConfig(
    config: TerminalConfig | undefined,
    configManager: TerminalConfigManager | undefined
  ): {
    terminalConfig: WebViewTerminalConfig;
    currentSettings: PartialTerminalSettings | undefined;
    currentFontSettings: WebViewFontSettings | undefined;
    linkModifier: 'alt' | 'ctrlCmd';
  } {
    const { fontSettings: currentFontSettings, fontOverrides } = this.prepareFontSettings(
      config,
      configManager
    );
    const currentSettings = this.resolveCurrentSettings(configManager);
    const resolvedTheme = getWebviewTheme(currentSettings);
    terminalLogger.info(
      `🎨 [THEME] Creating terminal with theme: ${currentSettings?.theme} -> bg=${resolvedTheme.background}`
    );

    const configWithFonts = {
      ...(config as Parameters<typeof TerminalConfigService.mergeConfig>[0]),
      ...fontOverrides,
      theme: resolvedTheme,
    };
    const terminalConfig = TerminalConfigService.mergeConfig(configWithFonts);

    const multiCursorModifier = currentSettings?.multiCursorModifier ?? 'alt';
    const linkModifier: 'alt' | 'ctrlCmd' = multiCursorModifier === 'alt' ? 'alt' : 'ctrlCmd';

    return { terminalConfig, currentSettings, currentFontSettings, linkModifier };
  }

  public applyPostOpenSettings(params: {
    terminalId: string;
    terminal: Terminal;
    container: HTMLElement;
    terminalContent: HTMLElement;
    currentSettings: unknown;
    currentFontSettings: unknown;
    configManager: TerminalConfigManager | undefined;
    uiManager:
      | {
          applyAllVisualSettings?: (terminal: Terminal, settings: unknown) => void;
          applyFontSettings?: (terminal: Terminal, settings: unknown) => void;
        }
      | null
      | undefined;
  }): void {
    const {
      terminalId,
      terminal,
      container,
      terminalContent,
      currentSettings,
      currentFontSettings,
      configManager,
      uiManager,
    } = params;

    try {
      if (!uiManager) {
        return;
      }

      const settingsForVisuals = currentSettings ?? configManager?.getCurrentSettings?.();
      const fontSettingsForApply = currentFontSettings ?? configManager?.getCurrentFontSettings?.();

      terminalLogger.info(
        `🎨 [DEBUG] Immediate settings check - theme: ${(settingsForVisuals as { theme?: string } | undefined)?.theme}`
      );

      if (settingsForVisuals) {
        uiManager.applyAllVisualSettings?.(terminal, settingsForVisuals);
        terminalLogger.info(`✅ Visual settings applied to terminal: ${terminalId}`);
        this.updateContainerBackgrounds(
          terminalId,
          container,
          terminalContent,
          settingsForVisuals as { theme?: string } | null | undefined
        );
      }

      if (fontSettingsForApply) {
        uiManager.applyFontSettings?.(terminal, fontSettingsForApply);
        const fontSettings = fontSettingsForApply as Partial<WebViewFontSettings>;
        terminalLogger.info(
          `✅ Font settings applied to terminal: ${terminalId} (${fontSettings.fontFamily}, ${fontSettings.fontSize}px)`
        );
      }
    } catch (error) {
      terminalLogger.warn(
        '⚠️ Terminal settings application failed; continuing with defaults',
        error
      );
    }
  }

  public schedulePostRendererRefresh(params: {
    terminalId: string;
    terminal: Terminal;
    container: HTMLElement;
    terminalContent: HTMLElement;
    configManager: Pick<IConfigManager, 'getCurrentSettings'> | undefined;
    uiManager:
      | {
          applyTerminalTheme?: (terminal: Terminal, settings: unknown) => void;
        }
      | null
      | undefined;
  }): void {
    const { terminalId, terminal, container, terminalContent, configManager, uiManager } = params;

    setTimeout(() => {
      try {
        const finalSettings = configManager?.getCurrentSettings?.();
        terminalLogger.info(
          `🎨 [DEBUG] Final theme check - currentSettings.theme: ${finalSettings?.theme}`
        );

        if (uiManager && finalSettings) {
          uiManager.applyTerminalTheme?.(terminal, finalSettings);
          terminalLogger.info(`🎨 Final theme re-application for terminal: ${terminalId}`);
          this.updateContainerBackgrounds(terminalId, container, terminalContent, finalSettings);
        }

        terminal.refresh(0, terminal.rows - 1);
        terminalLogger.info(`🔄 Final terminal refresh completed: ${terminalId}`);
      } catch (error) {
        terminalLogger.warn(`⚠️ Final refresh failed for terminal ${terminalId}:`, error);
      }
    }, POST_RENDERER_SETUP_DELAY_MS);
  }

  private resolveCurrentSettings(
    configManager: Pick<IConfigManager, 'getCurrentSettings'> | undefined
  ): PartialTerminalSettings | undefined {
    let currentSettings = configManager?.getCurrentSettings?.();

    if (!currentSettings?.theme || currentSettings.theme === 'auto') {
      const coordinatorSettings = this.dependencies.coordinator.currentSettings;
      if (coordinatorSettings?.theme && coordinatorSettings.theme !== 'auto') {
        currentSettings = { ...currentSettings, ...coordinatorSettings };
        terminalLogger.info(
          `🎨 [THEME] Using coordinator settings (theme: ${coordinatorSettings.theme})`
        );
      }
    }

    return currentSettings;
  }

  private prepareFontSettings(
    config: TerminalConfig | undefined,
    configManager: Pick<IConfigManager, 'getCurrentFontSettings'> | undefined
  ): { fontSettings: WebViewFontSettings | undefined; fontOverrides: Partial<ITerminalOptions> } {
    const configFontSettings = (config as { fontSettings?: WebViewFontSettings } | undefined)
      ?.fontSettings;
    const directFontFamily = (config as { fontFamily?: string } | undefined)?.fontFamily;
    const directFontSize = (config as { fontSize?: number } | undefined)?.fontSize;

    let currentFontSettings: WebViewFontSettings | undefined;
    if (directFontFamily || directFontSize) {
      const fallbackFontSettings = configManager?.getCurrentFontSettings?.();
      currentFontSettings = {
        fontFamily:
          directFontFamily ||
          configFontSettings?.fontFamily ||
          fallbackFontSettings?.fontFamily ||
          'monospace',
        fontSize:
          directFontSize || configFontSettings?.fontSize || fallbackFontSettings?.fontSize || 14,
        fontWeight:
          (config as { fontWeight?: string } | undefined)?.fontWeight ||
          configFontSettings?.fontWeight ||
          FontDefaults.FONT_WEIGHT,
        fontWeightBold:
          (config as { fontWeightBold?: string } | undefined)?.fontWeightBold ||
          configFontSettings?.fontWeightBold ||
          FontDefaults.FONT_WEIGHT_BOLD,
        lineHeight:
          (config as { lineHeight?: number } | undefined)?.lineHeight ||
          configFontSettings?.lineHeight ||
          FontDefaults.LINE_HEIGHT,
        letterSpacing:
          (config as { letterSpacing?: number } | undefined)?.letterSpacing ??
          configFontSettings?.letterSpacing ??
          FontDefaults.LETTER_SPACING,
      };
    } else if (configFontSettings) {
      currentFontSettings = configFontSettings;
    } else {
      currentFontSettings = configManager?.getCurrentFontSettings?.();
    }

    const fontOverrides: Partial<ITerminalOptions> = {};
    if (currentFontSettings) {
      if (
        typeof currentFontSettings.fontFamily === 'string' &&
        currentFontSettings.fontFamily.trim()
      ) {
        fontOverrides.fontFamily = currentFontSettings.fontFamily.trim();
      }
      if (typeof currentFontSettings.fontSize === 'number' && currentFontSettings.fontSize > 0) {
        fontOverrides.fontSize = currentFontSettings.fontSize;
      }
      if (
        typeof currentFontSettings.fontWeight === 'string' &&
        currentFontSettings.fontWeight.trim()
      ) {
        fontOverrides.fontWeight =
          currentFontSettings.fontWeight.trim() as ITerminalOptions['fontWeight'];
      }
      if (
        typeof currentFontSettings.fontWeightBold === 'string' &&
        currentFontSettings.fontWeightBold.trim()
      ) {
        fontOverrides.fontWeightBold =
          currentFontSettings.fontWeightBold.trim() as ITerminalOptions['fontWeightBold'];
      }
      if (
        typeof currentFontSettings.lineHeight === 'number' &&
        currentFontSettings.lineHeight > 0
      ) {
        fontOverrides.lineHeight = currentFontSettings.lineHeight;
      }
      if (typeof currentFontSettings.letterSpacing === 'number') {
        fontOverrides.letterSpacing = currentFontSettings.letterSpacing;
      }
      if (currentFontSettings.cursorStyle) {
        fontOverrides.cursorStyle = currentFontSettings.cursorStyle;
      }
      if (
        typeof currentFontSettings.cursorWidth === 'number' &&
        currentFontSettings.cursorWidth > 0
      ) {
        fontOverrides.cursorWidth = currentFontSettings.cursorWidth;
      }
      if (typeof currentFontSettings.drawBoldTextInBrightColors === 'boolean') {
        fontOverrides.drawBoldTextInBrightColors = currentFontSettings.drawBoldTextInBrightColors;
      }
      if (typeof currentFontSettings.minimumContrastRatio === 'number') {
        fontOverrides.minimumContrastRatio = currentFontSettings.minimumContrastRatio;
      }
    }

    return { fontSettings: currentFontSettings, fontOverrides };
  }

  private updateContainerBackgrounds(
    terminalId: string,
    container: HTMLElement | null,
    terminalContent: HTMLElement | null,
    settings: { theme?: string } | null | undefined
  ): void {
    if (!settings) {
      return;
    }

    const resolvedTheme = getWebviewTheme(settings);
    const backgroundColor = resolvedTheme.background;

    if (terminalContent) {
      terminalContent.style.backgroundColor = backgroundColor;
    }
    if (container) {
      const xtermElement = container.querySelector<HTMLElement>(`.${CssClasses.XTERM}`);
      if (xtermElement) {
        xtermElement.style.backgroundColor = backgroundColor;
      }
      const viewport = container.querySelector<HTMLElement>(`.${CssClasses.XTERM_VIEWPORT}`);
      if (viewport) {
        viewport.style.backgroundColor = backgroundColor;
      }
    }
    terminalLogger.info(`🎨 Container backgrounds updated: ${terminalId} (${backgroundColor})`);
  }
}
