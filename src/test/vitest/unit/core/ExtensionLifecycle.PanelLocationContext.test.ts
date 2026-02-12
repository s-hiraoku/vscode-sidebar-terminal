import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ExtensionLifecycle } from '../../../../core/ExtensionLifecycle';

const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn().mockResolvedValue(undefined),
  registerWebviewViewProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  getExtension: vi.fn().mockReturnValue({ packageJSON: { version: '0.2.23' } }),
  registerCommands: vi.fn(),
  setupSessionAutoSave: vi.fn(),
  loggerLifecycle: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerSetLevel: vi.fn(),
}));

vi.mock('vscode', () => ({
  commands: {
    executeCommand: mocks.executeCommand,
  },
  window: {
    registerWebviewViewProvider: mocks.registerWebviewViewProvider,
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
  },
  extensions: {
    getExtension: mocks.getExtension,
  },
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3,
  },
}));

vi.mock('../../../../utils/logger', () => ({
  extension: vi.fn(),
  logger: {
    lifecycle: mocks.loggerLifecycle,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    info: vi.fn(),
    setLevel: mocks.loggerSetLevel,
  },
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
  },
}));

vi.mock('../../../../providers/SecondaryTerminalProvider', () => ({
  SecondaryTerminalProvider: class {
    static viewType = 'secondaryTerminal';

    constructor(..._args: unknown[]) {}

    setPhase8Services(..._args: unknown[]): void {}

    dispose(): void {}
  },
}));

vi.mock('../../../../terminals/TerminalManager', () => ({
  TerminalManager: class {
    constructor(..._args: unknown[]) {}

    setShellIntegrationService(..._args: unknown[]): void {}

    onTerminalCreated(): { dispose: () => void } { return { dispose: vi.fn() }; }

    onTerminalRemoved(): { dispose: () => void } { return { dispose: vi.fn() }; }

    onTerminalFocus(): { dispose: () => void } { return { dispose: vi.fn() }; }

    dispose(): void {}
  },
}));

vi.mock('../../../../services/persistence/ExtensionPersistenceService', () => ({
  ExtensionPersistenceService: class {
    constructor(..._args: unknown[]) {}

    setSidebarProvider(..._args: unknown[]): void {}

    dispose(): void {}
  },
}));

vi.mock('../../../../commands', () => ({
  FileReferenceCommand: class {
    constructor(..._args: unknown[]) {}
  },
  TerminalCommand: class {
    constructor(..._args: unknown[]) {}
  },
}));

vi.mock('../../../../commands/CopilotIntegrationCommand', () => ({
  CopilotIntegrationCommand: class {
    constructor(..._args: unknown[]) {}
  },
}));

vi.mock('../../../../services/EnhancedShellIntegrationService', () => ({
  EnhancedShellIntegrationService: class {
    constructor(..._args: unknown[]) {}

    setWebviewProvider(..._args: unknown[]): void {}

    dispose(): void {}
  },
}));

vi.mock('../../../../services/KeyboardShortcutService', () => ({
  KeyboardShortcutService: class {
    constructor(..._args: unknown[]) {}

    setWebviewProvider(..._args: unknown[]): void {}

    dispose(): void {}
  },
}));

vi.mock('../../../../services/TerminalDecorationsService', () => ({
  TerminalDecorationsService: class {
    constructor(..._args: unknown[]) {}

    dispose(): void {}
  },
}));

vi.mock('../../../../services/TerminalLinksService', () => ({
  TerminalLinksService: class {
    constructor(..._args: unknown[]) {}

    dispose(): void {}
  },
}));

vi.mock('../../../../services/TelemetryService', () => ({
  TelemetryService: class {
    constructor(..._args: unknown[]) {
      throw new Error('Telemetry unavailable in test');
    }
  },
}));

vi.mock('../../../../core/CommandRegistrar', () => ({
  CommandRegistrar: class {
    constructor(..._args: unknown[]) {}

    registerCommands(..._args: unknown[]): void {
      mocks.registerCommands(..._args);
    }
  },
}));

vi.mock('../../../../core/SessionLifecycleManager', () => ({
  SessionLifecycleManager: class {
    constructor(..._args: unknown[]) {}

    handleSaveSession = vi.fn();

    handleRestoreSession = vi.fn();

    handleClearSession = vi.fn();

    handleTestScrollback = vi.fn();

    diagnoseSessionData = vi.fn();

    saveSimpleSessionOnExit = vi.fn().mockResolvedValue(undefined);

    setupSessionAutoSave(..._args: unknown[]): void {
      mocks.setupSessionAutoSave(..._args);
    }
  },
}));

describe('ExtensionLifecycle - panel location context on activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not set secondaryTerminal.panelLocation context during activation', async () => {
    const lifecycle = new ExtensionLifecycle();
    const context = {
      extensionMode: vscode.ExtensionMode.Development,
      extensionUri: {} as vscode.Uri,
      subscriptions: [] as vscode.Disposable[],
    } as unknown as vscode.ExtensionContext;

    await lifecycle.activate(context);

    const setContextCalls = mocks.executeCommand.mock.calls.filter(
      (call: unknown[]) =>
        call[0] === 'setContext' && call[1] === 'secondaryTerminal.panelLocation'
    );

    expect(setContextCalls).toHaveLength(0);
  });
});
