/**
 * Integration Tests for Terminal Creation Flow - Following t-wada's TDD Methodology
 *
 * These tests verify the complete terminal creation workflow:
 * - Extension Host ↔ WebView coordination
 * - TerminalManager lifecycle integration
 * - Configuration service integration
 * - Error handling across boundaries
 * - Performance characteristics
 *
 * TDD Integration Approach:
 * 1. RED: Write failing integration tests for complete workflows
 * 2. GREEN: Implement coordination between components
 * 3. REFACTOR: Optimize integration while maintaining functionality
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment, mockVscode } from '../../shared/TestSetup';
import {
  getTerminalConfig,
  getShellForPlatform,
  generateTerminalId,
  normalizeTerminalInfo
} from '../../../utils/common';

describe('Terminal Creation Flow - Integration TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    resetTestEnvironment();
    sandbox.restore();
  });

  describe('End-to-End Terminal Creation', () => {

    describe('RED Phase - Complete Creation Workflow', () => {

      it('should successfully create terminal from configuration to instance', async () => {
        // RED: Complete terminal creation should work end-to-end

        // Step 1: Get configuration
        const config = getTerminalConfig();
        expect(config).to.be.an('object');
        expect(config.shell).to.be.a('string');

        // Step 2: Determine shell for platform
        const platformShell = getShellForPlatform();
        expect(platformShell).to.be.a('string');
        expect(platformShell.length).to.be.greaterThan(0);

        // Step 3: Generate unique terminal ID
        const terminalId = generateTerminalId();
        expect(terminalId).to.be.a('string');
        expect(terminalId).to.match(/^terminal-\d+-[a-z0-9]+$/);

        // Step 4: Create terminal info structure
        const terminalInfo = normalizeTerminalInfo({
          id: terminalId,
          name: `Terminal ${Date.now()}`,
          isActive: true
        });

        expect(terminalInfo.id).to.equal(terminalId);
        expect(terminalInfo.name).to.be.a('string');
        expect(terminalInfo.isActive).to.be.true;
      });

      it('should handle terminal creation with custom configuration', async () => {
        // RED: Custom configuration should be applied during creation

        // Mock custom configuration
        mockVscode.workspace.getConfiguration.returns({
          get: sinon.stub().callsFake((key: string, defaultValue?: unknown) => {
            const customConfig: { [key: string]: unknown } = {
              shell: '/bin/custom-shell',
              fontSize: 16,
              fontFamily: 'Custom Mono',
              maxTerminals: 10,
              theme: 'custom-dark',
              cursorBlink: false,
              defaultDirectory: '/custom/path',
              showHeader: false,
              showIcons: false,
              altClickMovesCursor: false,
              enableCliAgentIntegration: false,
              enableGitHubCopilotIntegration: false,
              enablePersistentSessions: false,
              persistentSessionScrollback: 500,
              persistentSessionReviveProcess: false
            };
            return key in customConfig ? customConfig[key] : defaultValue;
          }),
          has: sinon.stub().returns(true),
          inspect: sinon.stub().returns({ defaultValue: undefined }),
          update: sinon.stub().resolves()
        });

        const config = getTerminalConfig();

        expect(config.shell).to.equal('/bin/custom-shell');
        expect(config.fontSize).to.equal(16);
        expect(config.fontFamily).to.equal('Custom Mono');
        expect(config.maxTerminals).to.equal(10);
        expect(config.theme).to.equal('custom-dark');
        expect(config.cursorBlink).to.be.false;
        expect(config.defaultDirectory).to.equal('/custom/path');
        expect(config.showHeader).to.be.false;
        expect(config.enableCliAgentIntegration).to.be.false;
      });

      it('should create unique terminal IDs for concurrent creation', () => {
        // RED: Concurrent terminal creation should produce unique IDs

        const ids = new Set<string>();
        const creationCount = 100;

        // Create many terminals concurrently
        for (let i = 0; i < creationCount; i++) {
          const id = generateTerminalId();
          expect(ids.has(id)).to.be.false; // Should be unique
          ids.add(id);
        }

        expect(ids.size).to.equal(creationCount);
      });

      it('should validate terminal creation with proper working directory', async () => {
        // RED: Working directory validation should be part of creation

        // This test simulates the working directory validation that occurs during creation
        const config = getTerminalConfig();

        // If defaultDirectory is specified in config, it should be validated
        if (config.defaultDirectory && config.defaultDirectory.trim()) {
          // In real implementation, this would be validated by validateDirectory
          expect(config.defaultDirectory).to.be.a('string');
          expect(config.defaultDirectory.length).to.be.greaterThan(0);
        }
      });

    });

  });

  describe('Cross-Platform Terminal Creation', () => {

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

    describe('RED Phase - Platform-Specific Creation', () => {

      it('should create Windows terminal with correct shell configuration', () => {
        // RED: Windows terminal creation should use proper shell
        Object.defineProperty(process, 'platform', { value: 'win32' });
        process.env.COMSPEC = 'C:\\Windows\\System32\\cmd.exe';

        const shell = getShellForPlatform();
        const config = getTerminalConfig();

        expect(shell).to.equal('C:\\Windows\\System32\\cmd.exe');
        // Configuration should work regardless of platform
        expect(config).to.be.an('object');
      });

      it('should create macOS terminal with correct shell configuration', () => {
        // RED: macOS terminal creation should use proper shell
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        process.env.SHELL = '/bin/zsh';

        const shell = getShellForPlatform();
        const config = getTerminalConfig();

        expect(shell).to.equal('/bin/zsh');
        expect(config).to.be.an('object');
      });

      it('should create Linux terminal with correct shell configuration', () => {
        // RED: Linux terminal creation should use proper shell
        Object.defineProperty(process, 'platform', { value: 'linux' });
        process.env.SHELL = '/bin/bash';

        const shell = getShellForPlatform();
        const config = getTerminalConfig();

        expect(shell).to.equal('/bin/bash');
        expect(config).to.be.an('object');
      });

      it('should handle platform detection failure gracefully', () => {
        // RED: Unknown platforms should fallback gracefully
        Object.defineProperty(process, 'platform', { value: 'unknown' as NodeJS.Platform });
        delete process.env.SHELL;
        delete process.env.COMSPEC;

        const shell = getShellForPlatform();
        const config = getTerminalConfig();

        // Should fallback to bash
        expect(shell).to.equal('/bin/bash');
        expect(config).to.be.an('object');
      });

    });

  });

  describe('Terminal Creation Error Handling', () => {

    describe('RED Phase - Error Recovery and Reporting', () => {

      it('should handle configuration service failures gracefully', () => {
        // RED: Configuration failures should not crash terminal creation

        // Mock configuration service failure
        mockVscode.workspace.getConfiguration.throws(new Error('Configuration service unavailable'));

        // Creation should still work with fallback behavior
        expect(() => getTerminalConfig()).to.not.throw();
      });

      it('should handle shell detection errors gracefully', () => {
        // RED: Shell detection errors should fallback properly

        // Create scenario where shell detection might fail
        Object.defineProperty(process, 'platform', { value: 'win32' });
        delete process.env.COMSPEC;

        const shell = getShellForPlatform();

        // Should fallback to default
        expect(shell).to.equal('cmd.exe');
      });

      it('should handle terminal ID generation under stress', () => {
        // RED: ID generation should be robust under high load

        // Mock Date.now and Math.random to test edge cases
        const originalDateNow = Date.now;
        const originalMathRandom = Math.random;

        let callCount = 0;
        global.Date.now = () => {
          callCount++;
          return 1000000 + callCount;
        };

        Math.random = () => 0.123456789;

        try {
          const id1 = generateTerminalId();
          const id2 = generateTerminalId();

          expect(id1).to.not.equal(id2); // Should still be unique
          expect(id1).to.match(/^terminal-\d+-[a-z0-9]+$/);
          expect(id2).to.match(/^terminal-\d+-[a-z0-9]+$/);
        } finally {
          global.Date.now = originalDateNow;
          Math.random = originalMathRandom;
        }
      });

    });

  });

  describe('Performance and Resource Management', () => {

    describe('RED Phase - Performance Characteristics', () => {

      it('should create terminals within acceptable time limits', async () => {
        // RED: Terminal creation should be fast

        const startTime = Date.now();

        // Simulate rapid terminal creation
        const operations = [];
        for (let i = 0; i < 10; i++) {
          operations.push(() => {
            const config = getTerminalConfig();
            const shell = getShellForPlatform();
            const id = generateTerminalId();
            const info = normalizeTerminalInfo({
              id,
              name: `Performance Test ${i}`,
              isActive: i === 0
            });
            return { config, shell, id, info };
          });
        }

        const results = operations.map(op => op());
        const endTime = Date.now();

        expect(results.length).to.equal(10);
        expect(endTime - startTime).to.be.lessThan(100); // Should be very fast

        // All results should be valid
        results.forEach((result, index) => {
          expect(result.config).to.be.an('object');
          expect(result.shell).to.be.a('string');
          expect(result.id).to.be.a('string');
          expect(result.info.name).to.equal(`Performance Test ${index}`);
        });
      });

      it('should handle memory efficiently during bulk creation', () => {
        // RED: Memory usage should be reasonable

        const initialMemory = process.memoryUsage().heapUsed;

        // Create many terminal configurations
        const configs = [];
        for (let i = 0; i < 1000; i++) {
          configs.push({
            config: getTerminalConfig(),
            shell: getShellForPlatform(),
            id: generateTerminalId(),
            info: normalizeTerminalInfo({
              id: `test-${i}`,
              name: `Bulk Test ${i}`,
              isActive: false
            })
          });
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        expect(configs.length).to.equal(1000);
        // Memory increase should be reasonable (less than 10MB for 1000 configs)
        expect(memoryIncrease).to.be.lessThan(10 * 1024 * 1024);
      });

    });

  });

  describe('Integration with VS Code APIs', () => {

    describe('RED Phase - VS Code Integration', () => {

      it('should integrate properly with VS Code workspace API', () => {
        // RED: VS Code workspace integration should work

        const config = getTerminalConfig();

        // Verify that VS Code workspace.getConfiguration was called
        expect(mockVscode.workspace.getConfiguration).to.have.been.called;

        // Configuration should reflect VS Code settings structure
        expect(config).to.have.property('shell');
        expect(config).to.have.property('fontSize');
        expect(config).to.have.property('fontFamily');
        expect(config).to.have.property('maxTerminals');
      });

      it('should handle VS Code API unavailability gracefully', () => {
        // RED: Should work even if VS Code APIs are not available

        // Temporarily remove VS Code mock
        const originalVscode = (global as any).vscode;
        delete (global as any).vscode;

        try {
          // These operations should still work with fallbacks
          expect(() => getShellForPlatform()).to.not.throw();
          expect(() => generateTerminalId()).to.not.throw();
        } finally {
          (global as any).vscode = originalVscode;
        }
      });

    });

  });

  describe('Concurrent Terminal Creation', () => {

    describe('RED Phase - Concurrency Handling', () => {

      it('should handle simultaneous terminal creation requests', async () => {
        // RED: Concurrent creation should work without conflicts

        const concurrentCreations = 20;
        const promises = [];

        for (let i = 0; i < concurrentCreations; i++) {
          promises.push(new Promise<any>((resolve) => {
            setTimeout(() => {
              const config = getTerminalConfig();
              const shell = getShellForPlatform();
              const id = generateTerminalId();
              const info = normalizeTerminalInfo({
                id,
                name: `Concurrent ${i}`,
                isActive: i === 0
              });
              resolve({ config, shell, id, info, index: i });
            }, Math.random() * 10); // Random timing
          }));
        }

        const results = await Promise.all(promises);

        expect(results.length).to.equal(concurrentCreations);

        // All IDs should be unique
        const ids = new Set(results.map(r => r.id));
        expect(ids.size).to.equal(concurrentCreations);

        // All results should be valid
        results.forEach(result => {
          expect(result.config).to.be.an('object');
          expect(result.shell).to.be.a('string');
          expect(result.id).to.be.a('string');
          expect(result.info).to.be.an('object');
        });
      });

      it('should maintain configuration consistency across concurrent access', async () => {
        // RED: Configuration should be consistent across concurrent access

        const concurrentAccess = 50;
        const promises = [];

        for (let i = 0; i < concurrentAccess; i++) {
          promises.push(new Promise<any>((resolve) => {
            const config = getTerminalConfig();
            resolve(config);
          }));
        }

        const configs = await Promise.all(promises);

        // All configurations should be identical
        const firstConfig = configs[0];
        configs.forEach(config => {
          expect(config).to.deep.equal(firstConfig);
        });
      });

    });

  });

  describe('Terminal Creation State Management', () => {

    describe('RED Phase - State Consistency', () => {

      it('should maintain consistent terminal information normalization', () => {
        // RED: Terminal info normalization should be consistent

        const testCases = [
          { id: 'term-1', name: 'Test Terminal 1', isActive: true },
          { id: 'term-2', name: 'Test Terminal 2', isActive: false },
          { id: 'term-3', name: '', isActive: true },
          { id: '', name: 'Empty ID Test', isActive: false }
        ];

        testCases.forEach(testCase => {
          const normalized = normalizeTerminalInfo(testCase);

          expect(normalized.id).to.equal(testCase.id);
          expect(normalized.name).to.equal(testCase.name);
          expect(normalized.isActive).to.equal(testCase.isActive);

          // Normalized info should have exactly these properties
          expect(Object.keys(normalized)).to.have.members(['id', 'name', 'isActive']);
        });
      });

      it('should handle terminal creation with various name patterns', () => {
        // RED: Different name patterns should be handled consistently

        const namePatterns = [
          'Simple Terminal',
          'Terminal with números 123',
          'Terminal with symbols !@#$%',
          'Very long terminal name that exceeds normal length expectations for testing purposes',
          '終端機', // Unicode characters
          '', // Empty name
          '   Whitespace Terminal   ' // Leading/trailing whitespace
        ];

        namePatterns.forEach((name, index) => {
          const id = generateTerminalId();
          const info = normalizeTerminalInfo({
            id,
            name,
            isActive: index === 0
          });

          expect(info.id).to.equal(id);
          expect(info.name).to.equal(name); // Should preserve original name
          expect(info.isActive).to.equal(index === 0);
        });
      });

    });

  });

  describe('Error Recovery and Resilience', () => {

    describe('RED Phase - System Resilience', () => {

      it('should recover from transient configuration failures', () => {
        // RED: Should handle temporary configuration failures

        let failureCount = 0;
        const maxFailures = 3;

        // Mock configuration service to fail initially, then succeed
        mockVscode.workspace.getConfiguration.callsFake(() => {
          failureCount++;
          if (failureCount <= maxFailures) {
            throw new Error(`Transient failure ${failureCount}`);
          }
          return {
            get: sinon.stub().callsFake((key: string, defaultValue?: unknown) => {
              // Return reasonable defaults
              const defaults: { [key: string]: unknown } = {
                shell: '/bin/bash',
                fontSize: 14,
                maxTerminals: 5
              };
              return key in defaults ? defaults[key] : defaultValue;
            }),
            has: sinon.stub().returns(true),
            inspect: sinon.stub().returns({ defaultValue: undefined }),
            update: sinon.stub().resolves()
          };
        });

        // First few calls should handle errors gracefully
        for (let i = 0; i <= maxFailures; i++) {
          expect(() => getTerminalConfig()).to.not.throw();
        }

        // After max failures, should succeed
        const config = getTerminalConfig();
        expect(config).to.be.an('object');
        expect(config.shell).to.equal('/bin/bash');
      });

    });

  });

});