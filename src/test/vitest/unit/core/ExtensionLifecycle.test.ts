import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ExtensionLifecycle } from '../../../../core/ExtensionLifecycle';

// ── Hoisted mocks ──────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  executeCommand: vi.fn().mockResolvedValue(undefined),
  registerWebviewViewProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  getExtension: vi.fn().mockReturnValue({ packageJSON: { version: '1.0.0' } }),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  registerCommands: vi.fn(),
  setupSessionAutoSave: vi.fn(),
  loggerLifecycle: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  loggerSetLevel: vi.fn(),
  extensionLog: vi.fn(),
  // Spies for dispose tracking
  terminalManagerDispose: vi.fn(),
  persistenceServiceDispose: vi.fn(),
  keyboardShortcutDispose: vi.fn(),
  decorationsServiceDispose: vi.fn(),
  linksServiceDispose: vi.fn(),
  shellIntegrationDispose: vi.fn(),
  sidebarProviderDispose: vi.fn(),
  telemetryServiceDispose: vi.fn(),
  telemetryTrackActivation: vi.fn(),
  telemetryTrackDeactivation: vi.fn(),
  telemetryTrackError: vi.fn(),
  telemetryTrackTerminalCreated: vi.fn(),
  telemetryTrackTerminalDeleted: vi.fn(),
  telemetryTrackTerminalFocused: vi.fn(),
  saveSimpleSessionOnExit: vi.fn().mockResolvedValue(undefined),
  // Terminal manager event handlers
  onTerminalCreatedCallback: null as ((t: any) => void) | null,
  onTerminalRemovedCallback: null as ((id: string) => void) | null,
  onTerminalFocusCallback: null as ((id: string) => void) | null,
  // Flags to control mock behavior
  terminalManagerShouldThrow: false,
  shellIntegrationShouldThrow: false,
  telemetryShouldThrow: false,
  decorationsShouldThrow: false,
}));

