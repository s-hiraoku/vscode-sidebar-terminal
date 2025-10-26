import { expect } from 'chai';
import * as sinon from 'sinon';
import type * as vscode from 'vscode';

import '../../../shared/TestSetup';
import { PersistenceOrchestrator } from '../../../../providers/secondaryTerminal/PersistenceOrchestrator';
import { WebviewMessage } from '../../../../types/common';
import { ConsolidatedTerminalPersistenceService } from '../../../../services/ConsolidatedTerminalPersistenceService';
import { PersistenceMessageHandler } from '../../../../handlers/PersistenceMessageHandler';

describe('PersistenceOrchestrator', () => {
  let sandbox: sinon.SinonSandbox;
  let extensionContext: vscode.ExtensionContext;
  let sendMessage: sinon.SinonStub;
  let handler: sinon.SinonStubbedInstance<PersistenceMessageHandler>;
  let service: sinon.SinonStubbedInstance<ConsolidatedTerminalPersistenceService>;
  let scrollbackCoordinator: { requestScrollbackData: sinon.SinonStub };
  let terminalManager: {
    getTerminals: sinon.SinonStub;
    createTerminal: sinon.SinonStub;
    getTerminal: sinon.SinonStub;
    setActiveTerminal: sinon.SinonStub;
  };
  let delayStub: sinon.SinonStub;
  let orchestrator: PersistenceOrchestrator;
  let terminalStore: Map<string, any>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    extensionContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    sendMessage = sandbox.stub().resolves();
    scrollbackCoordinator = {
      requestScrollbackData: sandbox.stub().resolves([]),
    };
    terminalStore = new Map();
    terminalManager = {
      getTerminals: sandbox.stub().returns([]),
      createTerminal: sandbox.stub().callsFake(() => {
        const id = `terminal-${terminalStore.size + 1}`;
        const terminal = { id, name: `Terminal ${terminalStore.size + 1}` };
        terminalStore.set(id, terminal);
        return id;
      }),
      getTerminal: sandbox.stub().callsFake((id: string) => terminalStore.get(id)),
      setActiveTerminal: sandbox.stub(),
    };
    delayStub = sandbox.stub().resolves();

    handler = sandbox.createStubInstance(PersistenceMessageHandler);
    handler.handleMessage.resolves({ success: true, data: [] });
    service = sandbox.createStubInstance(UnifiedTerminalPersistenceService);
    service.cleanupExpiredSessions.resolves();

    orchestrator = new PersistenceOrchestrator({
      extensionContext,
      terminalManager: terminalManager as any,
      scrollbackCoordinator: scrollbackCoordinator as any,
      sendMessage: sendMessage as any,
      handlerFactory: () => handler,
      serviceFactory: () => service,
      delay: delayStub,
      logger: sandbox.stub(),
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('bridges persistence messages and forwards responses', async () => {
    handler.handleMessage.resolves({ success: true, data: [] });
    await orchestrator.handlePersistenceMessage(
      {
        command: 'persistenceSaveSession',
        data: [],
        messageId: 'msg-1',
      } as WebviewMessage,
      sendMessage
    );

    const args = handler.handleMessage.getCall(0)?.args?.[0];
    expect(args?.command).to.equal('savesession');
    expect(
      sendMessage.calledWithMatch({ command: 'persistenceSaveSessionResponse', success: true })
    ).to.be.true;
  });

  it('maps legacy commands before forwarding', async () => {
    handler.handleMessage.resolves({ success: true, data: [] });
    await orchestrator.handleLegacyPersistenceMessage(
      {
        command: 'terminalSerializationRequest',
        data: [],
      } as WebviewMessage,
      sendMessage
    );

    const args = handler.handleMessage.getCall(0)?.args?.[0];
    expect(args?.command).to.equal('savesession');
  });

  it('cleans up persistence service on dispose', async () => {
    orchestrator.dispose();

    expect(service.cleanupExpiredSessions.calledOnce).to.be.true;
  });

  it('saves current session with scrollback data', async () => {
    terminalManager.getTerminals.returns([
      { id: 't1', name: 'One', cwd: '/tmp', shell: '/bin/bash', isActive: true },
    ]);
    scrollbackCoordinator.requestScrollbackData.resolves(['line1']);
    handler.handleMessage.resolves({ success: true, terminalCount: 1 });

    const result = await orchestrator.saveCurrentSession();

    expect(result).to.be.true;
    expect(handler.handleMessage.calledWithMatch({ command: 'saveSession' })).to.be.true;
  });

  it('restores sessions and notifies the webview', async () => {
    handler.handleMessage.resolves({
      success: true,
      data: [
        {
          id: 'old-1',
          name: 'Restored 1',
          scrollback: ['line'],
          cwd: '/tmp',
          isActive: true,
        },
      ],
    });

    const result = await orchestrator.restoreLastSession();

    expect(result).to.be.true;
    expect(terminalManager.createTerminal.called).to.be.true;
    expect(sendMessage.calledWithMatch({ command: 'terminalCreated' })).to.be.true;
    expect(sendMessage.calledWithMatch({ command: 'restoreScrollback' })).to.be.true;
    expect(sendMessage.calledWithMatch({ command: 'sessionRestored', success: true })).to.be.true;
    expect(delayStub.called).to.be.true;
  });
});
