/**
 * Split Handler
 *
 * Handles terminal split operations
 */

import { IMessageHandler } from './IMessageHandler';
import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { ManagerLogger } from '../../utils/ManagerLogger';

/**
 * Split Handler
 *
 * Responsibilities:
 * - Handle split terminal commands
 * - Coordinate with SplitManager for terminal splitting
 */
export class SplitHandler implements IMessageHandler {
  constructor(private readonly logger: ManagerLogger) {}

  /**
   * Handle split related messages
   */
  public handleMessage(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const command = (msg as { command?: string }).command;

    if (command === 'split') {
      this.handleSplit(msg, coordinator);
    } else if (command === 'setDisplayMode') {
      this.handleSetDisplayMode(msg, coordinator);
    } else if (command === 'relayoutTerminals') {
      this.handleRelayoutTerminals(msg, coordinator);
    } else {
      this.logger.warn(`Unknown split command: ${command}`);
    }
  }

  /**
   * Get supported command types
   */
  public getSupportedCommands(): string[] {
    return ['split', 'setDisplayMode', 'relayoutTerminals'];
  }

  /**
   * Handle split command from Extension
   * This sets the split direction before terminal creation
   */
  private handleSplit(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    try {
      const direction = (msg as { direction?: string }).direction as
        | 'horizontal'
        | 'vertical'
        | undefined;
      this.logger.info(`🔀 [WEBVIEW] ==================== SPLIT COMMAND ====================`);
      this.logger.info(
        `🔀 [WEBVIEW] Received split command with direction: ${direction || 'auto'}`
      );

      // Get split manager from coordinator
      const splitManager = (coordinator as { getSplitManager?: () => unknown }).getSplitManager?.();
      if (!splitManager) {
        this.logger.warn('⚠️ [WEBVIEW] SplitManager not available on coordinator');
        return;
      }

      // Call splitTerminal with the direction
      if (direction) {
        this.logger.info(`🔀 [WEBVIEW] Calling splitTerminal with direction: ${direction}`);
        (
          splitManager as { splitTerminal: (direction: 'horizontal' | 'vertical') => void }
        ).splitTerminal(direction);
      } else {
        this.logger.info(`🔀 [WEBVIEW] Calling splitTerminal with default direction`);
        (
          splitManager as { splitTerminal: (direction: 'horizontal' | 'vertical') => void }
        ).splitTerminal('vertical'); // Default
      }

      this.logger.info(`🔀 [WEBVIEW] ===========================================================`);
    } catch (error) {
      this.logger.error('Error handling split message', error);
    }
  }

  /**
   * Handle display mode change request from Extension
   */
  private handleSetDisplayMode(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    const mode = (msg as { mode?: 'normal' | 'fullscreen' | 'split' }).mode;
    const forceNextCreate = (msg as { forceNextCreate?: boolean }).forceNextCreate === true;
    if (!mode) {
      this.logger.warn('⚠️ [WEBVIEW] setDisplayMode missing mode');
      return;
    }

    const displayModeManager = coordinator.getDisplayModeManager?.();
    if (!displayModeManager) {
      this.logger.warn('⚠️ [WEBVIEW] DisplayModeManager not available on coordinator');
      return;
    }

    if (forceNextCreate) {
      if (mode === 'normal' && 'setForceNormalModeForNextCreate' in coordinator) {
        try {
          (
            coordinator as unknown as {
              setForceNormalModeForNextCreate: (enabled: boolean) => void;
            }
          ).setForceNormalModeForNextCreate(true);
        } catch (error) {
          this.logger.warn('⚠️ [WEBVIEW] Failed to set force normal mode flag', error);
        }
      } else if (mode === 'fullscreen' && 'setForceFullscreenModeForNextCreate' in coordinator) {
        try {
          (
            coordinator as unknown as {
              setForceFullscreenModeForNextCreate: (enabled: boolean) => void;
            }
          ).setForceFullscreenModeForNextCreate(true);
        } catch (error) {
          this.logger.warn('⚠️ [WEBVIEW] Failed to set force fullscreen mode flag', error);
        }
      }
    }

    this.logger.info(`🧭 [WEBVIEW] Setting display mode: ${mode}`);
    displayModeManager.setDisplayMode(mode);
  }

  /**
   * Handle relayout terminals command from Extension
   * This re-applies the layout to existing terminals with a new split direction
   */
  private handleRelayoutTerminals(msg: MessageCommand, coordinator: IManagerCoordinator): void {
    try {
      const direction = (msg as { direction?: string }).direction as
        | 'horizontal'
        | 'vertical'
        | undefined;
      this.logger.info(`🔄 [WEBVIEW] ==================== RELAYOUT COMMAND ====================`);
      this.logger.info(
        `🔄 [WEBVIEW] Received relayout command with direction: ${direction || 'auto'}`
      );

      // Get split manager from coordinator
      const splitManager = (coordinator as { getSplitManager?: () => unknown }).getSplitManager?.();
      if (!splitManager) {
        this.logger.warn('⚠️ [WEBVIEW] SplitManager not available on coordinator');
        return;
      }

      // Check if we have 2+ terminals
      const terminals = (splitManager as { terminals?: Map<string, unknown> }).terminals;
      const terminalCount = terminals?.size || 0;
      this.logger.info(`🔄 [WEBVIEW] Current terminal count: ${terminalCount}`);

      if (terminalCount < 2) {
        this.logger.info(`🔄 [WEBVIEW] No relayout needed (less than 2 terminals)`);
        return;
      }

      // Update split direction
      const newDirection = direction || 'vertical';
      this.logger.info(`🔄 [WEBVIEW] Updating split direction to: ${newDirection}`);
      (splitManager as { splitDirection: 'horizontal' | 'vertical' | null }).splitDirection =
        newDirection;

      // Get container manager and apply new layout
      const containerManager = coordinator.getTerminalContainerManager?.();
      if (!containerManager) {
        this.logger.warn('⚠️ [WEBVIEW] TerminalContainerManager not available on coordinator');
        return;
      }

      const orderedIds = (
        containerManager as { getContainerOrder: () => string[] }
      ).getContainerOrder();
      this.logger.info(`🔄 [WEBVIEW] Applying new layout to ${orderedIds.length} terminals`);

      (containerManager as { applyDisplayState: (state: unknown) => void }).applyDisplayState({
        mode: 'split',
        activeTerminalId: coordinator.getActiveTerminalId?.() ?? null,
        orderedTerminalIds: orderedIds,
        splitDirection: newDirection,
      });

      this.logger.info(`🔄 [WEBVIEW] ✅ Relayout completed successfully`);
      this.logger.info(
        `🔄 [WEBVIEW] ===============================================================`
      );
    } catch (error) {
      this.logger.error('Error handling relayout terminals message', error);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // No resources to clean up
  }
}
