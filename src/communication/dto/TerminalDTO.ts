/**
 * Communication Layer - Terminal Data Transfer Objects
 *
 * Defines DTOs for terminal-related data transfer between Extension and WebView layers.
 * These DTOs provide a clear contract for data exchange without exposing internal implementation details.
 *
 * @see Issue #223 - Phase 1: Communication Layer Definition
 */

/**
 * Terminal information DTO
 * Used to transfer terminal metadata between layers
 */
export interface TerminalInfoDTO {
  id: string;
  pid: number | undefined;
  cwd: string;
  title: string;
  isActive: boolean;
  shellType?: string;
  processState?: 'idle' | 'running' | 'busy';
  interactionState?: 'waiting' | 'active' | 'locked';
}

/**
 * Terminal creation request DTO
 */
export interface CreateTerminalRequestDTO {
  cwd?: string;
  shellPath?: string;
  shellArgs?: string[];
  env?: Record<string, string>;
  profileName?: string;
}

/**
 * Terminal creation response DTO
 */
export interface CreateTerminalResponseDTO {
  terminalId: string;
  pid: number | undefined;
  cwd: string;
  success: boolean;
  error?: string;
}

/**
 * Terminal output DTO
 */
export interface TerminalOutputDTO {
  terminalId: string;
  data: string;
  timestamp: number;
}

/**
 * Terminal input DTO
 */
export interface TerminalInputDTO {
  terminalId?: string;
  data: string;
  timestamp: number;
}

/**
 * Terminal resize DTO
 */
export interface TerminalResizeDTO {
  terminalId?: string;
  cols: number;
  rows: number;
}

/**
 * Terminal state DTO
 */
export interface TerminalStateDTO {
  terminals: TerminalInfoDTO[];
  activeTerminalId?: string;
  totalTerminals: number;
}

/**
 * Terminal deletion request DTO
 */
export interface DeleteTerminalRequestDTO {
  terminalId: string;
  requestSource: 'header' | 'panel' | 'extension';
}

/**
 * Terminal deletion response DTO
 */
export interface DeleteTerminalResponseDTO {
  terminalId: string;
  success: boolean;
  remainingTerminals: number;
  newActiveTerminalId?: string;
  error?: string;
}
