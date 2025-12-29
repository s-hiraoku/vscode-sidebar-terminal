import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliAgentMessageController } from '../../../../../../webview/managers/controllers/CliAgentMessageController';
import type { IManagerCoordinator, INotificationManager } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';
import type { MessageCommand } from '../../../../../../webview/managers/messageTypes';

describe('CliAgentMessageController', () => {
  let controller: CliAgentMessageController;
  let mockCoordinator: IManagerCoordinator;
  let mockLogger: ManagerLogger;
  let mockNotificationManager: INotificationManager;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ManagerLogger;

    mockNotificationManager = {
      showNotificationInTerminal: vi.fn(),
    } as unknown as INotificationManager;

    mockCoordinator = {
      updateCliAgentStatus: vi.fn(),
      getAllTerminalInstances: vi.fn().mockReturnValue(new Map([['term-1', {}]])),
      getManagers: vi.fn().mockReturnValue({
        notification: mockNotificationManager,
      }),
    } as unknown as IManagerCoordinator;

    controller = new CliAgentMessageController({ logger: mockLogger });
  });

  describe('handleStatusUpdateMessage', () => {
    it('should log warning if no cliAgentStatus is present', () => {
      const msg: MessageCommand = { command: 'statusUpdate' };
      controller.handleStatusUpdateMessage(msg, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith('No CLI Agent status data in message');
    });

    it('should update status using provided terminalId', () => {
      const msg: MessageCommand = {
        command: 'statusUpdate',
        cliAgentStatus: {
          terminalId: 'term-1',
          status: 'connected',
          activeTerminalName: 'Terminal 1',
        },
      };

      controller.handleStatusUpdateMessage(msg, mockCoordinator);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith(
        'term-1',
        'connected',
        null
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('CLI Agent status updated successfully')
      );
    });

    it('should extract terminalId from activeTerminalName if terminalId missing', () => {
      const msg: MessageCommand = {
        command: 'statusUpdate',
        cliAgentStatus: {
          status: 'connected',
          activeTerminalName: 'Terminal 2',
        },
      };

      controller.handleStatusUpdateMessage(msg, mockCoordinator);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith(
        '2',
        'connected',
        null
      );
    });

    it('should use fallback terminalId if neither ID nor name allows extraction', () => {
      // simulate extracted ID being empty or relying on fallback logic
      const msg: MessageCommand = {
        command: 'statusUpdate',
        cliAgentStatus: {
          status: 'connected',
          activeTerminalName: '', // Empty name
        },
      };

      controller.handleStatusUpdateMessage(msg, mockCoordinator);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith(
        'term-1', // fallback from mockCoordinator.getAllTerminalInstances().keys()[0]
        'connected',
        null
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Using fallback terminalId'));
    });

    it('should map legacy status correctly', () => {
        const statuses = [
            { input: 'connected', expected: 'connected' },
            { input: 'disconnected', expected: 'disconnected' },
            { input: 'inactive', expected: 'none' },
            { input: 'terminated', expected: 'none' },
            { input: 'unknown', expected: 'none' },
        ];

        statuses.forEach(({ input, expected }) => {
            const msg: MessageCommand = {
                command: 'statusUpdate',
                cliAgentStatus: {
                    terminalId: 'term-1',
                    status: input,
                },
            };
            controller.handleStatusUpdateMessage(msg, mockCoordinator);
            expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('term-1', expected, null);
        });
    });

    it('should handle errors gracefully', () => {
        const msg: MessageCommand = {
            command: 'statusUpdate',
            cliAgentStatus: { terminalId: 'term-1', status: 'connected' },
        };
        const error = new Error('Update failed');
        (mockCoordinator.updateCliAgentStatus as any).mockImplementation(() => { throw error; });

        controller.handleStatusUpdateMessage(msg, mockCoordinator);

        expect(mockLogger.error).toHaveBeenCalledWith('Error updating CLI Agent status', error);
    });
  });

  describe('handleFullStateSyncMessage', () => {
    it('should log warning if no terminalStates data', () => {
      const msg: MessageCommand = { command: 'fullStateSync' };
      controller.handleFullStateSyncMessage(msg, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith('No terminal states data in full state sync message');
    });

    it('should update multiple terminals', () => {
      const msg: MessageCommand = {
        command: 'fullStateSync',
        terminalStates: {
          'term-1': { status: 'connected', agentType: 'claude' },
          'term-2': { status: 'disconnected', agentType: null },
        },
      };

      controller.handleFullStateSyncMessage(msg, mockCoordinator);

      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('term-1', 'connected', 'claude');
      expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('term-2', 'disconnected', null);
      expect(mockLogger.info).toHaveBeenCalledWith('Full CLI Agent state sync completed successfully');
    });

    it('should continue processing other terminals if one fails', () => {
        const msg: MessageCommand = {
            command: 'fullStateSync',
            terminalStates: {
                'term-1': { status: 'connected', agentType: 'claude' },
                'term-2': { status: 'disconnected', agentType: null },
            },
        };
        const error = new Error('Fail');
        (mockCoordinator.updateCliAgentStatus as any).mockImplementationOnce(() => { throw error; });

        controller.handleFullStateSyncMessage(msg, mockCoordinator);

        expect(mockLogger.error).toHaveBeenCalledWith('Error updating terminal term-1', error);
        expect(mockCoordinator.updateCliAgentStatus).toHaveBeenCalledWith('term-2', 'disconnected', null);
    });
  });

  describe('handleSwitchResponseMessage', () => {
      it('should warn if notification manager is missing', () => {
          (mockCoordinator.getManagers as any).mockReturnValue({});
          const msg: MessageCommand = { command: 'switchResponse', terminalId: 'term-1' };
          
          controller.handleSwitchResponseMessage(msg, mockCoordinator);

          expect(mockLogger.warn).toHaveBeenCalledWith('NotificationManager not available for AI Agent feedback');
      });

      it('should show success notification on forced reconnect', () => {
          const msg: MessageCommand & { success?: boolean; newStatus?: string; isForceReconnect?: boolean } = {
              command: 'switchResponse',
              terminalId: 'term-1',
              success: true,
              newStatus: 'connected',
              isForceReconnect: true,
          };

          controller.handleSwitchResponseMessage(msg, mockCoordinator);

          expect(mockNotificationManager.showNotificationInTerminal).toHaveBeenCalledWith('📎 AI Agent Connected', 'success');
          expect(mockLogger.info).toHaveBeenCalledWith('AI Agent operation succeeded', expect.anything());
      });

      it('should show error notification on failure', () => {
        const msg: MessageCommand & { success?: boolean; reason?: string } = {
            command: 'switchResponse',
            terminalId: 'term-1',
            success: false,
            reason: 'Connection refused',
        };

        controller.handleSwitchResponseMessage(msg, mockCoordinator);

        expect(mockNotificationManager.showNotificationInTerminal).toHaveBeenCalledWith('❌ AI Agent operation failed', 'error');
        expect(mockLogger.error).toHaveBeenCalledWith('AI Agent operation failed', expect.anything());
      });
  });
});
