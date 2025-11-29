/**
 * Terminal Addon Manager
 *
 * Extracted from TerminalLifecycleCoordinator to centralize addon management.
 *
 * Responsibilities:
 * - Loading and initializing xterm.js addons
 * - Managing addon lifecycle and disposal
 * - Providing typed access to loaded addons
 * - Handling optional vs required addons gracefully
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/split-lifecycle-manager/spec.md
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { terminalLogger } from '../utils/ManagerLogger';
import { AddonLoader } from '../utils/AddonLoader';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Configuration for addon loading
 */
export interface AddonConfig {
  enableGpuAcceleration?: boolean;
  enableSearchAddon?: boolean;
  enableUnicode11?: boolean;
  linkHandler?: (event: MouseEvent | undefined, uri: string) => void;
  /**
   * VS Code standard link activation modifier key.
   * - 'alt': Alt+Click activates links (VS Code default)
   * - 'ctrlCmd': Cmd+Click (macOS) or Ctrl+Click (Windows/Linux) activates links
   * Follows VS Code's editor.multiCursorModifier setting.
   */
  linkModifier?: 'alt' | 'ctrlCmd';
}

/**
 * Container for loaded addons
 */
export interface LoadedAddons {
  fitAddon: FitAddon;
  webLinksAddon: WebLinksAddon;
  serializeAddon: SerializeAddon;
  searchAddon?: SearchAddon;
  webglAddon?: WebglAddon;
  unicode11Addon?: Unicode11Addon;
}

/**
 * Service responsible for managing xterm.js addons
 */
export class TerminalAddonManager {
  /**
   * Load all addons for a terminal instance using AddonLoader utility
   *
   * Refactored to use generic AddonLoader, eliminating 60+ lines of duplicated code.
   * @see AddonLoader for generic loading implementation
   */
  public async loadAllAddons(
    terminal: Terminal,
    terminalId: string,
    config: AddonConfig
  ): Promise<LoadedAddons> {
    const addons: Partial<LoadedAddons> = {};

    try {
      // Load essential addons (required - throws on error)
      addons.fitAddon = await AddonLoader.loadAddon(terminal, terminalId, FitAddon, {
        required: true,
      });

      if (config.linkHandler) {
        // Use custom handler so links are opened by the extension (vscode.env.openExternal)
        // VS Code standard: links require modifier key + click to activate
        // This follows editor.multiCursorModifier setting:
        // - 'alt': Alt+Click activates links (VS Code default when multiCursorModifier is 'alt')
        // - 'ctrlCmd': Cmd/Ctrl+Click activates links (when multiCursorModifier is 'ctrlCmd')
        const linkModifier = config.linkModifier ?? 'ctrlCmd'; // Default to Cmd/Ctrl for link activation

        const webLinksAddon = new WebLinksAddon(
          (event, uri) => {
            try {
              terminalLogger.info(
                `🔗 [WEBVIEW] Link clicked in terminal ${terminalId}: ${uri} (meta=${Boolean(
                  (event as MouseEvent | undefined)?.metaKey
                )}, ctrl=${Boolean((event as MouseEvent | undefined)?.ctrlKey)}, alt=${Boolean(
                  (event as MouseEvent | undefined)?.altKey
                )})`
              );

              // Forward to extension
              config.linkHandler?.(event as MouseEvent | undefined, uri);
            } catch (error) {
              terminalLogger.warn(`⚠️ WebLinksAddon handler failed for ${terminalId}:`, error);
            }
          },
          // VS Code standard: willLinkActivate checks for modifier key
          // When modifier is pressed + left click, activate the link
          // This allows normal text selection without triggering links
          {
            willLinkActivate: (event: MouseEvent) => {
              if (!event || event.button !== 0) return false;

              // Check for the appropriate modifier key based on VS Code settings
              // VS Code's terminal uses the OPPOSITE modifier for links:
              // - When multiCursorModifier is 'alt', Cmd/Ctrl+Click opens links
              // - When multiCursorModifier is 'ctrlCmd', Alt+Click opens links
              if (linkModifier === 'alt') {
                // Alt is used for multi-cursor, so Cmd/Ctrl opens links
                return event.metaKey || event.ctrlKey;
              } else {
                // Cmd/Ctrl is used for multi-cursor, so Alt opens links
                return event.altKey;
              }
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        );

        terminal.loadAddon(webLinksAddon);
        addons.webLinksAddon = webLinksAddon;
        terminalLogger.info(
          `✅ WebLinksAddon loaded with custom handler for terminal: ${terminalId}`
        );
      } else {
        addons.webLinksAddon = await AddonLoader.loadAddon(terminal, terminalId, WebLinksAddon, {
          required: true,
        });
      }

      addons.serializeAddon = await AddonLoader.loadAddon(terminal, terminalId, SerializeAddon, {
        required: true,
        addonName: 'SerializeAddon (scrollback)',
      });

      // Load optional addons (graceful degradation - returns undefined on error)
      if (config.enableSearchAddon) {
        addons.searchAddon = await AddonLoader.loadAddon(terminal, terminalId, SearchAddon, {
          required: false,
        });
      }

      if (config.enableGpuAcceleration) {
        addons.webglAddon = await AddonLoader.loadAddon(terminal, terminalId, WebglAddon, {
          required: false,
          addonName: 'WebglAddon (GPU acceleration)',
        });
      }

      if (config.enableUnicode11) {
        addons.unicode11Addon = await AddonLoader.loadAddon(terminal, terminalId, Unicode11Addon, {
          required: false,
          onLoaded: (_addon, term) => {
            term.unicode.activeVersion = '11';
          },
        });
      }

      terminalLogger.info(`✅ All addons loaded successfully for terminal: ${terminalId}`);

      return addons as LoadedAddons;
    } catch (error) {
      ErrorHandler.handleOperationError(`Addon loading for ${terminalId}`, error, {
        severity: 'error',
        rethrow: true,
        context: { terminalId },
      });
      // TypeScript requires return statement after rethrow (unreachable code)
      throw error;
    }
  }

  /**
   * Get specific addon from loaded addons
   */
  public getAddon<T extends keyof LoadedAddons>(
    addons: LoadedAddons,
    addonName: T
  ): LoadedAddons[T] {
    return addons[addonName];
  }

  /**
   * Dispose all addons
   */
  public disposeAddons(addons: LoadedAddons | undefined): void {
    if (!addons) {
      return;
    }

    try {
      // Dispose optional addons
      if (addons.searchAddon) {
        addons.searchAddon.dispose();
      }
      if (addons.webglAddon) {
        addons.webglAddon.dispose();
      }
      if (addons.unicode11Addon) {
        (addons.unicode11Addon as any).dispose?.();
      }

      // Note: FitAddon, WebLinksAddon, and SerializeAddon are disposed
      // automatically when the terminal is disposed

      terminalLogger.info('✅ Addons disposed successfully');
    } catch (error) {
      ErrorHandler.handleOperationError('Addon disposal', error, {
        severity: 'warn',
        rethrow: false,
      });
    }
  }

  /**
   * Dispose cleanup
   */
  public dispose(): void {
    terminalLogger.info('TerminalAddonManager disposed');
  }
}
