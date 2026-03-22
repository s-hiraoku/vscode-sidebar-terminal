import { Terminal } from '@xterm/xterm';
import { SPLIT_CONSTANTS } from '../constants/webview';
import { TerminalConfig, TerminalState } from '../../types/shared';
import { webview as log } from '../../utils/logger';

interface ITerminalOperations {
  isTerminalCreationPending(terminalId: string): boolean;
  markTerminalCreationPending(terminalId: string): void;
  clearTerminalCreationPending(terminalId: string): void;
}

interface ITerminalLifecycleManager {
  createTerminal(
    terminalId: string,
    terminalName: string,
    config?: TerminalConfig,
    terminalNumber?: number
  ): Promise<Terminal | null>;
  removeTerminal(terminalId: string): Promise<boolean>;
  switchToTerminal(terminalId: string): Promise<boolean>;
  resizeAllTerminals(): void;
}

interface ITerminalTabManager {
  addTab(terminalId: string, terminalName: string, terminal?: Terminal): void;
  setActiveTab(terminalId: string): void;
  removeTab(terminalId: string): void;
}

interface IWebViewPersistenceService {
  addTerminal(terminalId: string, terminal: Terminal, options: { autoSave: boolean }): void;
  removeTerminal(terminalId: string): void;
  saveSession(): Promise<boolean>;
}

interface ISplitManager {
  getTerminals(): Map<string, unknown>;
  getTerminalContainers(): Map<string, HTMLElement>;
  getIsSplitMode(): boolean;
}

interface IDisplayModeManager {
  getCurrentMode(): 'normal' | 'split' | 'fullscreen';
  setDisplayMode(mode: 'normal' | 'split' | 'fullscreen'): void;
  showAllTerminalsSplit(): void;
}

interface IUIManager {
  updateTerminalBorders(activeTerminalId: string, containers: Map<string, HTMLElement>): void;
}

interface ICliAgentStateManager {
  removeTerminalState(terminalId: string): void;
}

export interface IDependencies {
  terminalOperations: ITerminalOperations;
  terminalLifecycleManager: ITerminalLifecycleManager;
  terminalTabManager?: ITerminalTabManager;
  webViewPersistenceService?: IWebViewPersistenceService;
  splitManager: ISplitManager;
  displayModeManager?: IDisplayModeManager;
  uiManager?: IUIManager;
  cliAgentStateManager: ICliAgentStateManager;
  getTerminalInstance(terminalId: string): { terminal?: Terminal } | undefined;
  getActiveTerminalId(): string | null;
  setActiveTerminalId(terminalId: string | null): void;
  canCreateTerminal(): boolean;
  getCurrentTerminalState(): TerminalState | null;
  getForceNormalModeForNextCreate(): boolean;
  setForceNormalModeForNextCreate(enabled: boolean): void;
  getForceFullscreenModeForNextCreate(): boolean;
  setForceFullscreenModeForNextCreate(enabled: boolean): void;
  requestLatestState(): void;
  showTerminalLimitMessage(current: number, max: number): void;
  postMessageToExtension(message: unknown): void;
}

type CreationCheckResult =
  | { action: 'skip'; terminal: Terminal | null }
  | { action: 'continue'; shouldForceNormal: boolean; shouldForceFullscreen: boolean };

export class LightweightTerminalLifecycleCoordinator {
  private pendingSplitTransition: Promise<void> | null = null;

  constructor(private readonly dependencies: IDependencies) {}

