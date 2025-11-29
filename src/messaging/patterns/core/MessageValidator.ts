/**
 * Message Validator
 *
 * Centralized validation logic for all message types.
 * Consolidates validation patterns from:
 * - MessageRouter.validateMessageData
 * - BaseMessageHandler validation methods
 * - Inline validation across multiple files
 *
 * Related to: GitHub Issue #219
 */

import { WebviewMessage } from '../../../types/common';

/**
 * Validation error with details
 */
export class MessageValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly command?: string
  ) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

/**
 * Validation result
 */
export interface IValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Message validation rules
 */
export interface IMessageValidationRule {
  /** Fields that must be present */
  required?: string[];

  /** Fields with type requirements */
  types?: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;

  /** Custom validation function */
  custom?: (message: WebviewMessage) => boolean | string;
}

/**
 * Centralized message validator
 */
export class MessageValidator {
  private readonly rules = new Map<string, IMessageValidationRule>();

  /**
   * Register validation rules for a command
   */
  public registerRule(command: string, rule: IMessageValidationRule): void {
    this.rules.set(command, rule);
  }

  /**
   * Register multiple validation rules
   */
  public registerRules(rules: Record<string, IMessageValidationRule>): void {
    for (const [command, rule] of Object.entries(rules)) {
      this.registerRule(command, rule);
    }
  }

  /**
   * Validate a message
   * @throws MessageValidationError if validation fails
   */
  public validate(message: WebviewMessage): void {
    const result = this.validateMessage(message);
    if (!result.valid) {
      throw new MessageValidationError(result.errors.join('; '), undefined, message.command);
    }
  }

  /**
   * Validate a message and return result without throwing
   */
  public validateMessage(message: WebviewMessage): IValidationResult {
    const errors: string[] = [];

    // Basic structure validation
    if (!message || typeof message !== 'object') {
      errors.push('Message must be an object');
      return { valid: false, errors };
    }

    if (!message.command || typeof message.command !== 'string') {
      errors.push('Message must have a command string');
      return { valid: false, errors };
    }

    // Command-specific validation
    const rule = this.rules.get(message.command);
    if (rule) {
      this.validateWithRule(message, rule, errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate required fields
   */
  public validateRequired(message: WebviewMessage, fields: string[]): void {
    for (const field of fields) {
      if (!(field in message) || (message as any)[field] === undefined) {
        throw new MessageValidationError(
          `Missing required field: ${field}`,
          field,
          message.command
        );
      }
    }
  }

  /**
   * Validate field type
   */
  public validateType<T extends string | number | boolean | object>(
    value: unknown,
    expectedType: string,
    fieldName: string
  ): value is T {
    let actualType = typeof value;

    // Special handling for arrays
    if (expectedType === 'array') {
      if (!Array.isArray(value)) {
        throw new MessageValidationError(
          `Field '${fieldName}' must be an array, got ${actualType}`
        );
      }
      return true;
    }

    if (actualType !== expectedType) {
      throw new MessageValidationError(
        `Field '${fieldName}' must be of type ${expectedType}, got ${actualType}`
      );
    }

    return true;
  }

  /**
   * Validate message has terminal ID
   */
  public hasTerminalId(
    message: WebviewMessage
  ): message is WebviewMessage & { terminalId: string } {
    return (
      typeof (message as any).terminalId === 'string' && (message as any).terminalId.length > 0
    );
  }

  /**
   * Validate message has resize parameters
   */
  public hasResizeParams(
    message: WebviewMessage
  ): message is WebviewMessage & { cols: number; rows: number } {
    const { cols, rows } = message as any;
    return typeof cols === 'number' && typeof rows === 'number' && cols > 0 && rows > 0;
  }

  /**
   * Validate message has input data
   */
  public hasInputData(message: WebviewMessage): message is WebviewMessage & { data: string } {
    return typeof (message as any).data === 'string';
  }

  /**
   * Validate message has settings
   */
  public hasSettings(message: WebviewMessage): message is WebviewMessage & { settings: unknown } {
    return (message as any).settings !== undefined && typeof (message as any).settings === 'object';
  }

  /**
   * Validate with rule
   */
  private validateWithRule(
    message: WebviewMessage,
    rule: IMessageValidationRule,
    errors: string[]
  ): void {
    // Check required fields
    if (rule.required) {
      for (const field of rule.required) {
        if (!(field in message) || (message as any)[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Check field types
    if (rule.types) {
      for (const [field, expectedType] of Object.entries(rule.types)) {
        if (field in message) {
          const value = (message as any)[field];
          const actualType = Array.isArray(value) ? 'array' : typeof value;

          if (actualType !== expectedType) {
            errors.push(`Field '${field}' must be of type ${expectedType}, got ${actualType}`);
          }
        }
      }
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(message);
      if (typeof customResult === 'string') {
        errors.push(customResult);
      } else if (customResult === false) {
        errors.push('Custom validation failed');
      }
    }
  }
}

/**
 * Default validation rules for common message types
 */
export const DEFAULT_VALIDATION_RULES: Record<string, IMessageValidationRule> = {
  input: {
    required: ['data'],
    types: { data: 'string', terminalId: 'string' },
  },
  resize: {
    required: ['cols', 'rows'],
    types: { cols: 'number', rows: 'number', terminalId: 'string' },
    custom: (msg) => {
      const { cols, rows } = msg as any;
      if (cols <= 0 || rows <= 0) {
        return 'Resize dimensions must be positive';
      }
      return true;
    },
  },
  createTerminal: {
    types: { name: 'string', cwd: 'string' },
  },
  deleteTerminal: {
    required: ['terminalId'],
    types: { terminalId: 'string', requestSource: 'string' },
  },
  killTerminal: {
    types: { terminalId: 'string' },
  },
  output: {
    required: ['data', 'terminalId'],
    types: { data: 'string', terminalId: 'string' },
  },
  setActiveTerminal: {
    required: ['terminalId'],
    types: { terminalId: 'string' },
  },
  focusTerminal: {
    required: ['terminalId'],
    types: { terminalId: 'string' },
  },
  cliAgentStatusUpdate: {
    required: ['status'],
    types: { status: 'object', terminalId: 'string' },
  },
  sessionRestore: {
    required: ['terminals'],
    types: { terminals: 'array', activeTerminalId: 'string' },
  },
};

/**
 * Create a configured message validator instance
 */
export function createMessageValidator(): MessageValidator {
  const validator = new MessageValidator();
  validator.registerRules(DEFAULT_VALIDATION_RULES);
  return validator;
}
