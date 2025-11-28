/**
 * Scrollback Coordinator
 *
 * Handles scrollback data collection and session restoration
 * Extracted from SecondaryTerminalProvider for better separation of concerns
 */

import { provider as log } from '../../utils/logger';
import { WebviewMessage } from '../../types/common';

/**
 * Scrollback data response interface
 */
export interface ScrollbackDataResponse {
  command: string;
  terminalId?: string;
  scrollbackData?: string[];
  error?: string;
}

interface Disposable {
  dispose(): void;
}

/**
 * Scrollback Coordinator
 *
 * Responsibilities:
 * - Requesting scrollback data from WebView
 * - Handling scrollback data responses
 * - Managing scrollback collection state
 */
export class ScrollbackCoordinator implements Disposable {
  private _pendingScrollbackRequests = new Map<
    string,
    {
      resolve: (data: string[]) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
      terminalId: string;
    }
  >();

  constructor(private readonly _sendMessage: (message: WebviewMessage) => Promise<void>) {}

  /**
   * Request scrollback data for a specific terminal
   */
  public async requestScrollbackData(
    terminalId: string,
    maxLines: number = 1000
  ): Promise<string[]> {
    const requestId = `scrollback-${terminalId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    log(
      `📋 [SCROLLBACK-COORDINATOR] Requesting scrollback data for terminal ${terminalId} (requestId: ${requestId})`
    );

    return new Promise<string[]>((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        log(`⏰ [SCROLLBACK-COORDINATOR] Timeout for terminal ${terminalId} scrollback request`);
        this._pendingScrollbackRequests.delete(requestId);
        resolve([]); // Return empty array on timeout
      }, 10000); // 10 second timeout

      // Store pending request
      this._pendingScrollbackRequests.set(requestId, {
        resolve,
        reject,
        timeout,
        terminalId,
      });

      // Send request to WebView
      void this._sendMessage({
        command: 'extractScrollbackData',
        terminalId,
        requestId,
        maxLines,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Request scrollback data for multiple terminals
   */
  public async requestMultipleScrollbackData(
    terminalIds: string[],
    maxLines: number = 1000
  ): Promise<Record<string, string[]>> {
    log(
      `📋 [SCROLLBACK-COORDINATOR] Requesting scrollback data for ${terminalIds.length} terminals`
    );

    const scrollbackDataMap: Record<string, string[]> = {};

    // Request scrollback data for all terminals in parallel
    await Promise.all(
      terminalIds.map(async (terminalId) => {
        try {
          const scrollbackData = await this.requestScrollbackData(terminalId, maxLines);
          if (scrollbackData && scrollbackData.length > 0) {
            scrollbackDataMap[terminalId] = scrollbackData;
            log(
              `✅ [SCROLLBACK-COORDINATOR] Collected ${scrollbackData.length} lines for terminal ${terminalId}`
            );
          }
        } catch (error) {
          log(
            `❌ [SCROLLBACK-COORDINATOR] Failed to collect scrollback for terminal ${terminalId}:`,
            error
          );
        }
      })
    );

    log(
      `📋 [SCROLLBACK-COORDINATOR] Collected scrollback data for ${Object.keys(scrollbackDataMap).length}/${terminalIds.length} terminals`
    );

    return scrollbackDataMap;
  }

  /**
   * Handle scrollback data response from WebView
   */
  public handleScrollbackDataResponse(message: ScrollbackDataResponse): void {
    const requestId = (message as any).requestId;
    if (!requestId) {
      log('⚠️ [SCROLLBACK-COORDINATOR] Scrollback response missing requestId');
      return;
    }

    const pendingRequest = this._pendingScrollbackRequests.get(requestId);
    if (!pendingRequest) {
      log(`⚠️ [SCROLLBACK-COORDINATOR] No pending request found for requestId: ${requestId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pendingRequest.timeout);
    this._pendingScrollbackRequests.delete(requestId);

    if (message.error) {
      log(
        `⚠️ [SCROLLBACK-COORDINATOR] Scrollback extraction error for terminal ${message.terminalId}: ${message.error}`
      );
      pendingRequest.resolve([]); // Resolve with empty array on error
    } else {
      log(
        `✅ [SCROLLBACK-COORDINATOR] Scrollback data received for terminal ${message.terminalId}: ${message.scrollbackData?.length || 0} lines`
      );
      pendingRequest.resolve(message.scrollbackData || []);
    }
  }

  /**
   * Get pending requests count (for debugging)
   */
  public getPendingRequestsCount(): number {
    return this._pendingScrollbackRequests.size;
  }

  /**
   * Clear all pending requests
   */
  public clearPendingRequests(): void {
    this._pendingScrollbackRequests.forEach((request) => {
      clearTimeout(request.timeout);
      request.resolve([]); // Resolve with empty array
    });
    this._pendingScrollbackRequests.clear();
    log('🧹 [SCROLLBACK-COORDINATOR] Cleared all pending scrollback requests');
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.clearPendingRequests();
    log('🧹 [SCROLLBACK-COORDINATOR] Disposed');
  }
}
