import {
  IConfigManager,
  IDisplayModeManager,
  IFindInTerminalManager,
  IHeaderManager,
  IMessageManager,
  IInputManager,
  INotificationManager,
  IPerformanceManager,
  IProfileManager,
  IPersistenceManager,
  ITerminalContainerManager,
  ITerminalTabManager,
  IUIManager,
  TerminalInstance,
} from '../interfaces/ManagerInterfaces';
import { SplitManager } from '../managers/SplitManager';

type ManagerGroup = {
  performance: IPerformanceManager;
  input: IInputManager;
  ui: IUIManager;
  config: IConfigManager;
  message: IMessageManager;
  notification: INotificationManager;
  findInTerminal?: IFindInTerminalManager;
  profile?: IProfileManager;
  tabs?: ITerminalTabManager;
  persistence?: IPersistenceManager;
  terminalContainer?: ITerminalContainerManager;
  displayMode?: IDisplayModeManager;
  header?: IHeaderManager;
};

export interface ITerminalAccessorCoordinatorDependencies {
  getActiveTerminalId(): string | null;
  getTerminalInstance(terminalId: string): TerminalInstance | undefined;
  getAllTerminalInstances(): Map<string, TerminalInstance>;
  getAllTerminalContainers(): Map<string, HTMLElement>;
  getTerminalElement(terminalId: string): HTMLElement | undefined;
  managers: ManagerGroup;
  splitManager: SplitManager;
}

export class TerminalAccessorCoordinator {
  constructor(private readonly deps: ITerminalAccessorCoordinatorDependencies) {}

  public getTerminalInstance(terminalId: string): TerminalInstance | undefined {
    return this.deps.getTerminalInstance(terminalId);
  }

  public getSerializeAddon(terminalId: string) {
    return this.deps.getTerminalInstance(terminalId)?.serializeAddon;
  }

  public getAllTerminalInstances(): Map<string, TerminalInstance> {
    return this.deps.getAllTerminalInstances();
  }

  public getAllTerminalContainers(): Map<string, HTMLElement> {
    return this.deps.getAllTerminalContainers();
  }

  public getTerminalElement(terminalId: string): HTMLElement | undefined {
    return this.deps.getTerminalElement(terminalId);
  }

  public getManagers(): ManagerGroup {
    return this.deps.managers;
  }

  public getMessageManager(): IMessageManager {
    return this.deps.managers.message;
  }

  public getTerminalContainerManager(): ITerminalContainerManager {
    return this.deps.managers.terminalContainer as ITerminalContainerManager;
  }

  public getDisplayModeManager(): IDisplayModeManager {
    return this.deps.managers.displayMode as IDisplayModeManager;
  }

  public getSplitManager(): SplitManager {
    return this.deps.splitManager;
  }

  public getTerminal() {
    const activeId = this.deps.getActiveTerminalId();
    if (!activeId) {
      return null;
    }

    return this.deps.getTerminalInstance(activeId)?.terminal ?? null;
  }

  public getFitAddon() {
    const activeId = this.deps.getActiveTerminalId();
    if (!activeId) {
      return null;
    }

    return this.deps.getTerminalInstance(activeId)?.fitAddon ?? null;
  }

  public getTerminalContainer(): HTMLElement | null {
    const activeId = this.deps.getActiveTerminalId();
    if (!activeId) {
      return null;
    }

    return this.deps.getTerminalInstance(activeId)?.container ?? null;
  }

  public getActiveTerminalIdValue(): string | null {
    return this.deps.getActiveTerminalId();
  }
}
