import { expect } from 'chai';
import * as sinon from 'sinon';

import '../../../shared/TestSetup';
import { WebviewCoordinator } from '../../../../webview/coordinators/WebviewCoordinator';
import { MessageCommand } from '../../../../webview/managers/messageTypes';

const createHandler = () => ({ handleMessage: sinon.stub() });

const createSessionController = () => ({
  handleSessionRestoreMessage: sinon.stub().resolves(),
  handleSessionRestoreStartedMessage: sinon.stub(),
  handleSessionRestoreProgressMessage: sinon.stub(),
  handleSessionRestoreCompletedMessage: sinon.stub(),
  handleSessionRestoreErrorMessage: sinon.stub(),
  handleSessionSavedMessage: sinon.stub(),
  handleSessionSaveErrorMessage: sinon.stub(),
  handleSessionClearedMessage: sinon.stub(),
  handleSessionRestoredMessage: sinon.stub(),
  handleSessionRestoreSkippedMessage: sinon.stub(),
  handleTerminalRestoreErrorMessage: sinon.stub(),
});

const createCliAgentController = () => ({
  handleStatusUpdateMessage: sinon.stub(),
  handleFullStateSyncMessage: sinon.stub(),
  handleSwitchResponseMessage: sinon.stub(),
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
  let logger: { warn: sinon.SinonStub; info: sinon.SinonStub; error: sinon.SinonStub; debug: sinon.SinonStub };

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
      warn: sinon.stub(),
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
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
    expect(lifecycleHandler.handleMessage.calledOnce).to.be.true;
  });

  it('routes session restore events to the session controller', async () => {
    const message = { command: 'sessionRestore' } as MessageCommand;
    await coordinator.dispatch(message, {} as any);
    expect(sessionController.handleSessionRestoreMessage.calledOnce).to.be.true;
  });

  it('logs a warning for unknown commands', async () => {
    const message = { command: 'unknownCommand' } as MessageCommand;
    await coordinator.dispatch(message, {} as any);
    expect(logger.warn.calledWithMatch('unknownCommand')).to.be.true;
  });

  it('exposes registered command list', () => {
    const commands = coordinator.getRegisteredCommands();
    expect(commands).to.include('split');
    expect(commands).to.include('sessionRestore');
  });
});
