/**
 * PanelLocationHandler
 *
 * Panel location detection gating logic extracted from SecondaryTerminalProvider.
 * Manages the request/response lifecycle for panel location detection,
 * including timeout handling and solicitation guards.
 *
 * Delegates actual panel location evaluation to PanelLocationService.
 */

import * as vscode from 'vscode';
import { WebviewMessage } from '../../types/common';
import { PanelLocation, PanelLocationService } from '../services/PanelLocationService';
import { provider as log } from '../../utils/logger';

/**
 * Dependencies required by PanelLocationHandler
 */
export interface IPanelLocationHandlerDependencies {
  panelLocationService: PanelLocationService;
  sendMessage: (message: WebviewMessage) => Promise<void>;
}

export class PanelLocationHandler implements vscode.Disposable {
  /**
   * Timeout for waiting for panel location response from WebView (ms)
   */
  private static readonly PANEL_LOCATION_RESPONSE_TIMEOUT_MS = 2000;

  /**
   * Delay before requesting detection after first visibility (ms)
   */
  private static readonly VISIBILITY_DETECTION_DELAY_MS = 200;

  /**
   * Whether panel location has been detected at least once
   */
  private _hasDetectedPanelLocation = false;

  /**
   * Whether a panel location detection request is pending
   */
  private _panelLocationDetectionPending = false;

  /**
   * Timeout for panel location detection response
   */
  private _panelLocationDetectionTimeout: NodeJS.Timeout | null = null;

  private readonly _disposables: vscode.Disposable[] = [];

  constructor(private readonly _deps: IPanelLocationHandlerDependencies) {}

  /**
   * Handle reportPanelLocation message from WebView.
   *
   * Only accepts reports when a detection request is pending (solicited responses).
   * Unsolicited reports are ignored to prevent setContext calls that cancel
   * VS Code's secondary sidebar maximize state.
   */
  public async handleReportPanelLocation(message: WebviewMessage): Promise<void> {
    if (!this._panelLocationDetectionPending) {
      log('⏭️ [PROVIDER] Ignoring unsolicited panel location report');
      return;
    }

    const reportedLocation = message.location as PanelLocation;
    if (!reportedLocation) {
      log('⚠️ [PROVIDER] Panel location report missing location');
      return;
    }

    this.clearPanelLocationDetectionPending('panel location report received');

    log(`📍 [PROVIDER] WebView reports panel location: ${reportedLocation}`);
    await this._deps.panelLocationService.handlePanelLocationReport(reportedLocation);
  }

  /**
   * Request panel location detection from WebView with timeout.
   *
   * In manual mode, skips detection and clears pending state.
   * In auto mode, sets pending flag and starts a timeout timer.
   */
  public requestPanelLocationDetection(): void {
    const manualPanelLocation = vscode.workspace
      .getConfiguration('secondaryTerminal')
      .get<'sidebar' | 'panel' | 'auto'>('panelLocation', 'auto');

    if (manualPanelLocation !== 'auto') {
      log(
        `📍 [PROVIDER] Manual panelLocation=${manualPanelLocation}; skipping panel location detection request`
      );
      this.clearPanelLocationDetectionPending('manual panelLocation mode');
      return;
    }

    this._panelLocationDetectionPending = true;
    if (this._panelLocationDetectionTimeout) {
      clearTimeout(this._panelLocationDetectionTimeout);
    }
    this._panelLocationDetectionTimeout = setTimeout(() => {
      this.clearPanelLocationDetectionPending('panel location response timeout');
    }, PanelLocationHandler.PANEL_LOCATION_RESPONSE_TIMEOUT_MS);

    this._deps.panelLocationService.requestPanelLocationDetection();
  }

  /**
   * Clear pending detection state and cancel timeout.
   */
  public clearPanelLocationDetectionPending(reason: string): void {
    if (!this._panelLocationDetectionPending && !this._panelLocationDetectionTimeout) {
      return;
    }

    log(`📍 [PROVIDER] Clearing panel location detection pending state (${reason})`);
    this._panelLocationDetectionPending = false;
    if (this._panelLocationDetectionTimeout) {
      clearTimeout(this._panelLocationDetectionTimeout);
      this._panelLocationDetectionTimeout = null;
    }
  }

  /**
   * Handle WebView becoming visible.
   *
   * On first visibility, schedules panel location detection after a short delay
   * to allow layout to stabilize. Subsequent visibility events skip detection
   * to prevent unnecessary setContext calls.
   */
  public handleWebviewVisible(): void {
    if (this._hasDetectedPanelLocation) {
      log('⏭️ [VISIBILITY] Panel location already detected, skipping redundant detection');
      return;
    }

    // Set flag BEFORE setTimeout to prevent race condition:
    // Multiple visibility events within 200ms would otherwise bypass the guard
    // and queue multiple detection timers, each triggering setContext.
    this._hasDetectedPanelLocation = true;

    setTimeout(() => {
      log('📍 [VISIBILITY] Requesting initial panel location detection');
      this.requestPanelLocationDetection();
    }, PanelLocationHandler.VISIBILITY_DETECTION_DELAY_MS);
  }

  /**
   * Set up configuration change listener for panel location changes.
   *
   * When panelLocation setting changes, reports the new location to PanelLocationService.
   * Returns the disposable for the caller to manage.
   */
  public setupPanelLocationChangeListener(): vscode.Disposable {
    log('🔧 [PROVIDER] Setting up panel location change listener...');

    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('secondaryTerminal.panelLocation')) {
        log('📍 [PROVIDER] Panel location configuration changed');

        const newLocation = vscode.workspace
          .getConfiguration('secondaryTerminal')
          .get<PanelLocation>('panelLocation', 'sidebar');

        log(`📍 [PROVIDER] New panel location: ${newLocation}`);
        this._deps.panelLocationService.handlePanelLocationReport(newLocation).catch((error) => {
          log(`❌ [PROVIDER] Failed to handle panel location change: ${error}`);
        });
      }
    });

    this._disposables.push(disposable);
    log('✅ [PROVIDER] Panel location change listener registered');
    return disposable;
  }

  /**
   * Whether a panel location detection request is currently pending.
   */
  public get isDetectionPending(): boolean {
    return this._panelLocationDetectionPending;
  }

  /**
   * Whether panel location has been detected at least once.
   */
  public get hasDetectedPanelLocation(): boolean {
    return this._hasDetectedPanelLocation;
  }

  /**
   * Reset detection state (used during dispose).
   */
  public resetDetectionState(): void {
    this._hasDetectedPanelLocation = false;
    this.clearPanelLocationDetectionPending('state reset');
  }

  public dispose(): void {
    this.clearPanelLocationDetectionPending('handler disposed');
    this._disposables.forEach((d) => d.dispose());
    this._disposables.length = 0;
  }
}
