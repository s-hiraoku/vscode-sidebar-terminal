import * as vscode from 'vscode';
import { WebviewMessage } from '../types/common';
import { provider as log } from '../utils/logger';

/**
 * CLI Agent WebView Service
 * 
 * Extracted from SecondaryTerminalProvider to handle:
 * - CLI Agent status synchronization between Extension and WebView
 * - Full state sync for connected/disconnected agents
 * - CLI Agent event listeners and status updates
 * - Agent type management (Claude, Gemini, etc.)
 */

export interface ICliAgentWebViewService {
  setupCliAgentStatusListeners(): void;
  sendCliAgentStatusUpdate(activeTerminalName: string | null, status: 'connected' | 'disconnected' | 'none', agentType?: string | null): void;
  sendFullCliAgentStateSync(): void;
  handleCliAgentStatusChange(event: any): void;
  dispose(): void;
}

export interface CliAgentState {
  status: 'connected' | 'disconnected' | 'none';
  agentType: string | null;
  terminalName: string;
}

export class CliAgentWebViewService implements ICliAgentWebViewService {
  private statusListenerDisposables: vscode.Disposable[] = [];

  constructor(
    private terminalManager: any, // TODO: Replace with proper interface
    private sendMessage: (message: WebviewMessage) => Promise<void>,
    private extensionContext: vscode.ExtensionContext
  ) {}

  public setupCliAgentStatusListeners(): void {
    console.log('🎯 [CLI-AGENT-SERVICE] Setting up CLI Agent status listeners');
    
    try {
      // CLI Agent state change monitoring - Full State Sync approach
      const claudeStatusDisposable = this.terminalManager.onCliAgentStatusChange((event: any) => {
        this.handleCliAgentStatusChange(event);
      });

      // Store disposable for cleanup
      this.statusListenerDisposables.push(claudeStatusDisposable);
      this.extensionContext.subscriptions.push(claudeStatusDisposable);
      
      console.log('✅ [CLI-AGENT-SERVICE] CLI Agent status listeners setup complete');
    } catch (error) {
      log('❌ [CLI-AGENT-SERVICE] Failed to setup CLI Agent status listeners:', error);
    }
  }

  public handleCliAgentStatusChange(event: any): void {
    try {
      console.log('📡 [CLI-AGENT-SERVICE] Received CLI Agent status change:', event);

      // Full State Sync: Complete synchronization of all terminal states
      console.log('🔄 [CLI-AGENT-SERVICE] Triggering full CLI Agent state sync');
      this.sendFullCliAgentStateSync();
    } catch (error) {
      log('❌ [CLI-AGENT-SERVICE] CLI Agent status change processing failed:', error);
      // Continue processing despite errors
    }
  }

