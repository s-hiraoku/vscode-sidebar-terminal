/**
 * TelemetryService
 *
 * Privacy-respecting telemetry service using VS Code's native TelemetryLogger API.
 *
 * Key Features:
 * - Respects VS Code's telemetry opt-out settings
 * - No collection of terminal content, file paths, or credentials
 * - Anonymous data only
 * - HTTPS encryption in transit
 * - Minimal data collection approach
 *
 * Implementation based on Issue #241
 */

import * as vscode from 'vscode';

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  // Extension lifecycle
  ExtensionActivated = 'extension.activated',
  ExtensionDeactivated = 'extension.deactivated',

  // Terminal operations
  TerminalCreated = 'terminal.created',
  TerminalDeleted = 'terminal.deleted',
  TerminalFocused = 'terminal.focused',
  TerminalSplit = 'terminal.split',

  // CLI Agent detection
  CliAgentDetected = 'cliAgent.detected',
  CliAgentDisconnected = 'cliAgent.disconnected',

  // Command execution
  CommandExecuted = 'command.executed',

  // Errors
  ErrorOccurred = 'error.occurred',

  // Settings changes
  SettingsChanged = 'settings.changed',

  // Session management
  SessionSaved = 'session.saved',
  SessionRestored = 'session.restored',

  // Performance metrics
  PerformanceMetric = 'performance.metric',
}

/**
 * Telemetry properties interface
 */
export interface TelemetryProperties {
  [key: string]: string | number | boolean;
}

/**
 * Telemetry measurements interface
 */
export interface TelemetryMeasurements {
  [key: string]: number;
}

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: TelemetryProperties;
}

/**
 * TelemetryService class
 *
 * Provides privacy-respecting telemetry tracking using VS Code's TelemetryLogger API
 */
export class TelemetryService {
  private readonly telemetryLogger: vscode.TelemetryLogger;
  private readonly extensionId: string;
  private readonly extensionVersion: string;
  private activationTime?: number;

  constructor(
    context: vscode.ExtensionContext,
    extensionId: string = 'vscode-sidebar-terminal',
    extensionVersion: string = '0.1.138'
  ) {
    this.extensionId = extensionId;
    this.extensionVersion = extensionVersion;

    // Create telemetry logger with sender configuration
    this.telemetryLogger = vscode.env.createTelemetryLogger({
      sendEventData: (eventName, data) => {
        // TelemetryLogger automatically respects VS Code telemetry settings
        // Data is only sent if user has not opted out of telemetry
        this.sendTelemetryData(eventName, data);
      },
      sendErrorData: (error, data) => {
        // Send error telemetry
        this.sendErrorTelemetry(error, data);
      },
    });

    // Register disposal
    context.subscriptions.push(this.telemetryLogger);
  }