  public async createTerminal(params: {
    terminalId: string;
    terminalName: string;
    config?: TerminalConfig;
    terminalNumber?: number;
    requestSource: 'webview' | 'extension';
  }): Promise<Terminal | null> {
    const { terminalId, terminalName, config, terminalNumber, requestSource } = params;

    try {
      log(`🔍 [DEBUG] RefactoredTerminalWebviewManager.createTerminal called:`, {
        terminalId,
        terminalName,
        terminalNumber,
        hasConfig: !!config,
        timestamp: Date.now(),
      });

      const checkResult = await this.preTerminalCreationChecks({
        terminalId,
        config,
        terminalNumber,
        requestSource,
      });
      if (checkResult.action === 'skip') {
        return checkResult.terminal;
      }

      const { shouldForceNormal, shouldForceFullscreen } = checkResult;

      log(`🚀 Creating terminal with header: ${terminalId} (${terminalName}) #${terminalNumber}`);
      this.dependencies.terminalOperations.markTerminalCreationPending(terminalId);

      const terminal = await this.dependencies.terminalLifecycleManager.createTerminal(
        terminalId,
        terminalName,
        config,
        terminalNumber
      );

      if (!terminal) {
        log(`❌ Failed to create terminal instance: ${terminalId}`);
        return null;
      }

      this.postTerminalCreation({
        terminalId,
        terminalName,
        terminal,
        requestSource,
        shouldForceNormal,
        shouldForceFullscreen,
      });

      return terminal;
    } catch (error) {
      log(`❌ Error creating terminal ${terminalId}:`, error);
      return null;
    } finally {
      this.dependencies.terminalOperations.clearTerminalCreationPending(terminalId);
    }
  }

  public async removeTerminal(terminalId: string): Promise<boolean> {
    log(`🗑️ [REMOVAL] Starting removal for terminal: ${terminalId}`);

    this.dependencies.cliAgentStateManager.removeTerminalState(terminalId);

    this.dependencies.webViewPersistenceService?.removeTerminal(terminalId);
    if (this.dependencies.webViewPersistenceService) {
      log(`🗑️ [PERSISTENCE] Terminal ${terminalId} unregistered from persistence service`);
    }

    this.dependencies.terminalTabManager?.removeTab(terminalId);
    const removed = await this.dependencies.terminalLifecycleManager.removeTerminal(terminalId);
    log(`🗑️ [REMOVAL] Lifecycle removal result for ${terminalId}: ${removed}`);

    setTimeout(() => {
      this.dependencies.webViewPersistenceService
        ?.saveSession()
        .then((success) => {
          if (success) {
            log('✅ [SIMPLE-PERSISTENCE] Session updated after removal');
          }
        })
        .catch((error) => {
          console.error('Failed to save session after terminal removal', { terminalId }, error);
        });
    }, 100);

    return removed;
  }

  public async switchToTerminal(terminalId: string): Promise<boolean> {
    const result = await this.dependencies.terminalLifecycleManager.switchToTerminal(terminalId);
    if (result) {
      this.dependencies.uiManager?.updateTerminalBorders(
        terminalId,
        this.dependencies.splitManager.getTerminalContainers()
      );
    }
    return result;
  }

  public async ensureSplitModeBeforeCreation(): Promise<void> {
    await this.ensureSplitModeBeforeTerminalCreation();
  }

  public async handleTerminalRemovedFromExtension(terminalId: string): Promise<void> {
    const removed = await this.removeTerminal(terminalId);
    if (removed) {
      log(`✅ Terminal cleanup confirmed for ${terminalId}`);
    } else {
      log(`⚠️ Terminal cleanup may have failed for ${terminalId}`);
    }
  }

  public ensureTerminalFocus(terminalId?: string): void {
    const targetTerminalId = terminalId ?? this.dependencies.getActiveTerminalId();
    if (!targetTerminalId) {
      return;
    }

    const instance = this.dependencies.getTerminalInstance(targetTerminalId);
    if (!instance?.terminal) {
      return;
    }

    if (terminalId && this.dependencies.getActiveTerminalId() !== terminalId) {
      this.dependencies.setActiveTerminalId(terminalId);
    }

    instance.terminal.focus();
  }

  public prepareDisplayForTerminalDeletion(
    targetTerminalId: string,
    stats: { totalTerminals: number; activeTerminalId: string | null; terminalIds: string[] }
  ): void {
    try {
      const displayModeManager = this.dependencies.displayModeManager;
      if (!displayModeManager) {
        return;
      }

      if (stats.totalTerminals > 1 && displayModeManager.getCurrentMode() === 'fullscreen') {
        log(`🖥️ Exiting fullscreen before deleting ${targetTerminalId}`);
        displayModeManager.setDisplayMode('split');
      }
    } catch (error) {
      log('⚠️ Failed to prepare display for deletion:', error);
    }
  }

