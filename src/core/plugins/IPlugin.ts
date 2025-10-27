/**
 * Base Plugin Interface
 *
 * Defines the contract for all plugins in the system.
 * Plugins can extend functionality without modifying core code.
 */

import * as vscode from 'vscode';
import type { EventBus } from '../EventBus';

/**
 * Plugin context provided to plugins during activation
 */
export interface IPluginContext {
  /** Event bus for cross-component communication */
  readonly eventBus: EventBus;

  /** Extension context for VS Code API access */
  readonly extensionContext: vscode.ExtensionContext;

  /** Logger for plugin-specific logging */
  readonly logger: IPluginLogger;

  /** Configuration accessor */
  readonly config: IPluginConfig;
}

/**
 * Plugin-specific logger interface
 */
export interface IPluginLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Plugin configuration accessor
 */
export interface IPluginConfig {
  /**
   * Get configuration value for this plugin
   * @param key Configuration key (relative to plugin namespace)
   * @param defaultValue Default value if not configured
   */
  get<T>(key: string, defaultValue?: T): T | undefined;

  /**
   * Check if a configuration key exists
   * @param key Configuration key
   */
  has(key: string): boolean;
}

/**
 * Base plugin interface
 */
export interface IPlugin extends vscode.Disposable {
  /** Unique plugin identifier (kebab-case recommended) */
  readonly id: string;

  /** Human-readable plugin name */
  readonly name: string;

  /** Semantic version string */
  readonly version: string;

  /** Optional plugin description */
  readonly description?: string;

  /**
   * Called when the plugin is activated
   * @param context Plugin context with access to services
   */
  activate(context: IPluginContext): Promise<void> | void;

  /**
   * Called when the plugin is deactivated
   * Cleanup resources here
   */
  deactivate(): Promise<void> | void;

  /**
   * Called when plugin configuration changes
   * @param config New configuration values
   */
  configure(config: Record<string, unknown>): void;
}

/**
 * Plugin metadata for discovery and management
 */
export interface IPluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  activatedAt?: Date;
}
