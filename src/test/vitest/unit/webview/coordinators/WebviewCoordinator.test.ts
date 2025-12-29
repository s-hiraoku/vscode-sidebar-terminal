/**
 * WebviewCoordinator Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import '../../../../shared/TestSetup';
import { WebviewCoordinator } from '../../../../../webview/coordinators/WebviewCoordinator';
import { MessageCommand } from '../../../../../webview/managers/messageTypes';

const createHandler = () => ({ handleMessage: vi.fn() });

const createSessionController = () => ({
  handleSessionRestoreMessage: vi.fn().mockResolvedValue(undefined),
  handleSessionRestoreStartedMessage: vi.fn(),
  handleSessionRestoreProgressMessage: vi.fn(),
  handleSessionRestoreCompletedMessage: vi.fn(),
  handleSessionRestoreErrorMessage: vi.fn(),
  handleSessionSavedMessage: vi.fn(),
  handleSessionSaveErrorMessage: vi.fn(),
  handleSessionClearedMessage: vi.fn(),
  handleSessionRestoredMessage: vi.fn(),
  handleSessionRestoreSkippedMessage: vi.fn(),
  handleTerminalRestoreErrorMessage: vi.fn(),
});

const createCliAgentController = () => ({
  handleStatusUpdateMessage: vi.fn(),
  handleFullStateSyncMessage: vi.fn(),
  handleSwitchResponseMessage: vi.fn(),
});

describe('WebviewCoordinator', () => {
  let coordinator: WebviewCoordinator;
  let lifecycleHandler: ReturnType<typeof createHandler>;
  let settingsHandler: ReturnType<typeof createHandler>;
  let shellHandler: ReturnType<typeof createHandler>;
  let serializationHandler: ReturnType<typeof createHandler>;
  let scrollbackHandler: ReturnType<typeof createHandler>;
  let panelHandler: ReturnType<typeof createHandler>;
  let splitHandler: ReturnType<typeof createHandler>;
  let profileHandler: ReturnType<typeof createHandler>;
  let sessionController: ReturnType<typeof createSessionController>;
  let cliAgentController: ReturnType<typeof createCliAgentController>;
  let logger: {
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    lifecycleHandler = createHandler();
    settingsHandler = createHandler();
    shellHandler = createHandler();
    serializationHandler = createHandler();
    scrollbackHandler = createHandler();
    panelHandler = createHandler();
    splitHandler = createHandler();
    profileHandler = createHandler();
    sessionController = createSessionController();
    cliAgentController = createCliAgentController();
    logger = {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    coordinator = new WebviewCoordinator(
      {
        lifecycleHandler: lifecycleHandler as any,
        settingsHandler: settingsHandler as any,
        shellIntegrationHandler: shellHandler as any,
        serializationHandler: serializationHandler as any,
        scrollbackHandler: scrollbackHandler as any,
        panelLocationHandler: panelHandler as any,
        splitHandler: splitHandler as any,
        profileHandler: profileHandler as any,
        sessionController: sessionController as any,
        cliAgentController: cliAgentController as any,
      },
      logger
    );
  });

  it('dispatches lifecycle commands to the lifecycle handler', async () => {
    const message = { command: 'init' } as MessageCommand;
    await coordinator.dispatch(message, {} as any);
    expect(lifecycleHandler.handleMessage).toHaveBeenCalledOnce();
  });

  it('routes session restore events to the session controller', async () => {
    const message = { command: 'sessionRestore' } as MessageCommand;
    await coordinator.dispatch(message, {} as any);
    expect(sessionController.handleSessionRestoreMessage).toHaveBeenCalledOnce();
  });

  it('logs a warning for unknown commands', async () => {
    const message = { command: 'unknownCommand' } as MessageCommand;
    await coordinator.dispatch(message, {} as any);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('unknownCommand'));
  });

  it('exposes registered command list', () => {
    const commands = coordinator.getRegisteredCommands();
    expect(commands).toContain('split');
    expect(commands).toContain('sessionRestore');
  });
});
