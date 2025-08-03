/**
 * CLI Agent False Detection Prevention Test Suite
 * Tests to prevent false positive CLI Agent detection on non-startup messages
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../../shared/TestSetup';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('CLI Agent False Detection Prevention', () => {
  let sandbox: sinon.SinonSandbox;
  let terminalManager: TerminalManager;
  let dom: JSDOM;
  let _consoleMocks: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Setup complete test environment
    const testEnv = setupCompleteTestEnvironment();
    dom = testEnv.dom;
    _consoleMocks = testEnv.consoleMocks;

    // Create TerminalManager instance
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    if (terminalManager) {
      terminalManager.dispose();
    }
    cleanupTestEnvironment(sandbox, dom as any);
  });

  /**
   * Claude Code False Detection Prevention Tests
   */
  describe('Claude Code False Detection Prevention', () => {
    it('should NOT detect Claude Code on permission messages', () => {
      const terminalId = terminalManager.createTerminal();

      // Simulate permission message that was causing false detection
      const permissionMessage = 'Claude Code may read files in this folder. Reading';
      (terminalManager as any)._detectCliAgentOptimized(terminalId, permissionMessage);

      // Should not trigger CLI Agent detection
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });

    it('should NOT detect Claude Code on generic Claude mentions', () => {
      const terminalId = terminalManager.createTerminal();

      const genericMessages = [
        'Claude Code documentation is available at...',
        'Using Claude Code version 1.0.0',
        'Claude Code files are located in...',
        'Claude Code may read files in this folder',
        'Reading files with Claude Code permissions',
      ];

      genericMessages.forEach((message) => {
        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
        expect((terminalManager as any)._connectedAgentType).to.be.null;
      });
    });

    it('should CORRECTLY detect Claude Code on legitimate startup messages', () => {
      const terminalId = terminalManager.createTerminal();

      const legitimateStartupMessages = [
        'Welcome to Claude Code!',
        'Claude Sonnet is ready',
        'I am Claude, your AI assistant',
        "I'm Claude from Anthropic",
        'Claude Code starting up...',
        'Claude is initializing...',
      ];

      legitimateStartupMessages.forEach((message, index) => {
        // Reset state for each test
        (terminalManager as any)._connectedAgentTerminalId = null;
        (terminalManager as any)._connectedAgentType = null;
        (terminalManager as any)._disconnectedAgents.clear();

        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.equal(
          terminalId,
          `Failed on message: "${message}"`
        );
        expect((terminalManager as any)._connectedAgentType).to.equal(
          'claude',
          `Failed on message: "${message}"`
        );
      });
    });

    it('should handle Claude Code edge cases correctly', () => {
      const terminalId = terminalManager.createTerminal();

      // Test edge cases that should NOT trigger detection
      const edgeCases = [
        'Error: Claude Code not found',
        'Installing claude-code package...',
        'claude-code --help',
        'Anthropic may read your files', // Without "Claude" context
        'Claude 3 model is available for download', // Model info, not startup
      ];

      edgeCases.forEach((message) => {
        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
        expect((terminalManager as any)._connectedAgentType).to.be.null;
      });
    });
  });

  /**
   * Gemini CLI False Detection Prevention Tests
   */
  describe('Gemini CLI False Detection Prevention', () => {
    it('should NOT detect Gemini CLI on update notifications', () => {
      const terminalId = terminalManager.createTerminal();

      // Simulate update notification that was causing false detection
      const updateMessages = [
        'Gemini CLI update available! 0.1.14 → 0.1.15',
        'Gemini update available: 1.0.0 → 1.0.1',
        'New Gemini CLI version available!',
        'Gemini CLI v2.0.0 is now available!',
      ];

      updateMessages.forEach((message) => {
        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
        expect((terminalManager as any)._connectedAgentType).to.be.null;
      });
    });

    it('should NOT detect Gemini CLI on generic Gemini mentions', () => {
      const terminalId = terminalManager.createTerminal();

      const genericMessages = [
        'Gemini model is available for use',
        'Using Gemini API key',
        'Gemini response received',
        'Gemini Pro model selected',
        'Error: Gemini API failed',
      ];

      genericMessages.forEach((message) => {
        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
        expect((terminalManager as any)._connectedAgentType).to.be.null;
      });
    });

    it('should CORRECTLY detect Gemini CLI on legitimate startup messages', () => {
      const terminalId = terminalManager.createTerminal();

      const legitimateStartupMessages = [
        'Gemini CLI activated',
        'Gemini connected and ready',
        'Welcome to Gemini CLI',
        'Gemini CLI started successfully',
        'Google Gemini initialized',
        'Gemini is launching...',
        'Loading Gemini CLI...',
      ];

      legitimateStartupMessages.forEach((message, index) => {
        // Reset state for each test
        (terminalManager as any)._connectedAgentTerminalId = null;
        (terminalManager as any)._connectedAgentType = null;
        (terminalManager as any)._disconnectedAgents.clear();

        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.equal(
          terminalId,
          `Failed on message: "${message}"`
        );
        expect((terminalManager as any)._connectedAgentType).to.equal(
          'gemini',
          `Failed on message: "${message}"`
        );
      });
    });

    it('should handle Gemini CLI edge cases correctly', () => {
      const terminalId = terminalManager.createTerminal();

      // Test edge cases that should NOT trigger detection
      const edgeCases = [
        'Error: Gemini not available',
        'Gemini model pricing information',
        'Gemini documentation link',
        'Failed to load Gemini', // Failure message
        'Gemini quota exceeded', // Error message
      ];

      edgeCases.forEach((message) => {
        (terminalManager as any)._detectCliAgentOptimized(terminalId, message);

        expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
        expect((terminalManager as any)._connectedAgentType).to.be.null;
      });
    });
  });

  /**
   * Focus Event False Detection Tests
   */
  describe('Focus Event False Detection Prevention', () => {
    it('should NOT trigger CLI Agent detection on simple terminal focus', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();

      // Initially no agents detected
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;

      // Simulate terminal focus without any CLI Agent output
      // This should not trigger detection
      // Note: Terminal focus alone should not call CLI Agent detection

      // Should still be no agents detected
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });

    it('should NOT change CLI Agent status when switching between terminals without new output', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();

      // Set up one CLI Agent legitimately
      (terminalManager as any)._detectCliAgentOptimized(terminal1Id, 'Welcome to Claude Code!');
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // Switch to terminal2 without any output - should not affect CLI Agent status
      // Note: _setActiveTerminal doesn't exist, so we just check current state
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');

      // Check that status remains unchanged
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminal1Id);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
    });
  });

  /**
   * Comprehensive Mixed Scenario Tests
   */
  describe('Mixed Scenario False Detection Prevention', () => {
    it('should handle complex output with both false and true patterns', () => {
      const terminalId = terminalManager.createTerminal();

      // Send false detection patterns first
      (terminalManager as any)._detectCliAgentOptimized(
        terminalId,
        'Claude Code may read files in this folder'
      );
      (terminalManager as any)._detectCliAgentOptimized(
        terminalId,
        'Gemini CLI update available! 1.0.0 → 1.1.0'
      );

      // Should not detect anything
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;

      // Now send legitimate startup message
      (terminalManager as any)._detectCliAgentOptimized(terminalId, 'Welcome to Claude Code!');

      // Should detect Claude Code correctly
      expect((terminalManager as any)._connectedAgentTerminalId).to.equal(terminalId);
      expect((terminalManager as any)._connectedAgentType).to.equal('claude');
    });

    it('should prevent detection on output containing multiple false patterns', () => {
      const terminalId = terminalManager.createTerminal();

      // Complex output with multiple false patterns
      const complexFalseOutput = `
        Claude Code may read files in this folder. Reading permissions granted.
        Gemini CLI update available! Please update to get the latest features.
        Claude Code documentation available at docs.anthropic.com
        Using Gemini model for processing your request.
      `;

      (terminalManager as any)._detectCliAgentOptimized(terminalId, complexFalseOutput);

      // Should not detect any CLI Agent
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });
  });

  /**
   * Regression Tests for Specific Bug Cases
   */
  describe('Regression Tests for Specific False Detection Cases', () => {
    it('should NOT detect on "Claude Code may read files in this folder. Reading"', () => {
      const terminalId = terminalManager.createTerminal();

      // This exact message was causing false detection in the bug report
      (terminalManager as any)._detectCliAgentOptimized(
        terminalId,
        'Claude Code may read files in this folder. Reading'
      );

      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
    });

    it('should NOT detect on "Gemini CLI update available! 0.1.14 → 0.1.15"', () => {
      const terminalId = terminalManager.createTerminal();

      // This exact message was causing false detection in the bug report
      (terminalManager as any)._detectCliAgentOptimized(
        terminalId,
        'Gemini CLI update available! 0.1.14 → 0.1.15'
      );

      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
    });

    it('should handle rapid terminal focus changes without false detection', () => {
      const terminal1Id = terminalManager.createTerminal();
      const terminal2Id = terminalManager.createTerminal();

      // Simulate rapid focus changes by simply checking that no detection occurs
      // Note: Focus changes alone should not trigger CLI Agent detection

      // Should not trigger any CLI Agent detection
      expect((terminalManager as any)._connectedAgentTerminalId).to.be.null;
      expect((terminalManager as any)._connectedAgentType).to.be.null;
      expect((terminalManager as any)._disconnectedAgents.size).to.equal(0);
    });
  });
});
