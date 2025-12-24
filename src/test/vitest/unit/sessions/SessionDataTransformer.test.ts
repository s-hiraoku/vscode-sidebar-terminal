/**
 * TDD Test Suite for SessionDataTransformer (Phase 2.2-2.4)
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 *
 * Test Coverage:
 * - Phase 2.2: Progressive Loading (not tested here - integration test)
 * - Phase 2.3: Session Migration (200-line → 1000-line scrollback)
 * - Phase 2.4: Storage Optimization and Retention Management
 */

import { describe, it, expect } from 'vitest';
import { SessionDataTransformer } from '../../../../shared/session.types';
import type { SessionStorageData } from '../../../../shared/session.types';

describe('SessionDataTransformer - Phase 2.3 & 2.4', () => {
  describe('Phase 2.3: Session Migration', () => {
    describe('migrateSessionFormat()', () => {
      it('should detect old format session (missing version)', () => {
        const oldFormatSession: any = {
          terminals: [],
          timestamp: Date.now(),
          version: undefined,
          scrollbackData: {},
        };

        const result = SessionDataTransformer.migrateSessionFormat(oldFormatSession);

        expect(result.migrated).toBe(true);
        expect(result.sessionData.version).toBe('0.1.137');
        expect(result.sessionData.config?.scrollbackLines).toBe(1000);
      });

      it('should detect old format session (version < 0.1.137)', () => {
        const oldFormatSession: any = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.100',
          config: { scrollbackLines: 200, reviveProcess: 'auto' },
          scrollbackData: {},
        };

        const result = SessionDataTransformer.migrateSessionFormat(oldFormatSession);

        expect(result.migrated).toBe(true);
        expect(result.sessionData.version).toBe('0.1.137');
        expect(result.message).toContain('Updated scrollback limit from 200 to 1000');
      });

      it('should detect old format session (scrollbackLines < 500)', () => {
        const oldFormatSession: any = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.137',
          config: { scrollbackLines: 200, reviveProcess: 'auto' },
          scrollbackData: {},
        };

        const result = SessionDataTransformer.migrateSessionFormat(oldFormatSession);

        expect(result.migrated).toBe(true);
        expect(result.sessionData.config?.scrollbackLines).toBe(1000);
      });

      it('should not migrate new format session', () => {
        const newFormatSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: null,
          config: { scrollbackLines: 1000, reviveProcess: 'auto' },
        };

        const result = SessionDataTransformer.migrateSessionFormat(newFormatSession);

        expect(result.migrated).toBe(false);
        expect(result.message).toBe('No migration needed');
      });

      it('should add default config if missing', () => {
        const sessionWithoutConfig: any = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.100',
          scrollbackData: {},
        };

        const result = SessionDataTransformer.migrateSessionFormat(sessionWithoutConfig);

        expect(result.migrated).toBe(true);
        expect(result.sessionData.config).toEqual({
          scrollbackLines: 1000,
          reviveProcess: 'auto',
        });
        expect(result.message).toContain('Added default config');
      });
    });

    describe('validateSessionForRestore()', () => {
      it('should validate valid session data', () => {
        const validSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': ['line1', 'line2'],
          },
        };

        const result = SessionDataTransformer.validateSessionForRestore(validSession);

        expect(result.valid).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      it('should detect missing terminals array', () => {
        const invalidSession: any = {
          timestamp: Date.now(),
          version: '0.1.137',
        };

        const result = SessionDataTransformer.validateSessionForRestore(invalidSession);

        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Missing or invalid terminals array');
      });

      it('should detect missing timestamp', () => {
        const invalidSession: any = {
          terminals: [],
          version: '0.1.137',
        };

        const result = SessionDataTransformer.validateSessionForRestore(invalidSession);

        expect(result.valid).toBe(false);
        expect(result.issues).toContain('Missing or invalid timestamp');
      });

      it('should warn about missing scrollback data', () => {
        const sessionWithoutScrollback: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {},
        };

        const result = SessionDataTransformer.validateSessionForRestore(sessionWithoutScrollback);

        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('has no scrollback data');
      });

      it('should warn about potential old format truncation (exactly 200 lines)', () => {
        const sessionWith200Lines: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(200).fill('line'),
          },
        };

        const result = SessionDataTransformer.validateSessionForRestore(sessionWith200Lines);

        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('exactly 200 lines');
        expect(result.warnings[0]).toContain('possible old format truncation');
      });
    });

    describe('createMigrationProgress()', () => {
      it('should calculate correct progress percentage', () => {
        const progress = SessionDataTransformer.createMigrationProgress(5, 3, true);

        expect(progress.progress).toBe(60);
        expect(progress.status).toBe('migrating');
        expect(progress.message).toContain('3/5 terminals');
      });

      it('should show restoring status when not migrating', () => {
        const progress = SessionDataTransformer.createMigrationProgress(5, 2, false);

        expect(progress.status).toBe('restoring');
        expect(progress.message).toContain('Restoring session');
      });

      it('should handle 100% completion', () => {
        const progress = SessionDataTransformer.createMigrationProgress(5, 5, true);

        expect(progress.progress).toBe(100);
      });

      it('should handle zero terminals edge case', () => {
        const progress = SessionDataTransformer.createMigrationProgress(0, 0, false);

        expect(progress.progress).toBe(100);
      });
    });
  });

  describe('Phase 2.4: Storage Optimization', () => {
    describe('calculateStorageSize()', () => {
      it('should calculate storage size for small session', () => {
        const smallSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
        };

        const size = SessionDataTransformer.calculateStorageSize(smallSession);

        expect(size).toBeGreaterThan(0);
        expect(size).toBeLessThan(1024);
      });

      it('should calculate storage size for session with scrollback', () => {
        const sessionWithScrollback: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(1000)
              .fill(null)
              .map((_, i) => `Line ${i}: Some terminal output content`),
          },
        };

        const size = SessionDataTransformer.calculateStorageSize(sessionWithScrollback);

        expect(size).toBeGreaterThan(40000);
      });

      it('should handle calculation errors gracefully', () => {
        const circularSession: any = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.137',
        };
        circularSession.self = circularSession;

        const size = SessionDataTransformer.calculateStorageSize(circularSession);

        expect(size).toBe(0);
      });
    });

    describe('isStorageLimitExceeded()', () => {
      it('should detect when storage limit is exceeded', () => {
        const largeSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(100000)
              .fill(null)
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`),
          },
        };

        const result = SessionDataTransformer.isStorageLimitExceeded(largeSession, 5);

        expect(result.exceeded).toBe(true);
        expect(result.currentSizeMB).toBeGreaterThan(5);
        expect(result.percentageUsed).toBeGreaterThan(100);
      });

      it('should detect when storage is within limits', () => {
        const smallSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
        };

        const result = SessionDataTransformer.isStorageLimitExceeded(smallSession, 20);

        expect(result.exceeded).toBe(false);
        expect(result.currentSizeMB).toBeLessThan(1);
        expect(result.percentageUsed).toBeLessThan(5);
      });

      it('should use default 20MB limit', () => {
        const session: SessionStorageData = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: null,
        };

        const result = SessionDataTransformer.isStorageLimitExceeded(session);

        expect(result.limitMB).toBe(20);
      });
    });

    describe('getCleanupRecommendations()', () => {
      it('should recommend cleanup for expired session (>7 days)', () => {
        const oldSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
          version: '0.1.137',
          activeTerminalId: null,
        };

        const recommendations = SessionDataTransformer.getCleanupRecommendations(oldSession);

        expect(recommendations.shouldCleanup).toBe(true);
        expect(recommendations.reason.length).toBeGreaterThan(0);
        expect(recommendations.reason[0]).toContain('expired');
        expect(recommendations.ageInfo.ageInDays).toBeGreaterThan(7);
      });

      it('should recommend cleanup for oversized session', () => {
        const largeSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(200000)
              .fill(null)
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`),
          },
        };

        const recommendations = SessionDataTransformer.getCleanupRecommendations(largeSession, {
          maxStorageMB: 10,
        });

        expect(recommendations.shouldCleanup).toBe(true);
        expect(recommendations.reason.some((r) => r.includes('Storage limit exceeded'))).toBe(true);
      });

      it('should warn at 80% threshold without requiring cleanup', () => {
        const mediumSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(50000)
              .fill(null)
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`),
          },
        };

        const recommendations = SessionDataTransformer.getCleanupRecommendations(mediumSession, {
          maxStorageMB: 6,
          warnThresholdPercent: 80,
        });

        expect(recommendations.shouldCleanup).toBe(false);
        expect(recommendations.reason.length).toBeGreaterThan(0);
        expect(recommendations.reason[0]).toContain('Storage usage high');
      });

      it('should use configurable retention period', () => {
        const session: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
          version: '0.1.137',
          activeTerminalId: null,
        };

        const recommendations30Days = SessionDataTransformer.getCleanupRecommendations(session, {
          maxAgeDays: 30,
        });

        expect(recommendations30Days.shouldCleanup).toBe(false);

        const recommendations10Days = SessionDataTransformer.getCleanupRecommendations(session, {
          maxAgeDays: 10,
        });

        expect(recommendations10Days.shouldCleanup).toBe(true);
      });
    });

    describe('optimizeSessionStorage()', () => {
      it('should not optimize if within target size', () => {
        const smallSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(100).fill('short line'),
          },
        };

        const result = SessionDataTransformer.optimizeSessionStorage(smallSession, 18);

        expect(result.optimized).toBe(false);
        expect(result.message).toBe('No optimization needed');
        expect(result.reductionPercent).toBe(0);
      });

      it('should optimize oversized session by reducing scrollback', () => {
        const largeSession: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(100000)
              .fill(null)
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`),
          },
        };

        const initialSize =
          SessionDataTransformer.calculateStorageSize(largeSession) / (1024 * 1024);

        const result = SessionDataTransformer.optimizeSessionStorage(largeSession, 5);

        expect(result.optimized).toBe(true);
        expect(result.originalSizeMB).toBeCloseTo(initialSize, 0);
        expect(result.newSizeMB).toBeLessThan(result.originalSizeMB);
        expect(result.reductionPercent).toBeGreaterThan(0);
        expect(result.message).toContain('Reduced storage');
      });

      it('should preserve most recent scrollback lines', () => {
        const session: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(10000)
              .fill(null)
              .map((_, i) => `Line ${i}`),
          },
        };

        const originalLastLine = (session.scrollbackData!['1'] as string[])[9999];

        SessionDataTransformer.optimizeSessionStorage(session, 0.1);

        const optimizedData = session.scrollbackData!['1'] as string[];
        const newLastLine = optimizedData[optimizedData.length - 1];

        expect(newLastLine).toBe(originalLastLine);
      });

      it('should use configurable target size', () => {
        const session: SessionStorageData = {
          terminals: [
            {
              id: '1',
              name: 'Terminal 1',
              number: 1,
              cwd: '/home/user',
              isActive: true,
            },
          ],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: '1',
          scrollbackData: {
            '1': Array(50000)
              .fill(null)
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`),
          },
        };

        const result = SessionDataTransformer.optimizeSessionStorage(session, 3);

        expect(result.newSizeMB).toBeLessThan(3.5);
      });
    });

    describe('isSessionExpired()', () => {
      it('should detect expired session (>7 days default)', () => {
        const oldSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
          version: '0.1.137',
          activeTerminalId: null,
        };

        const isExpired = SessionDataTransformer.isSessionExpired(oldSession);

        expect(isExpired).toBe(true);
      });

      it('should not detect non-expired session', () => {
        const recentSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000,
          version: '0.1.137',
          activeTerminalId: null,
        };

        const isExpired = SessionDataTransformer.isSessionExpired(recentSession);

        expect(isExpired).toBe(false);
      });

      it('should use configurable expiry period', () => {
        const session: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
          version: '0.1.137',
          activeTerminalId: null,
        };

        const isExpired30Days = SessionDataTransformer.isSessionExpired(session, 30);
        expect(isExpired30Days).toBe(false);

        const isExpired10Days = SessionDataTransformer.isSessionExpired(session, 10);
        expect(isExpired10Days).toBe(true);
      });
    });
  });
});
