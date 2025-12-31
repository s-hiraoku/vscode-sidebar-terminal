import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalValidationService } from '../../../../services/TerminalValidationService';
import { TerminalInstance } from '../../../../types/shared';

// Mock dependencies
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
  log: vi.fn(), // 追加: TerminalNumberManagerで使用される
}));

vi.mock('../../../../utils/common', () => ({
  getTerminalConfig: vi.fn().mockReturnValue({ maxTerminals: 5 }),
}));

describe('TerminalValidationService', () => {
  let service: TerminalValidationService;
  let terminals: Map<string, TerminalInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TerminalValidationService();
    terminals = new Map();
  });

  describe('validateCreation', () => {
    it('should pass when terminal count is below limit', () => {
      const result = service.validateCreation(terminals);
      expect(result.success).toBe(true);
    });

    it('should fail when max terminals limit reached', () => {
      // Mock terminals with size 5
      for (let i = 0; i < 5; i++) {
        terminals.set(`t${i}`, { id: `t${i}`, number: i + 1 } as TerminalInstance);
      }
      
      const result = service.validateCreation(terminals);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('maximum limit reached'); // error -> reason
    });
  });

  describe('validateDeletion', () => {
    it('should fail if terminal ID is invalid', () => {
      const result = service.validateDeletion('', terminals);
      expect(result.success).toBe(false);
    });

    it('should fail if terminal does not exist', () => {
      const result = service.validateDeletion('t1', terminals);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Terminal not found'); // error -> reason
    });

    it('should fail if trying to delete last terminal without force', () => {
      terminals.set('t1', { id: 't1', number: 1 } as TerminalInstance);
      const result = service.validateDeletion('t1', terminals, false);
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Must keep at least 1 terminal'); // error -> reason
    });

    it('should pass if deleting last terminal with force', () => {
      terminals.set('t1', { id: 't1', number: 1 } as TerminalInstance);
      const result = service.validateDeletion('t1', terminals, true);
      expect(result.success).toBe(true);
    });

    it('should pass if remaining count > min', () => {
      terminals.set('t1', { id: 't1', number: 1 } as TerminalInstance);
      terminals.set('t2', { id: 't2', number: 2 } as TerminalInstance);
      const result = service.validateDeletion('t1', terminals);
      expect(result.success).toBe(true);
    });
  });

  describe('validateTerminalId', () => {
    it('should pass valid ID', () => {
      expect(service.validateTerminalId('valid-id').success).toBe(true);
    });

    it('should fail empty ID', () => {
      expect(service.validateTerminalId('').success).toBe(false);
      expect(service.validateTerminalId('   ').success).toBe(false);
    });

    it('should fail non-string ID', () => {
      expect(service.validateTerminalId(123 as any).success).toBe(false);
    });
  });

  describe('validateResizeParams', () => {
    it('should pass valid dimensions', () => {
      expect(service.validateResizeParams(80, 24).success).toBe(true);
    });

    it('should fail too small dimensions', () => {
      expect(service.validateResizeParams(0, 24).success).toBe(false);
      expect(service.validateResizeParams(80, 0).success).toBe(false);
    });

    it('should fail too large dimensions', () => {
      expect(service.validateResizeParams(1000, 24).success).toBe(false);
    });

    it('should fail non-integer dimensions', () => {
      expect(service.validateResizeParams(80.5, 24).success).toBe(false);
    });
  });

  describe('checkTerminalIntegrity', () => {
    it('should pass valid terminal', () => {
      const terminal = {
        id: 't1',
        name: 'Terminal 1',
        number: 1,
        pty: {},
        ptyProcess: {},
        createdAt: Date.now(),
        isActive: true
      } as TerminalInstance;

      const result = service.checkTerminalIntegrity(terminal);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const terminal = {
        id: 't1',
        // missing name, number, pty
      } as TerminalInstance;

      const result = service.checkTerminalIntegrity(terminal);
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Missing terminal name');
      expect(result.issues).toContain('Missing terminal number');
      expect(result.issues).toContain('No PTY instance available');
    });
  });

  describe('validateTerminalMapHealth', () => {
    it('should pass healthy map', () => {
      terminals.set('t1', { 
        id: 't1', 
        name: 'T1', 
        number: 1, 
        pty: {}, 
        ptyProcess: {}, 
        createdAt: 1, 
        isActive: true 
      } as TerminalInstance);

      const result = service.validateTerminalMapHealth(terminals);
      expect(result.isHealthy).toBe(true);
    });

    it('should detect duplicate IDs', () => {
      terminals.set('t1', { id: 't1', number: 1 } as any);
      terminals.set('t2', { id: 't2', number: 1 } as any);

      const result = service.validateTerminalMapHealth(terminals);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Duplicate terminal number 1');
    });
  });
});