/**
 * Terminal Auto-Save Service
 *
 * Extracted from TerminalCreationService for better maintainability.
 * Handles automatic scrollback save on terminal output.
 */

import { Terminal } from '@xterm/xterm';
import { SerializeAddon } from '@xterm/addon-serialize';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { terminalLogger } from '../../utils/ManagerLogger';

/**
 * Service for managing terminal scrollback auto-save functionality
 */
export class TerminalAutoSaveService {
  // Static Set to track terminals currently being restored (blocks auto-save)
  private static restoringTerminals = new Set<string>();

  // Periodic save interval (30 seconds) - ensures scrollback is saved even without user activity
  private static readonly PERIODIC_SAVE_INTERVAL = 30000;

  // Track periodic save timers for cleanup
  private static periodicSaveTimers = new Map<string, number>();

  // Track registered terminals for visibility change recovery
  private static registeredTerminals = new Map<
    string,
    { terminal: Terminal; serializeAddon: SerializeAddon }
  >();

  // Track if visibility change handler is set up
  private static visibilityHandlerSetup = false;

  // Track last visibility change time to detect sleep/wake
  private static lastVisibilityChangeTime = 0;

  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    this.coordinator = coordinator;
  }

  /**
   * Clear periodic save timer for a terminal (call on terminal dispose)
   */
  public static clearPeriodicSaveTimer(terminalId: string): void {
    const timer = TerminalAutoSaveService.periodicSaveTimers.get(terminalId);
    if (timer) {
      window.clearInterval(timer);
      TerminalAutoSaveService.periodicSaveTimers.delete(terminalId);
      // eslint-disable-next-line no-console
      console.log(`[AUTO-SAVE] Cleared periodic save timer for: ${terminalId}`);
    }
    // Also remove from registered terminals
    TerminalAutoSaveService.registeredTerminals.delete(terminalId);
  }

  /**
   * Setup visibility change handler for sleep/wake recovery
   * This ensures scrollback is saved before sleep and restored after wake
   */
  private static setupVisibilityChangeHandler(): void {
    if (TerminalAutoSaveService.visibilityHandlerSetup) {
      return;
    }

    document.addEventListener('visibilitychange', () => {
      const now = Date.now();
      const timeSinceLastChange = now - TerminalAutoSaveService.lastVisibilityChangeTime;
      TerminalAutoSaveService.lastVisibilityChangeTime = now;

      if (document.visibilityState === 'hidden') {
        // Page is being hidden (possibly going to sleep)
        // Save all terminal scrollback immediately
        // eslint-disable-next-line no-console
        console.log('[AUTO-SAVE] Page hidden - saving all scrollback immediately');
        TerminalAutoSaveService.saveAllScrollbackImmediately();
      } else if (document.visibilityState === 'visible') {
        // Page is becoming visible again (possibly waking from sleep)
        // If more than 5 seconds passed, this might be a wake from sleep
        const isLikelyWakeFromSleep = timeSinceLastChange > 5000;
        // eslint-disable-next-line no-console
        console.log(
          `[AUTO-SAVE] Page visible - timeSinceLastChange: ${timeSinceLastChange}ms, likelyWake: ${isLikelyWakeFromSleep}`
        );

        if (isLikelyWakeFromSleep) {
          // Request scrollback restoration from Extension
          // eslint-disable-next-line no-console
          console.log('[AUTO-SAVE] Likely wake from sleep - requesting scrollback refresh');
          TerminalAutoSaveService.requestScrollbackRefresh();
        }
      }
    });

    TerminalAutoSaveService.visibilityHandlerSetup = true;
    // eslint-disable-next-line no-console
    console.log('[AUTO-SAVE] Visibility change handler setup complete');
  }

  /**
   * Save all terminal scrollback immediately (called before sleep)
   */
  private static saveAllScrollbackImmediately(): void {
    const windowWithApi = window as Window & {
      vscodeApi?: {
        postMessage: (message: unknown) => void;
      };
    };

    if (!windowWithApi.vscodeApi) {
      // eslint-disable-next-line no-console
      console.warn('[AUTO-SAVE] vscodeApi not available for immediate save');
      return;
    }

    for (const [terminalId, { serializeAddon }] of TerminalAutoSaveService.registeredTerminals) {
      if (TerminalAutoSaveService.isTerminalRestoring(terminalId)) {
        continue;
      }

      try {
        const serialized = serializeAddon.serialize({ scrollback: 1000 });
        const lines = serialized.split('\n');

        windowWithApi.vscodeApi.postMessage({
          command: 'pushScrollbackData',
          terminalId,
          scrollbackData: lines,
          timestamp: Date.now(),
          beforeSleep: true,
        });

        // eslint-disable-next-line no-console
        console.log(`[AUTO-SAVE] Saved scrollback before sleep for ${terminalId}: ${lines.length} lines`);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[AUTO-SAVE] Failed to save scrollback before sleep for ${terminalId}:`, error);
      }
    }
  }

  /**
   * Request scrollback refresh from Extension after wake
   */
  private static requestScrollbackRefresh(): void {
    const windowWithApi = window as Window & {
      vscodeApi?: {
        postMessage: (message: unknown) => void;
      };
    };

    if (!windowWithApi.vscodeApi) {
      // eslint-disable-next-line no-console
      console.warn('[AUTO-SAVE] vscodeApi not available for scrollback refresh request');
      return;
    }

    // Request the Extension to resend the latest scrollback data
    windowWithApi.vscodeApi.postMessage({
      command: 'requestScrollbackRefresh',
      timestamp: Date.now(),
      terminalIds: Array.from(TerminalAutoSaveService.registeredTerminals.keys()),
    });

    // eslint-disable-next-line no-console
    console.log(
      `[AUTO-SAVE] Requested scrollback refresh for ${TerminalAutoSaveService.registeredTerminals.size} terminals`
    );
  }

  /**
   * Mark a terminal as currently being restored (blocks auto-save)
   * Called from ScrollbackMessageHandler at restoration start
   */
  public static markTerminalRestoring(terminalId: string): void {
    TerminalAutoSaveService.restoringTerminals.add(terminalId);
    // eslint-disable-next-line no-console
    console.log(`[AUTO-SAVE] Marked terminal as restoring: ${terminalId}`);
  }

  /**
   * Mark a terminal as restored (ends protection period after delay)
   * Called from ScrollbackMessageHandler after restoration completes
   */
  public static markTerminalRestored(terminalId: string): void {
    // 5 second protection period to allow restoration to settle
    setTimeout(() => {
      TerminalAutoSaveService.restoringTerminals.delete(terminalId);
      // eslint-disable-next-line no-console
      console.log(`[AUTO-SAVE] Restoration protection ended: ${terminalId}`);
    }, 5000);
  }

  /**
   * Check if a terminal is currently being restored
   */
  public static isTerminalRestoring(terminalId: string): boolean {
    return TerminalAutoSaveService.restoringTerminals.has(terminalId);
  }

  /**
   * Setup automatic scrollback save on terminal output (VS Code standard approach)
   */
  public setupScrollbackAutoSave(
    terminal: Terminal,
    terminalId: string,
    serializeAddon: SerializeAddon
  ): void {
    let saveTimer: number | null = null;

    const pushScrollbackToExtension = (): void => {
      // Skip auto-save if terminal is currently being restored
      if (TerminalAutoSaveService.isTerminalRestoring(terminalId)) {
        // eslint-disable-next-line no-console
        console.log(`[AUTO-SAVE] Skipped save during restoration: ${terminalId}`);
        return;
      }

      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }

      saveTimer = window.setTimeout(() => {
        // Double-check restoration status before actually saving
        if (TerminalAutoSaveService.isTerminalRestoring(terminalId)) {
          // eslint-disable-next-line no-console
          console.log(`[AUTO-SAVE] Skipped delayed save during restoration: ${terminalId}`);
          return;
        }

        try {
          const serialized = serializeAddon.serialize({ scrollback: 1000 });
          const lines = serialized.split('\n');

          const windowWithApi = window as Window & {
            vscodeApi?: {
              postMessage: (message: unknown) => void;
            };
          };

          const message = {
            command: 'pushScrollbackData',
            terminalId,
            scrollbackData: lines,
            timestamp: Date.now(),
          };

          if (windowWithApi.vscodeApi) {
            windowWithApi.vscodeApi.postMessage(message);
            terminalLogger.info(
              `[AUTO-SAVE] Pushed scrollback via vscodeApi for terminal ${terminalId}: ${lines.length} lines`
            );
          } else {
            if (this.coordinator && typeof this.coordinator.postMessageToExtension === 'function') {
              this.coordinator.postMessageToExtension(message);
              terminalLogger.info(
                `[AUTO-SAVE] Pushed scrollback via MessageManager for terminal ${terminalId}: ${lines.length} lines`
              );
            } else {
              terminalLogger.error(
                `[AUTO-SAVE] No message transport available for terminal ${terminalId}`
              );
            }
          }
        } catch (error) {
          terminalLogger.warn(
            `[AUTO-SAVE] Failed to push scrollback for terminal ${terminalId}:`,
            error
          );
        }
      }, 3000);
    };

    // Capture both user input (onData) and process output (onLineFeed) so AI-generated output is saved
    terminal.onData(pushScrollbackToExtension);
    terminal.onLineFeed(pushScrollbackToExtension);
    setTimeout(pushScrollbackToExtension, 2000);

    // 🔧 FIX: Add periodic save to ensure scrollback is captured even during long idle periods
    // This fixes the issue where scrollback data is lost when terminal is left idle for extended time
    const periodicTimer = window.setInterval(() => {
      // Skip if terminal is being restored
      if (TerminalAutoSaveService.isTerminalRestoring(terminalId)) {
        return;
      }

      try {
        const serialized = serializeAddon.serialize({ scrollback: 1000 });
        const lines = serialized.split('\n');

        const windowWithApi = window as Window & {
          vscodeApi?: {
            postMessage: (message: unknown) => void;
          };
        };

        const message = {
          command: 'pushScrollbackData',
          terminalId,
          scrollbackData: lines,
          timestamp: Date.now(),
          periodic: true, // Mark as periodic save for debugging
        };

        if (windowWithApi.vscodeApi) {
          windowWithApi.vscodeApi.postMessage(message);
          terminalLogger.debug(
            `[AUTO-SAVE] Periodic save for terminal ${terminalId}: ${lines.length} lines`
          );
        } else if (this.coordinator && typeof this.coordinator.postMessageToExtension === 'function') {
          this.coordinator.postMessageToExtension(message);
          terminalLogger.debug(
            `[AUTO-SAVE] Periodic save via coordinator for terminal ${terminalId}: ${lines.length} lines`
          );
        }
      } catch (error) {
        terminalLogger.warn(
          `[AUTO-SAVE] Periodic save failed for terminal ${terminalId}:`,
          error
        );
      }
    }, TerminalAutoSaveService.PERIODIC_SAVE_INTERVAL);

    // Track the timer for cleanup
    TerminalAutoSaveService.periodicSaveTimers.set(terminalId, periodicTimer);

    // 🔧 FIX: Register terminal for visibility change recovery (sleep/wake)
    TerminalAutoSaveService.registeredTerminals.set(terminalId, { terminal, serializeAddon });
    TerminalAutoSaveService.setupVisibilityChangeHandler();

    terminalLogger.info(`[AUTO-SAVE] Scrollback auto-save enabled for terminal: ${terminalId} (periodic: ${TerminalAutoSaveService.PERIODIC_SAVE_INTERVAL}ms)`);
  }
}
