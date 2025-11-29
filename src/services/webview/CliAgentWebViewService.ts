import * as vscode from 'vscode';
import { ICliAgentWebViewService, IMessageHandlerContext } from './interfaces';
import { provider as log } from '../../utils/logger';

/**
 * Manages CLI Agent functionality in WebView context
 *
 * This service extracts all CLI Agent related logic from SecondaryTerminalProvider
 * including status synchronization and event handling.
 */
export class CliAgentWebViewService implements ICliAgentWebViewService {
  private _statusListeners: vscode.Disposable[] = [];

  constructor() {
    log('🤖 [CliAgent] CLI Agent WebView service initialized');
  }

  /**
   * Send CLI Agent status update to WebView
   */
  sendStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null,
    context: IMessageHandlerContext
  ): void {
    try {
      const message = {
        command: 'cliAgentStatusUpdate' as const,
        cliAgentStatus: {
          activeTerminalName,
          status,
          agentType,
        },
      };

      log(
        `🤖 [CliAgent] Sending status update: ${status} (${agentType}) for terminal: ${activeTerminalName}`
      );

      context.sendMessage(message).catch((error) => {
        log('❌ [CliAgent] Failed to send status update:', error);
      });
    } catch (error) {
      log('❌ [CliAgent] Error creating status update message:', error);
    }
  }

  /**
   * Send full CLI Agent state synchronization to WebView
   *
   * This resolves the DISCONNECTED terminals state retention problem
   * by sending complete state information for all terminals.
   */
  sendFullStateSync(context: IMessageHandlerContext): void {
    log('🚀 [CliAgent] Starting full state synchronization');

    try {
      const connectedAgentId = context.terminalManager.getConnectedAgentTerminalId();
      const connectedAgentType = context.terminalManager.getConnectedAgentType();
      const disconnectedAgents = context.terminalManager.getDisconnectedAgents();

      log('🔍 [CliAgent] Current state:', {
        connected: { id: connectedAgentId, type: connectedAgentType },
        disconnected: Array.from(disconnectedAgents.entries()),
      });

      // Build complete terminal states map
      const terminalStates: {
        [terminalId: string]: {
          status: 'connected' | 'disconnected' | 'none';
          agentType: string | null;
          terminalName: string;
        };
      } = {};

      // Get all terminals
      const allTerminals = context.terminalManager.getTerminals();

      // Set status for all terminals
      for (const terminal of allTerminals) {
        const terminalId = terminal.id;

        if (connectedAgentId === terminalId && connectedAgentType) {
          // Connected agent
          terminalStates[terminalId] = {
            status: 'connected',
            agentType: connectedAgentType,
            terminalName: terminal.name || `Terminal ${terminal.number || terminalId}`,
          };
        } else if (disconnectedAgents.has(terminalId)) {
          // Disconnected agent
          const agentInfo = disconnectedAgents.get(terminalId);
          if (agentInfo) {
            terminalStates[terminalId] = {
              status: 'disconnected',
              agentType: agentInfo.type,
              terminalName: terminal.name || `Terminal ${terminal.number || terminalId}`,
            };
          }
        } else {
          // No agent or terminated agent
          terminalStates[terminalId] = {
            status: 'none',
            agentType: null,
            terminalName: terminal.name || `Terminal ${terminal.number || terminalId}`,
          };
        }
      }

      // Send complete state to WebView
      const message = {
        command: 'cliAgentFullStateSync' as const,
        terminalStates: terminalStates,
      };

      log('📤 [CliAgent] Sending full state sync:', message);

      context
        .sendMessage(message)
        .then(() => {
          log('✅ [CliAgent] Full state sync sent successfully');
        })
        .catch((error) => {
          log('❌ [CliAgent] Failed to send full state sync:', error);
        });
    } catch (error) {
      log('❌ [CliAgent] Error during full state sync:', error);
    }
  }

  /**
   * Set up CLI Agent status change listeners
   */
  setupListeners(context: IMessageHandlerContext): vscode.Disposable[] {
    log('🎯 [CliAgent] Setting up status change listeners');

    try {
      // Clear existing listeners to prevent duplicates
      this.clearListeners();

      // CLI Agent status change listener - Full State Sync approach
      const statusDisposable = context.terminalManager.onCliAgentStatusChange((event) => {
        try {
          log('📡 [CliAgent] Status change received:', event);

          // Full State Sync: synchronize all terminal states completely
          log('🔄 [CliAgent] Triggering full state synchronization');
          this.sendFullStateSync(context);
        } catch (error) {
          log('❌ [CliAgent] Status change processing failed:', error);
          // Continue execution despite error
        }
      });

      this._statusListeners.push(statusDisposable);

      // Add to extension context subscriptions for cleanup
      context.extensionContext.subscriptions.push(statusDisposable);

      log('✅ [CliAgent] Status listeners setup complete');
      return this._statusListeners;
    } catch (error) {
      log('❌ [CliAgent] Error setting up listeners:', error);
      return [];
    }
  }

  /**
   * Clear all CLI Agent listeners
   */
  clearListeners(): void {
    try {
      for (const disposable of this._statusListeners) {
        disposable.dispose();
      }
      this._statusListeners = [];
      log('🧹 [CliAgent] All listeners cleared');
    } catch (error) {
      log('❌ [CliAgent] Error clearing listeners:', error);
    }
  }

  /**
   * Handle CLI Agent switch command from WebView
   */
  async handleSwitchAiAgent(
    terminalId: string,
    action: string,
    context: IMessageHandlerContext
  ): Promise<void> {
    log(`🔌 [CliAgent] Processing AI Agent switch: ${terminalId} (action: ${action})`);

    try {
      // Call TerminalManager's switchAiAgentConnection method
      const result = context.terminalManager.switchAiAgentConnection(terminalId);

      if (result.success) {
        log(`✅ [CliAgent] Switch succeeded: ${terminalId}, new status: ${result.newStatus}`);

        // Send success response to WebView
        await context.sendMessage({
          command: 'switchAiAgentResponse',
          terminalId,
          success: true,
          newStatus: result.newStatus,
          agentType: result.agentType,
        });
      } else {
        log(`⚠️ [CliAgent] Switch failed: ${terminalId}, reason: ${result.reason}`);

        // Send failure response to WebView
        await context.sendMessage({
          command: 'switchAiAgentResponse',
          terminalId,
          success: false,
          reason: result.reason,
          newStatus: result.newStatus,
        });
      }
    } catch (error) {
      log('❌ [CliAgent] Error switching AI Agent:', error);

      // Send error response to WebView
      await context.sendMessage({
        command: 'switchAiAgentResponse',
        terminalId,
        success: false,
        reason: 'Internal error occurred',
      });
    }
  }

  /**
   * Get debug information about current CLI Agent state
   */
  getDebugInfo(context: IMessageHandlerContext): object {
    try {
      return {
        connectedAgent: {
          id: context.terminalManager.getConnectedAgentTerminalId(),
          type: context.terminalManager.getConnectedAgentType(),
        },
        disconnectedAgents: Array.from(context.terminalManager.getDisconnectedAgents().entries()),
        activeListeners: this._statusListeners.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      log('❌ [CliAgent] Error getting debug info:', error);
      return {
        error: String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    log('🧹 [CliAgent] Disposing CLI Agent service');
    this.clearListeners();
  }
}
