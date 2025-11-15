/**
 * Panel Location Service
 *
 * Manages panel location detection and split direction determination
 * Extracted from SecondaryTerminalProvider for better separation of concerns
 */

import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';

/**
 * Panel location type for WebView placement
 * - 'sidebar': WebView is displayed in the sidebar (narrow and tall)
 * - 'panel': WebView is displayed in the bottom panel (wide and short)
 */
export type PanelLocation = 'sidebar' | 'panel';

/**
 * Split direction type for terminal layout
 * - 'horizontal': Terminals are arranged side by side (left/right)
 * - 'vertical': Terminals are stacked vertically (top/bottom)
 */
export type SplitDirection = 'horizontal' | 'vertical';

/**
 * Type guard to check if a value is a valid PanelLocation
 */
export function isPanelLocation(value: unknown): value is PanelLocation {
  return value === 'sidebar' || value === 'panel';
}

/**
 * Panel Location Service
 *
 * Responsibilities:
 * - Panel location detection and caching
 * - Split direction determination based on layout
 * - Context key management for VS Code when clauses
 * - Panel location change notifications
 */
export class PanelLocationService implements vscode.Disposable {
  /**
   * Configuration keys for panel location settings
   */
  private static readonly CONFIG_KEYS = {
    DYNAMIC_SPLIT_DIRECTION: 'dynamicSplitDirection',
    PANEL_LOCATION: 'panelLocation',
  } as const;

  /**
   * VS Code context key for panel location
   */
  private static readonly CONTEXT_KEY = 'secondaryTerminal.panelLocation';

  /**
   * Debounce delay for panel location detection requests (ms)
   */
  private static readonly DEBOUNCE_DELAY = 300;

  private readonly _disposables: vscode.Disposable[] = [];

  /**
   * Cached panel location reported by WebView
   */
  private _cachedPanelLocation: PanelLocation = 'sidebar';

  /**
   * Callback for sending messages to WebView
   */
  private readonly _sendMessage: (message: unknown) => Promise<void>;

  /**
   * Debounce timer for panel location detection requests
   */
  private _detectionDebounceTimer: NodeJS.Timeout | null = null;

  constructor(sendMessage: (message: unknown) => Promise<void>) {
    this._sendMessage = sendMessage;
  }

  /**
   * Initialize panel location detection
   *
   * 🎯 OPTIMIZATION: Defers initial detection to WebView DOM ready
   * This prevents premature detection that causes layout issues
   *
   * 🎯 VS Code Pattern: Visibility listener consolidated in SecondaryTerminalProvider
   * No longer registers duplicate visibility listener here
   */
  public async initialize(_webviewView?: vscode.WebviewView): Promise<void> {
    // Set up configuration change listener
    this._setupConfigurationListener();

    // 🎯 REMOVED: Visibility listener consolidated in SecondaryTerminalProvider
    // Following VS Code ViewPane pattern for single visibility handler
    // if (webviewView) {
    //   this._setupVisibilityListener(webviewView);
    // }

    // 🎯 REMOVED: Don't request detection immediately
    // Let WebView detect autonomously when DOM is ready
    // await this.requestPanelLocationDetection();
    log('📍 [PANEL-DETECTION] Panel location service initialized (detection deferred to WebView)');
  }

  /**
   * Handle panel location report from WebView
   *
   * 🎯 OPTIMIZATION: Removed redundant panelLocationUpdate message
   * WebView now applies changes autonomously without Extension confirmation
   */
  public async handlePanelLocationReport(
    location: unknown,
    onLocationChange?: (oldLocation: PanelLocation, newLocation: PanelLocation) => Promise<void>
  ): Promise<void> {
    log('📍 [DEBUG] ==================== PANEL LOCATION REPORT ====================');
    log('📍 [DEBUG] Panel location reported from WebView:', location);
    log('📍 [DEBUG] Previous cached location:', this._cachedPanelLocation);

    // Validate panel location using type guard
    if (!isPanelLocation(location)) {
      log('⚠️ [DEBUG] Invalid or missing panel location:', location);
      return;
    }

    // Store previous location for change detection
    const previousLocation = this._cachedPanelLocation;

    // Cache the panel location for split direction determination
    this._cachedPanelLocation = location;
    log('📍 [DEBUG] ✅ Cached panel location UPDATED:', location);

    // Update context key for VS Code when clause
    await vscode.commands.executeCommand(
      'setContext',
      PanelLocationService.CONTEXT_KEY,
      location
    );
    log('📍 [DEBUG] Context key updated with panel location:', location);

    // 🎯 REMOVED: No longer send confirmation back to WebView
    // WebView applies changes autonomously, reducing message round-trips
    // await this._sendMessage({ command: 'panelLocationUpdate', location: location });
    log('📍 [DEBUG] ✅ Location cached and context updated (no confirmation message sent)');

    // Notify caller if location changed
    if (previousLocation !== location && onLocationChange) {
      log(`🔄 [RELAYOUT] Location changed: ${previousLocation} → ${location}`);
      await onLocationChange(previousLocation, location);
    }

    log('📍 [DEBUG] ===============================================================');
  }