  private async preTerminalCreationChecks(params: {
    terminalId: string;
    config?: TerminalConfig;
    terminalNumber?: number;
    requestSource: 'webview' | 'extension';
  }): Promise<CreationCheckResult> {
    const { terminalId, config, terminalNumber, requestSource } = params;

    if (this.dependencies.terminalOperations.isTerminalCreationPending(terminalId)) {
      log(
        `⏳ [DEBUG] Terminal ${terminalId} creation already pending (source: ${requestSource}), skipping duplicate request`
      );
      return {
        action: 'skip',
        terminal: this.dependencies.getTerminalInstance(terminalId)?.terminal ?? null,
      };
    }

    const existingInstance = this.dependencies.getTerminalInstance(terminalId);
    if (existingInstance) {
      log(
        `🔁 [DEBUG] Terminal ${terminalId} already exists, reusing existing instance (source: ${requestSource})`
      );
      this.dependencies.terminalTabManager?.setActiveTab(terminalId);
      return { action: 'skip', terminal: existingInstance.terminal ?? null };
    }

    const displayModeOverride = (config as { displayModeOverride?: string } | undefined)
      ?.displayModeOverride;
    const shouldForceNormal =
      this.dependencies.getForceNormalModeForNextCreate() || displayModeOverride === 'normal';
    const shouldForceFullscreen =
      this.dependencies.getForceFullscreenModeForNextCreate() ||
      displayModeOverride === 'fullscreen';

    log(`🔍 [MODE-DEBUG] createTerminal mode check:`, {
      terminalId,
      displayModeOverride,
      forceFullscreenModeForNextCreate: this.dependencies.getForceFullscreenModeForNextCreate(),
      shouldForceFullscreen,
      shouldForceNormal,
      currentMode: this.dependencies.displayModeManager?.getCurrentMode?.() ?? 'unknown',
    });

    if (shouldForceNormal) {
      this.dependencies.setForceNormalModeForNextCreate(false);
      this.dependencies.displayModeManager?.setDisplayMode('normal');
      log(`🧭 [MODE] Forced normal mode before creating ${terminalId}`);
    } else if (shouldForceFullscreen) {
      this.dependencies.displayModeManager?.setDisplayMode('fullscreen');
      this.dependencies.setForceFullscreenModeForNextCreate(false);
      log(`🧭 [MODE] Forced fullscreen mode before creating ${terminalId}`);
    } else {
      await this.ensureSplitModeBeforeTerminalCreation();
    }

    const canCreate = this.dependencies.canCreateTerminal();
    if (!canCreate && requestSource !== 'extension') {
      const localCount = this.dependencies.splitManager.getTerminals().size ?? 0;
      const maxCount =
        this.dependencies.getCurrentTerminalState()?.maxTerminals ?? SPLIT_CONSTANTS.MAX_TERMINALS;
      log(`❌ [STATE] Terminal creation blocked (local count=${localCount}, max=${maxCount})`);
      this.dependencies.showTerminalLimitMessage(localCount, maxCount);
      return { action: 'skip', terminal: null };
    }

    const currentTerminalState = this.dependencies.getCurrentTerminalState();
    if (currentTerminalState) {
      const availableSlots = currentTerminalState.availableSlots;
      log(
        `🎯 [STATE] Terminal creation check: canCreate=${canCreate}, availableSlots=[${availableSlots.join(',')}]`
      );
      if (terminalNumber && !availableSlots.includes(terminalNumber)) {
        log(
          `⚠️ [STATE] Terminal number ${terminalNumber} not in available slots [${availableSlots.join(',')}]`
        );
        this.dependencies.requestLatestState();
      }
    } else {
      log('⚠️ [STATE] No cached state available, requesting from Extension...');
      this.dependencies.requestLatestState();
    }

    return { action: 'continue', shouldForceNormal, shouldForceFullscreen };
  }

