import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon, { SinonFakeTimers, SinonSpy } from 'sinon';
import { Terminal } from '@xterm/xterm';
import { RefactoredTerminalWebviewManager } from '../../../../webview/managers/RefactoredTerminalWebviewManager';
import { TerminalLifecycleManager } from '../../../../webview/managers/TerminalLifecycleManager';
import { SplitManager } from '../../../../webview/managers/SplitManager';
import { IUIManager, ITerminalTabManager } from '../../../../webview/interfaces/ManagerInterfaces';

describe('RefactoredTerminalWebviewManager ensureSplitModeBeforeTerminalCreation', () => {
  let manager: RefactoredTerminalWebviewManager;
  let showAllTerminalsSplit: SinonSpy;
  let clock: SinonFakeTimers | undefined;

  const createManager = (
    mode: 'normal' | 'fullscreen' | 'split',
    existingTerminals: number
  ): void => {
    manager = Object.create(
      RefactoredTerminalWebviewManager.prototype
    ) as RefactoredTerminalWebviewManager;

    const terminals = new Map<string, unknown>();
    for (let i = 0; i < existingTerminals; i++) {
      terminals.set(`terminal-${i + 1}`, {});
    }

    (manager as any).splitManager = {
      getTerminals: () => terminals,
    };

    showAllTerminalsSplit = sinon.spy();

    (manager as any).displayModeManager = {
      getCurrentMode: () => mode,
      showAllTerminalsSplit,
    };

    (manager as any).pendingSplitTransition = null;
  };

  afterEach(() => {
    if (clock) {
      clock.restore();
      clock = undefined;
    }
  });

  it('switches to split mode and waits before terminal creation when fullscreen with existing terminals', async () => {
    createManager('fullscreen', 3);
    clock = sinon.useFakeTimers();

    const ensurePromise: Promise<void> = (manager as any).ensureSplitModeBeforeTerminalCreation();

    expect(showAllTerminalsSplit.calledOnce).to.be.true;

    let resolved = false;
    ensurePromise.then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).to.be.false;

    await clock.tickAsync(249);
    expect(resolved).to.be.false;

    await clock.tickAsync(1);
    await ensurePromise;
    expect(resolved).to.be.true;
  });

  it('deduplicates concurrent fullscreen transitions', async () => {
    createManager('fullscreen', 2);
    clock = sinon.useFakeTimers();

    const promiseA: Promise<void> = (manager as any).ensureSplitModeBeforeTerminalCreation();
    const promiseB: Promise<void> = (manager as any).ensureSplitModeBeforeTerminalCreation();

    expect(showAllTerminalsSplit.calledOnce).to.be.true;

    await clock.tickAsync(250);
    await Promise.all([promiseA, promiseB]);
  });

  it('returns immediately when already in split mode', async () => {
    createManager('split', 3);
    clock = sinon.useFakeTimers();

    const ensurePromise: Promise<void> = (manager as any).ensureSplitModeBeforeTerminalCreation();

    await ensurePromise;
    expect(showAllTerminalsSplit.notCalled).to.be.true;
  });

  it('skips transition when no existing terminals are registered', async () => {
    createManager('fullscreen', 0);
    clock = sinon.useFakeTimers();

    await (manager as any).ensureSplitModeBeforeTerminalCreation();
    expect(showAllTerminalsSplit.notCalled).to.be.true;
  });
});

