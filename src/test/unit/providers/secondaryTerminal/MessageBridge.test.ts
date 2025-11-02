// import { expect } from 'chai';
import * as sinon from 'sinon';
import type * as vscode from 'vscode';

import '../../../shared/TestSetup';
import { MessageBridge } from '../../../../providers/secondaryTerminal/MessageBridge';
import { WebviewMessage } from '../../../../types/common';

describe('MessageBridge', () => {
  let sandbox: sinon.SinonSandbox;
  let extensionContext: vscode.ExtensionContext;
  let bridge: MessageBridge;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    extensionContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    bridge = new MessageBridge(extensionContext, sandbox.stub());
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('forwards validated messages to the handler', async () => {
    const handler = sandbox.stub().resolves();
    const validatorSpy = sandbox.stub();
    const validator = (message: unknown): message is WebviewMessage => {
      validatorSpy(message);
      return true;
    };

    let capturedListener: ((message: WebviewMessage) => void) | undefined;
    const disposable = { dispose: sandbox.stub() };
    const mockWebviewView = {
      webview: {
        onDidReceiveMessage: (listener: (message: WebviewMessage) => void) => {
          capturedListener = listener;
          return disposable;
        },
      },
    } as unknown as vscode.WebviewView;

    bridge.register(mockWebviewView, validator, handler as any);

    expect(extensionContext.subscriptions).to.length(1);
    expect(extensionContext.subscriptions[0]).to.equal(disposable);

    await capturedListener?.({ command: 'input' } as WebviewMessage);

    expect(handler.calledOnce).to.be.true;
    expect(validatorSpy.calledOnce).to.be.true;
  });

  it('ignores messages that fail validation', async () => {
    const handler = sandbox.stub().resolves();
    const validatorSpy = sandbox.stub();
    const validator = (message: unknown): message is WebviewMessage => {
      validatorSpy(message);
      return false;
    };

    let capturedListener: ((message: WebviewMessage) => void) | undefined;
    const mockWebviewView = {
      webview: {
        onDidReceiveMessage: (listener: (message: WebviewMessage) => void) => {
          capturedListener = listener;
          return { dispose: sandbox.stub() };
        },
      },
    } as unknown as vscode.WebviewView;

    bridge.register(mockWebviewView, validator, handler as any);

    await capturedListener?.({ command: 'input' } as WebviewMessage);

    expect(handler.notCalled).to.be.true;
  });
});
