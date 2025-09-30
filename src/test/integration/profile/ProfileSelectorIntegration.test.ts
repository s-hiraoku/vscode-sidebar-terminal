/**
 * Profile Selector Integration Test Suite
 * Tests the complete profile selection flow including shortcuts and messaging
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { InputManager } from '../../../webview/managers/InputManager';
import { ProfileManager } from '../../../webview/managers/ProfileManager';
import { IManagerCoordinator } from '../../../webview/interfaces/ManagerInterfaces';
import { ITerminalProfile } from '../../../types/profiles';

describe('Profile Selector Integration', () => {
  let inputManager: InputManager;
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
    ];

    // Create mock coordinator with profile manager
    profileManager = new ProfileManager();

    mockCoordinator = {
      postMessageToExtension: sinon.stub(),
      createTerminal: sinon.stub().resolves(),
      getActiveTerminalId: sinon.stub().returns('terminal-1'),
      getManagers: sinon.stub().returns({
        profileManager: profileManager,
        notification: {
          showWarning: sinon.stub(),
          showInfo: sinon.stub(),
        },
      }),
    } as any;

    // Initialize managers
    profileManager.setCoordinator(mockCoordinator as any);
    profileManager.updateProfiles(mockProfiles, 'bash');

    inputManager = new InputManager();
    inputManager.setCoordinator(mockCoordinator as any);
  });

  afterEach(() => {
    inputManager.dispose();
    profileManager.dispose();
    jsdom.window.close();
  });

  describe('Ctrl+Shift+P Shortcut Integration', () => {
    it('should open profile selector on Ctrl+Shift+P', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      expect(profileManager.isProfileSelectorVisible()).to.be.false;

      // Simulate Ctrl+Shift+P keydown
      const event = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(profileManager.isProfileSelectorVisible()).to.be.true;
    });

    it('should not open selector on Ctrl+P without Shift', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      const event = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: false,
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(profileManager.isProfileSelectorVisible()).to.be.false;
    });

    it('should not open selector on Shift+P without Ctrl', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      const event = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: false,
        shiftKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      expect(profileManager.isProfileSelectorVisible()).to.be.false;
    });
  });

  describe('Complete Profile Selection Flow', () => {
    it('should complete full profile selection workflow', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      // Step 1: Open selector with Ctrl+Shift+P
      const openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);

      expect(profileManager.isProfileSelectorVisible()).to.be.true;

      // Step 2: Select profile
      const profileItems = document.querySelectorAll('.profile-item');
      const zshItem = Array.from(profileItems).find((item) => item.textContent?.includes('Zsh'));
      expect(zshItem).to.exist;

      (zshItem as HTMLElement).click();

      // Step 3: Confirm selection
      const confirmBtn = document.querySelector('.profile-selector-confirm') as HTMLButtonElement;
      confirmBtn.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify terminal creation
      expect(mockCoordinator.createTerminal.calledOnce).to.be.true;

      const [, , options] = mockCoordinator.createTerminal.firstCall.args;
      expect(options.profileId).to.equal('zsh');
    });

    it('should close selector on Escape', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      // Open selector
      const openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);

      expect(profileManager.isProfileSelectorVisible()).to.be.true;

      // Close with Escape
      const closeEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });

      const container = document.getElementById('profile-selector-container');
      container?.dispatchEvent(closeEvent);

      expect(profileManager.isProfileSelectorVisible()).to.be.false;
    });

    it('should navigate and select with keyboard only', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      // Open selector
      const openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);

      const container = document.getElementById('profile-selector-container');

      // Navigate down
      const downEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      });
      container?.dispatchEvent(downEvent);

      // Confirm with Enter
      const enterEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      container?.dispatchEvent(enterEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCoordinator.createTerminal.calledOnce).to.be.true;
    });
  });

  describe('Message Flow Integration', () => {
    it('should request profiles from extension', async () => {
      await profileManager.initialize();
      await profileManager.refreshProfiles();

      expect(mockCoordinator.postMessageToExtension.calledOnce).to.be.true;

      const message = mockCoordinator.postMessageToExtension.firstCall.args[0];
      expect(message.command).to.equal('getTerminalProfiles');
    });

    it('should receive and update profiles from extension', () => {
      const newProfiles: ITerminalProfile[] = [
        {
          id: 'cmd',
          name: 'Command Prompt',
          path: 'C:\\Windows\\System32\\cmd.exe',
          description: 'Windows Command Prompt',
          icon: 'terminal-cmd',
          isDefault: true,
          args: [],
        },
      ];

      profileManager.handleMessage({
        command: 'profilesUpdated',
        profiles: newProfiles,
        defaultProfileId: 'cmd',
      });

      const profile = profileManager.getProfile('cmd');
      expect(profile).to.exist;
      expect(profile?.name).to.equal('Command Prompt');

      const defaultProfile = profileManager.getDefaultProfile();
      expect(defaultProfile?.id).to.equal('cmd');
    });

    it('should send terminal creation message to extension', async () => {
      await profileManager.createTerminalWithProfile('bash');

      expect(mockCoordinator.createTerminal.calledOnce).to.be.true;

      const [terminalId, terminalName, options] = mockCoordinator.createTerminal.firstCall.args;

      expect(terminalId).to.be.a('string');
      expect(terminalName).to.include('Bash');
      expect(options.profileId).to.equal('bash');
      expect(options.shell).to.equal('/bin/bash');
    });

    it('should update default profile via extension', async () => {
      await profileManager.setDefaultProfile('zsh');

      expect(mockCoordinator.postMessageToExtension.calledOnce).to.be.true;

      const message = mockCoordinator.postMessageToExtension.firstCall.args[0];
      expect(message.command).to.equal('setDefaultProfile');
      expect(message.profileId).to.equal('zsh');
    });
  });

  describe('Error Handling', () => {
    it('should show warning when no profiles available', async () => {
      profileManager.updateProfiles([], undefined);

      await inputManager.initialize();
      await profileManager.initialize();

      // Open selector
      const openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);

      const notificationManager = mockCoordinator.getManagers().notification;
      expect(notificationManager.showWarning.calledOnce).to.be.true;
      expect(notificationManager.showWarning.calledWith('No terminal profiles available')).to.be
        .true;
    });

    it('should handle terminal creation failure gracefully', async () => {
      mockCoordinator.createTerminal.rejects(new Error('Failed to create terminal'));

      try {
        await profileManager.createTerminalWithProfile('bash');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).to.include('Failed to create terminal');
      }

      const notificationManager = mockCoordinator.getManagers().notification;
      expect(notificationManager.showWarning.called).to.be.true;
    });
  });

  describe('Multiple Profile Selection Cycles', () => {
    it('should handle multiple open-close cycles', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      // Cycle 1: Open and close
      let openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);
      expect(profileManager.isProfileSelectorVisible()).to.be.true;

      profileManager.hideProfileSelector();
      expect(profileManager.isProfileSelectorVisible()).to.be.false;

      // Cycle 2: Open and close again
      openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);
      expect(profileManager.isProfileSelectorVisible()).to.be.true;

      profileManager.hideProfileSelector();
      expect(profileManager.isProfileSelectorVisible()).to.be.false;
    });

    it('should handle rapid selection changes', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      // Open selector
      const openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);

      const profileItems = document.querySelectorAll('.profile-item');

      // Rapid clicks on different profiles
      (profileItems[0] as HTMLElement).click();
      expect(profileItems[0].classList.contains('selected')).to.be.true;

      (profileItems[1] as HTMLElement).click();
      expect(profileItems[0].classList.contains('selected')).to.be.false;
      expect(profileItems[1].classList.contains('selected')).to.be.true;

      (profileItems[0] as HTMLElement).click();
      expect(profileItems[1].classList.contains('selected')).to.be.false;
      expect(profileItems[0].classList.contains('selected')).to.be.true;
    });
  });

  describe('Profile Filtering Integration', () => {
    it('should filter profiles and maintain selection', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      // Open selector
      const openEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'P',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
      });
      document.dispatchEvent(openEvent);

      const filterInput = document.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.value = 'zsh';
      filterInput.dispatchEvent(new jsdom.window.Event('input', { bubbles: true }));

      const visibleProfiles = document.querySelectorAll('.profile-item');
      expect(visibleProfiles).to.have.length(1);
      expect(visibleProfiles[0].textContent).to.include('Zsh');
    });
  });

  describe('Performance', () => {
    it('should handle profile selector open/close without memory leaks', async () => {
      await inputManager.initialize();
      await profileManager.initialize();

      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        profileManager.showProfileSelector();
        expect(profileManager.isProfileSelectorVisible()).to.be.true;

        profileManager.hideProfileSelector();
        expect(profileManager.isProfileSelectorVisible()).to.be.false;
      }

      // Verify container still exists and is properly managed
      const container = document.getElementById('profile-selector-container');
      expect(container).to.exist;
    });

    it('should efficiently update large profile lists', async () => {
      const largeProfileList: ITerminalProfile[] = Array.from({ length: 100 }, (_, i) => ({
        id: `profile-${i}`,
        name: `Profile ${i}`,
        path: `/bin/shell${i}`,
        description: `Description ${i}`,
        icon: 'terminal-bash',
        isDefault: i === 0,
        args: [],
      }));

      const startTime = Date.now();

      profileManager.updateProfiles(largeProfileList, 'profile-0');
      await profileManager.initialize();
      profileManager.showProfileSelector();

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (< 100ms)
      expect(duration).to.be.lessThan(100);

      const profileItems = document.querySelectorAll('.profile-item');
      expect(profileItems).to.have.length(100);
    });
  });
});
