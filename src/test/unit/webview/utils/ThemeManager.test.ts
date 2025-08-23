/**
 * ThemeManager Utility Tests
 * Tests for centralized theme and styling management with VS Code integration
 */

import { expect } from 'chai';
import { SinonSandbox, createSandbox } from 'sinon';
import { JSDOM } from 'jsdom';
import { ThemeManager } from '../../../../webview/utils/ThemeManager';

describe('ThemeManager', () => {
  let sandbox: SinonSandbox;
  let dom: JSDOM;
  let testElement: HTMLElement;

  beforeEach(() => {
    sandbox = createSandbox();
    
    // Create DOM environment with CSS custom properties
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --vscode-editor-background: #1e1e1e;
              --vscode-editor-foreground: #d4d4d4;
              --vscode-widget-border: #454545;
              --vscode-focusBorder: #007acc;
              --vscode-button-background: #0e639c;
              --vscode-button-foreground: #ffffff;
              --vscode-input-background: #3c3c3c;
              --vscode-list-activeSelectionBackground: #094771;
            }
            body {
              background: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
            }
          </style>
        </head>
        <body>
          <div id="test-element" class="test-class">Test Element</div>
        </body>
      </html>
    `);
    
    global.window = dom.window as any;
    global.document = dom.window.document;
    global.Element = dom.window.Element;
    global.HTMLElement = dom.window.HTMLElement;
    global.getComputedStyle = dom.window.getComputedStyle;
    
    testElement = document.getElementById('test-element')!;
  });

  afterEach(() => {
    sandbox.restore();
    // Clean up ThemeManager
    try {
      ThemeManager.dispose();
    } catch (error) {
      // Ignore disposal errors in tests
    }
  });

  describe('initialize', () => {
    it('should initialize without errors', () => {
      expect(() => {
        ThemeManager.initialize();
      }).to.not.throw();
    });

    it('should handle multiple initialization calls', () => {
      ThemeManager.initialize();
      
      expect(() => {
        ThemeManager.initialize();
      }).to.not.throw();
    });

    it('should handle initialization with missing document', () => {
      const originalDocument = global.document;
      delete (global as any).document;
      
      expect(() => {
        ThemeManager.initialize();
      }).to.not.throw();
      
      global.document = originalDocument;
    });
  });

  describe('getThemeColors', () => {
    beforeEach(() => {
      ThemeManager.initialize();
    });

    it('should return theme colors object', () => {
      const colors = ThemeManager.getThemeColors();
      
      expect(colors).to.be.an('object');
      expect(colors).to.have.property('background');
      expect(colors).to.have.property('foreground');
      expect(colors).to.have.property('border');
    });

    it('should return default colors when CSS variables not available', () => {
      // Create element without CSS custom properties
      const plainDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      global.document = plainDom.window.document;
      global.getComputedStyle = plainDom.window.getComputedStyle;
      
      ThemeManager.initialize();
      const colors = ThemeManager.getThemeColors();
      
      expect(colors.background).to.be.a('string');
      expect(colors.foreground).to.be.a('string');
      expect(colors.border).to.be.a('string');
    });

    it('should handle missing getComputedStyle gracefully', () => {
      delete (global as any).getComputedStyle;
      
      const colors = ThemeManager.getThemeColors();
      
      expect(colors).to.be.an('object');
      expect(colors.background).to.be.a('string');
    });
  });

  describe('applyTheme', () => {
    beforeEach(() => {
      ThemeManager.initialize();
    });

    it('should apply theme to element', () => {
      ThemeManager.applyTheme(testElement);
      
      // Should have applied background and color
      expect(testElement.style.background).to.not.be.empty;
      expect(testElement.style.color).to.not.be.empty;
    });

    it('should apply custom theme properties', () => {
      const customTheme = {
        background: '#ff0000',
        foreground: '#00ff00',
        border: '#0000ff'
      };
      
      ThemeManager.applyTheme(testElement, customTheme);
      
      expect(testElement.style.background).to.equal('#ff0000');
      expect(testElement.style.color).to.equal('#00ff00');
      expect(testElement.style.borderColor).to.equal('#0000ff');
    });

    it('should handle partial custom theme', () => {
      const partialTheme = {
        background: '#333333'
        // foreground and border not specified
      };
      
      expect(() => {
        ThemeManager.applyTheme(testElement, partialTheme);
      }).to.not.throw();
      
      expect(testElement.style.background).to.equal('#333333');
    });

    it('should handle null element gracefully', () => {
      expect(() => {
        ThemeManager.applyTheme(null as any);
      }).to.not.throw();
    });

    it('should handle undefined theme gracefully', () => {
      expect(() => {
        ThemeManager.applyTheme(testElement, undefined);
      }).to.not.throw();
    });
  });

  describe('getVSCodeColor', () => {
    beforeEach(() => {
      ThemeManager.initialize();
    });

    it('should return CSS custom property value', () => {
      const backgroundColor = ThemeManager.getVSCodeColor('--vscode-editor-background');
      
      expect(backgroundColor).to.be.a('string');
      expect(backgroundColor).to.not.be.empty;
    });

    it('should return fallback for non-existent property', () => {
      const color = ThemeManager.getVSCodeColor('--non-existent-property', '#fallback');
      
      expect(color).to.equal('#fallback');
    });

    it('should handle missing fallback', () => {
      const color = ThemeManager.getVSCodeColor('--non-existent-property');
      
      expect(color).to.be.a('string');
    });

    it('should handle empty property name', () => {
      const color = ThemeManager.getVSCodeColor('', '#default');
      
      expect(color).to.equal('#default');
    });
  });

  describe('createTerminalTheme', () => {
    beforeEach(() => {
      ThemeManager.initialize();
    });

    it('should create terminal theme object', () => {
      const theme = ThemeManager.createTerminalTheme();
      
      expect(theme).to.be.an('object');
      expect(theme).to.have.property('background');
      expect(theme).to.have.property('foreground');
      expect(theme).to.have.property('cursor');
      expect(theme).to.have.property('selection');
    });

    it('should create theme with custom overrides', () => {
      const overrides = {
        background: '#custom-bg',
        cursor: '#custom-cursor'
      };
      
      const theme = ThemeManager.createTerminalTheme(overrides);
      
      expect(theme.background).to.equal('#custom-bg');
      expect(theme.cursor).to.equal('#custom-cursor');
      expect(theme.foreground).to.not.equal('#custom-bg'); // Should use default
    });

    it('should handle null overrides', () => {
      expect(() => {
        const theme = ThemeManager.createTerminalTheme(null as any);
        expect(theme).to.be.an('object');
      }).to.not.throw();
    });
  });

  describe('updateElementTheme', () => {
    beforeEach(() => {
      ThemeManager.initialize();
    });

    it('should update element theme with selector', () => {
      ThemeManager.updateElementTheme('#test-element', {
        background: '#updated-bg',
        color: '#updated-fg'
      });
      
      expect(testElement.style.background).to.equal('#updated-bg');
      expect(testElement.style.color).to.equal('#updated-fg');
    });

    it('should update multiple elements with class selector', () => {
      // Add another element with the same class
      const element2 = document.createElement('div');
      element2.className = 'test-class';
      document.body.appendChild(element2);
      
      ThemeManager.updateElementTheme('.test-class', {
        background: '#multi-bg'
      });
      
      expect(testElement.style.background).to.equal('#multi-bg');
      expect(element2.style.background).to.equal('#multi-bg');
    });

    it('should handle non-existent selector gracefully', () => {
      expect(() => {
        ThemeManager.updateElementTheme('.non-existent', {
          background: '#nothing'
        });
      }).to.not.throw();
    });

    it('should handle empty styles object', () => {
      expect(() => {
        ThemeManager.updateElementTheme('#test-element', {});
      }).to.not.throw();
    });
  });

  describe('getThemeVariables', () => {
    beforeEach(() => {
      ThemeManager.initialize();
    });

    it('should return object with VS Code variables', () => {
      const variables = ThemeManager.getThemeVariables();
      
      expect(variables).to.be.an('object');
      expect(Object.keys(variables).length).to.be.greaterThan(0);
    });

    it('should include common VS Code variables', () => {
      const variables = ThemeManager.getThemeVariables();
      
      expect(variables).to.have.property('--vscode-editor-background');
      expect(variables).to.have.property('--vscode-editor-foreground');
    });

    it('should handle missing CSS custom properties', () => {
      // Create clean environment
      const cleanDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
      global.document = cleanDom.window.document;
      global.getComputedStyle = cleanDom.window.getComputedStyle;
      
      ThemeManager.initialize();
      const variables = ThemeManager.getThemeVariables();
      
      expect(variables).to.be.an('object');
    });
  });

  describe('dispose', () => {
    it('should dispose without errors', () => {
      ThemeManager.initialize();
      
      expect(() => {
        ThemeManager.dispose();
      }).to.not.throw();
    });

    it('should handle multiple dispose calls', () => {
      ThemeManager.initialize();
      ThemeManager.dispose();
      
      expect(() => {
        ThemeManager.dispose();
      }).to.not.throw();
    });

    it('should handle disposal before initialization', () => {
      expect(() => {
        ThemeManager.dispose();
      }).to.not.throw();
    });
  });

  describe('error handling', () => {
    it('should handle getComputedStyle throwing errors', () => {
      global.getComputedStyle = (() => {
        throw new Error('getComputedStyle error');
      }) as any;
      
      expect(() => {
        ThemeManager.initialize();
        ThemeManager.getThemeColors();
      }).to.not.throw();
    });

    it('should handle invalid CSS values', () => {
      // Mock getComputedStyle to return invalid values
      global.getComputedStyle = (() => ({
        getPropertyValue: () => ''
      })) as any;
      
      ThemeManager.initialize();
      const colors = ThemeManager.getThemeColors();
      
      expect(colors).to.be.an('object');
      expect(colors.background).to.be.a('string');
    });

    it('should handle missing document.documentElement', () => {
      const originalDocumentElement = document.documentElement;
      delete (document as any).documentElement;
      
      expect(() => {
        ThemeManager.initialize();
      }).to.not.throw();
      
      document.documentElement = originalDocumentElement;
    });
  });

  describe('performance', () => {
    it('should handle many theme applications efficiently', () => {
      ThemeManager.initialize();
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        ThemeManager.applyTheme(testElement);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 1 second)
      expect(duration).to.be.lessThan(1000);
    });

    it('should cache theme colors for efficiency', () => {
      ThemeManager.initialize();
      
      const colors1 = ThemeManager.getThemeColors();
      const colors2 = ThemeManager.getThemeColors();
      
      // Should return consistent values (testing caching behavior)
      expect(colors1.background).to.equal(colors2.background);
      expect(colors1.foreground).to.equal(colors2.foreground);
      expect(colors1.border).to.equal(colors2.border);
    });
  });

  describe('integration scenarios', () => {
    it('should work in VS Code webview environment simulation', () => {
      // Simulate VS Code theme variables
      const style = document.createElement('style');
      style.textContent = `
        :root {
          --vscode-editor-background: #2d2d30;
          --vscode-editor-foreground: #cccccc;
          --vscode-widget-border: #3e3e42;
        }
      `;
      document.head.appendChild(style);
      
      ThemeManager.initialize();
      
      const colors = ThemeManager.getThemeColors();
      ThemeManager.applyTheme(testElement);
      
      expect(colors.background).to.not.be.empty;
      expect(testElement.style.background).to.not.be.empty;
    });

    it('should handle theme changes dynamically', () => {
      ThemeManager.initialize();
      
      // Apply initial theme
      ThemeManager.applyTheme(testElement);
      const initialBg = testElement.style.background;
      
      // Simulate theme change by updating CSS variables
      const style = document.createElement('style');
      style.textContent = `
        :root {
          --vscode-editor-background: #ffffff;
        }
      `;
      document.head.appendChild(style);
      
      // Re-initialize and apply
      ThemeManager.initialize();
      ThemeManager.applyTheme(testElement);
      
      // Background might change (depends on implementation)
      expect(testElement.style.background).to.be.a('string');
    });
  });
});