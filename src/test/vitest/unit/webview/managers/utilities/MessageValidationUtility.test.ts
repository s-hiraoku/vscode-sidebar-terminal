import { describe, it, expect, vi } from 'vitest';
import { MessageValidationUtility } from '../../../../../../webview/managers/utilities/MessageValidationUtility';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../../webview/managers/messageTypes';

describe('MessageValidationUtility', () => {
  describe('validateTerminalId', () => {
    it('should return terminal ID when valid', () => {
      const msg = { terminalId: 'term-1', command: 'test' } as MessageCommand;
      expect(MessageValidationUtility.validateTerminalId(msg)).toBe('term-1');
    });

    it('should return null when terminal ID is missing', () => {
      const msg = { command: 'test' } as MessageCommand;
      expect(MessageValidationUtility.validateTerminalId(msg)).toBeNull();
    });

    it('should return null when terminal ID is not a string', () => {
      const msg = { terminalId: 123, command: 'test' } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateTerminalId(msg)).toBeNull();
    });

    it('should return null when terminal ID is empty string', () => {
      const msg = { terminalId: '   ', command: 'test' } as MessageCommand;
      expect(MessageValidationUtility.validateTerminalId(msg)).toBeNull();
    });
  });

  describe('validateTerminalInstance', () => {
    it('should return terminal instance when found', () => {
      const mockInstance = { id: 'term-1' };
      const coordinator = {
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      } as unknown as IManagerCoordinator;

      expect(MessageValidationUtility.validateTerminalInstance('term-1', coordinator)).toBe(mockInstance);
      expect(coordinator.getTerminalInstance).toHaveBeenCalledWith('term-1');
    });

    it('should return null when terminal instance not found', () => {
      const coordinator = {
        getTerminalInstance: vi.fn().mockReturnValue(undefined),
      } as unknown as IManagerCoordinator;

      expect(MessageValidationUtility.validateTerminalInstance('term-1', coordinator)).toBeNull();
    });
  });

  describe('extractRequestMetadata', () => {
    it('should extract metadata from message', () => {
      const msg = { 
        command: 'test', 
        requestId: 'req-1', 
        messageId: 'msg-1' 
      } as unknown as MessageCommand;
      
      const metadata = MessageValidationUtility.extractRequestMetadata(msg);
      
      expect(metadata.requestId).toBe('req-1');
      expect(metadata.messageId).toBe('msg-1');
      expect(metadata.timestamp).toBeDefined();
      expect(typeof metadata.timestamp).toBe('number');
    });

    it('should handle missing metadata', () => {
      const msg = { command: 'test' } as MessageCommand;
      const metadata = MessageValidationUtility.extractRequestMetadata(msg);
      
      expect(metadata.requestId).toBeUndefined();
      expect(metadata.messageId).toBeUndefined();
      expect(metadata.timestamp).toBeDefined();
    });
  });

  describe('validateAndGetTerminal', () => {
    it('should return terminalId and instance when valid', () => {
      const mockInstance = { id: 'term-1' };
      const coordinator = {
        getTerminalInstance: vi.fn().mockReturnValue(mockInstance),
      } as unknown as IManagerCoordinator;
      const msg = { terminalId: 'term-1', command: 'test' } as MessageCommand;

      const result = MessageValidationUtility.validateAndGetTerminal(msg, coordinator);
      
      expect(result).toEqual({ terminalId: 'term-1', instance: mockInstance });
    });

    it('should return null when terminalId is invalid', () => {
      const coordinator = {
        getTerminalInstance: vi.fn(),
      } as unknown as IManagerCoordinator;
      const msg = { command: 'test' } as MessageCommand;

      expect(MessageValidationUtility.validateAndGetTerminal(msg, coordinator)).toBeNull();
      expect(coordinator.getTerminalInstance).not.toHaveBeenCalled();
    });

    it('should return null when instance not found', () => {
      const coordinator = {
        getTerminalInstance: vi.fn().mockReturnValue(undefined),
      } as unknown as IManagerCoordinator;
      const msg = { terminalId: 'term-1', command: 'test' } as MessageCommand;

      expect(MessageValidationUtility.validateAndGetTerminal(msg, coordinator)).toBeNull();
    });
  });

  describe('validateArray', () => {
    it('should return array when valid', () => {
      const msg = { items: [1, 2, 3] } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateArray(msg, 'items')).toEqual([1, 2, 3]);
    });

    it('should return null when field is not an array', () => {
      const msg = { items: 'not-array' } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateArray(msg, 'items')).toBeNull();
    });

    it('should return null when field is missing', () => {
      const msg = {} as MessageCommand;
      expect(MessageValidationUtility.validateArray(msg, 'items')).toBeNull();
    });

    it('should filter items using itemValidator', () => {
      const msg = { items: [1, '2', 3, '4'] } as unknown as MessageCommand;
      const isNumber = (item: unknown): item is number => typeof item === 'number';
      
      expect(MessageValidationUtility.validateArray(msg, 'items', isNumber)).toEqual([1, 3]);
    });
  });

  describe('validateString', () => {
    it('should return string when valid', () => {
      const msg = { name: 'test' } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateString(msg, 'name')).toBe('test');
    });

    it('should return null when field is missing and required', () => {
      const msg = {} as MessageCommand;
      expect(MessageValidationUtility.validateString(msg, 'name', true)).toBeNull();
    });

    it('should return null when field is missing and not required', () => {
      const msg = {} as MessageCommand;
      expect(MessageValidationUtility.validateString(msg, 'name', false)).toBeNull();
    });

    it('should return null when field is not a string', () => {
      const msg = { name: 123 } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateString(msg, 'name')).toBeNull();
    });
  });

  describe('validateNumber', () => {
    it('should return number when valid', () => {
      const msg = { count: 42 } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateNumber(msg, 'count')).toBe(42);
    });

    it('should return null when field is missing and required', () => {
      const msg = {} as MessageCommand;
      expect(MessageValidationUtility.validateNumber(msg, 'count', true)).toBeNull();
    });

    it('should return null when field is missing and not required', () => {
      const msg = {} as MessageCommand;
      expect(MessageValidationUtility.validateNumber(msg, 'count', false)).toBeNull();
    });

    it('should return null when field is not a number', () => {
      const msg = { count: '42' } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateNumber(msg, 'count')).toBeNull();
    });
  });

  describe('validateBoolean', () => {
    it('should return boolean value', () => {
      const msg = { flag: true } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateBoolean(msg, 'flag')).toBe(true);
    });

    it('should return default value when missing', () => {
      const msg = {} as MessageCommand;
      expect(MessageValidationUtility.validateBoolean(msg, 'flag', true)).toBe(true);
      expect(MessageValidationUtility.validateBoolean(msg, 'flag', false)).toBe(false);
    });

    it('should convert to boolean', () => {
      const msg = { flag: 1 } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateBoolean(msg, 'flag')).toBe(true);
      
      const msg2 = { flag: 0 } as unknown as MessageCommand;
      expect(MessageValidationUtility.validateBoolean(msg2, 'flag')).toBe(false);
    });
  });
});
