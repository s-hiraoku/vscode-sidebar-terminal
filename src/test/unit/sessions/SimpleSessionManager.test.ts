import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { SimpleSessionManager } from '../../../sessions/SimpleSessionManager';

describe('SimpleSessionManager', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockTerminalManager: any;
  let mockGlobalState: any;
  let simpleSessionManager: SimpleSessionManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Simple mock objects
    mockGlobalState = {
      get: sandbox.stub(),
      update: sandbox.stub().resolves(),
      keys: sandbox.stub(),
      setKeysForSync: sandbox.stub(),
    };

    mockContext = {
      globalState: mockGlobalState,
      subscriptions: [],
      extensionPath: '/test/path',
    };

    mockTerminalManager = {
      getTerminals: sandbox.stub().returns([]),
      getActiveTerminalId: sandbox.stub().returns(undefined),
      createTerminal: sandbox.stub().returns('new-term-id'),
      setActiveTerminal: sandbox.stub(),
    };

    simpleSessionManager = new SimpleSessionManager(mockContext, mockTerminalManager);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('saveCurrentSession', () => {
    it('should save empty session successfully', async () => {
      // Act
      const result = await simpleSessionManager.saveCurrentSession();

      // Assert
      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(0);
    });

    it('should save session with terminals', async () => {
      // Arrange
      const mockTerminals = [
        {
          id: 'term1',
          name: 'Terminal 1',
          number: 1,
          cwd: '/test',
          isActive: true,
          ptyProcess: {},
        },
      ];
      mockTerminalManager.getTerminals.returns(mockTerminals);
      mockTerminalManager.getActiveTerminalId.returns('term1');

      // Act
      const result = await simpleSessionManager.saveCurrentSession();

      // Assert
      expect(result.success).to.be.true;
      expect(result.terminalCount).to.equal(1);
      expect(mockGlobalState.update.calledOnce).to.be.true;
    });
  });

  describe('restoreSession', () => {
    it('should handle no saved session', async () => {
      // Arrange
      mockGlobalState.get.returns(undefined);

      // Act
      const result = await simpleSessionManager.restoreSession();

      // Assert
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(0);
    });

    it('should restore saved session', async () => {
      // Arrange
      const sessionData = {
        terminals: [{ id: 'term1', name: 'Terminal 1', number: 1, cwd: '/test', isActive: true }],
        activeTerminalId: 'term1',
        timestamp: Date.now(),
        version: '1.0.0',
      };
      mockGlobalState.get.returns(sessionData);

      // Act
      const result = await simpleSessionManager.restoreSession();

      // Assert
      expect(result.success).to.be.true;
      expect(result.restoredCount).to.equal(1);
    });
  });

  describe('clearSession', () => {
    it('should clear session successfully', async () => {
      // Act
      await simpleSessionManager.clearSession();

      // Assert
      expect(mockGlobalState.update.calledWith('simple-terminal-session', undefined)).to.be.true;
    });
  });
});
