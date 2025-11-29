/**
 * Communication Layer - Session Data Transfer Objects
 *
 * Defines DTOs for session persistence and restoration between Extension and WebView layers.
 *
 * @see Issue #223 - Phase 1: Communication Layer Definition
 */

/**
 * Session save request DTO
 */
export interface SaveSessionRequestDTO {
  force?: boolean;
  reason?: 'auto' | 'manual' | 'shutdown';
  timestamp: number;
}

/**
 * Session save response DTO
 */
export interface SaveSessionResponseDTO {
  success: boolean;
  savedTerminals: number;
  totalSize: number;
  error?: string;
  timestamp: number;
}

/**
 * Session restore request DTO
 */
export interface RestoreSessionRequestDTO {
  forceRestore?: boolean;
  sessionId?: string;
  timestamp: number;
}

/**
 * Session restore response DTO
 */
export interface RestoreSessionResponseDTO {
  success: boolean;
  restoredTerminals: number;
  skippedTerminals: number;
  errors: string[];
  timestamp: number;
}

/**
 * Session clear request DTO
 */
export interface ClearSessionRequestDTO {
  clearAll?: boolean;
  sessionId?: string;
  timestamp: number;
}

/**
 * Session clear response DTO
 */
export interface ClearSessionResponseDTO {
  success: boolean;
  clearedSessions: number;
  error?: string;
  timestamp: number;
}

/**
 * Terminal session data DTO
 * Contains terminal state for persistence
 */
export interface TerminalSessionDataDTO {
  terminalId: string;
  pid: number | undefined;
  cwd: string;
  title: string;
  shellPath?: string;
  shellArgs?: string[];
  scrollback?: string[];
  cursorPosition?: { x: number; y: number };
  isActive: boolean;
}

/**
 * Complete session data DTO
 */
export interface SessionDataDTO {
  version: string;
  timestamp: number;
  terminals: TerminalSessionDataDTO[];
  activeTerminalId?: string;
  workspaceId?: string;
}

/**
 * Scrollback data DTO
 */
export interface ScrollbackDataDTO {
  terminalId: string;
  lines: string[];
  totalLines: number;
  compressed?: boolean;
}

/**
 * Session restore progress DTO
 */
export interface SessionRestoreProgressDTO {
  currentTerminal: number;
  totalTerminals: number;
  terminalId: string;
  status: 'restoring' | 'completed' | 'failed';
  message?: string;
}
