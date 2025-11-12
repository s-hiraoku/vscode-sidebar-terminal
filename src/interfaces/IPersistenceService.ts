/**
 * Persistence Service Interface
 *
 * Clean Architecture - Layer Separation
 * This interface defines the contract for persistence operations
 * that can be implemented by both Extension and WebView layers.
 *
 * Key Principles:
 * - No layer-specific dependencies (no vscode.*, no DOM APIs)
 * - Pure data transfer objects (DTOs)
 * - Testable and mockable
 */

/**
 * Terminal session data for persistence
 * This is a DTO that crosses layer boundaries
 */
export interface TerminalSessionData {
  readonly id: string;
  readonly name?: string;
  readonly cwd?: string;
  readonly scrollbackData?: string;
  readonly createdAt: number;
  readonly lastActiveAt: number;
}

/**
 * Persistence operation result
 */
export interface PersistenceResult {
  readonly success: boolean;
  readonly error?: string;
  readonly data?: unknown;
}

/**
 * Persistence Service Interface
 *
 * Implemented by:
 * - ExtensionPersistenceService (Extension layer - uses VS Code APIs)
 * - WebViewPersistenceService (WebView layer - uses browser storage)
 */
export interface IPersistenceService {
  /**
   * Save a single terminal session
   */
  saveSession(session: TerminalSessionData): Promise<PersistenceResult>;

  /**
   * Save multiple terminal sessions
   */
  saveSessions(sessions: TerminalSessionData[]): Promise<PersistenceResult>;

  /**
   * Load all saved sessions
   */
  loadSessions(): Promise<TerminalSessionData[]>;

  /**
   * Load a specific session by ID
   */
  loadSession(sessionId: string): Promise<TerminalSessionData | null>;

  /**
   * Delete a specific session
   */
  deleteSession(sessionId: string): Promise<PersistenceResult>;

  /**
   * Clear all saved sessions
   */
  clearAllSessions(): Promise<PersistenceResult>;

  /**
   * Check if persistence is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Persistence Configuration
 */
export interface PersistenceConfig {
  readonly maxSessions: number;
  readonly maxScrollbackSize: number;
  readonly enableAutoSave: boolean;
  readonly autoSaveInterval: number; // milliseconds
}

/**
 * Persistence Service Factory
 * Creates appropriate persistence service based on context
 */
export interface IPersistenceServiceFactory {
  createService(config: PersistenceConfig): IPersistenceService;
}