describe('RefactoredTerminalWebviewManager createTerminal duplicate handling', () => {
  let manager: RefactoredTerminalWebviewManager;
  let clock: SinonFakeTimers | undefined;

  afterEach(() => {
    if (clock) {
      clock.restore();
      clock = undefined;
    }
  });

  it('reuses existing terminal for extension-sourced creation without duplicating tabs', async () => {
    manager = Object.create(
      RefactoredTerminalWebviewManager.prototype
    ) as RefactoredTerminalWebviewManager;

    clock = sinon.useFakeTimers();

    (manager as any).pendingTerminalCreations = new Set<string>();
    const terminalMock = {
      textarea: {},
      focus: sinon.stub(),
      hasSelection: () => false,
    } as unknown as Terminal;

    const lifecycleGetInstance = sinon.stub();
    lifecycleGetInstance.onFirstCall().returns(undefined);
    lifecycleGetInstance.onSecondCall().returns({ terminal: terminalMock });

    (manager as any).ensureSplitModeBeforeTerminalCreation = sinon.stub().resolves();
    (manager as any).terminalLifecycleManager = {
      createTerminal: sinon.stub().resolves(terminalMock),
      getTerminalInstance: lifecycleGetInstance,
      getTerminalContainers: sinon.stub().returns(new Map()),
      resizeAllTerminals: sinon.stub(),
    } as unknown as TerminalLifecycleManager;

    (manager as any).splitManager = {
      getTerminalContainers: sinon.stub().returns(new Map()),
      getTerminals: sinon.stub().returns(new Map()),
    } as unknown as SplitManager;

    (manager as any).simplePersistenceManager = {
      saveSession: sinon.stub().resolves(true),
    } as any;

    (manager as any).uiManager = {
      updateTerminalBorders: sinon.stub(),
    } as unknown as IUIManager;

    const addTab = sinon.stub();
    const setActiveTab = sinon.stub();
    (manager as any).terminalTabManager = {
      addTab,
      setActiveTab,
      updateTab: sinon.stub(),
    } as unknown as ITerminalTabManager;

    const postMessage = sinon.stub();
    (manager as any).postMessageToExtension = postMessage;

    const firstCreation = manager.createTerminal('terminal-1', 'Terminal 1');
    await clock.tickAsync(300);
    await firstCreation;

    expect(((manager as any).terminalLifecycleManager as any).createTerminal.calledOnce).to.be.true;
    expect(addTab.calledOnce).to.be.true;
    expect(postMessage.calledOnce).to.be.true;

    const extensionCreation = manager.createTerminal('terminal-1', 'Terminal 1', undefined, 1, 'extension');
    await clock.tickAsync(10);
    await extensionCreation;

    expect(((manager as any).terminalLifecycleManager as any).createTerminal.calledOnce).to.be.true;
    expect(addTab.calledOnce).to.be.true;
    expect(postMessage.calledOnce).to.be.true;
    expect(setActiveTab.calledTwice).to.be.true;
  });

  it('ignores extension echo while creation is pending', async () => {
    manager = Object.create(
      RefactoredTerminalWebviewManager.prototype
    ) as RefactoredTerminalWebviewManager;

    clock = sinon.useFakeTimers();

    (manager as any).ensureSplitModeBeforeTerminalCreation = sinon.stub().resolves();

    (manager as any).pendingTerminalCreations = new Set<string>();
    const terminalMock = {
      textarea: {},
      focus: sinon.stub(),
      hasSelection: () => false,
    } as unknown as Terminal;

    let resolveCreation!: (value: Terminal) => void;
    const deferredCreation = new Promise<Terminal>((resolve) => {
      resolveCreation = resolve;
    });

    (manager as any).terminalLifecycleManager = {
      createTerminal: sinon.stub().returns(deferredCreation),
      getTerminalInstance: sinon.stub().returns(undefined),
      getTerminalContainers: sinon.stub().returns(new Map()),
      resizeAllTerminals: sinon.stub(),
    } as unknown as TerminalLifecycleManager;

    (manager as any).splitManager = {
      getTerminalContainers: sinon.stub().returns(new Map()),
      getTerminals: sinon.stub().returns(new Map()),
    } as unknown as SplitManager;

    (manager as any).simplePersistenceManager = {
      saveSession: sinon.stub().resolves(true),
    } as any;

    (manager as any).uiManager = {
      updateTerminalBorders: sinon.stub(),
    } as unknown as IUIManager;

    const addTab = sinon.stub();
    const setActiveTab = sinon.stub();
    (manager as any).terminalTabManager = {
      addTab,
      setActiveTab,
      updateTab: sinon.stub(),
    } as unknown as ITerminalTabManager;

    const postMessage = sinon.stub();
    (manager as any).postMessageToExtension = postMessage;

    const webviewCreation = manager.createTerminal('terminal-pending', 'Terminal Pending');
    await clock.tickAsync(0);

    const extensionEcho = await manager.createTerminal(
      'terminal-pending',
      'Terminal Pending',
      undefined,
      2,
      'extension'
    );

    expect(extensionEcho).to.be.null;
    expect(addTab.notCalled).to.be.true;
    expect(postMessage.calledOnce).to.be.true;

    resolveCreation(terminalMock);
    await webviewCreation;
    await clock.tickAsync(100);

    expect(addTab.calledOnce).to.be.true;
    expect(setActiveTab.calledOnce).to.be.true;
    expect(((manager as any).terminalLifecycleManager as any).createTerminal.calledOnce).to.be.true;
  });

});
