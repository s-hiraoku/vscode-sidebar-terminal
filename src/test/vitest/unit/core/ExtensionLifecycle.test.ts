import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionLifecycle } from '../../../../core/ExtensionLifecycle';
import * as vscode from 'vscode';

// Mock dependencies
const mockTerminalManager = {
  dispose: vi.fn(),
  setShellIntegrationService: vi.fn(),
  onTerminalCreated: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onTerminalRemoved: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onTerminalFocus: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

const mockSidebarProvider = {
  dispose: vi.fn(),
  setPhase8Services: vi.fn(),
};

const mockPersistenceService = {
  dispose: vi.fn(),
  setSidebarProvider: vi.fn(),
};

const mockTelemetryService = {
  trackActivation: vi.fn(),
  trackDeactivation: vi.fn(),
  trackError: vi.fn(),
  dispose: vi.fn(),
};

const mockShellIntegrationService = {
  setWebviewProvider: vi.fn(),
  dispose: vi.fn(),
};

const mockKeyboardShortcutService = {
  setWebviewProvider: vi.fn(),
  dispose: vi.fn(),
};

const mockSessionLifecycleManager = {
  handleSaveSession: vi.fn(),
  handleRestoreSession: vi.fn(),
  handleClearSession: vi.fn(),
  handleTestScrollback: vi.fn(),
  diagnoseSessionData: vi.fn(),
  setupSessionAutoSave: vi.fn(),
  saveSimpleSessionOnExit: vi.fn(),
};

const mockCommandRegistrar = {
  registerCommands: vi.fn(),
};

// Mock Constructors
vi.mock('../../../../terminals/TerminalManager', () => ({
  TerminalManager: class {
    dispose = mockTerminalManager.dispose;
    setShellIntegrationService = mockTerminalManager.setShellIntegrationService;
    onTerminalCreated = mockTerminalManager.onTerminalCreated;
    onTerminalRemoved = mockTerminalManager.onTerminalRemoved;
    onTerminalFocus = mockTerminalManager.onTerminalFocus;
  },
}));

vi.mock('../../../../providers/SecondaryTerminalProvider', () => ({
  SecondaryTerminalProvider: class {
    static viewType = 'secondaryTerminal';
    dispose = mockSidebarProvider.dispose;
    setPhase8Services = mockSidebarProvider.setPhase8Services;
  },
}));

vi.mock('../../../../services/persistence/ExtensionPersistenceService', () => ({
  ExtensionPersistenceService: class {
    dispose = mockPersistenceService.dispose;
    setSidebarProvider = mockPersistenceService.setSidebarProvider;
  },
}));

vi.mock('../../../../services/TelemetryService', () => ({
  TelemetryService: class {
    trackActivation = mockTelemetryService.trackActivation;
    trackDeactivation = mockTelemetryService.trackDeactivation;
    trackError = mockTelemetryService.trackError;
    dispose = mockTelemetryService.dispose;
  },
}));

vi.mock('../../../../services/EnhancedShellIntegrationService', () => ({
  EnhancedShellIntegrationService: class {
    setWebviewProvider = mockShellIntegrationService.setWebviewProvider;
    dispose = mockShellIntegrationService.dispose;
  },
}));

vi.mock('../../../../services/KeyboardShortcutService', () => ({
  KeyboardShortcutService: class {
    setWebviewProvider = mockKeyboardShortcutService.setWebviewProvider;
    dispose = mockKeyboardShortcutService.dispose;
  },
}));

vi.mock('../../../../services/TerminalDecorationsService', () => ({
  TerminalDecorationsService: class {
    dispose = vi.fn();
  },
}));

vi.mock('../../../../services/TerminalLinksService', () => ({
  TerminalLinksService: class {
    dispose = vi.fn();
  },
}));

vi.mock('../../../../core/SessionLifecycleManager', () => ({
  SessionLifecycleManager: class {
    handleSaveSession = mockSessionLifecycleManager.handleSaveSession;
    handleRestoreSession = mockSessionLifecycleManager.handleRestoreSession;
    handleClearSession = mockSessionLifecycleManager.handleClearSession;
    handleTestScrollback = mockSessionLifecycleManager.handleTestScrollback;
    diagnoseSessionData = mockSessionLifecycleManager.diagnoseSessionData;
    setupSessionAutoSave = mockSessionLifecycleManager.setupSessionAutoSave;
    saveSimpleSessionOnExit = mockSessionLifecycleManager.saveSimpleSessionOnExit;
  },
}));

vi.mock('../../../../core/CommandRegistrar', () => ({
  CommandRegistrar: class {
    registerCommands = mockCommandRegistrar.registerCommands;
  },
}));

vi.mock('../../../../commands', () => ({
  FileReferenceCommand: class {},
  TerminalCommand: class {},
}));

vi.mock('../../../../commands/CopilotIntegrationCommand', () => ({
  CopilotIntegrationCommand: class {},
}));

// Mock VS Code
vi.mock('vscode', () => ({
  ExtensionMode: { Production: 1, Development: 2, Test: 3 },
  window: {
    registerWebviewViewProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    showErrorMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  extensions: {
    getExtension: vi.fn().mockReturnValue({ packageJSON: { version: '1.0.0' } }),
  },
}));

describe('ExtensionLifecycle', () => {
  let lifecycle: ExtensionLifecycle;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    vi.clearAllMocks();
    lifecycle = new ExtensionLifecycle();
    mockContext = {
      subscriptions: [],
      extensionMode: vscode.ExtensionMode.Production,
    } as unknown as vscode.ExtensionContext;
  });

  describe('activate', () => {
    it('should initialize all services and register provider', async () => {
      await lifecycle.activate(mockContext);

      // Check initialization
      expect(mockTerminalManager.setShellIntegrationService).toHaveBeenCalled();
      expect(mockPersistenceService.setSidebarProvider).toHaveBeenCalled();
      expect(mockKeyboardShortcutService.setWebviewProvider).toHaveBeenCalled();
      expect(mockShellIntegrationService.setWebviewProvider).toHaveBeenCalled();
      expect(mockSidebarProvider.setPhase8Services).toHaveBeenCalled();

      // Check command registration
      expect(mockCommandRegistrar.registerCommands).toHaveBeenCalled();

      // Check session setup
      expect(mockSessionLifecycleManager.setupSessionAutoSave).toHaveBeenCalled();

      // Check provider registration
      expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
        'secondaryTerminal',
        mockSidebarProvider,
        expect.any(Object)
      );

      // Check telemetry
      expect(mockTelemetryService.trackActivation).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Force an error in initialization
      (vscode.window.registerWebviewViewProvider as any).mockImplementationOnce(() => {
        throw new Error('Registration failed');
      });

      await lifecycle.activate(mockContext);

      expect(mockTelemetryService.trackError).toHaveBeenCalledWith(
        expect.any(Error),
        'activation'
      );
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should dispose all services in reverse order', async () => {
      // First activate to initialize services
      await lifecycle.activate(mockContext);
      
      // Then deactivate
      await lifecycle.deactivate();

      expect(mockSessionLifecycleManager.saveSimpleSessionOnExit).toHaveBeenCalled();
      expect(mockPersistenceService.dispose).toHaveBeenCalled();
      expect(mockKeyboardShortcutService.dispose).toHaveBeenCalled();
      expect(mockTerminalManager.dispose).toHaveBeenCalled();
      expect(mockSidebarProvider.dispose).toHaveBeenCalled();
      expect(mockShellIntegrationService.dispose).toHaveBeenCalled();
      expect(mockTelemetryService.dispose).toHaveBeenCalled();
      expect(mockTelemetryService.trackDeactivation).toHaveBeenCalled();
    });
  });

  describe('Accessors', () => {
    it('should return initialized instances', async () => {
      await lifecycle.activate(mockContext);

      expect(lifecycle.getTerminalManager()).toBeDefined();
      expect(lifecycle.getSidebarProvider()).toBeDefined();
      expect(lifecycle.getExtensionPersistenceService()).toBeDefined();
    });
  });
});
