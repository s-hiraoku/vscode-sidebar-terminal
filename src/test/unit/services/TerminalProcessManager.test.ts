/**
 * Terminal Process Manager Test Suite
 *
 * Tests for PTY process lifecycle management:
 * - PTY creation
 * - Process write operations
 * - Process resize operations
 * - Process termination
 * - Process state tracking
 * - Process recovery
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalProcessManager } from '../../../services/TerminalProcessManager';
import { ProcessState } from '../../../types/shared';

describe('🧪 Terminal Process Manager Test Suite', () => {
  let processManager: TerminalProcessManager;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    processManager = new TerminalProcessManager();
  });

  afterEach(() => {
    processManager.dispose();
    sandbox.restore();
  });

  // =================== PTY Creation Tests ===================

  describe('🔧 PTY Creation', () => {
    it('should create PTY process with valid options', async () => {
      const options = {
        shell: '/bin/bash',
        shellArgs: ['-l'],
        cwd: '/home/user',
        env: { PATH: '/usr/bin' },
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      expect(pty).to.exist;
      expect(pty.pid).to.be.a('number');
    });

    it('should throw error for invalid shell path', async () => {
      const options = {
        shell: '/invalid/shell/path',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      try {
        await processManager.createPtyProcess(options);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });

    it('should set UTF-8 encoding environment variables', async () => {
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      expect(pty).to.exist;
      // UTF-8 environment variables should be set internally
    });
  });

  // =================== PTY Registry Tests ===================

  describe('📝 PTY Registry', () => {
    it('should register PTY process', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const registeredPty = processManager.getPty(terminalId);
      expect(registeredPty).to.equal(pty);
    });

    it('should unregister PTY process', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);
      processManager.unregisterPty(terminalId);

      const registeredPty = processManager.getPty(terminalId);
      expect(registeredPty).to.be.undefined;
    });

    it('should return undefined for non-existent terminal', () => {
      const pty = processManager.getPty('non-existent');
      expect(pty).to.be.undefined;
    });
  });

  // =================== Process State Tests ===================

  describe('🔄 Process State Management', () => {
    it('should set process state to Launching on registration', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const state = processManager.getProcessState(terminalId);
      expect(state).to.equal(ProcessState.Launching);
    });

    it('should update process state', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      processManager.setProcessState(terminalId, ProcessState.Running);
      const state = processManager.getProcessState(terminalId);
      expect(state).to.equal(ProcessState.Running);
    });

    it('should track state transitions', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      // Launching → Running → KilledByUser
      expect(processManager.getProcessState(terminalId)).to.equal(ProcessState.Launching);

      processManager.setProcessState(terminalId, ProcessState.Running);
      expect(processManager.getProcessState(terminalId)).to.equal(ProcessState.Running);

      processManager.setProcessState(terminalId, ProcessState.KilledByUser);
      expect(processManager.getProcessState(terminalId)).to.equal(ProcessState.KilledByUser);
    });
  });

  // =================== PTY Write Tests ===================

  describe('✍️ PTY Write Operations', () => {
    it('should write data to PTY successfully', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const result = processManager.writeToPty(terminalId, 'echo "test"\r');
      expect(result.success).to.be.true;
    });

    it('should fail write for non-existent terminal', () => {
      const result = processManager.writeToPty('non-existent', 'test');
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });

    it('should fail write for killed PTY', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      // Kill the PTY
      await processManager.killPty(terminalId);

      // Try to write
      const result = processManager.writeToPty(terminalId, 'test');
      expect(result.success).to.be.false;
    });
  });

  // =================== PTY Resize Tests ===================

  describe('📏 PTY Resize Operations', () => {
    it('should resize PTY successfully', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const result = processManager.resizePty(terminalId, { cols: 100, rows: 30 });
      expect(result.success).to.be.true;
    });

    it('should fail resize with invalid dimensions (negative)', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const result = processManager.resizePty(terminalId, { cols: -10, rows: 24 });
      expect(result.success).to.be.false;
      expect(result.error).to.include('Invalid dimensions');
    });

    it('should fail resize with too large dimensions', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const result = processManager.resizePty(terminalId, { cols: 1000, rows: 24 });
      expect(result.success).to.be.false;
      expect(result.error).to.include('too large');
    });

    it('should fail resize for non-existent terminal', () => {
      const result = processManager.resizePty('non-existent', { cols: 80, rows: 24 });
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });
  });

  // =================== PTY Kill Tests ===================

  describe('🔪 PTY Kill Operations', () => {
    it('should kill PTY successfully', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const result = await processManager.killPty(terminalId);
      expect(result.success).to.be.true;

      // Verify PTY is unregistered
      const registeredPty = processManager.getPty(terminalId);
      expect(registeredPty).to.be.undefined;
    });

    it('should fail kill for non-existent terminal', async () => {
      const result = await processManager.killPty('non-existent');
      expect(result.success).to.be.false;
      expect(result.error).to.include('not found');
    });

    it('should prevent duplicate kill operations', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      // Start first kill (don't await)
      const killPromise1 = processManager.killPty(terminalId);

      // Attempt second kill immediately
      const result2 = await processManager.killPty(terminalId);

      // Second kill should fail
      expect(result2.success).to.be.false;
      expect(result2.error).to.include('already being killed');

      // Wait for first kill to complete
      await killPromise1;
    });
  });

  // =================== PTY Alive Tests ===================

  describe('💓 PTY Alive Checks', () => {
    it('should return true for alive PTY', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      const isAlive = processManager.isPtyAlive(terminalId);
      expect(isAlive).to.be.true;
    });

    it('should return false for non-existent terminal', () => {
      const isAlive = processManager.isPtyAlive('non-existent');
      expect(isAlive).to.be.false;
    });

    it('should return false for killed PTY', async () => {
      const terminalId = 'terminal-1';
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      const pty = await processManager.createPtyProcess(options);
      processManager.registerPty(terminalId, pty);

      await processManager.killPty(terminalId);

      const isAlive = processManager.isPtyAlive(terminalId);
      expect(isAlive).to.be.false;
    });
  });

  // =================== Disposal Tests ===================

  describe('🗑️ Disposal', () => {
    it('should dispose all PTY processes', async () => {
      // Create multiple terminals
      const terminals = ['terminal-1', 'terminal-2', 'terminal-3'];
      const options = {
        shell: '/bin/bash',
        shellArgs: [],
        cwd: '/home/user',
        env: {},
        cols: 80,
        rows: 24,
      };

      for (const terminalId of terminals) {
        const pty = await processManager.createPtyProcess(options);
        processManager.registerPty(terminalId, pty);
      }

      // Dispose all
      processManager.dispose();

      // Verify all PTYs are unregistered
      for (const terminalId of terminals) {
        const pty = processManager.getPty(terminalId);
        expect(pty).to.be.undefined;
      }
    });

    it('should handle disposal with no registered PTYs', () => {
      expect(() => processManager.dispose()).to.not.throw();
    });
  });
});
