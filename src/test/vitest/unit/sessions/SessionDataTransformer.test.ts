import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionDataTransformer, SessionStorageData } from '../../../../shared/session.types';

describe('SessionDataTransformer', () => {
  const validSession: SessionStorageData = {
    terminals: [{ id: 't1', name: 'Term 1', number: 1, cwd: '/test', isActive: true }],
    activeTerminalId: 't1',
    timestamp: Date.now(),
    version: '1.0.0'
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('Validation', () => {
    it('should identify valid session data', () => {
      expect(SessionDataTransformer.isValidSessionData(validSession)).toBe(true);
    });

    it('should reject invalid structures', () => {
      expect(SessionDataTransformer.isValidSessionData({})).toBe(false);
      expect(SessionDataTransformer.isValidSessionData({ terminals: [] })).toBe(false); // missing timestamp/version
    });
  });

  describe('Expiry', () => {
    it('should detect expired sessions', () => {
      const oldSession = { ...validSession, timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000 };
      expect(SessionDataTransformer.isSessionExpired(oldSession, 7)).toBe(true);
    });

    it('should not detect fresh sessions as expired', () => {
      expect(SessionDataTransformer.isSessionExpired(validSession, 7)).toBe(false);
    });
  });

  describe('Storage Optimization', () => {
    it('should calculate approximate storage size', () => {
      const size = SessionDataTransformer.calculateStorageSize(validSession);
      expect(size).toBeGreaterThan(0);
    });

    it('should detect when storage limit is exceeded', () => {
      // Simulate 20MB limit check
      const result = SessionDataTransformer.isStorageLimitExceeded(validSession, 0.000001); // ultra-low limit
      expect(result.exceeded).toBe(true);
    });

    it('should optimize storage by trimming scrollback', () => {
      const sessionWithLargeScrollback: SessionStorageData = {
        ...validSession,
        scrollbackData: {
          't1': Array(100).fill('some long log line content')
        }
      };

      const result = SessionDataTransformer.optimizeSessionStorage(sessionWithLargeScrollback, 0.0001); // Trigger optimization
      
      expect(result.optimized).toBe(true);
      expect(result.reductionPercent).toBeGreaterThan(0);
      
      const optimizedScrollback = sessionWithLargeScrollback.scrollbackData?.['t1'] as string[];
      expect(optimizedScrollback.length).toBeLessThan(100);
    });
  });

  describe('Migration', () => {
    it('should migrate old format sessions', () => {
      const oldFormat: any = {
        terminals: [],
        timestamp: Date.now(),
        // No version, or old version
        config: { scrollbackLines: 200 }
      };

      const result = SessionDataTransformer.migrateSessionFormat(oldFormat);
      
      expect(result.migrated).toBe(true);
      expect(result.sessionData.version).toBe('0.1.137');
      expect(result.sessionData.config?.scrollbackLines).toBe(1000);
    });

    it('should not migrate current sessions', () => {
      const result = SessionDataTransformer.migrateSessionFormat(validSession);
      expect(result.migrated).toBe(false);
    });
  });

  describe('Helpers', () => {
    it('should normalize terminal data with defaults', () => {
      const partial = { id: 'test' };
      const normalized = SessionDataTransformer.normalizeTerminalData(partial);
      
      expect(normalized.id).toBe('test');
      expect(normalized.name).toBe('Terminal');
      expect(normalized.scrollback).toEqual([]);
    });

    it('should create success and failure results', () => {
      const success = SessionDataTransformer.createSuccessResult(2);
      expect(success.success).toBe(true);
      expect(success.restoredCount).toBe(2);

      const failure = SessionDataTransformer.createFailureResult('Error msg');
      expect(failure.success).toBe(false);
      expect(failure.message).toContain('Error msg');
    });
  });
});