import { expect } from 'chai';
import * as sinon from 'sinon';
import type * as vscode from 'vscode';

import '../../../shared/TestSetup';
import { ExtensionPersistenceService } from '../../../../services/persistence/ExtensionPersistenceService';

describe('ExtensionPersistenceService', () => {
  let sandbox: sinon.SinonSandbox;
  let context: vscode.ExtensionContext;
  let terminalManager: {
    getTerminals: sinon.SinonStub;
    getActiveTerminalId: sinon.SinonStub;
    createTerminal: sinon.SinonStub;
    setActiveTerminal: sinon.SinonStub;
    reorderTerminals: sinon.SinonStub;
  };
  let workspaceState: {
    get: sinon.SinonStub;
    update: sinon.SinonStub;
  };
  let service: ExtensionPersistenceService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const store = new Map<string, unknown>();
    workspaceState = {
      get: sandbox.stub().callsFake((key: string) => store.get(key)),
      update: sandbox.stub().callsFake((key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve();
      }),
    };

    context = {
      workspaceState: workspaceState as unknown,
    } as vscode.ExtensionContext;

    terminalManager = {
      getTerminals: sandbox.stub().returns([
        { id: 'terminal-1', name: 'Terminal 1', cwd: '/tmp', isActive: true },
        { id: 'terminal-2', name: 'Terminal 2', cwd: '/tmp', isActive: false },
      ]),
      getActiveTerminalId: sandbox.stub().returns('terminal-1'),
      createTerminal: sandbox.stub().returns(''),
      setActiveTerminal: sandbox.stub(),
      reorderTerminals: sandbox.stub(),
    };

    service = new ExtensionPersistenceService(context, terminalManager as any);
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  it('preserves cached scrollback when empty push arrives', async () => {
    const requestStub = sandbox
      .stub(service as any, 'requestImmediateScrollbackExtraction')
      .resolves({ id: 'terminal-1', scrollback: [] });

    service.handlePushedScrollbackData({
      terminalId: 'terminal-1',
      scrollbackData: ['line-1'],
    });
    service.handlePushedScrollbackData({
      terminalId: 'terminal-1',
      scrollbackData: [],
    });
    service.handlePushedScrollbackData({
      terminalId: 'terminal-2',
      scrollbackData: ['line-2'],
    });

    await service.saveCurrentSession({ preferCache: true });

    expect(requestStub.called).to.equal(false);
    expect(workspaceState.update.calledOnce).to.equal(true);

    const saved = workspaceState.update.getCall(0).args[1] as {
      scrollbackData?: Record<string, unknown>;
    };
    const scrollbackData = saved.scrollbackData as Record<string, string[]>;

    expect(scrollbackData['terminal-1']).to.deep.equal(['line-1']);
    expect(scrollbackData['terminal-2']).to.deep.equal(['line-2']);
  });

  it('does not clear cache when collected scrollback is empty', () => {
    (service as any).pushedScrollbackCache.set('terminal-1', ['cached-line']);

    service.handleScrollbackDataCollected({
      terminalId: 'terminal-1',
      requestId: 'req-1',
      scrollbackData: [],
    });

    const cached = (service as any).pushedScrollbackCache.get('terminal-1');
    expect(cached).to.deep.equal(['cached-line']);
  });

  it('prefetchScrollbackForSave updates cache when extraction returns data', async () => {
    const requestStub = sandbox
      .stub(service as any, 'requestImmediateScrollbackExtraction')
      .onFirstCall()
      .resolves({ id: 'terminal-1', scrollback: ['prefetch-1'] })
      .onSecondCall()
      .resolves({ id: 'terminal-2', scrollback: [] });

    await service.prefetchScrollbackForSave();

    expect(requestStub.calledTwice).to.equal(true);
    const cache = (service as any).pushedScrollbackCache as Map<string, string[]>;
    expect(cache.get('terminal-1')).to.deep.equal(['prefetch-1']);
    expect(cache.get('terminal-2')).to.equal(undefined);
  });

  it('reorders restored terminals to match saved session order', async () => {
    terminalManager.createTerminal.resetBehavior();
    terminalManager.createTerminal.onCall(0).returns('new-1');
    terminalManager.createTerminal.onCall(1).returns('new-2');
    terminalManager.createTerminal.onCall(2).returns('new-3');

    const waitStub = sandbox.stub(service as any, 'waitForTerminalsReady').resolves();
    const restoreStub = sandbox.stub(service as any, 'requestScrollbackRestoration').resolves();

    const sessionData = {
      terminals: [
        { id: 'old-1', name: 'Terminal 1', number: 1, cwd: '/tmp', isActive: false },
        { id: 'old-2', name: 'Terminal 2', number: 2, cwd: '/tmp', isActive: true },
        { id: 'old-3', name: 'Terminal 3', number: 3, cwd: '/tmp', isActive: false },
      ],
      activeTerminalId: 'old-2',
      timestamp: Date.now(),
      version: '0.1.999',
    };

    await (service as any).batchRestoreTerminals(sessionData);

    expect(waitStub.calledOnce).to.equal(true);
    expect(restoreStub.called).to.equal(false);
    expect(terminalManager.reorderTerminals.calledOnce).to.equal(true);
    expect(terminalManager.reorderTerminals.firstCall.args[0]).to.deep.equal([
      'new-1',
      'new-2',
      'new-3',
    ]);
    expect(terminalManager.setActiveTerminal.calledWith('new-2')).to.equal(true);
  });
});
