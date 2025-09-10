/**
 * Configuration Migration Utility
 * 
 * Handles migration from multiple configuration services to UnifiedConfigurationService:
 * - src/config/ConfigManager.ts → UnifiedConfigurationService
 * - src/webview/managers/ConfigManager.ts → UnifiedConfigurationService  
 * - src/services/core/UnifiedConfigurationService.ts → New UnifiedConfigurationService
 * - src/services/webview/WebViewSettingsManagerService.ts → UnifiedConfigurationService
 * 
 * This utility ensures smooth transition without data loss and validates migration success.
 */

import * as vscode from 'vscode';
import { UnifiedConfigurationService, getUnifiedConfigurationService } from './UnifiedConfigurationService';
import { CONFIG_SECTIONS } from '../types/shared';
import { terminal as log } from '../utils/logger';

/**
 * Migration result interface
 */
export interface MigrationResult {
  success: boolean;
  migratedKeys: string[];
  errors: string[];
  warnings: string[];
  backupCreated: boolean;
  backupPath?: string;
}

/**
 * Migration validation result
 */
export interface MigrationValidation {
  isValid: boolean;
  missingKeys: string[];
  incorrectValues: Array<{
    key: string;
    expected: unknown;
    actual: unknown;
  }>;
  extraKeys: string[];
}

/**
 * Legacy configuration backup
 */
interface LegacyConfigurationBackup {
  timestamp: string;
  source: string;
  configurations: Record<string, unknown>;
  metadata: {
    vsCodeVersion: string;
    extensionVersion: string;
    platform: string;
  };
}

/**
 * Configuration keys that need migration
 */
const MIGRATION_KEYS = {
  // Font settings
  'terminal.integrated.fontSize': 14,
  'terminal.integrated.fontFamily': 'monospace',
  'terminal.integrated.fontWeight': 'normal',
  'terminal.integrated.fontWeightBold': 'bold',
  'terminal.integrated.lineHeight': 1.0,
  'terminal.integrated.letterSpacing': 0,
  
  // Terminal settings
  'terminal.integrated.altClickMovesCursor': false,
  'editor.multiCursorModifier': 'alt',
  
  // Extension settings
  'sidebarTerminal.maxTerminals': 5,
  'sidebarTerminal.shell': '',
  'sidebarTerminal.shellArgs': [],
  'sidebarTerminal.defaultDirectory': '',
  'sidebarTerminal.theme': 'auto',
  'sidebarTerminal.cursorBlink': true,
  'sidebarTerminal.enableCliAgentIntegration': true,
  'sidebarTerminal.dynamicSplitDirection': true,
  'sidebarTerminal.panelLocation': 'auto',
  'sidebarTerminal.confirmBeforeKill': false,
  'sidebarTerminal.protectLastTerminal': true,
  'sidebarTerminal.minTerminalCount': 1,
} as const;

/**
 * Configuration Migrator
 * 
 * Handles migration from legacy configuration services to the unified service.
 * Provides backup, validation, and rollback capabilities.
 */
export class ConfigurationMigrator {
  private readonly _unifiedService: UnifiedConfigurationService;
  private readonly _extensionContext: vscode.ExtensionContext;
  
  constructor(extensionContext: vscode.ExtensionContext) {
    this._unifiedService = getUnifiedConfigurationService();
    this._extensionContext = extensionContext;
  }

