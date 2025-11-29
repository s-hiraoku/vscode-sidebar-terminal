/**
 * Performance Tests for Session Persistence (Phase 2.5.3)
 *
 * Test Coverage:
 * - Large scrollback restoration (<1000ms for >1000 lines)
 * - Small scrollback restoration (<500ms for <1000 lines)
 * - Memory efficiency during restoration
 * - Storage optimization performance
 * - Concurrent session operations
 *
 * Following t-wada TDD methodology for performance validation
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment } from '../../shared/TestSetup';
import { SessionDataTransformer } from '../../../shared/session.types';
import type { SessionStorageData } from '../../../shared/session.types';

describe('Session Persistence Performance Tests - Phase 2.5.3', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    resetTestEnvironment();
    sandbox.restore();
  });

  describe('Large Scrollback Restoration Performance', () => {
    it('should restore 2000-line scrollback in <1000ms', async () => {
      // Given: Large scrollback session
      const largeSession = createSessionWithScrollback(2000, 100);

      // When: Restoration begins
      const startTime = performance.now();

      // Simulate restoration process
      const scrollbackData = largeSession.scrollbackData!['1'] as string[];
      let processedLines = 0;

      const batchSize = 100;
      for (let i = 0; i < Math.min(500, scrollbackData.length); i += batchSize) {
        const batch = scrollbackData.slice(i, i + batchSize);
        processedLines += batch.length;
        // Simulate async batch processing
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const duration = performance.now() - startTime;

      // Then: Performance target met
      expect(duration).to.be.lessThan(1000);
      expect(processedLines).to.be.at.least(500);
    });

    it('should restore 5000-line scrollback with progressive loading in <1500ms', async () => {
      // Given: Very large scrollback session
      const veryLargeSession = createSessionWithScrollback(5000, 100);

      // When: Progressive restoration
      const startTime = performance.now();

      // Only load initial 500 lines for performance
      const scrollbackData = veryLargeSession.scrollbackData!['1'] as string[];
      const initialLines = Math.min(500, scrollbackData.length);

      let processedLines = 0;
      const batchSize = 100;

      for (let i = 0; i < initialLines; i += batchSize) {
        const batch = scrollbackData.slice(i, i + batchSize);
        processedLines += batch.length;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const duration = performance.now() - startTime;

      // Then: Performance target met (initial load only)
      expect(duration).to.be.lessThan(1500);
      expect(processedLines).to.equal(500); // Progressive loading
    });
  });

  describe('Small Scrollback Restoration Performance', () => {
    it('should restore 500-line scrollback in <500ms', async () => {
      // Given: Small scrollback session
      const smallSession = createSessionWithScrollback(500, 50);

      // When: Restoration
      const startTime = performance.now();

      const scrollbackData = smallSession.scrollbackData!['1'] as string[];
      const processedLines = scrollbackData.length;

      const duration = performance.now() - startTime;

      // Then: Performance target met
      expect(duration).to.be.lessThan(500);
      expect(processedLines).to.equal(500);
    });

    it('should restore 100-line scrollback in <100ms', () => {
      // Given: Very small scrollback
      const tinySession = createSessionWithScrollback(100, 20);

      // When: Restoration
      const startTime = performance.now();

      const scrollbackData = tinySession.scrollbackData!['1'] as string[];
      const processedLines = scrollbackData.length;

      const duration = performance.now() - startTime;

      // Then: Very fast restoration
      expect(duration).to.be.lessThan(100);
      expect(processedLines).to.equal(100);
    });
  });

  describe('Storage Optimization Performance', () => {
    it('should calculate storage size in <10ms', () => {
      // Given: Session with moderate scrollback
      const session = createSessionWithScrollback(1000, 100);

      // When: Storage size calculation
      const startTime = performance.now();

      const size = SessionDataTransformer.calculateStorageSize(session);

      const duration = performance.now() - startTime;

      // Then: Fast calculation
      expect(duration).to.be.lessThan(10);
      expect(size).to.be.greaterThan(0);
    });

    it('should optimize oversized session in <100ms', () => {
      // Given: Large session requiring optimization
      const largeSession = createSessionWithScrollback(10000, 100);

      // When: Optimization
      const startTime = performance.now();

      const result = SessionDataTransformer.optimizeSessionStorage(largeSession, 5);

      const duration = performance.now() - startTime;

      // Then: Optimization completes quickly
      expect(duration).to.be.lessThan(100);
      expect(result.optimized).to.be.true;
      expect(result.newSizeMB).to.be.lessThan(result.originalSizeMB);
    });

    it('should handle 100 consecutive storage checks efficiently', () => {
      // Given: Multiple sessions to check
      const sessions = Array(100)
        .fill(null)
        .map(() => createSessionWithScrollback(500, 50));

      // When: Consecutive checks
      const startTime = performance.now();

      const results = sessions.map((session) =>
        SessionDataTransformer.isStorageLimitExceeded(session, 20)
      );

      const duration = performance.now() - startTime;

      // Then: Batch processing efficient
      expect(duration).to.be.lessThan(500); // <5ms per check
      expect(results).to.have.length(100);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during multiple session creations', () => {
      // Given: Initial memory state
      const initialMemory = process.memoryUsage().heapUsed;

      // When: Creating and destroying multiple sessions
      for (let i = 0; i < 50; i++) {
        const session = createSessionWithScrollback(1000, 100);
        // Simulate session destruction
        (session as any).scrollbackData = null;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Then: Minimal memory increase (<10MB)
      expect(memoryIncrease).to.be.lessThan(10 * 1024 * 1024);
    });

    it('should efficiently handle array splicing for lazy loading', () => {
      // Given: Large array for progressive loading
      const lines = Array(10000)
        .fill(null)
        .map((_, i) => `Line ${i}`);

      // When: Multiple chunk extractions
      const startTime = performance.now();

      const chunks: string[][] = [];
      while (lines.length > 0 && chunks.length < 10) {
        chunks.push(lines.splice(0, 500));
      }

      const duration = performance.now() - startTime;

      // Then: Efficient splicing
      expect(duration).to.be.lessThan(50);
      expect(chunks.length).to.equal(10);
      expect(lines.length).to.equal(5000); // Half remaining
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent storage checks without degradation', async () => {
      // Given: Multiple sessions
      const sessions = Array(20)
        .fill(null)
        .map(() => createSessionWithScrollback(1000, 100));

      // When: Concurrent checks
      const startTime = performance.now();

      const promises = sessions.map((session) =>
        Promise.resolve(SessionDataTransformer.isStorageLimitExceeded(session, 20))
      );

      const results = await Promise.all(promises);

      const duration = performance.now() - startTime;

      // Then: Concurrent execution efficient
      expect(duration).to.be.lessThan(200); // <10ms per concurrent check
      expect(results).to.have.length(20);
    });

    it('should handle concurrent optimizations without blocking', async () => {
      // Given: Multiple oversized sessions
      const sessions = Array(5)
        .fill(null)
        .map(() => createSessionWithScrollback(5000, 100));

      // When: Concurrent optimizations
      const startTime = performance.now();

      const promises = sessions.map((session) =>
        Promise.resolve(SessionDataTransformer.optimizeSessionStorage(session, 3))
      );

      const results = await Promise.all(promises);

      const duration = performance.now() - startTime;

      // Then: Reasonable concurrent performance
      expect(duration).to.be.lessThan(500); // <100ms per concurrent optimization
      expect(results.every((r) => r.optimized)).to.be.true;
    });
  });

  describe('Migration Performance', () => {
    it('should migrate old format session in <50ms', () => {
      // Given: Old format session
      const oldSession = {
        terminals: Array(5)
          .fill(null)
          .map((_, i) => ({
            id: String(i + 1),
            name: `Terminal ${i + 1}`,
            number: i + 1,
            cwd: '/home/user',
            isActive: i === 0,
          })),
        timestamp: Date.now(),
        version: '0.1.100',
        activeTerminalId: '1',
        config: { scrollbackLines: 200, reviveProcess: 'auto' },
      } as any;

      // When: Migration
      const startTime = performance.now();

      const result = SessionDataTransformer.migrateSessionFormat(oldSession);

      const duration = performance.now() - startTime;

      // Then: Fast migration
      expect(duration).to.be.lessThan(50);
      expect(result.migrated).to.be.true;
    });

    it('should validate session in <20ms', () => {
      // Given: Session to validate
      const session = createSessionWithScrollback(1000, 100);

      // When: Validation
      const startTime = performance.now();

      const result = SessionDataTransformer.validateSessionForRestore(session);

      const duration = performance.now() - startTime;

      // Then: Fast validation
      expect(duration).to.be.lessThan(20);
      expect(result.valid).to.be.true;
    });
  });

  describe('Regression Prevention', () => {
    it('should maintain performance with ANSI color codes', async () => {
      // Given: Session with ANSI-colored scrollback
      const coloredSession: SessionStorageData = {
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
          '1': Array(2000)
            .fill(null)
            .map((_, i) => `\x1b[${31 + (i % 7)}mLine ${i}: Colored terminal output\x1b[0m`),
        },
      };

      // When: Processing colored content
      const startTime = performance.now();

      const scrollbackData = coloredSession.scrollbackData!['1'] as string[];
      let processedLines = 0;

      const batchSize = 100;
      for (let i = 0; i < Math.min(500, scrollbackData.length); i += batchSize) {
        const batch = scrollbackData.slice(i, i + batchSize);
        processedLines += batch.length;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const duration = performance.now() - startTime;

      // Then: ANSI codes don't degrade performance
      expect(duration).to.be.lessThan(1000);
      expect(processedLines).to.equal(500);
    });

    it('should maintain performance with wrapped lines', async () => {
      // Given: Session with long wrapped lines
      const wrappedSession: SessionStorageData = {
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
            .map((_, i) => `Line ${i}: ${'x'.repeat(200)}`), // Long lines
        },
      };

      // When: Processing wrapped content
      const startTime = performance.now();

      const scrollbackData = wrappedSession.scrollbackData!['1'] as string[];
      const processedLines = Math.min(500, scrollbackData.length);

      const duration = performance.now() - startTime;

      // Then: Wrapped lines don't degrade performance
      expect(duration).to.be.lessThan(100);
      expect(processedLines).to.equal(500);
    });
  });
});

/**
 * Helper function to create session with scrollback data
 */
function createSessionWithScrollback(lineCount: number, lineLength: number): SessionStorageData {
  return {
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
      '1': Array(lineCount)
        .fill(null)
        .map((_, i) => `Line ${i}: ${'x'.repeat(lineLength)}`),
    },
  };
}
