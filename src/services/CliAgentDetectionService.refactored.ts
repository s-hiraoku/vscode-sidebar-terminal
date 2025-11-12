/**
 * Refactored CLI Agent Detection Service
 *
 * This service now uses the centralized architecture components:
 * - CliAgentDetectionEngine for unified detection logic
 * - CliAgentStateStore for centralized state management
 * - CliAgentPatternRegistry for pattern definitions (via Engine)
 *
 * This eliminates ~400 lines of duplicate code and provides consistent
 * detection across all services.
 */

import { terminal as log } from '../utils/logger';
import {
  ICliAgentDetectionService,
  CliAgentDetectionResult,
  TerminationDetectionResult,
  CliAgentState,
  DisconnectedAgentInfo,
} from '../interfaces/CliAgentService';
import {
  CliAgentDetectionEngine,
  CliAgentStateStore,
  StateObserver,
  StateChangeEvent,
} from './cliAgent';
import { LRUCache } from '../utils/LRUCache';

/**
 * Cache entry for detection results
 */
interface DetectionCacheEntry {
  result: CliAgentDetectionResult | null;
  timestamp: number;
}

/**
 * Refactored CLI Agent Detection Service
 * Uses centralized components for detection and state management
 */
export class CliAgentDetectionServiceRefactored implements ICliAgentDetectionService, StateObserver {
  /**
   * Centralized detection engine
   */
  private readonly detectionEngine: CliAgentDetectionEngine;

  /**
   * Centralized state store
   */
  private readonly stateStore: CliAgentStateStore;

  /**
   * Detection result cache for performance optimization
   */
  private readonly detectionCache = new LRUCache<string, DetectionCacheEntry>(50);

  /**
   * Cache TTL in milliseconds
   */
  private readonly CACHE_TTL_MS = 5000;

  /**
   * Heartbeat interval ID
   */
  private heartbeatInterval?: ReturnType<typeof setInterval>;

  constructor() {
    // Get singleton instances of centralized components
    this.detectionEngine = CliAgentDetectionEngine.getInstance();
    this.stateStore = CliAgentStateStore.getInstance();

    // Register as observer for state changes
    this.stateStore.addObserver(this);

    log('🎯 [CLI-AGENT-SERVICE] Refactored service initialized with centralized components');
  }

  // =================== Detection Methods ===================

  detectFromInput(terminalId: string, input: string): CliAgentDetectionResult | null {
    try {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        return null;
      }

      // Check cache first
      const cacheKey = `input:${terminalId}:${trimmedInput}`;
      const cachedResult = this.detectionCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < this.CACHE_TTL_MS) {
        log(`🎯 [CLI-AGENT] Cache hit for input detection: "${trimmedInput}"`);
        return cachedResult.result;
      }

      // Detect using engine
      const detectionResult = this.detectionEngine.detectFromInput(trimmedInput);

      if (!detectionResult.isDetected) {
        this.detectionCache.set(cacheKey, { result: null, timestamp: Date.now() });
        return null;
      }

      // Convert engine result to service result
      const result: CliAgentDetectionResult = {
        type: detectionResult.agentType!,
        confidence: detectionResult.confidence,
        source: 'input',
        detectedLine: detectionResult.detectedLine,
      };

      // Update state
      this.stateStore.setConnectedAgent(terminalId, detectionResult.agentType!);

      // Cache result
      this.detectionCache.set(cacheKey, { result, timestamp: Date.now() });

      log(
        `🎯 [CLI-AGENT] ${detectionResult.agentType} detected from input: "${trimmedInput}" in terminal ${terminalId}`
      );

