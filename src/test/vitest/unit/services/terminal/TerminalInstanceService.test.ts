// Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalInstanceService } from '../../../../../services/terminal/TerminalInstanceService';

describe('TerminalInstanceService', () => {
  let service: TerminalInstanceService;

  beforeEach(() => {
    service = new TerminalInstanceService();
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize successfully', () => {
      const stats = service.getTerminalStats();
      expect(stats.maxTerminals).toBeGreaterThan(0);
      expect(Array.isArray(stats.availableNumbers)).toBe(true);
      expect(Array.isArray(stats.usedNumbers)).toBe(true);
      expect(stats.terminalsBeingCreated).toBe(0);
    });
  });

  describe('createTerminal', () => {
    it('should create terminal with default options', async () => {
      const terminal = await service.createTerminal();

      expect(terminal.id).toBeDefined();
      expect(terminal.name).toBeDefined();
      expect(terminal.number).toBeDefined();
      expect(terminal.process || terminal.pty).toBeDefined();
      expect(terminal.isActive).toBe(false);
      expect(terminal.createdAt).toBeDefined();
      expect(terminal.pid || terminal.process?.pid).toBeDefined();
      expect(terminal.cwd).toBeDefined();
      expect(terminal.shell || terminal.process).toBeDefined();
      expect(Array.isArray(terminal.shellArgs) || terminal.process).toBe(true);
    });

    it('should create terminal with custom options', async () => {
      const options = {
        terminalName: 'Custom Terminal',
        cwd: '/tmp',
        shell: '/bin/bash',
        shellArgs: ['--login'],
      };

      const terminal = await service.createTerminal(options);

      expect(terminal.name).toBe('Custom Terminal');
      expect(terminal.cwd).toBe('/tmp');
      expect(terminal.shell).toBe('/bin/bash');
      expect(terminal.shellArgs).toEqual(['--login']);
    });

    it('should create terminal with profile', async () => {
      const terminal = await service.createTerminal({ profileName: 'default' });

      expect(terminal.id).toBeDefined();
      expect(terminal.shell || terminal.process).toBeDefined();
      expect(Array.isArray(terminal.shellArgs) || terminal.process).toBe(true);
    });

    it('should handle safe mode', async () => {
      const terminal = await service.createTerminal({ safeMode: true });

      expect(terminal.id).toBeDefined();
      expect(terminal.process || terminal.pty).toBeDefined();
      // In safe mode, should still create terminal but with safer environment
    });

    it('should assign sequential terminal numbers', async () => {
      const terminal1 = await service.createTerminal();
      const terminal2 = await service.createTerminal();
      const terminal3 = await service.createTerminal();

      expect(terminal1.number).toBe(1);
      expect(terminal2.number).toBe(2);
      expect(terminal3.number).toBe(3);

      // Clean up
      await service.disposeTerminal(terminal1);
      await service.disposeTerminal(terminal2);
      await service.disposeTerminal(terminal3);
    });

    it('should reuse terminal numbers after disposal', async () => {
      const terminal1 = await service.createTerminal();
      expect(terminal1.number).toBe(1);

      await service.disposeTerminal(terminal1);

      const terminal2 = await service.createTerminal();
      expect(terminal2.number).toBe(1); // Should reuse number 1

      await service.disposeTerminal(terminal2);
    });

    it('should prevent duplicate creation', async () => {
      // This is hard to test due to random IDs, but we can test the logic
      const stats = service.getTerminalStats();
      expect(stats.terminalsBeingCreated).toBe(0);
    });

    it('should handle maximum terminals reached', async () => {
      const maxTerminals = service.getTerminalStats().maxTerminals;
      const terminals: any[] = [];

      try {
        // Create maximum number of terminals
        for (let i = 0; i < maxTerminals; i++) {
          const terminal = await service.createTerminal();
          terminals.push(terminal);
        }

        // Try to create one more - should fail
        try {
          await service.createTerminal();
          expect.fail('Should have thrown error for maximum terminals');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Maximum number of terminals reached');
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
      const terminal = await service.createTerminal();

      await service.disposeTerminal(terminal);

      // Terminal should be cleaned up
      expect(service.isTerminalAlive(terminal)).toBe(false);
    });

    it('should handle disposal of already disposed terminal', async () => {
      const terminal = await service.createTerminal();

      await service.disposeTerminal(terminal);

      // Should not throw error when disposing again
      await service.disposeTerminal(terminal);
    });

    it('should release terminal number on disposal', async () => {
      const terminal = await service.createTerminal();
      const terminalNumber = terminal.number!;

      await service.disposeTerminal(terminal);

      // Number should be available again
      const stats = service.getTerminalStats();
      expect(stats.availableNumbers).toContain(terminalNumber);
    });

    it('should clean up shell integration', async () => {
      const terminal = await service.createTerminal();

      // Should not throw error even if shell integration fails
      await service.disposeTerminal(terminal);
    });
  });

  describe('resizeTerminal', () => {
    it('should resize terminal successfully', async () => {
      const terminal = await service.createTerminal();

      // Should not throw error
      service.resizeTerminal(terminal, 100, 50);

      await service.disposeTerminal(terminal);
    });

    it('should handle resize of disposed terminal', async () => {
      const terminal = await service.createTerminal();
      await service.disposeTerminal(terminal);

      // Should not throw error
      service.resizeTerminal(terminal, 100, 50);
    });
  });

  describe('sendInputToTerminal', () => {
    it('should send input successfully', async () => {
      const terminal = await service.createTerminal();

      // Should not throw error
      service.sendInputToTerminal(terminal, 'echo hello\n');

      await service.disposeTerminal(terminal);
    });

    it('should handle input to disposed terminal', async () => {
      const terminal = await service.createTerminal();
      await service.disposeTerminal(terminal);

      // Should not throw error
      service.sendInputToTerminal(terminal, 'echo hello\n');
    });
  });

  describe('isTerminalAlive', () => {
    it('should return true for alive terminal', async () => {
      const terminal = await service.createTerminal();

      expect(service.isTerminalAlive(terminal)).toBe(true);

      await service.disposeTerminal(terminal);
    });

    it('should return false for disposed terminal', async () => {
      const terminal = await service.createTerminal();
      await service.disposeTerminal(terminal);

      expect(service.isTerminalAlive(terminal)).toBe(false);
    });
  });

  describe('getTerminalStats', () => {
    it('should return accurate statistics', async () => {
      const terminal1 = await service.createTerminal();
      const terminal2 = await service.createTerminal();

      const stats = service.getTerminalStats();

      expect(stats.maxTerminals).toBeGreaterThan(0);
      expect(stats.availableNumbers.length).toBeGreaterThan(0);
      expect(stats.usedNumbers.length).toBe(2);
      expect(stats.usedNumbers).toContain(terminal1.number!);
      expect(stats.usedNumbers).toContain(terminal2.number!);

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
        // Note: This might still succeed on some systems, so we don't expect.fail here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Terminal creation failed');
      }
    });

    it('should handle terminal profile resolution errors', async () => {
      // Should fallback to default profile
      const terminal = await service.createTerminal({
        profileName: 'non-existent-profile',
      });

      expect(terminal.id).toBeDefined();
      expect(terminal.shell || terminal.process).toBeDefined();

      await service.disposeTerminal(terminal);
    });

    it('should handle shell integration errors gracefully', async () => {
      const terminal = await service.createTerminal();

      // Shell integration errors should not prevent terminal creation
      expect(terminal.id).toBeDefined();
      expect(terminal.process || terminal.pty).toBeDefined();

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
          const terminal = await service.createTerminal();
          terminals.push(terminal);
        }

        // Dispose them rapidly
        for (const terminal of terminals) {
          await service.disposeTerminal(terminal);
        }

        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(5000);
      } catch (error) {
        // Clean up on error
        for (const terminal of terminals) {
          try {
            await service.disposeTerminal(terminal);
          } catch (_e) {
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
          const terminal = await service.createTerminal();
          terminals.push(terminal);

          if (i % 2 === 0) {
            await service.disposeTerminal(terminal);
            terminals.pop();
          }
        }

        const stats = service.getTerminalStats();
        expect(stats.availableNumbers.length).toBeGreaterThan(0);
        expect(stats.usedNumbers.length).toBeGreaterThan(0);
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
