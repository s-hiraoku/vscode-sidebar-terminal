/**
 * Segregated Manager Interfaces for WebView Components
 * 
 * This file provides segregated interfaces for different manager types,
 * allowing for better separation of concerns and modularity.
 */

import { Terminal } from 'xterm';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';

// Re-export core interfaces from main manager interfaces
export {
  TerminalInstance,
  IManagerCoordinator,
  ITerminalManager,
  IPerformanceManager,
  IInputManager,
  IUIManager,
  IConfigManager,
  IMessageManager,
  INotificationManager,
  ISplitManagerSupport,
  IManagerFactory,
  IManagerEventEmitter,
  IManagerLifecycle,
  IWebViewManager
} from './ManagerInterfaces';

// Import required types for interfaces
import type { IManagerCoordinator, TerminalInstance, IManagerLifecycle } from './ManagerInterfaces';

// Additional interfaces needed by DependencyContainer and tests
export interface ManagerDependencies {
  coordinator?: IManagerCoordinator;
  terminalCoordinator?: ITerminalCoordinator;
  extensionCommunicator?: IExtensionCommunicator;
  settingsCoordinator?: ISettingsCoordinator;
  cliAgentCoordinator?: ICliAgentCoordinator;
  sessionCoordinator?: ISessionCoordinator;
  loggingCoordinator?: ILoggingCoordinator;
  managerProvider?: IManagerProvider;
  [key: string]: unknown;
}

export interface ITerminalCoordinator {
  createTerminal(id: string, name: string): Promise<void>;
  deleteTerminal(id: string): Promise<void>;
  switchToTerminal(id: string): void;
  getActiveTerminal(): TerminalInstance | null;
}

export interface IExtensionCommunicator {
  sendMessage(message: unknown): void;
  onMessage(handler: (message: unknown) => void): void;
}

export interface ISettingsCoordinator {
  getSettings(): unknown;
  saveSettings(settings: unknown): void;
  onSettingsChange(handler: (settings: unknown) => void): void;
}

export interface ICliAgentCoordinator {
  detectAgent(terminalId: string): Promise<string | null>;
  updateStatus(terminalId: string, status: string): void;
}

export interface ISessionCoordinator {
  saveSession(data: unknown): void;
  restoreSession(): unknown | null;
}

export interface ILoggingCoordinator {
  log(level: string, message: string, ...args: unknown[]): void;
  error(message: string, error?: Error): void;
}

export interface IManagerProvider {
  getManager<T>(type: string): T | null;
  getAllManagers(): Map<string, unknown>;
}

export interface ManagerHealthStatus {
  isHealthy: boolean;
  errors: Error[];
  warnings: string[];
  lastCheck: Date;
  errorCount?: number;
  lastError?: Error;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Alias for backward compatibility
export interface IEnhancedBaseManager extends IEnhancedManager {}

export interface IFullManagerCoordinator extends IManagerCoordinator {
  getExtendedCapabilities(): unknown;
  // Add methods from other coordinators for compatibility
  createTerminal: (id: string, name: string, config?: unknown, terminalNumber?: number) => Promise<unknown>;
  deleteTerminal?: (id: string) => Promise<void>;
  switchToTerminal?: (terminalId: string) => Promise<boolean>;
  getActiveTerminal?: () => TerminalInstance | null;
  sendMessage?: (message: unknown) => void;
  onMessage?: (handler: (message: unknown) => void) => void;
  getSettings?: () => unknown;
  saveSettings?: (settings: unknown) => void;
  onSettingsChange?: (handler: (settings: unknown) => void) => void;
  detectAgent?: (terminalId: string) => Promise<string | null>;
  updateStatus?: (terminalId: string, status: string) => void;
  saveSession?: (data: unknown) => void;
  restoreSession?: () => unknown | null;
  log: (message: string, ...args: unknown[]) => void;
  error?: (message: string, error?: Error) => void;
  getManager?: <T>(type: string) => T | null;
  getAllManagers?: () => Map<string, unknown>;
}

// Additional segregated interfaces for specific use cases

// Segregated Terminal Operations Interface
export interface ISegregatedTerminalOperations {
  createTerminal(id: string, name: string, config: PartialTerminalSettings): Promise<void>;
  deleteTerminal(id: string): Promise<void>;
  switchTerminal(id: string): void;
  writeToTerminal(data: string, terminalId?: string): void;
  resizeTerminal(cols: number, rows: number, terminalId?: string): void;
}

// Segregated UI Operations Interface
export interface ISegregatedUIOperations {
  updateTheme(settings: PartialTerminalSettings): void;
  updateBorders(activeTerminalId: string): void;
  showPlaceholder(): void;
  hidePlaceholder(): void;
  applyFontSettings(fontSettings: WebViewFontSettings): void;
}

// Segregated Message Operations Interface
export interface ISegregatedMessageOperations {
  postMessage(message: unknown): void;
  handleMessage(message: unknown): Promise<void>;
  sendInput(input: string, terminalId?: string): void;
  sendResize(cols: number, rows: number, terminalId?: string): void;
}

// Segregated Performance Operations Interface
export interface ISegregatedPerformanceOperations {
  scheduleBuffer(data: string, terminal: Terminal): void;
  flushBuffer(): void;
  setCliAgentMode(active: boolean): void;
  getBufferStats(): { bufferSize: number; isFlushScheduled: boolean };
}

// Segregated Configuration Operations Interface
export interface ISegregatedConfigOperations {
  loadSettings(): PartialTerminalSettings;
  saveSettings(settings: PartialTerminalSettings): void;
  applySettings(settings: PartialTerminalSettings): void;
  getCurrentSettings(): PartialTerminalSettings;
}

// Segregated Notification Operations Interface
export interface ISegregatedNotificationOperations {
  showInfo(message: string): void;
  showWarning(message: string): void;
  showError(message: string): void;
  showSuccess(message: string): void;
  clearNotifications(): void;
}

// Combined segregated operations interface
export interface ISegregatedOperations {
  terminal: ISegregatedTerminalOperations;
  ui: ISegregatedUIOperations;
  message: ISegregatedMessageOperations;
  performance: ISegregatedPerformanceOperations;
  config: ISegregatedConfigOperations;
  notification: ISegregatedNotificationOperations;
}

// Manager state interfaces
export interface IManagerState {
  isInitialized: boolean;
  isDisposed: boolean;
  lastError?: Error;
}

// Enhanced manager interface with state
export interface IEnhancedManager extends IManagerLifecycle {
  readonly state: IManagerState;
  getState(): IManagerState;
  isReady(): boolean;
  getLastError(): Error | undefined;
  getHealthStatus?(): ManagerHealthStatus;
  isInitialized?: boolean;
}

// Factory interface for segregated managers
export interface ISegregatedManagerFactory {
  createSegregatedOperations(): ISegregatedOperations;
  createEnhancedManager<T extends IEnhancedManager>(type: string): T;
}