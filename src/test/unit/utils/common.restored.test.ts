/**
 * TDD Tests for Restored Common Functions - Following t-wada's Red-Green-Refactor
 *
 * These tests verify the functionality of functions restored during refactoring:
 * - getTerminalConfig()
 * - getShellForPlatform()
 * - showErrorMessage()
 * - showWarningMessage()
 *
 * TDD Approach:
 * 1. RED: Write failing tests first
 * 2. GREEN: Implement minimal code to pass
 * 3. REFACTOR: Improve while keeping tests green
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  getTerminalConfig,
  getShellForPlatform,
  showErrorMessage,
  showWarningMessage
} from '../../../utils/common';
import { setupTestEnvironment, resetTestEnvironment, mockVscode } from '../../shared/TestSetup';

describe('Restored Common Functions - TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    resetTestEnvironment();
    sandbox.restore();
  });

  describe('getTerminalConfig - Terminal Configuration Retrieval', () => {

    it('should return terminal configuration from unified service', () => {
      // RED: This test should initially fail
      const config = getTerminalConfig();

      expect(config).to.be.an('object');
      expect(config).to.have.property('shell');
      expect(config).to.have.property('fontSize');
      expect(config).to.have.property('maxTerminals');
    });

    it('should return consistent configuration structure', () => {
      // RED: Test for configuration consistency
      const config1 = getTerminalConfig();
      const config2 = getTerminalConfig();

      expect(config1).to.deep.equal(config2);
      expect(config1.shell).to.be.a('string');
      expect(config1.fontSize).to.be.a('number');
      expect(config1.maxTerminals).to.be.a('number');
    });

    it('should handle configuration service errors gracefully', () => {
      // RED: Test error resilience
      // Mock the configuration service to throw
      const originalGetConfiguration = mockVscode.workspace.getConfiguration;
      mockVscode.workspace.getConfiguration = sinon.stub().throws(new Error('Config service failed'));

      expect(() => getTerminalConfig()).to.not.throw();

      // Restore
      mockVscode.workspace.getConfiguration = originalGetConfiguration;
    });

  });

  describe('getShellForPlatform - Platform-Specific Shell Detection', () => {

    let originalPlatform: NodeJS.Platform;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalPlatform = process.platform;
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      process.env = originalEnv;
    });

    it('should return Windows shell for win32 platform', () => {
      // RED: Test Windows shell detection
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';

      const shell = getShellForPlatform();

      expect(shell).to.equal('C:\\Windows\\System32\\cmd.exe');
    });

    it('should fallback to cmd.exe on Windows when COMSPEC is not set', () => {
      // RED: Test Windows fallback
      Object.defineProperty(process, 'platform', { value: 'win32' });
      delete process.env.COMSPEC;

      const shell = getShellForPlatform();

      expect(shell).to.equal('cmd.exe');
    });

    it('should return macOS shell for darwin platform', () => {
      // RED: Test macOS shell detection
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      process.env.SHELL = '/bin/zsh';

      const shell = getShellForPlatform();

      expect(shell).to.equal('/bin/zsh');
    });

    it('should fallback to zsh on macOS when SHELL is not set', () => {
      // RED: Test macOS fallback
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      delete process.env.SHELL;

      const shell = getShellForPlatform();

      expect(shell).to.equal('/bin/zsh');
    });

    it('should return Linux shell for linux platform', () => {
      // RED: Test Linux shell detection
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.SHELL = '/bin/bash';

      const shell = getShellForPlatform();

      expect(shell).to.equal('/bin/bash');
    });

    it('should fallback to bash on Linux when SHELL is not set', () => {
      // RED: Test Linux fallback
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.SHELL;

      const shell = getShellForPlatform();

      expect(shell).to.equal('/bin/bash');
    });

    it('should handle unknown platforms gracefully', () => {
      // RED: Test unknown platform handling
      Object.defineProperty(process, 'platform', { value: 'freebsd' as NodeJS.Platform });
      process.env.SHELL = '/usr/local/bin/fish';

      const shell = getShellForPlatform();

      // Should use SHELL environment variable or fallback to bash
      expect(shell).to.satisfy((s: string) => s === '/usr/local/bin/fish' || s === '/bin/bash');
    });

  });

  describe('showErrorMessage - VS Code Error Message Integration', () => {

    it('should call VS Code showErrorMessage API', async () => {
      // RED: Test VS Code API integration
      const message = 'Test error message';
      const items = ['OK', 'Cancel'];

      await showErrorMessage(message, ...items);

      expect(mockVscode.window.showErrorMessage).to.have.been.calledWith(message, ...items);
    });

    it('should handle message without action items', async () => {
      // RED: Test simple message display
      const message = 'Simple error message';

      await showErrorMessage(message);

      expect(mockVscode.window.showErrorMessage).to.have.been.calledWith(message);
    });

    it('should return VS Code API response', async () => {
      // RED: Test return value handling
      const expectedResponse = 'OK';
      mockVscode.window.showErrorMessage.resolves(expectedResponse);

      const result = await showErrorMessage('Test message', 'OK', 'Cancel');

      expect(result).to.equal(expectedResponse);
    });

    it('should handle VS Code API errors gracefully', async () => {
      // RED: Test API error resilience
      mockVscode.window.showErrorMessage.rejects(new Error('VS Code API error'));

      expect(showErrorMessage('Test message')).to.not.be.rejected;
    });

  });

  describe('showWarningMessage - VS Code Warning Message Integration', () => {

    it('should call VS Code showWarningMessage API', async () => {
      // RED: Test VS Code API integration
      const message = 'Test warning message';
      const items = ['Proceed', 'Cancel'];

      await showWarningMessage(message, ...items);

      expect(mockVscode.window.showWarningMessage).to.have.been.calledWith(message, ...items);
    });

    it('should handle message without action items', async () => {
      // RED: Test simple message display
      const message = 'Simple warning message';

      await showWarningMessage(message);

      expect(mockVscode.window.showWarningMessage).to.have.been.calledWith(message);
    });

    it('should return VS Code API response', async () => {
      // RED: Test return value handling
      const expectedResponse = 'Proceed';
      mockVscode.window.showWarningMessage.resolves(expectedResponse);

      const result = await showWarningMessage('Test message', 'Proceed', 'Cancel');

      expect(result).to.equal(expectedResponse);
    });

    it('should handle VS Code API errors gracefully', async () => {
      // RED: Test API error resilience
      mockVscode.window.showWarningMessage.rejects(new Error('VS Code API error'));

      expect(showWarningMessage('Test message')).to.not.be.rejected;
    });

  });

  describe('Integration Tests - Cross-Function Behavior', () => {

    it('should maintain consistency between configuration and shell detection', () => {
      // RED: Test integration consistency
      const config = getTerminalConfig();
      const platformShell = getShellForPlatform();

      // Both should provide valid shell information
      expect(config.shell).to.be.a('string');
      expect(platformShell).to.be.a('string');
      expect(config.shell.length).to.be.greaterThan(0);
      expect(platformShell.length).to.be.greaterThan(0);
    });

    it('should handle complete workflow from config to error display', async () => {
      // RED: Test complete error handling workflow
      const config = getTerminalConfig();

      // Simulate configuration error scenario
      if (!config || !config.shell) {
        const errorResult = await showErrorMessage(
          'Terminal configuration is invalid',
          'Retry',
          'Cancel'
        );

        expect(mockVscode.window.showErrorMessage).to.have.been.called;
      }

      // Should complete without throwing
      expect(config).to.exist;
    });

  });

  describe('Regression Prevention Tests', () => {

    it('should not regress getTerminalConfig return type', () => {
      // RED: Prevent regression in return type
      const config = getTerminalConfig();

      // Ensure it's always an object with expected properties
      expect(config).to.be.an('object');
      expect(config).to.have.all.keys([
        'shell', 'shellArgs', 'fontSize', 'fontFamily', 'maxTerminals',
        'theme', 'cursorBlink', 'defaultDirectory', 'showHeader', 'showIcons',
        'altClickMovesCursor', 'enableCliAgentIntegration', 'enableGitHubCopilotIntegration',
        'enablePersistentSessions', 'persistentSessionScrollback', 'persistentSessionReviveProcess'
      ]);
    });

    it('should not regress shell detection for all platforms', () => {
      // RED: Prevent regression in shell detection
      const platforms: NodeJS.Platform[] = ['win32', 'darwin', 'linux', 'freebsd'];

      for (const platform of platforms) {
        Object.defineProperty(process, 'platform', { value: platform });

        const shell = getShellForPlatform();
        expect(shell).to.be.a('string');
        expect(shell.length).to.be.greaterThan(0);
        expect(shell).to.not.contain('undefined');
        expect(shell).to.not.contain('null');
      }
    });

    it('should maintain message function signatures', async () => {
      // RED: Prevent signature changes
      // These should accept string message and optional string items
      const errorPromise = showErrorMessage('test');
      const warningPromise = showWarningMessage('test');

      expect(errorPromise).to.be.a('promise');
      expect(warningPromise).to.be.a('promise');

      await Promise.all([errorPromise, warningPromise]);
    });

  });

});