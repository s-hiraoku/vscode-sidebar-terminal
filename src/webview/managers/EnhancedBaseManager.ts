/**
 * 強化された基底マネージャークラス
 * - 一貫した命名規則とエラーハンドリング
 * - 型安全性とパフォーマンス最適化
 * - 包括的なテスト可能性
 */

import { LoggerFunction } from '../utils/TypedMessageHandling';

// =============================================================================
// インターフェースと型定義 - 明確で理解しやすい命名
// =============================================================================

export interface ManagerInitializationOptions {
  readonly enableLogging: boolean;
  readonly enablePerformanceTracking: boolean;
  readonly enableErrorRecovery: boolean;
  readonly initializationTimeoutMs: number;
  readonly customLogger?: LoggerFunction;
}

export interface ManagerPerformanceMetrics {
  readonly initializationTimeMs: number;
  readonly operationCount: number;
  readonly averageOperationTimeMs: number;
  readonly errorCount: number;
  readonly lastOperationTimestamp: number;
}

export interface ManagerHealthStatus {
  readonly managerName: string;
  readonly isHealthy: boolean;
  readonly isInitialized: boolean;
  readonly isDisposed: boolean;
  readonly upTimeMs: number;
  readonly performanceMetrics: ManagerPerformanceMetrics;
  readonly lastError?: Error;
}

export interface ResourceCleanupResult {
  readonly success: boolean;
  readonly cleanedResourceCount: number;
  readonly errors: string[];
  readonly cleanupTimeMs: number;
}

// =============================================================================
// ErrorHandlingUtility - 一元化されたエラー処理
// =============================================================================

export class ManagerErrorHandler {
  private errorCount = 0;
  private lastError?: Error;

  constructor(
    private readonly managerName: string,
    private readonly logger: LoggerFunction,
    private readonly enableRecovery: boolean = true
  ) {}

  public async executeWithErrorHandling<TResult>(
    operation: () => Promise<TResult>,
    operationName: string,
    fallbackValue?: TResult
  ): Promise<TResult | null> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const executionTime = performance.now() - startTime;

      this.logger(`✅ ${operationName} completed successfully (${executionTime.toFixed(2)}ms)`);
      return result;

    } catch (error) {
      this.errorCount++;
      const processedError = error instanceof Error ? error : new Error(String(error));
      this.lastError = processedError;

      const executionTime = performance.now() - startTime;
      this.logger(
        `❌ ${operationName} failed after ${executionTime.toFixed(2)}ms:`,
        processedError.message
      );

      if (this.enableRecovery && fallbackValue !== undefined) {
        this.logger(`🔄 Using fallback value for ${operationName}`);
        return fallbackValue;
      }

      return null;
    }
  }

  public getErrorCount(): number {
    return this.errorCount;
  }

  public getLastError(): Error | undefined {
    return this.lastError;
  }

  public resetErrorCount(): void {
    this.errorCount = 0;
    this.lastError = undefined;
  }
}

// =============================================================================
// PerformanceTracker - パフォーマンス監視
// =============================================================================

export class ManagerPerformanceTracker {
  private operationCount = 0;
  private totalOperationTime = 0;
  private lastOperationTimestamp = 0;
  private initializationTime = 0;

  public recordInitialization(timeMs: number): void {
    this.initializationTime = timeMs;
  }

  public recordOperation(operationTimeMs: number): void {
    this.operationCount++;
    this.totalOperationTime += operationTimeMs;
    this.lastOperationTimestamp = Date.now();
  }

  public getMetrics(): ManagerPerformanceMetrics {
    return {
      initializationTimeMs: this.initializationTime,
      operationCount: this.operationCount,
      averageOperationTimeMs: this.operationCount > 0
        ? this.totalOperationTime / this.operationCount
        : 0,
      errorCount: 0, // Will be provided by ErrorHandler
      lastOperationTimestamp: this.lastOperationTimestamp
    };
  }

  public reset(): void {
    this.operationCount = 0;
    this.totalOperationTime = 0;
    this.lastOperationTimestamp = 0;
  }
}

// =============================================================================
// ResourceManager - リソース管理の抽象化
// =============================================================================

export abstract class ResourceManager {
  private readonly resources = new Set<() => void>();

  protected registerResourceCleanup(cleanupFunction: () => void): void {
    this.resources.add(cleanupFunction);
  }

  protected unregisterResourceCleanup(cleanupFunction: () => void): void {
    this.resources.delete(cleanupFunction);
  }

