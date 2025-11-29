import { expect } from 'chai';
import * as sinon from 'sinon';
import type * as vscode from 'vscode';

import '../../../shared/TestSetup';
import { PanelLocationController } from '../../../../providers/secondaryTerminal/PanelLocationController';
import { WebviewMessage } from '../../../../types/common';
import { PanelLocationService } from '../../../../providers/services/PanelLocationService';
import { mockVscode } from '../../../shared/TestSetup';
import { TerminalManager } from '../../../../terminals/TerminalManager';

describe('PanelLocationController', () => {
  let sandbox: sinon.SinonSandbox;
  let extensionContext: vscode.ExtensionContext;
  let terminalManager: { getTerminals: sinon.SinonStub };
  let sendMessage: sinon.SinonStub;
  let serviceStub: sinon.SinonStubbedInstance<PanelLocationService>;
  let controller: PanelLocationController;
  const originalOnDidChangeConfiguration = mockVscode.workspace.onDidChangeConfiguration;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    extensionContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    terminalManager = {
      getTerminals: sandbox.stub().returns([{}, {}]),
    } as any;

    sendMessage = sandbox.stub().resolves();
    serviceStub = sandbox.createStubInstance(PanelLocationService);
    serviceStub.determineSplitDirection.returns('horizontal');
    serviceStub.handlePanelLocationReport.callsFake(async (_location: unknown, callback?: any) => {
      if (callback) {
        await callback('sidebar', 'panel');
      }
    });

    controller = new PanelLocationController({
      extensionContext,
      terminalManager: terminalManager as unknown as TerminalManager,
      sendMessage: sendMessage as any,
      panelLocationService: serviceStub,
      logger: sandbox.stub(),
    });
  });

  afterEach(() => {
    sandbox.restore();
    mockVscode.workspace.onDidChangeConfiguration = originalOnDidChangeConfiguration;
  });

  it('relays report events and triggers relayout when needed', async () => {
    await controller.handleReportPanelLocation({
      command: 'reportPanelLocation',
      location: 'panel',
    } as WebviewMessage);

    expect(serviceStub.handlePanelLocationReport.calledOnce).to.be.true;
    expect(sendMessage.calledWithMatch({ command: 'relayoutTerminals', direction: 'horizontal' }))
      .to.be.true;
  });

  it('requests detection again when visibility changes', async () => {
    const webviewView = {
      visible: true,
      onDidChangeVisibility: (listener: () => void) => {
        setTimeout(listener, 0);
        return { dispose: sandbox.stub() };
      },
    } as unknown as vscode.WebviewView;

    serviceStub.requestPanelLocationDetection.resolves();

    controller.registerVisibilityListener(webviewView);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(serviceStub.requestPanelLocationDetection.calledOnce).to.be.true;
  });

  it('initializes listeners and reacts to configuration changes', async () => {
    const webviewView = {} as vscode.WebviewView;
    let capturedListener:
      | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
      | undefined;
    const configListener = sandbox.stub().callsFake((listener: typeof capturedListener) => {
      capturedListener = listener;
      return { dispose: sandbox.stub() };
    });
    (mockVscode.workspace as any).onDidChangeConfiguration = configListener;

    serviceStub.requestPanelLocationDetection.resolves();

    await controller.setupPanelLocationChangeListener(webviewView);

    expect(serviceStub.initialize.calledWith(webviewView)).to.be.true;
    expect(configListener.calledOnce).to.be.true;

    capturedListener?.({
      affectsConfiguration: (section: string) => section === 'secondaryTerminal.panelLocation',
    });

    expect(serviceStub.requestPanelLocationDetection.called).to.be.true;
  });
});
