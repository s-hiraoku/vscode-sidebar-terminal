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

  private readonly coordinator: IManagerCoordinator;

  constructor(coordinator: IManagerCoordinator) {
    this.coordinator = coordinator;
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

    terminalLogger.info(`[AUTO-SAVE] Scrollback auto-save enabled for terminal: ${terminalId}`);
  }
}
