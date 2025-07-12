/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../../shared/TestSetup';
import {
  getWebviewTheme,
  WEBVIEW_THEME_CONSTANTS,
} from '../../../../webview/utils/WebviewThemeUtils';

describe('WebviewThemeUtils', () => {
  let sandbox: sinon.SinonSandbox;
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const testEnv = setupCompleteTestEnvironment(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --vscode-editor-background: #1e1e1e;
              --vscode-editor-foreground: #d4d4d4;
              --vscode-terminal-background: #0c0c0c;
              --vscode-terminal-foreground: #cccccc;
            }
          </style>
        </head>
        <body>
          <div id="terminal-container"></div>
        </body>
      </html>
    `);

    dom = testEnv.dom;
    document = testEnv.document;
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox, dom);
  });

  describe('getWebviewTheme', () => {
    it('should return theme object', () => {
      const theme = getWebviewTheme();

      expect(theme).to.be.an('object');
      expect(theme).to.have.property('background');
      expect(theme).to.have.property('foreground');
    });

    it('should detect dark theme from body class', () => {
      document.body.classList.add('vscode-dark');

      const theme = getWebviewTheme();

      expect(theme).to.equal(WEBVIEW_THEME_CONSTANTS.DARK_THEME);
    });

    it('should detect light theme from body class', () => {
      document.body.classList.add('vscode-light');

      const theme = getWebviewTheme();

      expect(theme).to.equal(WEBVIEW_THEME_CONSTANTS.LIGHT_THEME);
    });

    it('should return default dark theme when no class is present', () => {
      const theme = getWebviewTheme();

      expect(theme).to.equal(WEBVIEW_THEME_CONSTANTS.DARK_THEME);
    });
  });

  describe('theme constants', () => {
    it('should have dark theme constants', () => {
      expect(WEBVIEW_THEME_CONSTANTS.DARK_THEME).to.be.an('object');
      expect(WEBVIEW_THEME_CONSTANTS.DARK_THEME.background).to.be.a('string');
      expect(WEBVIEW_THEME_CONSTANTS.DARK_THEME.foreground).to.be.a('string');
    });

    it('should have light theme constants', () => {
      expect(WEBVIEW_THEME_CONSTANTS.LIGHT_THEME).to.be.an('object');
      expect(WEBVIEW_THEME_CONSTANTS.LIGHT_THEME.background).to.be.a('string');
      expect(WEBVIEW_THEME_CONSTANTS.LIGHT_THEME.foreground).to.be.a('string');
    });
  });
});
