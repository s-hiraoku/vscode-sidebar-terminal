/**
 * Performance Optimization Utilities
 * Phase 3: System performance improvements
 */

import { log } from './logger';

/**
 * Debounce function for reducing frequent function calls
 */
export class Debouncer {
  private timeoutId: number | null = null;

  constructor(
    private func: (...args: any[]) => void | Promise<void>,
    private delay: number
  ) {}

  public execute(...args: any[]): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(async () => {
      try {
        await this.func(...args);
      } catch (error) {
        console.error('Debounced function execution failed:', error);
      }
      this.timeoutId = null;
    }, this.delay) as unknown as number;
  }

  public cancel(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public isScheduled(): boolean {
    return this.timeoutId !== null;
  }
}

/**
 * Batch DOM operations for better performance
 */
export class DOMBatcher {
  private operations: (() => void)[] = [];
  private scheduled = false;

  public add(operation: () => void): void {
    this.operations.push(operation);

    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  private flush(): void {
    const operations = [...this.operations];
    this.operations = [];
    this.scheduled = false;

    // Execute all operations in a single frame
    operations.forEach((operation) => {
      try {
        operation();
      } catch (error) {
        console.error('DOM batch operation failed:', error);
      }
    });
  }

  public clear(): void {
    this.operations = [];
    this.scheduled = false;
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, { start: number; duration?: number }> = new Map();

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public startTimer(name: string): void {
    this.metrics.set(name, { start: performance.now() });
  }

  public endTimer(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Timer "${name}" was not started`);
      return null;
    }

    const duration = performance.now() - metric.start;
    metric.duration = duration;

    log(`⏱️ [PERFORMANCE] ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  public getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((metric, name) => {
      if (metric.duration !== undefined) {
        result[name] = metric.duration;
      }
    });
    return result;
  }

  public clearMetrics(): void {
    this.metrics.clear();
  }
}

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
  public static getMemoryUsage(): {
    used: number;
    total: number;
    percentage: number;
  } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100),
      };
    }
    return null;
  }

  public static logMemoryUsage(context: string): void {
    const usage = this.getMemoryUsage();
    if (usage) {
      log(`🧠 [MEMORY] ${context}: ${usage.used}MB/${usage.total}MB (${usage.percentage}%)`);
    }
  }
}
