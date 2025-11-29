import { terminal as log } from '../../utils/logger';
import { ICliAgentDetectionService } from '../../interfaces/CliAgentService';
import { CliAgentDetectionService } from '../../services/CliAgentDetectionService';

/**
 * Service responsible for CLI Agent integration with terminals
 *
 * This service extracts CLI Agent functionality from TerminalManager to improve:
 * - Single Responsibility: Focus only on CLI Agent integration
 * - Testability: Isolated CLI Agent logic
 * - Maintainability: Clear separation of CLI Agent concerns
 * - Reusability: Can be used by other terminal-related components
 */
export class TerminalCliAgentIntegrationService {
  private readonly _cliAgentService: ICliAgentDetectionService;

  constructor(cliAgentService?: ICliAgentDetectionService) {
    this._cliAgentService = cliAgentService || new CliAgentDetectionService();

    log('🤖 [CliAgentIntegration] CLI Agent integration service initialized');
  }

  /**
   * Start CLI Agent detection heartbeat
   */
  startHeartbeat(): void {
    this._cliAgentService.startHeartbeat();
    log('💓 [CliAgentIntegration] CLI Agent heartbeat started');
  }

  /**
   * Get CLI Agent status change event emitter
   */
  get onCliAgentStatusChange() {
    return this._cliAgentService.onCliAgentStatusChange;
  }

  /**
   * Check if CLI Agent is connected in a terminal
   */
  isCliAgentConnected(terminalId: string): boolean {
    try {
      const agentState = this._cliAgentService.getAgentState(terminalId);
      return agentState.status === 'connected';
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error checking CLI Agent connection:`, error);
      return false;
    }
  }

  /**
   * Check if CLI Agent is running in a terminal (CONNECTED or DISCONNECTED)
   */
  isCliAgentRunning(terminalId: string): boolean {
    try {
      const agentState = this._cliAgentService.getAgentState(terminalId);
      return agentState.status !== 'none';
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error checking CLI Agent running status:`, error);
      return false;
    }
  }

  /**
   * Get currently globally active CLI Agent
   */
  getCurrentGloballyActiveAgent(): { terminalId: string; type: string } | null {
    try {
      return this._cliAgentService.getConnectedAgent();
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error getting current global agent:`, error);
      return null;
    }
  }

  /**
   * Refresh CLI Agent state (fallback for file reference issues)
   */
  refreshCliAgentState(): boolean {
    try {
      const result = this._cliAgentService.refreshAgentState();
      log(`🔄 [CliAgentIntegration] CLI Agent state refreshed: ${result}`);
      return result;
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error refreshing CLI Agent state:`, error);
      return false;
    }
  }

  /**
   * Handle terminal output for CLI Agent detection
   */
  handleTerminalOutputForCliAgent(terminalId: string, data: string): void {
    try {
      this._cliAgentService.detectFromOutput(terminalId, data);
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error detecting CLI Agent from output:`, error);
    }
  }

  /**
   * Handle terminal input for CLI Agent detection
   */
  handleTerminalInputForCliAgent(terminalId: string, data: string): void {
    try {
      this._cliAgentService.detectFromInput(terminalId, data);
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error detecting CLI Agent from input:`, error);
    }
  }

  /**
   * Get the active CLI Agent type for a terminal
   */
  getAgentType(terminalId: string): string | null {
    try {
      const agentState = this._cliAgentService.getAgentState(terminalId);
      return agentState.agentType;
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error getting agent type:`, error);
      return null;
    }
  }

  /**
   * Get all connected CLI Agents
   */
  getConnectedAgents(): Array<{ terminalId: string; agentInfo: { type: string } }> {
    try {
      const connectedAgent = this._cliAgentService.getConnectedAgent();
      return connectedAgent
        ? [
            {
              terminalId: connectedAgent.terminalId,
              agentInfo: { type: connectedAgent.type },
            },
          ]
        : [];
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error getting connected agents:`, error);
      return [];
    }
  }

  /**
   * Get the map of disconnected agents for full state sync
   */
  getDisconnectedAgents(): Map<
    string,
    { type: 'claude' | 'gemini' | 'codex'; startTime: Date; terminalName?: string }
  > {
    try {
      const allDisconnectedAgents = this._cliAgentService.getDisconnectedAgents();
      const filteredAgents = new Map<
        string,
        { type: 'claude' | 'gemini' | 'codex'; startTime: Date; terminalName?: string }
      >();

      // Include all supported agent types: Claude, Gemini, and Codex
      for (const [terminalId, agentInfo] of allDisconnectedAgents) {
        if (
          agentInfo.type === 'claude' ||
          agentInfo.type === 'gemini' ||
          agentInfo.type === 'codex'
        ) {
          filteredAgents.set(terminalId, {
            type: agentInfo.type as 'claude' | 'gemini' | 'codex',
            startTime: agentInfo.startTime,
            terminalName: agentInfo.terminalName,
          });
        }
      }

      return filteredAgents;
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error getting disconnected agents:`, error);
      return new Map();
    }
  }

  /**
   * Get the connected agent terminal ID
   */
  getConnectedAgentTerminalId(): string | null {
    try {
      const connectedAgent = this._cliAgentService.getConnectedAgent();
      return connectedAgent ? connectedAgent.terminalId : null;
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error getting connected agent terminal ID:`, error);
      return null;
    }
  }

  /**
   * Get the connected agent type
   */
  getConnectedAgentType(): 'claude' | 'gemini' | 'codex' | null {
    try {
      const connectedAgent = this._cliAgentService.getConnectedAgent();
      return connectedAgent ? (connectedAgent.type as 'claude' | 'gemini' | 'codex') : null;
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error getting connected agent type:`, error);
      return null;
    }
  }

  /**
   * Handle terminal removal for CLI Agent cleanup
   */
  handleTerminalRemoved(terminalId: string): void {
    try {
      this._cliAgentService.handleTerminalRemoved(terminalId);
      log(`🧹 [CliAgentIntegration] CLI Agent state cleaned up for terminal: ${terminalId}`);
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error handling terminal removal for CLI Agent:`, error);
    }
  }

  /**
   * Switch AI Agent connection manually
   * Issue #122: AI Agent connection toggle button functionality
   */
  switchAiAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    try {
      const result = this._cliAgentService.switchAgentConnection(terminalId);
      log(
        `🔄 [CliAgentIntegration] AI Agent connection switched for terminal ${terminalId}:`,
        result
      );
      return result;
    } catch (error) {
      log(`❌ [CliAgentIntegration] Error switching AI Agent connection:`, error);
      return {
        success: false,
        reason: `Switch failed: ${String(error)}`,
        newStatus: 'none',
        agentType: null,
      };
    }
  }

  /**
   * Dispose of all CLI Agent resources
   */
  dispose(): void {
    try {
      this._cliAgentService.dispose();
      log('🧹 [CliAgentIntegration] CLI Agent integration service disposed');
    } catch (error) {
      log('❌ [CliAgentIntegration] Error disposing CLI Agent integration service:', error);
    }
  }
}
