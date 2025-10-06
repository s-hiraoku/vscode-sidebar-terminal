import { BaseMessageHandler } from '../../../messaging/handlers/BaseMessageHandler';
import { IMessageHandlerContext } from '../interfaces';
import { WebviewMessage } from '../../../types/common';
import { provider as log } from '../../../utils/logger';
import { TERMINAL_CONSTANTS } from '../../../constants';

/**
 * Handles WebView ready messages and initialization
 */
export class WebViewReadyHandler extends BaseMessageHandler {
  protected readonly supportedCommands = [
    'webviewReady',
    TERMINAL_CONSTANTS?.COMMANDS?.READY || 'ready',
  ];

  async handle(message: WebviewMessage, context: IMessageHandlerContext): Promise<void> {
    this.logMessageHandling(message, 'WebViewReady');

    try {
      // Check if already initialized to prevent duplicate initialization
      const stateManager = (context as any).stateManager;
      if (stateManager?.isInitialized()) {
        log('🔄 [WebViewReady] Already initialized, skipping duplicate initialization');
        return;
      }

      log('🎯 [WebViewReady] Initializing WebView immediately');

      if (stateManager) {
        stateManager.setInitialized(true);
      }

      // Initialize terminal
      await this.initializeTerminal(context);
      log('✅ [WebViewReady] Terminal initialization completed');

      // Ensure minimum terminal creation after short delay
      setTimeout(() => {
        this.ensureMinimumTerminals(context);
      }, 100);
    } catch (error) {
      await this.handleError(error, message, 'WebViewReady');
    }
  }

  /**
   * Initialize terminal system
   */
  private async initializeTerminal(context: IMessageHandlerContext): Promise<void> {
    try {
      // This will be handled by WebViewStateManager in the future
      // For now, we'll call the provider's method directly
      const provider = (context as any).provider;
      if (provider && provider._initializeTerminal) {
        await provider._initializeTerminal();
      }
    } catch (error) {
      log('❌ [WebViewReady] Failed to initialize terminal:', error);
      throw error;
    }
  }

  /**
   * Ensure minimum number of terminals exist
   */
  private ensureMinimumTerminals(context: IMessageHandlerContext): void {
    try {
      if (context.terminalManager.getTerminals().length === 0) {
        log('🎯 [WebViewReady] No terminals exist - creating minimum set');
        const terminalId = context.terminalManager.createTerminal();
        context.terminalManager.setActiveTerminal(terminalId);
        log(`✅ [WebViewReady] Created minimum terminal: ${terminalId}`);
      }
    } catch (error) {
      log('❌ [WebViewReady] Failed to ensure minimum terminals:', error);
    }
  }
}
