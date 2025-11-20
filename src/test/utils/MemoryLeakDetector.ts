/**
 * Memory Leak Detection Utilities
 *
 * Provides tools to detect and prevent memory leaks in VS Code extensions
 * following the patterns described in issue #232.
 *
 * Usage:
 * ```typescript
 * import { MemoryLeakDetector } from './utils/MemoryLeakDetector';
 *
 * describe('MyClass', () => {
 *   it('should not leak memory', async () => {
 *     const detector = new MemoryLeakDetector();
 *     await detector.startMonitoring();
 *
 *     // Create and dispose instances
 *     for (let i = 0; i < 100; i++) {
 *       const instance = new MyClass();
 *       instance.dispose();
 *     }
 *
 *     const result = await detector.checkForLeaks();
 *     expect(result.hasLeak).to.be.false;
 *   });
 * });
 * ```
 */

export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

export interface LeakDetectionResult {
  hasLeak: boolean;
  heapGrowth: number;
  heapGrowthPercent: number;
  snapshots: MemorySnapshot[];
  warnings: string[];
}

export class MemoryLeakDetector {
  private snapshots: MemorySnapshot[] = [];
  private readonly WARNING_THRESHOLD_PERCENT = 10; // Warn if heap grows by more than 10%
  private readonly LEAK_THRESHOLD_PERCENT = 50; // Consider it a leak if heap grows by more than 50%

  /**
   * Take a memory snapshot
   */
  public takeSnapshot(): MemorySnapshot {
    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      global.gc();
    }

    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now()
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Start monitoring memory usage
   */
  public async startMonitoring(): Promise<void> {
    // Clear any previous snapshots
    this.snapshots = [];

    // Take initial snapshot
    this.takeSnapshot();

    // Wait a bit for things to stabilize
    await this.sleep(100);
  }

  /**
   * Check for memory leaks by comparing snapshots
   */
  public async checkForLeaks(): Promise<LeakDetectionResult> {
    // Wait for GC to run
    await this.sleep(100);

    // Take final snapshot
    const finalSnapshot = this.takeSnapshot();
    const initialSnapshot = this.snapshots[0];

    if (!initialSnapshot) {
      throw new Error('No initial snapshot found. Call startMonitoring() first.');
    }

    // Calculate heap growth
    const heapGrowth = finalSnapshot.heapUsed - initialSnapshot.heapUsed;
    const heapGrowthPercent = (heapGrowth / initialSnapshot.heapUsed) * 100;

    const warnings: string[] = [];

    // Check for significant heap growth
    if (heapGrowthPercent > this.WARNING_THRESHOLD_PERCENT) {
      warnings.push(
        `Heap grew by ${(heapGrowth / 1024 / 1024).toFixed(2)} MB (${heapGrowthPercent.toFixed(1)}%)`
      );
    }

    // Check for external memory growth (native resources)
    const externalGrowth = finalSnapshot.external - initialSnapshot.external;
    if (externalGrowth > 5 * 1024 * 1024) { // 5MB threshold
      warnings.push(
        `External memory grew by ${(externalGrowth / 1024 / 1024).toFixed(2)} MB`
      );
    }

    const hasLeak = heapGrowthPercent > this.LEAK_THRESHOLD_PERCENT;

    return {
      hasLeak,
      heapGrowth,
      heapGrowthPercent,
      snapshots: this.snapshots,
      warnings
    };
  }

  /**
   * Format memory size in human-readable format
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate a detailed memory report
   */
  public generateReport(): string {
    if (this.snapshots.length < 2) {
      return 'Insufficient data for memory report';
    }

    const initial = this.snapshots[0];
    const final = this.snapshots[this.snapshots.length - 1];

    if (!initial || !final) {
      return 'No memory snapshots available';
    }

    const report = [
      '=== Memory Leak Detection Report ===',
      '',
      'Initial Memory:',
      `  Heap Used: ${MemoryLeakDetector.formatBytes(initial.heapUsed)}`,
      `  Heap Total: ${MemoryLeakDetector.formatBytes(initial.heapTotal)}`,
      `  External: ${MemoryLeakDetector.formatBytes(initial.external)}`,
      '',
      'Final Memory:',
      `  Heap Used: ${MemoryLeakDetector.formatBytes(final.heapUsed)}`,
      `  Heap Total: ${MemoryLeakDetector.formatBytes(final.heapTotal)}`,
      `  External: ${MemoryLeakDetector.formatBytes(final.external)}`,
      '',
      'Growth:',
      `  Heap: ${MemoryLeakDetector.formatBytes(final.heapUsed - initial.heapUsed)} (${(((final.heapUsed - initial.heapUsed) / initial.heapUsed) * 100).toFixed(1)}%)`,
      `  External: ${MemoryLeakDetector.formatBytes(final.external - initial.external)}`,
      '',
      'Snapshots Taken: ' + this.snapshots.length,
      'Duration: ' + ((final.timestamp - initial.timestamp) / 1000).toFixed(2) + 's',
      ''
    ];

    return report.join('\n');
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the detector state
   */
  public reset(): void {
    this.snapshots = [];
  }
}

/**
 * Helper to detect event listener leaks
 */
export class EventListenerLeakDetector {
  private listenerCounts: Map<string, number> = new Map();

  /**
   * Record the current number of listeners for an event emitter
   */
  public recordListeners(name: string, emitter: any): void {
    if (typeof emitter.listenerCount === 'function') {
      // VS Code EventEmitter
      // Note: VS Code's EventEmitter doesn't expose listener count directly
      // This is a placeholder for future implementation
      this.listenerCounts.set(name, 0);
    } else if (emitter.eventNames && typeof emitter.eventNames === 'function') {
      // Node.js EventEmitter
      const eventNames = emitter.eventNames();
      let totalCount = 0;
      for (const eventName of eventNames) {
        totalCount += emitter.listenerCount(eventName);
      }
      this.listenerCounts.set(name, totalCount);
    }
  }

  /**
   * Check if the number of listeners has increased
   */
  public checkForLeaks(name: string, emitter: any): boolean {
    const previousCount = this.listenerCounts.get(name) || 0;
    let currentCount = 0;

    if (emitter.eventNames && typeof emitter.eventNames === 'function') {
      const eventNames = emitter.eventNames();
      for (const eventName of eventNames) {
        currentCount += emitter.listenerCount(eventName);
      }
    }

    // Update the count
    this.listenerCounts.set(name, currentCount);

    // Consider it a leak if listener count increased significantly
    return currentCount > previousCount * 2;
  }

  /**
   * Get a report of all listener counts
   */
  public getReport(): string {
    const report = ['=== Event Listener Leak Report ===', ''];

    for (const [name, count] of this.listenerCounts.entries()) {
      report.push(`${name}: ${count} listeners`);
    }

    return report.join('\n');
  }
}

/**
 * Helper to stress test disposal patterns
 */
export class DisposalStressTest {
  /**
   * Create and dispose many instances to detect leaks
   */
  public static async stressTest<T extends { dispose: () => void }>(
    factory: () => T,
    iterations: number = 100
  ): Promise<LeakDetectionResult> {
    const detector = new MemoryLeakDetector();
    await detector.startMonitoring();

    // Create and dispose instances
    for (let i = 0; i < iterations; i++) {
      const instance = factory();
      instance.dispose();

      // Periodically force GC
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }

    return await detector.checkForLeaks();
  }
}
