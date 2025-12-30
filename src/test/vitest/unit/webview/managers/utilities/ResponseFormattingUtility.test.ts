import { describe, it, expect, vi } from 'vitest';
import { ResponseFormattingUtility } from '../../../../../../webview/managers/utilities/ResponseFormattingUtility';
import { IManagerCoordinator } from '../../../../../../webview/interfaces/ManagerInterfaces';
import { MessageCommand } from '../../../../../../webview/managers/messageTypes';
import { RequestMetadata } from '../../../../../../webview/managers/utilities/MessageValidationUtility';

describe('ResponseFormattingUtility', () => {
  const mockMetadata: RequestMetadata = {
    requestId: 'req-1',
    messageId: 'msg-1',
    timestamp: 1234567890
  };

  describe('createSuccessResponse', () => {
    it('should create success response with metadata', () => {
      const response = ResponseFormattingUtility.createSuccessResponse(
        'testCommand',
        { foo: 'bar' },
        mockMetadata
      );

      expect(response).toEqual({
        command: 'testCommand',
        success: true,
        foo: 'bar',
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });

    it('should create success response without metadata', () => {
      const response = ResponseFormattingUtility.createSuccessResponse(
        'testCommand',
        { foo: 'bar' }
      );

      expect(response.command).toBe('testCommand');
      expect(response.success).toBe(true);
      expect((response as any).foo).toBe('bar');
      expect((response as any).requestId).toBeUndefined();
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with string error', () => {
      const response = ResponseFormattingUtility.createErrorResponse(
        'testCommand',
        'Something went wrong',
        mockMetadata
      );

      expect(response).toEqual({
        command: 'testCommand',
        success: false,
        error: 'Something went wrong',
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });

    it('should create error response with Error object', () => {
      const error = new Error('Something went wrong');
      const response = ResponseFormattingUtility.createErrorResponse(
        'testCommand',
        error,
        mockMetadata
      );

      expect(response.error).toBe('Something went wrong');
    });
  });

  describe('sendResponse', () => {
    it('should send response via coordinator', () => {
      const coordinator = {
        postMessageToExtension: vi.fn()
      } as unknown as IManagerCoordinator;
      const response = { command: 'test' } as MessageCommand;

      ResponseFormattingUtility.sendResponse(coordinator, response);

      expect(coordinator.postMessageToExtension).toHaveBeenCalledWith(response);
    });
  });

  describe('sendSuccessResponse', () => {
    it('should create and send success response', () => {
      const coordinator = {
        postMessageToExtension: vi.fn()
      } as unknown as IManagerCoordinator;

      ResponseFormattingUtility.sendSuccessResponse(
        coordinator,
        'testCommand',
        { foo: 'bar' },
        mockMetadata
      );

      expect(coordinator.postMessageToExtension).toHaveBeenCalledWith({
        command: 'testCommand',
        success: true,
        foo: 'bar',
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });
  });

  describe('sendErrorResponse', () => {
    it('should create and send error response', () => {
      const coordinator = {
        postMessageToExtension: vi.fn()
      } as unknown as IManagerCoordinator;

      ResponseFormattingUtility.sendErrorResponse(
        coordinator,
        'testCommand',
        'error message',
        mockMetadata
      );

      expect(coordinator.postMessageToExtension).toHaveBeenCalledWith({
        command: 'testCommand',
        success: false,
        error: 'error message',
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });
  });

  describe('createScrollbackExtractedResponse', () => {
    it('should create scrollback extracted response', () => {
      const response = ResponseFormattingUtility.createScrollbackExtractedResponse(
        'term-1',
        ['line1', 'line2'],
        mockMetadata
      );

      expect(response).toEqual({
        command: 'scrollbackExtracted',
        success: true,
        terminalId: 'term-1',
        scrollbackContent: ['line1', 'line2'],
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });
  });

  describe('createScrollbackRestoredResponse', () => {
    it('should create scrollback restored response', () => {
      const response = ResponseFormattingUtility.createScrollbackRestoredResponse(
        'term-1',
        100,
        mockMetadata
      );

      expect(response).toEqual({
        command: 'scrollbackRestored',
        success: true,
        terminalId: 'term-1',
        restoredLines: 100,
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });
  });

  describe('createSerializationResponse', () => {
    it('should create success response', () => {
      const response = ResponseFormattingUtility.createSerializationResponse(
        { 'term-1': 'data' },
        mockMetadata
      );

      expect(response).toEqual({
        command: 'terminalSerializationResponse',
        success: true,
        serializationData: { 'term-1': 'data' },
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });

    it('should create error response when error provided', () => {
      const response = ResponseFormattingUtility.createSerializationResponse(
        {},
        mockMetadata,
        'failed'
      );

      expect(response).toEqual({
        command: 'terminalSerializationResponse',
        success: false,
        error: 'failed',
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });
  });

  describe('createRestorationResponse', () => {
    it('should create success response', () => {
      const response = ResponseFormattingUtility.createRestorationResponse(
        5,
        10,
        mockMetadata
      );

      expect(response).toEqual({
        command: 'terminalSerializationRestoreResponse',
        success: true,
        restoredCount: 5,
        totalCount: 10,
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });

    it('should create error response when error provided', () => {
      const response = ResponseFormattingUtility.createRestorationResponse(
        0,
        10,
        mockMetadata,
        'failed'
      );

      expect(response).toEqual({
        command: 'terminalSerializationRestoreResponse',
        success: false,
        restoredCount: 0,
        totalCount: 10,
        error: 'failed',
        requestId: 'req-1',
        messageId: 'msg-1',
        timestamp: 1234567890
      });
    });
  });
});
