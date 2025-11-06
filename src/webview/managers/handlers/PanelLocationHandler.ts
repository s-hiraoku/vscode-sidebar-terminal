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
 * 🎯 SINGLE SOURCE OF TRUTH for panel location and flex-direction updates
 *
 * Responsibilities:
 * - Detect panel location based on WebView dimensions
 * - Update split direction based on panel location
 * - Report panel location to Extension
 * - Manage cached state to prevent redundant updates (VS Code pattern)
 *
 * Architecture Pattern (from VS Code):
 * - Cached state comparison (update only when changed)
 * - Double-guard pattern (check at multiple levels)
 * - No debouncing (simple state comparison is sufficient)
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

  /**
   * 🎯 Cached state to prevent redundant updates (VS Code pattern)
   */
  private cachedFlexDirection: 'row' | 'column' | null = null;
  private cachedPanelLocation: 'sidebar' | 'panel' | null = null;

  constructor(
    private readonly messageQueue: MessageQueue,
    private readonly logger: ManagerLogger
  ) {
    // 🎯 OPTIMIZATION: Initialize autonomous detection when DOM is ready
    // ResizeObserver will wait for valid (non-zero) dimensions before applying
    this.initializeAutonomousDetection();
  }

  /**
   * Initialize autonomous panel location detection
   *
   * 🎯 VS Code Pattern: CSS class-based layout with state comparison
   */
  private initializeAutonomousDetection(): void {
    let initialDetectionDone = false;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Wait for valid dimensions
        if (width === 0 || height === 0) {
          continue;
        }

        const detectedLocation = this.detectPanelLocation();

        // Initial detection
        if (!initialDetectionDone) {
          const terminalsWrapper = document.getElementById('terminals-wrapper');
          if (terminalsWrapper) {
            // Apply CSS class for vertical layout (sidebar)
            if (detectedLocation === 'sidebar') {
              terminalsWrapper.classList.add('terminal-side-view');
            } else {
              terminalsWrapper.classList.remove('terminal-side-view');
            }

            // Update cached state
            this.cachedFlexDirection = detectedLocation === 'panel' ? 'row' : 'column';
            this.cachedPanelLocation = detectedLocation;
          }

          // Report to Extension
          void this.messageQueue.enqueue({
            command: 'reportPanelLocation',
            location: detectedLocation,
            timestamp: Date.now(),
          });

          initialDetectionDone = true;
        } else {
          // Change detection: Only update if location changed
          if (this.cachedPanelLocation !== detectedLocation) {
            const terminalsWrapper = document.getElementById('terminals-wrapper');
            if (terminalsWrapper) {
              // Toggle CSS class
              if (detectedLocation === 'sidebar') {
                terminalsWrapper.classList.add('terminal-side-view');
              } else {
                terminalsWrapper.classList.remove('terminal-side-view');
              }
            }

            // Update cached state
            this.cachedFlexDirection = detectedLocation === 'panel' ? 'row' : 'column';
            this.cachedPanelLocation = detectedLocation;

            // Report to Extension
            void this.messageQueue.enqueue({
              command: 'reportPanelLocation',
              location: detectedLocation,
              timestamp: Date.now(),
            });
          }
        }

        break;
      }
    });

    // Start observing
    if (document.body) {
      resizeObserver.observe(document.body);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        resizeObserver.observe(document.body);
      });
    }
  }

  /**
   * 🎯 PUBLIC API: Update flex-direction if panel location has changed
   * Uses VS Code's double-guard pattern to prevent redundant updates
   */
  public updateFlexDirectionIfNeeded(coordinator: IManagerCoordinator): boolean {
    const detectedLocation = this.detectPanelLocation();

    // First guard: Check if location changed
    if (this.cachedPanelLocation === detectedLocation) {
      return false;
    }

    const newFlexDirection = detectedLocation === 'panel' ? 'row' : 'column';

    // Second guard: Check if flex-direction changed
    if (this.cachedFlexDirection === newFlexDirection) {
      this.cachedPanelLocation = detectedLocation;
      return false;
    }

    // Apply the update
    this.applyFlexDirection(newFlexDirection, detectedLocation, coordinator);

    // Update cached state
    this.cachedFlexDirection = newFlexDirection;
    this.cachedPanelLocation = detectedLocation;

    return true;
  }

  /**
   * 🎯 PUBLIC API: Get current flex-direction
   */
  public getCurrentFlexDirection(): 'row' | 'column' | null {
    return this.cachedFlexDirection;
  }

  /**
   * 🎯 PUBLIC API: Get current panel location
   */
  public getCurrentPanelLocation(): 'sidebar' | 'panel' | null {
    return this.cachedPanelLocation;
  }

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
   * 🎯 Detect panel location based on aspect ratio
   */
  private detectPanelLocation(): 'sidebar' | 'panel' {
    try {
      let width = window.innerWidth;
      let height = window.innerHeight;

      // Fallback chain
      if (width === 0 || height === 0) {
        width = document.documentElement.clientWidth;
        height = document.documentElement.clientHeight;
      }

      if (width === 0 || height === 0) {
        width = document.body.clientWidth;
        height = document.body.clientHeight;
      }

      if (width === 0 || height === 0) {
        return 'sidebar';
      }

      const aspectRatio = width / height;
      return aspectRatio > PanelLocationHandler.PANEL_ASPECT_RATIO_THRESHOLD ? 'panel' : 'sidebar';
    } catch (error) {
      this.logger.error('Error detecting panel location', error);
      return 'sidebar';
    }
  }

  /**
   * 🎯 VS Code Pattern: Apply CSS class-based layout
   */
  private applyFlexDirection(
    newFlexDirection: 'row' | 'column',
    location: 'sidebar' | 'panel',
    coordinator: IManagerCoordinator
  ): void {
    // Update split manager
    const splitManager = (coordinator as { getSplitManager?: () => unknown }).getSplitManager?.();
    if (splitManager) {
      const newSplitDirection = newFlexDirection === 'row' ? 'horizontal' : 'vertical';

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
    }

    // Apply CSS class to terminals-wrapper
    const terminalsWrapper = document.getElementById('terminals-wrapper');
    if (terminalsWrapper) {
      // Toggle CSS class based on location
      if (location === 'sidebar') {
        terminalsWrapper.classList.add('terminal-side-view');
      } else {
        terminalsWrapper.classList.remove('terminal-side-view');
      }
    }
  }

  /**
   * Handle panel location update message (backward compatibility)
   */
  private handlePanelLocationUpdate(
    _msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): void {
    try {
      // Check if dynamic split direction is enabled
      const configManager = (
        coordinator as { getManagers?: () => { config?: unknown } }
      ).getManagers?.()?.config;
      let isDynamicSplitEnabled = true;

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
          // Use default
        }
      }

      if (!isDynamicSplitEnabled) {
        return;
      }

      // Only update if autonomous detection hasn't completed
      if (this.cachedPanelLocation === null || this.cachedFlexDirection === null) {
        this.updateFlexDirectionIfNeeded(coordinator);
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
      const detectedLocation = this.analyzeWebViewDimensions();

      void this.messageQueue.enqueue({
        command: 'reportPanelLocation',
        location: detectedLocation,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.error('Error in panel location detection', error);
      void this.messageQueue.enqueue({
        command: 'reportPanelLocation',
        location: 'sidebar',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Analyze WebView dimensions to determine panel location
   */
  private analyzeWebViewDimensions(): 'sidebar' | 'panel' {
    try {
      const container = document.body;
      if (!container) {
        return 'sidebar';
      }

      const width = container.clientWidth;
      const height = container.clientHeight;

      if (width === 0 || height === 0) {
        return 'sidebar';
      }

      const aspectRatio = width / height;
      return aspectRatio > PanelLocationHandler.PANEL_ASPECT_RATIO_THRESHOLD ? 'panel' : 'sidebar';
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
