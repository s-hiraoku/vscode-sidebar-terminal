/**
 * パフォーマンス最適化のためのユーティリティクラス
 */

// 型定義
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface IdleCallbackOptions {
  timeout: number;
}

interface RequestIdleCallbackFunction {
  (callback: () => void, options?: IdleCallbackOptions): void;
}

/* eslint-disable @typescript-eslint/no-namespace */
export namespace PerformanceUtils {
  /**
   * 関数の実行を指定時間遅延させる（デバウンス）
   */
  export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: number | null = null;

    return (...args: Parameters<T>) => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        func(...args);
        timeoutId = null;
      }, delay);
    };
  }

  /**
   * 関数の実行頻度を制限する（スロットル）
   */
  export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: number | null = null;

    return (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      } else if (timeoutId === null) {
        timeoutId = window.setTimeout(
          () => {
            lastCall = Date.now();
            func(...args);
            timeoutId = null;
          },
          delay - (now - lastCall)
        );
      }
    };
  }

  /**
   * アイドル時間での実行
   */
  export function requestIdleCallback(callback: () => void, timeout = 5000): void {
    if ('requestIdleCallback' in window) {
      (
        window as unknown as Record<string, unknown> & {
          requestIdleCallback: RequestIdleCallbackFunction;
        }
      ).requestIdleCallback(callback, { timeout });
    } else {
      // フォールバック：setTimeout を使用
      setTimeout(callback, 1);
    }
  }

  /**
   * RAF（requestAnimationFrame）での実行
   */
  export function requestAnimationFrame(callback: () => void): number {
    return window.requestAnimationFrame(callback);
  }

  /**
   * 複数のRAFを連続実行
   */
  export function doubleRequestAnimationFrame(callback: () => void): void {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback);
    });
  }

  /**
   * パフォーマンス測定
   */
  export function measurePerformance<T>(label: string, fn: () => T): T {
    const startTime = performance.now();
    const result = fn();
    const endTime = performance.now();

    console.log(`⚡ [PERFORMANCE] ${label}: ${(endTime - startTime).toFixed(2)}ms`);
    return result;
  }

  /**
   * 非同期関数のパフォーマンス測定
   */
  export async function measurePerformanceAsync<T>(
    label: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    console.log(`⚡ [PERFORMANCE] ${label}: ${(endTime - startTime).toFixed(2)}ms`);
    return result;
  }

  /**
   * メモリ使用量の取得
   */
  export function getMemoryUsage(): Record<string, number> | null {
    const perfWithMemory = performance as Performance & { memory?: MemoryInfo };
    if (perfWithMemory.memory) {
      const memory = perfWithMemory.memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  }

  /**
   * メモリ使用量をログ出力
   */
  export function logMemoryUsage(label: string): void {
    const memory = getMemoryUsage();
    if (memory) {
      console.log(`🧠 [MEMORY] ${label}:`, {
        used: `${((memory.usedJSHeapSize ?? 0) / 1024 / 1024).toFixed(2)}MB`,
        total: `${((memory.totalJSHeapSize ?? 0) / 1024 / 1024).toFixed(2)}MB`,
        limit: `${((memory.jsHeapSizeLimit ?? 0) / 1024 / 1024).toFixed(2)}MB`,
      });
    }
  }

  /**
   * 長い処理を分割して実行
   */
  export async function processInChunks<T>(
    items: T[],
    processor: (item: T) => void,
    chunkSize = 100,
    delay = 0
  ): Promise<void> {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      chunk.forEach(processor);

      // 次のチャンクまで待機
      if (i + chunkSize < items.length && delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * プロミスの並列処理（制限付き）
   */
  export async function processInParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency = 3
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        void executing.splice(
          executing.findIndex((p) => p === promise),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * オブジェクトのディープクローン（パフォーマンス重視）
   */
  export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map((item: unknown) => deepClone(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const cloned = {} as T;
      Object.keys(obj).forEach((key) => {
        (cloned as Record<string, unknown>)[key] = deepClone((obj as Record<string, unknown>)[key]);
      });
      return cloned;
    }

    return obj;
  }

  /**
   * 配列の高速検索（バイナリサーチ）
   */
  export function binarySearch<T>(arr: T[], target: T, compareFn?: (a: T, b: T) => number): number {
    const compare = compareFn || ((a: T, b: T): number => (a < b ? -1 : a > b ? 1 : 0));

    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midValue = arr[mid];
      if (midValue === undefined) {
        return -1;
      }
      const comparison = compare(midValue, target);

      if (comparison === 0) {
        return mid;
      } else if (comparison < 0) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return -1;
  }
}
