/**
 * Segregated Manager Interfaces - Implementing Interface Segregation Principle
 *
 * This file splits the large IManagerCoordinator interface into focused,
 * single-responsibility interfaces to improve maintainability and testability.
 */

import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';
import {
  TerminalInstance,
  IPerformanceManager,
  IInputManager,
  IUIManager,
  IConfigManager,
  IMessageManager,
  INotificationManager,
} from './ManagerInterfaces';

// ============================================================================
// SEGREGATED COORDINATOR INTERFACES
// ============================================================================

/**
 * Core terminal management operations
 */
export interface ITerminalCoordinator {
  getActiveTerminalId(): string | null;
  setActiveTerminalId(terminalId: string): void;
  getTerminalInstance(terminalId: string): TerminalInstance | undefined;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
  getTerminalElement(terminalId: string): HTMLElement | undefined;
  createTerminal(id: string, name: string, config?: unknown): Promise<unknown>;
  closeTerminal(id?: string): void;
  writeToTerminal(data: string, terminalId?: string): boolean;
  switchToTerminal(terminalId: string): Promise<boolean>;
  ensureTerminalFocus(terminalId: string): void;
}

/**
 * Communication with VS Code Extension
 */
export interface IExtensionCommunicator {
  postMessageToExtension(message: unknown): void;
  handleTerminalRemovedFromExtension(terminalId: string): void;
  updateState(state: unknown): void;
}

/**
 * Settings and configuration management
 */
export interface ISettingsCoordinator {
  applySettings(settings: unknown): void;
  applyFontSettings(fontSettings: WebViewFontSettings): void;
  openSettings(): void;
}

/**
 * CLI Agent status management
 */
export interface ICliAgentCoordinator {
  updateCliAgentStatus(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
  updateClaudeStatus(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
}

/**
 * Session restoration operations
 */
export interface ISessionCoordinator {
  createTerminalFromSession(
    id: string,
    name: string,
    config: PartialTerminalSettings,
    restoreMessage: string,
    scrollbackData: string[]
  ): void;
}

/**
 * Logging and debugging operations
 */
export interface ILoggingCoordinator {
  log(message: string, ...args: unknown[]): void;
}

/**
 * Manager access for specialized operations
 */
export interface IManagerProvider {
  getManagers(): {
    performance: IPerformanceManager;
    input: IInputManager;
    ui: IUIManager;
    config: IConfigManager;
    message: IMessageManager;
    notification: INotificationManager;
  };
}

// ============================================================================
// COMPOSITE COORDINATOR INTERFACE
// ============================================================================

/**
 * Composite interface that combines all coordinator capabilities
 * for backward compatibility and full-featured coordinators
 */
export interface IFullManagerCoordinator
  extends ITerminalCoordinator,
    IExtensionCommunicator,
    ISettingsCoordinator,
    ICliAgentCoordinator,
    ISessionCoordinator,
    ILoggingCoordinator,
    IManagerProvider {}

// ============================================================================
// ENHANCED MANAGER INTERFACES
// ============================================================================

/**
 * Enhanced base manager interface with better lifecycle management
 */
export interface IEnhancedBaseManager {
  readonly name: string;
  readonly isInitialized: boolean;
  initialize(dependencies: ManagerDependencies): Promise<void>;
  dispose(): void;
  getHealthStatus(): ManagerHealthStatus;
}

/**
 * Manager dependencies interface for dependency injection
 */
export interface ManagerDependencies {
  terminalCoordinator?: ITerminalCoordinator;
  extensionCommunicator?: IExtensionCommunicator;
  settingsCoordinator?: ISettingsCoordinator;
  cliAgentCoordinator?: ICliAgentCoordinator;
  sessionCoordinator?: ISessionCoordinator;
  loggingCoordinator?: ILoggingCoordinator;
  managerProvider?: IManagerProvider;
  [key: string]: unknown;
}

/**
 * Manager health status for monitoring and debugging
 */
export interface ManagerHealthStatus {
  isHealthy: boolean;
  errorCount: number;
  lastError?: string;
  performanceMetrics?: {
    operationsPerSecond: number;
    averageResponseTime: number;
    memoryUsage: number;
  };
}

// ============================================================================
// SPECIALIZED MANAGER INTERFACES (enhanced versions)
// ============================================================================

/**
 * Enhanced Performance Manager interface
 */
export interface IEnhancedPerformanceManager extends IEnhancedBaseManager {
  scheduleOutputBuffer(data: string, targetTerminal: Terminal): void;
  bufferedWrite(data: string, targetTerminal: Terminal, terminalId: string): void;
  flushOutputBuffer(): void;
  debouncedResize(cols: number, rows: number, terminal: Terminal, fitAddon: FitAddon): void;
  setCliAgentMode(isActive: boolean): void;
  getCliAgentMode(): boolean;
  getBufferStats(): BufferStatistics;
  forceFlush(): void;
}

/**
 * Enhanced Input Manager interface
 */
export interface IEnhancedInputManager extends IEnhancedBaseManager {
  setupIMEHandling(): void;
  setupAltKeyVisualFeedback(): void;
  setupKeyboardShortcuts(dependencies: ManagerDependencies): void;
  addXtermClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    dependencies: ManagerDependencies
  ): void;
  getAltClickState(): AltClickState;
  isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean;
  handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    dependencies: ManagerDependencies
  ): boolean;
  setNotificationManager(notificationManager: INotificationManager): void;
}

