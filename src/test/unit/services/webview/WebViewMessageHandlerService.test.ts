import { expect } from 'chai';
import * as sinon from 'sinon';
import { WebViewMessageHandlerService } from '../../../../services/webview/WebViewMessageHandlerService';
import { IMessageHandlerContext } from '../../../../services/webview/interfaces';
import { WebviewMessage } from '../../../../types/common';

describe('WebViewMessageHandlerService', () => {
  let service: WebViewMessageHandlerService;
  let mockContext: IMessageHandlerContext;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new WebViewMessageHandlerService();

    // Create mock context with proper types
    mockContext = {
      extensionContext: {} as any,
      terminalManager: {
        sendInput: sandbox.stub(),
        resize: sandbox.stub(),
        setActiveTerminal: sandbox.stub(),
        getActiveTerminalId: sandbox.stub().returns('terminal-1'),
        createTerminal: sandbox.stub().returns('terminal-2'),
        getTerminals: sandbox.stub().returns([]),
      } as any,
      webview: undefined,
      sendMessage: sandbox.stub().resolves(),
      terminalIdMapping: new Map(),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    it('should initialize with handlers', () => {
      const handlerCount = service.getHandlerCount();
      expect(handlerCount).to.be.greaterThan(0);
    });

    it('should have supported commands', () => {
      const commands = service.getSupportedCommands();
      expect(commands).to.include('webviewReady');
      expect(commands).to.include('focusTerminal');
      expect(commands.length).to.be.greaterThan(0);
    });
  });

  describe('handleMessage', () => {
    it('should handle valid webviewReady message', async () => {
      const message: WebviewMessage = {
        command: 'webviewReady',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true;
    });

    it('should handle valid terminal input message', async () => {
      const message: WebviewMessage = {
        command: 'input',
        data: 'echo "hello"',
        terminalId: 'terminal-1',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true;
      expect(mockContext.terminalManager.sendInput).to.have.been.calledWith(
        'echo "hello"',
        'terminal-1'
      );
    });

    it('should handle valid terminal resize message', async () => {
      const message: WebviewMessage = {
        command: 'resize',
        cols: 80,
        rows: 24,
        terminalId: 'terminal-1',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true;
      expect(mockContext.terminalManager.resize).to.have.been.calledWith(80, 24, 'terminal-1');
    });

    it('should handle valid focus terminal message', async () => {
      const message: WebviewMessage = {
        command: 'focusTerminal',
        terminalId: 'terminal-2',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true;
      expect(mockContext.terminalManager.setActiveTerminal).to.have.been.calledWith('terminal-2');
    });

    it('should reject invalid message with no command', async () => {
      const message = {} as WebviewMessage;

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.false;
    });

    it('should reject invalid message with empty command', async () => {
      const message: WebviewMessage = {
        command: '' as any,
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.false;
    });

    it('should return false for unsupported command', async () => {
      const message: WebviewMessage = {
        command: 'customEvent', // Using a valid but unsupported command
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.false;
    });

    it('should handle handler errors gracefully', async () => {
      // Make terminalManager.sendInput throw an error
      (mockContext.terminalManager.sendInput as sinon.SinonStub).throws(
        new Error('Terminal error')
      );

      const message: WebviewMessage = {
        command: 'input',
        data: 'echo "error"',
        terminalId: 'terminal-1',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.false;
    });

    it('should handle sendMessage errors gracefully', async () => {
      // Make sendMessage fail
      (mockContext.sendMessage as sinon.SinonStub).rejects(new Error('Send message error'));

      const message: WebviewMessage = {
        command: 'webviewReady',
      };

      // Should not throw despite sendMessage error in handler
      const result = await service.handleMessage(message, mockContext);
      expect(result).to.be.true; // Handler succeeded even if internal message sending failed
    });
  });

  describe('input validation', () => {
    it('should reject input message without data', async () => {
      const message: WebviewMessage = {
        command: 'input',
        terminalId: 'terminal-1',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true; // Handler processes it but doesn't send input
      expect(mockContext.terminalManager.sendInput).to.not.have.been.called;
    });

    it('should reject input message with empty data', async () => {
      const message: WebviewMessage = {
        command: 'input',
        data: '',
        terminalId: 'terminal-1',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true; // Handler processes it but doesn't send input
      expect(mockContext.terminalManager.sendInput).to.not.have.been.called;
    });

    it('should reject resize message with invalid dimensions', async () => {
      const message: WebviewMessage = {
        command: 'resize',
        cols: 0,
        rows: 24,
        terminalId: 'terminal-1',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true; // Handler processes it but doesn't resize
      expect(mockContext.terminalManager.resize).to.not.have.been.called;
    });

    it('should reject focus message without terminal ID', async () => {
      const message: WebviewMessage = {
        command: 'focusTerminal',
      };

      const result = await service.handleMessage(message, mockContext);

      expect(result).to.be.true; // Handler processes it but doesn't focus
      expect(mockContext.terminalManager.setActiveTerminal).to.not.have.been.called;
    });
  });

  describe('getSupportedCommands', () => {
    it('should return array of supported commands', () => {
      const commands = service.getSupportedCommands();

      expect(commands).to.be.an('array');
      expect(commands.length).to.be.greaterThan(0);
      expect(commands).to.include('webviewReady');
    });

    it('should not have duplicate commands', () => {
      const commands = service.getSupportedCommands();
      const uniqueCommands = [...new Set(commands)];

      expect(commands.length).to.equal(uniqueCommands.length);
    });
  });

  describe('getHandlerCount', () => {
    it('should return correct number of handlers', () => {
      const count = service.getHandlerCount();

      expect(count).to.be.a('number');
      expect(count).to.be.greaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle null message gracefully', async () => {
      const result = await service.handleMessage(null as any, mockContext);
      expect(result).to.be.false;
    });

    it('should handle undefined message gracefully', async () => {
      const result = await service.handleMessage(undefined as any, mockContext);
      expect(result).to.be.false;
    });

    it('should handle message with non-string command', async () => {
      const message = { command: 123 } as any;
      const result = await service.handleMessage(message, mockContext);
      expect(result).to.be.false;
    });
  });

  describe('performance', () => {
    it('should handle multiple messages efficiently', async () => {
      const messages: WebviewMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          command: 'input',
          data: `command ${i}`,
          terminalId: 'terminal-1',
        });
      }

      const startTime = Date.now();

      const results = await Promise.all(
        messages.map((msg) => service.handleMessage(msg, mockContext))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results.every((r) => r === true)).to.be.true;
      expect(duration).to.be.lessThan(1000); // Should handle 100 messages in less than 1 second
    });
  });
});
