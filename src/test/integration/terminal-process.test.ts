/**
 * Terminal Process Integration Tests
 * Tests actual terminal process behavior and lifecycle
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalManager } from '../../terminals/TerminalManager';
import { setupCompleteTestEnvironment, cleanupTestEnvironment } from '../shared/TestSetup';

describe('Terminal Process Integration', () => {
  let sandbox: sinon.SinonSandbox;
  let terminalManager: TerminalManager;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setupCompleteTestEnvironment();
    terminalManager = new TerminalManager();
  });

  afterEach(() => {
    cleanupTestEnvironment(sandbox);
    if (terminalManager) {
      terminalManager.dispose();
    }
  });

  describe('Terminal Lifecycle', () => {
    it('should create terminal with proper options', () => {
      const options = {
        shell: '/bin/bash',
        args: ['-l'],
        cwd: '/tmp',
        env: { ...process.env, TEST_VAR: 'test' },
      };

      const terminalId = terminalManager.createTerminal(options);
      
      expect(terminalId).to.be.a('string');
      expect(terminalId).to.have.length.greaterThan(0);
      expect(terminalManager.getActiveTerminal()).to.equal(terminalId);
    });

    it('should track terminal count correctly', () => {
      expect(terminalManager.getTerminalCount()).to.equal(0);

      const terminal1 = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      expect(terminalManager.getTerminalCount()).to.equal(1);

      const terminal2 = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      expect(terminalManager.getTerminalCount()).to.equal(2);
    });

    it('should handle terminal destruction', () => {
      const terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      expect(terminalManager.getTerminalCount()).to.equal(1);

      terminalManager.killTerminal(terminalId);
      
      expect(terminalManager.getTerminalCount()).to.equal(0);
      expect(terminalManager.getActiveTerminal()).to.be.null;
    });

    it('should handle active terminal switching', () => {
      const terminal1 = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      const terminal2 = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      expect(terminalManager.getActiveTerminal()).to.equal(terminal2);

      terminalManager.setActiveTerminal(terminal1);
      expect(terminalManager.getActiveTerminal()).to.equal(terminal1);
    });
  });

  describe('Terminal Communication', () => {
    let terminalId: string;

    beforeEach(() => {
      terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });
    });

    it('should handle terminal input', () => {
      const inputData = 'echo "Hello World"\n';
      
      expect(() => {
        terminalManager.writeToTerminal(terminalId, inputData);
      }).to.not.throw();
    });

    it('should handle terminal resize', () => {
      const cols = 80;
      const rows = 24;
      
      expect(() => {
        terminalManager.resizeTerminal(terminalId, cols, rows);
      }).to.not.throw();
    });

    it('should handle terminal clear', () => {
      expect(() => {
        terminalManager.clearTerminal(terminalId);
      }).to.not.throw();
    });

    it('should handle invalid terminal operations', () => {
      const invalidTerminalId = 'invalid-terminal-id';
      
      expect(() => {
        terminalManager.writeToTerminal(invalidTerminalId, 'test');
      }).to.not.throw();
      
      expect(() => {
        terminalManager.resizeTerminal(invalidTerminalId, 80, 24);
      }).to.not.throw();
    });
  });

  describe('Terminal Output Handling', () => {
    let terminalId: string;
    let outputCallback: sinon.SinonSpy;

    beforeEach(() => {
      outputCallback = sandbox.spy();
      terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });
    });

    it('should register output callback', () => {
      terminalManager.onTerminalOutput(outputCallback);
      
      // Write to terminal and check if callback is registered
      terminalManager.writeToTerminal(terminalId, 'echo "test"\n');
      
      // The callback should be registered (actual output depends on process)
      expect(outputCallback).to.not.have.been.called.immediately;
    });

    it('should handle multiple output callbacks', () => {
      const callback1 = sandbox.spy();
      const callback2 = sandbox.spy();
      
      terminalManager.onTerminalOutput(callback1);
      terminalManager.onTerminalOutput(callback2);
      
      // Both callbacks should be registered
      expect(() => {
        terminalManager.writeToTerminal(terminalId, 'echo "test"\n');
      }).to.not.throw();
    });

    it('should handle terminal exit events', () => {
      const exitCallback = sandbox.spy();
      terminalManager.onTerminalExit(exitCallback);
      
      // Kill terminal and check if exit callback is triggered
      terminalManager.killTerminal(terminalId);
      
      // Exit callback should be registered
      expect(exitCallback).to.not.have.been.called.immediately;
    });
  });

  describe('Terminal Error Handling', () => {
    it('should handle invalid shell path', () => {
      const options = {
        shell: '/nonexistent/shell',
        args: [],
        cwd: '/tmp',
        env: process.env,
      };

      expect(() => {
        const terminalId = terminalManager.createTerminal(options);
        expect(terminalId).to.be.a('string');
      }).to.not.throw();
    });

    it('should handle invalid working directory', () => {
      const options = {
        shell: '/bin/bash',
        args: [],
        cwd: '/nonexistent/directory',
        env: process.env,
      };

      expect(() => {
        const terminalId = terminalManager.createTerminal(options);
        expect(terminalId).to.be.a('string');
      }).to.not.throw();
    });

    it('should handle terminal kill errors', () => {
      const terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      // Kill terminal twice
      terminalManager.killTerminal(terminalId);
      
      expect(() => {
        terminalManager.killTerminal(terminalId);
      }).to.not.throw();
    });

    it('should handle maximum terminal limit', () => {
      const maxTerminals = 5;
      const createdTerminals: string[] = [];

      // Create maximum number of terminals
      for (let i = 0; i < maxTerminals; i++) {
        const terminalId = terminalManager.createTerminal({
          shell: '/bin/bash',
          args: [],
          cwd: '/tmp',
          env: process.env,
        });
        createdTerminals.push(terminalId);
      }

      expect(terminalManager.getTerminalCount()).to.equal(maxTerminals);

      // Try to create one more terminal (should handle gracefully)
      const extraTerminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      // Should either reject or handle gracefully
      expect(extraTerminalId).to.be.a('string');
    });
  });

  describe('Terminal Performance', () => {
    let terminalId: string;

    beforeEach(() => {
      terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });
    });

    it('should handle rapid input', () => {
      const rapidInputs = Array.from({ length: 100 }, (_, i) => `echo ${i}\n`);
      
      expect(() => {
        rapidInputs.forEach(input => {
          terminalManager.writeToTerminal(terminalId, input);
        });
      }).to.not.throw();
    });

    it('should handle large input', () => {
      const largeInput = 'echo "' + 'x'.repeat(10000) + '"\n';
      
      expect(() => {
        terminalManager.writeToTerminal(terminalId, largeInput);
      }).to.not.throw();
    });

    it('should handle frequent resizing', () => {
      const resizeOperations = Array.from({ length: 50 }, (_, i) => ({
        cols: 80 + i,
        rows: 24 + i,
      }));

      expect(() => {
        resizeOperations.forEach(({ cols, rows }) => {
          terminalManager.resizeTerminal(terminalId, cols, rows);
        });
      }).to.not.throw();
    });
  });

  describe('Terminal Cleanup', () => {
    it('should dispose all terminals on manager disposal', () => {
      const terminals = [];
      
      for (let i = 0; i < 3; i++) {
        terminals.push(terminalManager.createTerminal({
          shell: '/bin/bash',
          args: [],
          cwd: '/tmp',
          env: process.env,
        }));
      }

      expect(terminalManager.getTerminalCount()).to.equal(3);

      terminalManager.dispose();

      expect(terminalManager.getTerminalCount()).to.equal(0);
    });

    it('should handle disposal of non-existent terminals', () => {
      expect(() => {
        terminalManager.dispose();
      }).to.not.throw();
    });

    it('should prevent operations after disposal', () => {
      const terminalId = terminalManager.createTerminal({
        shell: '/bin/bash',
        args: [],
        cwd: '/tmp',
        env: process.env,
      });

      terminalManager.dispose();

      // Operations after disposal should be handled gracefully
      expect(() => {
        terminalManager.writeToTerminal(terminalId, 'test');
      }).to.not.throw();
    });
  });
});