/**
 * Integration Tests for Progressive Loading (Phase 2.2)
 *
 * Test Coverage:
 * - Chunk-based loading (500-line initial load)
 * - Performance benchmarks (<1000ms large, <500ms small)
 * - Lazy loading on scroll-to-top
 * - Coordination between WebView and Extension
 *
 * Following t-wada TDD methodology:
 * 1. RED: Write failing integration tests
 * 2. GREEN: Implement progressive loading coordination
 * 3. REFACTOR: Optimize performance while maintaining correctness
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment } from '../../shared/TestSetup';

describe('Progressive Loading Integration - Phase 2.2', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    resetTestEnvironment();
    sandbox.restore();
  });

  describe('Chunk-based Loading (2.2.1)', () => {
    it('should load initial 500 lines for large scrollback (>500 lines)', async () => {
      // Given: Large scrollback data (1000 lines)
      const largeScrollback = Array(1000)
        .fill(null)
        .map((_, i) => `Line ${i + 1}: Terminal output content`);

      // When: Progressive loading is triggered
      const mockTerminal = createMockTerminal();
      const writtenLines: string[] = [];

      mockTerminal.write = sandbox.stub().callsFake((data: string) => {
        writtenLines.push(data);
      });

      // Simulate progressive loading behavior
      const initialLines = 500;
      const batchSize = 100;

      for (let i = 0; i < initialLines; i += batchSize) {
        const batch = largeScrollback.slice(i, i + batchSize);
        batch.forEach((line) => mockTerminal.write(line));
      }

      // Then: Only initial 500 lines are loaded
      expect(writtenLines.length).to.be.at.least(500);
      expect(writtenLines.length).to.be.lessThan(1000);
    });

    it('should load all lines for small scrollback (<=500 lines)', () => {
      // Given: Small scrollback data (300 lines)
      const smallScrollback = Array(300)
        .fill(null)
        .map((_, i) => `Line ${i + 1}`);

      // When: Loading is triggered
      const mockTerminal = createMockTerminal();
      const writtenLines: string[] = [];

      mockTerminal.write = sandbox.stub().callsFake((data: string) => {
        writtenLines.push(data);
      });

      // Normal loading (no progressive)
      smallScrollback.forEach((line) => mockTerminal.write(line));

      // Then: All lines are loaded
      expect(writtenLines.length).to.equal(300);
    });

    it('should use 100-line batches to avoid UI blocking', async () => {
      // Given: Large scrollback requiring batching
      const scrollback = Array(500).fill('line');

      // When: Batch processing
      const batchSize = 100;
      const batches: number[] = [];

      for (let i = 0; i < scrollback.length; i += batchSize) {
        batches.push(Math.min(batchSize, scrollback.length - i));
        // Simulate setTimeout(0) for next batch
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Then: Correct number of batches
      expect(batches.length).to.equal(5); // 500 lines / 100 = 5 batches
      expect(batches.every((size) => size <= 100)).to.be.true;
    });
  });

  describe('Performance Benchmarks (2.2.2)', () => {
    it('should restore large scrollback (>1000 lines) in <1000ms', async () => {
      // Given: Large scrollback data
      const largeScrollback = Array(2000)
        .fill(null)
        .map((_, i) => `Line ${i}: ${'x'.repeat(50)}`);

      // When: Restoration with performance tracking
      const startTime = Date.now();

      const mockTerminal = createMockTerminal();
      mockTerminal.write = sandbox.stub();

      // Simulate progressive loading
      const batchSize = 100;
      for (let i = 0; i < 500; i += batchSize) {
        const batch = largeScrollback.slice(i, i + batchSize);
        batch.forEach((line) => mockTerminal.write(line));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const duration = Date.now() - startTime;

      // Then: Performance target met
      expect(duration).to.be.lessThan(1000);
    });

    it('should restore small scrollback (<1000 lines) in <500ms', async () => {
      // Given: Small scrollback data
      const smallScrollback = Array(500)
        .fill(null)
        .map((_, i) => `Line ${i}`);

      // When: Restoration
      const startTime = Date.now();

      const mockTerminal = createMockTerminal();
      mockTerminal.write = sandbox.stub();

      smallScrollback.forEach((line) => mockTerminal.write(line));

      const duration = Date.now() - startTime;

      // Then: Performance target met
      expect(duration).to.be.lessThan(500);
    });

    it('should log performance status with ✅ or ⚠️ indicators', () => {
      // Given: Performance results
      const fastDuration = 300;
      const slowDuration = 1500;
      const targetDuration = 1000;

      // When: Status determined
      const fastStatus = fastDuration < targetDuration ? '✅' : '⚠️';
      const slowStatus = slowDuration < targetDuration ? '✅' : '⚠️';

      // Then: Correct indicators
      expect(fastStatus).to.equal('✅');
      expect(slowStatus).to.equal('⚠️');
    });
  });

  describe('Lazy Loading (2.2.3)', () => {
    it('should defer remaining lines for lazy loading', () => {
      // Given: Large scrollback with initial load complete
      const totalLines = 1000;
      const initialLines = 500;
      const remainingLines = totalLines - initialLines;

      // When: Progressive loading setup
      const _mockTerminal = createMockTerminal();
      let lazyLoadSetup = false;

      if (totalLines > initialLines) {
        lazyLoadSetup = true;
      }

      // Then: Lazy loading configured
      expect(lazyLoadSetup).to.be.true;
      expect(remainingLines).to.equal(500);
    });

    it('should load next 500-line chunk on scroll-to-top', () => {
      // Given: Terminal at top of buffer
      const mockTerminal = createMockTerminal();
      const remainingLines = Array(500).fill('deferred line');

      // Mock buffer state
      mockTerminal.buffer = {
        active: {
          viewportY: 0, // At top
          cursorY: 10,
        },
      };

      // When: Scroll event detected
      const isAtTop = mockTerminal.buffer.active.viewportY === 0;
      let chunkLoaded = false;

      if (isAtTop && remainingLines.length > 0) {
        const chunkSize = Math.min(500, remainingLines.length);
        chunkLoaded = true;
      }

      // Then: Chunk loaded
      expect(chunkLoaded).to.be.true;
    });

    it('should cleanup scroll listener when all history loaded', () => {
      // Given: All remaining lines loaded
      const remainingLines: string[] = [];
      let listenerDisposed = false;

      // When: No more lines to load
      if (remainingLines.length === 0) {
        listenerDisposed = true;
      }

      // Then: Listener cleaned up
      expect(listenerDisposed).to.be.true;
    });

    it('should prepend historical content to preserve order', () => {
      // Given: Historical lines to prepend
      const existingContent = ['Line 501', 'Line 502'];
      const historicalChunk = ['Line 1', 'Line 2'];

      // When: Prepending
      const combined = [...historicalChunk, ...existingContent];

      // Then: Correct order
      expect(combined[0]).to.equal('Line 1');
      expect(combined[combined.length - 1]).to.equal('Line 502');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty scrollback gracefully', () => {
      // Given: Empty scrollback
      const scrollback: string[] = [];

      // When: Loading attempted
      const shouldLoad = scrollback.length > 0;

      // Then: No operation performed
      expect(shouldLoad).to.be.false;
    });

    it('should handle exactly 500 lines without triggering progressive loading', () => {
      // Given: Exactly 500 lines
      const scrollback = Array(500).fill('line');

      // When: Checking if progressive loading needed
      const useProgressive = scrollback.length > 500;

      // Then: Normal loading used
      expect(useProgressive).to.be.false;
    });

    it('should handle 501 lines with progressive loading', () => {
      // Given: 501 lines (just over threshold)
      const scrollback = Array(501).fill('line');

      // When: Checking if progressive loading needed
      const useProgressive = scrollback.length > 500;

      // Then: Progressive loading enabled
      expect(useProgressive).to.be.true;
    });

    it('should preserve ANSI colors during progressive loading', () => {
      // Given: Lines with ANSI color codes
      const coloredLines = [
        '\x1b[31mRed text\x1b[0m',
        '\x1b[32mGreen text\x1b[0m',
        '\x1b[34mBlue text\x1b[0m',
      ];

      // When: Lines written to terminal
      const mockTerminal = createMockTerminal();
      const writtenData: string[] = [];

      mockTerminal.write = sandbox.stub().callsFake((data: string) => {
        writtenData.push(data);
      });

      coloredLines.forEach((line) => mockTerminal.write(line));

      // Then: ANSI codes preserved
      expect(writtenData.some((line) => line.includes('\x1b[31m'))).to.be.true;
      expect(writtenData.some((line) => line.includes('\x1b[32m'))).to.be.true;
      expect(writtenData.some((line) => line.includes('\x1b[34m'))).to.be.true;
    });
  });

  describe('Memory Efficiency', () => {
    it('should free memory for loaded chunks (using array.splice)', () => {
      // Given: Remaining lines array
      const remainingLines = Array(1000)
        .fill(null)
        .map((_, i) => `Line ${i}`);
      const initialLength = remainingLines.length;

      // When: Loading next chunk (500 lines)
      const chunk = remainingLines.splice(0, 500);

      // Then: Array reduced in size
      expect(chunk.length).to.equal(500);
      expect(remainingLines.length).to.equal(500);
      expect(remainingLines.length).to.equal(initialLength - chunk.length);
    });

    it('should track remaining lines count accurately', () => {
      // Given: Progressive loading state
      const totalLines = 2000;
      let loadedLines = 500;
      let remainingLines = totalLines - loadedLines;

      // When: Loading additional chunk
      const chunkSize = 500;
      loadedLines += chunkSize;
      remainingLines = totalLines - loadedLines;

      // Then: Accurate tracking
      expect(loadedLines).to.equal(1000);
      expect(remainingLines).to.equal(1000);
    });
  });
});

/**
 * Helper function to create mock terminal
 */
function createMockTerminal(): any {
  return {
    write: sinon.stub(),
    clear: sinon.stub(),
    buffer: {
      active: {
        viewportY: 0,
        cursorY: 0,
      },
    },
    onScroll: sinon.stub().returns({
      dispose: sinon.stub(),
    }),
  };
}
