/**
 * Shared interfaces for WebView manager communication and coordination
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';

// Core terminal data structure with VS Code Standard Addons
export interface TerminalInstance {
  readonly id: string;
  readonly name: string;
  readonly number: number; // ターミナル番号（1-5）- 番号管理に必要
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLElement;
  isActive?: boolean;
  // VS Code Standard Addons
  readonly searchAddon?: SearchAddon;
  readonly webglAddon?: WebglAddon;
  readonly unicode11Addon?: Unicode11Addon;
}

// Manager coordination interface
export interface IManagerCoordinator {
  getActiveTerminalId(): string | null;
  setActiveTerminalId(terminalId: string): void;
  getTerminalInstance(terminalId: string): TerminalInstance | undefined;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
  getTerminalElement(terminalId: string): HTMLElement | undefined;
  postMessageToExtension(message: unknown): void;
  log(message: string, ...args: unknown[]): void;
  createTerminal(id: string, name: string, config?: unknown, terminalNumber?: number): Promise<unknown>;
  openSettings(): void;
  applyFontSettings(fontSettings: WebViewFontSettings): void;
  closeTerminal(id?: string): void;
  getManagers(): {
    performance: IPerformanceManager;
    input: IInputManager;
    ui: IUIManager;
    config: IConfigManager;
    message: IMessageManager;
    notification: INotificationManager;
  };
  // 新しいアーキテクチャ: 状態更新処理
  updateState?(state: unknown): void;
  handleTerminalRemovedFromExtension?(terminalId: string): void;
  // 追加メソッド（リファクタリング用）
  writeToTerminal?(data: string, terminalId?: string): boolean;
  switchToTerminal?(terminalId: string): Promise<boolean>;
  applySettings?(settings: unknown): void;
  // Claude状態管理（レガシー）
  updateClaudeStatus(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
  // 新しい一元管理CLI Agent状態管理
  updateCliAgentStatus(
    terminalId: string,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
  ensureTerminalFocus(terminalId: string): void;

  // セッション復元関連
  createTerminalFromSession?(
    id: string,
    name: string,
    config: PartialTerminalSettings,
    restoreMessage: string,
    scrollbackData: string[]
  ): void;
}

// Terminal management interface
export interface ITerminalManager {
  createTerminal(id: string, name: string, config: PartialTerminalSettings, terminalNumber?: number): Promise<void>;
  switchToTerminal(id: string): void;
  closeTerminal(id?: string): void;
  handleTerminalRemovedFromExtension(id: string): void;
  writeToTerminal(data: string, terminalId?: string): void;
  ensureTerminalFocus(terminalId: string): void;
  switchToNextTerminal(): void;
  getTerminal(terminalId: string): TerminalInstance | undefined;
  getAllTerminals(): Map<string, TerminalInstance>;
  getTerminalContainer(terminalId: string): HTMLElement | undefined;
  getAllTerminalContainers(): Map<string, HTMLElement>;

  // セッション復元関連
  createTerminalFromSession?(
    id: string,
    name: string,
    config: PartialTerminalSettings,
    restoreMessage: string,
    scrollbackData: string[]
  ): void;
  getTerminalScrollback?(terminalId: string, maxLines: number): string[];

  dispose(): void;
}

// Performance management interface
export interface IPerformanceManager {
  scheduleOutputBuffer(data: string, targetTerminal: Terminal): void;
  bufferedWrite(data: string, targetTerminal: Terminal, terminalId: string): void;
  flushOutputBuffer(): void;
  debouncedResize(cols: number, rows: number, terminal: Terminal, fitAddon: FitAddon): void;
  setCliAgentMode(isActive: boolean): void;
  getCliAgentMode(): boolean;
  getBufferStats(): {
    bufferSize: number;
    isFlushScheduled: boolean;
    currentTerminal: boolean;
  };
  forceFlush(): void;
  initialize(config: unknown): Promise<void>;
  initializePerformance(coordinator: IManagerCoordinator): void;
  dispose(): void;
}

// Input management interface
export interface IInputManager {
  setupIMEHandling(): void;
  setupAltKeyVisualFeedback(): void;
  setupKeyboardShortcuts(manager: IManagerCoordinator): void;
  addXtermClickHandler(
    terminal: Terminal,
    terminalId: string,
    container: HTMLElement,
    manager: IManagerCoordinator
  ): void;
  getAltClickState(): AltClickState;
  isVSCodeAltClickEnabled(settings: PartialTerminalSettings): boolean;
  handleSpecialKeys(
    event: KeyboardEvent,
    terminalId: string,
    manager: IManagerCoordinator
  ): boolean;
  setNotificationManager(notificationManager: INotificationManager): void;
  // VS Code keybinding system
  updateKeybindingSettings(settings: {
    sendKeybindingsToShell?: boolean;
    commandsToSkipShell?: string[];
    allowChords?: boolean;
    allowMnemonics?: boolean;
  }): void;
  dispose(): void;
}

// UI management interface
export interface IUIManager {
  updateTerminalBorders(activeTerminalId: string, allContainers: Map<string, HTMLElement>): void;
  updateSplitTerminalBorders(activeTerminalId: string): void;
  showTerminalPlaceholder(): void;
  hideTerminalPlaceholder(): void;
  applyTerminalTheme(terminal: Terminal, settings: PartialTerminalSettings): void;
  applyFontSettings(terminal: Terminal, fontSettings: WebViewFontSettings): void;
  applyAllVisualSettings(terminal: Terminal, settings: PartialTerminalSettings): void;
  addFocusIndicator(container: HTMLElement): void;
  createTerminalHeader(terminalId: string, terminalName: string, onAiAgentToggleClick?: (terminalId: string) => void): HTMLElement;
  updateTerminalHeader(terminalId: string, newName: string): void;
  updateCliAgentStatusDisplay(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
  applyVSCodeStyling(container: HTMLElement): void;
  dispose(): void;
}

// Configuration management interface
export interface IConfigManager {
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
  dispose(): void;
}

// Message handling interface
export interface IMessageManager {
  handleMessage(message: unknown, coordinator: IManagerCoordinator): Promise<void>;
  postMessage(message: unknown): void;
  receiveMessage(message: unknown, coordinator: IManagerCoordinator): Promise<void>;
  sendReadyMessage(coordinator: IManagerCoordinator): void;
  emitTerminalInteractionEvent(
    type: TerminalInteractionEvent['type'],
    terminalId: string,
    data: unknown,
    coordinator: IManagerCoordinator
  ): void;
  getQueueStats(): { 
    queueSize: number; 
    isProcessing: boolean;
    highPriorityQueueSize?: number;
    isLocked?: boolean;
  };
  sendInput(input: string, terminalId?: string, coordinator?: IManagerCoordinator): void;
  sendResize(
    cols: number,
    rows: number,
    terminalId?: string,
    coordinator?: IManagerCoordinator
  ): void;
  // 新しいアーキテクチャ: 統一された削除メッセージ
  sendDeleteTerminalMessage(
    terminalId: string,
    requestSource: 'header' | 'panel',
    coordinator: IManagerCoordinator
  ): void;
  dispose(): void;
}

// Notification management interface
export interface INotificationManager {
  showNotificationInTerminal(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
  showTerminalKillError(message: string): void;
  showTerminalCloseError(minCount: number): void;
  showAltClickFeedback(x: number, y: number): void;
  showWarning(message: string): void;
  clearNotifications(): void;
  clearWarnings(): void;
  getStats(): { 
    activeCount: number; 
    totalCreated: number;
    totalOperations?: number;
  };
  setupNotificationStyles(): void;
  dispose(): void;
}

// Split management support interface (extends existing SplitManager)
export interface ISplitManagerSupport {
  prepareSplitMode(direction: 'horizontal' | 'vertical'): void;
  splitTerminal(direction: 'horizontal' | 'vertical'): void;
  addNewTerminalToSplit(terminalId: string, terminalName: string): void;
  getIsSplitMode(): boolean;
}

// Manager factory interface for dependency injection
export interface IManagerFactory {
  createTerminalManager(coordinator: IManagerCoordinator): ITerminalManager;
  createPerformanceManager(): IPerformanceManager;
  createInputManager(): IInputManager;
  createUIManager(): IUIManager;
  createConfigManager(): IConfigManager;
  createMessageManager(): IMessageManager;
  createNotificationManager(): INotificationManager;
}

// Event emitter interface for manager communication
export interface IManagerEventEmitter {
  on(event: string, callback: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  off(event: string, callback: (...args: unknown[]) => void): void;
}

// Manager lifecycle interface
export interface IManagerLifecycle {
  initialize(config?: unknown): Promise<void> | void;
  dispose(): void;
}

// Combined manager interface
export interface IWebViewManager extends IManagerLifecycle {
  terminalManager: ITerminalManager;
  performanceManager: IPerformanceManager;
  inputManager: IInputManager;
  uiManager: IUIManager;
  configManager: IConfigManager;
  messageManager: IMessageManager;
  notificationManager: INotificationManager;
}
