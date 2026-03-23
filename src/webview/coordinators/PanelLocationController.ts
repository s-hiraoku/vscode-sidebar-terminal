/**
 * PanelLocationController
 *
 * Panel location management methods extracted from LightweightTerminalWebviewManager.
 * Handles panel location detection, sync, flex-direction queries, and event-driven updates.
 */

// Logger available if needed: import { webview as log } from '../../utils/logger';

/**
 * Dependencies required by PanelLocationController
 */
export interface IPanelLocationControllerDependencies {
  // MessageManager delegation
  messageManagerUpdatePanelLocationIfNeeded(): boolean;
  messageManagerGetCurrentPanelLocation(): 'sidebar' | 'panel' | null;
  messageManagerGetCurrentFlexDirection(): 'row' | 'column' | null;

  // SplitManager delegation
  splitManagerSetPanelLocation(location: 'sidebar' | 'panel'): void;
  splitManagerUpdateSplitDirection(direction: string, location: string): void;
  splitManagerGetTerminalCount(): number;

  // DisplayModeManager delegation
  displayModeManagerGetCurrentMode(): string;
  displayModeManagerShowAllTerminalsSplit(): void;
}

export class PanelLocationController {
  private readonly eventHandler: (event: Event) => void;

  constructor(private readonly deps: IPanelLocationControllerDependencies) {
    this.eventHandler = this.handlePanelLocationChanged.bind(this);
    this.setupPanelLocationSync();
  }

  /**
   * Update panel location and flex-direction if changed.
   * Delegates to ConsolidatedMessageManager -> PanelLocationHandler.
   * Single entry point for layout updates (VS Code pattern).
   *
   * @returns true if layout was updated, false if no change
   */
  public updatePanelLocationIfNeeded(): boolean {
    return this.deps.messageManagerUpdatePanelLocationIfNeeded();
  }

  /**
   * Get current panel location
   */
  public getCurrentPanelLocation(): 'sidebar' | 'panel' | null {
    return this.deps.messageManagerGetCurrentPanelLocation();
  }

  /**
   * Get current flex-direction
   */
  public getCurrentFlexDirection(): 'row' | 'column' | null {
    return this.deps.messageManagerGetCurrentFlexDirection();
  }

  /**
   * Clean up event listeners
   */
  public dispose(): void {
    window.removeEventListener('terminal-panel-location-changed', this.eventHandler);
  }

  private setupPanelLocationSync(): void {
    // Panel location (sidebar/panel) changes - keep split layout direction in sync
    window.addEventListener('terminal-panel-location-changed', this.eventHandler);

    // Best-effort sync: apply the current location even if the first event fired before full UI was ready
    setTimeout(() => {
      try {
        const terminalsWrapper = document.getElementById('terminals-wrapper');
        if (!terminalsWrapper) {
          return;
        }

        const location = terminalsWrapper.classList.contains('terminal-split-horizontal')
          ? 'panel'
          : 'sidebar';
        this.deps.splitManagerSetPanelLocation(location);

        const terminalCount = this.deps.splitManagerGetTerminalCount();
        const currentMode = this.deps.displayModeManagerGetCurrentMode();
        if (location === 'panel' && terminalCount > 1 && currentMode !== 'fullscreen') {
          this.deps.displayModeManagerShowAllTerminalsSplit();
        } else if (location === 'sidebar' && currentMode === 'split') {
          this.deps.displayModeManagerShowAllTerminalsSplit();
        }
      } catch {
        // ignore
      }
    }, 250);
  }

  private handlePanelLocationChanged(event: Event): void {
    const customEvent = event as CustomEvent<{ location?: unknown }>;
    const location = customEvent.detail?.location;
    if (location !== 'sidebar' && location !== 'panel') {
      return;
    }

    this.deps.splitManagerSetPanelLocation(location);

    const direction = location === 'panel' ? 'horizontal' : 'vertical';

    try {
      const terminalCount = this.deps.splitManagerGetTerminalCount();
      const currentMode = this.deps.displayModeManagerGetCurrentMode();

      // Bottom panel: if multiple terminals are visible (i.e. not fullscreen), enforce split layout immediately
      if (location === 'panel' && terminalCount > 1 && currentMode !== 'fullscreen') {
        this.deps.displayModeManagerShowAllTerminalsSplit();
        return;
      }

      // Sidebar: if already in split mode, rebuild layout to ensure vertical stacking
      if (location === 'sidebar' && currentMode === 'split') {
        this.deps.displayModeManagerShowAllTerminalsSplit();
        return;
      }
    } catch {
      // fall through
    }

    // Otherwise, just update split direction for the next activation
    this.deps.splitManagerUpdateSplitDirection(direction, location);
  }
}
