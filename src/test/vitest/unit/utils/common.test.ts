/**
 * Common Utils Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  generateTerminalId,
  ActiveTerminalManager,
  generateNonce,
  getFirstItem,
  getFirstValue,
  delay,
  safeStringify
} from '../../../../utils/common';

describe('Common Utils', () => {
  let dom: JSDOM;

  beforeEach(() => {
    // Mock console before JSDOM creation
    (global as Record<string, unknown>).console = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
    };

    // Set up process.nextTick before JSDOM creation
    const originalProcess = global.process;
    (global as any).process = {
      ...originalProcess,
      nextTick: (callback: () => void) => setImmediate(callback),
      env: { ...originalProcess.env, NODE_ENV: 'test' },
    };

    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    (global as any).document = dom.window.document;
    (global as any).window = dom.window;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (dom) {
      dom.window.close();
    }
  });

  describe('generateTerminalId', () => {
    it('should generate unique terminal ID', () => {
      const id1 = generateTerminalId();
      const id2 = generateTerminalId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with expected format', () => {
      const id = generateTerminalId();

      // Format is: terminal-{timestamp}-{random base36 string}
      expect(id).toMatch(/^terminal-\d+-[a-z0-9]+$/);
    });

    it('should generate IDs with incrementing timestamps', () => {
      const id1 = generateTerminalId();
      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Wait 2ms to ensure timestamp difference
      }
      const id2 = generateTerminalId();

      const timestamp1 = parseInt(id1.split('-')[1]);
      const timestamp2 = parseInt(id2.split('-')[1]);

      expect(timestamp2).toBeGreaterThan(timestamp1);
    });
  });

  describe('ActiveTerminalManager', () => {
    let manager: ActiveTerminalManager;

    beforeEach(() => {
      manager = new ActiveTerminalManager();
    });

    it('should initialize with no active terminal', () => {
      expect(manager.getActive()).toBeUndefined();
    });

    it('should set and get active terminal ID', () => {
      const terminalId = 'terminal-1';

      manager.setActive(terminalId);

      expect(manager.getActive()).toBe(terminalId);
    });

    it('should clear active terminal ID', () => {
      manager.setActive('terminal-1');
      manager.clearActive();

      expect(manager.getActive()).toBeUndefined();
    });

    it('should check if terminal is active', () => {
      const terminalId = 'terminal-1';

      manager.setActive(terminalId);

      expect(manager.isActive(terminalId)).toBe(true);
      expect(manager.isActive('terminal-2')).toBe(false);
    });

    it('should check if has active terminal', () => {
      expect(manager.hasActive()).toBe(false);

      manager.setActive('terminal-1');
      expect(manager.hasActive()).toBe(true);

      manager.clearActive();
      expect(manager.hasActive()).toBe(false);
    });
  });

  describe('generateNonce', () => {
    it('should generate a nonce string', () => {
      const nonce = generateNonce();

      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBeGreaterThan(0);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate alphanumeric nonce', () => {
      const nonce = generateNonce();

      expect(nonce).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });

  describe('getFirstItem', () => {
    it('should return first item from array', () => {
      const array = ['first', 'second', 'third'];

      const result = getFirstItem(array);

      expect(result).toBe('first');
    });

    it('should return undefined for empty array', () => {
      const result = getFirstItem([]);

      expect(result).toBeUndefined();
    });

    it('should return undefined for null/undefined', () => {
      expect(getFirstItem(null as any)).toBeUndefined();
      expect(getFirstItem(undefined as any)).toBeUndefined();
    });
  });

  describe('getFirstValue', () => {
    it('should return first value from Map', () => {
      const map = new Map();
      map.set('key1', 'first');
      map.set('key2', 'second');

      const result = getFirstValue(map);

      expect(result).toBe('first');
    });

    it('should return undefined for empty Map', () => {
      const map = new Map();

      const result = getFirstValue(map);

      expect(result).toBeUndefined();
    });

    it('should handle Map with single value', () => {
      const map = new Map();
      map.set('key1', 'onlyvalue');

      const result = getFirstValue(map);

      expect(result).toBe('onlyvalue');
    });
  });

  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const start = Date.now();

      await delay(100);

      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(95); // Allow for some timing variance
    });

    it('should handle zero delay', async () => {
      const start = Date.now();

      await delay(0);

      const end = Date.now();
      expect(end - start).toBeLessThanOrEqual(50); // Should be very quick
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple object', () => {
      const obj = { name: 'test', value: 123 };

      const result = safeStringify(obj);

      expect(result).toBe('{"name":"test","value":123}');
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;

      const result = safeStringify(obj);

      expect(typeof result).toBe('string');
      expect(result).toBe('[object Object]');
    });

    it('should handle null and undefined', () => {
      expect(safeStringify(null)).toBe('null');
      expect(safeStringify(undefined)).toBe('undefined');
    });

    it('should handle primitive values', () => {
      expect(safeStringify('string')).toBe('"string"');
      expect(safeStringify(123)).toBe('123');
      expect(safeStringify(true)).toBe('true');
    });

    it('should handle complex nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
        array: [1, 2, 3],
      };

      const result = safeStringify(obj);

      expect(result).toContain('deep value');
      expect(result).toContain('[1,2,3]');
    });
  });
});
