import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcutService } from '../../../../services/KeyboardShortcutService';

const commandHandlers = new Map<string, (...args: any[]) => unknown>();

const configChangeListeners: Array<(e: any) => void> = [];

const mocks = vi.hoisted(() => {
  const mockCommands = {
    registerCommand: vi.fn((command: string, handler: (...args: any[]) => unknown) => {
      commandHandlers.set(command, handler);
      return { dispose: vi.fn() };
    }),
    executeCommand: vi.fn(),
  };

  const mockWindow = {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  };

  const mockWorkspace = {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
    onDidChangeConfiguration: vi.fn((listener: (e: any) => void) => {
      configChangeListeners.push(listener);
      return { dispose: vi.fn() };
    }),
  };

  return {
    mockCommands,
    mockWindow,
    mockWorkspace,
  };
});

vi.mock('vscode', () => ({
  commands: mocks.mockCommands,
  window: mocks.mockWindow,
  workspace: mocks.mockWorkspace,
}));

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('KeyboardShortcutService', () => {
  let terminalManager: any;
  let service: KeyboardShortcutService;
  let webviewProvider: { sendMessageToWebview: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commandHandlers.clear();
    configChangeListeners.length = 0;
    mocks.mockCommands.registerCommand.mockClear();
    mocks.mockCommands.executeCommand.mockClear();
    mocks.mockWindow.showWarningMessage.mockClear();
    mocks.mockWindow.showErrorMessage.mockClear();
    mocks.mockWorkspace.getConfiguration.mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    });
    mocks.mockWorkspace.onDidChangeConfiguration.mockClear();
    mocks.mockWorkspace.onDidChangeConfiguration.mockImplementation((listener: (e: any) => void) => {
      configChangeListeners.push(listener);
      return { dispose: vi.fn() };
    });

    terminalManager = {
      getDefaultProfile: vi.fn().mockReturnValue(null),
      createTerminal: vi.fn().mockReturnValue('terminal-1'),
      createTerminalWithProfile: vi.fn().mockResolvedValue('terminal-2'),
      setActiveTerminal: vi.fn(),
    };

    webviewProvider = {
      sendMessageToWebview: vi.fn(),
    };

    service = new KeyboardShortcutService(terminalManager);
    service.setWebviewProvider(webviewProvider as any);
  });

  afterEach(() => {
    service.dispose();
  });

  it('should create terminal with fullscreen display override when no default profile', async () => {
    await (service as any).createTerminal();

    expect(terminalManager.createTerminal).toHaveBeenCalledWith({
      displayModeOverride: 'fullscreen',
    });
    expect(terminalManager.setActiveTerminal).toHaveBeenCalledWith('terminal-1');
    expect(webviewProvider.sendMessageToWebview).toHaveBeenCalledWith({
      command: 'setDisplayMode',
      mode: 'fullscreen',
      forceNextCreate: true,
    });
  });

  it('should create terminal with fullscreen display override when default profile exists', async () => {
    terminalManager.getDefaultProfile.mockReturnValue('bash');

    await (service as any).createTerminal();

    expect(terminalManager.createTerminalWithProfile).toHaveBeenCalledWith('bash', {
      displayModeOverride: 'fullscreen',
    });
    expect(terminalManager.setActiveTerminal).toHaveBeenCalledWith('terminal-2');
    expect(webviewProvider.sendMessageToWebview).toHaveBeenCalledWith({
      command: 'setDisplayMode',
      mode: 'fullscreen',
      forceNextCreate: true,
    });
  });

  it('should toggle panel navigation mode context via command', async () => {
    const handler = commandHandlers.get('secondaryTerminal.togglePanelNavigationMode');
    expect(handler).toBeDefined();

    await handler?.();
    expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'secondaryTerminal.panelNavigationMode',
      true
    );
    expect(webviewProvider.sendMessageToWebview).toHaveBeenCalledWith({
      command: 'panelNavigationMode',
      enabled: true,
    });

    await handler?.();
    expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
      'setContext',
      'secondaryTerminal.panelNavigationMode',
      false
    );
    expect(webviewProvider.sendMessageToWebview).toHaveBeenCalledWith({
      command: 'panelNavigationMode',
      enabled: false,
    });
  });

  it('should exit panel navigation mode context via command', async () => {
    const toggleHandler = commandHandlers.get('secondaryTerminal.togglePanelNavigationMode');
    const exitHandler = commandHandlers.get('secondaryTerminal.exitPanelNavigationMode');
    expect(toggleHandler).toBeDefined();
    expect(exitHandler).toBeDefined();

    await toggleHandler?.();
    await exitHandler?.();

    expect(mocks.mockCommands.executeCommand).toHaveBeenLastCalledWith(
      'setContext',
      'secondaryTerminal.panelNavigationMode',
      false
    );
    expect(webviewProvider.sendMessageToWebview).toHaveBeenLastCalledWith({
      command: 'panelNavigationMode',
      enabled: false,
    });
  });

  describe('Panel Navigation Enabled', () => {
    it('should initialize panel navigation enabled context key from settings (default: false)', () => {
      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelNavigation.enabled',
        false
      );
    });

    it('should initialize panel navigation enabled context key as true when setting is enabled', () => {
      mocks.mockCommands.executeCommand.mockClear();
      mocks.mockWorkspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      });

      const svc = new KeyboardShortcutService(terminalManager);
      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelNavigation.enabled',
        true
      );
      svc.dispose();
    });

    it('should update panel navigation enabled context key when configuration changes', () => {
      mocks.mockWorkspace.getConfiguration.mockReturnValue({
        get: vi.fn().mockReturnValue(true),
      });

      const event = {
        affectsConfiguration: (key: string) =>
          key === 'secondaryTerminal.panelNavigation.enabled',
      };
      configChangeListeners.forEach((listener) => listener(event));

      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelNavigation.enabled',
        true
      );
    });

    it('should not react to unrelated configuration changes', () => {
      mocks.mockCommands.executeCommand.mockClear();

      const event = {
        affectsConfiguration: (key: string) => key === 'editor.fontSize',
      };
      configChangeListeners.forEach((listener) => listener(event));

      expect(mocks.mockCommands.executeCommand).not.toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelNavigation.enabled',
        expect.anything()
      );
    });

    it('should clear panel navigation enabled context key on dispose', () => {
      service.dispose();

      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'secondaryTerminal.panelNavigation.enabled',
        false
      );
    });
  });
});