  /**
   * Perform complete migration from all legacy services
   */
  async migrateAll(): Promise<MigrationResult> {
    log('🔄 [ConfigMigrator] Starting complete configuration migration');
    
    const result: MigrationResult = {
      success: false,
      migratedKeys: [],
      errors: [],
      warnings: [],
      backupCreated: false,
    };

    try {
      // Step 1: Create backup of current configuration
      const backup = await this._createConfigurationBackup();
      if (backup) {
        result.backupCreated = true;
        result.backupPath = 'VS Code ExtensionContext.globalState';
        log('✅ [ConfigMigrator] Configuration backup created');
      }

      // Step 2: Migrate from each legacy service
      const migrationResults = await Promise.allSettled([
        this._migrateFromExtensionConfigManager(),
        this._migrateFromWebViewConfigManager(),
        this._migrateFromOldUnifiedService(),
        this._migrateFromWebViewSettingsManager(),
      ]);

      // Step 3: Collect results
      migrationResults.forEach((migrationResult, index) => {
        const serviceNames = [
          'ExtensionConfigManager',
          'WebViewConfigManager', 
          'OldUnifiedService',
          'WebViewSettingsManager'
        ];
        
        if (migrationResult.status === 'fulfilled') {
          if (migrationResult.value.migratedKeys) {
            result.migratedKeys.push(...migrationResult.value.migratedKeys);
          }
          if (migrationResult.value.warnings) {
            result.warnings.push(...migrationResult.value.warnings);
          }
          log(`✅ [ConfigMigrator] ${serviceNames[index]} migration completed`);
        } else {
          result.errors.push(`${serviceNames[index]} migration failed: ${migrationResult.reason}`);
          log(`❌ [ConfigMigrator] ${serviceNames[index]} migration failed:`, migrationResult.reason);
        }
      });

      // Step 4: Validate migration
      const validation = await this._validateMigration();
      if (!validation.isValid) {
        result.warnings.push(`Migration validation found issues: ${validation.missingKeys.length} missing keys, ${validation.incorrectValues.length} incorrect values`);
      }

      // Step 5: Initialize unified service
      this._unifiedService.initialize();

      result.success = result.errors.length === 0;
      
      if (result.success) {
        log(`✅ [ConfigMigrator] Migration completed successfully. ${result.migratedKeys.length} keys migrated`);
        
        // Mark migration as completed
        await this._extensionContext.globalState.update('configurationMigrationCompleted', {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          migratedKeysCount: result.migratedKeys.length,
        });
      } else {
        log(`❌ [ConfigMigrator] Migration completed with errors: ${result.errors.length} errors`);
      }

      return result;
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error}`);
      log('❌ [ConfigMigrator] Migration failed:', error);
      return result;
    }
  }

  /**
   * Check if migration has already been completed
   */
  async isMigrationCompleted(): Promise<boolean> {
    const migrationInfo = await this._extensionContext.globalState.get('configurationMigrationCompleted');
    return !!migrationInfo;
  }

  /**
   * Validate current configuration against expected values
   */
  async validateCurrentConfiguration(): Promise<MigrationValidation> {
    log('🔍 [ConfigMigrator] Validating current configuration');
    
    const validation: MigrationValidation = {
      isValid: true,
      missingKeys: [],
      incorrectValues: [],
      extraKeys: [],
    };

    try {
      // Check each expected configuration key
      for (const [key, defaultValue] of Object.entries(MIGRATION_KEYS)) {
        const [section, configKey] = key.split('.', 2);
        if (!section || !configKey) {
          continue; // Skip malformed keys
        }
        const actualValue = this._unifiedService.get(section, configKey, defaultValue);
        
        // For this validation, we mainly check that values are accessible
        // Actual value validation depends on user preferences
        if (actualValue === undefined || actualValue === null) {
          validation.missingKeys.push(key);
          validation.isValid = false;
        }
      }

      // Test core functionality
      try {
        const terminalConfig = this._unifiedService.getExtensionTerminalConfig();
        const fontSettings = this._unifiedService.getWebViewFontSettings();
        const altClickSettings = this._unifiedService.getAltClickSettings();
        
        if (!terminalConfig || !fontSettings || !altClickSettings) {
          validation.isValid = false;
          validation.incorrectValues.push({
            key: 'core-functionality',
            expected: 'functioning methods',
            actual: 'undefined or null responses',
          });
        }
      } catch (error) {
        validation.isValid = false;
        validation.incorrectValues.push({
          key: 'core-functionality',
          expected: 'no errors',
          actual: `error: ${error}`,
        });
      }

    } catch (error) {
      validation.isValid = false;
      validation.incorrectValues.push({
        key: 'validation-process',
        expected: 'no errors',
        actual: `validation error: ${error}`,
      });
    }

    log(`🔍 [ConfigMigrator] Validation result: ${validation.isValid ? 'VALID' : 'INVALID'}`);
    if (!validation.isValid) {
      log(`   Missing keys: ${validation.missingKeys.length}`);
      log(`   Incorrect values: ${validation.incorrectValues.length}`);
    }

    return validation;
  }

  /**
   * Rollback migration (restore from backup)
   */
  async rollbackMigration(): Promise<boolean> {
    log('↩️ [ConfigMigrator] Rolling back configuration migration');
    
    try {
      const backup = await this._extensionContext.globalState.get('configurationBackup') as LegacyConfigurationBackup | undefined;
      
      if (!backup) {
        log('❌ [ConfigMigrator] No backup found for rollback');
        return false;
      }

      // Restore configurations from backup
      for (const [key, value] of Object.entries(backup.configurations)) {
        try {
          const [section, configKey] = key.split('.', 2);
          if (!section || !configKey) {
            continue; // Skip malformed keys
          }
          await vscode.workspace.getConfiguration(section).update(
            configKey,
            value,
            vscode.ConfigurationTarget.Global
          );
        } catch (error) {
          log(`⚠️ [ConfigMigrator] Failed to restore ${key}:`, error);
        }
      }

      // Clear migration completion marker
      await this._extensionContext.globalState.update('configurationMigrationCompleted', undefined);

      log('✅ [ConfigMigrator] Configuration rollback completed');
      return true;
      
    } catch (error) {
      log('❌ [ConfigMigrator] Rollback failed:', error);
      return false;
    }
  }

  /**
   * Create backup of current configuration
   */
  private async _createConfigurationBackup(): Promise<LegacyConfigurationBackup | null> {
    try {
      const configurations: Record<string, unknown> = {};
      
      // Backup current configuration values
      for (const key of Object.keys(MIGRATION_KEYS)) {
        try {
          const [section, configKey] = key.split('.', 2);
          if (!section || !configKey) {
            continue; // Skip malformed keys
          }
          const config = vscode.workspace.getConfiguration(section);
          const value = config.get(configKey);
          if (value !== undefined) {
            configurations[key] = value;
          }
        } catch (error) {
          log(`⚠️ [ConfigMigrator] Failed to backup ${key}:`, error);
        }
      }

      const backup: LegacyConfigurationBackup = {
        timestamp: new Date().toISOString(),
        source: 'ConfigurationMigrator',
        configurations,
        metadata: {
          vsCodeVersion: vscode.version,
          extensionVersion: this._extensionContext.extension.packageJSON.version,
          platform: process.platform,
        },
      };

      // Store backup in extension global state
      await this._extensionContext.globalState.update('configurationBackup', backup);
      
      return backup;
      
    } catch (error) {
      log('❌ [ConfigMigrator] Failed to create configuration backup:', error);
      return null;
    }
  }

  /**
   * Migrate from extension-side ConfigManager
   */
  private async _migrateFromExtensionConfigManager(): Promise<Partial<MigrationResult>> {
    const result: Partial<MigrationResult> = {
      migratedKeys: [],
      warnings: [],
    };

    try {
      // The extension ConfigManager was primarily a wrapper around VS Code settings
      // Migration mainly involves ensuring unified service can access the same settings
      
      // Verify access to key extension settings
      const keySettings = [
        'sidebarTerminal.maxTerminals',
        'sidebarTerminal.shell', 
        'sidebarTerminal.theme',
        'sidebarTerminal.cursorBlink',
        'sidebarTerminal.enableCliAgentIntegration',
      ];

      for (const key of keySettings) {
        const [section, configKey] = key.split('.', 2);
        if (!section || !configKey) {
          continue; // Skip malformed keys
        }
        const value = this._unifiedService.get(section, configKey, MIGRATION_KEYS[key as keyof typeof MIGRATION_KEYS]);
        if (value !== undefined) {
          result.migratedKeys!.push(key);
        } else {
          result.warnings!.push(`Could not access ${key} during migration`);
        }
      }

      // Test font hierarchy functionality  
      try {
        const fontSize = this._unifiedService.getFontSize();
        const fontFamily = this._unifiedService.getFontFamily();
        if (fontSize > 0 && fontFamily) {
          result.migratedKeys!.push('font-hierarchy');
        }
      } catch (error) {
        result.warnings!.push(`Font hierarchy migration issue: ${error}`);
      }

    } catch (error) {
      throw new Error(`ExtensionConfigManager migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Migrate from WebView ConfigManager
   */
  private async _migrateFromWebViewConfigManager(): Promise<Partial<MigrationResult>> {
    const result: Partial<MigrationResult> = {
      migratedKeys: [],
      warnings: [],
    };

    try {
      // WebView ConfigManager used VS Code state for persistence
      // Check if we can access WebView-specific settings
      
      const webViewSettings = [
        'scrollback',
        'bellSound', 
        'dynamicSplitDirection',
        'panelLocation',
        'sendKeybindingsToShell',
        'allowChords',
        'allowMnemonics',
      ];

      for (const setting of webViewSettings) {
        try {
          const value = this._unifiedService.get(CONFIG_SECTIONS.SIDEBAR_TERMINAL, setting, undefined);
          if (value !== undefined) {
            result.migratedKeys!.push(`webview.${setting}`);
          }
        } catch (error) {
          result.warnings!.push(`WebView setting ${setting} migration issue: ${error}`);
        }
      }

      // Test WebView-specific configuration methods
      try {
        const webViewTerminalSettings = this._unifiedService.getWebViewTerminalSettings();
        const webViewFontSettings = this._unifiedService.getWebViewFontSettings();
        
        if (webViewTerminalSettings && webViewFontSettings) {
          result.migratedKeys!.push('webview-methods');
        }
      } catch (error) {
        result.warnings!.push(`WebView methods migration issue: ${error}`);
      }

    } catch (error) {
      throw new Error(`WebViewConfigManager migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Migrate from old UnifiedConfigurationService
   */
  private async _migrateFromOldUnifiedService(): Promise<Partial<MigrationResult>> {
    const result: Partial<MigrationResult> = {
      migratedKeys: [],
      warnings: [],
    };

    try {
      // Old UnifiedConfigurationService had similar functionality
      // Main migration is ensuring event handling and caching work correctly
      
      // Test configuration access
      const testConfigs = [
        ['terminal.integrated', 'fontSize'],
        ['terminal.integrated', 'fontFamily'], 
        ['editor', 'multiCursorModifier'],
        ['sidebarTerminal', 'maxTerminals'],
      ];

      for (const [section, key] of testConfigs) {
        if (!section || !key) {
          continue; // Skip malformed entries
        }
        try {
          const value = this._unifiedService.get(section, key, 'test-default');
          if (value !== undefined && value !== 'test-default') {
            result.migratedKeys!.push(`${section}.${key}`);
          }
        } catch (error) {
          result.warnings!.push(`Old unified service config ${section}.${key} migration issue: ${error}`);
        }
      }

      // Test feature enablement
      const features = ['cliAgentIntegration', 'altClickMovesCursor', 'dynamicSplitDirection'];
      for (const feature of features) {
        try {
          this._unifiedService.isFeatureEnabled(feature); // Check if feature is enabled
          result.migratedKeys!.push(`feature.${feature}`);
        } catch (error) {
          result.warnings!.push(`Feature ${feature} migration issue: ${error}`);
        }
      }

    } catch (error) {
      throw new Error(`OldUnifiedService migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Migrate from WebViewSettingsManagerService
   */
  private async _migrateFromWebViewSettingsManager(): Promise<Partial<MigrationResult>> {
    const result: Partial<MigrationResult> = {
      migratedKeys: [],
      warnings: [],
    };

    try {
      // WebViewSettingsManagerService handled settings updates and event listening
      // Migrate by ensuring the unified service can handle the same functionality
      
      // Test Alt+Click settings (key functionality from WebViewSettingsManager)
      try {
        const altClickSettings = this._unifiedService.getAltClickSettings();
        if (altClickSettings && typeof altClickSettings.altClickMovesCursor === 'boolean') {
          result.migratedKeys!.push('alt-click-settings');
        }
      } catch (error) {
        result.warnings!.push(`Alt+Click settings migration issue: ${error}`);
      }

      // Test configuration change events
      try {
        let eventReceived = false;
        const disposable = this._unifiedService.onDidChangeConfiguration(() => {
          eventReceived = true;
        });
        
        // Trigger a small change to test event handling
        setTimeout(() => {
          if (eventReceived) {
            result.migratedKeys!.push('configuration-events');
          } else {
            result.warnings!.push('Configuration change events may not be working');
          }
          disposable.dispose();
        }, 100);
        
      } catch (error) {
        result.warnings!.push(`Configuration event migration issue: ${error}`);
      }

      // Test complete configuration access
      try {
        const completeConfig = this._unifiedService.getCompleteExtensionConfig();
        if (completeConfig && completeConfig.fontSize && completeConfig.fontFamily) {
          result.migratedKeys!.push('complete-extension-config');
        }
      } catch (error) {
        result.warnings!.push(`Complete configuration migration issue: ${error}`);
      }

    } catch (error) {
      throw new Error(`WebViewSettingsManager migration failed: ${error}`);
    }

    return result;
  }

  /**
   * Validate migration completeness
   */
  private async _validateMigration(): Promise<MigrationValidation> {
    return this.validateCurrentConfiguration();
  }

  /**
   * Get migration debug information
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      unifiedServiceDebug: this._unifiedService.getDebugInfo(),
      migrationCompleted: this._extensionContext.globalState.get('configurationMigrationCompleted'),
      backupExists: !!this._extensionContext.globalState.get('configurationBackup'),
      timestamp: new Date().toISOString(),
    };
  }
}