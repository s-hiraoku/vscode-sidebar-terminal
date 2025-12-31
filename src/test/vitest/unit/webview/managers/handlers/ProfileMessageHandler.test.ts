import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProfileMessageHandler } from '../../../../../../webview/managers/handlers/ProfileMessageHandler';
import { MessageQueue } from '../../../../../../webview/utils/MessageQueue';
import { ManagerLogger } from '../../../../../../webview/utils/ManagerLogger';

// Mock vscode for ErrorHandler
vi.mock('vscode', () => ({
  default: {},
}));

describe('ProfileMessageHandler', () => {
  let handler: ProfileMessageHandler;
  let mockMessageQueue: MessageQueue;
  let mockLogger: ManagerLogger;
  let mockCoordinator: any;
  let mockProfileManager: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockMessageQueue = {
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      clear: vi.fn(),
      size: 0,
      isEmpty: true,
    } as unknown as MessageQueue;

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as ManagerLogger;

    mockProfileManager = {
      showProfileSelector: vi.fn(),
      handleMessage: vi.fn(),
    };

    mockCoordinator = {
      getManagers: vi.fn().mockReturnValue({
        profile: mockProfileManager,
      }),
    };

    handler = new ProfileMessageHandler(mockMessageQueue, mockLogger);
  });

  afterEach(() => {
    handler.dispose();
  });

  it('should return supported commands', () => {
    const commands = handler.getSupportedCommands();
    expect(commands).toContain('showProfileSelector');
    expect(commands).toContain('profilesUpdated');
    expect(commands).toContain('defaultProfileChanged');
  });

  describe('handleMessage', () => {
    it('should handle showProfileSelector', async () => {
      await handler.handleMessage({ command: 'showProfileSelector' }, mockCoordinator);

      expect(mockProfileManager.showProfileSelector).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Show profile selector');
    });

    it('should handle profilesUpdated', async () => {
      const msg = { command: 'profilesUpdated', profiles: [] };
      await handler.handleMessage(msg, mockCoordinator);

      expect(mockProfileManager.handleMessage).toHaveBeenCalledWith(msg);
      expect(mockLogger.info).toHaveBeenCalledWith('Profiles updated');
    });

    it('should handle defaultProfileChanged', async () => {
      const msg = { command: 'defaultProfileChanged', profile: 'bash' };
      await handler.handleMessage(msg, mockCoordinator);

      expect(mockProfileManager.handleMessage).toHaveBeenCalledWith(msg);
      expect(mockLogger.info).toHaveBeenCalledWith('Default profile changed');
    });

    it('should warn on unknown command', async () => {
      await handler.handleMessage({ command: 'unknown' }, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });

    it('should warn if command property is missing', async () => {
      await handler.handleMessage({} as any, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('without command property')
      );
    });
  });

  describe('dispose', () => {
    it('should dispose cleanly', () => {
      expect(() => handler.dispose()).not.toThrow();
    });
  });
});
