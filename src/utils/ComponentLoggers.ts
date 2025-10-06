/**
 * Component-Specific Loggers
 *
 * Specialized logging utilities for different components with context-aware formatting
 * and component-specific logging patterns for improved debugging and monitoring.
 */

import {
  message,
  terminal,
  extension,
  performance,
  ui,
  config,
  session,
  input,
  output,
  lifecycle,
  error_category,
  warning_category,
  agent,
  state,
} from './logger';

/**
 * Terminal Manager Logger
 * Specialized logging for terminal operations, processes, and lifecycle
 */
export class TerminalLogger {
  constructor(
    private terminalId?: string,
    private terminalName?: string
  ) {}

  private formatContext(action: string): string {
    const context = this.terminalId ? `[${this.terminalId}]` : '';
    const name = this.terminalName ? `(${this.terminalName})` : '';
    return `${context}${name} ${action}`;
  }

  create(id: string, name: string): void {
    terminal(this.formatContext(`Created terminal: ${id} - ${name}`));
  }

  destroy(reason?: string): void {
    terminal(this.formatContext(`Destroyed terminal${reason ? ` - ${reason}` : ''}`));
  }

  output(data: string, size: number): void {
    output(
      this.formatContext(`Output: ${size} chars`),
      data.length > 100 ? `${data.slice(0, 100)}...` : data
    );
  }

  input(data: string): void {
    input(this.formatContext(`Input: ${data.length} chars`), data);
  }

  resize(cols: number, rows: number): void {
    terminal(this.formatContext(`Resized to ${cols}x${rows}`));
  }

  focus(): void {
    terminal(this.formatContext('Focused'));
  }

  error(operation: string, error: unknown): void {
    error_category(this.formatContext(`Error in ${operation}`), error);
  }

  performance(operation: string, duration: number): void {
    performance(this.formatContext(`${operation} took ${duration}ms`));
  }
}

/**
 * Message Manager Logger
 * Specialized logging for message processing, queuing, and communication
 */
export class MessageLogger {
  constructor(private context: string = 'MessageManager') {}

  private formatContext(action: string): string {
    return `[${this.context}] ${action}`;
  }

  received(command: string, source?: string): void {
    message(this.formatContext(`Received: ${command}${source ? ` from ${source}` : ''}`));
  }

  sent(command: string, target?: string): void {
    message(this.formatContext(`Sent: ${command}${target ? ` to ${target}` : ''}`));
  }

  queued(command: string, queueSize: number): void {
    message(this.formatContext(`Queued: ${command} (queue size: ${queueSize})`));
  }

  processed(command: string, duration: number): void {
    message(this.formatContext(`Processed: ${command} in ${duration}ms`));
  }

  error(operation: string, error: unknown): void {
    error_category(this.formatContext(`Error in ${operation}`), error);
  }

  performance(operation: string, metrics: Record<string, number>): void {
    performance(this.formatContext(`${operation} metrics`), metrics);
  }
}

/**
 * WebView Manager Logger
 * Specialized logging for webview operations, DOM manipulation, and UI updates
 */
export class WebViewLogger {
  constructor(private managerId: string) {}

  private formatContext(action: string): string {
    return `[${this.managerId}] ${action}`;
  }

  initialized(): void {
    lifecycle(this.formatContext('Initialized'));
  }

  domReady(): void {
    ui(this.formatContext('DOM ready'));
  }

  render(component: string, duration?: number): void {
    ui(this.formatContext(`Rendered ${component}${duration ? ` in ${duration}ms` : ''}`));
  }

  interaction(type: string, element: string): void {
    input(this.formatContext(`${type} on ${element}`));
  }

  stateChange(property: string, oldValue: unknown, newValue: unknown): void {
    state(this.formatContext(`State change: ${property}`), { oldValue, newValue });
  }

  error(operation: string, error: unknown): void {
    error_category(this.formatContext(`Error in ${operation}`), error);
  }

  warning(operation: string, details: unknown): void {
    warning_category(this.formatContext(`Warning in ${operation}`), details);
  }
}

/**
 * Extension Provider Logger
 * Specialized logging for extension providers, VS Code integration, and commands
 */
