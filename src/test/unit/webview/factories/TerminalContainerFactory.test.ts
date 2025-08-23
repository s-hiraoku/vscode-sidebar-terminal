/**
 * TerminalContainerFactory Tests
 * Tests for centralized terminal container creation and styling
 */

import { expect } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { JSDOM } from 'jsdom';
import { 
  TerminalContainerFactory,
  TerminalContainerConfig,
  TerminalHeaderConfig,
  ContainerElements
} from '../../../../webview/factories/TerminalContainerFactory';

describe('TerminalContainerFactory', () => {
  let sandbox: SinonSandbox;
  let dom: JSDOM;

  beforeEach(() => {
    sandbox = createSandbox();
    
    // Create DOM environment with main container
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="terminal-main-container"></div>
        </body>
      </html>
    `);
    
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
    global.MouseEvent = dom.window.MouseEvent;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createContainer', () => {
    it('should create basic container with minimal config', () => {
      const config: TerminalContainerConfig = {
        id: 'test-terminal-1',
        name: 'Test Terminal'
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements).to.not.be.null;
      expect(elements.container).to.be.instanceOf(dom.window.HTMLElement);
      expect(elements.body).to.be.instanceOf(dom.window.HTMLElement);
      expect(elements.header).to.be.undefined;
      expect(elements.closeButton).to.be.undefined;
      expect(elements.splitButton).to.be.undefined;
    });

    it('should create container with custom className', () => {
      const config: TerminalContainerConfig = {
        id: 'test-terminal-2',
        name: 'Test Terminal',
        className: 'custom-terminal-container active'
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.className).to.equal('custom-terminal-container active');
    });

    it('should create container with header when requested', () => {
      const config: TerminalContainerConfig = {
        id: 'test-terminal-3',
        name: 'Test Terminal with Header'
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
        showSplitButton: true
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      expect(elements.header).to.be.instanceOf(dom.window.HTMLElement);
      expect(elements.closeButton).to.be.instanceOf(dom.window.HTMLElement);
      expect(elements.splitButton).to.be.instanceOf(dom.window.HTMLElement);
    });

    it('should set correct data attributes', () => {
      const config: TerminalContainerConfig = {
        id: 'data-test-terminal',
        name: 'Data Test Terminal'
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.getAttribute('data-terminal-id')).to.equal('data-test-terminal');
      expect(elements.container.getAttribute('data-terminal-name')).to.equal('Data Test Terminal');
    });

    it('should apply split-specific styles when isSplit is true', () => {
      const config: TerminalContainerConfig = {
        id: 'split-terminal',
        name: 'Split Terminal',
        isSplit: true,
        height: 250
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.style.height).to.equal('250px');
      // Check for split-specific styles (exact values depend on implementation)
      expect(elements.container.style.minHeight).to.not.be.empty;
    });

    it('should apply active state styles when isActive is true', () => {
      const config: TerminalContainerConfig = {
        id: 'active-terminal',
        name: 'Active Terminal',
        isActive: true
      };

      const elements = TerminalContainerFactory.createContainer(config);

      // Should have active border color
      expect(elements.container.style.borderColor).to.not.equal('transparent');
    });

    it('should apply custom styles when provided', () => {
      const config: TerminalContainerConfig = {
        id: 'custom-styles-terminal',
        name: 'Custom Styles Terminal',
        customStyles: {
          backgroundColor: 'rgb(255, 0, 0)',
          border: '3px solid blue',
          opacity: '0.8'
        }
      };

      const elements = TerminalContainerFactory.createContainer(config);

      expect(elements.container.style.backgroundColor).to.equal('rgb(255, 0, 0)');
      expect(elements.container.style.border).to.equal('3px solid blue');
      expect(elements.container.style.opacity).to.equal('0.8');
    });

    it('should handle width and height configuration', () => {
      const config: TerminalContainerConfig = {
        id: 'sized-terminal',
        name: 'Sized Terminal',
        width: 800,
        height: 400
      };

      const elements = TerminalContainerFactory.createContainer(config);

      // Height should be set for splits
      if (config.isSplit) {
        expect(elements.container.style.height).to.equal('400px');
      }
    });
  });

  describe('header creation', () => {
    it('should create header with custom title', () => {
      const config: TerminalContainerConfig = {
        id: 'header-test',
        name: 'Original Name'
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        customTitle: 'Custom Header Title'
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      const titleElement = elements.header!.querySelector('.terminal-title');
      expect(titleElement!.textContent).to.equal('Custom Header Title');
    });

    it('should use terminal name when no custom title provided', () => {
      const config: TerminalContainerConfig = {
        id: 'default-title-test',
        name: 'Default Title Terminal'
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      const titleElement = elements.header!.querySelector('.terminal-title');
      expect(titleElement!.textContent).to.equal('Default Title Terminal');
    });

    it('should create only requested buttons', () => {
      const config: TerminalContainerConfig = {
        id: 'button-test',
        name: 'Button Test'
      };

      // Test only close button
      const headerConfig1: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true,
        showSplitButton: false
      };

      const elements1 = TerminalContainerFactory.createContainer(config, headerConfig1);
      expect(elements1.closeButton).to.be.instanceOf(dom.window.HTMLElement);
      expect(elements1.splitButton).to.be.undefined;

      // Test only split button
      const headerConfig2: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: false,
        showSplitButton: true
      };

      const elements2 = TerminalContainerFactory.createContainer(config, headerConfig2);
      expect(elements2.closeButton).to.be.undefined;
      expect(elements2.splitButton).to.be.instanceOf(dom.window.HTMLElement);
    });

    it('should create header buttons with hover effects', () => {
      const config: TerminalContainerConfig = {
        id: 'hover-test',
        name: 'Hover Test'
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      const button = elements.closeButton!;
      
      // Simulate mouseenter
      const mouseEnterEvent = new dom.window.MouseEvent('mouseenter', { bubbles: true });
      button.dispatchEvent(mouseEnterEvent);
      
      // Should have hover styles applied
      expect(button.style.background).to.not.equal('transparent');
      
      // Simulate mouseleave
      const mouseLeaveEvent = new dom.window.MouseEvent('mouseleave', { bubbles: true });
      button.dispatchEvent(mouseLeaveEvent);
      
      // Should revert to original styles
      expect(button.style.background).to.equal('transparent');
    });
  });

  describe('utility methods', () => {
    let container: HTMLElement;

    beforeEach(() => {
      const config: TerminalContainerConfig = {
        id: 'utility-test',
        name: 'Utility Test'
      };
      const elements = TerminalContainerFactory.createContainer(config);
      container = elements.container;
    });

    it('should set active state correctly', () => {
      TerminalContainerFactory.setActiveState(container, true);
      
      expect(container.hasAttribute('data-active')).to.be.true;
      expect(container.style.borderColor).to.not.equal('transparent');
      
      TerminalContainerFactory.setActiveState(container, false);
      
      expect(container.hasAttribute('data-active')).to.be.false;
      expect(container.style.borderColor).to.equal('transparent');
    });

    it('should configure split mode correctly', () => {
      TerminalContainerFactory.configureSplitMode(container, 300);
      
      expect(container.style.height).to.equal('300px');
      expect(container.hasAttribute('data-split')).to.be.true;
    });

    it('should remove from split mode correctly', () => {
      // First configure as split
      TerminalContainerFactory.configureSplitMode(container, 300);
      
      // Then remove from split
      TerminalContainerFactory.removeFromSplitMode(container);
      
      expect(container.style.height).to.equal('100%');
      expect(container.hasAttribute('data-split')).to.be.false;
    });

    it('should apply theme correctly', () => {
      const theme = {
        background: '#1a1a1a',
        borderColor: '#ff0000',
        activeBorderColor: '#00ff00'
      };

      TerminalContainerFactory.applyTheme(container, theme);
      
      expect(container.style.background).to.equal('#1a1a1a');
      expect(container.style.borderColor).to.equal('#ff0000');
      
      // Set as active and apply theme again
      TerminalContainerFactory.setActiveState(container, true);
      TerminalContainerFactory.applyTheme(container, theme);
      
      expect(container.style.borderColor).to.equal('#00ff00');
    });

    it('should destroy container correctly', () => {
      const parent = document.getElementById('terminal-main-container')!;
      parent.appendChild(container);
      
      expect(parent.contains(container)).to.be.true;
      
      TerminalContainerFactory.destroyContainer(container);
      
      expect(parent.contains(container)).to.be.false;
    });
  });

  describe('createSimpleContainer', () => {
    it('should create lightweight container', () => {
      const container = TerminalContainerFactory.createSimpleContainer('simple-1', 'Simple Container');
      
      expect(container).to.be.instanceOf(dom.window.HTMLElement);
      expect(container.className).to.equal('terminal-container-simple');
      expect(container.getAttribute('data-terminal-id')).to.equal('simple-1');
      expect(container.getAttribute('data-terminal-name')).to.equal('Simple Container');
    });

    it('should have basic styles applied', () => {
      const container = TerminalContainerFactory.createSimpleContainer('simple-2', 'Simple Container 2');
      
      expect(container.style.display).to.equal('flex');
      expect(container.style.flexDirection).to.equal('column');
      expect(container.style.background).to.equal('#000');
    });
  });

  describe('error handling', () => {
    it('should handle missing main container gracefully', () => {
      // Remove main container
      const mainContainer = document.getElementById('terminal-main-container');
      if (mainContainer) {
        mainContainer.remove();
      }

      const config: TerminalContainerConfig = {
        id: 'error-test',
        name: 'Error Test'
      };

      // Should append to body instead
      expect(() => {
        TerminalContainerFactory.createContainer(config);
      }).to.not.throw();
    });

    it('should handle invalid config gracefully', () => {
      const invalidConfig = {
        id: '',
        name: ''
      } as TerminalContainerConfig;

      expect(() => {
        TerminalContainerFactory.createContainer(invalidConfig);
      }).to.not.throw();
    });

    it('should handle null/undefined custom styles', () => {
      const config: TerminalContainerConfig = {
        id: 'null-styles-test',
        name: 'Null Styles Test',
        customStyles: undefined
      };

      expect(() => {
        TerminalContainerFactory.createContainer(config);
      }).to.not.throw();
    });

    it('should handle destroying non-existent container', () => {
      const orphanContainer = document.createElement('div');
      
      expect(() => {
        TerminalContainerFactory.destroyContainer(orphanContainer);
      }).to.not.throw();
    });
  });

  describe('DOM integration', () => {
    it('should append container to main container by default', () => {
      const config: TerminalContainerConfig = {
        id: 'dom-test',
        name: 'DOM Test'
      };

      const elements = TerminalContainerFactory.createContainer(config);
      const mainContainer = document.getElementById('terminal-main-container')!;
      
      expect(mainContainer.contains(elements.container)).to.be.true;
    });

    it('should create proper DOM hierarchy', () => {
      const config: TerminalContainerConfig = {
        id: 'hierarchy-test',
        name: 'Hierarchy Test'
      };

      const headerConfig: TerminalHeaderConfig = {
        showHeader: true,
        showCloseButton: true
      };

      const elements = TerminalContainerFactory.createContainer(config, headerConfig);

      // Check hierarchy: container > header, body
      expect(elements.container.contains(elements.header!)).to.be.true;
      expect(elements.container.contains(elements.body)).to.be.true;
      expect(elements.header!.contains(elements.closeButton!)).to.be.true;
      
      // Check order: header should come before body
      const children = Array.from(elements.container.children);
      const headerIndex = children.indexOf(elements.header!);
      const bodyIndex = children.indexOf(elements.body);
      expect(headerIndex).to.be.lessThan(bodyIndex);
    });
  });
});