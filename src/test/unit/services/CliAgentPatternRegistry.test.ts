/**
 * CLI Agent Pattern Registry Unit Tests
 *
 * 🎯 PURPOSE: Test centralized pattern registry for all CLI agents
 * 🚨 CRITICAL: Ensures single source of truth for detection patterns
 *
 * Focus Areas:
 * 1. Pattern registration and retrieval
 * 2. Command input matching
 * 3. Startup output matching
 * 4. Agent activity detection
 * 5. Shell prompt detection
 * 6. Termination pattern matching
 * 7. ANSI escape sequence cleaning
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import { CliAgentPatternRegistry, AgentType } from '../../../services/CliAgentPatternRegistry';

describe('🔍 CLI Agent Pattern Registry Unit Tests', () => {
  let registry: CliAgentPatternRegistry;

  beforeEach(() => {
    registry = new CliAgentPatternRegistry();
  });

  // =================== PATTERN REGISTRATION TESTS ===================

  describe('📋 Pattern Registration', () => {
    it('should have patterns for all agent types', () => {
      const agentTypes = registry.getAllAgentTypes();

      expect(agentTypes).to.include('claude');
      expect(agentTypes).to.include('gemini');
      expect(agentTypes).to.include('codex');
      expect(agentTypes).to.include('copilot');
      expect(agentTypes).to.have.lengthOf(4);
    });

    it('should return valid pattern definitions for each agent', () => {
      const agentTypes: AgentType[] = ['claude', 'gemini', 'codex', 'copilot'];

      agentTypes.forEach(agentType => {
        const patterns = registry.getAgentPatterns(agentType);

        expect(patterns).to.not.be.undefined;
        expect(patterns!.type).to.equal(agentType);
        expect(patterns!.commandPrefixes).to.be.an('array').with.length.greaterThan(0);
        expect(patterns!.startupPatterns).to.be.an('array');
        expect(patterns!.startupRegexPatterns).to.be.an('array');
        expect(patterns!.activityKeywords).to.be.an('array').with.length.greaterThan(0);
        expect(patterns!.terminationPatterns).to.be.an('array').with.length.greaterThan(0);
      });
    });

    it('should return all agent pattern definitions', () => {
      const allPatterns = registry.getAllAgentPatterns();

      expect(allPatterns).to.have.lengthOf(4);
      expect(allPatterns.map(p => p.type)).to.include.members(['claude', 'gemini', 'codex', 'copilot']);
    });
  });

  // =================== COMMAND INPUT MATCHING TESTS ===================

  describe('⌨️ Command Input Matching', () => {
    describe('Claude commands', () => {
      it('should match "claude" command', () => {
        expect(registry.matchCommandInput('claude')).to.equal('claude');
        expect(registry.matchCommandInput('claude ')).to.equal('claude');
        expect(registry.matchCommandInput('CLAUDE')).to.equal('claude');
      });

      it('should match "claude" with arguments', () => {
        expect(registry.matchCommandInput('claude help')).to.equal('claude');
        expect(registry.matchCommandInput('claude --version')).to.equal('claude');
        expect(registry.matchCommandInput('claude edit file.ts')).to.equal('claude');
      });
    });

    describe('Gemini commands', () => {
      it('should match "gemini" command', () => {
        expect(registry.matchCommandInput('gemini')).to.equal('gemini');
        expect(registry.matchCommandInput('gemini ')).to.equal('gemini');
        expect(registry.matchCommandInput('GEMINI')).to.equal('gemini');
      });

      it('should match "gemini" with arguments', () => {
        expect(registry.matchCommandInput('gemini help')).to.equal('gemini');
        expect(registry.matchCommandInput('gemini --model pro')).to.equal('gemini');
      });
    });

    describe('Codex commands', () => {
      it('should match "codex" command', () => {
        expect(registry.matchCommandInput('codex')).to.equal('codex');
        expect(registry.matchCommandInput('codex ')).to.equal('codex');
        expect(registry.matchCommandInput('CODEX')).to.equal('codex');
      });
    });

    describe('Copilot commands', () => {
      it('should match "copilot" command', () => {
        expect(registry.matchCommandInput('copilot')).to.equal('copilot');
        expect(registry.matchCommandInput('copilot ')).to.equal('copilot');
        expect(registry.matchCommandInput('gh copilot')).to.equal('copilot');
      });
    });

    describe('Non-matching commands', () => {
      it('should return null for non-agent commands', () => {
        expect(registry.matchCommandInput('ls -la')).to.be.null;
        expect(registry.matchCommandInput('npm install')).to.be.null;
        expect(registry.matchCommandInput('git status')).to.be.null;
        expect(registry.matchCommandInput('')).to.be.null;
      });
    });
  });

  // =================== STARTUP OUTPUT MATCHING TESTS ===================

  describe('🚀 Startup Output Matching', () => {
    describe('Claude startup', () => {
      it('should match Claude startup patterns', () => {
        expect(registry.matchStartupOutput('Welcome to Claude Code!')).to.equal('claude');
        expect(registry.matchStartupOutput('Claude Code starting...')).to.equal('claude');
      });

      it('should match Claude Code with case variations', () => {
        expect(registry.matchStartupOutput('claude code')).to.equal('claude');
        expect(registry.matchStartupOutput('CLAUDE CODE')).to.equal('claude');
        expect(registry.matchStartupOutput('Claude Code')).to.equal('claude');
      });
    });

    describe('Gemini startup', () => {
      it('should match Gemini startup patterns', () => {
        expect(registry.matchStartupOutput('Welcome to Gemini')).to.equal('gemini');
        expect(registry.matchStartupOutput('Gemini CLI started')).to.equal('gemini');
        expect(registry.matchStartupOutput('Google Gemini is ready')).to.equal('gemini');
      });

      it('should match Gemini model patterns', () => {
        expect(registry.matchStartupOutput('Using gemini-1.5-pro')).to.equal('gemini');
        expect(registry.matchStartupOutput('gemini-2.5-pro initialized')).to.equal('gemini');
        expect(registry.matchStartupOutput('gemini flash ready')).to.equal('gemini');
      });
    });

    describe('Codex startup', () => {
      it('should match Codex startup patterns', () => {
        expect(registry.matchStartupOutput('OpenAI Codex')).to.equal('codex');
        expect(registry.matchStartupOutput('Welcome to OpenAI Codex')).to.equal('codex');
      });
    });

    describe('Copilot startup', () => {
      it('should match Copilot startup patterns', () => {
        expect(registry.matchStartupOutput('Welcome to GitHub Copilot CLI')).to.equal('copilot');
        expect(registry.matchStartupOutput('GitHub Copilot CLI ready')).to.equal('copilot');
      });
    });

    describe('Non-matching output', () => {
      it('should return null for non-agent output', () => {
        expect(registry.matchStartupOutput('user@host:~$')).to.be.null;
        expect(registry.matchStartupOutput('npm install complete')).to.be.null;
        expect(registry.matchStartupOutput('Hello world')).to.be.null;
      });
    });
  });

  // =================== AGENT ACTIVITY DETECTION TESTS ===================

  describe('🔍 Agent Activity Detection', () => {
    it('should detect Claude activity', () => {
      expect(registry.isAgentActivity('claude is processing', 'claude')).to.be.true;
      expect(registry.isAgentActivity('anthropic AI response', 'claude')).to.be.true;
    });

    it('should detect Gemini activity', () => {
      expect(registry.isAgentActivity('gemini analyzing', 'gemini')).to.be.true;
      expect(registry.isAgentActivity('google AI response', 'gemini')).to.be.true;
    });

    it('should detect long output as activity', () => {
      const longOutput = 'a'.repeat(60);
      expect(registry.isAgentActivity(longOutput)).to.be.true;
    });

    it('should not detect short non-agent output', () => {
      expect(registry.isAgentActivity('ls', 'claude')).to.be.false;
      expect(registry.isAgentActivity('ok')).to.be.false;
    });
  });

  // =================== SHELL PROMPT DETECTION TESTS ===================

  describe('💻 Shell Prompt Detection', () => {
    it('should detect standard bash prompts', () => {
      expect(registry.isShellPrompt('user@host:~$')).to.be.true;
      expect(registry.isShellPrompt('user@host:/path$')).to.be.true;
      expect(registry.isShellPrompt('user@host $')).to.be.true;
    });

    it('should detect simple prompts', () => {
      expect(registry.isShellPrompt('$')).to.be.true;
      expect(registry.isShellPrompt('%')).to.be.true;
      expect(registry.isShellPrompt('#')).to.be.true;
      expect(registry.isShellPrompt('>')).to.be.true;
    });

    it('should detect PowerShell prompts', () => {
      expect(registry.isShellPrompt('PS C:\\Users\\test>')).to.be.true;
      expect(registry.isShellPrompt('PS>')).to.be.true;
    });

    it('should detect Oh My Zsh prompts', () => {
      expect(registry.isShellPrompt('➜  ~')).to.be.true;
      expect(registry.isShellPrompt('❯')).to.be.true;
    });

    it('should not detect empty lines as prompts', () => {
      expect(registry.isShellPrompt('')).to.be.false;
      expect(registry.isShellPrompt('   ')).to.be.false;
    });

    it('should not detect long lines as prompts', () => {
      const longLine = 'a'.repeat(150);
      expect(registry.isShellPrompt(longLine)).to.be.false;
    });
  });

  // =================== TERMINATION PATTERN TESTS ===================

  describe('🛑 Termination Pattern Detection', () => {
    describe('Explicit termination messages', () => {
      it('should detect generic termination patterns', () => {
        expect(registry.isTerminationPattern('session ended')).to.be.true;
        expect(registry.isTerminationPattern('connection closed')).to.be.true;
        expect(registry.isTerminationPattern('session terminated')).to.be.true;
      });

      it('should detect agent-specific termination', () => {
        expect(registry.isTerminationPattern('goodbye claude', 'claude')).to.be.true;
        expect(registry.isTerminationPattern('exiting gemini', 'gemini')).to.be.true;
      });

      it('should detect simple exit commands', () => {
        expect(registry.isTerminationPattern('exit')).to.be.true;
        expect(registry.isTerminationPattern('quit')).to.be.true;
        expect(registry.isTerminationPattern('goodbye')).to.be.true;
        expect(registry.isTerminationPattern('bye')).to.be.true;
      });
    });

    describe('Process completion indicators', () => {
      it('should detect process completion', () => {
        expect(registry.isTerminationPattern('[done]')).to.be.true;
        expect(registry.isTerminationPattern('finished')).to.be.true;
        expect(registry.isTerminationPattern('completed')).to.be.true;
      });
    });

    describe('Non-termination patterns', () => {
      it('should not detect normal output as termination', () => {
        expect(registry.isTerminationPattern('hello world')).to.be.false;
        expect(registry.isTerminationPattern('processing...')).to.be.false;
      });
    });
  });

  // =================== ANSI ESCAPE SEQUENCE CLEANING TESTS ===================

  describe('🧹 ANSI Escape Sequence Cleaning', () => {
    it('should clean basic ANSI color codes', () => {
      const input = '\x1b[31mRed Text\x1b[0m';
      const cleaned = registry.cleanAnsiEscapeSequences(input);
      expect(cleaned).to.equal('Red Text');
    });

    it('should clean cursor movement sequences', () => {
      const input = '\x1b[2J\x1b[H Clear screen';
      const cleaned = registry.cleanAnsiEscapeSequences(input);
      expect(cleaned).to.equal('Clear screen');
    });

    it('should clean OSC sequences', () => {
      const input = '\x1b]0;Terminal Title\x07Content';
      const cleaned = registry.cleanAnsiEscapeSequences(input);
      expect(cleaned).to.equal('Content');
    });

    it('should clean carriage returns', () => {
      const input = 'Line 1\rLine 2';
      const cleaned = registry.cleanAnsiEscapeSequences(input);
      expect(cleaned).to.equal('Line 1Line 2');
    });

    it('should handle already clean text', () => {
      const input = 'Clean text without ANSI codes';
      const cleaned = registry.cleanAnsiEscapeSequences(input);
      expect(cleaned).to.equal('Clean text without ANSI codes');
    });

    it('should trim whitespace', () => {
      const input = '  \x1b[31mText\x1b[0m  ';
      const cleaned = registry.cleanAnsiEscapeSequences(input);
      expect(cleaned).to.equal('Text');
    });
  });

  // =================== EDGE CASES AND SECURITY TESTS ===================

  describe('🔒 Edge Cases and Security', () => {
    it('should handle null and undefined gracefully', () => {
      expect(() => registry.matchCommandInput('')).to.not.throw();
      expect(() => registry.matchStartupOutput('')).to.not.throw();
    });

    it('should handle special characters in patterns', () => {
      const specialChars = '!@#$%^&*()[]{}|\\;:\'",.<>?/~`';
      expect(() => registry.matchCommandInput(specialChars)).to.not.throw();
      expect(() => registry.matchStartupOutput(specialChars)).to.not.throw();
    });

    it('should be case-insensitive for command matching', () => {
      expect(registry.matchCommandInput('CLAUDE')).to.equal('claude');
      expect(registry.matchCommandInput('Claude')).to.equal('claude');
      expect(registry.matchCommandInput('cLaUdE')).to.equal('claude');
    });

    it('should handle very long input strings', () => {
      const longInput = 'claude ' + 'a'.repeat(1000);
      expect(() => registry.matchCommandInput(longInput)).to.not.throw();
      expect(registry.matchCommandInput(longInput)).to.equal('claude');
    });
  });
});
