import { TerminalConfig } from '../../../types/shared';
import { IManagerCoordinator, TerminalInstance } from '../../interfaces/ManagerInterfaces';
import { SplitManager } from '../../managers/SplitManager';
import { terminalLogger } from '../../utils/ManagerLogger';
import {
  TerminalContainerConfig,
  TerminalContainerFactory,
  TerminalHeaderConfig,
} from '../../factories/TerminalContainerFactory';

interface IUIManager {
  applyVSCodeStyling?: (container: HTMLElement) => void;
  updateSingleTerminalBorder?: (container: HTMLElement, isActive: boolean) => void;
}

interface ITabManager {
  addTab(terminalId: string, name: string): void;
  handleTerminalRenamed?(terminalId: string, updatedName: string): void;
}

export interface IDependencies {
  splitManager: Pick<SplitManager, 'getTerminals'>;
  coordinator: Pick<
    IManagerCoordinator,
    | 'postMessageToExtension'
    | 'setActiveTerminalId'
    | 'closeTerminal'
    | 'getManagers'
    | 'deleteTerminalSafely'
    | 'handleAiAgentToggle'
  > & {
    profileManager?: IManagerCoordinator['profileManager'];
  };
}

const ElementIds = {
  TERMINAL_BODY: 'terminal-body',
  TERMINAL_VIEW: 'terminal-view',
  TERMINALS_WRAPPER: 'terminals-wrapper',
} as const;

const CssClasses = {
  TERMINAL_CONTAINER: 'terminal-container',
} as const;

const Limits = {
  MAX_TERMINAL_NUMBER: 5,
} as const;

export class TerminalDomService {
  constructor(private readonly dependencies: IDependencies) {}

  public ensureDomReady(): void {
    const terminalBody = document.getElementById(ElementIds.TERMINAL_BODY);
    if (terminalBody) {
      return;
    }

    terminalLogger.error('Main terminal container not found');
    const mainDiv = document.querySelector(`#${ElementIds.TERMINAL_VIEW}`) || document.body;
    if (!mainDiv) {
      throw new Error('Cannot find parent container for terminal-body');
    }

    const newTerminalBody = document.createElement('div');
    newTerminalBody.id = ElementIds.TERMINAL_BODY;
    newTerminalBody.style.cssText = `
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: #000000;
    `;
    mainDiv.appendChild(newTerminalBody);
    terminalLogger.info('✅ Created missing terminal-body container');
  }

  public createAndInsertContainer(params: {
    terminalId: string;
    terminalName: string;
    config: TerminalConfig | undefined;
    terminalNumber: number | undefined;
    currentSettings: { enableTerminalHeaderEnhancements?: boolean } | undefined;
    uiManager: IUIManager | undefined;
  }): {
    container: HTMLElement;
    terminalContent: HTMLElement;
    containerElements: ReturnType<typeof TerminalContainerFactory.createContainer>;
    terminalNumberToUse: number;
  } {
    const { terminalId, terminalName, config, terminalNumber, currentSettings, uiManager } = params;
    const terminalNumberToUse = terminalNumber ?? this.extractTerminalNumber(terminalId);
    const isActiveFromConfig = (config as { isActive?: boolean } | undefined)?.isActive ?? false;

    const containerConfig: TerminalContainerConfig = {
      id: terminalId,
      name: terminalName,
      className: CssClasses.TERMINAL_CONTAINER,
      isSplit: false,
      isActive: isActiveFromConfig,
    };

    const headerConfig = this.buildHeaderConfig(terminalId, terminalName, config, currentSettings);
    const containerElements = TerminalContainerFactory.createContainer(
      containerConfig,
      headerConfig
    );
    if (!containerElements?.container || !containerElements?.body) {
      throw new Error('Invalid container elements created');
    }

    const container = containerElements.container;
    const terminalContent = containerElements.body;
    terminalLogger.info(
      `✅ Container created: ${terminalId} with terminal number: ${terminalNumberToUse}`
    );

    this.insertContainerIntoDom(terminalId, container);

    try {
      uiManager?.applyVSCodeStyling?.(container);
    } catch (error) {
      terminalLogger.warn(
        '⚠️ Container styling application failed; continuing without styling',
        error
      );
    }

    container.style.display = 'flex';
    container.style.visibility = 'visible';

    if (isActiveFromConfig) {
      try {
        uiManager?.updateSingleTerminalBorder?.(container, true);
        terminalLogger.info(`✅ Active border applied to container: ${terminalId}`);
      } catch (error) {
        terminalLogger.warn('⚠️ Active border application failed; continuing', error);
      }
    }

    return { container, terminalContent, containerElements, terminalNumberToUse };
  }

