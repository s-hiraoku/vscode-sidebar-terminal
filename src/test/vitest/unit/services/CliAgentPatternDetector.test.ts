import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliAgentPatternDetector } from '../../../../services/CliAgentPatternDetector';

describe('CliAgentPatternDetector', () => {
  let detector: CliAgentPatternDetector;

  beforeEach(() => {
    detector = new CliAgentPatternDetector();
  });

  afterEach(() => {
    detector.dispose();
  });

  describe('detectGeminiStartup', () => {
    it('should detect Gemini CLI welcome messages', () => {
      expect(detector.detectGeminiStartup('Welcome to Gemini')).toBe(true);
      expect(detector.detectGeminiStartup('Gemini CLI started')).toBe(true);
      expect(detector.detectGeminiStartup('Google Gemini is ready')).toBe(true);
      expect(detector.detectGeminiStartup('Gemini Code assistant')).toBe(true);
    });

    it('should detect Gemini CLI specific log patterns', () => {
      expect(detector.detectGeminiStartup('You are running Gemini CLI in /home/user directory')).toBe(true);
      expect(detector.detectGeminiStartup('Type your message or @path/to/file')).toBe(true);
    });

    it('should detect Gemini help and version output', () => {
      expect(detector.detectGeminiStartup('gemini --help')).toBe(true);
      expect(detector.detectGeminiStartup('gemini --version')).toBe(true);
      expect(detector.detectGeminiStartup('Usage: gemini [command]')).toBe(true);
    });

    it('should detect Gemini interactive patterns', () => {
      expect(detector.detectGeminiStartup('gemini >')).toBe(true);
      expect(detector.detectGeminiStartup('gemini:')).toBe(true);
      expect(detector.detectGeminiStartup('gemini $')).toBe(true);
    });

    it('should detect Gemini simple command starts', () => {
      expect(detector.detectGeminiStartup('gemini start')).toBe(true);
      expect(detector.detectGeminiStartup('gemini')).toBe(true);
    });

    it('should detect Gemini model names', () => {
      expect(detector.detectGeminiStartup('Using gemini-2.5-pro model')).toBe(true);
      expect(detector.detectGeminiStartup('gemini-1.5-pro initialized')).toBe(true);
      expect(detector.detectGeminiStartup('gemini flash')).toBe(true);
      expect(detector.detectGeminiStartup('gemini-exp')).toBe(true);
    });

    it('should detect Google AI patterns', () => {
      expect(detector.detectGeminiStartup('Connected to google generative ai gemini')).toBe(true);
    });

    it('should ignore false positives', () => {
      expect(detector.detectGeminiStartup('update available: 1.0.0')).toBe(false);
      expect(detector.detectGeminiStartup('error: something went wrong')).toBe(false);
      expect(detector.detectGeminiStartup('warning: deprecated')).toBe(false);
      expect(detector.detectGeminiStartup('command not found: gemini-fake')).toBe(false);
      // "new model is available" is excluded
      expect(detector.detectGeminiStartup('new model is available')).toBe(false);
    });
  });

  describe('detectClaudeStartup', () => {
    it('should detect Claude Code startup', () => {
      expect(detector.detectClaudeStartup('Welcome to Claude Code!')).toBe(true);
    });

    it('should not detect other messages', () => {
      expect(detector.detectClaudeStartup('Hello Claude')).toBe(false);
    });
  });

  describe('detectCodexStartup', () => {
    it('should detect OpenAI Codex startup', () => {
      expect(detector.detectCodexStartup('OpenAI Codex')).toBe(true);
    });
  });

  describe('detectCopilotStartup', () => {
    it('should detect GitHub Copilot CLI startup', () => {
      expect(detector.detectCopilotStartup('Welcome to GitHub Copilot CLI')).toBe(true);
    });
  });

  describe('detectShellPrompt', () => {
    it('should detect standard shell prompts', () => {
      expect(detector.detectShellPrompt('user@host:~$ ')).toBe(true);
      expect(detector.detectShellPrompt('user@host:~/project$ ')).toBe(true);
    });

    it('should detect simple prompts', () => {
      expect(detector.detectShellPrompt('$ ')).toBe(true);
      expect(detector.detectShellPrompt('% ')).toBe(true);
      expect(detector.detectShellPrompt('> ')).toBe(true);
    });

    it('should detect Zsh/Oh My Zsh prompts', () => {
      expect(detector.detectShellPrompt('➜  ~ ')).toBe(true);
    });

    it('should ignore agent output', () => {
      expect(detector.detectShellPrompt('Thinking...')).toBe(false);
      expect(detector.detectShellPrompt('Here is the output:')).toBe(false);
      expect(detector.detectShellPrompt('analyzing your request')).toBe(false);
    });

    it('should ignore long lines', () => {
      expect(detector.detectShellPrompt('a'.repeat(101))).toBe(false);
    });
  });

  describe('cleanAnsiEscapeSequences', () => {
    it('should remove color codes', () => {
      const input = '\x1b[31mRed Text\x1b[0m';
      expect(detector.cleanAnsiEscapeSequences(input)).toBe('Red Text');
    });

    it('should remove cursor movement codes', () => {
      const input = 'Hello\x1b[2JWorld';
      expect(detector.cleanAnsiEscapeSequences(input)).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '  Hello  ';
      expect(detector.cleanAnsiEscapeSequences(input)).toBe('Hello');
    });
  });
});
