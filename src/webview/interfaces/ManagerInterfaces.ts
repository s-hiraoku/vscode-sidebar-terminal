/**
 * Shared interfaces for WebView manager communication and coordination
 */

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebglAddon } from '@xterm/addon-webgl';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { PartialTerminalSettings, WebViewFontSettings } from '../../types/shared';
import { AltClickState, TerminalInteractionEvent } from '../../types/common';
import { ITerminalProfile } from '../../types/profiles';
import type { IShellIntegrationManager } from '../../types/type-guards';

/**
 * Interface for RenderingOptimizer
 */
export interface IRenderingOptimizer {
  setupOptimizedResize(
    terminal: Terminal,
    fitAddon: FitAddon,
    container: HTMLElement,
    terminalId: string
  ): void;
  detectDevice(event: WheelEvent): void;
  dispose(): void;
}

/**
 * Interface for persistence manager
 */
export interface IPersistenceManager {
  saveSession?(sessionId: string, data: unknown): Promise<void>;
  loadSession?(sessionId: string): Promise<unknown>;
  clearSession?(sessionId: string): Promise<void>;
  dispose(): void;
}

export interface ITerminalTabManager {
  initialize(): void;
  addTab(terminalId: string, name: string, terminal?: Terminal): void;
  removeTab(terminalId: string): void;
  setActiveTab(terminalId: string): void;
  syncTabs(
    tabInfos: Array<{ id: string; name: string; isActive: boolean; isClosable?: boolean }>
  ): void;
  updateModeIndicator(mode: 'normal' | 'fullscreen' | 'split'): void;
  /** Check if a terminal ID is pending deletion (prevents race conditions in state sync) */
  hasPendingDeletion(terminalId: string): boolean;
  /** Get all terminal IDs currently pending deletion */
  getPendingDeletions(): Set<string>;
  dispose(): void;
}

// Core terminal data structure with VS Code Standard Addons
export interface TerminalInstance {
  readonly id: string;
  readonly name: string;
  readonly number: number; // ターミナル番号（1-5）- 番号管理に必要
  readonly terminal: Terminal;
  readonly fitAddon: FitAddon;
  readonly container: HTMLElement;
  isActive: boolean;
  // VS Code Standard Addons
  readonly searchAddon?: SearchAddon;
  readonly webglAddon?: WebglAddon;
  readonly unicode11Addon?: Unicode11Addon;
  readonly serializeAddon?: SerializeAddon; // For scrollback with color preservation
  // Performance Optimization
  readonly renderingOptimizer?: IRenderingOptimizer; // RenderingOptimizer for performance
}

export type TerminalDisplayMode = 'normal' | 'fullscreen' | 'split';

export interface TerminalDisplayState {
  mode: TerminalDisplayMode;
  activeTerminalId: string | null;
  orderedTerminalIds?: string[];
  splitDirection?: 'vertical' | 'horizontal';
}

export interface TerminalDisplaySnapshot {
  mode: TerminalDisplayMode;
  activeTerminalId: string | null;
  visibleTerminals: string[];
  registeredContainers: number;
  registeredWrappers: number;
  orphanNodeCount: number;
}

// Header management interface (subset used by other managers)
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IHeaderManager {
  // Empty interface - split button removed
}

// Manager coordination interface
export interface IShellIntegrationBridge extends IShellIntegrationManager {
  setCoordinator(coordinator: IManagerCoordinator): void;
  handleMessage(message: unknown): void;
  dispose(): void;
  initializeTerminalShellIntegration(terminal: Terminal, terminalId: string): void;
  decorateTerminalOutput(terminal: Terminal, terminalId: string): void;
  updateWorkingDirectory?(terminalId: string, cwd: string): void;
}

export interface IManagerCoordinator {
  getActiveTerminalId(): string | null;
  setActiveTerminalId(terminalId: string): void;
  getTerminalInstance(terminalId: string): TerminalInstance | undefined;
  getSerializeAddon(terminalId: string): SerializeAddon | undefined;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
  getTerminalElement(terminalId: string): HTMLElement | undefined;
  postMessageToExtension(message: unknown): void;
  log(message: string, ...args: unknown[]): void;
  createTerminal(
    id: string,
    name: string,
    config?: unknown,
    terminalNumber?: number,
    requestSource?: 'webview' | 'extension'
  ): Promise<unknown>;
  openSettings(): void;
  setVersionInfo(version: string): void;
  applyFontSettings(fontSettings: WebViewFontSettings): void;
  closeTerminal(id?: string): void;
  shellIntegrationManager?: IShellIntegrationBridge;
  findInTerminalManager?: IFindInTerminalManager; // Find in Terminal manager
  profileManager?: IProfileManager; // Profile manager
  inputManager?: IInputManager; // Input management for terminal events
  getManagers(): {
    performance: IPerformanceManager;
    input: IInputManager;
    ui: IUIManager;
    config: IConfigManager;
    message: IMessageManager;
    notification: INotificationManager;
    findInTerminal?: IFindInTerminalManager;
    profile?: IProfileManager;
    tabs?: ITerminalTabManager;
    persistence?: IPersistenceManager; // Optional persistence manager
    terminalContainer?: ITerminalContainerManager; // Terminal container manager
    displayMode?: IDisplayModeManager; // Display mode manager
    header?: IHeaderManager; // Header manager for UI sync
  };
  getMessageManager(): IMessageManager;
  getTerminalContainerManager?(): ITerminalContainerManager;
  getDisplayModeManager?(): IDisplayModeManager;
  deleteTerminalSafely?(terminalId: string): Promise<boolean>;
  handleAiAgentToggle?(terminalId: string): void;
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

