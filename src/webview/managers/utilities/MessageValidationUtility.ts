/**
 * Message Validation Utility
 *
 * Provides common validation functions for message handlers
 */

import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';

/**
 * Request metadata extracted from messages
 */
export interface RequestMetadata {
  requestId?: string;
  messageId?: string;
  timestamp?: number;
}

/**
 * Message Validation Utility
 *
 * Centralized validation logic for message handlers
 */
export class MessageValidationUtility {
  /**
   * Validate and extract terminal ID from message
   * @returns Terminal ID if valid, null otherwise
   */
  public static validateTerminalId(msg: MessageCommand): string | null {
    const terminalId = msg.terminalId as string;

    if (!terminalId) {
      return null;
    }

    if (typeof terminalId !== 'string' || terminalId.trim() === '') {
      return null;
    }

    return terminalId;
  }

  /**
   * Validate terminal exists and return its instance
   * @returns Terminal instance if found, null otherwise
   */
  public static validateTerminalInstance(
    terminalId: string,
    coordinator: IManagerCoordinator
  ): any | null {
    const terminal = coordinator.getTerminalInstance(terminalId);

    if (!terminal) {
      return null;
    }

    return terminal;
  }

  /**
   * Extract request metadata from message
   */
  public static extractRequestMetadata(msg: MessageCommand): RequestMetadata {
    return {
      requestId: (msg as any).requestId as string | undefined,
      messageId: (msg as any).messageId as string | undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * Validate terminal ID and get instance (combined operation)
   * @returns Object with terminalId and instance, or null if validation fails
   */
  public static validateAndGetTerminal(
    msg: MessageCommand,
    coordinator: IManagerCoordinator
  ): { terminalId: string; instance: any } | null {
    const terminalId = this.validateTerminalId(msg);
    if (!terminalId) {
      return null;
    }

    const instance = this.validateTerminalInstance(terminalId, coordinator);
    if (!instance) {
      return null;
    }

    return { terminalId, instance };
  }

  /**
   * Validate array field in message
   */
  public static validateArray<T>(
    msg: MessageCommand,
    fieldName: string,
    itemValidator?: (item: unknown) => item is T
  ): T[] | null {
    const field = (msg as any)[fieldName];

    if (!Array.isArray(field)) {
      return null;
    }

    if (itemValidator) {
      return field.filter(itemValidator);
    }

    return field as T[];
  }

  /**
   * Validate string field in message
   */
  public static validateString(
    msg: MessageCommand,
    fieldName: string,
    required: boolean = true
  ): string | null {
    const field = (msg as any)[fieldName];

    if (required && !field) {
      return null;
    }

    if (field && typeof field !== 'string') {
      return null;
    }

    return field as string || null;
  }

  /**
   * Validate number field in message
   */
  public static validateNumber(
    msg: MessageCommand,
    fieldName: string,
    required: boolean = true
  ): number | null {
    const field = (msg as any)[fieldName];

    if (required && field === undefined) {
      return null;
    }

    if (field !== undefined && typeof field !== 'number') {
      return null;
    }

    return field as number || null;
  }

  /**
   * Validate boolean field in message
   */
  public static validateBoolean(
    msg: MessageCommand,
    fieldName: string,
    defaultValue: boolean = false
  ): boolean {
    const field = (msg as any)[fieldName];

    if (field === undefined) {
      return defaultValue;
    }

    return Boolean(field);
  }
}
