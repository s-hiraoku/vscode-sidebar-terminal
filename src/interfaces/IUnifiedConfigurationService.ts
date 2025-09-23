/**
 * Interface definitions for the Unified Configuration Service
 *
 * These interfaces define the contract for configuration management
 * following VS Code's established patterns and ensure type safety
 * across the entire configuration system.
 */

import * as vscode from 'vscode';
import {
  ExtensionTerminalConfig,
  CompleteTerminalSettings,
  CompleteExtensionConfig,
  WebViewFontSettings,
  WebViewTerminalSettings,
  TerminalProfilesConfig,
} from '../types/shared';

/**
 * Configuration change event interface
 * Follows VS Code's ConfigurationChangeEvent pattern
 */
export interface IConfigurationChangeEvent {
  readonly affectsConfiguration: (section: string, key?: string) => boolean;
  readonly source: ConfigurationTarget;
  readonly changedKeys: string[];
  readonly timestamp: number;
}

/**
 * Configuration target enumeration
 * Matches VS Code's configuration hierarchy
 */
export enum ConfigurationTarget {
  DEFAULT = 0,
  APPLICATION = 1,
  USER = 2,
  WORKSPACE = 3,
  WORKSPACE_FOLDER = 4,
  MEMORY = 5,
}

/**
 * Configuration validation result
 */
export interface IConfigurationValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

/**
 * Configuration registry interface
 * Provides type safety and validation schemas
 */
export interface IConfigurationRegistry {
  /**
   * Register a configuration schema
   */
  register(key: string, schema: IConfigurationSchema): void;

  /**
   * Get configuration schema
   */
  getSchema(key: string): IConfigurationSchema | undefined;

  /**
   * Validate configuration value against schema
   */
  validate(key: string, value: unknown): IConfigurationValidationResult;
}

/**
 * Configuration schema interface
 * Defines validation rules for configuration values
 */
export interface IConfigurationSchema {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly default: unknown;
  readonly description?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly enum?: readonly unknown[];
  readonly properties?: Record<string, IConfigurationSchema>;
}

/**
 * Main configuration service interface
 * Provides unified access to all extension configuration
 */
export interface IUnifiedConfigurationService extends vscode.Disposable {
  /**
   * Configuration change event
   */
  readonly onDidChangeConfiguration: vscode.Event<IConfigurationChangeEvent>;

  /**
   * Initialize the service
   */
  initialize(): void;

  /**
   * Get configuration value with type safety
   */
  get<T>(section: string, key: string, defaultValue: T): T;

  /**
   * Update configuration value
   */
  update(
    section: string,
    key: string,
    value: unknown,
    target?: vscode.ConfigurationTarget
  ): Promise<void>;

  /**
   * Extension terminal configuration
   */
  getExtensionTerminalConfig(): ExtensionTerminalConfig;

  /**
   * Complete terminal settings
   */
  getCompleteTerminalSettings(): CompleteTerminalSettings;

  /**
   * WebView terminal settings
   */
  getWebViewTerminalSettings(): WebViewTerminalSettings;

  /**
   * WebView font settings
   */
  getWebViewFontSettings(): WebViewFontSettings;

  /**
   * Complete extension configuration for WebView
   */
  getCompleteExtensionConfig(): CompleteExtensionConfig;

  /**
   * Platform-specific shell configuration
   */
  getShellForPlatform(customShell?: string): string;

  /**
   * Alt+Click settings (VS Code standard)
   */
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string };

  /**
   * Font configuration methods
   */
  getFontFamily(): string;
  getFontSize(): number;
  getFontWeight(): string;
  getFontWeightBold(): string;
  getLineHeight(): number;
  getLetterSpacing(): number;

  /**
   * Terminal profiles configuration
   */
  getTerminalProfilesConfig(): TerminalProfilesConfig;

  /**
   * Feature enablement check
   */
  isFeatureEnabled(featureName: string): boolean;

  /**
   * Cache management
   */
  clearCache(): void;

  /**
   * Debug information
   */
  getDebugInfo(): Record<string, unknown>;
}

/**
 * Configuration service factory interface
 * For dependency injection and testing
 */
export interface IConfigurationServiceFactory {
  /**
   * Create configuration service instance
   */
  createConfigurationService(): IUnifiedConfigurationService;

  /**
   * Create configuration registry
   */
  createConfigurationRegistry(): IConfigurationRegistry;
}

/**
 * Configuration migration interface
 * For migrating from old configuration services
 */
export interface IConfigurationMigrator {
  /**
   * Migrate from legacy ConfigManager
   */
  migrateFromConfigManager(): Promise<void>;

  /**
   * Migrate from WebView ConfigManager
   */
  migrateFromWebViewConfigManager(): Promise<void>;

  /**
   * Migrate from UnifiedConfigurationService (old version)
   */
  migrateFromOldUnifiedService(): Promise<void>;

  /**
   * Validate migration results
   */
  validateMigration(): IConfigurationValidationResult;
}

/**
 * Configuration event handler interface
 * For handling configuration change events
 */
export interface IConfigurationEventHandler {
  /**
   * Handle configuration change event
   */
  onConfigurationChanged(event: IConfigurationChangeEvent): void;

  /**
   * Handle font settings change
   */
  onFontSettingsChanged(fontSettings: WebViewFontSettings): void;

  /**
   * Handle Alt+Click settings change
   */
  onAltClickSettingsChanged(settings: {
    altClickMovesCursor: boolean;
    multiCursorModifier: string;
  }): void;

  /**
   * Handle feature enablement change
   */
  onFeatureEnabledChanged(featureName: string, enabled: boolean): void;
}
