/** Unified error handling system for consistent error processing. */

import * as vscode from 'vscode';
import { log } from './logger';

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  TERMINAL = 'terminal',
  SESSION = 'session',
  CONFIGURATION = 'config',
  WEBVIEW = 'webview',
  COMMUNICATION = 'communication',
  RESOURCE = 'resource',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  component: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ErrorReport {
  message: string;
  context: ErrorContext;
  error?: Error;
  stack?: string;
  recoverable: boolean;
}

export abstract class BaseError extends Error {
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;

  constructor(message: string, context: Partial<ErrorContext>, recoverable = true) {
    super(message);
    this.name = this.constructor.name;
    this.context = {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.ERROR,
      component: 'Unknown',
      timestamp: Date.now(),
      ...context,
    };
    this.recoverable = recoverable;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toReport(): ErrorReport {
    return {
      message: this.message,
      context: this.context,
      error: this,
      stack: this.stack,
      recoverable: this.recoverable,
    };
  }
}

export class TerminalError extends BaseError {
  constructor(message: string, component: string, operation?: string, recoverable = true) {
    super(
      message,
      {
        category: ErrorCategory.TERMINAL,
        severity: ErrorSeverity.ERROR,
        component,
        operation,
      },
      recoverable
    );
  }
}

export class SessionError extends BaseError {
  constructor(message: string, component: string, operation?: string, recoverable = true) {
    super(
      message,
      {
        category: ErrorCategory.SESSION,
        severity: ErrorSeverity.ERROR,
        component,
        operation,
      },
      recoverable
    );
  }
}

export class ConfigurationError extends BaseError {
  constructor(message: string, component: string, operation?: string) {
    super(
      message,
      {
        category: ErrorCategory.CONFIGURATION,
        severity: ErrorSeverity.WARNING,
        component,
        operation,
      },
      true
    );
  }
}

export class CommunicationError extends BaseError {
  constructor(message: string, component: string, operation?: string, recoverable = false) {
    super(
      message,
      {
        category: ErrorCategory.COMMUNICATION,
        severity: ErrorSeverity.ERROR,
        component,
        operation,
      },
      recoverable
    );
  }
}

export class ResourceError extends BaseError {
  constructor(message: string, component: string, operation?: string) {
    super(
      message,
      {
        category: ErrorCategory.RESOURCE,
        severity: ErrorSeverity.CRITICAL,
        component,
        operation,
      },
      false
    );
  }
}

export class ErrorHandlingManager {
  private static instance: ErrorHandlingManager;
  private errorLog: ErrorReport[] = [];
  private readonly maxLogSize = 1000;
  private errorHandlers = new Map<ErrorCategory, Set<ErrorHandler>>();
  private globalHandlers = new Set<ErrorHandler>();

  private constructor() {}

  public static getInstance(): ErrorHandlingManager {
    if (!ErrorHandlingManager.instance) {
      ErrorHandlingManager.instance = new ErrorHandlingManager();
    }
    return ErrorHandlingManager.instance;
  }

  public handleError(error: unknown, context?: Partial<ErrorContext>): ErrorReport {
    const report = this.createErrorReport(error, context);
    this.logError(report);
    this.notifyHandlers(report);
    this.showUserNotification(report);

    return report;
  }

  public async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>,
    fallback?: T
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const report = this.handleError(error, context);

      if (report.recoverable && fallback !== undefined) {
        log(`🔄 Recovering with fallback value for ${context.operation}`);
        return fallback;
      }

      return null;
    }
  }

  private createErrorReport(error: unknown, context?: Partial<ErrorContext>): ErrorReport {
    if (error instanceof BaseError) {
      return error.toReport();
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    return {
      message: errorMessage,
      context: {
        category: context?.category || ErrorCategory.UNKNOWN,
        severity: context?.severity || ErrorSeverity.ERROR,
        component: context?.component || 'Unknown',
        operation: context?.operation,
        metadata: context?.metadata,
        timestamp: Date.now(),
      },
      error: error instanceof Error ? error : undefined,
      stack: errorStack,
      recoverable: context?.severity !== ErrorSeverity.CRITICAL,
    };
  }

  private logError(report: ErrorReport): void {
    this.errorLog.push(report);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    const prefix = `[${report.context.category.toUpperCase()}]`;
    switch (report.context.severity) {
      case ErrorSeverity.INFO:
        console.info(prefix, report.message);
        break;
      case ErrorSeverity.WARNING:
        console.warn(prefix, report.message);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        console.error(prefix, report.message, report.stack || '');
        break;
    }
  }

  private notifyHandlers(report: ErrorReport): void {
    const categoryHandlers = this.errorHandlers.get(report.context.category);
    categoryHandlers?.forEach((handler) => handler(report));
    this.globalHandlers.forEach((handler) => handler(report));
  }

  private showUserNotification(report: ErrorReport): void {
    const { message, context } = report;

    switch (context.severity) {
      case ErrorSeverity.INFO:
        vscode.window.showInformationMessage(message);
        break;
      case ErrorSeverity.WARNING:
        vscode.window.showWarningMessage(message);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        vscode.window.showErrorMessage(message);
        break;
    }
  }

  public registerErrorHandler(handler: ErrorHandler, category?: ErrorCategory): void {
    if (category) {
      if (!this.errorHandlers.has(category)) {
        this.errorHandlers.set(category, new Set());
      }
      this.errorHandlers.get(category)!.add(handler);
    } else {
      this.globalHandlers.add(handler);
    }
  }

  public unregisterErrorHandler(handler: ErrorHandler, category?: ErrorCategory): void {
    if (category) {
      this.errorHandlers.get(category)?.delete(handler);
    } else {
      this.globalHandlers.delete(handler);
    }
  }

  public getErrorLog(category?: ErrorCategory, limit = 100): ErrorReport[] {
    let log = this.errorLog;

    if (category) {
      log = log.filter((report) => report.context.category === category);
    }

    return log.slice(-limit);
  }

  public getErrorStatistics(): ErrorStatistics {
    const stats: ErrorStatistics = {
      total: this.errorLog.length,
      byCategory: {},
      bySeverity: {},
      recoverable: 0,
      unrecoverable: 0,
    };

    this.errorLog.forEach((report) => {
      stats.byCategory[report.context.category] = (stats.byCategory[report.context.category] || 0) + 1;
      stats.bySeverity[report.context.severity] = (stats.bySeverity[report.context.severity] || 0) + 1;
      report.recoverable ? stats.recoverable++ : stats.unrecoverable++;
    });

    return stats;
  }

  public clearErrorLog(): void {
    this.errorLog = [];
  }
}

export type ErrorHandler = (report: ErrorReport) => void;

export interface ErrorStatistics {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  recoverable: number;
  unrecoverable: number;
}

export function errorToString(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getStackTrace(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}

export function isRecoverableError(error: unknown): boolean {
  return error instanceof BaseError ? error.recoverable : false;
}

export function withErrorHandling(category: ErrorCategory, component: string, recoverable = true) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const manager = ErrorHandlingManager.getInstance();
      return manager.executeWithErrorHandling(() => originalMethod.apply(this, args), {
        category,
        component,
        operation: propertyKey,
        severity: recoverable ? ErrorSeverity.ERROR : ErrorSeverity.CRITICAL,
      });
    };

    return descriptor;
  };
}

export const errorManager = ErrorHandlingManager.getInstance();
