/**
 * FontSettingsService - Single source of truth for font settings management
 *
 * This service centralizes all font-related settings management to prevent
 * synchronization issues between different components.
 *
 * Responsibilities:
 * - Store and manage current font settings (single source of truth)
 * - Apply font settings to terminal instances
 * - Validate and normalize font settings
 * - Notify subscribers when font settings change
 *
 * Architecture:
 * ```
 * Extension (fontSettingsUpdate message)
 *     ↓
 * FontSettingsService.updateFontSettings()
 *     ↓
 * ├── Store in currentFontSettings (single source)
 * ├── Apply to all existing terminals via UIManager
 * └── Notify subscribers (ConfigManager, etc.)
 * ```
 */

import { Terminal } from '@xterm/xterm';
import { WebViewFontSettings } from '../../types/shared';
import { TerminalInstance } from '../interfaces/ManagerInterfaces';
import { webview as log } from '../../utils/logger';

/**
 * Font settings change event
 */
export interface FontSettingsChangeEvent {
  readonly previousSettings: WebViewFontSettings;
  readonly newSettings: WebViewFontSettings;
  readonly timestamp: number;
}

/**
 * Font settings change listener
 */
export type FontSettingsChangeListener = (event: FontSettingsChangeEvent) => void;

/**
 * Interface for applying font settings to terminals
 */
export interface IFontSettingsApplicator {
  applyFontSettings(terminal: Terminal, fontSettings: WebViewFontSettings): void;
}

/**
 * Detect platform for platform-specific defaults
 */
const detectPlatform = (): 'darwin' | 'linux' | 'win32' => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'darwin';
  if (userAgent.includes('linux')) return 'linux';
  return 'win32';
};

/**
 * Default font settings following VS Code terminal defaults
 * Platform-specific adjustments:
 * - macOS: 12px font size (VS Code default)
 * - Linux: lineHeight 1.1 (better underline rendering)
 * - Windows/Other: 14px font size, lineHeight 1.0
 *
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/common/terminalConfiguration.ts
 */
const getDefaultFontSettings = (): WebViewFontSettings => {
  const platform = detectPlatform();
  return {
    fontSize: platform === 'darwin' ? 12 : 14,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontWeight: 'normal',
    fontWeightBold: 'bold',
    lineHeight: platform === 'linux' ? 1.1 : 1.0,
    letterSpacing: 0,
  };
};

const DEFAULT_FONT_SETTINGS: Readonly<WebViewFontSettings> = getDefaultFontSettings();

/**
 * Font settings validation constraints
 */
const FONT_CONSTRAINTS = {
  MIN_FONT_SIZE: 8,
  MAX_FONT_SIZE: 72,
  VALID_FONT_WEIGHTS: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
} as const;

/**
 * FontSettingsService
 *
 * Centralized service for managing font settings across the WebView.
 * Implements the Single Responsibility Principle by handling only font-related concerns.
 */
export class FontSettingsService {
  private currentSettings: WebViewFontSettings;
  private readonly listeners: Set<FontSettingsChangeListener> = new Set();
  private applicator: IFontSettingsApplicator | null = null;

  constructor(initialSettings?: Partial<WebViewFontSettings>) {
    this.currentSettings = this.validateAndNormalize({
      ...DEFAULT_FONT_SETTINGS,
      ...initialSettings,
    });
    log('🔤 [FontSettingsService] Initialized with settings:', this.currentSettings);
  }

  /**
   * Set the font settings applicator (typically UIManager)
   */
  public setApplicator(applicator: IFontSettingsApplicator): void {
    this.applicator = applicator;
    log('🔤 [FontSettingsService] Applicator set');
  }

  /**
   * Get current font settings (immutable copy)
   */
  public getCurrentSettings(): WebViewFontSettings {
    return { ...this.currentSettings };
  }

