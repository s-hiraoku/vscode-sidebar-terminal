import { PersistenceResult } from './ExtensionPersistenceService';
import { SessionRestoreResult } from '../../shared/session.types';

export interface TerminalPersistencePort {
  saveCurrentSession(): Promise<PersistenceResult>;
  restoreSession(forceRestore?: boolean): Promise<SessionRestoreResult>;
  clearSession(): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
  dispose(): void;
}
