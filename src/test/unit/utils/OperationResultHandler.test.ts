/**
 * OperationResultHandler unit tests
 *
 * 統一されたオペレーション結果処理ユーティリティのテスト
 * 重複していたエラーハンドリングパターンを統一する機能を検証
 */
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import * as sinon from 'sinon';

use(sinonChai);

import {
  OperationResultHandler,
  OperationResult as _OperationResult,
  NotificationService,
} from '../../../utils/OperationResultHandler';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestEnvironment,
  safeStub,
} from '../../utils/CommonTestSetup';

describe('OperationResultHandler', () => {
  let testEnv: TestEnvironment;
  let mockNotificationService: sinon.SinonStubbedInstance<NotificationService>;
  let logSpy: sinon.SinonStub;

  beforeEach(() => {
    testEnv = setupTestEnvironment();

    // Mock notification service
    mockNotificationService = {
      showSuccess: testEnv.sandbox.stub(),
      showError: testEnv.sandbox.stub(),
      showWarning: testEnv.sandbox.stub(),
    };

    // Mock logger using safe stub to prevent "already stubbed" errors
    const loggerModule = require('../../../utils/logger');
    logSpy = safeStub(testEnv.sandbox, loggerModule, 'extension');
  });

  afterEach(() => {
    cleanupTestEnvironment(testEnv);
  });

  describe('createResult', () => {
    it('should create result with success true', () => {
      const data = { test: 'data' };
      const result = OperationResultHandler.createResult(true, data);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(data);
      expect(result.reason).to.be.undefined;
      expect(result.error).to.be.undefined;
    });

    it('should create result with failure and reason', () => {
      const error = new Error('test error');
      const result = OperationResultHandler.createResult(false, undefined, 'Test failure', error);

      expect(result.success).to.be.false;
      expect(result.data).to.be.undefined;
      expect(result.reason).to.equal('Test failure');
      expect(result.error).to.equal(error);
    });

    it('should create result with all properties', () => {
      const data = { value: 42 };
      const error = new Error('partial error');
      const result = OperationResultHandler.createResult(true, data, 'Warning message', error);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(data);
      expect(result.reason).to.equal('Warning message');
      expect(result.error).to.equal(error);
    });
  });

  describe('success', () => {
    it('should create success result with data', () => {
      const data = { terminal: 'id-123' };
      const result = OperationResultHandler.success(data);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(data);
      expect(result.reason).to.be.undefined;
      expect(result.error).to.be.undefined;
    });

    it('should create success result without data', () => {
      const result = OperationResultHandler.success();

      expect(result.success).to.be.true;
      expect(result.data).to.be.undefined;
      expect(result.reason).to.be.undefined;
      expect(result.error).to.be.undefined;
    });
  });

  describe('failure', () => {
    it('should create failure result with reason', () => {
      const result = OperationResultHandler.failure('Operation failed');

      expect(result.success).to.be.false;
      expect(result.data).to.be.undefined;
      expect(result.reason).to.equal('Operation failed');
      expect(result.error).to.be.undefined;
    });

    it('should create failure result with reason and error', () => {
      const error = new Error('detailed error');
      const result = OperationResultHandler.failure('Operation failed', error);

      expect(result.success).to.be.false;
      expect(result.data).to.be.undefined;
      expect(result.reason).to.equal('Operation failed');
      expect(result.error).to.equal(error);
    });
  });

  describe('handleTerminalOperation', () => {
    it('should handle successful async operation', async () => {
      const testData = { terminalId: 'test-123' };
      const operation = testEnv.sandbox.stub().resolves(OperationResultHandler.success(testData));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'TEST_CONTEXT',
        'Success message',
        mockNotificationService
      );

      expect(result).to.deep.equal(testData);
      expect(logSpy).to.have.been.calledWith('✅ [TEST_CONTEXT] Operation successful');
      expect(mockNotificationService.showSuccess).to.have.been.calledWith('Success message');
      expect(operation).to.have.been.calledOnce;
    });

    it('should handle successful operation without notification', async () => {
      const testData = { value: 'test' };
      const operation = testEnv.sandbox.stub().resolves(OperationResultHandler.success(testData));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'TEST_CONTEXT'
      );

      expect(result).to.deep.equal(testData);
      expect(logSpy).to.have.been.calledWith('✅ [TEST_CONTEXT] Operation successful');
      expect(mockNotificationService.showSuccess).not.to.have.been.called;
    });

    it('should handle failed operation with reason', async () => {
      const operation = testEnv.sandbox
        .stub()
        .resolves(OperationResultHandler.failure('Terminal not found'));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'DELETE_TERMINAL',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith(
        '⚠️ [DELETE_TERMINAL] Operation failed: Terminal not found'
      );
      expect(mockNotificationService.showError).to.have.been.calledWith('Terminal not found');
    });

    it('should handle failed operation without reason', async () => {
      const operation = testEnv.sandbox.stub().resolves(OperationResultHandler.createResult(false));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'TEST_CONTEXT',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith(
        '⚠️ [TEST_CONTEXT] Operation failed: Operation failed'
      );
      expect(mockNotificationService.showError).to.have.been.calledWith('Operation failed');
    });

    it('should handle operation throwing error', async () => {
      const error = new Error('Unexpected error');
      const operation = testEnv.sandbox.stub().rejects(error);

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'RISKY_OPERATION',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith(
        '❌ [RISKY_OPERATION] Operation error: Error: Unexpected error'
      );
      expect(mockNotificationService.showError).to.have.been.calledWith(
        'Operation error: Error: Unexpected error'
      );
    });

    it('should handle operation returning null data successfully', async () => {
      const operation = testEnv.sandbox.stub().resolves(OperationResultHandler.success());

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'NULL_DATA_TEST'
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith('✅ [NULL_DATA_TEST] Operation successful');
    });
  });

  describe('handleSyncOperation', () => {
    it('should handle successful sync operation', () => {
      const testData = { syncResult: true };
      const operation = testEnv.sandbox.stub().returns(OperationResultHandler.success(testData));

      const result = OperationResultHandler.handleSyncOperation(
        operation,
        'SYNC_TEST',
        'Sync completed',
        mockNotificationService
      );

      expect(result).to.deep.equal(testData);
      expect(logSpy).to.have.been.calledWith('✅ [SYNC_TEST] Operation successful');
      expect(mockNotificationService.showSuccess).to.have.been.calledWith('Sync completed');
    });

    it('should handle failed sync operation', () => {
      const operation = testEnv.sandbox
        .stub()
        .returns(OperationResultHandler.failure('Sync failed'));

      const result = OperationResultHandler.handleSyncOperation(
        operation,
        'SYNC_FAIL',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith('⚠️ [SYNC_FAIL] Operation failed: Sync failed');
      expect(mockNotificationService.showError).to.have.been.calledWith('Sync failed');
    });

    it('should handle sync operation throwing error', () => {
      const error = new Error('Sync exception');
      const operation = testEnv.sandbox.stub().throws(error);

      const result = OperationResultHandler.handleSyncOperation(
        operation,
        'SYNC_EXCEPTION',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith(
        '❌ [SYNC_EXCEPTION] Operation error: Error: Sync exception'
      );
      expect(mockNotificationService.showError).to.have.been.calledWith(
        'Operation error: Error: Sync exception'
      );
    });

    it('should handle sync operation without notification service', () => {
      const testData = { config: 'updated' };
      const operation = testEnv.sandbox.stub().returns(OperationResultHandler.success(testData));

      const result = OperationResultHandler.handleSyncOperation(operation, 'NO_NOTIFICATION');

      expect(result).to.deep.equal(testData);
      expect(logSpy).to.have.been.calledWith('✅ [NO_NOTIFICATION] Operation successful');
    });
  });

  describe('handleBatchOperations', () => {
    it('should handle all successful batch operations', async () => {
      const operations = [
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 1 })),
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 2 })),
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 3 })),
      ];

      const result = await OperationResultHandler.handleBatchOperations(
        operations,
        'BATCH_TEST',
        mockNotificationService
      );

      expect(result.successful).to.have.length(3);
      expect(result.failed).to.have.length(0);
      expect(result.successful[0]).to.deep.equal({ id: 1 });
      expect(result.successful[1]).to.deep.equal({ id: 2 });
      expect(result.successful[2]).to.deep.equal({ id: 3 });

      expect(logSpy).to.have.been.calledWith(
        '📊 [BATCH_TEST] Batch operation completed: 3 successful, 0 failed'
      );
      expect(mockNotificationService.showSuccess).to.have.been.calledWith(
        'All 3 operations completed successfully'
      );
    });

    it('should handle mixed success and failure batch operations', async () => {
      const operations = [
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 1 })),
        testEnv.sandbox.stub().resolves(OperationResultHandler.failure('Operation 2 failed')),
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 3 })),
      ];

      const result = await OperationResultHandler.handleBatchOperations(
        operations,
        'MIXED_BATCH',
        mockNotificationService
      );

      expect(result.successful).to.have.length(2);
      expect(result.failed).to.have.length(1);
      expect(result.successful[0]).to.deep.equal({ id: 1 });
      expect(result.successful[1]).to.deep.equal({ id: 3 });
      expect(result.failed[0]).to.deep.equal({ index: 1, reason: 'Operation failed' });

      expect(logSpy).to.have.been.calledWith(
        '📊 [MIXED_BATCH] Batch operation completed: 2 successful, 1 failed'
      );
      expect(mockNotificationService.showWarning).to.have.been.calledWith(
        'Batch operation completed: 2 successful, 1 failed'
      );
    });

    it('should handle all failed batch operations', async () => {
      const operations = [
        testEnv.sandbox.stub().resolves(OperationResultHandler.failure('Error 1')),
        testEnv.sandbox.stub().resolves(OperationResultHandler.failure('Error 2')),
      ];

      const result = await OperationResultHandler.handleBatchOperations(
        operations,
        'ALL_FAIL_BATCH',
        mockNotificationService
      );

      expect(result.successful).to.have.length(0);
      expect(result.failed).to.have.length(2);
      expect(result.failed[0]).to.deep.equal({ index: 0, reason: 'Operation failed' });
      expect(result.failed[1]).to.deep.equal({ index: 1, reason: 'Operation failed' });

      expect(mockNotificationService.showError).to.have.been.calledWith('All 2 operations failed');
    });

    it('should handle empty batch operations', async () => {
      const result = await OperationResultHandler.handleBatchOperations(
        [],
        'EMPTY_BATCH',
        mockNotificationService
      );

      expect(result.successful).to.have.length(0);
      expect(result.failed).to.have.length(0);

      expect(logSpy).to.have.been.calledWith(
        '📊 [EMPTY_BATCH] Batch operation completed: 0 successful, 0 failed'
      );
      expect(mockNotificationService.showSuccess).to.have.been.calledWith(
        'All 0 operations completed successfully'
      );
    });

    it('should handle batch operations without notification service', async () => {
      const operations = [
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ data: 'test' })),
      ];

      const result = await OperationResultHandler.handleBatchOperations(
        operations,
        'NO_NOTIFICATION'
      );

      expect(result.successful).to.have.length(1);
      expect(result.failed).to.have.length(0);
      expect(logSpy).to.have.been.calledWith(
        '📊 [NO_NOTIFICATION] Batch operation completed: 1 successful, 0 failed'
      );
    });

    it('should handle operations throwing exceptions in batch', async () => {
      const operations = [
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 1 })),
        testEnv.sandbox.stub().rejects(new Error('Operation exception')),
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: 3 })),
      ];

      const result = await OperationResultHandler.handleBatchOperations(
        operations,
        'EXCEPTION_BATCH',
        mockNotificationService
      );

      expect(result.successful).to.have.length(2);
      expect(result.failed).to.have.length(1);
      expect(result.successful[0]).to.deep.equal({ id: 1 });
      expect(result.successful[1]).to.deep.equal({ id: 3 });
      expect(result.failed[0]).to.deep.equal({ index: 1, reason: 'Operation failed' });
    });
  });

  describe('error handling edge cases', () => {
    it('should handle non-Error objects thrown', async () => {
      const operation = testEnv.sandbox.stub().rejects('String error');

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'STRING_ERROR',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith('❌ [STRING_ERROR] Operation error: String error');
      expect(mockNotificationService.showError).to.have.been.calledWith(
        'Operation error: String error'
      );
    });

    it('should handle null error object', async () => {
      const operation = testEnv.sandbox.stub().rejects(null);

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'NULL_ERROR',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith('❌ [NULL_ERROR] Operation error: null');
      expect(mockNotificationService.showError).to.have.been.calledWith('Operation error: null');
    });

    it('should handle undefined error object', async () => {
      const operation = testEnv.sandbox.stub().rejects(undefined);

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'UNDEFINED_ERROR',
        undefined,
        mockNotificationService
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith('❌ [UNDEFINED_ERROR] Operation error: undefined');
      expect(mockNotificationService.showError).to.have.been.calledWith(
        'Operation error: undefined'
      );
    });
  });

  describe('notification service integration', () => {
    it('should work without notification service for successful operations', async () => {
      const operation = testEnv.sandbox
        .stub()
        .resolves(OperationResultHandler.success({ data: 'test' }));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'NO_NOTIF_SUCCESS'
      );

      expect(result).to.deep.equal({ data: 'test' });
      expect(logSpy).to.have.been.calledWith('✅ [NO_NOTIF_SUCCESS] Operation successful');
    });

    it('should work without notification service for failed operations', async () => {
      const operation = testEnv.sandbox
        .stub()
        .resolves(OperationResultHandler.failure('Test failure'));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'NO_NOTIF_FAIL'
      );

      expect(result).to.be.null;
      expect(logSpy).to.have.been.calledWith('⚠️ [NO_NOTIF_FAIL] Operation failed: Test failure');
    });

    it('should handle notification service throwing errors gracefully', async () => {
      const faultyNotificationService = {
        showSuccess: testEnv.sandbox.stub().throws(new Error('Notification error')),
        showError: testEnv.sandbox.stub(),
        showWarning: testEnv.sandbox.stub(),
      };

      const operation = testEnv.sandbox
        .stub()
        .resolves(OperationResultHandler.success({ data: 'test' }));

      // Should not throw even if notification service throws
      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'FAULTY_NOTIFICATION',
        'Success message',
        faultyNotificationService
      );

      expect(result).to.deep.equal({ data: 'test' });
      expect(logSpy).to.have.been.calledWith('✅ [FAULTY_NOTIFICATION] Operation successful');
    });
  });

  describe('performance considerations', () => {
    it('should handle large batch operations efficiently', async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        testEnv.sandbox.stub().resolves(OperationResultHandler.success({ id: i }))
      );

      const startTime = Date.now();
      const result = await OperationResultHandler.handleBatchOperations(operations, 'LARGE_BATCH');
      const endTime = Date.now();

      expect(result.successful).to.have.length(100);
      expect(result.failed).to.have.length(0);
      expect(endTime - startTime).to.be.lessThan(1000); // Should complete within 1 second
    });

    it('should handle operations with complex data structures', async () => {
      const complexData = {
        terminal: {
          id: 'complex-terminal-123',
          config: {
            shell: '/bin/bash',
            args: ['--login'],
            env: { PATH: '/usr/bin:/bin' },
            features: ['scrollback', 'unicode', 'colors'],
          },
          state: {
            isActive: true,
            lastActivity: new Date().toISOString(),
            scrollPosition: 0,
          },
        },
      };

      const operation = testEnv.sandbox
        .stub()
        .resolves(OperationResultHandler.success(complexData));

      const result = await OperationResultHandler.handleTerminalOperation(
        operation,
        'COMPLEX_DATA'
      );

      expect(result).to.deep.equal(complexData);
      expect(logSpy).to.have.been.calledWith('✅ [COMPLEX_DATA] Operation successful');
    });
  });
});
