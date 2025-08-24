/**
 * SettingsPanel unit tests
 */
/* eslint-disable */
// @ts-nocheck
import * as sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);
import { JSDOM } from 'jsdom';
import { SettingsPanel } from '../../../webview/components/SettingsPanel';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';

describe('SettingsPanel', () => {
  let dom: JSDOM;
  let document: Document;
  let sandbox: sinon.SinonSandbox;
  let settingsPanel: SettingsPanel;
  let onSettingsChangeSpy: sinon.SinonSpy;
  let onCloseSpy: sinon.SinonSpy;

  beforeEach(() => {
    // 統合されたテスト環境セットアップを使用
    const testEnv = setupCompleteTestEnvironment(`
      <!DOCTYPE html>
      <html>
        <body>
        </body>
      </html>
    `);

    dom = testEnv.dom;
    document = testEnv.document;

    // アニメーション関連のモックを追加
    (global as Record<string, unknown>).requestAnimationFrame = sinon.stub().callsArg(0);

    sandbox = sinon.createSandbox();
    onSettingsChangeSpy = sinon.spy();
    onCloseSpy = sinon.spy();

    settingsPanel = new SettingsPanel({
      onSettingsChange: onSettingsChangeSpy,
      onClose: onCloseSpy,
    });
  });

  afterEach(() => {
    // 統合されたクリーンアップを使用
    cleanupTestEnvironment(sandbox, dom);

    // 追加されたモックのクリーンアップ
    delete (global as Record<string, unknown>).requestAnimationFrame;
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(settingsPanel.visible).to.be.false;
    });

    it('should initialize without callback options', () => {
      const panel = new SettingsPanel();
      expect(panel.visible).to.be.false;
    });
  });

  describe('show', () => {
    it('should show settings panel', () => {
      settingsPanel.show();

      expect(settingsPanel.visible).to.be.true;
      const panel = document.getElementById('settings-panel');
      expect(panel).to.not.be.null;
      expect(panel?.style.position).to.equal('fixed');
      expect(panel?.style.zIndex).to.equal('10000');
    });

    it('should hide panel if already visible', () => {
      settingsPanel.show();
      expect(settingsPanel.visible).to.be.true;

      settingsPanel.show(); // Show again should hide

      expect(settingsPanel.visible).to.be.false;
      const panel = document.getElementById('settings-panel');
      expect(panel).to.be.null;
    });

    it('should populate settings when provided', () => {
      const testSettings = {
        theme: 'dark',
        cursorBlink: true,
      };

      settingsPanel.show(testSettings);

      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;

      expect(themeSelect?.value).to.equal('dark');
      expect(cursorBlinkCheckbox?.checked).to.be.true;
    });

    it('should create settings content with correct structure', () => {
      settingsPanel.show();

      // Check for main elements that should exist after removing font controls
      expect(document.getElementById('theme-select')).to.not.be.null;
      expect(document.getElementById('cursor-blink')).to.not.be.null;
      expect(document.getElementById('apply-settings')).to.not.be.null;
      expect(document.getElementById('reset-settings')).to.not.be.null;
      expect(document.getElementById('close-settings')).to.not.be.null;
    });

    it('should handle error gracefully', () => {
      // Mock createElement to throw error
      const originalCreateElement = document.createElement;
      document.createElement = sinon.stub().throws(new Error('Test error'));

      // Should not throw
      expect(() => settingsPanel.show()).to.not.throw();

      // Restore
      document.createElement = originalCreateElement;
    });
  });

  describe('hide', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should hide settings panel', () => {
      settingsPanel.hide();

      expect(settingsPanel.visible).to.be.false;
      const panel = document.getElementById('settings-panel');
      expect(panel).to.be.null;
    });

    it('should call onClose callback', () => {
      settingsPanel.hide();

      expect(onCloseSpy).to.have.been.calledOnce;
    });

    it('should handle hide when panel not visible', () => {
      settingsPanel.hide();

      // Hide again should not throw
      expect(() => settingsPanel.hide()).to.not.throw();
      expect(onCloseSpy).to.have.been.calledTwice;
    });

    it('should handle error gracefully', () => {
      // Should not throw even if error occurs
      expect(() => settingsPanel.hide()).to.not.throw();
    });
  });

  describe('theme control', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should have theme select options', () => {
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      expect(themeSelect).to.not.be.null;
      // Theme select should exist but specific options depend on implementation
    });

    it('should have cursor blink checkbox', () => {
      const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;
      expect(cursorBlinkCheckbox).to.not.be.null;
      expect(cursorBlinkCheckbox.type).to.equal('checkbox');
    });
  });

  describe('button interactions', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should close panel when close button is clicked', () => {
      const closeBtn = document.getElementById('close-settings');

      const clickEvent = new dom.window.Event('click');
      closeBtn?.dispatchEvent(clickEvent);

      expect(settingsPanel.visible).to.be.false;
    });

    it('should apply settings when apply button is clicked', () => {
      const applyBtn = document.getElementById('apply-settings');

      const clickEvent = new dom.window.Event('click');
      applyBtn?.dispatchEvent(clickEvent);

      expect(onSettingsChangeSpy).to.have.been.calledOnce;
      expect(settingsPanel.visible).to.be.false;
    });

    it('should reset settings when reset button is clicked', () => {
      // First set some custom values for theme
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;

      if (themeSelect) themeSelect.value = 'light';
      if (cursorBlinkCheckbox) cursorBlinkCheckbox.checked = false;

      const resetBtn = document.getElementById('reset-settings');
      const clickEvent = new dom.window.Event('click');
      resetBtn?.dispatchEvent(clickEvent);

      // Should be reset to defaults (depends on implementation)
      // Just verify the reset button exists and can be clicked
      expect(resetBtn).to.not.be.null;
    });
  });

  describe('keyboard and mouse interactions', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should close panel when Escape key is pressed', () => {
      const escapeEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape' });
      document.documentElement.dispatchEvent(escapeEvent);

      expect(settingsPanel.visible).to.be.false;
    });

    it('should not close panel when other keys are pressed', () => {
      const enterEvent = new dom.window.KeyboardEvent('keydown', { key: 'Enter' });
      document.documentElement.dispatchEvent(enterEvent);

      expect(settingsPanel.visible).to.be.true;
    });

    it('should close panel when background is clicked', () => {
      const panel = document.getElementById('settings-panel');

      const clickEvent = new dom.window.Event('click');
      Object.defineProperty(clickEvent, 'target', { value: panel });
      panel?.dispatchEvent(clickEvent);

      expect(settingsPanel.visible).to.be.false;
    });

    it('should not close panel when content is clicked', () => {
      const panel = document.getElementById('settings-panel');
      const content = panel?.firstElementChild;

      const clickEvent = new dom.window.Event('click');
      Object.defineProperty(clickEvent, 'target', { value: content });
      panel?.dispatchEvent(clickEvent);

      expect(settingsPanel.visible).to.be.true;
    });
  });

  describe('settings collection', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should collect current settings correctly', () => {
      // Set specific values for available controls
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;
      const cliAgentCheckbox = document.getElementById('cli-agent-integration') as HTMLInputElement;

      // Verify elements exist
      expect(themeSelect).to.not.be.null;
      expect(cursorBlinkCheckbox).to.not.be.null;
      expect(cliAgentCheckbox).to.not.be.null;

      // Set values
      themeSelect.value = 'light';
      cursorBlinkCheckbox.checked = true;
      cliAgentCheckbox.checked = false; // Test different value

      // Verify values are set
      expect(themeSelect.value).to.equal('light');
      expect(cursorBlinkCheckbox.checked).to.be.true;
      expect(cliAgentCheckbox.checked).to.be.false;

      // Trigger apply to collect settings
      const applyBtn = document.getElementById('apply-settings');
      const clickEvent = new dom.window.Event('click');
      applyBtn?.dispatchEvent(clickEvent);

      expect(onSettingsChangeSpy).to.have.been.calledOnce;
      const collectedSettings = onSettingsChangeSpy.getCall(0).args[0];

      expect(collectedSettings).to.deep.equal({
        theme: 'light',
        cursorBlink: true,
        enableCliAgentIntegration: false,
      });
    });

    it('should use defaults for missing elements', () => {
      // Remove the theme select element
      const themeSelect = document.getElementById('theme-select');
      themeSelect?.remove();

      const applyBtn = document.getElementById('apply-settings');
      const clickEvent = new dom.window.Event('click');
      applyBtn?.dispatchEvent(clickEvent);

      expect(onSettingsChangeSpy).to.have.been.calledOnce;
      const collectedSettings = onSettingsChangeSpy.getCall(0).args[0];

      expect(collectedSettings.theme).to.equal('auto'); // Default theme
      expect(collectedSettings.cursorBlink).to.equal(true); // Default cursor blink
      expect(collectedSettings.enableCliAgentIntegration).to.equal(true); // Default CLI integration
    });
  });

  describe('settings population', () => {
    it('should handle missing settings gracefully', () => {
      settingsPanel.show();

      // Should not throw when no settings provided
      expect(() => settingsPanel.show()).to.not.throw();
    });

    it('should handle partial settings', () => {
      const partialSettings = {
        theme: 'dark',
        // Missing cursorBlink and enableCliAgentIntegration
      };

      settingsPanel.show(partialSettings);

      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;
      const cliAgentCheckbox = document.getElementById('cli-agent-integration') as HTMLInputElement;

      expect(themeSelect?.value).to.equal('dark');
      // Missing values should not be set (checkboxes remain as default)
      expect(cursorBlinkCheckbox?.checked).to.be.true; // Default
      expect(cliAgentCheckbox?.checked).to.be.true; // Default
    });

    it('should handle invalid settings gracefully', () => {
      const invalidSettings = {
        theme: null,
        cursorBlink: 'string',
        enableCliAgentIntegration: 123,
      } as any;

      // Should not throw
      expect(() => settingsPanel.show(invalidSettings)).to.not.throw();
    });
  });

  describe('CLI Agent integration control', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should have CLI Agent integration checkbox', () => {
      const cliAgentCheckbox = document.getElementById('cli-agent-integration') as HTMLInputElement;
      expect(cliAgentCheckbox).to.not.be.null;
      expect(cliAgentCheckbox.type).to.equal('checkbox');
      expect(cliAgentCheckbox.checked).to.be.true; // Default state
    });
  });

  describe('theme options', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should have correct theme options', () => {
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      const options = Array.from(themeSelect.options).map((opt) => opt.value);

      expect(options).to.include('auto');
      expect(options).to.include('dark');
      expect(options).to.include('light');
    });
  });

  describe('reset to defaults', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should reset all settings to defaults', () => {
      // Set non-default values
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
      const cursorBlinkCheckbox = document.getElementById('cursor-blink') as HTMLInputElement;
      const cliAgentCheckbox = document.getElementById('cli-agent-integration') as HTMLInputElement;

      if (themeSelect) themeSelect.value = 'light';
      if (cursorBlinkCheckbox) cursorBlinkCheckbox.checked = false;
      if (cliAgentCheckbox) cliAgentCheckbox.checked = false;

      // Reset
      const resetBtn = document.getElementById('reset-settings');
      const clickEvent = new dom.window.Event('click');
      resetBtn?.dispatchEvent(clickEvent);

      // Check defaults
      if (themeSelect) expect(themeSelect.value).to.equal('auto');
      if (cursorBlinkCheckbox) expect(cursorBlinkCheckbox.checked).to.be.true;
      if (cliAgentCheckbox) expect(cliAgentCheckbox.checked).to.be.true;
    });
  });

  describe('dispose', () => {
    it('should clean up panel', () => {
      settingsPanel.show();
      expect(settingsPanel.visible).to.be.true;

      settingsPanel.dispose();

      expect(settingsPanel.visible).to.be.false;
      const panel = document.getElementById('settings-panel');
      expect(panel).to.be.null;
    });

    it('should handle dispose when panel not shown', () => {
      // Should not throw
      expect(() => settingsPanel.dispose()).to.not.throw();
    });
  });

  describe('panel animations', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should set up animation styles when showing', () => {
      const panel = document.getElementById('settings-panel');

      expect(panel?.style.opacity).to.equal('1');
      expect(panel?.style.transition).to.include('opacity');
    });
  });

  describe('accessibility features', () => {
    beforeEach(() => {
      settingsPanel.show();
    });

    it('should have proper labels for form controls', () => {
      const themeSelect = document.getElementById('theme-select');
      const cursorBlinkCheckbox = document.getElementById('cursor-blink');
      const cliAgentCheckbox = document.getElementById('cli-agent-integration');

      // Test that at least the settings panel structure exists
      const settingsPanel = document.getElementById('settings-panel');
      expect(settingsPanel).to.not.be.null;
      
      // All current form controls should exist
      expect(themeSelect).to.not.be.null;
      expect(cursorBlinkCheckbox).to.not.be.null;
      expect(cliAgentCheckbox).to.not.be.null;
    });

    it('should have close button with title attribute', () => {
      const closeBtn = document.getElementById('close-settings');

      expect(closeBtn?.getAttribute('title')).to.equal('Close');
    });
  });
});
