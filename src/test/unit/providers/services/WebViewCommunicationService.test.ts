import { expect } from 'chai';
import sinon from 'sinon';
import { WebviewMessage } from '../../../../types/common';
import { WebViewCommunicationService } from '../../../../providers/services/WebViewCommunicationService';

describe('WebViewCommunicationService', () => {
  let service: WebViewCommunicationService;
  let postMessageStub: sinon.SinonStub;

  beforeEach(() => {
    service = new WebViewCommunicationService();
    postMessageStub = sinon.stub().resolves(true);
  });

  afterEach(() => {
    sinon.restore();
  });

  function createMockView(): unknown {
    return {
      webview: {
        postMessage: postMessageStub,
      },
    };
  }

  it('queues messages until the webview is marked ready', async () => {
    service.setView(createMockView() as any);

    const message: WebviewMessage = {
      command: 'commandHistory',
      terminalId: 'terminal-1',
      history: [],
    } as any;

    await service.sendMessage(message);

    expect(postMessageStub.called).to.be.false;

    await service.markWebviewReady();

    expect(postMessageStub.calledOnce).to.be.true;
    expect(postMessageStub.firstCall.args[0]).to.deep.equal(message);
  });

  it('flushes queued messages in the order they were received', async () => {
    service.setView(createMockView() as any);

    const firstMessage: WebviewMessage = { command: 'updateCwd', terminalId: 't1', cwd: '/tmp' } as any;
    const secondMessage: WebviewMessage = { command: 'shellStatus', terminalId: 't1', status: 'ready' } as any;

    await service.sendMessage(firstMessage);
    await service.sendMessage(secondMessage);

    await service.markWebviewReady();

    expect(postMessageStub.callCount).to.equal(2);
    expect(postMessageStub.getCall(0).args[0]).to.deep.equal(firstMessage);
    expect(postMessageStub.getCall(1).args[0]).to.deep.equal(secondMessage);
  });

  it('resets ready state when the view is cleared', async () => {
    service.setView(createMockView() as any);

    const message: WebviewMessage = { command: 'shellStatus', terminalId: 't1', status: 'ready' } as any;
    await service.sendMessage(message);

    service.clearView();
    expect(postMessageStub.called).to.be.false;

    service.setView(createMockView() as any);
    await service.sendMessage({ command: 'updateCwd', terminalId: 't1', cwd: '/workspace' } as any);

    await service.markWebviewReady();

    expect(postMessageStub.callCount).to.equal(1);
    expect(postMessageStub.firstCall.args[0]).to.deep.equal({
      command: 'updateCwd',
      terminalId: 't1',
      cwd: '/workspace',
    });
  });
});