  private postTerminalCreation(params: {
    terminalId: string;
    terminalName: string;
    terminal: Terminal;
    requestSource: 'webview' | 'extension';
    shouldForceNormal: boolean;
    shouldForceFullscreen: boolean;
  }): void {
    const {
      terminalId,
      terminalName,
      terminal,
      requestSource,
      shouldForceNormal,
      shouldForceFullscreen,
    } = params;

    this.dependencies.terminalTabManager?.addTab(terminalId, terminalName, terminal);
    this.dependencies.terminalTabManager?.setActiveTab(terminalId);

    if (this.dependencies.webViewPersistenceService) {
      this.dependencies.webViewPersistenceService.addTerminal(terminalId, terminal, {
        autoSave: true,
      });
      log(`✅ [PERSISTENCE] Terminal ${terminalId} registered with persistence service`);
    }

    setTimeout(() => {
      this.dependencies.webViewPersistenceService
        ?.saveSession()
        .then((success) => {
          if (success) {
            log('✅ [SIMPLE-PERSISTENCE] Session saved successfully');
          } else {
            console.warn('⚠️ [SIMPLE-PERSISTENCE] Failed to save session');
          }
        })
        .catch((error) => {
          console.error('Failed to save session after terminal creation', { terminalId }, error);
        });
    }, 100);

    this.dependencies.setActiveTerminalId(terminalId);
    const allContainers = this.dependencies.splitManager.getTerminalContainers();
    this.dependencies.uiManager?.updateTerminalBorders(terminalId, allContainers);

    if (terminal.textarea) {
      setTimeout(() => {
        terminal.focus();
        log(`🎯 [FIX] Focused new terminal: ${terminalId}`);
      }, 25);
    }

    if (requestSource === 'webview') {
      this.dependencies.postMessageToExtension({
        command: 'createTerminal',
        terminalId,
        terminalName,
        timestamp: Date.now(),
      });
    }

    log(`✅ Terminal creation completed: ${terminalId}`);

    const currentMode = this.dependencies.displayModeManager?.getCurrentMode?.() ?? 'normal';
    const splitManagerActive = this.dependencies.splitManager.getIsSplitMode();
    const shouldMaintainSplitLayout =
      !shouldForceNormal &&
      !shouldForceFullscreen &&
      (currentMode === 'split' || splitManagerActive);

    if (shouldMaintainSplitLayout) {
      try {
        log(`🔄 [SPLIT] Immediately refreshing split layout after creating ${terminalId}`);
        this.dependencies.displayModeManager?.showAllTerminalsSplit();
      } catch (layoutError) {
        log(`⚠️ [SPLIT] Failed to refresh split layout immediately: ${layoutError}`);
      }
    }

    setTimeout(() => {
      this.dependencies.terminalLifecycleManager.resizeAllTerminals();
      this.dependencies.uiManager?.updateTerminalBorders(terminalId, allContainers);

      const currentModeNow = this.dependencies.displayModeManager?.getCurrentMode?.() ?? 'normal';
      if (shouldMaintainSplitLayout && currentModeNow === 'split') {
        try {
          this.dependencies.displayModeManager?.showAllTerminalsSplit();
        } catch (layoutError) {
          log(`⚠️ [SPLIT] Failed to refresh split layout after resize: ${layoutError}`);
        }
      }
    }, 150);
  }

  private async ensureSplitModeBeforeTerminalCreation(): Promise<void> {
    const displayManager = this.dependencies.displayModeManager;
    if (!displayManager) {
      return;
    }

    const currentMode = displayManager.getCurrentMode?.() ?? 'normal';

    let existingCount = 0;
    try {
      existingCount = this.dependencies.splitManager.getTerminals().size;
    } catch (error) {
      log('⚠️ [SPLIT] Failed to inspect existing terminals before creation:', error);
      existingCount = 0;
    }

    if (existingCount === 0) {
      return;
    }

    if (currentMode === 'fullscreen') {
      if (this.pendingSplitTransition) {
        await this.pendingSplitTransition;
        return;
      }

      this.pendingSplitTransition = (async () => {
        try {
          log(
            `🖥️ [SPLIT] Fullscreen detected with ${existingCount} terminals. Switching to split mode before creating new terminal.`
          );
          displayManager.showAllTerminalsSplit();
          await new Promise((resolve) => setTimeout(resolve, 250));
        } catch (error) {
          log('⚠️ [SPLIT] Failed to trigger split mode before creation:', error);
        } finally {
          this.pendingSplitTransition = null;
        }
      })();

      await this.pendingSplitTransition;
    } else if (currentMode === 'split') {
      log('🖥️ [SPLIT] Split mode detected. New terminal will be added to split layout.');
    }
  }
}
