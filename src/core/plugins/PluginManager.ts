/**
 * Plugin Manager
 *
 * Manages plugin lifecycle, registration, and coordination.
 */

import type { EventBus } from '../EventBus';
import type { IPlugin, PluginConfiguration } from './IPlugin';
import type { IAgentPlugin } from './IAgentPlugin';
import { terminal as log } from '../../utils/logger';

/**
 * Plugin registration options
 */
export interface PluginRegistrationOptions {
  /** Whether to activate the plugin immediately */
  activateImmediately?: boolean;
  /** Initial plugin configuration */
  config?: PluginConfiguration;
}

interface Disposable {
  dispose(): void;
}

/**
 * Plugin Manager
 *
 * Central registry and lifecycle manager for all plugins.
 */
export class PluginManager implements Disposable {
  private readonly _plugins = new Map<string, IPlugin>();
  private readonly _agentPlugins = new Map<string, IAgentPlugin>();
  private _isDisposed = false;

  constructor(private readonly _eventBus: EventBus) {}

  /**
   * Register a plugin
   *
   * @param plugin Plugin instance
   * @param options Registration options
   */
  async registerPlugin(plugin: IPlugin, options: PluginRegistrationOptions = {}): Promise<void> {
    this._ensureNotDisposed();

    const { id } = plugin.metadata;

    if (this._plugins.has(id)) {
      log(`⚠️ [PLUGIN] Plugin already registered: ${id}`);
      return;
    }

    log(`📦 [PLUGIN] Registering plugin: ${id} (${plugin.metadata.name})`);
    this._plugins.set(id, plugin);

    // Check if it's an agent plugin
    if (this._isAgentPlugin(plugin)) {
      this._agentPlugins.set(id, plugin as IAgentPlugin);
      log(`🤖 [PLUGIN] Registered as agent plugin: ${id}`);
    }

    // Configure plugin if config provided
    if (options.config) {
      plugin.configure(options.config);
    }

    // Activate immediately if requested
    if (options.activateImmediately && options.config?.enabled !== false) {
      await this.activatePlugin(id);
    }
  }

  /**
   * Activate a plugin
   *
   * @param pluginId Plugin ID
   */
  async activatePlugin(pluginId: string): Promise<void> {
    this._ensureNotDisposed();

    const plugin = this._plugins.get(pluginId);
    if (!plugin) {
      log(`⚠️ [PLUGIN] Plugin not found: ${pluginId}`);
      return;
    }

    if (plugin.state === 'active') {
      log(`ℹ️ [PLUGIN] Plugin already active: ${pluginId}`);
      return;
    }

    try {
      log(`▶️ [PLUGIN] Activating plugin: ${pluginId}`);
      await plugin.activate();
      log(`✅ [PLUGIN] Plugin activated: ${pluginId}`);
    } catch (error) {
      log(`❌ [PLUGIN] Failed to activate plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Deactivate a plugin
   *
   * @param pluginId Plugin ID
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    this._ensureNotDisposed();

    const plugin = this._plugins.get(pluginId);
    if (!plugin) {
      log(`⚠️ [PLUGIN] Plugin not found: ${pluginId}`);
      return;
    }

    if (plugin.state !== 'active') {
      log(`ℹ️ [PLUGIN] Plugin not active: ${pluginId}`);
      return;
    }

    try {
      log(`⏸️ [PLUGIN] Deactivating plugin: ${pluginId}`);
      await plugin.deactivate();
      log(`✅ [PLUGIN] Plugin deactivated: ${pluginId}`);
    } catch (error) {
      log(`❌ [PLUGIN] Failed to deactivate plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Configure a plugin
   *
   * @param pluginId Plugin ID
   * @param config Plugin configuration
   */
  configurePlugin(pluginId: string, config: PluginConfiguration): void {
    this._ensureNotDisposed();

    const plugin = this._plugins.get(pluginId);
    if (!plugin) {
      log(`⚠️ [PLUGIN] Plugin not found: ${pluginId}`);
      return;
    }

    log(`⚙️ [PLUGIN] Configuring plugin: ${pluginId}`);
    plugin.configure(config);
  }

  /**
   * Get all registered agent plugins
   *
   * @returns Array of agent plugins
   */
  getAgentPlugins(): IAgentPlugin[] {
    return Array.from(this._agentPlugins.values());
  }

  /**
   * Get active agent plugins
   *
   * @returns Array of active agent plugins
   */
  getActiveAgentPlugins(): IAgentPlugin[] {
    return this.getAgentPlugins().filter((plugin) => plugin.state === 'active');
  }

  /**
   * Get plugin by ID
   *
   * @param pluginId Plugin ID
   * @returns Plugin instance or undefined
   */
  getPlugin(pluginId: string): IPlugin | undefined {
    return this._plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   *
   * @returns Array of all plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this._plugins.values());
  }

  /**
   * Check if a plugin is registered
   *
   * @param pluginId Plugin ID
   * @returns True if registered
   */
  hasPlugin(pluginId: string): boolean {
    return this._plugins.has(pluginId);
  }

  /**
   * Dispose all plugins and cleanup
   */
  dispose(): void {
    if (this._isDisposed) {
      return;
    }

    log('🧹 [PLUGIN] Disposing PluginManager...');

    // Deactivate and dispose all plugins
    for (const [id, plugin] of this._plugins) {
      try {
        if (plugin.state === 'active') {
          plugin.deactivate().catch((error) => {
            log(`⚠️ [PLUGIN] Error deactivating plugin ${id}:`, error);
          });
        }
        plugin.dispose();
      } catch (error) {
        log(`⚠️ [PLUGIN] Error disposing plugin ${id}:`, error);
      }
    }

    this._plugins.clear();
    this._agentPlugins.clear();
    this._isDisposed = true;

    log('✅ [PLUGIN] PluginManager disposed');
  }

  /**
   * Check if an object implements IAgentPlugin
   */
  private _isAgentPlugin(plugin: IPlugin): plugin is IAgentPlugin {
    return (
      'detect' in plugin &&
      'onAgentActivated' in plugin &&
      'onAgentDeactivated' in plugin &&
      'getAgentType' in plugin
    );
  }

  /**
   * Ensure manager is not disposed
   */
  private _ensureNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('PluginManager has been disposed');
    }
  }
}
