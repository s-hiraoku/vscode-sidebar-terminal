import * as vscode from 'vscode';
import { IWebViewStateManager, IMessageHandlerContext } from './interfaces';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { provider as log } from '../../utils/logger';
import { getConfigManager } from '../../config/ConfigManager';

/**
 * Manages WebView state, initialization, and panel location detection
 * 
 * This service extracts state management logic from SecondaryTerminalProvider
 * to improve testability and separation of concerns.
 */
export class WebViewStateManager implements IWebViewStateManager {
  private _isInitialized: boolean = false;

  constructor() {
    log('🔧 [StateManager] WebView state manager initialized');
  }

  /**
   * Check if WebView has been initialized
   */
  isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Set initialization state
   */
  setInitialized(value: boolean): void {
    const previousState = this._isInitialized;
    this._isInitialized = value;
    
    if (previousState !== value) {
      log(`🔧 [StateManager] Initialization state changed: ${previousState} → ${value}`);
    }
  }

  /**
   * Get current terminal settings
   */
  getCurrentSettings(): PartialTerminalSettings {
    try {
      const settings = getConfigManager().getCompleteTerminalSettings();
      const altClickSettings = this.getAltClickSettings();
      const config = vscode.workspace.getConfiguration('secondaryTerminal');

      return {
        cursorBlink: settings.cursorBlink,
        theme: settings.theme || 'auto',
        // VS Code standard settings for Alt+Click functionality
        altClickMovesCursor: altClickSettings.altClickMovesCursor,
        multiCursorModifier: altClickSettings.multiCursorModifier,
        // CLI Agent integration settings
        enableCliAgentIntegration: config.get<boolean>('enableCliAgentIntegration', true),
        // Dynamic split direction settings (Issue #148)
        dynamicSplitDirection: config.get<boolean>('dynamicSplitDirection', true),
        panelLocation: config.get<'auto' | 'sidebar' | 'panel'>('panelLocation', 'auto'),
      };
    } catch (error) {
      log('❌ [StateManager] Error getting current settings:', error);
      return {
        cursorBlink: true,
        theme: 'auto',
        altClickMovesCursor: false,
        multiCursorModifier: 'alt',
        enableCliAgentIntegration: true,
        dynamicSplitDirection: true,
        panelLocation: 'auto',
      };
    }
  }

  /**
   * Get current font settings
   */
  getCurrentFontSettings(): WebViewFontSettings {
    try {
      const configManager = getConfigManager();

      return {
        fontSize: configManager.getFontSize(),
        fontFamily: configManager.getFontFamily(),
        fontWeight: configManager.getFontWeight(),
        fontWeightBold: configManager.getFontWeightBold(),
        lineHeight: configManager.getLineHeight(),
        letterSpacing: configManager.getLetterSpacing(),
      };
    } catch (error) {
      log('❌ [StateManager] Error getting font settings:', error);
      return {
        fontSize: 14,
        fontFamily: 'monospace',
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        lineHeight: 1.2,
        letterSpacing: 0,
      };
    }
  }

  /**
   * Get Alt+Click settings
   */
  getAltClickSettings(): { altClickMovesCursor: boolean; multiCursorModifier: string } {
    try {
      const vsCodeAltClickSetting = vscode.workspace
        .getConfiguration('terminal.integrated')
        .get<boolean>('altClickMovesCursor', false);

      const vsCodeMultiCursorModifier = vscode.workspace
        .getConfiguration('editor')
        .get<string>('multiCursorModifier', 'alt');

      const extensionAltClickSetting = vscode.workspace
        .getConfiguration('secondaryTerminal')
        .get<boolean>('altClickMovesCursor', vsCodeAltClickSetting);

      return {
        altClickMovesCursor: extensionAltClickSetting,
        multiCursorModifier: vsCodeMultiCursorModifier,
      };
    } catch (error) {
      log('❌ [StateManager] Error getting Alt+Click settings:', error);
      return {
        altClickMovesCursor: false,
        multiCursorModifier: 'alt',
      };
    }
  }

  /**
   * Get current panel location
   */
  getPanelLocation(): 'sidebar' | 'panel' {
    try {
      const config = vscode.workspace.getConfiguration('secondaryTerminal');
      
      // Check if dynamic split direction feature is enabled
      const isDynamicSplitEnabled = config.get<boolean>('dynamicSplitDirection', true);
      if (!isDynamicSplitEnabled) {
        log('📍 [StateManager] Dynamic split direction disabled, defaulting to sidebar');
        return 'sidebar';
      }

      // Get manual panel location setting
      const manualPanelLocation = config.get<'sidebar' | 'panel' | 'auto'>('panelLocation', 'auto');

      if (manualPanelLocation !== 'auto') {
        log(`📍 [StateManager] Using manual panel location: ${manualPanelLocation}`);
        return manualPanelLocation;
      }

      // For auto-detection, default to sidebar and request actual detection
      log('📍 [StateManager] Auto mode - defaulting to sidebar, will detect via WebView');
      return 'sidebar';
    } catch (error) {
      log('❌ [StateManager] Error getting panel location:', error);
      return 'sidebar';
    }
  }

  /**
   * Request panel location detection from WebView
   */
  requestPanelLocationDetection(context: IMessageHandlerContext): void {
    try {
      log('📍 [StateManager] Requesting panel location detection from WebView');

      // Send a message to WebView to analyze its dimensions and report back
      context.sendMessage({
        command: 'requestPanelLocationDetection',
      }).catch(error => {
        log('⚠️ [StateManager] Error sending panel location detection request:', error);
        
        // Fallback to sidebar assumption
        context.sendMessage({
          command: 'panelLocationUpdate',
          location: 'sidebar',
        }).catch(fallbackError => {
          log('❌ [StateManager] Fallback panel location update failed:', fallbackError);
        });

        // Set fallback context key
        void vscode.commands.executeCommand(
          'setContext',
          'secondaryTerminal.panelLocation',
          'sidebar'
        );
      });
    } catch (error) {
      log('⚠️ [StateManager] Error requesting panel location detection:', error);
    }
  }

  /**
   * Reset state (useful for testing or provider recreation)
   */
  reset(): void {
    this._isInitialized = false;
    log('🔄 [StateManager] State reset to initial values');
  }

  /**
   * Get current state summary for debugging
   */
  getStateDebugInfo(): object {
    return {
      isInitialized: this._isInitialized,
      panelLocation: this.getPanelLocation(),
      currentSettings: this.getCurrentSettings(),
      fontSettings: this.getCurrentFontSettings(),
      altClickSettings: this.getAltClickSettings(),
      timestamp: new Date().toISOString(),
    };
  }
}