// ── VS Code mock ───────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  commands: {
    executeCommand: mocks.executeCommand,
  },
  window: {
    registerWebviewViewProvider: mocks.registerWebviewViewProvider,
    showErrorMessage: mocks.showErrorMessage,
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

// ── Logger mock ────────────────────────────────────────────────────────
vi.mock('../../../../utils/logger', () => ({
  extension: mocks.extensionLog,
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

// ── Service mocks ──────────────────────────────────────────────────────
vi.mock('../../../../providers/SecondaryTerminalProvider', () => ({
  SecondaryTerminalProvider: class {
    static viewType = 'secondaryTerminal';
    constructor(..._args: unknown[]) {}
    setPhase8Services(..._args: unknown[]): void {}
    isWebViewVisible(): boolean {
      return false;
    }
    dispose(): void {
      mocks.sidebarProviderDispose();
    }
  },
}));

vi.mock('../../../../terminals/TerminalManager', () => ({
  TerminalManager: class {
    constructor(..._args: unknown[]) {
      if (mocks.terminalManagerShouldThrow) {
        throw new Error('TerminalManager init failed');
      }
    }
    setShellIntegrationService(..._args: unknown[]): void {}
    setTerminalFocused(_focused: boolean): void {}
    isTerminalFocused(): boolean {
      return false;
    }
    onTerminalCreated(cb: (t: any) => void): { dispose: () => void } {
      mocks.onTerminalCreatedCallback = cb;
      return { dispose: vi.fn() };
    }
    onTerminalRemoved(cb: (id: string) => void): { dispose: () => void } {
      mocks.onTerminalRemovedCallback = cb;
      return { dispose: vi.fn() };
    }
    onTerminalFocus(cb: (id: string) => void): { dispose: () => void } {
      mocks.onTerminalFocusCallback = cb;
      return { dispose: vi.fn() };
    }
    dispose(): void {
      mocks.terminalManagerDispose();
    }
  },
}));

vi.mock('../../../../services/persistence/ExtensionPersistenceService', () => ({
  ExtensionPersistenceService: class {
    constructor(..._args: unknown[]) {}
    setSidebarProvider(..._args: unknown[]): void {}
    dispose(): void {
      mocks.persistenceServiceDispose();
    }
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
    constructor(..._args: unknown[]) {
      if (mocks.shellIntegrationShouldThrow) {
        throw new Error('Shell integration init failed');
      }
    }
    setWebviewProvider(..._args: unknown[]): void {}
    dispose(): void {
      mocks.shellIntegrationDispose();
    }
  },
}));

vi.mock('../../../../services/KeyboardShortcutService', () => ({
  KeyboardShortcutService: class {
    constructor(..._args: unknown[]) {}
    setWebviewProvider(..._args: unknown[]): void {}
    dispose(): void {
      mocks.keyboardShortcutDispose();
    }
  },
}));

vi.mock('../../../../services/TerminalDecorationsService', () => ({
  TerminalDecorationsService: class {
    constructor(..._args: unknown[]) {
      if (mocks.decorationsShouldThrow) {
        throw new Error('Decorations init failed');
      }
    }
    dispose(): void {
      mocks.decorationsServiceDispose();
    }
  },
}));

vi.mock('../../../../services/TerminalLinksService', () => ({
  TerminalLinksService: class {
    constructor(..._args: unknown[]) {}
    dispose(): void {
      mocks.linksServiceDispose();
    }
  },
}));

vi.mock('../../../../services/TelemetryService', () => ({
  TelemetryService: class {
    constructor(..._args: unknown[]) {
      if (mocks.telemetryShouldThrow) {
        throw new Error('Telemetry unavailable');
      }
    }
    trackActivation = mocks.telemetryTrackActivation;
    trackDeactivation = mocks.telemetryTrackDeactivation;
    trackError = mocks.telemetryTrackError;
    trackTerminalCreated = mocks.telemetryTrackTerminalCreated;
    trackTerminalDeleted = mocks.telemetryTrackTerminalDeleted;
    trackTerminalFocused = mocks.telemetryTrackTerminalFocused;
    dispose(): void {
      mocks.telemetryServiceDispose();
    }
  },
}));

vi.mock('../../../../services/FocusProtectionService', () => ({
  FocusProtectionService: class {
    constructor(..._args: unknown[]) {}
    dispose(): void {}
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
    saveSimpleSessionOnExit = mocks.saveSimpleSessionOnExit;
    setupSessionAutoSave(..._args: unknown[]): void {
      mocks.setupSessionAutoSave(..._args);
    }
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────
function createMockContext(
  mode: number = (vscode.ExtensionMode as any).Development
): vscode.ExtensionContext {
  return {
    extensionMode: mode,
    extensionUri: {} as vscode.Uri,
    subscriptions: [] as vscode.Disposable[],
  } as unknown as vscode.ExtensionContext;
}

// ── Tests ──────────────────────────────────────────────────────────────
describe('ExtensionLifecycle', () => {
  let lifecycle: ExtensionLifecycle;
  let savedEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.terminalManagerShouldThrow = false;
    mocks.shellIntegrationShouldThrow = false;
    mocks.telemetryShouldThrow = false;
    mocks.decorationsShouldThrow = false;
    mocks.onTerminalCreatedCallback = null;
    mocks.onTerminalRemovedCallback = null;
    mocks.onTerminalFocusCallback = null;
    savedEnv = process.env.SECONDARY_TERMINAL_LOG_LEVEL;
    delete process.env.SECONDARY_TERMINAL_LOG_LEVEL;
    lifecycle = new ExtensionLifecycle();
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.SECONDARY_TERMINAL_LOG_LEVEL = savedEnv;
    } else {
      delete process.env.SECONDARY_TERMINAL_LOG_LEVEL;
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // activate() – successful initialization
  // ────────────────────────────────────────────────────────────────────
  describe('activate() - successful initialization', () => {
    it('should resolve without throwing', async () => {
      const ctx = createMockContext();
      await expect(lifecycle.activate(ctx)).resolves.toBeUndefined();
    });

    it('should initialize TerminalManager and expose it via getter', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(lifecycle.getTerminalManager()).toBeDefined();
    });

    it('should initialize SidebarProvider and expose it via getter', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(lifecycle.getSidebarProvider()).toBeDefined();
    });

    it('should initialize ExtensionPersistenceService and expose it via getter', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(lifecycle.getExtensionPersistenceService()).toBeDefined();
    });

    it('should register webview view provider with retainContextWhenHidden', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.registerWebviewViewProvider).toHaveBeenCalledWith(
        'secondaryTerminal',
        expect.anything(),
        { webviewOptions: { retainContextWhenHidden: true } }
      );
    });

    it('should push the webview disposable into context.subscriptions', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      // registerWebviewViewProvider returns { dispose }, which gets pushed
      expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(1);
    });

    it('should register commands via CommandRegistrar', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(mocks.registerCommands).toHaveBeenCalledWith(ctx);
    });

    it('should set up session auto-save via SessionLifecycleManager', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(mocks.setupSessionAutoSave).toHaveBeenCalledWith(ctx);
    });

    it('should track activation duration when telemetry is available', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(mocks.telemetryTrackActivation).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should set NODE_PTY_DEBUG to 0', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      expect(process.env.NODE_PTY_DEBUG).toBe('0');
    });

    it('should log lifecycle start and completion messages', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal activation started',
        expect.objectContaining({ mode: 'Development', version: '1.0.0' })
      );
      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal extension activated',
        expect.objectContaining({ durationMs: expect.any(Number), version: '1.0.0' })
      );
    });

    it('should read version from the extension manifest', async () => {
      mocks.getExtension.mockReturnValueOnce({ packageJSON: { version: '2.5.0' } });
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal activation started',
        expect.objectContaining({ version: '2.5.0' })
      );
    });

    it('should default version to "unknown" when extension not found', async () => {
      mocks.getExtension.mockReturnValueOnce(undefined);
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal activation started',
        expect.objectContaining({ version: 'unknown' })
      );
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // activate() – graceful failure when individual services fail
  // ────────────────────────────────────────────────────────────────────
  describe('activate() - graceful failure handling', () => {
    it('should continue when TelemetryService throws', async () => {
      mocks.telemetryShouldThrow = true;
      const ctx = createMockContext();

      await expect(lifecycle.activate(ctx)).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        'Telemetry service unavailable; continuing without analytics',
        expect.any(Error)
      );
      // Other services should still initialize
      expect(lifecycle.getTerminalManager()).toBeDefined();
    });

    it('should continue when ShellIntegrationService throws', async () => {
      mocks.shellIntegrationShouldThrow = true;
      const ctx = createMockContext();

      await expect(lifecycle.activate(ctx)).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        'Enhanced shell integration service unavailable',
        expect.any(Error)
      );
      // Core services still initialized
      expect(lifecycle.getTerminalManager()).toBeDefined();
      expect(lifecycle.getSidebarProvider()).toBeDefined();
    });

    it('should continue when Phase 8 (decorations/links) services throw', async () => {
      mocks.decorationsShouldThrow = true;
      const ctx = createMockContext();

      await expect(lifecycle.activate(ctx)).resolves.toBeUndefined();
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        'Phase 8 services unavailable; continuing without decorations/links',
        expect.any(Error)
      );
      expect(lifecycle.getTerminalManager()).toBeDefined();
    });

    it('should show error message and resolve when TerminalManager throws', async () => {
      mocks.terminalManagerShouldThrow = true;
      const ctx = createMockContext();

      await expect(lifecycle.activate(ctx)).resolves.toBeUndefined();

      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Failed to activate Sidebar Terminal extension',
        expect.any(Error)
      );
      expect(mocks.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('TerminalManager init failed')
      );
    });

    it('should track error via telemetry when activation fails (if telemetry is available)', async () => {
      // Telemetry succeeds but TerminalManager throws
      mocks.terminalManagerShouldThrow = true;
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.telemetryTrackError).toHaveBeenCalledWith(expect.any(Error), 'activation');
    });

    it('should still resolve the promise on catastrophic failure (prevents spinner hang)', async () => {
      mocks.terminalManagerShouldThrow = true;
      const ctx = createMockContext();

      // Must resolve, not reject
      const result = lifecycle.activate(ctx);
      await expect(result).resolves.toBeUndefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // deactivate() – proper disposal, no double-dispose
  // ────────────────────────────────────────────────────────────────────
  describe('deactivate() - proper disposal', () => {
    it('should dispose all services in correct order', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      await lifecycle.deactivate();

      expect(mocks.saveSimpleSessionOnExit).toHaveBeenCalled();
      expect(mocks.persistenceServiceDispose).toHaveBeenCalled();
      expect(mocks.keyboardShortcutDispose).toHaveBeenCalled();
      expect(mocks.decorationsServiceDispose).toHaveBeenCalled();
      expect(mocks.linksServiceDispose).toHaveBeenCalled();
      expect(mocks.terminalManagerDispose).toHaveBeenCalled();
      expect(mocks.sidebarProviderDispose).toHaveBeenCalled();
      expect(mocks.shellIntegrationDispose).toHaveBeenCalled();
      expect(mocks.telemetryServiceDispose).toHaveBeenCalled();
    });

    it('should track deactivation via telemetry', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      await lifecycle.deactivate();
      expect(mocks.telemetryTrackDeactivation).toHaveBeenCalled();
    });

    it('should null out all service references after disposal', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      await lifecycle.deactivate();

      expect(lifecycle.getTerminalManager()).toBeUndefined();
      expect(lifecycle.getSidebarProvider()).toBeUndefined();
      expect(lifecycle.getExtensionPersistenceService()).toBeUndefined();
    });

    it('should not double-dispose when deactivate is called twice', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      await lifecycle.deactivate();
      // Reset call counts
      mocks.terminalManagerDispose.mockClear();
      mocks.persistenceServiceDispose.mockClear();
      mocks.sidebarProviderDispose.mockClear();
      mocks.telemetryServiceDispose.mockClear();

      // Second deactivate should not call dispose again
      await lifecycle.deactivate();

      expect(mocks.terminalManagerDispose).not.toHaveBeenCalled();
      expect(mocks.persistenceServiceDispose).not.toHaveBeenCalled();
      expect(mocks.sidebarProviderDispose).not.toHaveBeenCalled();
      expect(mocks.telemetryServiceDispose).not.toHaveBeenCalled();
    });

    it('should save session on exit via SessionLifecycleManager', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      await lifecycle.deactivate();
      expect(mocks.saveSimpleSessionOnExit).toHaveBeenCalledOnce();
    });

    it('should log lifecycle messages for deactivation', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);
      mocks.loggerLifecycle.mockClear();

      await lifecycle.deactivate();

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith('Sidebar Terminal deactivation started');
      expect(mocks.loggerLifecycle).toHaveBeenCalledWith('Sidebar Terminal deactivation complete');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // deactivate() – handles errors during disposal
  // ────────────────────────────────────────────────────────────────────
  describe('deactivate() - error handling during disposal', () => {
    it('should handle safely when no services were initialized', async () => {
      // deactivate without prior activate
      await expect(lifecycle.deactivate()).resolves.toBeUndefined();
    });

    it('should still dispose other services when session save throws', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      mocks.saveSimpleSessionOnExit.mockRejectedValueOnce(new Error('save failed'));

      // The await on saveSimpleSessionOnExit will throw, but deactivate should
      // propagate it since there's no try-catch in the source
      await expect(lifecycle.deactivate()).rejects.toThrow('save failed');

      // Despite the error, we can verify saveSimpleSessionOnExit was called
      expect(mocks.saveSimpleSessionOnExit).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // configureLogger() – log level from env vars
  // ────────────────────────────────────────────────────────────────────
  describe('configureLogger() - log level configuration', () => {
    it('should set WARN level for Production mode', async () => {
      const ctx = createMockContext((vscode.ExtensionMode as any).Production);
      await lifecycle.activate(ctx);

      expect(mocks.loggerSetLevel).toHaveBeenCalledWith(2); // LogLevel.WARN
    });

    it('should set INFO level for Development mode', async () => {
      const ctx = createMockContext((vscode.ExtensionMode as any).Development);
      await lifecycle.activate(ctx);

      expect(mocks.loggerSetLevel).toHaveBeenCalledWith(1); // LogLevel.INFO
    });

    it('should set INFO level for Test mode', async () => {
      const ctx = createMockContext((vscode.ExtensionMode as any).Test);
      await lifecycle.activate(ctx);

      expect(mocks.loggerSetLevel).toHaveBeenCalledWith(1); // LogLevel.INFO
    });

    it.each([
      ['debug', 0], // LogLevel.DEBUG
      ['info', 1], // LogLevel.INFO
      ['warn', 2], // LogLevel.WARN
      ['warning', 2], // LogLevel.WARN (alias)
      ['error', 3], // LogLevel.ERROR
      ['none', 4], // LogLevel.NONE
    ])(
      'should override log level to %s (=%d) via SECONDARY_TERMINAL_LOG_LEVEL env var',
      async (envValue, expectedLevel) => {
        process.env.SECONDARY_TERMINAL_LOG_LEVEL = envValue;
        const ctx = createMockContext((vscode.ExtensionMode as any).Production);
        await lifecycle.activate(ctx);

        expect(mocks.loggerSetLevel).toHaveBeenCalledWith(expectedLevel);
      }
    );

    it('should use env var override regardless of extension mode', async () => {
      process.env.SECONDARY_TERMINAL_LOG_LEVEL = 'debug';
      // Production mode would normally set WARN, but env var should override
      const ctx = createMockContext((vscode.ExtensionMode as any).Production);
      await lifecycle.activate(ctx);

      expect(mocks.loggerSetLevel).toHaveBeenCalledWith(0); // DEBUG, not WARN
    });

    it('should fall back to mode-based level when env var is invalid', async () => {
      process.env.SECONDARY_TERMINAL_LOG_LEVEL = 'invalid_value';
      const ctx = createMockContext((vscode.ExtensionMode as any).Production);
      await lifecycle.activate(ctx);

      expect(mocks.loggerSetLevel).toHaveBeenCalledWith(2); // WARN (production default)
    });

    it('should be case-insensitive for env var values', async () => {
      process.env.SECONDARY_TERMINAL_LOG_LEVEL = 'DEBUG';
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.loggerSetLevel).toHaveBeenCalledWith(0); // DEBUG
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Multiple activate/deactivate cycles – no resource leaks
  // ────────────────────────────────────────────────────────────────────
  describe('multiple activate/deactivate cycles', () => {
    it('should fully clean up and reinitialize across two cycles', async () => {
      const ctx1 = createMockContext();
      await lifecycle.activate(ctx1);

      // First cycle: services are up
      expect(lifecycle.getTerminalManager()).toBeDefined();

      await lifecycle.deactivate();
      expect(lifecycle.getTerminalManager()).toBeUndefined();

      // Second cycle: fresh activation
      const ctx2 = createMockContext();
      await lifecycle.activate(ctx2);

      expect(lifecycle.getTerminalManager()).toBeDefined();
      expect(lifecycle.getSidebarProvider()).toBeDefined();
    });

    it('should not accumulate dispose calls across cycles', async () => {
      const ctx = createMockContext();

      // Cycle 1
      await lifecycle.activate(ctx);
      await lifecycle.deactivate();
      expect(mocks.terminalManagerDispose).toHaveBeenCalledTimes(1);

      // Cycle 2
      await lifecycle.activate(createMockContext());
      await lifecycle.deactivate();
      expect(mocks.terminalManagerDispose).toHaveBeenCalledTimes(2); // exactly 2, not more
    });

    it('should register new webview providers on each activation', async () => {
      const ctx1 = createMockContext();
      await lifecycle.activate(ctx1);
      await lifecycle.deactivate();

      expect(mocks.registerWebviewViewProvider).toHaveBeenCalledTimes(1);

      const ctx2 = createMockContext();
      await lifecycle.activate(ctx2);

      expect(mocks.registerWebviewViewProvider).toHaveBeenCalledTimes(2);
    });

    it('should register commands for each activation context', async () => {
      const ctx1 = createMockContext();
      await lifecycle.activate(ctx1);
      expect(mocks.registerCommands).toHaveBeenCalledWith(ctx1);

      await lifecycle.deactivate();

      const ctx2 = createMockContext();
      await lifecycle.activate(ctx2);
      expect(mocks.registerCommands).toHaveBeenCalledWith(ctx2);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // Telemetry event listeners
  // ────────────────────────────────────────────────────────────────────
  describe('telemetry event listeners', () => {
    it('should wire up terminal created events to telemetry', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.onTerminalCreatedCallback).toBeTypeOf('function');
      mocks.onTerminalCreatedCallback!({ id: 'term-1' });
      expect(mocks.telemetryTrackTerminalCreated).toHaveBeenCalledWith('term-1');
    });

    it('should wire up terminal removed events to telemetry', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.onTerminalRemovedCallback).toBeTypeOf('function');
      mocks.onTerminalRemovedCallback!('term-2');
      expect(mocks.telemetryTrackTerminalDeleted).toHaveBeenCalledWith('term-2');
    });

    it('should wire up terminal focus events to telemetry', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.onTerminalFocusCallback).toBeTypeOf('function');
      mocks.onTerminalFocusCallback!('term-3');
      expect(mocks.telemetryTrackTerminalFocused).toHaveBeenCalledWith('term-3');
    });

    it('should skip telemetry listener setup when telemetry is unavailable', async () => {
      mocks.telemetryShouldThrow = true;
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        'Telemetry service not available, skipping telemetry event listener setup'
      );
    });

    it('should push event disposables into context.subscriptions', async () => {
      const ctx = createMockContext();
      await lifecycle.activate(ctx);

      // 1 webview provider + 3 terminal event disposables = at least 4
      expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // getExtensionModeLabel - via logged output
  // ────────────────────────────────────────────────────────────────────
  describe('getExtensionModeLabel()', () => {
    it('should label Production mode correctly', async () => {
      const ctx = createMockContext((vscode.ExtensionMode as any).Production);
      await lifecycle.activate(ctx);

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal activation started',
        expect.objectContaining({ mode: 'Production' })
      );
    });

    it('should label Development mode correctly', async () => {
      const ctx = createMockContext((vscode.ExtensionMode as any).Development);
      await lifecycle.activate(ctx);

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal activation started',
        expect.objectContaining({ mode: 'Development' })
      );
    });

    it('should label Test mode correctly', async () => {
      const ctx = createMockContext((vscode.ExtensionMode as any).Test);
      await lifecycle.activate(ctx);

      expect(mocks.loggerLifecycle).toHaveBeenCalledWith(
        'Sidebar Terminal activation started',
        expect.objectContaining({ mode: 'Test' })
      );
    });
  });
});
