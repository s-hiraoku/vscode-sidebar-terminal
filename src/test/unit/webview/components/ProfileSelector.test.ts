/**
 * ProfileSelector Component Test Suite
 * Tests the terminal profile selector UI component
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { ProfileSelector } from '../../../../webview/components/ProfileSelector';
import { ITerminalProfile } from '../../../../types/profiles';

describe('ProfileSelector Component', () => {
  let profileSelector: ProfileSelector;
  let container: HTMLElement;
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

    // Create container element
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

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

    profileSelector = new ProfileSelector(container);
  });

  afterEach(() => {
    profileSelector.dispose();
    document.body.removeChild(container);
    jsdom.window.close();
  });

  describe('Initialization', () => {
    it('should create profile selector UI elements', () => {
      const overlay = container.querySelector('.profile-selector-overlay');
      expect(overlay).to.exist;

      const dialog = container.querySelector('.profile-selector-dialog');
      expect(dialog).to.exist;

      const header = container.querySelector('.profile-selector-header');
      expect(header).to.exist;

      const filterInput = container.querySelector('.profile-filter');
      expect(filterInput).to.exist;

      const profileList = container.querySelector('.profile-list');
      expect(profileList).to.exist;
    });

    it('should be hidden by default', () => {
      expect(profileSelector.isVisible).to.be.false;
      expect(container.style.display).to.equal('none');
    });
  });

  describe('Show/Hide Functionality', () => {
    it('should show profile selector with profiles', () => {
      profileSelector.show(mockProfiles);

      expect(profileSelector.isVisible).to.be.true;
      expect(container.style.display).to.equal('block');

      const profileItems = container.querySelectorAll('.profile-item');
      expect(profileItems).to.have.length(3);
    });

    it('should hide profile selector', () => {
      profileSelector.show(mockProfiles);
      expect(profileSelector.isVisible).to.be.true;

      profileSelector.hide();

      expect(profileSelector.isVisible).to.be.false;
      expect(container.style.display).to.equal('none');
    });

    it('should clear filter text when hiding', () => {
      profileSelector.show(mockProfiles);

      const filterInput = container.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.value = 'test';

      profileSelector.hide();

      expect(filterInput.value).to.equal('');
    });

    it('should call onClosed callback when hiding', () => {
      const onClosed = sinon.spy();
      profileSelector.show(mockProfiles, undefined, undefined, onClosed);

      profileSelector.hide();

      expect(onClosed.calledOnce).to.be.true;
    });
  });

  describe('Profile List Display', () => {
    it('should display all profiles', () => {
      profileSelector.show(mockProfiles);

      const profileItems = container.querySelectorAll('.profile-item');
      expect(profileItems).to.have.length(3);

      const profileNames = Array.from(profileItems).map(
        (item) => item.querySelector('.profile-item-name')?.textContent?.trim()
      );

      expect(profileNames).to.include('Bash');
      expect(profileNames).to.include('Zsh');
      expect(profileNames).to.include('PowerShell');
    });

    it('should mark default profile with badge', () => {
      profileSelector.show(mockProfiles);

      const bashProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Bash')
      );

      const defaultBadge = bashProfile?.querySelector('.profile-default-badge');
      expect(defaultBadge).to.exist;
      expect(defaultBadge?.textContent).to.equal('Default');
    });

    it('should display profile descriptions', () => {
      profileSelector.show(mockProfiles);

      const descriptions = Array.from(container.querySelectorAll('.profile-item-description')).map(
        (el) => el.textContent
      );

      expect(descriptions).to.include('Bash shell');
      expect(descriptions).to.include('Z shell');
      expect(descriptions).to.include('PowerShell Core');
    });
  });

  describe('Profile Selection', () => {
    it('should select profile on click', () => {
      profileSelector.show(mockProfiles);

      const zshProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Zsh')
      );

      (zshProfile as HTMLElement).click();

      expect(zshProfile?.classList.contains('selected')).to.be.true;

      const confirmBtn = container.querySelector('.profile-selector-confirm') as HTMLButtonElement;
      expect(confirmBtn.disabled).to.be.false;
    });

    it('should call onProfileSelected callback on confirm', () => {
      const onProfileSelected = sinon.spy();
      profileSelector.show(mockProfiles, undefined, onProfileSelected);

      // Select profile
      const zshProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Zsh')
      );
      (zshProfile as HTMLElement).click();

      // Click confirm
      const confirmBtn = container.querySelector('.profile-selector-confirm') as HTMLButtonElement;
      confirmBtn.click();

      expect(onProfileSelected.calledOnce).to.be.true;
      expect(onProfileSelected.calledWith('zsh')).to.be.true;
    });

    it('should confirm selection on double-click', () => {
      const onProfileSelected = sinon.spy();
      profileSelector.show(mockProfiles, undefined, onProfileSelected);

      const zshProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Zsh')
      );

      // Double click
      const dblClickEvent = new jsdom.window.Event('dblclick', { bubbles: true });
      zshProfile?.dispatchEvent(dblClickEvent);

      expect(onProfileSelected.calledOnce).to.be.true;
      expect(onProfileSelected.calledWith('zsh')).to.be.true;
    });

    it('should pre-select specified profile', () => {
      profileSelector.show(mockProfiles, 'zsh');

      const zshProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Zsh')
      );

      expect(zshProfile?.classList.contains('selected')).to.be.true;
    });

    it('should only allow one profile selection at a time', () => {
      profileSelector.show(mockProfiles);

      // Select first profile
      const bashProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Bash')
      );
      (bashProfile as HTMLElement).click();

      expect(bashProfile?.classList.contains('selected')).to.be.true;

      // Select second profile
      const zshProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Zsh')
      );
      (zshProfile as HTMLElement).click();

      // First should be deselected
      expect(bashProfile?.classList.contains('selected')).to.be.false;
      expect(zshProfile?.classList.contains('selected')).to.be.true;
    });
  });

  describe('Filter Functionality', () => {
    it('should filter profiles by name', () => {
      profileSelector.show(mockProfiles);

      const filterInput = container.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.value = 'bash';
      filterInput.dispatchEvent(new jsdom.window.Event('input', { bubbles: true }));

      const visibleProfiles = container.querySelectorAll('.profile-item');
      expect(visibleProfiles).to.have.length(1);
      expect(visibleProfiles[0]!.textContent).to.include('Bash');
    });

    it('should filter profiles by description', () => {
      profileSelector.show(mockProfiles);

      const filterInput = container.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.value = 'Z shell';
      filterInput.dispatchEvent(new jsdom.window.Event('input', { bubbles: true }));

      const visibleProfiles = container.querySelectorAll('.profile-item');
      expect(visibleProfiles).to.have.length(1);
      expect(visibleProfiles[0]!.textContent).to.include('Zsh');
    });

    it('should be case-insensitive', () => {
      profileSelector.show(mockProfiles);

      const filterInput = container.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.value = 'POWERSHELL';
      filterInput.dispatchEvent(new jsdom.window.Event('input', { bubbles: true }));

      const visibleProfiles = container.querySelectorAll('.profile-item');
      expect(visibleProfiles).to.have.length(1);
      expect(visibleProfiles[0]!.textContent).to.include('PowerShell');
    });

    it('should show "no results" message when no profiles match', () => {
      profileSelector.show(mockProfiles);

      const filterInput = container.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.value = 'nonexistent';
      filterInput.dispatchEvent(new jsdom.window.Event('input', { bubbles: true }));

      const noResults = container.querySelector('.profile-no-results');
      expect(noResults).to.exist;
      expect(noResults?.textContent).to.equal('No profiles found');
    });

    it('should focus filter input when shown', () => {
      const focusSpy = sinon.spy();
      const filterInput = container.querySelector('.profile-filter') as HTMLInputElement;
      filterInput.focus = focusSpy;

      profileSelector.show(mockProfiles);

      expect(focusSpy.calledOnce).to.be.true;
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close on Escape key', () => {
      profileSelector.show(mockProfiles);

      const escapeEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      container.dispatchEvent(escapeEvent);

      expect(profileSelector.isVisible).to.be.false;
    });

    it('should confirm selection on Enter key', () => {
      const onProfileSelected = sinon.spy();
      profileSelector.show(mockProfiles, 'bash', onProfileSelected);

      const enterEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      });
      container.dispatchEvent(enterEvent);

      expect(onProfileSelected.calledOnce).to.be.true;
      expect(onProfileSelected.calledWith('bash')).to.be.true;
    });

    it('should navigate down with ArrowDown key', () => {
      profileSelector.show(mockProfiles, 'bash');

      const arrowDownEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      });
      container.dispatchEvent(arrowDownEvent);

      const zshProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Zsh')
      );
      expect(zshProfile?.classList.contains('selected')).to.be.true;
    });

    it('should navigate up with ArrowUp key', () => {
      profileSelector.show(mockProfiles, 'zsh');

      const arrowUpEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
      });
      container.dispatchEvent(arrowUpEvent);

      const bashProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Bash')
      );
      expect(bashProfile?.classList.contains('selected')).to.be.true;
    });

    it('should wrap around when navigating past last item', () => {
      profileSelector.show(mockProfiles, 'powershell');

      const arrowDownEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
      });
      container.dispatchEvent(arrowDownEvent);

      const bashProfile = Array.from(container.querySelectorAll('.profile-item')).find((item) =>
        item.textContent?.includes('Bash')
      );
      expect(bashProfile?.classList.contains('selected')).to.be.true;
    });

    it('should wrap around when navigating past first item', () => {
      profileSelector.show(mockProfiles, 'bash');

      const arrowUpEvent = new jsdom.window.KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
      });
      container.dispatchEvent(arrowUpEvent);

      const powershellProfile = Array.from(container.querySelectorAll('.profile-item')).find(
        (item) => item.textContent?.includes('PowerShell')
      );
      expect(powershellProfile?.classList.contains('selected')).to.be.true;
    });
  });

  describe('Button Actions', () => {
    it('should close on close button click', () => {
      profileSelector.show(mockProfiles);

      const closeBtn = container.querySelector('.profile-selector-close') as HTMLElement;
      closeBtn.click();

      expect(profileSelector.isVisible).to.be.false;
    });

    it('should close on cancel button click', () => {
      profileSelector.show(mockProfiles);

      const cancelBtn = container.querySelector('.profile-selector-cancel') as HTMLElement;
      cancelBtn.click();

      expect(profileSelector.isVisible).to.be.false;
    });

    it('should close on overlay click', () => {
      profileSelector.show(mockProfiles);

      const overlay = container.querySelector('.profile-selector-overlay') as HTMLElement;
      const clickEvent = new jsdom.window.MouseEvent('click', {
        bubbles: true,
        target: overlay,
      } as any);

      Object.defineProperty(clickEvent, 'target', {
        value: overlay,
        writable: false,
      });

      overlay.dispatchEvent(clickEvent);

      expect(profileSelector.isVisible).to.be.false;
    });

    it('should not close when clicking dialog content', () => {
      profileSelector.show(mockProfiles);

      const dialog = container.querySelector('.profile-selector-dialog') as HTMLElement;
      const clickEvent = new jsdom.window.MouseEvent('click', {
        bubbles: true,
      });

      dialog.dispatchEvent(clickEvent);

      expect(profileSelector.isVisible).to.be.true;
    });

    it('should have disabled confirm button when no selection', () => {
      profileSelector.show(mockProfiles);

      const confirmBtn = container.querySelector('.profile-selector-confirm') as HTMLButtonElement;
      expect(confirmBtn.disabled).to.be.true;
    });
  });

  describe('Update Profiles', () => {
    it('should update profile list when visible', () => {
      profileSelector.show(mockProfiles);

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

      profileSelector.updateProfiles(newProfiles);

      const profileItems = container.querySelectorAll('.profile-item');
      expect(profileItems).to.have.length(1);
      expect(profileItems[0]!.textContent).to.include('Command Prompt');
    });

    it('should not update when hidden', () => {
      profileSelector.show(mockProfiles);
      profileSelector.hide();

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

      profileSelector.updateProfiles(newProfiles);

      // Should still show old profiles when re-shown
      profileSelector.show(mockProfiles);
      const profileItems = container.querySelectorAll('.profile-item');
      expect(profileItems).to.have.length(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty profile list', () => {
      profileSelector.show([]);

      const noResults = container.querySelector('.profile-no-results');
      expect(noResults).to.exist;
      expect(noResults?.textContent).to.equal('No profiles available');
    });

    it('should handle profile without description', () => {
      const profilesWithoutDesc: ITerminalProfile[] = [
        {
          id: 'bash',
          name: 'Bash',
          path: '/bin/bash',
          icon: 'terminal-bash',
          isDefault: true,
          args: [],
        },
      ];

      profileSelector.show(profilesWithoutDesc);

      const description = container.querySelector('.profile-item-description');
      expect(description?.textContent).to.equal('/bin/bash');
    });

    it('should escape HTML in profile names', () => {
      const maliciousProfiles: ITerminalProfile[] = [
        {
          id: 'malicious',
          name: '<script>alert("XSS")</script>',
          path: '/bin/bash',
          description: '<img src=x onerror=alert(1)>',
          icon: 'terminal-bash',
          isDefault: true,
          args: [],
        },
      ];

      profileSelector.show(maliciousProfiles);

      const profileName = container.querySelector('.profile-item-name');
      expect(profileName?.innerHTML).to.not.include('<script>');
      expect(profileName?.textContent).to.include('<script>');
    });
  });

  describe('Disposal', () => {
    it('should clean up resources on dispose', () => {
      profileSelector.show(mockProfiles);
      profileSelector.dispose();

      expect(container.innerHTML).to.equal('');
    });

    it('should not add duplicate styles', () => {
      const selector1 = new ProfileSelector(container);
      const selector2 = new ProfileSelector(container);

      const styleElements = document.querySelectorAll('#profile-selector-styles');
      expect(styleElements).to.have.length(1);

      selector1.dispose();
      selector2.dispose();
    });
  });
});
