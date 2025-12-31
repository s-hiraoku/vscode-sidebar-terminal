import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CommonUtilityService } from '../../../../../services/shared/CommonUtilityService';

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('CommonUtilityService', () => {
  let service: CommonUtilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommonUtilityService();
  });

  afterEach(() => {
    service.dispose();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const op = vi.fn().mockResolvedValue('success');
      const result = await service.withRetry(op);
      expect(result).toBe('success');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed eventually', async () => {
      const op = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const result = await service.withRetry(op, { maxAttempts: 3, delayMs: 1 });
      expect(result).toBe('success');
      expect(op).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const op = vi.fn().mockRejectedValue(new Error('Persistent fail'));
      await expect(service.withRetry(op, { maxAttempts: 2, delayMs: 1 })).rejects.toThrow('Persistent fail');
      expect(op).toHaveBeenCalledTimes(2);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce calls', () => {
      const func = vi.fn();
      const debounced = service.debounce('test', func, { delayMs: 100 });

      debounced();
      debounced();
      debounced();

      expect(func).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should call immediately if specified', () => {
      const func = vi.fn();
      const debounced = service.debounce('test', func, { delayMs: 100, immediate: true });

      debounced();
      expect(func).toHaveBeenCalledTimes(1);
      
      debounced(); // Should be debounced now
      expect(func).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1); // No extra call
    });
  });

  describe('throttle', () => {
    it('should throttle calls', () => {
      const func = vi.fn();
      const throttled = service.throttle('test', func, 100);

      throttled(); // call 1
      throttled(); // throttled
      
      expect(func).toHaveBeenCalledTimes(1);
      
      // Manually manipulate Date.now or wait
      vi.useFakeTimers();
      vi.advanceTimersByTime(101);
      throttled(); // call 2
      expect(func).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });
  });

  describe('validate', () => {
    it('should return valid for passing rules', () => {
      const rules = [
        { name: 'rule1', validator: (d: any) => d > 0, level: 'error' as const }
      ];
      const result = service.validate(10, rules);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors and warnings', () => {
      const rules = [
        { name: 'err', validator: () => 'Error msg', level: 'error' as const },
        { name: 'warn', validator: () => false, level: 'warning' as const }
      ];
      const result = service.validate({}, rules);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Error msg');
      expect(result.warnings).toContain('Validation failed: warn');
    });
  });

  describe('deepClone', () => {
    it('should clone nested objects', () => {
      const original = { a: 1, b: { c: 2 }, d: [3, 4] };
      const cloned = service.deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.d).not.toBe(original.d);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty values', () => {
      expect(service.isEmpty(null)).toBe(true);
      expect(service.isEmpty(undefined)).toBe(true);
      expect(service.isEmpty('')).toBe(true);
      expect(service.isEmpty([])).toBe(true);
      expect(service.isEmpty({})).toBe(true);
      expect(service.isEmpty('  ')).toBe(true);
    });

    it('should return false for non-empty values', () => {
      expect(service.isEmpty('val')).toBe(false);
      expect(service.isEmpty([1])).toBe(false);
      expect(service.isEmpty({ a: 1 })).toBe(false);
      expect(service.isEmpty(0)).toBe(false);
    });
  });
});