  /**
   * Request panel location detection from WebView (with debouncing)
   *
   * 🎯 OPTIMIZATION: Debounced to prevent multiple rapid requests
   */
  public async requestPanelLocationDetection(): Promise<void> {
    // Clear existing timer
    if (this._detectionDebounceTimer) {
      clearTimeout(this._detectionDebounceTimer);
    }

    // Schedule new detection request
    this._detectionDebounceTimer = setTimeout(async () => {
      try {
        log('📍 [PANEL-DETECTION] Requesting panel location detection from WebView (debounced)');

        await this._sendMessage({
          command: 'requestPanelLocationDetection',
        });
      } catch (error) {
        log('⚠️ [PANEL-DETECTION] Error requesting panel location detection:', error);

        // Fallback to sidebar assumption - but don't send panelLocationUpdate
        // Let WebView handle its own layout

        // Set fallback context key
        await vscode.commands.executeCommand(
          'setContext',
          PanelLocationService.CONTEXT_KEY,
          'sidebar'
        );
      }
    }, PanelLocationService.DEBOUNCE_DELAY);
  }

  /**
   * Determine split direction based on current panel location
   *
   * @returns Optimal split direction for current layout
   */
  public determineSplitDirection(): SplitDirection {
    log('🔀 [SPLIT] ==================== DETERMINE SPLIT DIRECTION ====================');
    log(`🔀 [SPLIT] _cachedPanelLocation value: ${this._cachedPanelLocation}`);

    const panelLocation = this.getCurrentPanelLocation();
    log(`🔀 [SPLIT] getCurrentPanelLocation() returned: ${panelLocation}`);

    // Map panel location to split direction
    // Sidebar (tall/narrow) → vertical split → column layout (terminals stacked)
    // Panel (wide/short) → horizontal split → row layout (terminals side by side)
    const splitDirection: SplitDirection =
      panelLocation === 'panel' ? 'horizontal' : 'vertical';

    log(`🔀 [SPLIT] Mapping logic: ${panelLocation} === 'panel' ? 'horizontal' : 'vertical'`);
    log(`🔀 [SPLIT] ✅ Result: ${splitDirection}`);
    log(
      `🔀 [SPLIT] Expected behavior: ${panelLocation === 'panel' ? '横並び (side by side)' : '縦並び (stacked)'}`
    );
    log('🔀 [SPLIT] ====================================================================');

    return splitDirection;
  }

  /**
   * Get current panel location
   *
   * Determines panel location by checking:
   * 1. If dynamic split direction is disabled → return 'sidebar'
   * 2. If manual location is set → return manual value
   * 3. Otherwise → return cached location from WebView detection
   */
  public getCurrentPanelLocation(): PanelLocation {
    log(
      '📍 [PANEL-DETECTION] ==================== GET CURRENT PANEL LOCATION ===================='
    );

    const config = vscode.workspace.getConfiguration('secondaryTerminal');
    const { DYNAMIC_SPLIT_DIRECTION, PANEL_LOCATION } = PanelLocationService.CONFIG_KEYS;

    // Check if dynamic split direction feature is enabled
    const isDynamicSplitEnabled = config.get<boolean>(DYNAMIC_SPLIT_DIRECTION, true);
    log(`📍 [PANEL-DETECTION] Dynamic split direction enabled: ${isDynamicSplitEnabled}`);

    if (!isDynamicSplitEnabled) {
      log('📍 [PANEL-DETECTION] ❌ Dynamic split direction is DISABLED, defaulting to sidebar');
      log(
        '📍 [PANEL-DETECTION] =========================================================================='
      );
      return 'sidebar';
    }

    // Get manual panel location setting
    const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>(PANEL_LOCATION, 'auto');
    log(`📍 [PANEL-DETECTION] Manual panel location setting: ${manualPanelLocation}`);

    if (manualPanelLocation !== 'auto') {
      log(`📍 [PANEL-DETECTION] ✅ Using MANUAL panel location: ${manualPanelLocation}`);
      log(
        '📍 [PANEL-DETECTION] =========================================================================='
      );
      return manualPanelLocation as PanelLocation;
    }

    // For auto-detection, use cached value from WebView
    log(`📍 [PANEL-DETECTION] AUTO mode - using cached value: ${this._cachedPanelLocation}`);
    log(
      '📍 [PANEL-DETECTION] =========================================================================='
    );
    return this._cachedPanelLocation;
  }

  /**
   * Get cached panel location
   */
  public getCachedPanelLocation(): PanelLocation {
    return this._cachedPanelLocation;
  }

  /**
   * Set up configuration change listener
   */
  private _setupConfigurationListener(): void {
    this._disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('secondaryTerminal.panelLocation')) {
          log('📍 [PANEL-DETECTION] Panel location setting changed - requesting detection');
          void this.requestPanelLocationDetection();
        }

        if (event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection')) {
          log('📍 [PANEL-DETECTION] Dynamic split direction setting changed - requesting detection');
          void this.requestPanelLocationDetection();
        }
      })
    );
  }

  /**
   * 🎯 REMOVED: Visibility listener consolidated in SecondaryTerminalProvider
   * Following VS Code ViewPane pattern for single visibility handler
   * This duplicate listener has been replaced by SecondaryTerminalProvider._registerVisibilityListener()
   *
   * private _setupVisibilityListener(webviewView: vscode.WebviewView): void {
   *   if (webviewView.onDidChangeVisibility) {
   *     this._disposables.push(
   *       webviewView.onDidChangeVisibility(() => {
   *         setTimeout(() => {
   *           log('📍 [PANEL-DETECTION] Visibility change detected - requesting detection');
   *           void this.requestPanelLocationDetection();
   *         }, 100);
   *       })
   *     );
   *   }
   * }
   */

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Clear debounce timer
    if (this._detectionDebounceTimer) {
      clearTimeout(this._detectionDebounceTimer);
      this._detectionDebounceTimer = null;
    }

    this._disposables.forEach((d) => d.dispose());
  }
}
