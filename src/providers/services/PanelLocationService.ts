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

  private readonly _disposables: vscode.Disposable[] = [];

  /**
   * Cached panel location reported by WebView
   */
  private _cachedPanelLocation: PanelLocation = 'sidebar';

  /**
   * Callback for sending messages to WebView
   */
  private readonly _sendMessage: (message: unknown) => Promise<void>;

  constructor(sendMessage: (message: unknown) => Promise<void>) {
    this._sendMessage = sendMessage;
  }

  /**
   * Initialize panel location detection
   */
  public async initialize(webviewView?: vscode.WebviewView): Promise<void> {
    // Set up configuration change listener
    this._setupConfigurationListener();

    // Set up visibility change listener if webviewView provided
    if (webviewView) {
      this._setupVisibilityListener(webviewView);
    }

    // Request initial panel location detection
    await this.requestPanelLocationDetection();
  }

  /**
   * Handle panel location report from WebView
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

    // Notify WebView of the confirmed panel location
    await this._sendMessage({
      command: 'panelLocationUpdate',
      location: location,
    });
    log('📍 [DEBUG] Panel location update confirmed to WebView:', location);

    // Notify caller if location changed
    if (previousLocation !== location && onLocationChange) {
      log(`🔄 [RELAYOUT] Location changed: ${previousLocation} → ${location}`);
      await onLocationChange(previousLocation, location);
    }

    log('📍 [DEBUG] ===============================================================');
  }

  /**
   * Request panel location detection from WebView
   */
  public async requestPanelLocationDetection(): Promise<void> {
    try {
      log('📍 [PANEL-DETECTION] Requesting panel location detection from WebView');

      await this._sendMessage({
        command: 'requestPanelLocationDetection',
      });
    } catch (error) {
      log('⚠️ [PANEL-DETECTION] Error requesting panel location detection:', error);

      // Fallback to sidebar assumption
      await this._sendMessage({
        command: 'panelLocationUpdate',
        location: 'sidebar',
      });

      // Set fallback context key
      await vscode.commands.executeCommand(
        'setContext',
        PanelLocationService.CONTEXT_KEY,
        'sidebar'
      );
    }
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
   * Set up visibility change listener
   */
  private _setupVisibilityListener(webviewView: vscode.WebviewView): void {
    if (webviewView.onDidChangeVisibility) {
      this._disposables.push(
        webviewView.onDidChangeVisibility(() => {
          // When visibility changes, re-detect panel location
          setTimeout(() => {
            log('📍 [PANEL-DETECTION] Visibility change detected - requesting detection');
            void this.requestPanelLocationDetection();
          }, 100); // Small delay to ensure layout is settled
        })
      );
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this._disposables.forEach((d) => d.dispose());
  }
}
