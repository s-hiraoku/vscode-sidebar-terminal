import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliAgentHandler } from '../../../../../messaging/handlers/CliAgentHandler';
import { IMessageHandlerContext } from '../../../../../messaging/UnifiedMessageDispatcher';
import { WebviewMessage } from '../../../../../types/common';

describe('CliAgentHandler', () => {
  let handler: CliAgentHandler;
  let mockContext: IMessageHandlerContext;
  let mockCoordinator: any;
  let mockNotificationManager: any;

  beforeEach(() => {
    mockNotificationManager = {
      showNotificationInTerminal: vi.fn(),
    };

    mockCoordinator = {
      updateCliAgentStatus: vi.fn(),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map([['term-1', {}]])),
      getManagers: vi.fn().mockReturnValue({
        notification: mockNotificationManager
      }),
    };

    mockContext = {
      coordinator: mockCoordinator,
      postMessage: vi.fn(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any,
    };

    handler = new CliAgentHandler();
  });

  describe('Initialization', () => {
    it('should register supported commands', () => {
      const commands = handler.getSupportedCommands();
      expect(commands).toContain('cliAgentStatusUpdate');
      expect(commands).toContain('cliAgentFullStateSync');
      expect(commands).toContain('switchAiAgentResponse');
    });
  });

  describe('handleCliAgentStatusUpdate', () => {
    it('should update agent status when terminalId provided', async () => {
      const message: WebviewMessage = {
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          terminalId: 'term-1',
          status: 'connected',
          agentType: 'gemini',
          activeTerminalName: null
        }
      };

      await handler.handle(message, mockContext);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith(
        'term-1',
        'connected',
        'gemini'
      );
    });

    it('should fallback to extracting ID from name', async () => {
      const message: WebviewMessage = {
        command: 'cliAgentStatusUpdate',
        cliAgentStatus: {
          activeTerminalName: 'Terminal term-2',
          status: 'disconnected',
          agentType: 'claude'
        }
      } as any;

      await handler.handle(message, mockContext);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith(
        'term-2',
        'disconnected',
        'claude'
      );
    });

    it('should warn if no status data', async () => {
      const message: WebviewMessage = {
        command: 'cliAgentStatusUpdate',
      };

      await handler.handle(message, mockContext);

      expect(mockContext.logger.warn).toHaveBeenCalledWith('No CLI Agent status data in message');
    });
  });

  describe('handleCliAgentFullStateSync', () => {
    it('should sync full state', async () => {
      const message: WebviewMessage = {
        command: 'cliAgentFullStateSync',
        terminalStates: {
          'term-1': { status: 'connected', agentType: 'gemini' },
          'term-2': { status: 'none', agentType: null }
        },
        connectedAgentId: 'term-1',
        connectedAgentType: 'gemini',
        disconnectedCount: 0
      } as any;

      await handler.handle(message, mockContext);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('term-1', 'connected', 'gemini');
      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('term-2', 'none', null);
    });

    it('should warn if no terminal states', async () => {
      const message: WebviewMessage = {
        command: 'cliAgentFullStateSync',
      };

      await handler.handle(message, mockContext);

      expect(mockContext.logger.warn).toHaveBeenCalledWith('No terminal states data in full state sync message');
    });
  });

  describe('handleSwitchAiAgentResponse', () => {
    it('should show success notification for force reconnect', async () => {
      const message: WebviewMessage = {
        command: 'switchAiAgentResponse',
        terminalId: 'term-1',
        success: true,
        newStatus: 'connected',
        isForceReconnect: true
      } as any;

      await handler.handle(message, mockContext);

      expect(mockNotificationManager.showNotificationInTerminal).toHaveBeenCalledWith(
        expect.stringContaining('Connected'),
        'success'
      );
    });

    it('should show error notification on failure', async () => {
      const message: WebviewMessage = {
        command: 'switchAiAgentResponse',
        terminalId: 'term-1',
        success: false,
        reason: 'Error'
      } as any;

      await handler.handle(message, mockContext);

      expect(mockNotificationManager.showNotificationInTerminal).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        'error'
      );
    });
  });
});