  public cleanupAllResources(): ResourceCleanupResult {
    const startTime = performance.now();
    const errors: string[] = [];
    let cleanedResourceCount = 0;

    for (const cleanup of this.resources) {
      try {
        cleanup();
        cleanedResourceCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Resource cleanup failed: ${errorMessage}`);
      }
    }

    this.resources.clear();

    return {
      success: errors.length === 0,
      cleanedResourceCount,
      errors,
      cleanupTimeMs: performance.now() - startTime
    };
  }
}

// =============================================================================
// EnhancedBaseManager - 強化された基底クラス
// =============================================================================

export abstract class EnhancedBaseManager extends ResourceManager {
  private isInitialized = false;
  private isDisposed = false;
  private initializationStartTime = 0;
  private readonly logger: LoggerFunction;
  private readonly errorHandler: ManagerErrorHandler;
  private readonly performanceTracker: ManagerPerformanceTracker;

  constructor(
    protected readonly managerName: string,
    private readonly options: ManagerInitializationOptions = {
      enableLogging: true,
      enablePerformanceTracking: true,
      enableErrorRecovery: true,
      initializationTimeoutMs: 5000
    }
  ) {
    super();

    this.logger = options.customLogger ?? this.createDefaultLogger();
    this.errorHandler = new ManagerErrorHandler(
      managerName,
      this.logger,
      options.enableErrorRecovery
    );
    this.performanceTracker = new ManagerPerformanceTracker();

    this.logger(`🏗️ Manager instance created: ${managerName}`);
  }

  // =============================================================================
  // 抽象メソッド - 子クラスで実装必須
  // =============================================================================

  protected abstract doInitializeManager(): Promise<void> | void;
  protected abstract doDisposeManager(): Promise<void> | void;

  // =============================================================================
  // 公開メソッド - 標準化されたライフサイクル管理
  // =============================================================================

  public async initializeManager(): Promise<void> {
    if (this.isInitialized) {
      this.logger('⚠️ Manager already initialized, skipping');
      return;
    }

    if (this.isDisposed) {
      throw new Error(`Cannot initialize disposed manager: ${this.managerName}`);
    }

    this.initializationStartTime = performance.now();

    try {
      this.logger(`🚀 Initializing manager: ${this.managerName}`);

      // タイムアウト付きの初期化
      await this.executeWithTimeout(
        () => this.doInitializeManager(),
        this.options.initializationTimeoutMs,
        `${this.managerName} initialization`
      );

      const initTime = performance.now() - this.initializationStartTime;
      this.performanceTracker.recordInitialization(initTime);

      this.isInitialized = true;
      this.logger(`✅ Manager initialized successfully: ${this.managerName} (${initTime.toFixed(2)}ms)`);

    } catch (error) {
      const initTime = performance.now() - this.initializationStartTime;
      this.logger(`❌ Manager initialization failed: ${this.managerName} (${initTime.toFixed(2)}ms)`);
      throw error;
    }
  }

  public async disposeManager(): Promise<void> {
    if (this.isDisposed) {
      this.logger('⚠️ Manager already disposed, skipping');
      return;
    }

    try {
      this.logger(`🧹 Disposing manager: ${this.managerName}`);

      // カスタムクリーンアップ実行
      await this.doDisposeManager();

      // リソースクリーンアップ
      const cleanupResult = this.cleanupAllResources();

      if (!cleanupResult.success) {
        this.logger('⚠️ Some resources failed to cleanup:', cleanupResult.errors);
      }

      this.isInitialized = false;
      this.isDisposed = true;

      this.logger(
        `✅ Manager disposed successfully: ${this.managerName} ` +
        `(${cleanupResult.cleanedResourceCount} resources cleaned)`
      );

    } catch (error) {
      this.logger(`❌ Manager disposal failed: ${this.managerName}`, error);
      throw error;
    }
  }

  public getHealthStatus(): ManagerHealthStatus {
    const metrics = this.performanceTracker.getMetrics();

    return {
      managerName: this.managerName,
      isHealthy: this.isInitialized && !this.isDisposed && this.errorHandler.getErrorCount() < 10,
      isInitialized: this.isInitialized,
      isDisposed: this.isDisposed,
      upTimeMs: this.isInitialized ? Date.now() - this.initializationStartTime : 0,
      performanceMetrics: {
        ...metrics,
        errorCount: this.errorHandler.getErrorCount()
      },
      lastError: this.errorHandler.getLastError()
    };
  }

  // =============================================================================
  // 保護されたヘルパーメソッド - 子クラスで利用可能
  // =============================================================================

  protected async executeOperationSafely<TResult>(
    operation: () => Promise<TResult>,
    operationName: string,
    fallbackValue?: TResult
  ): Promise<TResult | null> {
    this.ensureManagerReady();

    const startTime = performance.now();
    const result = await this.errorHandler.executeWithErrorHandling(
      operation,
      operationName,
      fallbackValue
    );

    if (this.options.enablePerformanceTracking) {
      this.performanceTracker.recordOperation(performance.now() - startTime);
    }

    return result;
  }

  protected ensureManagerReady(): void {
    if (!this.isInitialized) {
      throw new Error(`Manager not initialized: ${this.managerName}`);
    }

    if (this.isDisposed) {
      throw new Error(`Manager is disposed: ${this.managerName}`);
    }
  }

  protected logInfo(message: string, ...args: unknown[]): void {
    this.logger(`ℹ️ ${message}`, ...args);
  }

  protected logWarning(message: string, ...args: unknown[]): void {
    this.logger(`⚠️ ${message}`, ...args);
  }

  protected logError(message: string, ...args: unknown[]): void {
    this.logger(`❌ ${message}`, ...args);
  }

  protected logDebug(message: string, ...args: unknown[]): void {
    if (this.options.enableLogging) {
      this.logger(`🐛 ${message}`, ...args);
    }
  }

  // =============================================================================
  // プライベートヘルパーメソッド
  // =============================================================================

  private createDefaultLogger(): LoggerFunction {
    const prefix = `[${this.managerName.toUpperCase()}]`;
    return (message: string, ...args: unknown[]) => {
      if (this.options.enableLogging) {
        console.log(prefix, message, ...args);
      }
    };
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T> | T,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}

// =============================================================================
// ManagerFactory - 標準化されたマネージャー作成
// =============================================================================

export class ManagerFactory {
  public static createManager<T extends EnhancedBaseManager>(
    ManagerClass: new (...args: unknown[]) => T,
    options: ManagerInitializationOptions,
    ...constructorArgs: unknown[]
  ): T {
    return new ManagerClass(...constructorArgs, options);
  }

  public static async createAndInitializeManager<T extends EnhancedBaseManager>(
    ManagerClass: new (...args: unknown[]) => T,
    options: ManagerInitializationOptions,
    ...constructorArgs: unknown[]
  ): Promise<T> {
    const manager = this.createManager(ManagerClass, options, ...constructorArgs);
    await manager.initializeManager();
    return manager;
  }
}