      return result;
    } catch (error) {
      log('ERROR: CLI Agent input detection failed:', error);
      return null;
    }
  }

  detectFromOutput(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      // Skip detection for already connected terminals to prevent state churn
      if (this.stateStore.isAgentConnected(terminalId)) {
        // But still check for termination
        const terminationResult = this.detectTermination(terminalId, data);
        if (terminationResult.isTerminated) {
          setTimeout(() => {
            this.stateStore.setAgentTerminated(terminalId);
            log(
              `🔻 [CLI-AGENT] Connected agent termination detected in terminal ${terminalId}`
            );
          }, 1000); // 1 second grace period
        }
        return null;
      }

      // Check for termination for disconnected agents
      const disconnectedAgents = this.stateStore.getDisconnectedAgents();
      if (disconnectedAgents.has(terminalId)) {
        const terminationResult = this.detectTermination(terminalId, data);
        if (terminationResult.isTerminated) {
          setTimeout(() => {
            this.stateStore.setAgentTerminated(terminalId);
            log(
              `🔻 [CLI-AGENT] Disconnected agent termination detected in terminal ${terminalId}`
            );
          }, 1500); // Slightly longer for disconnected agents
        }
        return null; // Skip startup detection for disconnected agents
      }

      // Detect using engine
      const detectionResult = this.detectionEngine.detectFromOutput(data);

      if (!detectionResult.isDetected) {
        return null;
      }

      // Convert engine result to service result
      const result: CliAgentDetectionResult = {
        type: detectionResult.agentType!,
        confidence: detectionResult.confidence,
        source: 'output',
        detectedLine: detectionResult.detectedLine,
      };

      // Update state
      this.stateStore.setConnectedAgent(terminalId, detectionResult.agentType!);

      log(
        `🚀 [CLI-AGENT] ${detectionResult.agentType} detected from output in terminal ${terminalId}`
      );

      return result;
    } catch (error) {
      log('ERROR: CLI Agent output detection failed:', error);
      return null;
    }
  }

  detectTermination(terminalId: string, data: string): TerminationDetectionResult {
    try {
      // Check if there is any agent to terminate
      const disconnectedAgents = this.stateStore.getDisconnectedAgents();
      const hasConnectedAgent = this.stateStore.isAgentConnected(terminalId);
      const hasDisconnectedAgent = disconnectedAgents.has(terminalId);

      if (!hasConnectedAgent && !hasDisconnectedAgent) {
        return {
          isTerminated: false,
          confidence: 0,
          detectedLine: '',
          reason: 'No agent exists to terminate',
        };
      }

      // Get agent type for better termination detection
      let agentType = null;
      if (hasConnectedAgent) {
        const connectedAgent = this.stateStore.getConnectedAgent();
        agentType = connectedAgent?.type || null;
      } else if (hasDisconnectedAgent) {
        const disconnectedInfo = disconnectedAgents.get(terminalId);
        agentType = disconnectedInfo?.type || null;
      }

      // Detect using engine
      const detectionResult = this.detectionEngine.detectTermination(data, agentType || undefined);

      return {
        isTerminated: detectionResult.isTerminated,
        confidence: detectionResult.confidence,
        reason: detectionResult.reason,
        detectedLine: detectionResult.detectedLine,
      };
    } catch (error) {
      log('ERROR: CLI Agent termination detection failed:', error);
      return {
        isTerminated: false,
        confidence: 0,
        detectedLine: '',
        reason: 'Detection error',
      };
    }
  }

  // =================== State Management Methods ===================

  getAgentState(terminalId: string): CliAgentState {
    const state = this.stateStore.getAgentState(terminalId);
    const connectedAgent = this.stateStore.getConnectedAgent();
    const disconnectedAgents = this.stateStore.getDisconnectedAgents();

    let agentType: 'claude' | 'gemini' | 'codex' | null = null;

    if (state === 'connected' && connectedAgent && connectedAgent.terminalId === terminalId) {
      agentType = connectedAgent.type;
    } else if (state === 'disconnected') {
      const disconnectedInfo = disconnectedAgents.get(terminalId);
      agentType = disconnectedInfo?.type || null;
    }

    return {
      status: state,
      agentType,
    };
  }

  getConnectedAgent(): { terminalId: string; type: 'claude' | 'gemini' | 'codex' } | null {
    return this.stateStore.getConnectedAgent();
  }

  getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return this.stateStore.getDisconnectedAgents();
  }

  switchAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    try {
      const disconnectedAgents = this.stateStore.getDisconnectedAgents();
      const currentState = this.getAgentState(terminalId);

      if (disconnectedAgents.has(terminalId)) {
        // Promote disconnected agent to connected
        const success = this.stateStore.promoteDisconnectedAgent(terminalId);
        const agentInfo = disconnectedAgents.get(terminalId)!;

        if (success) {
          log(`🔄 [CLI-AGENT] Switched connection to terminal ${terminalId} (from disconnected)`);
          return {
            success: true,
            newStatus: 'connected',
            agentType: agentInfo.type,
          };
        } else {
          return {
            success: false,
            reason: 'Failed to promote disconnected agent',
            newStatus: currentState.status,
            agentType: currentState.agentType,
          };
        }
      } else if (currentState.status === 'none') {
        // Allow switching 'none' state terminals to connected (assume Claude by default)
        const agentType = 'claude';
        this.stateStore.setConnectedAgent(terminalId, agentType);
        log(`🔄 [CLI-AGENT] Activated AI agent for terminal ${terminalId} (from none state)`);
        return {
          success: true,
          newStatus: 'connected',
          agentType: agentType,
        };
      } else if (currentState.status === 'connected') {
        // Reaffirm connection
        const agentType = currentState.agentType || 'claude';
        this.stateStore.setConnectedAgent(terminalId, agentType);
        log(`🔄 [CLI-AGENT] Reaffirmed connection to terminal ${terminalId} (already connected)`);
        return {
          success: true,
          newStatus: 'connected',
          agentType: agentType,
        };
      }

      log(`⚠️ [CLI-AGENT] Cannot switch to terminal ${terminalId}: unknown state`);
      return {
        success: false,
        reason: 'Unknown terminal state',
        newStatus: currentState.status,
        agentType: currentState.agentType,
      };
    } catch (error) {
      log('ERROR: CLI Agent connection switch failed:', error);
      return {
        success: false,
        reason: 'Connection switch failed',
        newStatus: 'none',
        agentType: null,
      };
    }
  }

  // =================== Event Management ===================

  get onCliAgentStatusChange() {
    return this.stateStore.onStateChange;
  }

  /**
   * Observer callback for state changes
   */
  onStateChange(event: StateChangeEvent): void {
    log(
      `📢 [CLI-AGENT-SERVICE] State change observed: terminal ${event.terminalId} -> ${event.status} (${event.type})`
    );
  }

  // =================== Lifecycle Management ===================

  handleTerminalRemoved(terminalId: string): void {
    // Clear cache entries for this terminal
    const cacheKeys: string[] = [];
    try {
      (this.detectionCache as any).forEach((_value: any, key: string) => {
        if (key.includes(terminalId)) {
          cacheKeys.push(key);
        }
      });
    } catch (e) {
      // Fallback: clear entire cache if iteration fails
      this.detectionCache.clear();
      log(`⚠️ [CLI-AGENT] Cache iteration failed, cleared entire cache`);
    }
    cacheKeys.forEach((key) => this.detectionCache.delete(key));

    // Remove terminal from state store
    this.stateStore.removeTerminalCompletely(terminalId);

    log(`🗑️ [CLI-AGENT] Terminal ${terminalId} removed and cleaned up`);
  }

  startHeartbeat(): void {
    // Heartbeat is now handled by the state store internally
    // This method is kept for interface compatibility
    log('💓 [CLI-AGENT] Heartbeat mechanism initialized');
  }

  refreshAgentState(): boolean {
    // State refresh is now simpler with centralized state store
    const connectedAgent = this.stateStore.getConnectedAgent();
    return connectedAgent !== null;
  }

  forceReconnectAgent(
    terminalId: string,
    agentType: 'claude' | 'gemini' | 'codex' = 'claude',
    terminalName?: string
  ): boolean {
    log(
      `🔄 [MANUAL-RESET] User triggered force reconnect for terminal ${terminalId} as ${agentType}`
    );

    try {
      // Clear cached detection results for this terminal
      const cacheKeys: string[] = [];
      try {
        (this.detectionCache as any).forEach((_value: any, key: string) => {
          if (key.includes(terminalId)) {
            cacheKeys.push(key);
          }
        });
      } catch (e) {
        this.detectionCache.clear();
        log(`⚠️ [MANUAL-RESET] Cache iteration failed, cleared entire cache`);
      }
      cacheKeys.forEach((key) => this.detectionCache.delete(key));
      log(`🧹 [MANUAL-RESET] Cleared ${cacheKeys.length} cache entries for terminal ${terminalId}`);

      // Force reconnect via state store
      this.stateStore.setConnectedAgent(terminalId, agentType, terminalName);

      log(
        `✅ [MANUAL-RESET] Successfully force-reconnected ${agentType} in terminal ${terminalId}`
      );
      return true;
    } catch (error) {
      log('❌ [MANUAL-RESET] Error during force reconnect:', error);
      return false;
    }
  }

  clearDetectionError(terminalId: string): boolean {
    log(`🧹 [MANUAL-RESET] User triggered detection error clear for terminal ${terminalId}`);

    try {
      // Clear all cached results for this terminal
      const cacheKeys: string[] = [];
      try {
        (this.detectionCache as any).forEach((_value: any, key: string) => {
          if (key.includes(terminalId)) {
            cacheKeys.push(key);
          }
        });
      } catch (e) {
        this.detectionCache.clear();
        log(`⚠️ [MANUAL-RESET] Cache iteration failed, cleared entire cache`);
      }
      cacheKeys.forEach((key) => this.detectionCache.delete(key));
      log(`🧹 [MANUAL-RESET] Cleared ${cacheKeys.length} cache entries for terminal ${terminalId}`);

      // Reset state via state store
      this.stateStore.setAgentTerminated(terminalId);

      log(`✅ [MANUAL-RESET] Successfully cleared detection errors for terminal ${terminalId}`);
      return true;
    } catch (error) {
      log('❌ [MANUAL-RESET] Error during detection error clear:', error);
      return false;
    }
  }

  dispose(): void {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    // Remove observer
    this.stateStore.removeObserver(this);

    // Clear cache
    this.detectionCache.clear();

    log('🧹 [CLI-AGENT-SERVICE] Disposed');
  }
}