  public sendCliAgentStatusUpdate(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null = null
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

      console.log('📤 [CLI-AGENT-SERVICE] Sending CLI Agent status update:', message);
      void this.sendMessage(message);
    } catch (error) {
      log('❌ [CLI-AGENT-SERVICE] Failed to send CLI Agent status update:', error);
      // Continue processing despite errors
    }
  }

  public sendFullCliAgentStateSync(): void {
    console.log('🚀 [CLI-AGENT-SERVICE] sendFullCliAgentStateSync() called');
    
    try {
      const stateData = this.buildCompleteCliAgentState();
      
      console.log('🔍 [CLI-AGENT-SERVICE] Current CLI Agent state:', {
        connected: { id: stateData.connectedAgentId, type: stateData.connectedAgentType },
        disconnected: Array.from(stateData.disconnectedAgents.entries()),
      });

      const terminalStates = this.buildTerminalStatesMap(stateData);

      // Send complete state to WebView
      const message: WebviewMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: terminalStates,
      };

      console.log('📤 [CLI-AGENT-SERVICE] Sending full CLI Agent state sync:', message);
      
      void this.sendMessage(message)
        .then(() => {
          console.log('✅ [CLI-AGENT-SERVICE] Full CLI Agent state sync sent successfully');
        })
        .catch((error) => {
          log('❌ [CLI-AGENT-SERVICE] Failed to send full CLI Agent state sync:', error);
        });
    } catch (error) {
      log('❌ [CLI-AGENT-SERVICE] Failed to build CLI Agent state sync:', error);
    }
  }

  private buildCompleteCliAgentState() {
    const connectedAgentId = this.terminalManager.getConnectedAgentTerminalId();
    const connectedAgentType = this.terminalManager.getConnectedAgentType();
    const disconnectedAgents = this.terminalManager.getDisconnectedAgents();

    return {
      connectedAgentId,
      connectedAgentType,
      disconnectedAgents,
    };
  }

  private buildTerminalStatesMap(stateData: {
    connectedAgentId: string | null;
    connectedAgentType: string | null;
    disconnectedAgents: Map<string, { type: string }>;
  }): Record<string, CliAgentState> {
    const terminalStates: Record<string, CliAgentState> = {};

    // Get all terminals
    const allTerminals = this.terminalManager.getTerminals();

    // Set status for all terminals
    for (const terminal of allTerminals) {
      const terminalId = terminal.id;

      if (stateData.connectedAgentId === terminalId && stateData.connectedAgentType) {
        // Connected agent
        terminalStates[terminalId] = {
          status: 'connected',
          agentType: stateData.connectedAgentType,
          terminalName: terminal.name || `Terminal ${terminalId}`,
        };
      } else if (stateData.disconnectedAgents.has(terminalId)) {
        // Disconnected agent
        const agentInfo = stateData.disconnectedAgents.get(terminalId);
        if (agentInfo) {
          terminalStates[terminalId] = {
            status: 'disconnected',
            agentType: agentInfo.type,
            terminalName: terminal.name || `Terminal ${terminalId}`,
          };
        }
      } else {
        // No agent or terminated agent
        terminalStates[terminalId] = {
          status: 'none',
          agentType: null,
          terminalName: terminal.name || `Terminal ${terminalId}`,
        };
      }
    }

    return terminalStates;
  }

  /**
   * Handle CLI Agent connection switch request
   */
  public async handleCliAgentSwitch(terminalId: string, action: string): Promise<{
    success: boolean;
    newStatus?: string;
    agentType?: string;
    reason?: string;
  }> {
    log(`📎 [CLI-AGENT-SERVICE] Switching AI Agent for terminal: ${terminalId} (action: ${action})`);

    try {
      // Call TerminalManager's switchAiAgentConnection method
      const result = this.terminalManager.switchAiAgentConnection(terminalId);
      
      if (result.success) {
        log(`✅ [CLI-AGENT-SERVICE] AI Agent switch succeeded: ${terminalId}, new status: ${result.newStatus}`);
        
        // Trigger full state sync to ensure WebView is updated
        this.sendFullCliAgentStateSync();
        
        return {
          success: true,
          newStatus: result.newStatus,
          agentType: result.agentType
        };
      } else {
        log(`⚠️ [CLI-AGENT-SERVICE] AI Agent switch failed: ${terminalId}, reason: ${result.reason}`);
        
        return {
          success: false,
          newStatus: result.newStatus,
          reason: result.reason
        };
      }
    } catch (error) {
      log('❌ [CLI-AGENT-SERVICE] Error switching AI Agent:', error);
      
      return {
        success: false,
        reason: 'Internal error occurred'
      };
    }
  }

  /**
   * Get current CLI Agent state for a specific terminal
   */
  public getCliAgentStateForTerminal(terminalId: string): CliAgentState {
    const stateData = this.buildCompleteCliAgentState();
    const terminal = this.terminalManager.getTerminal(terminalId);
    const terminalName = terminal?.name || `Terminal ${terminalId}`;
    
    if (stateData.connectedAgentId === terminalId && stateData.connectedAgentType) {
      return {
        status: 'connected',
        agentType: stateData.connectedAgentType,
        terminalName,
      };
    } else if (stateData.disconnectedAgents.has(terminalId)) {
      const agentInfo = stateData.disconnectedAgents.get(terminalId);
      return {
        status: 'disconnected',
        agentType: agentInfo?.type || null,
        terminalName,
      };
    } else {
      return {
        status: 'none',
        agentType: null,
        terminalName,
      };
    }
  }

  /**
   * Get all CLI Agent states for all terminals
   */
  public getAllCliAgentStates(): Record<string, CliAgentState> {
    const stateData = this.buildCompleteCliAgentState();
    return this.buildTerminalStatesMap(stateData);
  }

  /**
   * Check if any CLI Agent is currently connected
   */
  public hasConnectedAgent(): boolean {
    const stateData = this.buildCompleteCliAgentState();
    return stateData.connectedAgentId !== null && stateData.connectedAgentType !== null;
  }

  /**
   * Get the currently connected CLI Agent information
   */
  public getConnectedAgentInfo(): { terminalId: string; agentType: string } | null {
    const stateData = this.buildCompleteCliAgentState();
    
    if (stateData.connectedAgentId && stateData.connectedAgentType) {
      return {
        terminalId: stateData.connectedAgentId,
        agentType: stateData.connectedAgentType,
      };
    }
    
    return null;
  }

  /**
   * Force a complete refresh of CLI Agent states
   */
  public refreshAllCliAgentStates(): void {
    log('🔄 [CLI-AGENT-SERVICE] Forcing complete CLI Agent state refresh');
    this.sendFullCliAgentStateSync();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    log('🔧 [CLI-AGENT-SERVICE] Disposing CLI Agent WebView service...');
    
    // Dispose all status listener disposables
    for (const disposable of this.statusListenerDisposables) {
      disposable.dispose();
    }
    this.statusListenerDisposables.length = 0;
    
    log('✅ [CLI-AGENT-SERVICE] CLI Agent WebView service disposed');
  }
}