  /**
   * Update font settings and apply to all terminals
   *
   * This is the main entry point for font settings updates.
   * It validates, stores, applies, and notifies in a single atomic operation.
   */
  public updateSettings(
    newSettings: Partial<WebViewFontSettings>,
    terminals: Map<string, TerminalInstance>
  ): void {
    const previousSettings = { ...this.currentSettings };

    // Merge and validate new settings
    const mergedSettings = {
      ...this.currentSettings,
      ...newSettings,
    };
    this.currentSettings = this.validateAndNormalize(mergedSettings);

    log('🔤 [FontSettingsService] Settings updated:', {
      previous: previousSettings,
      new: this.currentSettings,
    });

    // Apply to all existing terminals
    this.applyToAllTerminals(terminals);

    // Notify listeners
    this.notifyListeners(previousSettings, this.currentSettings);
  }

  /**
   * Apply current font settings to a single terminal
   */
  public applyToTerminal(terminal: Terminal, terminalId: string): void {
    if (!this.applicator) {
      log('⚠️ [FontSettingsService] No applicator set, cannot apply font settings');
      return;
    }

    try {
      this.applicator.applyFontSettings(terminal, this.currentSettings);
      log(`🔤 [FontSettingsService] Applied font settings to terminal: ${terminalId}`);
    } catch (error) {
      log(`❌ [FontSettingsService] Failed to apply font to terminal ${terminalId}:`, error);
    }
  }

  /**
   * Apply current font settings to all terminals
   */
  public applyToAllTerminals(terminals: Map<string, TerminalInstance>): void {
    if (!this.applicator) {
      log('⚠️ [FontSettingsService] No applicator set, cannot apply font settings');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    terminals.forEach((instance, terminalId) => {
      try {
        this.applicator!.applyFontSettings(instance.terminal, this.currentSettings);
        successCount++;
      } catch (error) {
        log(`❌ [FontSettingsService] Failed to apply font to terminal ${terminalId}:`, error);
        errorCount++;
      }
    });

    log(`🔤 [FontSettingsService] Applied font settings to ${successCount} terminals (${errorCount} errors)`);
  }

  /**
   * Subscribe to font settings changes
   */
  public onSettingsChange(listener: FontSettingsChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Validate and normalize font settings
   */
  private validateAndNormalize(settings: WebViewFontSettings): WebViewFontSettings {
    const normalized: WebViewFontSettings = {
      fontSize: DEFAULT_FONT_SETTINGS.fontSize,
      fontFamily: DEFAULT_FONT_SETTINGS.fontFamily,
    };

    // Font size validation
    if (typeof settings.fontSize === 'number') {
      normalized.fontSize = Math.max(
        FONT_CONSTRAINTS.MIN_FONT_SIZE,
        Math.min(FONT_CONSTRAINTS.MAX_FONT_SIZE, Math.round(settings.fontSize))
      );
    }

    // Font family validation
    if (typeof settings.fontFamily === 'string' && settings.fontFamily.trim().length > 0) {
      normalized.fontFamily = settings.fontFamily.trim();
    }

    // Optional properties
    if (settings.fontWeight !== undefined) {
      normalized.fontWeight = this.validateFontWeight(settings.fontWeight);
    }
    if (settings.fontWeightBold !== undefined) {
      normalized.fontWeightBold = this.validateFontWeight(settings.fontWeightBold);
    }
    if (typeof settings.lineHeight === 'number' && settings.lineHeight > 0) {
      normalized.lineHeight = settings.lineHeight;
    }
    if (typeof settings.letterSpacing === 'number') {
      normalized.letterSpacing = settings.letterSpacing;
    }

    return normalized;
  }

  /**
   * Validate font weight value
   */
  private validateFontWeight(weight: string | number | undefined): string {
    if (weight === undefined) {
      return 'normal';
    }

    const weightStr = String(weight);
    const validWeights: readonly string[] = FONT_CONSTRAINTS.VALID_FONT_WEIGHTS;
    if (validWeights.includes(weightStr)) {
      return weightStr;
    }

    return 'normal';
  }

  /**
   * Notify all listeners of settings change
   */
  private notifyListeners(
    previousSettings: WebViewFontSettings,
    newSettings: WebViewFontSettings
  ): void {
    const event: FontSettingsChangeEvent = {
      previousSettings,
      newSettings,
      timestamp: Date.now(),
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        log('❌ [FontSettingsService] Error in change listener:', error);
      }
    });
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.listeners.clear();
    this.applicator = null;
    log('🧹 [FontSettingsService] Disposed');
  }
}
