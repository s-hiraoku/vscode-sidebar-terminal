import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileMessageHandler } from '../../../../../../webview/managers/handlers/ProfileMessageHandler';

describe('ProfileMessageHandler', () => {
  let handler: ProfileMessageHandler;
  let mockLogger: any;
  let mockCoordinator: any;
  let mockProfileManager: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockProfileManager = {
      showProfileSelector: vi.fn(),
      handleMessage: vi.fn(),
    };

    mockCoordinator = {
      getManagers: vi.fn().mockReturnValue({
        profile: mockProfileManager
      }),
    };

    handler = new ProfileMessageHandler(mockLogger);
  });

  it('should return supported commands', () => {
    const commands = handler.getSupportedCommands();
    expect(commands).toContain('showProfileSelector');
    expect(commands).toContain('profilesUpdated');
    expect(commands).toContain('defaultProfileChanged');
  });

  describe('handleMessage', () => {
    it('should handle showProfileSelector', () => {
      handler.handleMessage({ command: 'showProfileSelector' }, mockCoordinator);
      
      expect(mockProfileManager.showProfileSelector).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Show profile selector');
    });

    it('should handle profilesUpdated', () => {
      const msg = { command: 'profilesUpdated', profiles: [] };
      handler.handleMessage(msg, mockCoordinator);
      
      expect(mockProfileManager.handleMessage).toHaveBeenCalledWith(msg);
      expect(mockLogger.info).toHaveBeenCalledWith('Profiles updated');
    });

    it('should handle defaultProfileChanged', () => {
      const msg = { command: 'defaultProfileChanged', profile: 'bash' };
      handler.handleMessage(msg, mockCoordinator);
      
      expect(mockProfileManager.handleMessage).toHaveBeenCalledWith(msg);
      expect(mockLogger.info).toHaveBeenCalledWith('Default profile changed');
    });

    it('should warn on unknown command', () => {
      handler.handleMessage({ command: 'unknown' }, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Unknown profile command'));
    });

    it('should warn if command property is missing', () => {
      handler.handleMessage({} as any, mockCoordinator);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('without command property'));
    });
  });
});
