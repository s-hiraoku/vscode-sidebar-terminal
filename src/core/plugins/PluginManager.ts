/**
 * Plugin Manager
 *
 * Manages plugin lifecycle, registration, and coordination.
 * Provides plugin discovery, activation, and configuration management.
 */

import * as vscode from 'vscode';
import type { IPlugin, IPluginContext, IPluginMetadata } from './IPlugin';
import type { EventBus } from '../EventBus';

/**
 * Plugin activation timeout in milliseconds
 */
const PLUGIN_ACTIVATION_TIMEOUT = 5000;

/**
 * Plugin deactivation timeout in milliseconds
 */
const PLUGIN_DEACTIVATION_TIMEOUT = 5000;

/**
 * Plugin registration entry
 */
interface PluginEntry {
  plugin: IPlugin;
  metadata: IPluginMetadata;
  context?: IPluginContext;
}

/**
 * Plugin Manager implementation
 */
export class PluginManager implements vscode.Disposable {
  private readonly _plugins = new Map<string, PluginEntry>();
  private readonly _activatedPlugins = new Set<string>();
  private _isDisposed = false;

  constructor(
    private readonly _eventBus: EventBus,
    private readonly _extensionContext: vscode.ExtensionContext
  ) {}

  /**
   * Register a plugin
   *
   * @param plugin Plugin instance to register
   * @throws Error if plugin with same ID is already registered
   *
   * @example
   * ```typescript
   * const plugin = new ClaudePlugin();
   * pluginManager.registerPlugin(plugin);
   * ```
   */
  registerPlugin(plugin: IPlugin): void {
    this._ensureNotDisposed();

    if (this._plugins.has(plugin.id)) {
      throw new Error(`Plugin already registered: ${plugin.id}`);
    }

    const metadata: IPluginMetadata = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      enabled: true,
    };

