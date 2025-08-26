/**
 * ShellIntegrationService Unit Tests
 * 
 * Tests the core shell integration functionality including:
 * - OSC sequence processing
 * - Shell script injection
 * - Command tracking and status management
 * - Working directory detection
 */

import * as assert from 'assert';
import * as sinon from 'sinon';
import { ShellIntegrationService, ShellCommand, ShellIntegrationState } from '../../../services/ShellIntegrationService';
import { TerminalManager } from '../../../terminals/TerminalManager';

describe('ShellIntegrationService', () => {
  let shellIntegrationService: ShellIntegrationService;
  let mockTerminalManager: sinon.SinonStubbedInstance<TerminalManager>;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockTerminalManager = sandbox.createStubInstance(TerminalManager);
    shellIntegrationService = new ShellIntegrationService(mockTerminalManager);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with proper patterns', () => {
      assert.ok(shellIntegrationService);
      // Verify service is properly constructed
      assert.strictEqual(typeof shellIntegrationService.processTerminalData, 'function');
    });
  });

  describe('OSC Sequence Processing', () => {
    const testTerminalId = 'test-terminal-1';

    it('should handle command start sequence', () => {
      const commandStartData = '\x1b]633;A\x07';
      
      // Process the command start sequence
      shellIntegrationService.processTerminalData(testTerminalId, commandStartData);
      
      // Verify terminal is marked as executing
      const isExecuting = shellIntegrationService.isExecuting(testTerminalId);
      assert.strictEqual(isExecuting, true);
    });

    it('should handle command finished sequence with exit code', () => {
      const commandStartData = '\x1b]633;A\x07';
      const commandFinishedData = '\x1b]633;C;0\x07';
      
      // Start command first
      shellIntegrationService.processTerminalData(testTerminalId, commandStartData);
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId), true);
      
      // Finish command
      shellIntegrationService.processTerminalData(testTerminalId, commandFinishedData);
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId), false);
    });

    it('should handle CWD change sequence', () => {
      const cwdData = '\x1b]633;P;Cwd=/home/user\x07';
      
      shellIntegrationService.processTerminalData(testTerminalId, cwdData);
      
      const currentCwd = shellIntegrationService.getCurrentCwd(testTerminalId);
      assert.strictEqual(currentCwd, '/home/user');
    });

    it('should handle command execution with command text', () => {
      const commandStartData = '\x1b]633;A\x07';
      const commandExecutedData = '\x1b]633;B;ls -la\x07';
      const commandFinishedData = '\x1b]633;C;0\x07';
      
      // Process full command sequence
      shellIntegrationService.processTerminalData(testTerminalId, commandStartData);
      shellIntegrationService.processTerminalData(testTerminalId, commandExecutedData);
      shellIntegrationService.processTerminalData(testTerminalId, commandFinishedData);
      
      const history = shellIntegrationService.getCommandHistory(testTerminalId);
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0]?.command, 'ls -la');
      assert.strictEqual(history[0]?.exitCode, 0);
    });
  });

  describe('Shell Script Injection', () => {
    let mockPtyProcess: { write: sinon.SinonStub };

    beforeEach(() => {
      mockPtyProcess = {
        write: sandbox.stub()
      };
    });

    it('should inject bash/zsh integration script', () => {
      shellIntegrationService.injectShellIntegration('terminal1', '/bin/bash', mockPtyProcess);
      
      assert.strictEqual(mockPtyProcess.write.calledOnce, true);
      const scriptCall = mockPtyProcess.write.getCall(0);
      assert.ok(scriptCall.args[0].includes('__vsc_prompt_cmd'));
      assert.ok(scriptCall.args[0].includes('PROMPT_COMMAND'));
    });

    it('should inject fish integration script', () => {
      shellIntegrationService.injectShellIntegration('terminal1', '/usr/bin/fish', mockPtyProcess);
      
      assert.strictEqual(mockPtyProcess.write.calledOnce, true);
      const scriptCall = mockPtyProcess.write.getCall(0);
      assert.ok(scriptCall.args[0].includes('fish_preexec'));
      assert.ok(scriptCall.args[0].includes('fish_prompt'));
    });

    it('should inject PowerShell integration script', () => {
      shellIntegrationService.injectShellIntegration('terminal1', 'powershell', mockPtyProcess);
      
      assert.strictEqual(mockPtyProcess.write.calledOnce, true);
      const scriptCall = mockPtyProcess.write.getCall(0);
      assert.ok(scriptCall.args[0].includes('__VSCode-Prompt-Start'));
      assert.ok(scriptCall.args[0].includes('$Global:__VSCodeOriginalPrompt'));
    });

    it('should not inject script for unknown shell', () => {
      shellIntegrationService.injectShellIntegration('terminal1', '/bin/unknown-shell', mockPtyProcess);
      
      assert.strictEqual(mockPtyProcess.write.called, false);
    });
  });

  describe('Command History Management', () => {
    const testTerminalId = 'history-test';

    it('should track command history correctly', () => {
      // Simulate multiple commands
      const commands = [
        { start: '\x1b]633;A\x07', exec: '\x1b]633;B;pwd\x07', finish: '\x1b]633;C;0\x07' },
        { start: '\x1b]633;A\x07', exec: '\x1b]633;B;ls\x07', finish: '\x1b]633;C;0\x07' }
      ];

      commands.forEach(cmd => {
        shellIntegrationService.processTerminalData(testTerminalId, cmd.start);
        shellIntegrationService.processTerminalData(testTerminalId, cmd.exec);
        shellIntegrationService.processTerminalData(testTerminalId, cmd.finish);
      });

      const history = shellIntegrationService.getCommandHistory(testTerminalId);
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0]?.command, 'pwd');
      assert.strictEqual(history[1]?.command, 'ls');
    });

    it('should limit command history to 100 entries', () => {
      // Add 105 commands to test limit
      for (let i = 0; i < 105; i++) {
        const start = '\x1b]633;A\x07';
        const exec = `\x1b]633;B;command${i}\x07`;
        const finish = '\x1b]633;C;0\x07';
        
        shellIntegrationService.processTerminalData(testTerminalId, start);
        shellIntegrationService.processTerminalData(testTerminalId, exec);
        shellIntegrationService.processTerminalData(testTerminalId, finish);
      }

      const history = shellIntegrationService.getCommandHistory(testTerminalId);
      assert.strictEqual(history.length, 100);
      // Should have the most recent commands
      assert.strictEqual(history[99]?.command, 'command104');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid terminal data gracefully', () => {
      assert.doesNotThrow(() => {
        shellIntegrationService.processTerminalData('', '');
        shellIntegrationService.processTerminalData('valid-id', '');
        shellIntegrationService.processTerminalData('', 'valid-data');
      });
    });

    it('should handle malformed OSC sequences', () => {
      const testTerminalId = 'error-test';
      const malformedData = '\x1b]633;INVALID\x07';
      
      assert.doesNotThrow(() => {
        shellIntegrationService.processTerminalData(testTerminalId, malformedData);
      });
    });

    it('should gracefully handle pattern initialization errors', () => {
      // This test verifies the try-catch in initializePatterns works
      // By creating a service instance, we verify it doesn't throw during construction
      assert.doesNotThrow(() => {
        const service = new ShellIntegrationService(mockTerminalManager);
        assert.ok(service);
      });
    });
  });

  describe('Resource Management', () => {
    it('should dispose terminal resources properly', () => {
      const testTerminalId = 'disposal-test';
      
      // Create some state for the terminal
      shellIntegrationService.processTerminalData(testTerminalId, '\x1b]633;A\x07');
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId), true);
      
      // Dispose the terminal
      shellIntegrationService.disposeTerminal(testTerminalId);
      
      // State should be reset
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId), false);
      assert.strictEqual(shellIntegrationService.getCommandHistory(testTerminalId).length, 0);
    });

    it('should dispose all resources on service disposal', () => {
      const testTerminalId1 = 'test1';
      const testTerminalId2 = 'test2';
      
      // Create state for multiple terminals
      shellIntegrationService.processTerminalData(testTerminalId1, '\x1b]633;A\x07');
      shellIntegrationService.processTerminalData(testTerminalId2, '\x1b]633;A\x07');
      
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId1), true);
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId2), true);
      
      // Dispose service
      shellIntegrationService.dispose();
      
      // All state should be cleared
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId1), false);
      assert.strictEqual(shellIntegrationService.isExecuting(testTerminalId2), false);
    });
  });
});