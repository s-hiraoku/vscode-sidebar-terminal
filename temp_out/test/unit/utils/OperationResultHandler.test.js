"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * OperationResultHandler unit tests
 *
 * 統一されたオペレーション結果処理ユーティリティのテスト
 * 重複していたエラーハンドリングパターンを統一する機能を検証
 */
/* eslint-disable */
// @ts-nocheck
var chai_1 = require("chai");
var sinon_chai_1 = require("sinon-chai");
(0, chai_1.use)(sinon_chai_1.default);
var OperationResultHandler_1 = require("../../../utils/OperationResultHandler");
var CommonTestSetup_1 = require("../../utils/CommonTestSetup");
describe('OperationResultHandler', function () {
    var testEnv;
    var mockNotificationService;
    var logSpy;
    beforeEach(function () {
        testEnv = (0, CommonTestSetup_1.setupTestEnvironment)();
        // Mock notification service
        mockNotificationService = {
            showSuccess: testEnv.sandbox.stub(),
            showError: testEnv.sandbox.stub(),
            showWarning: testEnv.sandbox.stub(),
        };
        // Mock logger
        var loggerModule = require('../../../utils/logger');
        logSpy = testEnv.sandbox.stub(loggerModule, 'extension');
    });
    afterEach(function () {
        (0, CommonTestSetup_1.cleanupTestEnvironment)(testEnv);
    });
    describe('createResult', function () {
        it('should create result with success true', function () {
            var data = { test: 'data' };
            var result = OperationResultHandler_1.OperationResultHandler.createResult(true, data);
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.data).to.deep.equal(data);
            (0, chai_1.expect)(result.reason).to.be.undefined;
            (0, chai_1.expect)(result.error).to.be.undefined;
        });
        it('should create result with failure and reason', function () {
            var error = new Error('test error');
            var result = OperationResultHandler_1.OperationResultHandler.createResult(false, undefined, 'Test failure', error);
            (0, chai_1.expect)(result.success).to.be.false;
            (0, chai_1.expect)(result.data).to.be.undefined;
            (0, chai_1.expect)(result.reason).to.equal('Test failure');
            (0, chai_1.expect)(result.error).to.equal(error);
        });
        it('should create result with all properties', function () {
            var data = { value: 42 };
            var error = new Error('partial error');
            var result = OperationResultHandler_1.OperationResultHandler.createResult(true, data, 'Warning message', error);
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.data).to.deep.equal(data);
            (0, chai_1.expect)(result.reason).to.equal('Warning message');
            (0, chai_1.expect)(result.error).to.equal(error);
        });
    });
    describe('success', function () {
        it('should create success result with data', function () {
            var data = { terminal: 'id-123' };
            var result = OperationResultHandler_1.OperationResultHandler.success(data);
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.data).to.deep.equal(data);
            (0, chai_1.expect)(result.reason).to.be.undefined;
            (0, chai_1.expect)(result.error).to.be.undefined;
        });
        it('should create success result without data', function () {
            var result = OperationResultHandler_1.OperationResultHandler.success();
            (0, chai_1.expect)(result.success).to.be.true;
            (0, chai_1.expect)(result.data).to.be.undefined;
            (0, chai_1.expect)(result.reason).to.be.undefined;
            (0, chai_1.expect)(result.error).to.be.undefined;
        });
    });
    describe('failure', function () {
        it('should create failure result with reason', function () {
            var result = OperationResultHandler_1.OperationResultHandler.failure('Operation failed');
            (0, chai_1.expect)(result.success).to.be.false;
            (0, chai_1.expect)(result.data).to.be.undefined;
            (0, chai_1.expect)(result.reason).to.equal('Operation failed');
            (0, chai_1.expect)(result.error).to.be.undefined;
        });
        it('should create failure result with reason and error', function () {
            var error = new Error('detailed error');
            var result = OperationResultHandler_1.OperationResultHandler.failure('Operation failed', error);
            (0, chai_1.expect)(result.success).to.be.false;
            (0, chai_1.expect)(result.data).to.be.undefined;
            (0, chai_1.expect)(result.reason).to.equal('Operation failed');
            (0, chai_1.expect)(result.error).to.equal(error);
        });
    });
    describe('handleTerminalOperation', function () {
        it('should handle successful async operation', function () { return __awaiter(void 0, void 0, void 0, function () {
            var testData, operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        testData = { terminalId: 'test-123' };
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success(testData));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'TEST_CONTEXT', 'Success message', mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.deep.equal(testData);
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [TEST_CONTEXT] Operation successful');
                        (0, chai_1.expect)(mockNotificationService.showSuccess).to.have.been.calledWith('Success message');
                        (0, chai_1.expect)(operation).to.have.been.calledOnce;
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle successful operation without notification', function () { return __awaiter(void 0, void 0, void 0, function () {
            var testData, operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        testData = { value: 'test' };
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success(testData));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'TEST_CONTEXT')];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.deep.equal(testData);
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [TEST_CONTEXT] Operation successful');
                        (0, chai_1.expect)(mockNotificationService.showSuccess).not.to.have.been.called;
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle failed operation with reason', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.failure('Terminal not found'));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'DELETE_TERMINAL', undefined, mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('⚠️ [DELETE_TERMINAL] Operation failed: Terminal not found');
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Terminal not found');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle failed operation without reason', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.createResult(false));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'TEST_CONTEXT', undefined, mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('⚠️ [TEST_CONTEXT] Operation failed: Operation failed');
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Operation failed');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle operation throwing error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var error, operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        error = new Error('Unexpected error');
                        operation = testEnv.sandbox.stub().rejects(error);
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'RISKY_OPERATION', undefined, mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('❌ [RISKY_OPERATION] Operation error: Error: Unexpected error');
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Operation error: Error: Unexpected error');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle operation returning null data successfully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success());
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'NULL_DATA_TEST')];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [NULL_DATA_TEST] Operation successful');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('handleSyncOperation', function () {
        it('should handle successful sync operation', function () {
            var testData = { syncResult: true };
            var operation = testEnv.sandbox.stub().returns(OperationResultHandler_1.OperationResultHandler.success(testData));
            var result = OperationResultHandler_1.OperationResultHandler.handleSyncOperation(operation, 'SYNC_TEST', 'Sync completed', mockNotificationService);
            (0, chai_1.expect)(result).to.deep.equal(testData);
            (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [SYNC_TEST] Operation successful');
            (0, chai_1.expect)(mockNotificationService.showSuccess).to.have.been.calledWith('Sync completed');
        });
        it('should handle failed sync operation', function () {
            var operation = testEnv.sandbox.stub().returns(OperationResultHandler_1.OperationResultHandler.failure('Sync failed'));
            var result = OperationResultHandler_1.OperationResultHandler.handleSyncOperation(operation, 'SYNC_FAIL', undefined, mockNotificationService);
            (0, chai_1.expect)(result).to.be.null;
            (0, chai_1.expect)(logSpy).to.have.been.calledWith('⚠️ [SYNC_FAIL] Operation failed: Sync failed');
            (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Sync failed');
        });
        it('should handle sync operation throwing error', function () {
            var error = new Error('Sync exception');
            var operation = testEnv.sandbox.stub().throws(error);
            var result = OperationResultHandler_1.OperationResultHandler.handleSyncOperation(operation, 'SYNC_EXCEPTION', undefined, mockNotificationService);
            (0, chai_1.expect)(result).to.be.null;
            (0, chai_1.expect)(logSpy).to.have.been.calledWith('❌ [SYNC_EXCEPTION] Operation error: Error: Sync exception');
            (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Operation error: Error: Sync exception');
        });
        it('should handle sync operation without notification service', function () {
            var testData = { config: 'updated' };
            var operation = testEnv.sandbox.stub().returns(OperationResultHandler_1.OperationResultHandler.success(testData));
            var result = OperationResultHandler_1.OperationResultHandler.handleSyncOperation(operation, 'NO_NOTIFICATION');
            (0, chai_1.expect)(result).to.deep.equal(testData);
            (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [NO_NOTIFICATION] Operation successful');
        });
    });
    describe('handleBatchOperations', function () {
        it('should handle all successful batch operations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operations = [
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 1 })),
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 2 })),
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 3 })),
                        ];
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations(operations, 'BATCH_TEST', mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result.successful).to.have.length(3);
                        (0, chai_1.expect)(result.failed).to.have.length(0);
                        (0, chai_1.expect)(result.successful[0]).to.deep.equal({ id: 1 });
                        (0, chai_1.expect)(result.successful[1]).to.deep.equal({ id: 2 });
                        (0, chai_1.expect)(result.successful[2]).to.deep.equal({ id: 3 });
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('📊 [BATCH_TEST] Batch operation completed: 3 successful, 0 failed');
                        (0, chai_1.expect)(mockNotificationService.showSuccess).to.have.been.calledWith('All 3 operations completed successfully');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle mixed success and failure batch operations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operations = [
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 1 })),
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.failure('Operation 2 failed')),
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 3 })),
                        ];
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations(operations, 'MIXED_BATCH', mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result.successful).to.have.length(2);
                        (0, chai_1.expect)(result.failed).to.have.length(1);
                        (0, chai_1.expect)(result.successful[0]).to.deep.equal({ id: 1 });
                        (0, chai_1.expect)(result.successful[1]).to.deep.equal({ id: 3 });
                        (0, chai_1.expect)(result.failed[0]).to.deep.equal({ index: 1, reason: 'Operation failed' });
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('📊 [MIXED_BATCH] Batch operation completed: 2 successful, 1 failed');
                        (0, chai_1.expect)(mockNotificationService.showWarning).to.have.been.calledWith('Batch operation completed: 2 successful, 1 failed');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle all failed batch operations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operations = [
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.failure('Error 1')),
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.failure('Error 2')),
                        ];
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations(operations, 'ALL_FAIL_BATCH', mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result.successful).to.have.length(0);
                        (0, chai_1.expect)(result.failed).to.have.length(2);
                        (0, chai_1.expect)(result.failed[0]).to.deep.equal({ index: 0, reason: 'Operation failed' });
                        (0, chai_1.expect)(result.failed[1]).to.deep.equal({ index: 1, reason: 'Operation failed' });
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('All 2 operations failed');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle empty batch operations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations([], 'EMPTY_BATCH', mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result.successful).to.have.length(0);
                        (0, chai_1.expect)(result.failed).to.have.length(0);
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('📊 [EMPTY_BATCH] Batch operation completed: 0 successful, 0 failed');
                        (0, chai_1.expect)(mockNotificationService.showSuccess).to.have.been.calledWith('All 0 operations completed successfully');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle batch operations without notification service', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operations = [
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ data: 'test' })),
                        ];
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations(operations, 'NO_NOTIFICATION')];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result.successful).to.have.length(1);
                        (0, chai_1.expect)(result.failed).to.have.length(0);
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('📊 [NO_NOTIFICATION] Batch operation completed: 1 successful, 0 failed');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle operations throwing exceptions in batch', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operations, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operations = [
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 1 })),
                            testEnv.sandbox.stub().rejects(new Error('Operation exception')),
                            testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: 3 })),
                        ];
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations(operations, 'EXCEPTION_BATCH', mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result.successful).to.have.length(2);
                        (0, chai_1.expect)(result.failed).to.have.length(1);
                        (0, chai_1.expect)(result.successful[0]).to.deep.equal({ id: 1 });
                        (0, chai_1.expect)(result.successful[1]).to.deep.equal({ id: 3 });
                        (0, chai_1.expect)(result.failed[0]).to.deep.equal({ index: 1, reason: 'Operation failed' });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('error handling edge cases', function () {
        it('should handle non-Error objects thrown', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().rejects('String error');
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'STRING_ERROR', undefined, mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('❌ [STRING_ERROR] Operation error: String error');
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Operation error: String error');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle null error object', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().rejects(null);
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'NULL_ERROR', undefined, mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('❌ [NULL_ERROR] Operation error: null');
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Operation error: null');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle undefined error object', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().rejects(undefined);
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'UNDEFINED_ERROR', undefined, mockNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('❌ [UNDEFINED_ERROR] Operation error: undefined');
                        (0, chai_1.expect)(mockNotificationService.showError).to.have.been.calledWith('Operation error: undefined');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('notification service integration', function () {
        it('should work without notification service for successful operations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ data: 'test' }));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'NO_NOTIF_SUCCESS')];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.deep.equal({ data: 'test' });
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [NO_NOTIF_SUCCESS] Operation successful');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should work without notification service for failed operations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.failure('Test failure'));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'NO_NOTIF_FAIL')];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.be.null;
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('⚠️ [NO_NOTIF_FAIL] Operation failed: Test failure');
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle notification service throwing errors gracefully', function () { return __awaiter(void 0, void 0, void 0, function () {
            var faultyNotificationService, operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        faultyNotificationService = {
                            showSuccess: testEnv.sandbox.stub().throws(new Error('Notification error')),
                            showError: testEnv.sandbox.stub(),
                            showWarning: testEnv.sandbox.stub(),
                        };
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ data: 'test' }));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'FAULTY_NOTIFICATION', 'Success message', faultyNotificationService)];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.deep.equal({ data: 'test' });
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [FAULTY_NOTIFICATION] Operation successful');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('performance considerations', function () {
        it('should handle large batch operations efficiently', function () { return __awaiter(void 0, void 0, void 0, function () {
            var operations, startTime, result, endTime;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        operations = Array.from({ length: 100 }, function (_, i) {
                            return testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success({ id: i }));
                        });
                        startTime = Date.now();
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleBatchOperations(operations, 'LARGE_BATCH')];
                    case 1:
                        result = _a.sent();
                        endTime = Date.now();
                        (0, chai_1.expect)(result.successful).to.have.length(100);
                        (0, chai_1.expect)(result.failed).to.have.length(0);
                        (0, chai_1.expect)(endTime - startTime).to.be.lessThan(1000); // Should complete within 1 second
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle operations with complex data structures', function () { return __awaiter(void 0, void 0, void 0, function () {
            var complexData, operation, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        complexData = {
                            terminal: {
                                id: 'complex-terminal-123',
                                config: {
                                    shell: '/bin/bash',
                                    args: ['--login'],
                                    env: { PATH: '/usr/bin:/bin' },
                                    features: ['scrollback', 'unicode', 'colors']
                                },
                                state: {
                                    isActive: true,
                                    lastActivity: new Date().toISOString(),
                                    scrollPosition: 0
                                }
                            }
                        };
                        operation = testEnv.sandbox.stub().resolves(OperationResultHandler_1.OperationResultHandler.success(complexData));
                        return [4 /*yield*/, OperationResultHandler_1.OperationResultHandler.handleTerminalOperation(operation, 'COMPLEX_DATA')];
                    case 1:
                        result = _a.sent();
                        (0, chai_1.expect)(result).to.deep.equal(complexData);
                        (0, chai_1.expect)(logSpy).to.have.been.calledWith('✅ [COMPLEX_DATA] Operation successful');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
