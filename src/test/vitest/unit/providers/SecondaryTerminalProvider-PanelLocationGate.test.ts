import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecondaryTerminalProvider } from '../../../../providers/SecondaryTerminalProvider';
import * as vscode from 'vscode';

const mocks = vi.hoisted(() => ({
  mockDisposable: { dispose: vi.fn() },
  mockExecuteCommand: vi.fn().mockResolvedValue(undefined),
}));

const mockWebview = {
  html: '',
  options: {},
  onDidReceiveMessage: vi.fn().mockReturnValue(mocks.mockDisposable),
  postMessage: vi.fn().mockResolvedValue(true),
  asWebviewUri: vi.fn((uri: unknown) => uri),
  cspSource: 'mock-csp-source',
};

const mockWebviewView = {
  webview: mockWebview,
  visible: true,
  onDidDispose: vi.fn().mockReturnValue(mocks.mockDisposable),
  onDidChangeVisibility: vi.fn().mockReturnValue(mocks.mockDisposable),
  show: vi.fn(),
};

const mockUri = {
  fsPath: '/mock/extension/path',
  scheme: 'file',
  path: '/mock/extension/path',
  with: vi.fn().mockReturnThis(),
  toString: vi.fn().mockReturnValue('file:///mock/extension/path'),
};

const mockContext = {
  extensionUri: mockUri,
  subscriptions: [] as unknown[],
};

const mockTerminalInfo = {
  id: 'terminal-1',
  name: 'Terminal 1',
  isActive: true,
  pid: 12345,
  cwd: '/tmp',
};

const mockTerminalManager = {
  getTerminals: vi.fn().mockReturnValue([mockTerminalInfo]),
  getTerminal: vi.fn().mockReturnValue(mockTerminalInfo),
  createTerminal: vi.fn().mockReturnValue('terminal-1'),
  killTerminal: vi.fn().mockResolvedValue(undefined),
  setActiveTerminal: vi.fn(),
  renameTerminal: vi.fn().mockReturnValue(true),
  updateTerminalHeader: vi.fn().mockReturnValue(true),
  getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
  onData: vi.fn().mockReturnValue(mocks.mockDisposable),
  onExit: vi.fn().mockReturnValue(mocks.mockDisposable),
  onTerminalCreated: vi.fn().mockReturnValue(mocks.mockDisposable),
  onTerminalRemoved: vi.fn().mockReturnValue(mocks.mockDisposable),
  onStateUpdate: vi.fn().mockReturnValue(mocks.mockDisposable),
  onTerminalFocus: vi.fn().mockReturnValue(mocks.mockDisposable),
  onCliAgentStatusChange: vi.fn().mockReturnValue(mocks.mockDisposable),
  getCurrentState: vi.fn().mockReturnValue({ terminals: [mockTerminalInfo], activeTerminalId: 'terminal-1' }),
  getConnectedAgentTerminalId: vi.fn().mockReturnValue('terminal-1'),
  getConnectedAgentType: vi.fn().mockReturnValue('claude'),
  getDisconnectedAgents: vi.fn().mockReturnValue(new Map()),
  initializeShellForTerminal: vi.fn().mockResolvedValue(undefined),
};

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'dynamicSplitDirection') return true;
        if (key === 'panelLocation') return 'auto';
        return defaultValue;
      }),
      update: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockReturnValue(true),
      inspect: vi.fn().mockReturnValue({ globalValue: undefined, workspaceValue: undefined }),
    }),
    onDidChangeConfiguration: vi.fn().mockReturnValue(mocks.mockDisposable),
  },
  window: {
    onDidChangeActiveColorTheme: vi.fn().mockReturnValue(mocks.mockDisposable),
    activeColorTheme: { kind: 2 },
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
  },
  commands: {
    executeCommand: mocks.mockExecuteCommand,
  },
  Uri: {
    file: vi.fn((p: string) => ({ ...mockUri, fsPath: p, path: p })),
    joinPath: vi.fn((base: typeof mockUri, ...paths: string[]) => ({
      ...mockUri,
      fsPath: `${base.fsPath}/${paths.join('/')}`,
      path: `${base.path}/${paths.join('/')}`,
    })),
  },
  ColorThemeKind: { Light: 1, Dark: 2, HighContrast: 3, HighContrastLight: 4 },
  EventEmitter: vi.fn().mockImplementation(() => ({
    event: vi.fn(),
    fire: vi.fn(),
    dispose: vi.fn(),
  })),
  Disposable: {
    from: vi.fn((...disposables: Array<{ dispose?: () => void }>) => ({
      dispose: () => disposables.forEach((d) => d?.dispose?.()),
    })),
  },
}));

describe('SecondaryTerminalProvider - Panel Location Response Gate', () => {
  let provider: SecondaryTerminalProvider;
  let messageHandler: ((message: unknown) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (vscode.workspace.getConfiguration as any).mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'dynamicSplitDirection') return true;
        if (key === 'panelLocation') return 'auto';
        return defaultValue;
      }),
      update: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockReturnValue(true),
      inspect: vi.fn().mockReturnValue({ globalValue: undefined, workspaceValue: undefined }),
    });

    mockWebview.onDidReceiveMessage = vi.fn().mockImplementation((handler) => {
      messageHandler = handler;
      return mocks.mockDisposable;
    });

    provider = new SecondaryTerminalProvider(mockContext as never, mockTerminalManager as never);
    provider.resolveWebviewView(mockWebviewView as never, {} as never, {} as never);
  });

  afterEach(() => {
    provider.dispose();
    vi.useRealTimers();
  });

  it('should ignore reportPanelLocation when no detection was requested', async () => {
    const handleReportSpy = vi.spyOn((provider as any)._panelLocationService, 'handlePanelLocationReport');

    await messageHandler?.({ command: 'reportPanelLocation', location: 'panel' });

    expect(handleReportSpy).not.toHaveBeenCalled();
  });

  it('should accept reportPanelLocation after explicit detection request', async () => {
    const handleReportSpy = vi.spyOn((provider as any)._panelLocationService, 'handlePanelLocationReport');

    (provider as any)._requestPanelLocationDetection();
    await messageHandler?.({ command: 'reportPanelLocation', location: 'panel' });

    expect(handleReportSpy).toHaveBeenCalledTimes(1);
    expect(handleReportSpy).toHaveBeenCalledWith('panel');
  });

  it('should ignore late reportPanelLocation after request timeout', async () => {
    const handleReportSpy = vi.spyOn((provider as any)._panelLocationService, 'handlePanelLocationReport');

    (provider as any)._requestPanelLocationDetection();
    vi.advanceTimersByTime(3000);
    await messageHandler?.({ command: 'reportPanelLocation', location: 'panel' });

    expect(handleReportSpy).not.toHaveBeenCalled();
  });

  it('should not start detection request in manual panelLocation mode', async () => {
    (vscode.workspace.getConfiguration as any).mockReturnValue({
      get: vi.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'dynamicSplitDirection') return true;
        if (key === 'panelLocation') return 'sidebar';
        return defaultValue;
      }),
      update: vi.fn().mockResolvedValue(undefined),
      has: vi.fn().mockReturnValue(true),
      inspect: vi.fn().mockReturnValue({ globalValue: undefined, workspaceValue: undefined }),
    });

    const handleReportSpy = vi.spyOn((provider as any)._panelLocationService, 'handlePanelLocationReport');

    (provider as any)._requestPanelLocationDetection();
    await messageHandler?.({ command: 'reportPanelLocation', location: 'panel' });

    expect(handleReportSpy).not.toHaveBeenCalled();
  });
});