export class ExtensionLogger {
  constructor(private providerId: string) {}

  private formatContext(action: string): string {
    return `[${this.providerId}] ${action}`;
  }

  activated(): void {
    lifecycle(this.formatContext('Activated'));
  }

  deactivated(): void {
    lifecycle(this.formatContext('Deactivated'));
  }

  command(commandId: string, args?: unknown[]): void {
    extension(this.formatContext(`Command: ${commandId}`), args);
  }

  configChanged(setting: string, value: unknown): void {
    config(this.formatContext(`Config changed: ${setting}`), value);
  }

  event(eventType: string, data?: unknown): void {
    extension(this.formatContext(`Event: ${eventType}`), data);
  }

  error(operation: string, error: unknown): void {
    error_category(this.formatContext(`Error in ${operation}`), error);
  }
}

/**
 * Session Manager Logger
 * Specialized logging for session management, persistence, and restoration
 */
export class SessionLogger {
  constructor(private sessionType: string = 'Session') {}

  private formatContext(action: string): string {
    return `[${this.sessionType}] ${action}`;
  }

  save(sessionId: string, dataSize: number): void {
    session(this.formatContext(`Saved session: ${sessionId} (${dataSize} bytes)`));
  }

  restore(sessionId: string, terminalCount: number): void {
    session(this.formatContext(`Restored session: ${sessionId} (${terminalCount} terminals)`));
  }

  clear(sessionId: string): void {
    session(this.formatContext(`Cleared session: ${sessionId}`));
  }

  progress(operation: string, current: number, total: number): void {
    session(this.formatContext(`${operation} progress: ${current}/${total}`));
  }

  error(operation: string, error: unknown): void {
    error_category(this.formatContext(`Error in ${operation}`), error);
  }
}

/**
 * Performance Logger
 * Specialized logging for performance monitoring, metrics, and optimization
 */
export class PerformanceLogger {
  constructor(private component: string) {}

  private formatContext(action: string): string {
    return `[${this.component}] ${action}`;
  }

  startOperation(operationId: string): void {
    performance(this.formatContext(`Started: ${operationId}`));
  }

  endOperation(operationId: string, duration: number, metadata?: Record<string, unknown>): void {
    performance(this.formatContext(`Completed: ${operationId} in ${duration}ms`), metadata);
  }

  memory(usage: { used: number; total: number }): void {
    performance(this.formatContext(`Memory usage: ${usage.used}/${usage.total} MB`));
  }

  throttle(operation: string, delay: number): void {
    performance(this.formatContext(`Throttled: ${operation} (${delay}ms delay)`));
  }

  buffer(operation: string, size: number, flushInterval: number): void {
    performance(
      this.formatContext(`Buffered: ${operation} (${size} items, ${flushInterval}ms interval)`)
    );
  }
}

/**
 * Agent Logger
 * Specialized logging for CLI Agent detection, status, and interactions
 */
export class AgentLogger {
  constructor(private agentType?: string) {}

  private formatContext(action: string): string {
    const type = this.agentType ? `[${this.agentType}]` : '[Agent]';
    return `${type} ${action}`;
  }

  detected(terminalId: string, agentType: string): void {
    agent(this.formatContext(`Detected in terminal ${terminalId}: ${agentType}`));
  }

  statusChange(oldStatus: string, newStatus: string, terminalId?: string): void {
    agent(
      this.formatContext(
        `Status change: ${oldStatus} → ${newStatus}${terminalId ? ` (${terminalId})` : ''}`
      )
    );
  }

  terminated(terminalId: string, reason?: string): void {
    agent(
      this.formatContext(`Terminated in terminal ${terminalId}${reason ? ` - ${reason}` : ''}`)
    );
  }

  output(terminalId: string, dataSize: number, patterns?: string[]): void {
    agent(this.formatContext(`Output in ${terminalId}: ${dataSize} chars`), patterns);
  }

  error(operation: string, error: unknown): void {
    error_category(this.formatContext(`Error in ${operation}`), error);
  }
}

// Factory functions for creating specialized loggers
export const createWebViewLogger = (managerId: string): WebViewLogger =>
  new WebViewLogger(managerId);
