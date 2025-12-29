/**
 * ProfileManager Test Suite
 * Tests the profile management functionality including selector integration
 *
 * Vitest Migration: Converted from Mocha/Chai to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProfileManager } from '../../../../../webview/managers/ProfileManager';
import { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import { ITerminalProfile } from '../../../../../types/profiles';

describe('ProfileManager', () => {
  let profileManager: ProfileManager;
  let mockCoordinator: IManagerCoordinator;
  let mockProfiles: ITerminalProfile[];

  beforeEach(() => {
    vi.useFakeTimers();

    // Create mock profiles
    mockProfiles = [
      {
        id: 'bash',
        name: 'Bash',
        path: '/bin/bash',
        description: 'Bash shell',
        icon: 'terminal-bash',
        isDefault: true,
        args: [],
      },
      {
        id: 'zsh',
        name: 'Zsh',
        path: '/bin/zsh',
        description: 'Z shell',
        icon: 'terminal-bash',
        isDefault: false,
        args: [],
      },
      {
        id: 'powershell',
        name: 'PowerShell',
        path: '/usr/local/bin/pwsh',
        description: 'PowerShell Core',
        icon: 'terminal-pwsh',
        isDefault: false,
        args: [],
      },
    ];

    // Create mock coordinator
    mockCoordinator = {
      postMessageToExtension: vi.fn(),
      createTerminal: vi.fn().mockResolvedValue(undefined),
      getManagers: vi.fn().mockReturnValue({
        notification: {
          showWarning: vi.fn(),
          showInfo: vi.fn(),
        },
      }),
    } as any;

    profileManager = new ProfileManager();
    profileManager.setCoordinator(mockCoordinator as any);
  });

  afterEach(() => {
    profileManager.dispose();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    it('should create profile selector container', async () => {
      await profileManager.initialize();

      const container = document.getElementById('profile-selector-container');
      expect(container).toBeDefined();
      expect(container?.style.display).toBe('none');
    });

    it('should initialize with no profiles', async () => {
      await profileManager.initialize();

      const profiles = await profileManager.getAvailableProfiles();
      expect(profiles).toHaveLength(0);
    });
  });

  describe('Profile Management', () => {
    it('should update profiles from extension', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');

      const profile = profileManager.getProfile('bash');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('Bash');
    });

    it('should identify default profile', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).toBe('bash');
      expect(defaultProfile?.isDefault).toBe(true);
    });

    it('should get profile by ID', () => {
      profileManager.updateProfiles(mockProfiles);

      const zshProfile = profileManager.getProfile('zsh');
      expect(zshProfile).toBeDefined();
      expect(zshProfile?.name).toBe('Zsh');
    });

    it('should return undefined for non-existent profile', () => {
      profileManager.updateProfiles(mockProfiles);

      const nonExistent = profileManager.getProfile('nonexistent');
      expect(nonExistent).toBeUndefined();
    });

    it('should get all available profiles', async () => {
      profileManager.updateProfiles(mockProfiles);

      const profiles = await profileManager.getAvailableProfiles();
      expect(profiles).toHaveLength(3);
    });

    it('should fallback to first profile when no default specified', () => {
      profileManager.updateProfiles(mockProfiles);

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile).toBeDefined();
    });
  });

  describe('Profile Selector UI', () => {
    beforeEach(async () => {
      await profileManager.initialize();
      profileManager.updateProfiles(mockProfiles, 'bash');
    });

    it('should show profile selector', () => {
      profileManager.showProfileSelector();

      expect(profileManager.isProfileSelectorVisible()).toBe(true);

      const container = document.getElementById('profile-selector-container');
      expect(container?.style.display).toBe('block');
    });

    it('should hide profile selector', () => {
      profileManager.showProfileSelector();
      profileManager.hideProfileSelector();

      expect(profileManager.isProfileSelectorVisible()).toBe(false);

      const container = document.getElementById('profile-selector-container');
      expect(container?.style.display).toBe('none');
    });

    it('should show warning when no profiles available', () => {
      profileManager.updateProfiles([], undefined);
      profileManager.showProfileSelector();

      const notificationManager = (mockCoordinator.getManagers as any)().notification;
      expect(notificationManager.showWarning).toHaveBeenCalledTimes(1);
      expect(notificationManager.showWarning).toHaveBeenCalledWith('No terminal profiles available');
    });

    it('should call onProfileSelected callback when profile selected', () => {
      return new Promise<void>((resolve) => {
        profileManager.showProfileSelector((profileId: string) => {
          expect(profileId).toBe('zsh');
          resolve();
        });

        // Simulate profile selection
        const profileItems = document.querySelectorAll('.profile-item');
        const zshItem = Array.from(profileItems).find((item) => item.textContent?.includes('Zsh'));
        (zshItem as HTMLElement)?.click();

        const confirmBtn = document.querySelector('.profile-selector-confirm') as HTMLButtonElement;
        confirmBtn?.click();
      });
    });

    it('should create terminal with selected profile when no callback provided', async () => {
      profileManager.showProfileSelector();

      // Simulate profile selection
      const profileItems = document.querySelectorAll('.profile-item');
      const zshItem = Array.from(profileItems).find((item) => item.textContent?.includes('Zsh'));
      (zshItem as HTMLElement)?.click();

      const confirmBtn = document.querySelector('.profile-selector-confirm') as HTMLButtonElement;
      confirmBtn?.click();

      // Small delay for async operation
      vi.advanceTimersByTime(10);

      expect(mockCoordinator.createTerminal).toHaveBeenCalled();
    });
  });

  describe('Default Profile Management', () => {
    beforeEach(() => {
      profileManager.updateProfiles(mockProfiles, 'bash');
    });

    it('should set default profile', async () => {
      await profileManager.setDefaultProfile('zsh');

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).toBe('zsh');
    });

    it('should notify extension of default profile change', async () => {
      await profileManager.setDefaultProfile('zsh');

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);
      const message = (mockCoordinator.postMessageToExtension as any).mock.calls[0][0];
      expect(message.command).toBe('setDefaultProfile');
      expect(message.profileId).toBe('zsh');
    });

    it('should throw error when setting non-existent profile as default', async () => {
      await expect(profileManager.setDefaultProfile('nonexistent')).rejects.toThrow('Profile not found');
    });

    it('should update isDefault flag on all profiles', async () => {
      await profileManager.setDefaultProfile('zsh');

      const bashProfile = profileManager.getProfile('bash');
      const zshProfile = profileManager.getProfile('zsh');

      expect(bashProfile?.isDefault).toBe(false);
      expect(zshProfile?.isDefault).toBe(true);
    });
  });

  describe('Terminal Creation with Profile', () => {
    beforeEach(() => {
      profileManager.updateProfiles(mockProfiles, 'bash');
    });

    it('should create terminal with specified profile', async () => {
      await profileManager.createTerminalWithProfile('zsh');

      expect(mockCoordinator.createTerminal).toHaveBeenCalledTimes(1);

      const args = (mockCoordinator.createTerminal as any).mock.calls[0];
      const [terminalId, terminalName, options] = args;

      expect(typeof terminalId).toBe('string');
      expect(terminalName).toContain('Zsh');
      expect(options.profileId).toBe('zsh');
      expect(options.shell).toBe('/bin/zsh');
    });

    it('should create terminal with custom name', async () => {
      await profileManager.createTerminalWithProfile('bash', 'My Custom Terminal');

      const args = (mockCoordinator.createTerminal as any).mock.calls[0];
      const [, terminalName] = args;

      expect(terminalName).toBe('My Custom Terminal');
    });

    it('should create terminal with default profile', async () => {
      await profileManager.createTerminalWithDefaultProfile();

      expect(mockCoordinator.createTerminal).toHaveBeenCalledTimes(1);

      const args = (mockCoordinator.createTerminal as any).mock.calls[0];
      const [, , options] = args;

      expect(options.profileId).toBe('bash');
    });

    it('should throw error when creating terminal with non-existent profile', async () => {
      await expect(profileManager.createTerminalWithProfile('nonexistent')).rejects.toThrow('Profile not found');
    });

    it('should show warning on terminal creation failure', async () => {
      (mockCoordinator.createTerminal as any).mockRejectedValue(new Error('Creation failed'));

      await expect(profileManager.createTerminalWithProfile('bash')).rejects.toThrow();

      const notificationManager = (mockCoordinator.getManagers as any)().notification;
      expect(notificationManager.showWarning).toHaveBeenCalled();
    });
  });

  describe('Profile Cache Management', () => {
    it('should cache profiles for 1 minute', async () => {
      profileManager.updateProfiles(mockProfiles);

      // First call - should use cached profiles
      await profileManager.getAvailableProfiles();
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();

      // Advance time by 30 seconds - should still use cache
      vi.advanceTimersByTime(30000);
      await profileManager.getAvailableProfiles();
      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();

      // Advance time by another 31 seconds - cache expired
      vi.advanceTimersByTime(31000);
      await profileManager.getAvailableProfiles();
      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);
    });

    it('should refresh profiles from extension', async () => {
      await profileManager.refreshProfiles();

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledTimes(1);
      const message = (mockCoordinator.postMessageToExtension as any).mock.calls[0][0];
      expect(message.command).toBe('getTerminalProfiles');
    });
  });

  describe('Message Handling', () => {
    it('should handle profilesUpdated message', () => {
      profileManager.handleMessage({
        command: 'profilesUpdated',
        profiles: mockProfiles,
        defaultProfileId: 'zsh',
      });

      const profiles = profileManager.getProfile('zsh');
      expect(profiles).toBeDefined();

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).toBe('zsh');
    });

    it('should handle defaultProfileChanged message', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');

      profileManager.handleMessage({
        command: 'defaultProfileChanged',
        profileId: 'zsh',
      });

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).toBe('zsh');
    });

    it('should log warning for unknown message command', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      profileManager.handleMessage({
        command: 'unknownCommand',
      });

      // Verify console.warn was called (implementation may log different message format)
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Quick Profile Switching', () => {
    beforeEach(() => {
      profileManager.updateProfiles(mockProfiles);
    });

    it('should switch to profile by index', async () => {
      await profileManager.switchToProfileByIndex(1);

      expect(mockCoordinator.createTerminal).toHaveBeenCalledTimes(1);

      const args = (mockCoordinator.createTerminal as any).mock.calls[0];
      const [, , options] = args;

      expect(options.profileId).toBe('zsh');
    });

    it('should handle out of bounds index gracefully', async () => {
      await profileManager.switchToProfileByIndex(999);

      expect(mockCoordinator.createTerminal).not.toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should provide profile statistics', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');
      profileManager.showProfileSelector();

      const stats = profileManager.getStats();

      expect(stats.totalProfiles).toBe(3);
      expect(stats.defaultProfile).toBe('bash');
      expect(stats.selectorVisible).toBe(true);
      expect(typeof stats.lastRefresh).toBe('number');
    });
  });

  describe('Disposal', () => {
    it('should clean up profile selector on dispose', async () => {
      await profileManager.initialize();
      profileManager.dispose();

      const container = document.getElementById('profile-selector-container');
      expect(container).toBeNull();
    });

    it('should clear all profiles on dispose', async () => {
      profileManager.updateProfiles(mockProfiles);
      profileManager.dispose();

      const stats = profileManager.getStats();
      expect(stats.totalProfiles).toBe(0);
      expect(stats.defaultProfile).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle coordinator not set', async () => {
      const managerWithoutCoordinator = new ProfileManager();

      await managerWithoutCoordinator.initialize();

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await managerWithoutCoordinator.refreshProfiles();

      // Just logs warning, doesn't throw
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
      managerWithoutCoordinator.dispose();
    });

    it('should handle no default profile when creating terminal', async () => {
      profileManager.updateProfiles([]);

      await expect(profileManager.createTerminalWithDefaultProfile()).rejects.toThrow('No default profile available');
    });
  });
});
