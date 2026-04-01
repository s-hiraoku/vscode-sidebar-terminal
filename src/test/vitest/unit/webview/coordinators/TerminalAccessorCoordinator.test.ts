import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TerminalAccessorCoordinator,
  type ITerminalAccessorCoordinatorDependencies,
} from '../../../../../webview/coordinators/TerminalAccessorCoordinator';

function createDeps(): ITerminalAccessorCoordinatorDependencies {
  const terminalInstance = {
    terminal: { id: 'terminal-object' },
    fitAddon: { id: 'fit-addon' },
    container: { id: 'terminal-container' },
    serializeAddon: { id: 'serialize-addon' },
  } as any;

  return {
    getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
    getTerminalInstance: vi
      .fn()
      .mockImplementation((id: string) => (id === 'terminal-1' ? terminalInstance : undefined)),
    getAllTerminalInstances: vi.fn().mockReturnValue(new Map([['terminal-1', terminalInstance]])),
    getAllTerminalContainers: vi
      .fn()
      .mockReturnValue(new Map([['terminal-1', terminalInstance.container]])),
    getTerminalElement: vi.fn().mockReturnValue(terminalInstance.container),
    managers: {
      performance: { id: 'performance' } as any,
      input: { id: 'input' } as any,
      ui: { id: 'ui' } as any,
      config: { id: 'config' } as any,
      message: { id: 'message' } as any,
      notification: { id: 'notification' } as any,
      findInTerminal: { id: 'find' } as any,
      profile: { id: 'profile' } as any,
      tabs: { id: 'tabs' } as any,
      persistence: { id: 'persistence' } as any,
      terminalContainer: { id: 'terminalContainer' } as any,
      displayMode: { id: 'displayMode' } as any,
      header: { id: 'header' } as any,
    },
    splitManager: { id: 'splitManager' } as any,
  };
}

describe('TerminalAccessorCoordinator', () => {
  let coordinator: TerminalAccessorCoordinator;
  let deps: ITerminalAccessorCoordinatorDependencies;

  beforeEach(() => {
    deps = createDeps();
    coordinator = new TerminalAccessorCoordinator(deps);
  });

  it('delegates terminal instance and container lookups', () => {
    expect(coordinator.getTerminalInstance('terminal-1')).toBeDefined();
    expect(coordinator.getSerializeAddon('terminal-1')).toEqual({ id: 'serialize-addon' });
    expect(coordinator.getAllTerminalInstances()).toBeInstanceOf(Map);
    expect(coordinator.getAllTerminalContainers()).toBeInstanceOf(Map);
    expect(coordinator.getTerminalElement('terminal-1')).toEqual({ id: 'terminal-container' });
  });

  it('returns grouped managers and direct manager accessors', () => {
    expect(coordinator.getManagers()).toBe(deps.managers);
    expect(coordinator.getMessageManager()).toBe(deps.managers.message);
    expect(coordinator.getTerminalContainerManager()).toBe(deps.managers.terminalContainer);
    expect(coordinator.getDisplayModeManager()).toBe(deps.managers.displayMode);
    expect(coordinator.getSplitManager()).toBe(deps.splitManager);
  });

  it('returns active-terminal derived legacy accessors', () => {
    expect(coordinator.getTerminal()).toEqual({ id: 'terminal-object' });
    expect(coordinator.getFitAddon()).toEqual({ id: 'fit-addon' });
    expect(coordinator.getTerminalContainer()).toEqual({ id: 'terminal-container' });
    expect(coordinator.getActiveTerminalIdValue()).toBe('terminal-1');
  });

  it('returns null legacy accessors when there is no active terminal', () => {
    vi.mocked(deps.getActiveTerminalId).mockReturnValue(null);

    expect(coordinator.getTerminal()).toBeNull();
    expect(coordinator.getFitAddon()).toBeNull();
    expect(coordinator.getTerminalContainer()).toBeNull();
    expect(coordinator.getActiveTerminalIdValue()).toBeNull();
  });
});
