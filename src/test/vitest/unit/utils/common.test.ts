import { describe, it, expect } from 'vitest';

import { 
  safeProcessCwd, 
  generateTerminalId, 
  generateNonce, 
  getFirstItem, 
  getFirstValue, 
  safeStringify,
  ActiveTerminalManager,
  normalizeTerminalInfo
} from '../../../../utils/common';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: []
  },
  window: {
    activeTextEditor: undefined,
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn()
  }
}));

describe('Common Utils', () => {
  describe('safeProcessCwd', () => {
    it('should return process.cwd() if valid', () => {
      const cwd = safeProcessCwd();
      expect(cwd).toBeDefined();
      expect(cwd).not.toBe('/');
    });

    it('should return fallback if process.cwd() is root', () => {
      const spy = vi.spyOn(process, 'cwd').mockReturnValue('/');
      const fallback = '/tmp/fallback';
      expect(safeProcessCwd(fallback)).toBe(fallback);
      spy.mockRestore();
    });
  });

  describe('ID & Nonce Generation', () => {
    it('should generate unique terminal IDs', () => {
      const id1 = generateTerminalId();
      const id2 = generateTerminalId();
      expect(id1).toContain('terminal-');
      expect(id1).not.toBe(id2);
    });

    it('should generate nonces of correct length', () => {
      const nonce = generateNonce();
      expect(nonce.length).toBe(32); // Default length in constants
    });
  });

  describe('Safe Helpers', () => {
    it('should get first item safely', () => {
      expect(getFirstItem([1, 2, 3])).toBe(1);
      expect(getFirstItem([])).toBeUndefined();
      expect(getFirstItem(null)).toBeUndefined();
    });

    it('should get first value from Map safely', () => {
      const map = new Map([['key1', 'val1'], ['key2', 'val2']]);
      expect(getFirstValue(map)).toBe('val1');
      expect(getFirstValue(new Map())).toBeUndefined();
    });

    it('should stringify objects safely', () => {
      const obj = { a: 1 };
      expect(safeStringify(obj)).toBe('{"a":1}');
      
      // Handle circular reference
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(safeStringify(circular)).toContain('[object Object]');
    });
  });

  describe('ActiveTerminalManager', () => {
    it('should manage active terminal state', () => {
      const mgr = new ActiveTerminalManager();
      expect(mgr.hasActive()).toBe(false);
      
      mgr.setActive('t1');
      expect(mgr.getActive()).toBe('t1');
      expect(mgr.hasActive()).toBe(true);
      expect(mgr.isActive('t1')).toBe(true);
      expect(mgr.isActive('t2')).toBe(false);
      
      mgr.clearActive();
      expect(mgr.hasActive()).toBe(false);
    });
  });

  describe('normalizeTerminalInfo', () => {
    it('should pick only required fields', () => {
      const raw = { id: '1', name: 'term', isActive: true, extra: 'junk' };
      const normalized = normalizeTerminalInfo(raw as any);
      expect(normalized).toEqual({ id: '1', name: 'term', isActive: true });
      expect((normalized as any).extra).toBeUndefined();
    });
  });
});