/**
 * Plugin Configuration Service
 *
 * Manages plugin configuration from VS Code settings with hot-reload support.
 */

import * as vscode from 'vscode';
import { log } from '../../utils/logger';
import type { PluginConfiguration } from './IPlugin';
import type { PluginManager } from './PluginManager';

export interface AgentPluginConfig {
  enabled: boolean;
  confidenceThreshold: number;
}

export interface PluginSystemConfig {
  enablePluginSystem: boolean;
  claude: AgentPluginConfig;
  copilot: AgentPluginConfig;
  gemini: AgentPluginConfig;
  codex: AgentPluginConfig;
}

export class PluginConfigurationService implements vscode.Disposable {
  private readonly _configSection = 'secondaryTerminal.plugins';
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly _pluginManager: PluginManager) {}

  /**
   * Initialize configuration service and set up hot-reload
   */
  initialize(): void {
    log('🔧 [PLUGIN-CONFIG] Initializing plugin configuration service...');

    // Apply initial configuration
    this.applyConfiguration();

    // Watch for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(this._configSection)) {
        log('🔄 [PLUGIN-CONFIG] Configuration changed, reloading plugins...');
        this.applyConfiguration();
      }
    });

    this._disposables.push(configWatcher);
    log('✅ [PLUGIN-CONFIG] Plugin configuration service initialized');
  }

  /**
   * Get current plugin system configuration
   */
  getConfiguration(): PluginSystemConfig {
    const config = vscode.workspace.getConfiguration();

    return {
      enablePluginSystem: config.get<boolean>(
        'secondaryTerminal.plugins.enablePluginSystem',
        true
      ),
      claude: {
        enabled: config.get<boolean>('secondaryTerminal.plugins.claude.enabled', true),
        confidenceThreshold: config.get<number>(
          'secondaryTerminal.plugins.claude.confidenceThreshold',
          0.7
        ),
      },
      copilot: {
        enabled: config.get<boolean>('secondaryTerminal.plugins.copilot.enabled', true),
        confidenceThreshold: config.get<number>(
          'secondaryTerminal.plugins.copilot.confidenceThreshold',
          0.7
        ),
      },
      gemini: {
        enabled: config.get<boolean>('secondaryTerminal.plugins.gemini.enabled', true),
        confidenceThreshold: config.get<number>(
          'secondaryTerminal.plugins.gemini.confidenceThreshold',
          0.7
        ),
      },
      codex: {
        enabled: config.get<boolean>('secondaryTerminal.plugins.codex.enabled', true),
        confidenceThreshold: config.get<number>(
          'secondaryTerminal.plugins.codex.confidenceThreshold',
          0.7
        ),
      },
    };
  }

  /**
   * Apply current configuration to all plugins
   */
  private applyConfiguration(): void {
    const config = this.getConfiguration();

    log(`🔧 [PLUGIN-CONFIG] Plugin system enabled: ${config.enablePluginSystem}`);

    if (!config.enablePluginSystem) {
      log('⚠️ [PLUGIN-CONFIG] Plugin system is disabled');
      return;
    }

    // Apply configuration to each agent plugin
    this.applyPluginConfig('claude-agent', config.claude);
    this.applyPluginConfig('copilot-agent', config.copilot);
    this.applyPluginConfig('gemini-agent', config.gemini);
    this.applyPluginConfig('codex-agent', config.codex);
  }

  /**
   * Apply configuration to a specific plugin
   */
  private applyPluginConfig(pluginId: string, agentConfig: AgentPluginConfig): void {
    const plugin = this._pluginManager.getPlugin(pluginId);

    if (!plugin) {
      log(`⚠️ [PLUGIN-CONFIG] Plugin not found: ${pluginId}`);
      return;
    }

    // Build plugin configuration
    const pluginConfig: PluginConfiguration = {
      enabled: agentConfig.enabled,
      confidenceThreshold: agentConfig.confidenceThreshold,
    };

    log(
      `🔧 [PLUGIN-CONFIG] Applying config to ${pluginId}: enabled=${agentConfig.enabled}, threshold=${agentConfig.confidenceThreshold}`
    );

    // Apply configuration
    plugin.configure(pluginConfig);

    // Handle activation/deactivation based on enabled flag
    if (agentConfig.enabled && plugin.state === 'registered') {
      log(`▶️ [PLUGIN-CONFIG] Activating ${pluginId}...`);
      void this._pluginManager.activatePlugin(pluginId);
    } else if (!agentConfig.enabled && plugin.state === 'active') {
      log(`⏸️ [PLUGIN-CONFIG] Deactivating ${pluginId}...`);
      void this._pluginManager.deactivatePlugin(pluginId);
    }
  }

  /**
   * Check if plugin system is enabled
   */
  isPluginSystemEnabled(): boolean {
    return this.getConfiguration().enablePluginSystem;
  }

  /**
   * Dispose of configuration service
   */
  dispose(): void {
    log('🔧 [PLUGIN-CONFIG] Disposing plugin configuration service...');
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
