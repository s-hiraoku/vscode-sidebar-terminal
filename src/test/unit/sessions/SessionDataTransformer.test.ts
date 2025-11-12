/**
 * TDD Test Suite for SessionDataTransformer (Phase 2.2-2.4)
 *
 * Test Coverage:
 * - Phase 2.2: Progressive Loading (not tested here - integration test)
 * - Phase 2.3: Session Migration (200-line → 1000-line scrollback)
 * - Phase 2.4: Storage Optimization and Retention Management
 *
 * Following t-wada TDD methodology:
 * 1. RED: Write failing tests specifying behavior
 * 2. GREEN: Minimal implementation to pass
 * 3. REFACTOR: Code improvement while tests pass
 */

import { expect } from 'chai';
import { SessionDataTransformer } from '../../../shared/session.types';
import type { SessionStorageData } from '../../../shared/session.types';

// Test setup shared utilities
import '../../shared/TestSetup';

describe('SessionDataTransformer - Phase 2.3 & 2.4', () => {
  describe('Phase 2.3: Session Migration', () => {
    describe('migrateSessionFormat()', () => {
      it('should detect old format session (missing version)', () => {
        // RED: Specify behavior for old format detection
        const oldFormatSession: any = {
          terminals: [],
          timestamp: Date.now(),
          version: undefined, // Missing version
          scrollbackData: {},
        };

        const result = SessionDataTransformer.migrateSessionFormat(oldFormatSession);

        expect(result.migrated).to.be.true;
        expect(result.sessionData.version).to.equal('0.1.137');
        expect(result.sessionData.config?.scrollbackLines).to.equal(1000);
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

        expect(result.migrated).to.be.true;
        expect(result.sessionData.version).to.equal('0.1.137');
        expect(result.message).to.include('Updated scrollback limit from 200 to 1000');
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

        expect(result.migrated).to.be.true;
        expect(result.sessionData.config?.scrollbackLines).to.equal(1000);
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

        expect(result.migrated).to.be.false;
        expect(result.message).to.equal('No migration needed');
      });

      it('should add default config if missing', () => {
        const sessionWithoutConfig: any = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.100',
          scrollbackData: {},
        };

        const result = SessionDataTransformer.migrateSessionFormat(sessionWithoutConfig);

        expect(result.migrated).to.be.true;
        expect(result.sessionData.config).to.deep.equal({
          scrollbackLines: 1000,
          reviveProcess: 'auto',
        });
        expect(result.message).to.include('Added default config');
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

        expect(result.valid).to.be.true;
        expect(result.issues).to.be.empty;
      });

      it('should detect missing terminals array', () => {
        const invalidSession: any = {
          timestamp: Date.now(),
          version: '0.1.137',
        };

        const result = SessionDataTransformer.validateSessionForRestore(invalidSession);

        expect(result.valid).to.be.false;
        expect(result.issues).to.include('Missing or invalid terminals array');
      });

      it('should detect missing timestamp', () => {
        const invalidSession: any = {
          terminals: [],
          version: '0.1.137',
        };

        const result = SessionDataTransformer.validateSessionForRestore(invalidSession);

        expect(result.valid).to.be.false;
        expect(result.issues).to.include('Missing or invalid timestamp');
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

        expect(result.valid).to.be.true; // Valid but with warnings
        expect(result.warnings).to.have.length.greaterThan(0);
        expect(result.warnings[0]).to.include('has no scrollback data');
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

        expect(result.valid).to.be.true;
        expect(result.warnings).to.have.length.greaterThan(0);
        expect(result.warnings[0]).to.include('exactly 200 lines');
        expect(result.warnings[0]).to.include('possible old format truncation');
      });
    });

    describe('createMigrationProgress()', () => {
      it('should calculate correct progress percentage', () => {
        const progress = SessionDataTransformer.createMigrationProgress(5, 3, true);

        expect(progress.progress).to.equal(60);
        expect(progress.status).to.equal('migrating');
        expect(progress.message).to.include('3/5 terminals');
      });

      it('should show restoring status when not migrating', () => {
        const progress = SessionDataTransformer.createMigrationProgress(5, 2, false);

        expect(progress.status).to.equal('restoring');
        expect(progress.message).to.include('Restoring session');
      });

      it('should handle 100% completion', () => {
        const progress = SessionDataTransformer.createMigrationProgress(5, 5, true);

        expect(progress.progress).to.equal(100);
      });

      it('should handle zero terminals edge case', () => {
        const progress = SessionDataTransformer.createMigrationProgress(0, 0, false);

        expect(progress.progress).to.equal(100);
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

        expect(size).to.be.greaterThan(0);
        expect(size).to.be.lessThan(1024); // Less than 1KB
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

        expect(size).to.be.greaterThan(40000); // At least 40KB
      });

      it('should handle calculation errors gracefully', () => {
        // Create circular reference (should be handled)
        const circularSession: any = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.137',
        };
        circularSession.self = circularSession; // Circular reference

        const size = SessionDataTransformer.calculateStorageSize(circularSession);

        // Should return 0 on error
        expect(size).to.equal(0);
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
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`), // ~10MB
          },
        };

        const result = SessionDataTransformer.isStorageLimitExceeded(largeSession, 5);

        expect(result.exceeded).to.be.true;
        expect(result.currentSizeMB).to.be.greaterThan(5);
        expect(result.percentageUsed).to.be.greaterThan(100);
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

        expect(result.exceeded).to.be.false;
        expect(result.currentSizeMB).to.be.lessThan(1);
        expect(result.percentageUsed).to.be.lessThan(5);
      });

      it('should use default 20MB limit', () => {
        const session: SessionStorageData = {
          terminals: [],
          timestamp: Date.now(),
          version: '0.1.137',
          activeTerminalId: null,
        };

        const result = SessionDataTransformer.isStorageLimitExceeded(session);

        expect(result.limitMB).to.equal(20);
      });
    });

    describe('getCleanupRecommendations()', () => {
      it('should recommend cleanup for expired session (>7 days)', () => {
        const oldSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
          version: '0.1.137',
          activeTerminalId: null,
        };

        const recommendations = SessionDataTransformer.getCleanupRecommendations(oldSession);

        expect(recommendations.shouldCleanup).to.be.true;
        expect(recommendations.reason).to.have.length.greaterThan(0);
        expect(recommendations.reason[0]).to.include('expired');
        expect(recommendations.ageInfo.ageInDays).to.be.greaterThan(7);
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
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`), // ~20MB+
          },
        };

        const recommendations = SessionDataTransformer.getCleanupRecommendations(largeSession, {
          maxStorageMB: 10,
        });

        expect(recommendations.shouldCleanup).to.be.true;
        expect(recommendations.reason.some((r) => r.includes('Storage limit exceeded'))).to.be.true;
      });

      it('should warn at 80% threshold without requiring cleanup', () => {
        // Create session at ~85% of limit
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
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`), // ~5MB
          },
        };

        const recommendations = SessionDataTransformer.getCleanupRecommendations(mediumSession, {
          maxStorageMB: 6,
          warnThresholdPercent: 80,
        });

        expect(recommendations.shouldCleanup).to.be.false;
        expect(recommendations.reason).to.have.length.greaterThan(0);
        expect(recommendations.reason[0]).to.include('Storage usage high');
      });

      it('should use configurable retention period', () => {
        const session: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
          version: '0.1.137',
          activeTerminalId: null,
        };

        const recommendations30Days = SessionDataTransformer.getCleanupRecommendations(session, {
          maxAgeDays: 30,
        });

        expect(recommendations30Days.shouldCleanup).to.be.false;

        const recommendations10Days = SessionDataTransformer.getCleanupRecommendations(session, {
          maxAgeDays: 10,
        });

        expect(recommendations10Days.shouldCleanup).to.be.true;
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

        expect(result.optimized).to.be.false;
        expect(result.message).to.equal('No optimization needed');
        expect(result.reductionPercent).to.equal(0);
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
              .map((_, i) => `Line ${i}: ${'x'.repeat(100)}`), // ~10MB
          },
        };

        const initialSize =
          SessionDataTransformer.calculateStorageSize(largeSession) / (1024 * 1024);

        const result = SessionDataTransformer.optimizeSessionStorage(largeSession, 5);

        expect(result.optimized).to.be.true;
        expect(result.originalSizeMB).to.be.closeTo(initialSize, 0.5);
        expect(result.newSizeMB).to.be.lessThan(result.originalSizeMB);
        expect(result.reductionPercent).to.be.greaterThan(0);
        expect(result.message).to.include('Reduced storage');
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

        SessionDataTransformer.optimizeSessionStorage(session, 0.1); // Very small target

        const optimizedData = session.scrollbackData!['1'] as string[];
        const newLastLine = optimizedData[optimizedData.length - 1];

        // Most recent line should be preserved
        expect(newLastLine).to.equal(originalLastLine);
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

        expect(result.newSizeMB).to.be.lessThan(3.5); // Should be close to 3MB target
      });
    });

    describe('isSessionExpired()', () => {
      it('should detect expired session (>7 days default)', () => {
        const oldSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
          version: '0.1.137',
          activeTerminalId: null,
        };

        const isExpired = SessionDataTransformer.isSessionExpired(oldSession);

        expect(isExpired).to.be.true;
      });

      it('should not detect non-expired session', () => {
        const recentSession: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
          version: '0.1.137',
          activeTerminalId: null,
        };

        const isExpired = SessionDataTransformer.isSessionExpired(recentSession);

        expect(isExpired).to.be.false;
      });

      it('should use configurable expiry period', () => {
        const session: SessionStorageData = {
          terminals: [],
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
          version: '0.1.137',
          activeTerminalId: null,
        };

        const isExpired30Days = SessionDataTransformer.isSessionExpired(session, 30);
        expect(isExpired30Days).to.be.false;

        const isExpired10Days = SessionDataTransformer.isSessionExpired(session, 10);
        expect(isExpired10Days).to.be.true;
      });
    });
  });
});
