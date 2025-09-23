/**
 * UI Controller Interface
 * Handles pure UI concerns separated from business logic
 */

export interface TerminalUIState {
  readonly activeTerminalId: string | undefined;
  readonly terminalCount: number;
  readonly availableSlots: number;
  readonly isSystemReady: boolean;
  readonly isDebugMode: boolean;
}

export interface PerformanceMetrics {
  readonly memoryUsage: number;
  readonly cpuUsage: number;
  readonly renderFrames: number;
  readonly averageResponseTime: number;
  readonly bufferSize: number;
}

export interface DebugInfo {
  readonly systemStatus: 'READY' | 'BUSY' | 'ERROR';
  readonly activeTerminal: string | undefined;
  readonly terminalCount: number;
  readonly availableSlots: number;
  readonly uptime: string;
  readonly performanceMetrics: PerformanceMetrics;
  readonly pendingOperations: string[];
}

export interface NotificationOptions {
  readonly type: 'info' | 'warning' | 'error' | 'success';
  readonly message: string;
  readonly duration?: number;
  readonly actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

/**
 * UI Controller handles all visual aspects of the terminal interface
 */
export interface IUIController {
  // UI State Management
  updateTerminalTabs(terminalInfos: Array<{ id: string; number: number; isActive: boolean }>): void;
  updateActiveTerminalIndicator(terminalId: string | undefined): void;
  updateTerminalCountDisplay(count: number, maxCount: number): void;
  updateSystemStatus(status: 'READY' | 'BUSY' | 'ERROR'): void;

  // Terminal UI Operations
  showTerminalContainer(terminalId: string, container: HTMLElement): void;
  hideTerminalContainer(terminalId: string): void;
  highlightActiveTerminal(terminalId: string): void;

  // Control Elements
  setCreateButtonEnabled(enabled: boolean): void;
  updateSplitButtonVisibility(visible: boolean): void;
  showTerminalLimitMessage(currentCount: number, maxCount: number): void;
  clearTerminalLimitMessage(): void;

  // Debug Panel
  toggleDebugPanel(): void;
  updateDebugInfo(debugInfo: DebugInfo): void;
  exportSystemDiagnostics(): void;

  // Notifications
  showNotification(options: NotificationOptions): void;
  clearNotifications(): void;

  // Settings UI
  openSettings(): void;
  updateTheme(theme: Record<string, string>): void;
  updateFontSettings(fontFamily: string, fontSize: number): void;

  // CLI Agent Status
  updateCliAgentStatus(isConnected: boolean, agentType?: string): void;
  showCliAgentIndicator(visible: boolean): void;

  // Layout Management
  updateSplitLayout(layout: 'horizontal' | 'vertical' | 'grid'): void;
  resizeTerminalContainers(cols: number, rows: number): void;

  // Loading States
  showLoadingState(message: string): void;
  hideLoadingState(): void;

  // Resource Management
  dispose(): void;
}

/**
 * UI Controller configuration
 */
export interface UIControllerConfig {
  readonly enableDebugPanel: boolean;
  readonly enableNotifications: boolean;
  readonly enableCliAgentStatus: boolean;
  readonly defaultTheme: Record<string, string>;
  readonly animationDuration: number;
}

/**
 * Factory interface for creating UI controllers
 */
export interface IUIControllerFactory {
  create(config: UIControllerConfig): IUIController;
}