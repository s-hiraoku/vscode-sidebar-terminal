import { describe, it, expect, beforeEach } from 'vitest';
import { MessageValidator, createMessageValidator } from '../../../../../../messaging/patterns/core/MessageValidator';

describe('MessageValidator', () => {
  let validator: MessageValidator;

  beforeEach(() => {
    validator = new MessageValidator();
  });

  describe('validateMessage', () => {
    it('should fail if message is not an object', () => {
      expect(validator.validateMessage(null as any).valid).toBe(false);
      expect(validator.validateMessage('string' as any).valid).toBe(false);
    });

    it('should fail if command is missing', () => {
      expect(validator.validateMessage({} as any).valid).toBe(false);
    });

    it('should pass basic validation', () => {
      expect(validator.validateMessage({ command: 'test' }).valid).toBe(true);
    });
  });

  describe('Rules', () => {
    it('should validate required fields', () => {
      validator.registerRule('test', { required: ['data'] });
      
      expect(validator.validateMessage({ command: 'test' }).valid).toBe(false);
      expect(validator.validateMessage({ command: 'test', data: 'ok' }).valid).toBe(true);
    });

    it('should validate field types', () => {
      validator.registerRule('test', { types: { data: 'string', count: 'number' } });
      
      expect(validator.validateMessage({ command: 'test', data: 123 }).valid).toBe(false);
      expect(validator.validateMessage({ command: 'test', count: '123' }).valid).toBe(false);
      expect(validator.validateMessage({ command: 'test', data: 'ok', count: 1 }).valid).toBe(true);
    });

    it('should validate arrays', () => {
      validator.registerRule('test', { types: { items: 'array' } });
      
      expect(validator.validateMessage({ command: 'test', items: 'not array' }).valid).toBe(false);
      expect(validator.validateMessage({ command: 'test', items: [] }).valid).toBe(true);
    });

    it('should use custom validation function', () => {
      validator.registerRule('test', { 
        custom: (msg: any) => msg.value > 10 ? true : 'Value too low' 
      });
      
      const fail = validator.validateMessage({ command: 'test', value: 5 });
      expect(fail.valid).toBe(false);
      expect(fail.errors[0]).toBe('Value too low');

      expect(validator.validateMessage({ command: 'test', value: 15 }).valid).toBe(true);
    });
  });

  describe('Helpers', () => {
    it('should check terminal ID', () => {
      expect(validator.hasTerminalId({ command: '', terminalId: 't1' })).toBe(true);
      expect(validator.hasTerminalId({ command: '' })).toBe(false);
    });

    it('should check resize params', () => {
      expect(validator.hasResizeParams({ command: '', cols: 10, rows: 10 })).toBe(true);
      expect(validator.hasResizeParams({ command: '', cols: -1, rows: 10 })).toBe(false);
    });
  });

  describe('createMessageValidator', () => {
    it('should create validator with default rules', () => {
      const v = createMessageValidator();
      // Test a default rule, e.g., input requires data
      expect(v.validateMessage({ command: 'input' }).valid).toBe(false);
      expect(v.validateMessage({ command: 'input', data: 'ok', terminalId: 't1' }).valid).toBe(true);
    });
  });
});
