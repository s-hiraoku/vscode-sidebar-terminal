/**
 * CLI Agent Detection Service Interfaces
 * 
 * These interfaces define the contract for CLI Agent detection and management services.
 * They follow the Single Responsibility Principle by separating detection logic
 * from terminal lifecycle management.
 */

import * as vscode from 'vscode';

// =================== Detection Result Types ===================

export interface CliAgentDetectionResult {
  type: 'claude' | 'gemini';
  confidence: number;
  source: 'input' | 'output' | 'startup' | 'termination';
  detectedLine?: string;
}

export interface TerminationDetectionResult {
  isTerminated: boolean;
  reason: 'shell_prompt' | 'exit_command' | 'termination_message' | 'process_exit';
  detectedLine?: string;
}

// =================== Agent State Types ===================

export interface CliAgentState {
  terminalId: string;
  type: 'claude' | 'gemini' | null;
  status: 'connected' | 'disconnected' | 'none';
  terminalName?: string;
  startTime?: Date;
}

export interface DisconnectedAgentInfo {
  type: 'claude' | 'gemini';
  startTime: Date;
  terminalName?: string;
}

// =================== Cache and Optimization Types ===================

export interface DetectionCacheEntry {
  lastData: string;
  timestamp: number;
}

export interface DetectionConfig {
  debounceMs: number;
  cacheTtlMs: number;
  maxBufferSize: number;
  skipMinimalData: boolean;
}

// =================== Core Service Interface ===================

/**
 * CLI Agent Detection Service Interface
 * 
 * Responsible for detecting CLI Agent startup, termination, and state changes
 * from terminal input/output data.
 */
export interface ICliAgentDetectionService {
  // =================== Detection Methods ===================
  
  /**
   * Detect CLI Agent from user input commands
   * @param terminalId Terminal ID where the input occurred
   * @param data Input data to analyze
   * @returns Detection result or null if no agent detected
   */
  detectFromInput(terminalId: string, data: string): CliAgentDetectionResult | null;

  /**
   * Detect CLI Agent from terminal output data
   * @param terminalId Terminal ID where the output occurred
   * @param data Output data to analyze
   * @returns Detection result or null if no agent detected
   */
  detectFromOutput(terminalId: string, data: string): CliAgentDetectionResult | null;

  /**
   * Detect CLI Agent termination from terminal data
   * @param terminalId Terminal ID to check for termination
   * @param data Terminal data to analyze
   * @returns Termination detection result
   */
  detectTermination(terminalId: string, data: string): TerminationDetectionResult;

  // =================== State Management Methods ===================
  
  /**
   * Get current CLI Agent state for a terminal
   * @param terminalId Terminal ID to query
   * @returns Current agent state
   */
  getAgentState(terminalId: string): CliAgentState;

  /**
   * Get currently connected CLI Agent across all terminals
   * @returns Connected agent info or null if none connected
   */
  getConnectedAgent(): { terminalId: string; type: string } | null;

  /**
   * Get all disconnected agents
   * @returns Map of terminal IDs to disconnected agent info
   */
  getDisconnectedAgents(): Map<string, DisconnectedAgentInfo>;

  /**
   * Manually switch CLI Agent connection to specified terminal
   * @param terminalId Terminal ID to connect agent to
   * @returns Switch operation result
   */
  switchAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  };

  // =================== Event Management ===================
  
  /**
   * CLI Agent status change event
   * Emitted when agent status changes between connected/disconnected/none
   */
  readonly onCliAgentStatusChange: vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }>;

  // =================== Lifecycle Management ===================
  
  /**
   * Handle terminal removal - cleanup agent state
   * @param terminalId Terminal ID that was removed
   */
  handleTerminalRemoved(terminalId: string): void;

  /**
   * Dispose of the service and cleanup resources
   */
  dispose(): void;
}

// =================== Pattern Detection Interface ===================

/**
 * CLI Agent Pattern Detection Interface
 * 
 * Responsible for the low-level pattern matching logic for different CLI agents.
 */
export interface ICliAgentPatternDetector {
  /**
   * Detect Claude Code startup patterns
   * @param cleanLine Cleaned terminal line
   * @returns True if Claude startup detected
   */
  detectClaudeStartup(cleanLine: string): boolean;

  /**
   * Detect Gemini CLI startup patterns  
   * @param cleanLine Cleaned terminal line
   * @returns True if Gemini startup detected
   */
  detectGeminiStartup(cleanLine: string): boolean;

  /**
   * Detect shell prompt return (indicating CLI agent termination)
   * @param cleanLine Cleaned terminal line
   * @returns True if shell prompt detected
   */
  detectShellPrompt(cleanLine: string): boolean;

  /**
   * Clean ANSI escape sequences from terminal data
   * @param text Raw terminal text
   * @returns Cleaned text without ANSI sequences
   */
  cleanAnsiEscapeSequences(text: string): string;
}

// =================== State Management Interface ===================

/**
 * CLI Agent State Manager Interface
 * 
 * Responsible for managing the global state of CLI agents across terminals.
 */
export interface ICliAgentStateManager {
  /**
   * Set a terminal as having a connected CLI agent
   * @param terminalId Terminal ID
   * @param type Agent type
   * @param terminalName Terminal name
   */
  setConnectedAgent(terminalId: string, type: 'claude' | 'gemini', terminalName?: string): void;

  /**
   * Set a CLI agent as terminated/disconnected
   * @param terminalId Terminal ID
   */
  setAgentTerminated(terminalId: string): void;

  /**
   * Promote the most recently started disconnected agent to connected
   */
  promoteLatestDisconnectedAgent(): void;

  /**
   * Get connected agent terminal ID
   * @returns Terminal ID of connected agent or null
   */
  getConnectedAgentTerminalId(): string | null;

  /**
   * Get connected agent type
   * @returns Agent type of connected agent or null
   */
  getConnectedAgentType(): 'claude' | 'gemini' | null;

  /**
   * Check if a terminal has a connected CLI agent
   * @param terminalId Terminal ID to check
   * @returns True if terminal has connected agent
   */
  isAgentConnected(terminalId: string): boolean;

  /**
   * Get all disconnected agents
   * @returns Map of terminal IDs to disconnected agent info
   */
  getDisconnectedAgents(): Map<string, DisconnectedAgentInfo>;

  /**
   * Event emitter for status changes
   */
  readonly onStatusChange: vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }>;

  /**
   * Clear all agent state (for disposal)
   */
  clearAllState(): void;

  /**
   * Dispose and clean up resources
   */
  dispose(): void;
}

// =================== Configuration Interface ===================

/**
 * CLI Agent Detection Configuration Interface
 */
export interface ICliAgentDetectionConfig {
  /**
   * Get detection configuration
   * @returns Current detection configuration
   */
  getConfig(): DetectionConfig;

  /**
   * Update detection configuration
   * @param config New configuration to apply
   */
  updateConfig(config: Partial<DetectionConfig>): void;
}