/**
 * ScrollbackMessageHandler
 *
 * Scrollback-related message handling extracted from SecondaryTerminalProvider.
 * Handles pushScrollbackData, scrollbackDataCollected, and scrollbackRefreshRequest messages.
 */

import { WebviewMessage } from '../../types/common';
import { provider as log } from '../../utils/logger';

/**
 * Persistence service interface for scrollback operations
 */
export interface IScrollbackPersistenceService {
  handlePushedScrollbackData?(message: WebviewMessage): void;
  handleScrollbackDataCollected?(data: {
    terminalId: string;
    requestId?: string;
    scrollbackData: unknown[];
  }): void;
  handleScrollbackRefreshRequest?(message: WebviewMessage): Promise<void>;
}

/**
 * Dependencies required by ScrollbackMessageHandler
 */
export interface IScrollbackMessageHandlerDependencies {
  getExtensionPersistenceService(): IScrollbackPersistenceService | null;
}

export class ScrollbackMessageHandler {
  constructor(private readonly deps: IScrollbackMessageHandlerDependencies) {}

  /**
   * Handle pushScrollbackData messages from WebView
   */
  public async handlePushScrollbackData(message: WebviewMessage): Promise<void> {
    const persistenceService = this.deps.getExtensionPersistenceService();
    if (!persistenceService) {
      log('⚠️ [PROVIDER] Received pushScrollbackData but persistence service is unavailable');
      return;
    }

    const handler = persistenceService.handlePushedScrollbackData;
    if (typeof handler !== 'function') {
      log('⚠️ [PROVIDER] Persistence service does not support pushScrollbackData');
      return;
    }

    try {
      handler.call(persistenceService, message);
    } catch (error) {
      log('❌ [PROVIDER] Failed to process pushScrollbackData message:', error);
    }
  }

  /**
   * Handle scrollbackDataCollected messages from WebView
   */
  public async handleScrollbackDataCollected(message: WebviewMessage): Promise<void> {
    const scrollbackData =
      (message as any)?.scrollbackData ?? (message as any)?.scrollbackContent;
    const requestId = (message as any)?.requestId;
    const terminalId = (message as any)?.terminalId;

    if (!Array.isArray(scrollbackData)) {
      log('⚠️ [PROVIDER] scrollbackDataCollected missing scrollbackData array');
      return;
    }

    // Forward to persistence service for handling (supports both cache update and pending request resolution)
    const persistenceService = this.deps.getExtensionPersistenceService();
    if (persistenceService) {
      const handler = persistenceService.handleScrollbackDataCollected;
      if (typeof handler === 'function') {
        handler.call(persistenceService, { terminalId, requestId, scrollbackData });
        log(
          `✅ [PROVIDER] scrollbackDataCollected forwarded to persistence service (requestId=${requestId || 'none'})`
        );
        return;
      }
    }

    // Fallback: treat as pushScrollbackData for cache update
    (message as any).command = 'pushScrollbackData';
    await this.handlePushScrollbackData(message);
  }

  /**
   * Handle scrollback refresh request from WebView after sleep/wake
   */
  public async handleScrollbackRefreshRequest(message: WebviewMessage): Promise<void> {
    const persistenceService = this.deps.getExtensionPersistenceService();
    if (!persistenceService) {
      log(
        '⚠️ [PROVIDER] Received requestScrollbackRefresh but persistence service is unavailable'
      );
      return;
    }

    const handler = persistenceService.handleScrollbackRefreshRequest;
    if (typeof handler !== 'function') {
      log('⚠️ [PROVIDER] Persistence service does not support handleScrollbackRefreshRequest');
      return;
    }

    try {
      await handler.call(persistenceService, message);
      log('✅ [PROVIDER] Scrollback refresh request handled');
    } catch (error) {
      log('❌ [PROVIDER] Failed to process scrollback refresh request:', error);
    }
  }
}
