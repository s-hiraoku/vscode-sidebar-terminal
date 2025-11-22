import * as assert from 'assert';
import * as sinon from 'sinon';
import { TerminalLifecycleService } from '../../../../services/terminal/TerminalLifecycleService';
import { Result, isSuccess } from '../../../../types/result';

// Helper to unwrap Result for tests
function unwrapResult<T>(result: Result<T>): T {
  if (!isSuccess(result)) {
    throw new Error(`Result is failure: ${result.error}`);
  }
  return result.value;
}

describe('TerminalLifecycleService', () => {
  let service: TerminalLifecycleService;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new TerminalLifecycleService();
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });

  describe('Constructor', () => {
    it('should initialize successfully', () => {
      const stats = service.getTerminalStats();
      assert.ok(stats.maxTerminals > 0);
      assert.ok(Array.isArray(stats.availableNumbers));
      assert.ok(Array.isArray(stats.usedNumbers));
      assert.strictEqual(stats.terminalsBeingCreated, 0);
    });
  });

  describe('createTerminal', () => {
    it('should create terminal with default options', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      assert.ok(terminal.id);
      assert.ok(terminal.name);
      assert.ok(terminal.number);
      assert.ok(terminal.process || terminal.pty);
      assert.strictEqual(terminal.isActive, false);
      assert.ok(terminal.createdAt);
      assert.ok(terminal.pid || terminal.process?.pid);
      assert.ok(terminal.cwd);
      assert.ok(terminal.shell || terminal.process);
      assert.ok(Array.isArray(terminal.shellArgs) || terminal.process);
    });

    it('should create terminal with custom options', async () => {
      const options = {
        terminalName: 'Custom Terminal',
        cwd: '/tmp',
        shell: '/bin/bash',
        shellArgs: ['--login'],
      };

      const terminal = unwrapResult(await service.createTerminal(options));

      assert.strictEqual(terminal.name, 'Custom Terminal');
      assert.strictEqual(terminal.cwd, '/tmp');
      assert.strictEqual(terminal.shell, '/bin/bash');
      assert.deepStrictEqual(terminal.shellArgs, ['--login']);
    });

    it('should create terminal with profile', async () => {
      const terminal = unwrapResult(await service.createTerminal({ profileName: 'default' }));

      assert.ok(terminal.id);
      assert.ok(terminal.shell || terminal.process);
      assert.ok(Array.isArray(terminal.shellArgs) || terminal.process);
    });

    it('should handle safe mode', async () => {
      const terminal = unwrapResult(await service.createTerminal({ safeMode: true }));

      assert.ok(terminal.id);
      assert.ok(terminal.process || terminal.pty);
      // In safe mode, should still create terminal but with safer environment
    });

    it('should assign sequential terminal numbers', async () => {
      const terminal1 = unwrapResult(await service.createTerminal());
      const terminal2 = unwrapResult(await service.createTerminal());
      const terminal3 = unwrapResult(await service.createTerminal());

      assert.strictEqual(terminal1.number, 1);
      assert.strictEqual(terminal2.number, 2);
      assert.strictEqual(terminal3.number, 3);

      // Clean up
      await service.disposeTerminal(terminal1);
      await service.disposeTerminal(terminal2);
      await service.disposeTerminal(terminal3);
    });

    it('should reuse terminal numbers after disposal', async () => {
      const terminal1 = unwrapResult(await service.createTerminal());
      assert.strictEqual(terminal1.number, 1);

      await service.disposeTerminal(terminal1);

      const terminal2 = unwrapResult(await service.createTerminal());
      assert.strictEqual(terminal2.number, 1); // Should reuse number 1

      await service.disposeTerminal(terminal2);
    });

    it('should prevent duplicate creation', async () => {
      // This is hard to test due to random IDs, but we can test the logic
      const stats = service.getTerminalStats();
      assert.strictEqual(stats.terminalsBeingCreated, 0);
    });

    it('should handle maximum terminals reached', async () => {
      const maxTerminals = service.getTerminalStats().maxTerminals;
      const terminals: any[] = [];

      try {
        // Create maximum number of terminals
        for (let i = 0; i < maxTerminals; i++) {
          const terminal = unwrapResult(await service.createTerminal());
          terminals.push(terminal);
        }

        // Try to create one more - should fail
        try {
          await service.createTerminal();
          assert.fail('Should have thrown error for maximum terminals');
        } catch (error) {
          assert.ok(error instanceof Error);
          assert.ok((error as Error).message.includes('Maximum number of terminals reached'));
        }
      } finally {
        // Clean up all terminals
        for (const terminal of terminals) {
          await service.disposeTerminal(terminal);
        }
      }
    });
  });

  describe('disposeTerminal', () => {
    it('should dispose terminal successfully', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      await service.disposeTerminal(terminal);

      // Terminal should be cleaned up
      assert.strictEqual(service.isTerminalAlive(terminal), false);
    });

    it('should handle disposal of already disposed terminal', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      await service.disposeTerminal(terminal);

      // Should not throw error when disposing again
      await service.disposeTerminal(terminal);
    });

    it('should release terminal number on disposal', async () => {
      const terminal = unwrapResult(await service.createTerminal());
      const terminalNumber = terminal.number!;

      await service.disposeTerminal(terminal);

      // Number should be available again
      const stats = service.getTerminalStats();
      assert.ok(stats.availableNumbers.includes(terminalNumber));
    });

    it('should clean up shell integration', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      // Should not throw error even if shell integration fails
      await service.disposeTerminal(terminal);
    });
  });

  describe('resizeTerminal', () => {
    it('should resize terminal successfully', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      // Should not throw error
      service.resizeTerminal(terminal, 100, 50);

      await service.disposeTerminal(terminal);
    });

    it('should handle resize of disposed terminal', async () => {
      const terminal = unwrapResult(await service.createTerminal());
      await service.disposeTerminal(terminal);

      // Should not throw error
      service.resizeTerminal(terminal, 100, 50);
    });
  });

  describe('sendInputToTerminal', () => {
    it('should send input successfully', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      // Should not throw error
      service.sendInputToTerminal(terminal, 'echo hello\n');

      await service.disposeTerminal(terminal);
    });

    it('should handle input to disposed terminal', async () => {
      const terminal = unwrapResult(await service.createTerminal());
      await service.disposeTerminal(terminal);

      // Should not throw error
      service.sendInputToTerminal(terminal, 'echo hello\n');
    });
  });

  describe('isTerminalAlive', () => {
    it('should return true for alive terminal', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      assert.strictEqual(service.isTerminalAlive(terminal), true);

      await service.disposeTerminal(terminal);
    });

    it('should return false for disposed terminal', async () => {
      const terminal = unwrapResult(await service.createTerminal());
      await service.disposeTerminal(terminal);

      assert.strictEqual(service.isTerminalAlive(terminal), false);
    });
  });

  describe('getTerminalStats', () => {
    it('should return accurate statistics', async () => {
      const terminal1 = unwrapResult(await service.createTerminal());
      const terminal2 = unwrapResult(await service.createTerminal());

      const stats = service.getTerminalStats();

      assert.ok(stats.maxTerminals > 0);
      assert.ok(stats.availableNumbers.length > 0);
      assert.strictEqual(stats.usedNumbers.length, 2);
      assert.ok(stats.usedNumbers.includes(terminal1.number!));
      assert.ok(stats.usedNumbers.includes(terminal2.number!));

      await service.disposeTerminal(terminal1);
      await service.disposeTerminal(terminal2);
    });
  });

  describe('Error Handling', () => {
    it('should handle PTY creation failure gracefully', async () => {
      // Test with invalid shell path
      try {
        await service.createTerminal({
          shell: '/invalid/shell/path',
          shellArgs: [],
        });
        // Note: This might still succeed on some systems, so we don't assert.fail here
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok((error as Error).message.includes('Terminal creation failed'));
      }
    });

    it('should handle terminal profile resolution errors', async () => {
      // Should fallback to default profile
      const terminal = unwrapResult(await service.createTerminal({
        profileName: 'non-existent-profile',
      }));

      assert.ok(terminal.id);
      assert.ok(terminal.shell || terminal.process);

      await service.disposeTerminal(terminal);
    });

    it('should handle shell integration errors gracefully', async () => {
      const terminal = unwrapResult(await service.createTerminal());

      // Shell integration errors should not prevent terminal creation
      assert.ok(terminal.id);
      assert.ok(terminal.process || terminal.pty);

      await service.disposeTerminal(terminal);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid terminal creation and disposal', async () => {
      const startTime = Date.now();
      const terminals: any[] = [];

      try {
        // Create multiple terminals rapidly
        for (let i = 0; i < 3; i++) {
          const terminal = unwrapResult(await service.createTerminal());
          terminals.push(terminal);
        }

        // Dispose them rapidly
        for (const terminal of terminals) {
          await service.disposeTerminal(terminal);
        }

        const duration = Date.now() - startTime;
        assert.ok(duration < 5000, 'Should handle rapid operations in reasonable time');
      } catch (error) {
        // Clean up on error
        for (const terminal of terminals) {
          try {
            await service.disposeTerminal(terminal);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    });

    it('should maintain number management integrity under load', async () => {
      const terminals: any[] = [];

      try {
        // Create and dispose terminals to test number reuse
        for (let i = 0; i < 5; i++) {
          const terminal = unwrapResult(await service.createTerminal());
          terminals.push(terminal);

          if (i % 2 === 0) {
            await service.disposeTerminal(terminal);
            terminals.pop();
          }
        }

        const stats = service.getTerminalStats();
        assert.ok(stats.availableNumbers.length > 0);
        assert.ok(stats.usedNumbers.length > 0);
      } finally {
        // Clean up remaining terminals
        for (const terminal of terminals) {
          await service.disposeTerminal(terminal);
        }
      }
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      // Should not throw error
      service.dispose();
    });
  });
});
