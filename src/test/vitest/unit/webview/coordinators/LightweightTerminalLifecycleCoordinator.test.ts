import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LightweightTerminalLifecycleCoordinator } from '../../../../../webview/coordinators/LightweightTerminalLifecycleCoordinator';

describe('LightweightTerminalLifecycleCoordinator', () => {
  let coordinator: LightweightTerminalLifecycleCoordinator;
  let dependencies: any;

  beforeEach(() => {
    vi.useFakeTimers();

    dependencies = {
      terminalOperations: {
        isTerminalCreationPending: vi.fn().mockReturnValue(false),
        markTerminalCreationPending: vi.fn(),
        clearTerminalCreationPending: vi.fn(),
      },
      terminalLifecycleManager: {
        createTerminal: vi.fn().mockResolvedValue({
          textarea: { hasAttribute: () => false },
          focus: vi.fn(),
        }),
        removeTerminal: vi.fn().mockResolvedValue(true),
        switchToTerminal: vi.fn().mockResolvedValue(true),
        resizeAllTerminals: vi.fn(),
      },
      terminalTabManager: {
        addTab: vi.fn(),
        setActiveTab: vi.fn(),
        removeTab: vi.fn(),
      },
      webViewPersistenceService: {
        addTerminal: vi.fn(),
        removeTerminal: vi.fn(),
        saveSession: vi.fn().mockResolvedValue(true),
      },
      splitManager: {
        getTerminals: vi.fn().mockReturnValue(new Map()),
        getTerminalContainers: vi.fn().mockReturnValue(new Map()),
        getIsSplitMode: vi.fn().mockReturnValue(false),
      },
      displayModeManager: {
        getCurrentMode: vi.fn().mockReturnValue('normal'),
        setDisplayMode: vi.fn(),
        showAllTerminalsSplit: vi.fn(),
      },
      uiManager: {
        updateTerminalBorders: vi.fn(),
      },
      cliAgentStateManager: {
        removeTerminalState: vi.fn(),
      },
      getTerminalInstance: vi.fn().mockReturnValue(undefined),
      getActiveTerminalId: vi.fn().mockReturnValue('active-1'),
      setActiveTerminalId: vi.fn(),
      canCreateTerminal: vi.fn().mockReturnValue(true),
      getCurrentTerminalState: vi.fn().mockReturnValue(null),
      getForceNormalModeForNextCreate: vi.fn().mockReturnValue(false),
      setForceNormalModeForNextCreate: vi.fn(),
      getForceFullscreenModeForNextCreate: vi.fn().mockReturnValue(false),
      setForceFullscreenModeForNextCreate: vi.fn(),
      requestLatestState: vi.fn(),
      showTerminalLimitMessage: vi.fn(),
      postMessageToExtension: vi.fn(),
    };

    coordinator = new LightweightTerminalLifecycleCoordinator(dependencies);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('skips duplicate terminal creation requests that are already pending', async () => {
    const existingTerminal = { focus: vi.fn() };
    dependencies.terminalOperations.isTerminalCreationPending.mockReturnValue(true);
    dependencies.getTerminalInstance.mockReturnValue({ terminal: existingTerminal });

    const terminal = await coordinator.createTerminal({
      terminalId: 'terminal-1',
      terminalName: 'Terminal 1',
      config: undefined,
      terminalNumber: undefined,
      requestSource: 'webview',
    });

    expect(terminal).toBe(existingTerminal);
    expect(dependencies.terminalLifecycleManager.createTerminal).not.toHaveBeenCalled();
    expect(dependencies.terminalOperations.markTerminalCreationPending).not.toHaveBeenCalled();
  });

  it('creates a terminal and performs tab, persistence, and extension post-processing', async () => {
    const terminal = await coordinator.createTerminal({
      terminalId: 'terminal-2',
      terminalName: 'Terminal 2',
      config: undefined,
      terminalNumber: undefined,
      requestSource: 'webview',
    });

    await vi.advanceTimersByTimeAsync(200);

    expect(terminal).toBeDefined();
    expect(dependencies.terminalOperations.markTerminalCreationPending).toHaveBeenCalledWith(
      'terminal-2'
    );
    expect(dependencies.terminalLifecycleManager.createTerminal).toHaveBeenCalledWith(
      'terminal-2',
      'Terminal 2',
      undefined,
      undefined
    );
    expect(dependencies.terminalTabManager.addTab).toHaveBeenCalledWith(
      'terminal-2',
      'Terminal 2',
      expect.anything()
    );
    expect(dependencies.webViewPersistenceService.addTerminal).toHaveBeenCalledWith(
      'terminal-2',
      expect.anything(),
      { autoSave: true }
    );
    expect(dependencies.postMessageToExtension).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'createTerminal', terminalId: 'terminal-2' })
    );
    expect(dependencies.terminalOperations.clearTerminalCreationPending).toHaveBeenCalledWith(
      'terminal-2'
    );
  });

  it('removes a terminal and schedules session persistence refresh', async () => {
    const result = await coordinator.removeTerminal('terminal-3');

    expect(result).toBe(true);
    expect(dependencies.cliAgentStateManager.removeTerminalState).toHaveBeenCalledWith(
      'terminal-3'
    );
    expect(dependencies.webViewPersistenceService.removeTerminal).toHaveBeenCalledWith(
      'terminal-3'
    );
    expect(dependencies.terminalTabManager.removeTab).toHaveBeenCalledWith('terminal-3');
    expect(dependencies.terminalLifecycleManager.removeTerminal).toHaveBeenCalledWith('terminal-3');

    await vi.advanceTimersByTimeAsync(100);
    expect(dependencies.webViewPersistenceService.saveSession).toHaveBeenCalled();
  });

  it('updates borders after a successful terminal switch', async () => {
    const result = await coordinator.switchToTerminal('terminal-4');

    expect(result).toBe(true);
    expect(dependencies.terminalLifecycleManager.switchToTerminal).toHaveBeenCalledWith(
      'terminal-4'
    );
    expect(dependencies.uiManager.updateTerminalBorders).toHaveBeenCalledWith(
      'terminal-4',
      expect.any(Map)
    );
  });

  it('prepares display for deletion by exiting fullscreen when multiple terminals exist', () => {
    dependencies.displayModeManager.getCurrentMode.mockReturnValue('fullscreen');

    coordinator.prepareDisplayForTerminalDeletion('terminal-5', {
      totalTerminals: 2,
      activeTerminalId: 'terminal-5',
      terminalIds: ['terminal-5', 'terminal-6'],
    });

    expect(dependencies.displayModeManager.setDisplayMode).toHaveBeenCalledWith('split');
  });
});
