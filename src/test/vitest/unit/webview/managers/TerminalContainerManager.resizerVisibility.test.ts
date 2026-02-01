// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalContainerManager } from '../../../../../webview/managers/TerminalContainerManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';


describe('TerminalContainerManager resizer visibility', () => {
  let manager: TerminalContainerManager;
  let terminalBody: HTMLElement;
  let terminalsWrapper: HTMLElement;
  let coordinator: IManagerCoordinator;

  beforeEach(async () => {
    terminalBody = document.createElement('div');
    terminalBody.id = 'terminal-body';
    document.body.appendChild(terminalBody);

    terminalsWrapper = document.createElement('div');
    terminalsWrapper.id = 'terminals-wrapper';
    terminalBody.appendChild(terminalsWrapper);

    coordinator = {
      updatePanelLocationIfNeeded: vi.fn(),
    } as unknown as IManagerCoordinator;

    manager = new TerminalContainerManager(coordinator);
    await manager.initialize();
  });

  afterEach(() => {
    manager.dispose();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('removes stale resizers even when they are not tracked', () => {
    const container = document.createElement('div');
    container.className = 'terminal-container';
    container.dataset.terminalId = 't1';
    manager.registerContainer('t1', container);

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-terminal-wrapper-id', 't1');

    const area = document.createElement('div');
    area.setAttribute('data-terminal-area-id', 't1');
    area.appendChild(container);
    wrapper.appendChild(area);
    terminalsWrapper.appendChild(wrapper);

    // Track wrapper but leave resizers untracked (simulates stale state after restore)
    manager.registerSplitWrapper('t1', wrapper);

    const resizer = document.createElement('div');
    resizer.className = 'split-resizer';
    terminalsWrapper.appendChild(resizer);

    const resizerSet = (manager as any).splitLayoutService.getSplitResizers();
    expect(resizerSet.size).toBe(0);

    manager.clearSplitArtifacts();

    expect(terminalsWrapper.contains(resizer)).toBe(false);
    expect(terminalsWrapper.contains(wrapper)).toBe(false);
    expect(terminalsWrapper.contains(container)).toBe(true);
  });
});
