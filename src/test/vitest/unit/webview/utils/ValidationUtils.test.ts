
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ValidationUtils } from '../../../../../webview/utils/ValidationUtils';

describe('ValidationUtils', () => {
  let dom: JSDOM;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="test"></div></body></html>');
    vi.stubGlobal('HTMLElement', dom.window.HTMLElement);
  });

  describe('validateString', () => {
    it('should validate normal strings', () => {
      const result = ValidationUtils.validateString('hello', 'Field');
      expect(result.isValid).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should fail for empty strings when not allowed', () => {
      const result = ValidationUtils.validateString('  ', 'Field', { allowEmpty: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be empty');
    });

    it('should enforce min and max length', () => {
      const minRes = ValidationUtils.validateString('a', 'Field', { minLength: 3 });
      expect(minRes.isValid).toBe(false);
      
      const maxRes = ValidationUtils.validateString('abcd', 'Field', { maxLength: 2 });
      expect(maxRes.isValid).toBe(false);
    });
  });

  describe('validateTerminalId', () => {
    it('should allow alphanumeric with hyphens and underscores', () => {
      expect(ValidationUtils.validateTerminalId('term-123_abc').isValid).toBe(true);
    });

    it('should reject invalid characters', () => {
      const result = ValidationUtils.validateTerminalId('term $123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('only contain alphanumeric');
    });
  });

  describe('validateNumber', () => {
    it('should validate valid numbers in range', () => {
      const result = ValidationUtils.validateNumber(10, 'Count', { min: 5, max: 15 });
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(10);
    });

    it('should reject non-numbers', () => {
      expect(ValidationUtils.validateNumber('abc', 'Count').isValid).toBe(false);
    });

    it('should enforce integer requirement', () => {
      const result = ValidationUtils.validateNumber(10.5, 'Count', { integer: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an integer');
    });
  });

  describe('validateElement', () => {
    it('should validate real HTMLElements', () => {
      const el = dom.window.document.createElement('div');
      expect(ValidationUtils.validateElement(el).isValid).toBe(true);
    });

    it('should fail for objects that are not elements', () => {
      expect(ValidationUtils.validateElement({}).isValid).toBe(false);
    });
  });

  describe('sanitizeData', () => {
    it('should deep copy data via serialization', () => {
      const original = { a: 1, b: [2] };
      const result = ValidationUtils.sanitizeData(original);
      expect(result.isValid).toBe(true);
      expect(result.value).toEqual(original);
      expect(result.value).not.toBe(original); // Should be a copy
    });

    it('should reject overly large data', () => {
      const large = 'a'.repeat(100);
      const result = ValidationUtils.sanitizeData(large, 50); // limit 50 bytes
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });
  });

  describe('Batch Validation', () => {
    it('should aggregate multiple errors', () => {
      const result = ValidationUtils.validateBatch([
        () => ValidationUtils.validateString('', 'F1'),
        () => ValidationUtils.validateNumber('nan', 'F2')
      ]);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('F1');
      expect(result.error).toContain('F2');
    });
  });
});
