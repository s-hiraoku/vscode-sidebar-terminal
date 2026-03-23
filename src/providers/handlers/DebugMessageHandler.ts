/**
 * DebugMessageHandler
 *
 * Debug-related message handling extracted from SecondaryTerminalProvider.
 * Handles debugTest, htmlScriptTest, and timeoutTest messages.
 */

import { WebviewMessage } from '../../types/common';
import { provider as log } from '../../utils/logger';

/**
 * Dependencies required by DebugMessageHandler
 */
export interface IDebugMessageHandlerDependencies {
  isDebugEnabled?(): boolean;
}

export class DebugMessageHandler {
  constructor(private readonly deps: IDebugMessageHandlerDependencies = {}) {}

  /**
   * Handle HTML inline script test messages
   */
  public handleHtmlScriptTest(message: WebviewMessage): void {
    log('🔥 [DEBUG] ========== HTML INLINE SCRIPT TEST MESSAGE RECEIVED ==========');
    log('🔥 [DEBUG] HTML script communication is working!');
    log('🔥 [DEBUG] Message content:', message);
  }

  /**
   * Handle timeout test messages
   */
  public handleTimeoutTest(message: WebviewMessage): void {
    log('🔥 [DEBUG] ========== HTML TIMEOUT TEST MESSAGE RECEIVED ==========');
    log('🔥 [DEBUG] Timeout test communication is working!');
    log('🔥 [DEBUG] Message content:', message);
  }

  /**
   * Handle debug test messages
   */
  public handleDebugTest(message: WebviewMessage): void {
    if ((message as WebviewMessage & { type?: string }).type === 'initComplete') {
      log('🎆 [TRACE] ===============================');
      log('🎆 [TRACE] WEBVIEW CONFIRMS INIT COMPLETE!');
      try {
        if (this.deps.isDebugEnabled && this.deps.isDebugEnabled()) {
          log('🎆 [TRACE] Message data:', message);
        }
      } catch {
        // Silently ignore logger loading errors - debug logging is non-critical
      }
    }
  }
}
