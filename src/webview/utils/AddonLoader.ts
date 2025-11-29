/**
 * AddonLoader Utility
 *
 * Generic utility for loading xterm.js addons with consistent error handling,
 * logging, and support for optional vs required addons.
 *
 * Eliminates code duplication across addon loading operations.
 *
 * @see openspec/changes/refactor-terminal-foundation/specs/unify-addon-loading/spec.md
 */

import { Terminal } from '@xterm/xterm';
import { terminalLogger } from './ManagerLogger';

/**
 * Addon constructor type - any class that can be instantiated and loaded
 */
export type AddonConstructor<T> = new (...args: any[]) => T;

/**
 * Options for addon loading behavior
 */
export interface AddonLoadOptions {
  /**
   * Whether this addon is required (throws on error) or optional (returns undefined on error)
   */
  required?: boolean;

  /**
   * Custom addon name for logging (defaults to constructor name)
   */
  addonName?: string;

  /**
   * Post-load initialization callback for special setup (e.g., Unicode11Addon)
   */
  onLoaded?: (addon: any, terminal: Terminal) => void;
}

/**
 * Result of addon loading operation
 */
export interface AddonLoadResult<T> {
  addon: T | undefined;
  success: boolean;
  error?: unknown;
}

/**
 * Generic addon loader with consistent error handling and logging
 */
export class AddonLoader {
  /**
   * Load an addon with consistent error handling and logging
   *
   * @param terminal - The terminal instance to load the addon into
   * @param terminalId - Terminal ID for logging
   * @param AddonClass - The addon constructor class
   * @param options - Loading options (required/optional, custom name, post-load callback)
   * @returns The loaded addon instance or undefined (for optional addons that fail)
   *
   * @example
   * // Load required addon
   * const fitAddon = await AddonLoader.loadAddon(
   *   terminal,
   *   'terminal-1',
   *   FitAddon,
   *   { required: true }
   * );
   *
   * @example
   * // Load optional addon with custom initialization
   * const unicode11Addon = await AddonLoader.loadAddon(
   *   terminal,
   *   'terminal-1',
   *   Unicode11Addon,
   *   {
   *     required: false,
   *     onLoaded: (addon, term) => {
   *       term.unicode.activeVersion = '11';
   *     }
   *   }
   * );
   */
  public static async loadAddon<T>(
    terminal: Terminal,
    terminalId: string,
    AddonClass: AddonConstructor<T>,
    options: AddonLoadOptions = {}
  ): Promise<T | undefined> {
    const { required = true, addonName, onLoaded } = options;
    const name = addonName || AddonClass.name;

    try {
      // Instantiate the addon
      const addon = new AddonClass();

      // Load into terminal
      terminal.loadAddon(addon as any);

      // Execute post-load initialization if provided
      if (onLoaded) {
        onLoaded(addon, terminal);
      }

      // Log success
      terminalLogger.info(`✅ ${name} loaded: ${terminalId}`);

      return addon;
    } catch (error) {
      // Handle errors based on required/optional
      if (required) {
        terminalLogger.error(`❌ Failed to load ${name} for ${terminalId}:`, error);
        throw error;
      } else {
        terminalLogger.warn(`⚠️ ${name} failed to load for ${terminalId}:`, error);
        return undefined;
      }
    }
  }

  /**
   * Load addon with detailed result information (useful for testing/debugging)
   *
   * @param terminal - The terminal instance
   * @param terminalId - Terminal ID for logging
   * @param AddonClass - The addon constructor class
   * @param options - Loading options
   * @returns Detailed result with addon, success status, and error if any
   */
  public static async loadAddonWithResult<T>(
    terminal: Terminal,
    terminalId: string,
    AddonClass: AddonConstructor<T>,
    options: AddonLoadOptions = {}
  ): Promise<AddonLoadResult<T>> {
    try {
      const addon = await this.loadAddon(terminal, terminalId, AddonClass, options);
      return {
        addon,
        success: addon !== undefined,
      };
    } catch (error) {
      return {
        addon: undefined,
        success: false,
        error,
      };
    }
  }

  /**
   * Load multiple addons in parallel
   *
   * @param terminal - The terminal instance
   * @param terminalId - Terminal ID for logging
   * @param addons - Array of addon specifications
   * @returns Map of addon names to loaded addon instances
   *
   * @example
   * const loadedAddons = await AddonLoader.loadMultipleAddons(
   *   terminal,
   *   'terminal-1',
   *   [
   *     { AddonClass: FitAddon, options: { required: true } },
   *     { AddonClass: SearchAddon, options: { required: false } },
   *   ]
   * );
   */
  public static async loadMultipleAddons(
    terminal: Terminal,
    terminalId: string,
    addons: Array<{
      AddonClass: AddonConstructor<any>;
      options?: AddonLoadOptions;
    }>
  ): Promise<Map<string, any>> {
    const results = await Promise.all(
      addons.map(async ({ AddonClass, options }) => {
        const addon = await this.loadAddon(terminal, terminalId, AddonClass, options);
        const name = options?.addonName || AddonClass.name;
        return { name, addon };
      })
    );

    const addonMap = new Map<string, any>();
    for (const { name, addon } of results) {
      if (addon !== undefined) {
        addonMap.set(name, addon);
      }
    }

    return addonMap;
  }
}