  private buildHeaderConfig(
    terminalId: string,
    terminalName: string,
    config: TerminalConfig | undefined,
    currentSettings: { enableTerminalHeaderEnhancements?: boolean } | undefined
  ): TerminalHeaderConfig {
    return {
      showHeader: true,
      showCloseButton: true,
      showSplitButton: false,
      customTitle: terminalName,
      indicatorColor: (config as { indicatorColor?: string } | undefined)?.indicatorColor,
      headerEnhancementsEnabled: currentSettings?.enableTerminalHeaderEnhancements !== false,
      onHeaderUpdate: (clickedTerminalId, updates) => {
        if (updates.newName) {
          terminalLogger.info(
            `✏️ Header rename submitted: ${clickedTerminalId} -> ${updates.newName}`
          );

          const terminalContainer = document.querySelector(
            `[data-terminal-id="${clickedTerminalId}"]`
          ) as HTMLElement | null;
          if (terminalContainer) {
            terminalContainer.setAttribute('data-terminal-name', updates.newName);
          }

          const tabManager = this.dependencies.coordinator.getManagers?.()?.tabs as
            | ITabManager
            | undefined;
          if (tabManager) {
            if (typeof tabManager.handleTerminalRenamed === 'function') {
              tabManager.handleTerminalRenamed(clickedTerminalId, updates.newName);
            } else {
              tabManager.addTab(clickedTerminalId, updates.newName);
            }
          }
        }

        this.dependencies.coordinator.postMessageToExtension({
          command: 'updateTerminalHeader',
          terminalId: clickedTerminalId,
          ...(updates.newName ? { newName: updates.newName } : {}),
          ...(updates.indicatorColor ? { indicatorColor: updates.indicatorColor } : {}),
        });
      },
      onHeaderClick: (clickedTerminalId) => {
        terminalLogger.info(`🎯 Header clicked for terminal: ${clickedTerminalId}`);
        this.dependencies.coordinator.setActiveTerminalId(clickedTerminalId);
      },
      onCloseClick: (clickedTerminalId) => {
        terminalLogger.info(`🗑️ Header close button clicked: ${clickedTerminalId}`);
        if (this.dependencies.coordinator.deleteTerminalSafely) {
          void this.dependencies.coordinator.deleteTerminalSafely(clickedTerminalId);
        } else {
          this.dependencies.coordinator.closeTerminal(clickedTerminalId);
        }
      },
      onSplitClick: () => {
        terminalLogger.info('⊞ Split button clicked, creating new terminal');
        void this.dependencies.coordinator.profileManager?.createTerminalWithDefaultProfile?.();
      },
      onAiAgentToggleClick: (clickedTerminalId) => {
        terminalLogger.info(`📎 AI Agent toggle clicked for terminal: ${clickedTerminalId}`);
        this.dependencies.coordinator.handleAiAgentToggle?.(clickedTerminalId);
      },
    };
  }

  private insertContainerIntoDom(terminalId: string, container: HTMLElement): void {
    const bodyElement = document.getElementById(ElementIds.TERMINAL_BODY);
    if (!bodyElement) {
      terminalLogger.error(
        `❌ ${ElementIds.TERMINAL_BODY} not found, cannot append container: ${terminalId}`
      );
      throw new Error(`${ElementIds.TERMINAL_BODY} element not found`);
    }

    let terminalsWrapper = document.getElementById(ElementIds.TERMINALS_WRAPPER);
    if (!terminalsWrapper) {
      terminalLogger.info(`🆕 Creating ${ElementIds.TERMINALS_WRAPPER} (not yet initialized)`);
      terminalsWrapper = document.createElement('div');
      terminalsWrapper.id = ElementIds.TERMINALS_WRAPPER;
      terminalsWrapper.style.cssText = `
        display: flex;
        flex: 1 1 auto;
        gap: 4px;
        padding: 4px;
      `;
      bodyElement.appendChild(terminalsWrapper);
    }

    terminalsWrapper.appendChild(container);
    terminalLogger.info(`✅ Container appended to terminals-wrapper: ${terminalId}`);
  }

  private extractTerminalNumber(terminalId: string | undefined): number {
    if (!terminalId) {
      return 1;
    }

    const match = terminalId.match(/terminal-(\d+)/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }

    const existingNumbers = new Set<number>();
    this.dependencies.splitManager.getTerminals().forEach((terminal: TerminalInstance) => {
      if (terminal.number) {
        existingNumbers.add(terminal.number);
      }
    });

    for (let i = 1; i <= Limits.MAX_TERMINAL_NUMBER; i++) {
      if (!existingNumbers.has(i)) {
        return i;
      }
    }

    terminalLogger.warn(
      `Could not extract terminal number from ID: ${terminalId}, defaulting to 1`
    );
    return 1;
  }
}
