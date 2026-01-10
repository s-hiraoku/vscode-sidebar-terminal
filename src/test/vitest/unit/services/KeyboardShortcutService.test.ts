import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyboardShortcutService } from '../../../../services/KeyboardShortcutService';

const commandHandlers = new Map<string, (...args: any[]) => unknown>();

const mocks = vi.hoisted(() => {
  const mockCommands = {
    registerCommand: vi.fn((command: string, handler: (...args: any[]) => unknown) => {
      commandHandlers.set(command, handler);
      return { dispose: vi.fn() };
    }),
  };

  const mockWindow = {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  };

  return {
    mockCommands,
    mockWindow,
  };
});

vi.mock('vscode', () => ({
  commands: mocks.mockCommands,
  window: mocks.mockWindow,
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
    mocks.mockCommands.registerCommand.mockClear();
    mocks.mockWindow.showWarningMessage.mockClear();
    mocks.mockWindow.showErrorMessage.mockClear();

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
});
