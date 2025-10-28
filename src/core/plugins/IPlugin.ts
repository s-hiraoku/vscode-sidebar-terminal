/**
 * Base Plugin Interface
 *
 * All plugins must implement this interface to participate in the plugin lifecycle.
 */

export interface PluginMetadata {
  /** Unique plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description: string;
  /** Plugin author */
  author?: string;
  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];
}

export interface PluginConfiguration {
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** Plugin-specific configuration */
  [key: string]: unknown;
}

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  /** Plugin is registered but not activated */
  Registered = 'registered',
  /** Plugin is active and running */
  Active = 'active',
  /** Plugin encountered an error */
  Error = 'error',
  /** Plugin is deactivated */
  Deactivated = 'deactivated',
}

/**
 * Base plugin interface
 */
export interface IPlugin {
  /** Plugin metadata */
  readonly metadata: PluginMetadata;

  /** Current plugin state */
  readonly state: PluginState;

  /**
   * Activate the plugin
   * Called when the plugin should start its functionality
   *
   * @returns Promise that resolves when activation is complete
   */
  activate(): Promise<void>;

  /**
   * Deactivate the plugin
   * Called when the plugin should stop its functionality
   *
   * @returns Promise that resolves when deactivation is complete
   */
  deactivate(): Promise<void>;

  /**
   * Configure the plugin
   * Called when plugin configuration changes
   *
   * @param config Plugin configuration
   */
  configure(config: PluginConfiguration): void;

  /**
   * Dispose plugin resources
   * Called when the plugin is being removed
   */
  dispose(): void;
}
