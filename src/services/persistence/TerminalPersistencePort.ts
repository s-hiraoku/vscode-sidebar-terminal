import { PersistenceResult, RestoreResult } from '../ConsolidatedTerminalPersistenceService';

export interface TerminalPersistencePort {
  saveCurrentSession(): Promise<PersistenceResult>;
  restoreSession(forceRestore?: boolean): Promise<RestoreResult>;
  clearSession(): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
  dispose(): void;
}
