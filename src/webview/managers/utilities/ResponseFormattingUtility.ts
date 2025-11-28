/**
 * Response Formatting Utility
 *
 * Provides common response formatting functions for message handlers
 */

import { IManagerCoordinator } from '../../interfaces/ManagerInterfaces';
import { MessageCommand } from '../messageTypes';
import { RequestMetadata } from './MessageValidationUtility';

/**
 * Response Formatting Utility
 *
 * Centralized response message construction
 */
export class ResponseFormattingUtility {
  /**
   * Create success response message
   */
  public static createSuccessResponse(
    command: string,
    data: Record<string, unknown>,
    metadata?: RequestMetadata
  ): MessageCommand {
    return {
      command,
      success: true,
      ...data,
      ...(metadata?.requestId && { requestId: metadata.requestId }),
      ...(metadata?.messageId && { messageId: metadata.messageId }),
      timestamp: metadata?.timestamp || Date.now(),
    } as MessageCommand;
  }

  /**
   * Create error response message
   */
  public static createErrorResponse(
    command: string,
    error: string | Error,
    metadata?: RequestMetadata
  ): MessageCommand {
    const errorMessage = error instanceof Error ? error.message : error;

    return {
      command,
      success: false,
      error: errorMessage,
      ...(metadata?.requestId && { requestId: metadata.requestId }),
      ...(metadata?.messageId && { messageId: metadata.messageId }),
      timestamp: metadata?.timestamp || Date.now(),
    } as MessageCommand;
  }

  /**
   * Send response message to extension
   */
  public static sendResponse(coordinator: IManagerCoordinator, response: MessageCommand): void {
    coordinator.postMessageToExtension(response);
  }

  /**
   * Create and send success response
   */
  public static sendSuccessResponse(
    coordinator: IManagerCoordinator,
    command: string,
    data: Record<string, unknown>,
    metadata?: RequestMetadata
  ): void {
    const response = this.createSuccessResponse(command, data, metadata);
    this.sendResponse(coordinator, response);
  }

  /**
   * Create and send error response
   */
  public static sendErrorResponse(
    coordinator: IManagerCoordinator,
    command: string,
    error: string | Error,
    metadata?: RequestMetadata
  ): void {
    const response = this.createErrorResponse(command, error, metadata);
    this.sendResponse(coordinator, response);
  }

  /**
   * Create scrollback extracted response
   */
  public static createScrollbackExtractedResponse(
    terminalId: string,
    scrollbackContent: unknown[],
    metadata?: RequestMetadata
  ): MessageCommand {
    return this.createSuccessResponse(
      'scrollbackExtracted',
      {
        terminalId,
        scrollbackContent,
      },
      metadata
    );
  }

  /**
   * Create scrollback restored response
   */
  public static createScrollbackRestoredResponse(
    terminalId: string,
    restoredLines: number,
    metadata?: RequestMetadata
  ): MessageCommand {
    return this.createSuccessResponse(
      'scrollbackRestored',
      {
        terminalId,
        restoredLines,
      },
      metadata
    );
  }

  /**
   * Create terminal serialization response
   */
  public static createSerializationResponse(
    serializationData: Record<string, string>,
    metadata?: RequestMetadata,
    error?: string
  ): MessageCommand {
    if (error) {
      return this.createErrorResponse('terminalSerializationResponse', error, metadata);
    }

    return this.createSuccessResponse(
      'terminalSerializationResponse',
      {
        serializationData,
      },
      metadata
    );
  }

  /**
   * Create terminal restoration response
   */
  public static createRestorationResponse(
    restoredCount: number,
    totalCount: number,
    metadata?: RequestMetadata,
    error?: string
  ): MessageCommand {
    if (error) {
      return {
        command: 'terminalSerializationRestoreResponse',
        success: false,
        restoredCount: 0,
        totalCount,
        error,
        ...(metadata?.requestId && { requestId: metadata.requestId }),
        ...(metadata?.messageId && { messageId: metadata.messageId }),
        timestamp: metadata?.timestamp || Date.now(),
      } as MessageCommand;
    }

    return this.createSuccessResponse(
      'terminalSerializationRestoreResponse',
      {
        restoredCount,
        totalCount,
      },
      metadata
    );
  }
}