/**
 * Enhanced UI Manager interface
 */
export interface IEnhancedUIManager extends IEnhancedBaseManager {
  updateTerminalBorders(activeTerminalId: string, allContainers: Map<string, HTMLElement>): void;
  updateSplitTerminalBorders(activeTerminalId: string): void;
  showTerminalPlaceholder(): void;
  hideTerminalPlaceholder(): void;
  applyTerminalTheme(terminal: Terminal, settings: PartialTerminalSettings): void;
  applyFontSettings(terminal: Terminal, fontSettings: WebViewFontSettings): void;
  applyAllVisualSettings(terminal: Terminal, settings: PartialTerminalSettings): void;
  addFocusIndicator(container: HTMLElement): void;
  createTerminalHeader(terminalId: string, terminalName: string): HTMLElement;
  updateTerminalHeader(terminalId: string, newName: string): void;
  updateCliAgentStatusDisplay(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
  applyVSCodeStyling(container: HTMLElement): void;
}

/**
 * Enhanced Config Manager interface
 */
export interface IEnhancedConfigManager extends IEnhancedBaseManager {
  loadSettings(): PartialTerminalSettings;
  saveSettings(settings: PartialTerminalSettings): void;
  applySettings(settings: PartialTerminalSettings, terminals: Map<string, TerminalInstance>): void;
  applyFontSettings(
    fontSettings: WebViewFontSettings,
    terminals: Map<string, TerminalInstance>
  ): void;
  getCurrentSettings(): PartialTerminalSettings;
  getCurrentFontSettings(): WebViewFontSettings;
  updateAltClickSetting(
    terminals: Map<string, TerminalInstance>,
    settings: PartialTerminalSettings
  ): void;
  validateSettings(settings: unknown): ValidationResult;
  exportSettings(): string;
  importSettings(settingsJson: string): void;
}

/**
 * Enhanced Message Manager interface
 */
export interface IEnhancedMessageManager extends IEnhancedBaseManager {
  handleMessage(message: unknown, dependencies: ManagerDependencies): Promise<void>;
  sendReadyMessage(dependencies: ManagerDependencies): void;
  emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    dependencies: ManagerDependencies
  ): void;
  getQueueStats(): MessageQueueStatistics;
  sendInput(input: string, terminalId?: string, dependencies?: ManagerDependencies): void;
  sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    dependencies?: ManagerDependencies
  ): void;
  sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    dependencies: ManagerDependencies
  ): void;
}

/**
 * Enhanced Notification Manager interface
 */
export interface IEnhancedNotificationManager extends IEnhancedBaseManager {
  showNotificationInTerminal(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
  showTerminalKillError(message: string): void;
  showTerminalCloseError(minCount: number): void;
  showAltClickFeedback(x: number, y: number): void;
  clearNotifications(): void;
  getStats(): NotificationStatistics;
  setupNotificationStyles(): void;
  showTemporaryNotification(message: string, duration?: number): string;
  hideNotification(notificationId: string): void;
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface BufferStatistics {
  bufferSize: number;
  isFlushScheduled: boolean;
  currentTerminal: boolean;
  flushInterval: number;
  averageFlushTime: number;
}

export interface MessageQueueStatistics {
  queueSize: number;
  isProcessing: boolean;
  processedCount: number;
  errorCount: number;
  averageProcessingTime: number;
}

export interface NotificationStatistics {
  activeCount: number;
  totalCreated: number;
  dismissedCount: number;
  errorNotifications: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  value?: unknown;
}

// Re-export original interfaces for backward compatibility
export * from './ManagerInterfaces';
