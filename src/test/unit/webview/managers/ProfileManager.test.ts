/**
 * ProfileManager Test Suite
 * Tests the profile management functionality including selector integration
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { ProfileManager } from '../../../../webview/managers/ProfileManager';
import { IManagerCoordinator } from '../../../../webview/interfaces/ManagerInterfaces';
import { ITerminalProfile } from '../../../../types/profiles';

describe('ProfileManager', () => {
  let profileManager: ProfileManager;
  let mockCoordinator: sinon.SinonStubbedInstance<IManagerCoordinator>;
  let jsdom: JSDOM;
  let mockProfiles: ITerminalProfile[];

  beforeEach(() => {
    // Setup JSDOM environment
    jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost',
      pretendToBeVisual: true,
    });

    global.window = jsdom.window as any;
    global.document = jsdom.window.document;
    global.Event = jsdom.window.Event;
    global.KeyboardEvent = jsdom.window.KeyboardEvent;

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
      postMessageToExtension: sinon.stub(),
      createTerminal: sinon.stub().resolves(),
      getManagers: sinon.stub().returns({
        notification: {
          showWarning: sinon.stub(),
          showInfo: sinon.stub(),
        },
      }),
    } as any;

    profileManager = new ProfileManager();
    profileManager.setCoordinator(mockCoordinator as any);
  });

  afterEach(() => {
    profileManager.dispose();
    jsdom.window.close();
  });

  describe('Initialization', () => {
    it('should create profile selector container', async () => {
      await profileManager.initialize();

      const container = document.getElementById('profile-selector-container');
      expect(container).to.exist;
      expect(container?.style.display).to.equal('none');
    });

    it('should initialize with no profiles', async () => {
      await profileManager.initialize();

      const profiles = await profileManager.getAvailableProfiles();
      expect(profiles).to.have.length(0);
    });
  });

  describe('Profile Management', () => {
    it('should update profiles from extension', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');

      const profile = profileManager.getProfile('bash');
      expect(profile).to.exist;
      expect(profile?.name).to.equal('Bash');
    });

    it('should identify default profile', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).to.equal('bash');
      expect(defaultProfile?.isDefault).to.be.true;
    });

    it('should get profile by ID', () => {
      profileManager.updateProfiles(mockProfiles);

      const zshProfile = profileManager.getProfile('zsh');
      expect(zshProfile).to.exist;
      expect(zshProfile?.name).to.equal('Zsh');
    });

    it('should return undefined for non-existent profile', () => {
      profileManager.updateProfiles(mockProfiles);

      const nonExistent = profileManager.getProfile('nonexistent');
      expect(nonExistent).to.be.undefined;
    });

    it('should get all available profiles', async () => {
      profileManager.updateProfiles(mockProfiles);

      const profiles = await profileManager.getAvailableProfiles();
      expect(profiles).to.have.length(3);
    });

    it('should fallback to first profile when no default specified', () => {
      profileManager.updateProfiles(mockProfiles);

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile).to.exist;
    });
  });

  describe('Profile Selector UI', () => {
    beforeEach(async () => {
      await profileManager.initialize();
      profileManager.updateProfiles(mockProfiles, 'bash');
    });

    it('should show profile selector', () => {
      profileManager.showProfileSelector();

      expect(profileManager.isProfileSelectorVisible()).to.be.true;

      const container = document.getElementById('profile-selector-container');
      expect(container?.style.display).to.equal('block');
    });

    it('should hide profile selector', () => {
      profileManager.showProfileSelector();
      profileManager.hideProfileSelector();

      expect(profileManager.isProfileSelectorVisible()).to.be.false;

      const container = document.getElementById('profile-selector-container');
      expect(container?.style.display).to.equal('none');
    });

    it('should show warning when no profiles available', () => {
      profileManager.updateProfiles([], undefined);
      profileManager.showProfileSelector();

      const notificationManager = mockCoordinator.getManagers().notification as any;
      expect((notificationManager.showWarning as sinon.SinonStub).calledOnce).to.be.true;
      expect(
        (notificationManager.showWarning as sinon.SinonStub).calledWith(
          'No terminal profiles available'
        )
      ).to.be.true;
    });

    it('should call onProfileSelected callback when profile selected', (done) => {
      profileManager.showProfileSelector((profileId: string) => {
        expect(profileId).to.equal('zsh');
        done();
      });

      // Simulate profile selection
      const profileItems = document.querySelectorAll('.profile-item');
      const zshItem = Array.from(profileItems).find((item) => item.textContent?.includes('Zsh'));
      (zshItem as HTMLElement)?.click();

      const confirmBtn = document.querySelector('.profile-selector-confirm') as HTMLButtonElement;
      confirmBtn?.click();
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
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCoordinator.createTerminal.called).to.be.true;
    });
  });

  describe('Default Profile Management', () => {
    beforeEach(() => {
      profileManager.updateProfiles(mockProfiles, 'bash');
    });

    it('should set default profile', async () => {
      await profileManager.setDefaultProfile('zsh');

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).to.equal('zsh');
    });

    it('should notify extension of default profile change', async () => {
      await profileManager.setDefaultProfile('zsh');

      expect((mockCoordinator.postMessageToExtension as sinon.SinonStub).calledOnce).to.be.true;
      const message = (mockCoordinator.postMessageToExtension as sinon.SinonStub).firstCall.args[0];
      expect((message as any).command).to.equal('setDefaultProfile');
      expect((message as any).profileId).to.equal('zsh');
    });

    it('should throw error when setting non-existent profile as default', async () => {
      try {
        await profileManager.setDefaultProfile('nonexistent');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.include('Profile not found');
      }
    });

    it('should update isDefault flag on all profiles', async () => {
      await profileManager.setDefaultProfile('zsh');

      const bashProfile = profileManager.getProfile('bash');
      const zshProfile = profileManager.getProfile('zsh');

      expect(bashProfile?.isDefault).to.be.false;
      expect(zshProfile?.isDefault).to.be.true;
    });
  });

  describe('Terminal Creation with Profile', () => {
    beforeEach(() => {
      profileManager.updateProfiles(mockProfiles, 'bash');
    });

    it('should create terminal with specified profile', async () => {
      await profileManager.createTerminalWithProfile('zsh');

      expect((mockCoordinator.createTerminal as sinon.SinonStub).calledOnce).to.be.true;

      const args = (mockCoordinator.createTerminal as sinon.SinonStub).firstCall.args;
      const [terminalId, terminalName, options] = args;

      expect(terminalId).to.be.a('string');
      expect(terminalName as string).to.include('Zsh');
      expect((options as any).profileId).to.equal('zsh');
      expect((options as any).shell).to.equal('/bin/zsh');
    });

    it('should create terminal with custom name', async () => {
      await profileManager.createTerminalWithProfile('bash', 'My Custom Terminal');

      const args = (mockCoordinator.createTerminal as sinon.SinonStub).firstCall.args;
      const [, terminalName] = args;

      expect(terminalName).to.equal('My Custom Terminal');
    });

    it('should create terminal with default profile', async () => {
      await profileManager.createTerminalWithDefaultProfile();

      expect((mockCoordinator.createTerminal as sinon.SinonStub).calledOnce).to.be.true;

      const args = (mockCoordinator.createTerminal as sinon.SinonStub).firstCall.args;
      const [, , options] = args;

      expect((options as any).profileId).to.equal('bash');
    });

    it('should throw error when creating terminal with non-existent profile', async () => {
      try {
        await profileManager.createTerminalWithProfile('nonexistent');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.include('Profile not found');
      }
    });

    it('should show warning on terminal creation failure', async () => {
      (mockCoordinator.createTerminal as sinon.SinonStub).rejects(new Error('Creation failed'));

      try {
        await profileManager.createTerminalWithProfile('bash');
        expect.fail('Should have thrown error');
      } catch (error) {
        const notificationManager = mockCoordinator.getManagers().notification as any;
        expect((notificationManager.showWarning as sinon.SinonStub).called).to.be.true;
      }
    });
  });

  describe('Profile Cache Management', () => {
    it('should cache profiles for 1 minute', async () => {
      const clock = sinon.useFakeTimers();

      profileManager.updateProfiles(mockProfiles);

      // First call - should use cached profiles
      await profileManager.getAvailableProfiles();
      expect(mockCoordinator.postMessageToExtension.called).to.be.false;

      // Advance time by 30 seconds - should still use cache
      clock.tick(30000);
      await profileManager.getAvailableProfiles();
      expect(mockCoordinator.postMessageToExtension.called).to.be.false;

      // Advance time by another 31 seconds - cache expired
      clock.tick(31000);
      await profileManager.getAvailableProfiles();
      expect(mockCoordinator.postMessageToExtension.calledOnce).to.be.true;

      clock.restore();
    });

    it('should refresh profiles from extension', async () => {
      await profileManager.refreshProfiles();

      expect((mockCoordinator.postMessageToExtension as sinon.SinonStub).calledOnce).to.be.true;
      const message = (mockCoordinator.postMessageToExtension as sinon.SinonStub).firstCall.args[0];
      expect((message as any).command).to.equal('getTerminalProfiles');
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
      expect(profiles).to.exist;

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).to.equal('zsh');
    });

    it('should handle defaultProfileChanged message', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');

      profileManager.handleMessage({
        command: 'defaultProfileChanged',
        profileId: 'zsh',
      });

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).to.equal('zsh');
    });

    it('should log warning for unknown message command', () => {
      const consoleWarnStub = sinon.stub(console, 'warn');

      profileManager.handleMessage({
        command: 'unknownCommand',
      });

      expect(consoleWarnStub.calledOnce).to.be.true;
      expect(consoleWarnStub.firstCall.args[0]).to.include('Unknown message command');

      consoleWarnStub.restore();
    });
  });

  describe('Quick Profile Switching', () => {
    beforeEach(() => {
      profileManager.updateProfiles(mockProfiles);
    });

    it('should switch to profile by index', async () => {
      await profileManager.switchToProfileByIndex(1);

      expect((mockCoordinator.createTerminal as sinon.SinonStub).calledOnce).to.be.true;

      const args = (mockCoordinator.createTerminal as sinon.SinonStub).firstCall.args;
      const [, , options] = args;

      expect((options as any).profileId).to.equal('zsh');
    });

    it('should handle out of bounds index gracefully', async () => {
      await profileManager.switchToProfileByIndex(999);

      expect(mockCoordinator.createTerminal.called).to.be.false;
    });
  });

  describe('Statistics', () => {
    it('should provide profile statistics', () => {
      profileManager.updateProfiles(mockProfiles, 'bash');
      profileManager.showProfileSelector();

      const stats = profileManager.getStats();

      expect(stats.totalProfiles).to.equal(3);
      expect(stats.defaultProfile).to.equal('bash');
      expect(stats.selectorVisible).to.be.true;
      expect(stats.lastRefresh).to.be.a('number');
    });
  });

  describe('Disposal', () => {
    it('should clean up profile selector on dispose', async () => {
      await profileManager.initialize();
      profileManager.dispose();

      const container = document.getElementById('profile-selector-container');
      expect(container).to.be.null;
    });

    it('should clear all profiles on dispose', async () => {
      profileManager.updateProfiles(mockProfiles);
      profileManager.dispose();

      const stats = profileManager.getStats();
      expect(stats.totalProfiles).to.equal(0);
      expect(stats.defaultProfile).to.be.null;
    });
  });

  describe('Edge Cases', () => {
    it('should handle coordinator not set', async () => {
      const managerWithoutCoordinator = new ProfileManager();

      await managerWithoutCoordinator.initialize();

      // Should not throw, but log error
      const consoleErrorStub = sinon.stub(console, 'error');
      await managerWithoutCoordinator.refreshProfiles();

      expect(consoleErrorStub.called).to.be.false; // Just logs warning

      consoleErrorStub.restore();
      managerWithoutCoordinator.dispose();
    });

    it('should handle no default profile when creating terminal', async () => {
      profileManager.updateProfiles([]);

      try {
        await profileManager.createTerminalWithDefaultProfile();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.include('No default profile available');
      }
    });
  });
});
