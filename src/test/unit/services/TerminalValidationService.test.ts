/**
 * Terminal Validation Service Test Suite
 *
 * Tests for terminal operation validation and error recovery:
 * - Creation and deletion validation
 * - PTY operation validation
 * - Health checks
 * - State consistency validation
 * - Launch monitoring
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/213
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { TerminalValidationService } from '../../../services/TerminalValidationService';
import { TerminalInstance, ProcessState } from '../../../types/shared';

describe('🧪 Terminal Validation Service Test Suite', () => {
  let validationService: TerminalValidationService;
  let sandbox: sinon.SinonSandbox;
  let terminalsMap: Map<string, TerminalInstance>;
  let ptyMap: Map<string, any>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    terminalsMap = new Map();
    ptyMap = new Map();

    validationService = new TerminalValidationService(
      () => terminalsMap,
      (terminalId: string) => ptyMap.get(terminalId)
    );
  });

  afterEach(() => {
    validationService.dispose();
    sandbox.restore();
  });

  // =================== Creation Validation Tests ===================

  describe('✨ Creation Validation', () => {
    it('should allow creation when under max limit', () => {
      const result = validationService.validateCreation();
      expect(result.isValid).to.be.true;
      expect(result.canProceed).to.be.true;
    });

    it('should prevent creation when at max limit', () => {
      // Add 5 terminals (assuming maxTerminals = 5)
      for (let i = 1; i <= 5; i++) {
        terminalsMap.set(`terminal-${i}`, {
          id: `terminal-${i}`,
          name: `Terminal ${i}`,
          number: i,
          isActive: false,
          createdAt: new Date(),
        });
      }

      const result = validationService.validateCreation();
      expect(result.isValid).to.be.false;
      expect(result.canProceed).to.be.false;
      expect(result.reason).to.include('Maximum');
    });
  });

  // =================== Deletion Validation Tests ===================

  describe('🗑️ Deletion Validation', () => {
    it('should prevent deletion of non-existent terminal', () => {
      const result = validationService.validateDeletion('non-existent');
      expect(result.isValid).to.be.false;
      expect(result.canProceed).to.be.false;
      expect(result.reason).to.include('not found');
    });

    it('should prevent deletion when only 1 terminal remains', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      const result = validationService.validateDeletion('terminal-1');
      expect(result.isValid).to.be.false;
      expect(result.canProceed).to.be.false;
      expect(result.reason).to.include('at least 1 terminal');
    });

    it('should allow deletion when multiple terminals exist', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });
      terminalsMap.set('terminal-2', {
        id: 'terminal-2',
        name: 'Terminal 2',
        number: 2,
        isActive: false,
        createdAt: new Date(),
      });

      const result = validationService.validateDeletion('terminal-1');
      expect(result.isValid).to.be.true;
      expect(result.canProceed).to.be.true;
    });
  });

  // =================== PTY Write Validation Tests ===================

  describe('✍️ PTY Write Validation', () => {
    it('should fail validation for non-existent terminal', () => {
      const result = validationService.validatePtyWrite('non-existent');
      expect(result.isValid).to.be.false;
      expect(result.canProceed).to.be.false;
    });

    it('should fail validation when PTY not available', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      const result = validationService.validatePtyWrite('terminal-1');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('not available');
    });

    it('should pass validation with valid PTY', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      ptyMap.set('terminal-1', {
        write: () => {},
        resize: () => {},
        kill: () => {},
        killed: false,
      });

      const result = validationService.validatePtyWrite('terminal-1');
      expect(result.isValid).to.be.true;
      expect(result.canProceed).to.be.true;
    });
  });

  // =================== PTY Resize Validation Tests ===================

  describe('📏 PTY Resize Validation', () => {
    it('should fail validation for invalid dimensions (negative)', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      const result = validationService.validatePtyResize('terminal-1', { cols: -10, rows: 24 });
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('Invalid dimensions');
    });

    it('should fail validation for too large dimensions', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      const result = validationService.validatePtyResize('terminal-1', { cols: 1000, rows: 24 });
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('too large');
    });

    it('should pass validation with valid dimensions and PTY', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      ptyMap.set('terminal-1', {
        write: () => {},
        resize: () => {},
        kill: () => {},
        killed: false,
      });

      const result = validationService.validatePtyResize('terminal-1', { cols: 100, rows: 30 });
      expect(result.isValid).to.be.true;
      expect(result.canProceed).to.be.true;
    });
  });

  // =================== Health Check Tests ===================

  describe('💓 Health Checks', () => {
    it('should report unhealthy for non-existent terminal', () => {
      const health = validationService.checkTerminalHealth('non-existent');
      expect(health.isHealthy).to.be.false;
      expect(health.issues).to.not.be.empty;
      expect(health.issues[0]).to.include('not found');
    });

    it('should report unhealthy when PTY missing', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      const health = validationService.checkTerminalHealth('terminal-1');
      expect(health.isHealthy).to.be.false;
      expect(health.issues).to.include.members(['PTY process not available']);
    });

    it('should report healthy with valid terminal and PTY', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      ptyMap.set('terminal-1', {
        write: () => {},
        resize: () => {},
        kill: () => {},
        killed: false,
      });

      const health = validationService.checkTerminalHealth('terminal-1');
      expect(health.isHealthy).to.be.true;
      expect(health.issues).to.be.empty;
    });

    it('should detect killed PTY', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: true,
        createdAt: new Date(),
      });

      ptyMap.set('terminal-1', {
        write: () => {},
        resize: () => {},
        kill: () => {},
        killed: true,
      });

      const health = validationService.checkTerminalHealth('terminal-1');
      expect(health.isHealthy).to.be.false;
      expect(health.issues).to.include('PTY process has been killed');
    });
  });

  // =================== State Consistency Tests ===================

  describe('🔍 State Consistency Validation', () => {
    it('should report consistent state with no terminals', () => {
      const consistency = validationService.validateStateConsistency();
      expect(consistency.isConsistent).to.be.true;
      expect(consistency.issues).to.be.empty;
    });

    it('should detect duplicate terminal numbers', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      });

      terminalsMap.set('terminal-2', {
        id: 'terminal-2',
        name: 'Terminal 2',
        number: 1, // Duplicate!
        isActive: false,
        createdAt: new Date(),
      });

      ptyMap.set('terminal-1', { killed: false });
      ptyMap.set('terminal-2', { killed: false });

      const consistency = validationService.validateStateConsistency();
      expect(consistency.isConsistent).to.be.false;
      expect(consistency.issues.some((issue) => issue.includes('Duplicate'))).to.be.true;
    });

    it('should detect terminals without PTY processes', () => {
      terminalsMap.set('terminal-1', {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
      });

      // No PTY for terminal-1

      const consistency = validationService.validateStateConsistency();
      expect(consistency.isConsistent).to.be.false;
      expect(consistency.issues.some((issue) => issue.includes('no PTY'))).to.be.true;
    });
  });

  // =================== Launch Monitoring Tests ===================

  describe('⏱️ Launch Monitoring', () => {
    it('should setup launch timeout', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      expect(() => validationService.setupLaunchTimeout(terminal, 5000)).to.not.throw();
    });

    it('should clear launch timeout', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      validationService.setupLaunchTimeout(terminal, 5000);
      expect(() => validationService.clearLaunchTimeout(terminal)).to.not.throw();
    });

    it('should handle launch timeout expiration', (done) => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      validationService.setupLaunchTimeout(terminal, 100); // 100ms timeout

      setTimeout(() => {
        expect(terminal.processState).to.equal(ProcessState.KilledDuringLaunch);
        done();
      }, 150);
    });

    it('should not change state if launch completes before timeout', (done) => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      validationService.setupLaunchTimeout(terminal, 200);

      // Simulate successful launch
      setTimeout(() => {
        terminal.processState = ProcessState.Running;
      }, 50);

      setTimeout(() => {
        expect(terminal.processState).to.equal(ProcessState.Running);
        done();
      }, 250);
    });
  });

  // =================== Disposal Tests ===================

  describe('🗑️ Disposal', () => {
    it('should dispose successfully', () => {
      expect(() => validationService.dispose()).to.not.throw();
    });

    it('should clear launch timeouts on disposal', () => {
      const terminal: TerminalInstance = {
        id: 'terminal-1',
        name: 'Terminal 1',
        number: 1,
        isActive: false,
        createdAt: new Date(),
        processState: ProcessState.Launching,
      };

      validationService.setupLaunchTimeout(terminal, 5000);
      validationService.dispose();

      // Timeout should be cleared, so state should not change
      setTimeout(() => {
        expect(terminal.processState).to.equal(ProcessState.Launching);
      }, 100);
    });
  });
});
