/**
 * Manages terminal lifecycle with proper resource management and lazy addon loading.
 * Uses DisposableStore pattern for unified resource management and LIFO disposal.
 */

import { Terminal, IDisposable, ITerminalAddon } from '@xterm/xterm';
import { terminalLogger } from '../utils/ManagerLogger';

/** Collects disposables and disposes them all at once in LIFO order. */
class DisposableStore {
  private disposables: IDisposable[] = [];
  private disposed = false;

  public add<T extends IDisposable>(disposable: T): T {
    if (this.disposed) {
      terminalLogger.warn('⚠️ Attempting to add to disposed DisposableStore');
      disposable.dispose();
      return disposable;
    }

    this.disposables.push(disposable);
    return disposable;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          terminalLogger.warn('⚠️ Error disposing resource:', error);
        }
      }
    }
  }

  public clear(): void {
    this.dispose();
    this.disposables = [];
    this.disposed = false;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }
}

interface TerminalResources {
  terminal: Terminal;
  disposables: DisposableStore;
  addons: Map<string, any>;
  eventListeners: Map<string, (...args: any[]) => void>;
}

export interface AddonLoadOptions {
  lazy?: boolean;
  cache?: boolean;
  required?: boolean;
}

export interface ILifecycleController {
  attachTerminal(terminalId: string, terminal: Terminal): void;
  detachTerminal(terminalId: string): void;
  loadAddonLazy<T extends ITerminalAddon>(
    terminalId: string,
    addonName: string,
    AddonClass: new () => T,
    options?: AddonLoadOptions
  ): T | null;
  disposeTerminal(terminalId: string): void;
  dispose(): void;
}

interface Disposable {
  dispose(): void;
}

export class LifecycleController implements ILifecycleController, Disposable {
  private terminals: Map<string, TerminalResources> = new Map();
  private addonCache: Map<string, any> = new Map();
  private disposed = false;

  public attachTerminal(terminalId: string, terminal: Terminal): void {
    if (this.disposed) {
      terminalLogger.warn(`⚠️ LifecycleController disposed, cannot attach terminal: ${terminalId}`);
      return;
    }

    if (this.terminals.has(terminalId)) {
      terminalLogger.warn(`⚠️ Terminal ${terminalId} already attached, detaching first`);
      this.detachTerminal(terminalId);
    }

    const resources: TerminalResources = {
      terminal,
      disposables: new DisposableStore(),
      addons: new Map(),
      eventListeners: new Map(),
    };

    this.terminals.set(terminalId, resources);
    terminalLogger.info(`✅ LifecycleController: Attached terminal ${terminalId}`);
  }

  public detachTerminal(terminalId: string): void {
    const resources = this.terminals.get(terminalId);
    if (!resources) {
      terminalLogger.warn(`⚠️ Terminal ${terminalId} not found for detachment`);
      return;
    }

    resources.disposables.dispose();
    resources.addons.clear();
    resources.eventListeners.clear();
    this.terminals.delete(terminalId);
    terminalLogger.info(`✅ LifecycleController: Detached terminal ${terminalId}`);
  }

  /** Load addon lazily (only when needed), reducing initial memory usage. */
  public loadAddonLazy<T extends ITerminalAddon>(
    terminalId: string,
    addonName: string,
    AddonClass: new () => T,
    options: AddonLoadOptions = {}
  ): T | null {
    const { lazy = true, cache = true, required = false } = options;

    const resources = this.terminals.get(terminalId);
    if (!resources) {
      terminalLogger.warn(`⚠️ Terminal ${terminalId} not found for addon loading: ${addonName}`);
      return null;
    }

    // Check if addon already loaded for this terminal
    if (resources.addons.has(addonName)) {
      terminalLogger.debug(`♻️ Reusing existing addon for ${terminalId}: ${addonName}`);
      return resources.addons.get(addonName) as T;
    }

    // Check global cache if caching enabled
    const cacheKey = `${addonName}`;
    if (cache && this.addonCache.has(cacheKey)) {
      terminalLogger.debug(`♻️ Reusing cached addon: ${addonName}`);
      const cachedAddon = this.addonCache.get(cacheKey) as T;
      resources.addons.set(addonName, cachedAddon);
      return cachedAddon;
    }

    try {
      // Create new addon instance
      const addon = new AddonClass();

      // Load addon to terminal
      resources.terminal.loadAddon(addon);

      // Add to disposables
      resources.disposables.add(addon);

      // Store in terminal addons
      resources.addons.set(addonName, addon);

      // Cache globally if enabled
      if (cache) {
        this.addonCache.set(cacheKey, addon);
      }

      terminalLogger.info(
        `✅ Loaded addon${lazy ? ' (lazy)' : ''} for ${terminalId}: ${addonName}`
      );

      return addon;
    } catch (error) {
      const errorMsg = `Failed to load addon ${addonName} for ${terminalId}`;

      if (required) {
        terminalLogger.error(`❌ ${errorMsg}:`, error);
        throw new Error(errorMsg);
      } else {
        terminalLogger.warn(`⚠️ ${errorMsg}:`, error);
        return null;
      }
    }
  }

  public addEventListener(
    terminalId: string,
    eventName: string,
    handler: (...args: any[]) => void
  ): void {
    const resources = this.terminals.get(terminalId);
    if (!resources) {
      terminalLogger.warn(`⚠️ Terminal ${terminalId} not found for event listener: ${eventName}`);
      return;
    }

    // Store handler for cleanup
    resources.eventListeners.set(eventName, handler);

    terminalLogger.debug(`✅ Added event listener for ${terminalId}: ${eventName}`);
  }

  public removeEventListener(terminalId: string, eventName: string): void {
    const resources = this.terminals.get(terminalId);
    if (!resources) {
      return;
    }

    resources.eventListeners.delete(eventName);
    terminalLogger.debug(`🧹 Removed event listener for ${terminalId}: ${eventName}`);
  }

  public disposeTerminal(terminalId: string): void {
    const resources = this.terminals.get(terminalId);
    if (!resources) {
      terminalLogger.warn(`⚠️ Terminal ${terminalId} not found for disposal`);
      return;
    }

    const startTime = performance.now();

    try {
      resources.disposables.dispose();
      resources.addons.clear();
      resources.eventListeners.clear();
      this.terminals.delete(terminalId);

      const elapsed = performance.now() - startTime;
      terminalLogger.info(
        `✅ LifecycleController: Disposed terminal ${terminalId} in ${elapsed.toFixed(2)}ms`
      );
    } catch (error) {
      terminalLogger.error(`❌ Error disposing terminal ${terminalId}:`, error);
    }
  }

  public getAddon<T>(terminalId: string, addonName: string): T | null {
    const resources = this.terminals.get(terminalId);
    if (!resources) {
      return null;
    }

    return resources.addons.get(addonName) || null;
  }

  public hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  public getStats(): {
    attachedTerminals: number;
    cachedAddons: number;
    terminals: string[];
  } {
    return {
      attachedTerminals: this.terminals.size,
      cachedAddons: this.addonCache.size,
      terminals: Array.from(this.terminals.keys()),
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    terminalLogger.info(`🧹 LifecycleController: Disposing ${this.terminals.size} terminals`);

    for (const [terminalId] of this.terminals) {
      this.disposeTerminal(terminalId);
    }

    this.addonCache.clear();

    terminalLogger.info('✅ LifecycleController: Disposed');
  }
}