    this._plugins.set(plugin.id, { plugin, metadata });
  }

  /**
   * Unregister a plugin
   *
   * @param pluginId Plugin ID to unregister
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    this._ensureNotDisposed();

    const entry = this._plugins.get(pluginId);
    if (!entry) {
      return;
    }

    // Deactivate if activated
    if (this._activatedPlugins.has(pluginId)) {
      await this.deactivatePlugin(pluginId);
    }

    // Dispose plugin
    try {
      entry.plugin.dispose();
    } catch (error) {
      console.error(`Error disposing plugin ${pluginId}:`, error);
    }

    this._plugins.delete(pluginId);
  }

  /**
   * Get a plugin by ID
   *
   * @param pluginId Plugin ID
   * @returns Plugin instance or undefined
   */
  getPlugin<T extends IPlugin = IPlugin>(pluginId: string): T | undefined {
    const entry = this._plugins.get(pluginId);
    return entry?.plugin as T | undefined;
  }

  /**
   * Get plugins by type (interface check)
   *
   * @param predicate Type predicate function
   * @returns Array of matching plugins
   *
   * @example
   * ```typescript
   * const agentPlugins = pluginManager.getPluginsByType(
   *   (p): p is IAgentPlugin => 'detectAgent' in p
   * );
   * ```
   */
  getPluginsByType<T extends IPlugin>(
    predicate: (plugin: IPlugin) => plugin is T
  ): T[] {
    this._ensureNotDisposed();

    const result: T[] = [];
    for (const entry of this._plugins.values()) {
      if (predicate(entry.plugin)) {
        result.push(entry.plugin as T);
      }
    }
    return result;
  }

  /**
   * Get all registered plugins
   *
   * @returns Array of all plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this._plugins.values()).map((entry) => entry.plugin);
  }

  /**
   * Get plugin metadata
   *
   * @param pluginId Plugin ID
   * @returns Plugin metadata or undefined
   */
  getPluginMetadata(pluginId: string): IPluginMetadata | undefined {
    const entry = this._plugins.get(pluginId);
    return entry ? { ...entry.metadata } : undefined;
  }

  /**
   * Get all plugin metadata
   */
  getAllPluginMetadata(): IPluginMetadata[] {
    return Array.from(this._plugins.values()).map((entry) => ({ ...entry.metadata }));
  }

  /**
   * Activate a specific plugin
   *
   * @param pluginId Plugin ID to activate
   */
  async activatePlugin(pluginId: string): Promise<void> {
    this._ensureNotDisposed();

    const entry = this._plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this._activatedPlugins.has(pluginId)) {
      return; // Already activated
    }

    // Create plugin context
    const context = this._createPluginContext(entry.plugin);
    entry.context = context;

    try {
      // Activate with timeout
      await this._withTimeout(
        entry.plugin.activate(context),
        PLUGIN_ACTIVATION_TIMEOUT,
        `Plugin activation timeout: ${pluginId}`
      );

      this._activatedPlugins.add(pluginId);
      entry.metadata.activatedAt = new Date();
      entry.metadata.enabled = true;
    } catch (error) {
      console.error(`Error activating plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate a specific plugin
   *
   * @param pluginId Plugin ID to deactivate
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    this._ensureNotDisposed();

    const entry = this._plugins.get(pluginId);
    if (!entry) {
      return;
    }

    if (!this._activatedPlugins.has(pluginId)) {
      return; // Not activated
    }

    try {
      // Deactivate with timeout
      await this._withTimeout(
        entry.plugin.deactivate(),
        PLUGIN_DEACTIVATION_TIMEOUT,
        `Plugin deactivation timeout: ${pluginId}`
      );

      this._activatedPlugins.delete(pluginId);
      entry.metadata.activatedAt = undefined;
      entry.metadata.enabled = false;
    } catch (error) {
      console.error(`Error deactivating plugin ${pluginId}:`, error);
      // Continue even if deactivation fails
    }
  }

  /**
   * Activate all registered plugins
   */
  async activateAll(): Promise<void> {
    this._ensureNotDisposed();

    const pluginIds = Array.from(this._plugins.keys());
    for (const pluginId of pluginIds) {
      try {
        await this.activatePlugin(pluginId);
      } catch (error) {
        console.error(`Failed to activate plugin ${pluginId}:`, error);
        // Continue with other plugins
      }
    }
  }

  /**
   * Deactivate all activated plugins (in reverse activation order)
   */
  async deactivateAll(): Promise<void> {
    this._ensureNotDisposed();

    const pluginIds = Array.from(this._activatedPlugins).reverse();
    for (const pluginId of pluginIds) {
      try {
        await this.deactivatePlugin(pluginId);
      } catch (error) {
        console.error(`Failed to deactivate plugin ${pluginId}:`, error);
        // Continue with other plugins
      }
    }
  }

  /**
   * Configure a plugin
   *
   * @param pluginId Plugin ID
   * @param config Configuration object
   */
  configurePlugin(pluginId: string, config: Record<string, unknown>): void {
    this._ensureNotDisposed();

    const entry = this._plugins.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      entry.plugin.configure(config);
    } catch (error) {
      console.error(`Error configuring plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a plugin is activated
   *
   * @param pluginId Plugin ID
   * @returns True if activated
   */
  isActivated(pluginId: string): boolean {
    return this._activatedPlugins.has(pluginId);
  }

  /**
   * Get number of registered plugins
   */
  get pluginCount(): number {
    return this._plugins.size;
  }

  /**
   * Get number of activated plugins
   */
  get activatedCount(): number {
    return this._activatedPlugins.size;
  }

  /**
   * Dispose plugin manager and all plugins
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    // Deactivate all plugins synchronously (best effort)
    const pluginIds = Array.from(this._activatedPlugins).reverse();
    for (const pluginId of pluginIds) {
      const entry = this._plugins.get(pluginId);
      if (entry) {
        try {
          const result = entry.plugin.deactivate();
          // If it's a promise, we can't wait for it in sync dispose
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch((error) => {
              console.error(`Error deactivating plugin ${pluginId}:`, error);
            });
          }
        } catch (error) {
          console.error(`Error deactivating plugin ${pluginId}:`, error);
        }
      }
    }

    // Dispose all plugins
    for (const entry of this._plugins.values()) {
      try {
        entry.plugin.dispose();
      } catch (error) {
        console.error(`Error disposing plugin ${entry.plugin.id}:`, error);
      }
    }

    this._plugins.clear();
    this._activatedPlugins.clear();
    this._isDisposed = true;
  }

  private _createPluginContext(plugin: IPlugin): IPluginContext {
    return {
      eventBus: this._eventBus,
      extensionContext: this._extensionContext,
      logger: {
        debug: (message: string, ...args: unknown[]) =>
          console.debug(`[${plugin.id}]`, message, ...args),
        info: (message: string, ...args: unknown[]) =>
          console.info(`[${plugin.id}]`, message, ...args),
        warn: (message: string, ...args: unknown[]) =>
          console.warn(`[${plugin.id}]`, message, ...args),
        error: (message: string, ...args: unknown[]) =>
          console.error(`[${plugin.id}]`, message, ...args),
      },
      config: {
        get: <T>(key: string, defaultValue?: T): T | undefined => {
          const fullKey = `sidebarTerminal.plugins.${plugin.id}.${key}`;
          const config = vscode.workspace.getConfiguration();
          if (defaultValue !== undefined) {
            return config.get<T>(fullKey, defaultValue);
          }
          return config.get<T>(fullKey);
        },
        has: (key: string): boolean => {
          const fullKey = `sidebarTerminal.plugins.${plugin.id}.${key}`;
          return vscode.workspace.getConfiguration().has(fullKey);
        },
      },
    };
  }

  private async _withTimeout<T>(
    promise: Promise<T> | T | void,
    timeoutMs: number,
    errorMessage: string
  ): Promise<T | void> {
    if (!promise || typeof (promise as Promise<T>).then !== 'function') {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ]);
  }

  private _ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('Cannot use disposed PluginManager');
    }
  }
}
