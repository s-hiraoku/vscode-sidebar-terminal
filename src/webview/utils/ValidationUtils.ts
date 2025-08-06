/**
 * ValidationUtils - Centralized validation logic to eliminate duplication
 * Consolidates validation patterns found across multiple components
 */

import { webview as log } from '../../utils/logger';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  value?: unknown;
}

/**
 * Common validation options
 */
export interface ValidationOptions {
  allowEmpty?: boolean;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}

/**
 * Centralized validation utilities class
 */
export class ValidationUtils {
  /**
   * Validate string input
   */
  public static validateString(
    value: unknown,
    fieldName: string,
    options: ValidationOptions = {}
  ): ValidationResult {
    const { required = true, allowEmpty = false, minLength = 0, maxLength = Infinity } = options;

    // Check if value exists
    if (value === null || value === undefined) {
      return required
        ? { isValid: false, error: `${fieldName} is required` }
        : { isValid: true, value: '' };
    }

    // Convert to string
    const stringValue = String(value);

    // Check empty string
    if (!allowEmpty && stringValue.trim().length === 0) {
      return required
        ? { isValid: false, error: `${fieldName} cannot be empty` }
        : { isValid: true, value: '' };
    }

    // Check length constraints
    if (stringValue.length < minLength) {
      return {
        isValid: false,
        error: `${fieldName} must be at least ${minLength} characters long`,
      };
    }

    if (stringValue.length > maxLength) {
      return {
        isValid: false,
        error: `${fieldName} must be no more than ${maxLength} characters long`,
      };
    }

    return { isValid: true, value: stringValue };
  }

  /**
   * Validate terminal ID
   */
  public static validateTerminalId(terminalId: unknown): ValidationResult {
    const result = this.validateString(terminalId, 'Terminal ID', {
      required: true,
      allowEmpty: false,
      minLength: 1,
      maxLength: 100,
    });

    if (!result.isValid) {
      return result;
    }

    // Additional terminal ID specific validation
    const id = result.value as string;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return {
        isValid: false,
        error: 'Terminal ID can only contain alphanumeric characters, hyphens, and underscores',
      };
    }

    return { isValid: true, value: id };
  }

  /**
   * Validate DOM element
   */
  public static validateElement(
    element: unknown,
    elementType: string = 'Element'
  ): ValidationResult {
    if (!element) {
      return { isValid: false, error: `${elementType} is required` };
    }

    if (!(element instanceof HTMLElement)) {
      return { isValid: false, error: `${elementType} must be a valid HTML element` };
    }

    return { isValid: true, value: element };
  }

  /**
   * Validate number input
   */
  public static validateNumber(
    value: unknown,
    fieldName: string,
    options: { min?: number; max?: number; integer?: boolean } = {}
  ): ValidationResult {
    const { min = -Infinity, max = Infinity, integer = false } = options;

    if (value === null || value === undefined) {
      return { isValid: false, error: `${fieldName} is required` };
    }

    const numValue = Number(value);

    if (isNaN(numValue)) {
      return { isValid: false, error: `${fieldName} must be a valid number` };
    }

    if (integer && !Number.isInteger(numValue)) {
      return { isValid: false, error: `${fieldName} must be an integer` };
    }

    if (numValue < min) {
      return { isValid: false, error: `${fieldName} must be at least ${min}` };
    }

    if (numValue > max) {
      return { isValid: false, error: `${fieldName} must be no more than ${max}` };
    }

    return { isValid: true, value: numValue };
  }

  /**
   * Validate terminal settings
   */
  public static validateTerminalSettings(settings: unknown): ValidationResult {
    if (!settings || typeof settings !== 'object') {
      return { isValid: false, error: 'Terminal settings must be an object' };
    }

    // Add specific terminal settings validation as needed
    return { isValid: true, value: settings };
  }

  /**
   * Validate message command
   */
  public static validateMessageCommand(command: unknown): ValidationResult {
    // Allow any string command for flexibility in validation
    // Actual command validation is handled by the message handlers

    const result = this.validateString(command, 'Command', { required: true });
    return result;
  }

  /**
   * Validate and sanitize data for safe processing
   */
  public static sanitizeData(data: unknown, maxSize: number = 1024 * 1024): ValidationResult {
    if (data === null || data === undefined) {
      return { isValid: true, value: '' };
    }

    try {
      const serialized = JSON.stringify(data);
      if (serialized.length > maxSize) {
        return { isValid: false, error: `Data size exceeds maximum allowed size (${maxSize} bytes)` };
      }
      return { isValid: true, value: JSON.parse(serialized) };
    } catch (error) {
      return { isValid: false, error: `Data serialization failed: ${String(error)}` };
    }
  }

  /**
   * Validate coordinator instance
   */
  public static validateCoordinator(coordinator: unknown): ValidationResult {
    if (!coordinator) {
      return { isValid: false, error: 'Coordinator is required' };
    }

    if (typeof coordinator !== 'object') {
      return { isValid: false, error: 'Coordinator must be an object' };
    }

    // Check for required coordinator methods
    const requiredMethods = ['getActiveTerminalId', 'postMessageToExtension', 'log'];
    for (const method of requiredMethods) {
      if (typeof (coordinator as Record<string, unknown>)[method] !== 'function') {
        return { isValid: false, error: `Coordinator missing required method: ${method}` };
      }
    }

    return { isValid: true, value: coordinator };
  }

  /**
   * Batch validate multiple values
   */
  public static validateBatch(validations: Array<() => ValidationResult>): ValidationResult {
    const errors: string[] = [];

    for (const validation of validations) {
      const result = validation();
      if (!result.isValid && result.error) {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return { isValid: false, error: errors.join('; ') };
    }

    return { isValid: true };
  }

  /**
   * Create validation wrapper with logging
   */
  public static createValidationWrapper<T extends (...args: unknown[]) => unknown>(
    func: T,
    validations: Array<(args: Parameters<T>) => ValidationResult>,
    logPrefix: string = '[VALIDATION]'
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        // Run all validations
        const batchResult = this.validateBatch(validations.map(v => () => v(args)));
        
        if (!batchResult.isValid) {
          log(`${logPrefix} Validation failed: ${batchResult.error}`);
          throw new Error(batchResult.error);
        }

        return func.apply(this, args);
      } catch (error) {
        log(`${logPrefix} Operation failed: ${String(error)}`);
        throw error;
      }
    }) as T;
  }
}