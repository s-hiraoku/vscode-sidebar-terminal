/**
 * Unit Tests for Claude Detection in Terminal Manager
 * Tests Claude Code command and output pattern detection
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { EventEmitter } from 'vscode';

// Mock vscode module
const mockContext = {
  subscriptions: [],
  workspaceState: {
    get: sinon.stub(),
    update: sinon.stub(),
  },
  globalState: {
    get: sinon.stub(),
    update: sinon.stub(),
  },
} as any;

// Mock node-pty
const mockPtyProcess = {
  write: sinon.spy(),
  kill: sinon.spy(),
  resize: sinon.spy(),
  onData: sinon.stub(),
  onExit: sinon.stub(),
  pid: 12345,
};

const mockPty = {
  spawn: sinon.stub().returns(mockPtyProcess),
};

// Mock workspace
const mockWorkspace = {
  workspaceFolders: [
    {
      uri: {
        fsPath: '/test/workspace',
      },
      name: 'test-workspace',
    },
  ],
};

// Mock vscode module
const mockVscode = {
  workspace: mockWorkspace,
  EventEmitter,
};

describe('Claude Detection in Terminal Manager', () => {
  let terminalManager: TerminalManager;
  let onDataCallback: (data: string) => void;
  let onExitCallback: (code: number) => void;
  let claudeStatusSpy: sinon.SinonSpy;

  beforeEach(() => {
    // Reset all mocks
    sinon.restore();

    // Setup mock modules
    require.cache[require.resolve('vscode')] = {
      exports: mockVscode,
    } as any;

    require.cache[require.resolve('@homebridge/node-pty-prebuilt-multiarch')] = {
      exports: mockPty,
    } as any;

    // Reset pty mock
    mockPtyProcess.onData = sinon.stub().callsFake((callback) => {
      onDataCallback = callback;
      return { dispose: sinon.stub() };
    });

    mockPtyProcess.onExit = sinon.stub().callsFake((callback) => {
      onExitCallback = callback;
      return { dispose: sinon.stub() };
    });

    mockPty.spawn.returns(mockPtyProcess);

    // Create terminal manager
    terminalManager = new TerminalManager(mockContext);

    // Setup Claude status change spy
    claudeStatusSpy = sinon.spy();
    terminalManager.onClaudeStatusChange(claudeStatusSpy);

    // Clear all spies
    mockPtyProcess.write.resetHistory();
    claudeStatusSpy.resetHistory();
  });

  afterEach(() => {
    if (terminalManager) {
      terminalManager.dispose();
    }
    sinon.restore();
  });

  describe('Claude Command Detection', () => {
    it('should detect claude command input', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send claude command
      terminalManager.sendInput('claude help\r', terminalId);

      // Assert
      expect(claudeStatusSpy.calledOnce).to.be.true;
      const call = claudeStatusSpy.getCall(0);
      expect(call.args[0]).to.deep.include({
        terminalId,
        isActive: true,
      });
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
    });

    it('should detect variations of claude commands', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Test different command variations
      const claudeCommands = [
        'claude',
        'claude help',
        'claude --version',
        'CLAUDE status',
        '  claude   code  ',
      ];

      claudeCommands.forEach((command, index) => {
        // Act
        terminalManager.sendInput(`${command}\r`, terminalId);

        // Assert
        expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
        expect(claudeStatusSpy.callCount).to.equal(1); // Should only activate once
      });
    });

    it('should not detect non-claude commands', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send non-claude commands
      const nonClaudeCommands = [
        'ls -la',
        'npm install',
        'git status',
        'echo claude', // Contains 'claude' but doesn't start with it
        'help claude',
      ];

      nonClaudeCommands.forEach((command) => {
        terminalManager.sendInput(`${command}\r`, terminalId);
      });

      // Assert
      expect(claudeStatusSpy.called).to.be.false;
      expect(terminalManager.isClaudeActive(terminalId)).to.be.false;
    });

    it('should track command history correctly', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send multiple commands
      terminalManager.sendInput('ls -la\r', terminalId);
      terminalManager.sendInput('claude help\r', terminalId);
      terminalManager.sendInput('git status\r', terminalId);

      // Assert
      const lastCommand = terminalManager.getLastCommand(terminalId);
      expect(lastCommand).to.equal('git status');
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
    });

    it('should handle partial input properly', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send partial input (no newline)
      terminalManager.sendInput('clau', terminalId);
      terminalManager.sendInput('de he', terminalId);
      terminalManager.sendInput('lp\r', terminalId);

      // Assert - should detect complete command
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
      expect(terminalManager.getLastCommand(terminalId)).to.equal('claude help');
    });
  });

  describe('Claude Output Pattern Detection', () => {
    it('should detect Claude welcome message', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - simulate Claude output
      terminalManager.handleTerminalOutput(terminalId, 'Welcome to Claude\n');

      // Assert
      expect(claudeStatusSpy.calledOnce).to.be.true;
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
    });

    it('should detect Claude Code output patterns', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      const claudePatterns = [
        'Welcome to Claude',
        'Claude Code is starting...',
        'Type your message:',
        'To start a conversation',
        'Visit claude.ai for more info',
      ];

      claudePatterns.forEach((pattern, index) => {
        // Reset state
        if (index > 0) {
          // Simulate session end for clean test
          terminalManager.handleTerminalOutput(terminalId, 'Goodbye!\n');
          claudeStatusSpy.resetHistory();
        }

        // Act
        terminalManager.handleTerminalOutput(terminalId, pattern);

        // Assert
        expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
        expect(claudeStatusSpy.calledOnce).to.be.true;
      });
    });

    it('should detect Human/Assistant conversation patterns', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - simulate conversation output
      terminalManager.handleTerminalOutput(terminalId, '\nHuman: Hello Claude\n');
      terminalManager.handleTerminalOutput(terminalId, '\nAssistant: Hello! How can I help you today?\n');

      // Assert
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
    });

    it('should detect Claude exit patterns', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();
      
      // First activate Claude
      terminalManager.handleTerminalOutput(terminalId, 'Welcome to Claude');
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
      claudeStatusSpy.resetHistory();

      // Act - simulate exit
      terminalManager.handleTerminalOutput(terminalId, 'Goodbye!\n');

      // Assert
      expect(terminalManager.isClaudeActive(terminalId)).to.be.false;
      expect(claudeStatusSpy.calledOnce).to.be.true;
      const call = claudeStatusSpy.getCall(0);
      expect(call.args[0]).to.deep.include({
        terminalId,
        isActive: false,
      });
    });

    it('should handle case-insensitive pattern matching', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - test case variations
      terminalManager.handleTerminalOutput(terminalId, 'WELCOME TO CLAUDE');
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;

      // Reset and test another variation
      terminalManager.handleTerminalOutput(terminalId, 'goodbye!');
      expect(terminalManager.isClaudeActive(terminalId)).to.be.false;
    });

    it('should not detect false positives', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send output that might contain keywords but isn't Claude
      const falsePositives = [
        'Reading claude.txt file',
        'User claude logged in',
        'Installing claude-package',
        'Error: claude command not found',
      ];

      falsePositives.forEach((output) => {
        terminalManager.handleTerminalOutput(terminalId, output);
      });

      // Assert - should not activate Claude
      expect(terminalManager.isClaudeActive(terminalId)).to.be.false;
      expect(claudeStatusSpy.called).to.be.false;
    });
  });

  describe('Multi-Terminal Claude Management', () => {
    it('should track Claude status independently for each terminal', () => {
      // Setup
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();
      const terminal3 = terminalManager.createTerminal();

      // Act - activate Claude in terminal1 and terminal3
      terminalManager.sendInput('claude help\r', terminal1);
      terminalManager.handleTerminalOutput(terminal3, 'Welcome to Claude');

      // Assert
      expect(terminalManager.isClaudeActive(terminal1)).to.be.true;
      expect(terminalManager.isClaudeActive(terminal2)).to.be.false;
      expect(terminalManager.isClaudeActive(terminal3)).to.be.true;
    });

    it('should deactivate Claude independently', () => {
      // Setup
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      // Activate Claude in both terminals
      terminalManager.sendInput('claude help\r', terminal1);
      terminalManager.sendInput('claude help\r', terminal2);

      expect(terminalManager.isClaudeActive(terminal1)).to.be.true;
      expect(terminalManager.isClaudeActive(terminal2)).to.be.true;

      // Act - deactivate only terminal1
      terminalManager.handleTerminalOutput(terminal1, 'Goodbye!');

      // Assert
      expect(terminalManager.isClaudeActive(terminal1)).to.be.false;
      expect(terminalManager.isClaudeActive(terminal2)).to.be.true;
    });

    it('should clean up Claude state when terminal is removed', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();
      terminalManager.sendInput('claude help\r', terminalId);
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;

      // Act - remove terminal
      terminalManager.removeTerminal(terminalId);

      // Assert - should clean up Claude state
      expect(terminalManager.isClaudeActive(terminalId)).to.be.false;
    });
  });

  describe('Command History Management', () => {
    it('should maintain command history per terminal', () => {
      // Setup
      const terminal1 = terminalManager.createTerminal();
      const terminal2 = terminalManager.createTerminal();

      // Act - send different commands to each terminal
      terminalManager.sendInput('ls -la\r', terminal1);
      terminalManager.sendInput('claude help\r', terminal1);
      terminalManager.sendInput('git status\r', terminal2);

      // Assert
      expect(terminalManager.getLastCommand(terminal1)).to.equal('claude help');
      expect(terminalManager.getLastCommand(terminal2)).to.equal('git status');
    });

    it('should limit command history size', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();
      const maxHistorySize = 100; // From implementation

      // Act - send more commands than the limit
      for (let i = 0; i <= maxHistorySize + 10; i++) {
        terminalManager.sendInput(`command-${i}\r`, terminalId);
      }

      // Assert - should maintain only the latest commands
      const lastCommand = terminalManager.getLastCommand(terminalId);
      expect(lastCommand).to.equal(`command-${maxHistorySize + 10}`);
    });

    it('should handle empty commands gracefully', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send empty commands
      terminalManager.sendInput('\r', terminalId);
      terminalManager.sendInput('   \r', terminalId);
      terminalManager.sendInput('real-command\r', terminalId);

      // Assert
      expect(terminalManager.getLastCommand(terminalId)).to.equal('real-command');
    });

    it('should handle commands with special characters', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send commands with special characters
      const complexCommands = [
        'echo "Hello World"',
        'grep -r "pattern" .',
        'claude --option="value with spaces"',
        'command && another-command',
      ];

      complexCommands.forEach((command) => {
        terminalManager.sendInput(`${command}\r`, terminalId);
      });

      // Assert
      expect(terminalManager.getLastCommand(terminalId)).to.equal('command && another-command');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid terminal IDs gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        terminalManager.handleTerminalOutput('invalid-id', 'Welcome to Claude');
      }).to.not.throw();

      expect(() => {
        terminalManager.sendInput('claude help\r', 'invalid-id');
      }).to.not.throw();

      expect(() => {
        const result = terminalManager.isClaudeActive('invalid-id');
        expect(result).to.be.false;
      }).to.not.throw();
    });

    it('should handle malformed input gracefully', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act & Assert - should not throw
      expect(() => {
        terminalManager.sendInput('', terminalId);
        terminalManager.sendInput(null as any, terminalId);
        terminalManager.sendInput(undefined as any, terminalId);
      }).to.not.throw();
    });

    it('should handle rapid command sequences', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - send rapid commands
      for (let i = 0; i < 50; i++) {
        terminalManager.sendInput(`command-${i}\r`, terminalId);
        if (i % 10 === 0) {
          terminalManager.sendInput('claude help\r', terminalId);
        }
      }

      // Assert - should maintain correct state
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
      expect(terminalManager.getLastCommand(terminalId)).to.be.a('string');
    });

    it('should handle large output chunks', () => {
      // Setup
      const terminalId = terminalManager.createTerminal();

      // Act - simulate large output with Claude pattern
      const largeOutput = 'x'.repeat(10000) + 'Welcome to Claude' + 'y'.repeat(10000);
      terminalManager.handleTerminalOutput(terminalId, largeOutput);

      // Assert
      expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
    });

    it('should handle concurrent operations safely', (done) => {
      // Setup
      const terminalId = terminalManager.createTerminal();
      let operationsCompleted = 0;
      const totalOperations = 10;

      // Act - perform concurrent operations
      for (let i = 0; i < totalOperations; i++) {
        setTimeout(() => {
          try {
            terminalManager.sendInput(`claude command-${i}\r`, terminalId);
            terminalManager.handleTerminalOutput(terminalId, `Output ${i}`);
            operationsCompleted++;

            if (operationsCompleted === totalOperations) {
              // Assert - should maintain consistent state
              expect(terminalManager.isClaudeActive(terminalId)).to.be.true;
              done();
            }
          } catch (error) {
            done(error);
          }
        }, i * 10);
      }
    });
  });
});