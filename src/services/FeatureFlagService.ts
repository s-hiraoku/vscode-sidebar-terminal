/**
 * Feature Flag Service - VS Code Standard Terminal Features
 * Manages feature flags for gradual rollout of VS Code-compatible terminal features
 */

import * as vscode from 'vscode';

/**
 * Feature flag configuration for VS Code standard terminal features
 */
export interface FeatureFlagConfig {
  // Scrollback features
  enhancedScrollbackPersistence: boolean;
  scrollbackLineLimit: number;

  // Input features
  vscodeStandardIME: boolean;
  vscodeKeyboardShortcuts: boolean;

  // Display features
  vscodeStandardCursor: boolean;
  fullANSISupport: boolean;
}

/**
 * Default feature flag values (Phase 1-5: disabled by default, Phase 7: enabled)
 */
const DEFAULT_FEATURE_FLAGS: FeatureFlagConfig = {
  // Scrollback features
  enhancedScrollbackPersistence: false, // v0.2.0: true
  scrollbackLineLimit: 1000,

  // Input features
  vscodeStandardIME: false, // v0.2.0: true
  vscodeKeyboardShortcuts: true, // Already stable

  // Display features
  vscodeStandardCursor: false, // v0.2.0: true
  fullANSISupport: true, // Already stable
};

/**
 * Configuration section for feature flags
 */
const FEATURE_FLAG_SECTION = 'secondaryTerminal.features';

/**
 * Service for managing VS Code standard terminal feature flags
 */
export class FeatureFlagService implements vscode.Disposable {
  private flagCache: Map<string, boolean | number> = new Map();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Listen for configuration changes and invalidate cache
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(FEATURE_FLAG_SECTION)) {
          this.invalidateCache();
        }
      })
    );
  }

  /**
   * Get feature flag configuration
   */
  public getFeatureFlags(): FeatureFlagConfig {
    const config = vscode.workspace.getConfiguration(FEATURE_FLAG_SECTION);

    return {
      enhancedScrollbackPersistence: this.getCachedFlag(
        'enhancedScrollbackPersistence',
        config.get<boolean>(
          'enhancedScrollbackPersistence',
          DEFAULT_FEATURE_FLAGS.enhancedScrollbackPersistence
        )
      ) as boolean,

      scrollbackLineLimit: this.validateScrollbackLimit(
        this.getCachedFlag(
          'scrollbackLineLimit',
          config.get<number>(
            'scrollbackLineLimit',
            DEFAULT_FEATURE_FLAGS.scrollbackLineLimit
          )
        ) as number
      ),

      vscodeStandardIME: this.getCachedFlag(
        'vscodeStandardIME',
        config.get<boolean>(
          'vscodeStandardIME',
          DEFAULT_FEATURE_FLAGS.vscodeStandardIME
        )
      ) as boolean,

      vscodeKeyboardShortcuts: this.getCachedFlag(
        'vscodeKeyboardShortcuts',
        config.get<boolean>(
          'vscodeKeyboardShortcuts',
          DEFAULT_FEATURE_FLAGS.vscodeKeyboardShortcuts
        )
      ) as boolean,

      vscodeStandardCursor: this.getCachedFlag(
        'vscodeStandardCursor',
        config.get<boolean>(
          'vscodeStandardCursor',
          DEFAULT_FEATURE_FLAGS.vscodeStandardCursor
        )
      ) as boolean,

      fullANSISupport: this.getCachedFlag(
        'fullANSISupport',
        config.get<boolean>('fullANSISupport', DEFAULT_FEATURE_FLAGS.fullANSISupport)
      ) as boolean,
    };
  }

  /**
   * Check if enhanced scrollback persistence is enabled
   */
  public isEnhancedScrollbackEnabled(): boolean {
    return this.getFeatureFlags().enhancedScrollbackPersistence;
  }

  /**
   * Get scrollback line limit (clamped to 200-3000)
   */
  public getScrollbackLineLimit(): number {
    return this.getFeatureFlags().scrollbackLineLimit;
  }

  /**
   * Check if VS Code standard IME is enabled
   */
  public isVSCodeStandardIMEEnabled(): boolean {
    return this.getFeatureFlags().vscodeStandardIME;
  }

  /**
   * Check if VS Code keyboard shortcuts are enabled
   */
  public isVSCodeKeyboardShortcutsEnabled(): boolean {
    return this.getFeatureFlags().vscodeKeyboardShortcuts;
  }

  /**
   * Check if VS Code standard cursor is enabled
   */
  public isVSCodeStandardCursorEnabled(): boolean {
    return this.getFeatureFlags().vscodeStandardCursor;
  }

  /**
   * Check if full ANSI support is enabled
   */
  public isFullANSISupportEnabled(): boolean {
    return this.getFeatureFlags().fullANSISupport;
  }

  /**
   * Get cached flag value with type safety
   */
  private getCachedFlag(key: string, defaultValue: boolean | number): boolean | number {
    if (!this.flagCache.has(key)) {
      this.flagCache.set(key, defaultValue);
    }
    return this.flagCache.get(key)!;
  }

  /**
   * Validate and clamp scrollback line limit to allowed range
   */
  private validateScrollbackLimit(limit: number): number {
    const MIN_SCROLLBACK = 200;
    const MAX_SCROLLBACK = 3000;

    if (limit < MIN_SCROLLBACK) {
      vscode.window.showWarningMessage(
        `Scrollback line limit ${limit} is below minimum ${MIN_SCROLLBACK}. Using ${MIN_SCROLLBACK}.`
      );
      return MIN_SCROLLBACK;
    }

    if (limit > MAX_SCROLLBACK) {
      vscode.window.showWarningMessage(
        `Scrollback line limit ${limit} exceeds maximum ${MAX_SCROLLBACK}. Using ${MAX_SCROLLBACK}.`
      );
      return MAX_SCROLLBACK;
    }

    return limit;
  }

  /**
   * Invalidate cache (called on configuration changes)
   */
  private invalidateCache(): void {
    this.flagCache.clear();
  }

  /**
   * Get feature flag summary for logging/debugging
   */
  public getFeatureFlagSummary(): string {
    const flags = this.getFeatureFlags();
    return JSON.stringify(flags, null, 2);
  }

  /**
   * Dispose service and clean up listeners
   */
  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.flagCache.clear();
  }
}