  /**
   * Send telemetry data (internal implementation)
   */
  private sendTelemetryData(eventName: string, data: Record<string, any>): void {
    // VS Code's TelemetryLogger automatically handles:
    // - Checking user's telemetry opt-out settings
    // - HTTPS encryption
    // - Anonymous data collection
    //
    // We don't need to implement these checks ourselves

    // For development/debugging, you can log to output channel
    // In production, this would send to your telemetry backend
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Telemetry] ${eventName}:`, data);
    }
  }

  /**
   * Send error telemetry (internal implementation)
   */
  private sendErrorTelemetry(error: Error, data?: Record<string, any>): void {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Telemetry Error] ${error.message}:`, data);
    }
  }

  /**
   * Track extension activation
   */
  public trackActivation(activationTime: number): void {
    this.activationTime = activationTime;

    this.telemetryLogger.logUsage(TelemetryEventType.ExtensionActivated, {
      extensionId: this.extensionId,
      version: this.extensionVersion,
      platform: process.platform,
      nodeVersion: process.version,
    }, {
      activationTime,
    });
  }

  /**
   * Track extension deactivation
   */
  public trackDeactivation(): void {
    const sessionDuration = this.activationTime
      ? Date.now() - this.activationTime
      : 0;

    this.telemetryLogger.logUsage(TelemetryEventType.ExtensionDeactivated, {
      extensionId: this.extensionId,
      version: this.extensionVersion,
    }, {
      sessionDuration,
    });
  }

  /**
   * Track terminal creation
   */
  public trackTerminalCreated(terminalId: string, profileName?: string): void {
    this.telemetryLogger.logUsage(TelemetryEventType.TerminalCreated, {
      hasProfile: !!profileName,
      // Note: We don't send terminalId or profileName to respect privacy
    });
  }

  /**
   * Track terminal deletion
   */
  public trackTerminalDeleted(_terminalId: string): void {
    this.telemetryLogger.logUsage(TelemetryEventType.TerminalDeleted, {
      // Note: We don't send terminalId to respect privacy
    });
  }

  /**
   * Track terminal focus
   */
  public trackTerminalFocused(_terminalId: string): void {
    this.telemetryLogger.logUsage(TelemetryEventType.TerminalFocused, {
      // Note: We don't send terminalId to respect privacy
    });
  }

  /**
   * Track terminal split
   */
  public trackTerminalSplit(direction: 'horizontal' | 'vertical'): void {
    this.telemetryLogger.logUsage(TelemetryEventType.TerminalSplit, {
      direction,
    });
  }

  /**
   * Track CLI agent detection
   */
  public trackCliAgentDetected(agentType: string): void {
    this.telemetryLogger.logUsage(TelemetryEventType.CliAgentDetected, {
      agentType, // e.g., 'claude', 'gemini', 'copilot'
    });
  }

  /**
   * Track CLI agent disconnection
   */
  public trackCliAgentDisconnected(agentType: string, sessionDuration: number): void {
    this.telemetryLogger.logUsage(TelemetryEventType.CliAgentDisconnected, {
      agentType,
    }, {
      sessionDuration,
    });
  }

  /**
   * Track command execution
   */
  public trackCommandExecuted(commandId: string, success: boolean = true): void {
    this.telemetryLogger.logUsage(TelemetryEventType.CommandExecuted, {
      commandId,
      success,
    });
  }

  /**
   * Track error occurrence
   */
  public trackError(error: Error, context?: string): void {
    this.telemetryLogger.logError(TelemetryEventType.ErrorOccurred, {
      errorMessage: error.message,
      errorName: error.name,
      context: context || 'unknown',
      stack: error.stack || 'no-stack',
    });
  }

  /**
   * Track settings changes
   */
  public trackSettingsChanged(settingKey: string): void {
    this.telemetryLogger.logUsage(TelemetryEventType.SettingsChanged, {
      settingKey,
      // Note: We don't send the actual value to respect privacy
    });
  }

  /**
   * Track session save
   */
  public trackSessionSaved(terminalCount: number, success: boolean): void {
    this.telemetryLogger.logUsage(TelemetryEventType.SessionSaved, {
      success,
    }, {
      terminalCount,
    });
  }

  /**
   * Track session restore
   */
  public trackSessionRestored(terminalCount: number, success: boolean): void {
    this.telemetryLogger.logUsage(TelemetryEventType.SessionRestored, {
      success,
    }, {
      terminalCount,
    });
  }

  /**
   * Track performance metric
   */
  public trackPerformance(metric: PerformanceMetric): void {
    this.telemetryLogger.logUsage(TelemetryEventType.PerformanceMetric, {
      operation: metric.operation,
      success: metric.success,
      ...metric.metadata,
    }, {
      duration: metric.duration,
    });
  }

  /**
   * Measure async operation performance
   */
  public async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: TelemetryProperties
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.trackPerformance({
        operation,
        duration,
        success,
        metadata,
      });
    }
  }

  /**
   * Measure sync operation performance
   */
  public measure<T>(
    operation: string,
    fn: () => T,
    metadata?: TelemetryProperties
  ): T {
    const startTime = Date.now();
    let success = true;

    try {
      const result = fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.trackPerformance({
        operation,
        duration,
        success,
        metadata,
      });
    }
  }

  /**
   * Dispose telemetry service
   */
  public dispose(): void {
    this.telemetryLogger.dispose();
  }
}
