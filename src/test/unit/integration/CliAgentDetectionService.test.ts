/* eslint-disable */
// @ts-nocheck

import { expect } from 'chai';
import * as sinon from 'sinon';
import { CliAgentDetectionService } from '../../../integration/CliAgentDetectionService';

describe('CliAgentDetectionService', () => {
  let detectionService: CliAgentDetectionService;

  beforeEach(() => {
    detectionService = new CliAgentDetectionService();
  });

  describe('detectFromCommand', () => {
    it('should detect Claude Code from command', () => {
      const result = detectionService.detectFromCommand('claude');
      expect(result).to.deep.equal({ type: 'claude', confidence: 1.0 });
    });

    it('should detect Claude Code with arguments', () => {
      const result = detectionService.detectFromCommand('claude --help');
      expect(result).to.deep.equal({ type: 'claude', confidence: 1.0 });
    });

    it('should detect Gemini from command', () => {
      const result = detectionService.detectFromCommand('gemini');
      expect(result).to.deep.equal({ type: 'gemini', confidence: 1.0 });
    });

    it('should detect Gemini with arguments', () => {
      const result = detectionService.detectFromCommand('gemini chat');
      expect(result).to.deep.equal({ type: 'gemini', confidence: 1.0 });
    });

    it('should not detect from unrelated commands', () => {
      expect(detectionService.detectFromCommand('ls')).to.be.null();
      expect(detectionService.detectFromCommand('npm install claude')).to.be.null();
      expect(detectionService.detectFromCommand('echo claude')).to.be.null();
    });

    it('should handle empty or invalid input', () => {
      expect(detectionService.detectFromCommand('')).to.be.null();
      expect(detectionService.detectFromCommand(null as any)).to.be.null();
      expect(detectionService.detectFromCommand(undefined as any)).to.be.null();
    });
  });

  describe('detectFromOutput', () => {
    it('should detect Claude Code from startup output', () => {
      const output = 'Welcome to Claude Code CLI';
      const result = detectionService.detectFromOutput(output);
      expect(result).to.deep.equal({ type: 'claude', confidence: 0.8 });
    });

    it('should detect Claude Code from conversation patterns', () => {
      const output = 'Human: Hello\\nAssistant: Hi there!';
      const result = detectionService.detectFromOutput(output);
      expect(result).to.deep.equal({ type: 'claude', confidence: 0.8 });
    });

    it('should detect Gemini from startup output', () => {
      const output = 'Welcome to Gemini CLI';
      const result = detectionService.detectFromOutput(output);
      expect(result).to.deep.equal({ type: 'gemini', confidence: 0.8 });
    });

    it('should detect Gemini from conversation patterns', () => {
      const output = 'User: Hello\\nModel: Hi there!';
      const result = detectionService.detectFromOutput(output);
      expect(result).to.deep.equal({ type: 'gemini', confidence: 0.8 });
    });

    it('should not detect from unrelated output', () => {
      expect(detectionService.detectFromOutput('npm install completed')).to.be.null();
      expect(detectionService.detectFromOutput('file not found')).to.be.null();
    });
  });

  describe('detectExit', () => {
    it('should detect keyboard interrupt', () => {
      expect(detectionService.detectExit('KeyboardInterrupt')).to.be.true;
      expect(detectionService.detectExit('SIGINT received')).to.be.true;
      expect(detectionService.detectExit('^C')).to.be.true;
    });

    it('should detect process termination', () => {
      expect(detectionService.detectExit('Process terminated')).to.be.true;
      expect(detectionService.detectExit('Process exited')).to.be.true;
      expect(detectionService.detectExit('Connection lost')).to.be.true;
    });

    it('should detect goodbye messages', () => {
      expect(detectionService.detectExit('Goodbye!')).to.be.true;
      expect(detectionService.detectExit('Session ended')).to.be.true;
    });

    it('should not detect from normal output', () => {
      expect(detectionService.detectExit('Hello world')).to.be.false;
      expect(detectionService.detectExit('Processing...')).to.be.false;
      expect(detectionService.detectExit('ls -la')).to.be.false;
    });

    it('should handle short outputs', () => {
      expect(detectionService.detectExit('hi')).to.be.false;
      expect(detectionService.detectExit('a')).to.be.false;
      expect(detectionService.detectExit('')).to.be.false;
    });
  });

  describe('detectShellPromptReturn', () => {
    it('should detect bash prompt', () => {
      const output = ['', '$ '];
      expect(detectionService.detectShellPromptReturn(output)).to.be.true;
    });

    it('should detect zsh prompt', () => {
      const output = ['', '% '];
      expect(detectionService.detectShellPromptReturn(output)).to.be.true;
    });

    it('should detect full user@host prompt', () => {
      const output = ['', 'user@hostname:/path/to/dir$ '];
      expect(detectionService.detectShellPromptReturn(output)).to.be.true;
    });

    it('should not detect from non-prompt output', () => {
      const output = ['Hello world', 'Some output'];
      expect(detectionService.detectShellPromptReturn(output)).to.be.false;
    });

    it('should handle empty input', () => {
      expect(detectionService.detectShellPromptReturn([])).to.be.false;
      expect(detectionService.detectShellPromptReturn(null as any)).to.be.false;
    });
  });

  describe('getPatterns', () => {
    it('should return all patterns for debugging', () => {
      const patterns = detectionService.getPatterns();
      expect(patterns).to.have.property('commands');
      expect(patterns).to.have.property('startup');
      expect(patterns).to.have.property('exit');
      expect(patterns).to.have.property('shellPrompt');
      expect(patterns.commands).to.have.property('claude');
      expect(patterns.commands).to.have.property('gemini');
    });
  });
});