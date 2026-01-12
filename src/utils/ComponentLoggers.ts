/** Component-specific loggers for debugging and monitoring. */

import {
  message, terminal, extension, performance, ui, config, session, input,
  output, lifecycle, error_category, warning_category, agent, state,
} from './logger';

/** Terminal operations logger. */
export class TerminalLogger {
  constructor(private terminalId?: string, private terminalName?: string) {}

  private fmt(action: string): string {
    const ctx = this.terminalId ? `[${this.terminalId}]` : '';
    const name = this.terminalName ? `(${this.terminalName})` : '';
    return `${ctx}${name} ${action}`;
  }

  create(id: string, name: string): void { terminal(this.fmt(`Created: ${id} - ${name}`)); }
  destroy(reason?: string): void { terminal(this.fmt(`Destroyed${reason ? ` - ${reason}` : ''}`)); }
  output(data: string, size: number): void { output(this.fmt(`Output: ${size} chars`), data.length > 100 ? `${data.slice(0, 100)}...` : data); }
  input(data: string): void { input(this.fmt(`Input: ${data.length} chars`), data); }
  resize(cols: number, rows: number): void { terminal(this.fmt(`Resized to ${cols}x${rows}`)); }
  focus(): void { terminal(this.fmt('Focused')); }
  error(op: string, err: unknown): void { error_category(this.fmt(`Error in ${op}`), err); }
  performance(op: string, duration: number): void { performance(this.fmt(`${op}: ${duration}ms`)); }
}

/** Message processing logger. */
export class MessageLogger {
  constructor(private context: string = 'MessageManager') {}

  private fmt(action: string): string { return `[${this.context}] ${action}`; }

  received(cmd: string, source?: string): void { message(this.fmt(`Received: ${cmd}${source ? ` from ${source}` : ''}`)); }
  sent(cmd: string, target?: string): void { message(this.fmt(`Sent: ${cmd}${target ? ` to ${target}` : ''}`)); }
  queued(cmd: string, queueSize: number): void { message(this.fmt(`Queued: ${cmd} (queue: ${queueSize})`)); }
  processed(cmd: string, duration: number): void { message(this.fmt(`Processed: ${cmd} in ${duration}ms`)); }
  error(op: string, err: unknown): void { error_category(this.fmt(`Error in ${op}`), err); }
  performance(op: string, metrics: Record<string, number>): void { performance(this.fmt(`${op} metrics`), metrics); }
}

/** WebView operations logger. */
export class WebViewLogger {
  constructor(private managerId: string) {}

  private fmt(action: string): string { return `[${this.managerId}] ${action}`; }

  initialized(): void { lifecycle(this.fmt('Initialized')); }
  domReady(): void { ui(this.fmt('DOM ready')); }
  render(component: string, duration?: number): void { ui(this.fmt(`Rendered ${component}${duration ? ` in ${duration}ms` : ''}`)); }
  interaction(type: string, element: string): void { input(this.fmt(`${type} on ${element}`)); }
  stateChange(prop: string, oldVal: unknown, newVal: unknown): void { state(this.fmt(`State: ${prop}`), { oldVal, newVal }); }
  error(op: string, err: unknown): void { error_category(this.fmt(`Error in ${op}`), err); }
  warning(op: string, details: unknown): void { warning_category(this.fmt(`Warning in ${op}`), details); }
}

/** Extension provider logger. */
export class ExtensionLogger {
  constructor(private providerId: string) {}

  private fmt(action: string): string { return `[${this.providerId}] ${action}`; }

  activated(): void { lifecycle(this.fmt('Activated')); }
  deactivated(): void { lifecycle(this.fmt('Deactivated')); }
  command(cmdId: string, args?: unknown[]): void { extension(this.fmt(`Command: ${cmdId}`), args); }
  configChanged(setting: string, value: unknown): void { config(this.fmt(`Config: ${setting}`), value); }
  event(type: string, data?: unknown): void { extension(this.fmt(`Event: ${type}`), data); }
  error(op: string, err: unknown): void { error_category(this.fmt(`Error in ${op}`), err); }
}

/** Session management logger. */
export class SessionLogger {
  constructor(private sessionType: string = 'Session') {}

  private fmt(action: string): string { return `[${this.sessionType}] ${action}`; }

  save(id: string, size: number): void { session(this.fmt(`Saved: ${id} (${size} bytes)`)); }
  restore(id: string, count: number): void { session(this.fmt(`Restored: ${id} (${count} terminals)`)); }
  clear(id: string): void { session(this.fmt(`Cleared: ${id}`)); }
  progress(op: string, current: number, total: number): void { session(this.fmt(`${op}: ${current}/${total}`)); }
  error(op: string, err: unknown): void { error_category(this.fmt(`Error in ${op}`), err); }
}

/** Performance monitoring logger. */
export class PerformanceLogger {
  constructor(private component: string) {}

  private fmt(action: string): string { return `[${this.component}] ${action}`; }

  startOperation(id: string): void { performance(this.fmt(`Started: ${id}`)); }
  endOperation(id: string, duration: number, meta?: Record<string, unknown>): void { performance(this.fmt(`Completed: ${id} in ${duration}ms`), meta); }
  memory(usage: { used: number; total: number }): void { performance(this.fmt(`Memory: ${usage.used}/${usage.total} MB`)); }
  throttle(op: string, delay: number): void { performance(this.fmt(`Throttled: ${op} (${delay}ms)`)); }
  buffer(op: string, size: number, interval: number): void { performance(this.fmt(`Buffered: ${op} (${size} items, ${interval}ms)`)); }
}

/** CLI Agent detection logger. */
export class AgentLogger {
  constructor(private agentType?: string) {}

  private fmt(action: string): string { return `[${this.agentType || 'Agent'}] ${action}`; }

  detected(terminalId: string, type: string): void { agent(this.fmt(`Detected in ${terminalId}: ${type}`)); }
  statusChange(oldStatus: string, newStatus: string, terminalId?: string): void { agent(this.fmt(`${oldStatus} → ${newStatus}${terminalId ? ` (${terminalId})` : ''}`)); }
  terminated(terminalId: string, reason?: string): void { agent(this.fmt(`Terminated in ${terminalId}${reason ? ` - ${reason}` : ''}`)); }
  output(terminalId: string, size: number, patterns?: string[]): void { agent(this.fmt(`Output in ${terminalId}: ${size} chars`), patterns); }
  error(op: string, err: unknown): void { error_category(this.fmt(`Error in ${op}`), err); }
}

export const createWebViewLogger = (managerId: string): WebViewLogger => new WebViewLogger(managerId);
