/**
 * Panel Location Handler
 *
 * Handles panel location detection and updates based on WebView dimensions
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { hasProperty } from '../../../types/type-guards';
import { MessageQueue } from '../../utils/MessageQueue';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Panel Location Handler
 *
 * Responsibilities:
 * - Detect panel location based on WebView dimensions
 * - Update split direction based on panel location
 * - Report panel location to Extension
 */
export class PanelLocationHandler implements IMessageHandler {
  /**
   * Panel Location Detection Constants
   *
   * PANEL_ASPECT_RATIO_THRESHOLD: The aspect ratio (width/height) threshold used to distinguish
   * between sidebar and panel layouts. A value of 1.2 was chosen based on empirical testing:
   * - Sidebar layouts are typically narrow and tall (aspect ratio < 1.2)
   * - Bottom panel layouts are typically wide and short (aspect ratio > 1.2)
   * - The threshold of 1.2 provides a comfortable buffer above 1.0 to account for
   *   edge cases where the sidebar might be slightly wider than tall
   *
   * This threshold balances accuracy with tolerance for various window configurations.
   */
  private static readonly PANEL_ASPECT_RATIO_THRESHOLD = 1.2;

  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly logger: ManagerLogger
  ) {}

  /**
   * Handle panel location related messages
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const command = (msg as { command?: string }).command;

    switch (command) {
      case 'panelLocationUpdate':
        this.handlePanelLocationUpdate(msg, coordinator);
        break;
      case 'requestPanelLocationDetection':
        this.handleRequestPanelLocationDetection(coordinator);
        break;
      default:
        this.logger.warn(`Unknown panel location command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return ['panelLocationUpdate', 'requestPanelLocationDetection'];
  }

  /**
   * Handle panel location update message
   */
  private handlePanelLocationUpdate(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    try {
      const location = ((msg as { location?: string }).location as 'sidebar' | 'panel') || 'sidebar';
      this.logger.info(`Panel location update: ${location}`);

      // Get split manager from coordinator
      const splitManager = (coordinator as { getSplitManager?: () => unknown }).getSplitManager?.();
      if (!splitManager) {
        this.logger.warn('SplitManager not available on coordinator');
        return;
      }

      // Check if dynamic split direction is enabled via settings
      const configManager = (
        coordinator as { getManagers?: () => { config?: unknown } }
      ).getManagers?.()?.config;
      let isDynamicSplitEnabled = true; // Default to enabled

      if (configManager) {
        try {
          if (
            hasProperty(
              configManager,
              'loadSettings',
              (value): value is () => { dynamicSplitDirection?: boolean; [key: string]: unknown } =>
                typeof value === 'function'
            )
          ) {
            const settings = configManager.loadSettings();
            isDynamicSplitEnabled = settings.dynamicSplitDirection !== false;
          }
        } catch (error) {
          this.logger.warn('Could not load settings, using default behavior');
        }
      }

      if (!isDynamicSplitEnabled) {
        this.logger.info(
          'Dynamic split direction is disabled via settings, ignoring location update'
        );
        return;
      }

      // Update split direction based on panel location
      const newSplitDirection = location === 'panel' ? 'horizontal' : 'vertical';
      this.logger.info(`Updating split direction to: ${newSplitDirection} (location: ${location})`);

      // Update split direction if it has changed
      if (
        hasProperty(
          splitManager,
          'updateSplitDirection',
          (
            value
          ): value is (
            direction: 'horizontal' | 'vertical',
            location: 'sidebar' | 'panel'
          ) => void => typeof value === 'function'
        )
      ) {
        splitManager.updateSplitDirection(newSplitDirection, location);
      }

      // 🎯 FIX: Also update terminals-wrapper flexDirection in normal mode
      // Panel (horizontal) → row (横並び)
      // Sidebar (vertical) → column (縦並び)
      const terminalsWrapper = document.getElementById('terminals-wrapper');
      if (terminalsWrapper) {
        const newFlexDirection = newSplitDirection === 'horizontal' ? 'row' : 'column';
        terminalsWrapper.style.flexDirection = newFlexDirection;
        this.logger.info(
          `✅ Updated terminals-wrapper flexDirection to: ${newFlexDirection} (location: ${location})`
        );
      } else {
        this.logger.warn('terminals-wrapper element not found, cannot update flexDirection');
      }
    } catch (error) {
      this.logger.error('Error handling panel location update', error);
    }
  }

  /**
   * Handle panel location detection request from Extension
   */
  private handleRequestPanelLocationDetection(_coordinator: IManagerCoordinator): void {
    try {
      this.logger.info('📍 [WEBVIEW] ==================== PANEL LOCATION DETECTION ====================');
      this.logger.info('📍 [WEBVIEW] Handling panel location detection request');

      // Analyze WebView dimensions to determine likely panel location
      const detectedLocation = this.analyzeWebViewDimensions();

      this.logger.info(`📍 [WEBVIEW] ✅ Dimension analysis result: ${detectedLocation}`);

      // Report back to Extension
      void this.messageQueue.enqueue({
        command: 'reportPanelLocation',
        location: detectedLocation,
        timestamp: Date.now(),
      });

      this.logger.info('📍 [WEBVIEW] Sent reportPanelLocation message to Extension');
      this.logger.info('📍 [WEBVIEW] ==================================================================');
    } catch (error) {
      this.logger.error('Error in panel location detection', error);
      // Fallback to sidebar
      void this.messageQueue.enqueue({
        command: 'reportPanelLocation',
        location: 'sidebar',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Analyze WebView dimensions to determine panel location
   *
   * This method uses aspect ratio heuristics to detect whether the webview is displayed
   * in the sidebar (narrow and tall) or bottom panel (wide and short). The detection
   * is based on the container's width/height ratio compared to PANEL_ASPECT_RATIO_THRESHOLD.
   *
   * @returns 'sidebar' if the layout appears to be in the sidebar, 'panel' if in bottom panel
   */
  private analyzeWebViewDimensions(): 'sidebar' | 'panel' {
    try {
      // Get WebView container dimensions
      const container = document.body;
      if (!container) {
        this.logger.warn('No container found, defaulting to sidebar');
        return 'sidebar';
      }

      const width = container.clientWidth;
      const height = container.clientHeight;

      this.logger.info(`📐 [DIMENSIONS] Container: ${width}px × ${height}px`);

      if (width === 0 || height === 0) {
        this.logger.warn('Invalid dimensions, defaulting to sidebar');
        return 'sidebar';
      }

      // Calculate aspect ratio (width/height)
      const aspectRatio = width / height;
      const threshold = PanelLocationHandler.PANEL_ASPECT_RATIO_THRESHOLD;

      this.logger.info(`📐 [DIMENSIONS] Aspect ratio: ${aspectRatio.toFixed(3)} (threshold: ${threshold})`);

      // Apply heuristic: Compare aspect ratio against threshold
      // Sidebar: narrow and tall (aspect ratio < threshold)
      // Bottom Panel: wide and short (aspect ratio > threshold)
      if (aspectRatio > threshold) {
        this.logger.info(`📐 [DIMENSIONS] ✅ Wide layout (${aspectRatio.toFixed(3)} > ${threshold}) → BOTTOM PANEL`);
        return 'panel';
      } else {
        this.logger.info(`📐 [DIMENSIONS] ✅ Tall/Square layout (${aspectRatio.toFixed(3)} ≤ ${threshold}) → SIDEBAR`);
        return 'sidebar';
      }
    } catch (error) {
      this.logger.error('Error analyzing dimensions', error);
      return 'sidebar';
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // No resources to clean up
  }
}