  // Session restore flag management
  isRestoringSession?(): boolean;
  setRestoringSession?(isRestoring: boolean): void;

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
  createTerminal(
    id: string,
    name: string,
    config: PartialTerminalSettings,
    terminalNumber?: number
  ): Promise<void>;
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
  updateSingleTerminalBorder(container: HTMLElement, isActive: boolean): void;
  updateSplitTerminalBorders(activeTerminalId: string): void;
  showTerminalPlaceholder(): void;
  hideTerminalPlaceholder(): void;
  applyTerminalTheme(terminal: Terminal, settings: PartialTerminalSettings): void;
  applyFontSettings(terminal: Terminal, fontSettings: WebViewFontSettings): void;
  applyAllVisualSettings(terminal: Terminal, settings: PartialTerminalSettings): void;
  addFocusIndicator(container: HTMLElement): void;
  createTerminalHeader(
    terminalId: string,
    terminalName: string,
    onAiAgentToggleClick?: (terminalId: string) => void
  ): HTMLElement;
  updateTerminalHeader(terminalId: string, newName: string): void;
  updateCliAgentStatusDisplay(
    activeTerminalName: string | null,
    status: 'connected' | 'disconnected' | 'none',
    agentType: string | null
  ): void;
  applyVSCodeStyling(container: HTMLElement): void;
  setHighlightActiveBorder(enabled: boolean): void;
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

// Terminal Container management interface
export interface ITerminalContainerManager {
  initialize(): void;
  setContainerVisibility(terminalId: string, visible: boolean): void;
  setContainerMode(terminalId: string, mode: 'normal' | 'fullscreen' | 'split'): void;
  getContainer(terminalId: string): HTMLElement | null;
  getAllContainers(): Map<string, HTMLElement>;
  registerContainer(terminalId: string, container: HTMLElement): void;
  unregisterContainer(terminalId: string): void;
  registerSplitWrapper(terminalId: string, wrapper: HTMLElement): void;
  unregisterSplitWrapper(terminalId: string): void;
  registerSplitResizer(resizer: HTMLElement): void;
  clearSplitArtifacts(): void;
  applyDisplayState(state: TerminalDisplayState): void;
  getContainerOrder(): string[];
  getDisplaySnapshot(): TerminalDisplaySnapshot;
  reorderContainers(order: string[]): void;
  dispose(): void;
}

// Display Mode management interface
export interface IDisplayModeManager {
  initialize(): void;
  setDisplayMode(mode: 'normal' | 'fullscreen' | 'split'): void;
  toggleSplitMode(): void;
  showTerminalFullscreen(terminalId: string): void;
  showAllTerminalsSplit(): void;
  hideAllTerminalsExcept(terminalId: string): void;
  showAllTerminals(): void;
  getCurrentMode(): 'normal' | 'fullscreen' | 'split';
  isTerminalVisible(terminalId: string): boolean;
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

// Find in Terminal management interface
export interface IFindInTerminalManager {
  showSearch(): void;
  hideSearch(): void;
  show?(): void; // Alias for showSearch
  hide?(): void; // Alias for hideSearch
  findNext(): void;
  findPrevious(): void;
  getSearchState(): {
    isVisible: boolean;
    searchTerm: string;
    options: {
      caseSensitive: boolean;
      wholeWord: boolean;
      regex: boolean;
      backwards: boolean;
    };
    matches: { current: number; total: number };
  };
  dispose(): void;
}

// Profile management interface
export interface IProfileManager {
  showProfileSelector(onProfileSelected?: (profileId: string) => void): void;
  hideProfileSelector(): void;
  getAvailableProfiles(): Promise<ITerminalProfile[]>;
  getProfile(profileId: string): ITerminalProfile | undefined;
  getDefaultProfile(): ITerminalProfile | undefined;
  setDefaultProfile(profileId: string): Promise<void>;
  refreshProfiles(): Promise<void>;
  createTerminalWithProfile(profileId: string, name?: string): Promise<void>;
  createTerminalWithDefaultProfile(name?: string): Promise<void>;
  switchToProfileByIndex(index: number): Promise<void>;
  updateProfiles(profiles: ITerminalProfile[], defaultProfileId?: string): void;
  handleMessage(message: unknown): void;
  isProfileSelectorVisible(): boolean;
  getSelectedProfileId(): string | undefined;
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
  createProfileManager(): IProfileManager;
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
