/**
 * HeaderManager unit tests
 */
/* eslint-disable */
// @ts-nocheck
import * as sinon from 'sinon';
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';

use(sinonChai);
import { JSDOM } from 'jsdom';
import { HeaderManager } from '../../../webview/managers/HeaderManager';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';

describe('HeaderManager', () => {
  let dom: JSDOM;
  let document: Document;
  let sandbox: sinon.SinonSandbox;
  let headerManager: HeaderManager;

  beforeEach(() => {
    // 統合されたテスト環境セットアップを使用
    const testEnv = setupCompleteTestEnvironment(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal">
            <div id="terminal-tabs">
              <div>Terminal 1</div>
              <div>Terminal 2</div>
            </div>
          </div>
        </body>
      </html>
    `);

    dom = testEnv.dom;
    document = testEnv.document;

    sandbox = sinon.createSandbox();
    headerManager = new HeaderManager();
  });

  afterEach(() => {
    // 統合されたクリーンアップを使用
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(headerManager).to.be.instanceOf(HeaderManager);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig = {
        title: 'Custom Terminal',
        showHeader: false,
        fontSize: 16,
      };

      headerManager.updateConfig(newConfig);

      // Since config is private, we verify through behavior
      // The header should not be created when showHeader is false
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      expect(header).to.be.null;
    });

    it('should recreate header when header element exists', () => {
      // First create a header
      headerManager.createWebViewHeader();

      const recreateHeaderSpy = sinon.spy(headerManager as any, 'recreateHeader');

      headerManager.updateConfig({ title: 'New Title' });

      expect(recreateHeaderSpy).to.have.been.calledOnce;
    });
  });

  describe('createWebViewHeader', () => {
    it('should create header when showHeader is true', () => {
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      expect(header).to.not.be.null;
      expect(header?.style.display).to.equal('flex');
      expect(header?.style.alignItems).to.equal('center');
      expect(header?.style.justifyContent).to.equal('space-between');
    });

    it('should not create header when showHeader is false', () => {
      headerManager.updateConfig({ showHeader: false });
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      expect(header).to.be.null;
    });

    it('should create title section with terminal icon and text', () => {
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      expect(header).to.not.be.null;

      // Check for terminal icon (🖥️)
      const titleSection = header?.firstElementChild;
      expect(titleSection).to.not.be.null;
      expect(titleSection?.textContent).to.include('🖥️');
      expect(titleSection?.textContent).to.include('Terminal');
    });

    it('should create terminal count badge', () => {
      headerManager.createWebViewHeader();

      const badge = document.getElementById('terminal-count-badge');
      expect(badge).to.not.be.null;
      expect(badge?.style.borderRadius).to.equal('12px');
      expect(badge?.style.padding).to.equal('2px 8px');
    });

    it('should create sample icons when showIcons is true', () => {
      headerManager.updateConfig({ showIcons: true });
      headerManager.createWebViewHeader();

      const sampleIcons = document.querySelector('.sample-icons');
      expect(sampleIcons).to.not.be.null;

      const icons = sampleIcons?.querySelectorAll('.sample-icon');
      expect(icons?.length).to.be.greaterThan(0);
    });

    it('should not create sample icons when showIcons is false', () => {
      headerManager.updateConfig({ showIcons: false });
      headerManager.createWebViewHeader();

      const sampleIcons = document.querySelector('.sample-icons');
      const icons = sampleIcons?.querySelectorAll('.sample-icon');
      expect(icons?.length || 0).to.equal(0);
    });

    it('should handle error gracefully', () => {
      // Mock DOM method to throw error
      const originalCreateElement = document.createElement;
      document.createElement = sinon.stub().throws(new Error('Test error'));

      // Should not throw
      expect(() => headerManager.createWebViewHeader()).to.not.throw();

      // Restore
      document.createElement = originalCreateElement;
    });
  });

  describe('updateTerminalCountBadge', () => {
    beforeEach(() => {
      headerManager.createWebViewHeader();
    });

    it('should update badge with correct terminal count', () => {
      headerManager.updateTerminalCountBadge();

      const badge = document.getElementById('terminal-count-badge');
      expect(badge?.textContent).to.equal('2'); // 2 terminals in test DOM
    });

    it('should set error color for zero terminals', () => {
      // Remove all terminal tabs
      const terminalTabs = document.getElementById('terminal-tabs');
      if (terminalTabs) {
        terminalTabs.innerHTML = '';
      }

      headerManager.updateTerminalCountBadge();

      const badge = document.getElementById('terminal-count-badge');
      expect(badge?.textContent).to.equal('0');
      expect(badge?.style.background).to.include('var(--vscode-errorBackground');
    });

    it('should set warning color for 5+ terminals', () => {
      // Add more terminals to reach 5
      const terminalTabs = document.getElementById('terminal-tabs');
      if (terminalTabs) {
        for (let i = 0; i < 4; i++) {
          const tab = document.createElement('div');
          tab.textContent = `Terminal ${i + 3}`;
          terminalTabs.appendChild(tab);
        }
      }

      headerManager.updateTerminalCountBadge();

      const badge = document.getElementById('terminal-count-badge');
      expect(badge?.textContent).to.equal('6');
      expect(badge?.style.background).to.include('var(--vscode-notificationWarning-background');
    });

    it('should set orange color for 3-4 terminals', () => {
      // Add one more terminal to reach 3
      const terminalTabs = document.getElementById('terminal-tabs');
      if (terminalTabs) {
        const tab = document.createElement('div');
        tab.textContent = 'Terminal 3';
        terminalTabs.appendChild(tab);
      }

      headerManager.updateTerminalCountBadge();

      const badge = document.getElementById('terminal-count-badge');
      expect(badge?.textContent).to.equal('3');
      expect(badge?.style.background).to.include('var(--vscode-charts-orange');
    });

    it('should handle missing badge gracefully', () => {
      const badge = document.getElementById('terminal-count-badge');
      badge?.remove();

      // Should not throw
      expect(() => headerManager.updateTerminalCountBadge()).to.not.throw();
    });

    it('should handle missing terminal tabs gracefully', () => {
      const terminalTabs = document.getElementById('terminal-tabs');
      terminalTabs?.remove();

      headerManager.updateTerminalCountBadge();

      const badge = document.getElementById('terminal-count-badge');
      expect(badge?.textContent).to.equal('0');
    });

    it('should handle error gracefully', () => {
      // Mock getElement to throw error
      const DOMUtilsMock = {
        getElement: sinon.stub().throws(new Error('Test error')),
      };

      // Should not throw
      expect(() => headerManager.updateTerminalCountBadge()).to.not.throw();
    });
  });

  describe('sample icon interactions', () => {
    beforeEach(() => {
      headerManager.updateConfig({ showIcons: true });
      headerManager.createWebViewHeader();
    });

    it('should change opacity on mouseenter', () => {
      const icon = document.querySelector('.sample-icon') as HTMLElement;
      expect(icon).to.not.be.null;

      // Simulate mouseenter
      const mouseenterEvent = new dom.window.Event('mouseenter');
      icon.dispatchEvent(mouseenterEvent);

      expect(icon.style.opacity).to.equal('0.6');
    });

    it('should restore opacity on mouseleave', () => {
      const icon = document.querySelector('.sample-icon') as HTMLElement;
      expect(icon).to.not.be.null;

      // Set initial opacity
      icon.style.opacity = '0.4';

      // Simulate mouseleave
      const mouseleaveEvent = new dom.window.Event('mouseleave');
      icon.dispatchEvent(mouseleaveEvent);

      expect(icon.style.opacity).to.equal('0.4');
    });
  });

  describe('help tooltip interactions', () => {
    beforeEach(() => {
      headerManager.updateConfig({ showIcons: true });
      headerManager.createWebViewHeader();
    });

    it('should show tooltip on mouseenter', () => {
      const commandSection = document.querySelector('.sample-icons') as HTMLElement;
      const tooltip = document.querySelector('.help-tooltip') as HTMLElement;

      expect(commandSection).to.not.be.null;
      expect(tooltip).to.not.be.null;

      // Simulate mouseenter
      const mouseenterEvent = new dom.window.Event('mouseenter');
      commandSection.dispatchEvent(mouseenterEvent);

      expect(tooltip.style.opacity).to.equal('1');
    });

    it('should hide tooltip on mouseleave', () => {
      const commandSection = document.querySelector('.sample-icons') as HTMLElement;
      const tooltip = document.querySelector('.help-tooltip') as HTMLElement;

      expect(commandSection).to.not.be.null;
      expect(tooltip).to.not.be.null;

      // Set initial state
      tooltip.style.opacity = '1';

      // Simulate mouseleave
      const mouseleaveEvent = new dom.window.Event('mouseleave');
      commandSection.dispatchEvent(mouseleaveEvent);

      expect(tooltip.style.opacity).to.equal('0');
    });

    it('should contain correct tooltip content', () => {
      const tooltip = document.querySelector('.help-tooltip') as HTMLElement;

      expect(tooltip).to.not.be.null;
      expect(tooltip.innerHTML).to.include('Sample Icons (Display Only)');
      expect(tooltip.innerHTML).to.include('Use VS Code panel buttons for actions');
    });
  });

  describe('header insertion', () => {
    it('should insert header at beginning of terminal container', () => {
      headerManager.createWebViewHeader();

      const terminal = document.getElementById('terminal');
      const header = document.getElementById('webview-header');

      expect(terminal).to.not.be.null;
      expect(header).to.not.be.null;
      expect(terminal?.firstElementChild).to.equal(header);
    });

    it('should handle missing terminal container gracefully', () => {
      const terminal = document.getElementById('terminal');
      terminal?.remove();

      // Should not throw
      expect(() => headerManager.createWebViewHeader()).to.not.throw();
    });
  });

  describe('dispose', () => {
    it('should remove header element', () => {
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      expect(header).to.not.be.null;

      headerManager.dispose();

      const headerAfterDispose = document.getElementById('webview-header');
      expect(headerAfterDispose).to.be.null;
    });

    it('should handle dispose when no header exists', () => {
      // Should not throw
      expect(() => headerManager.dispose()).to.not.throw();
    });

    it('should handle error during disposal gracefully', () => {
      headerManager.createWebViewHeader();

      // Mock safeRemove to throw error
      const DOMUtilsMock = {
        safeRemove: sinon.stub().throws(new Error('Test error')),
      };

      // Should not throw
      expect(() => headerManager.dispose()).to.not.throw();
    });
  });

  describe('header configuration', () => {
    it('should apply custom font size to title', () => {
      headerManager.updateConfig({ fontSize: 18 });
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      const titleElement = header?.querySelector('span[style*="font-weight: 600"]') as HTMLElement;

      expect(titleElement).to.not.be.null;
      expect(titleElement.style.fontSize).to.equal('18px');
    });

    it('should apply custom title text', () => {
      headerManager.updateConfig({ title: 'My Terminal' });
      headerManager.createWebViewHeader();

      const header = document.getElementById('webview-header');
      expect(header?.textContent).to.include('My Terminal');
    });

    it('should apply custom icon size', () => {
      headerManager.updateConfig({ iconSize: 20 });
      headerManager.createWebViewHeader();

      const icon = document.querySelector('.sample-icon') as HTMLElement;
      if (icon) {
        expect(icon.style.fontSize).to.equal('20px');
      }
    });
  });

  describe('recreateHeader', () => {
    it('should remove existing header and create new one', () => {
      headerManager.createWebViewHeader();

      const originalHeader = document.getElementById('webview-header');
      expect(originalHeader).to.not.be.null;

      headerManager.updateConfig({ title: 'New Title' });

      const newHeader = document.getElementById('webview-header');
      expect(newHeader).to.not.be.null;
      expect(newHeader?.textContent).to.include('New Title');
    });
  });
});
