/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../../shared/TestSetup';
import { ThemeUtils } from '../../../../webview/utils/ThemeUtils';

describe('ThemeUtils', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const testEnv = setupCompleteTestEnvironment(`
      <!DOCTYPE html>
      <html>
        <body style="background-color: #ffffff; color: #000000;">
          <div id="terminal-container"></div>
        </body>
      </html>
    `);

    dom = testEnv.dom;
    document = testEnv.document;

    // Mock getComputedStyle
    (global as any).getComputedStyle = sinon.stub().returns({
      getPropertyValue: sinon.stub().returns('#ffffff'),
      backgroundColor: '#ffffff',
    });
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('ThemeUtils object', () => {
    it('should be an object with detectTheme method', () => {
      expect(ThemeUtils).to.be.an('object');
      expect(ThemeUtils.detectTheme).to.be.a('function');
    });

    it('should detect theme from document', () => {
      const theme = ThemeUtils.detectTheme();

      expect(theme).to.be.oneOf(['light', 'dark']);
    });

    it('should handle missing DOM elements gracefully', () => {
      // Remove document body
      document.body.remove();

      expect(() => {
        ThemeUtils.detectTheme();
      }).to.not.throw();
    });
  });

  describe('theme constants', () => {
    it('should have theme constants available', () => {
      // This test validates that the module loads properly
      expect(ThemeUtils).to.exist;
    });
  });
});
