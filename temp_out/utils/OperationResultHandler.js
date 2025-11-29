"use strict";
/**
 * 統一されたオペレーション結果処理ユーティリティ
 *
 * 重複していたエラーハンドリングパターンを統一し、
 * 一貫性のある成功/失敗処理を提供します。
 */
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
exports.OperationResultHandler = void 0;
var logger_1 = require("./logger");
/**
 * 統一されたオペレーション結果処理
 */
var OperationResultHandler = /** @class */ (function () {
    function OperationResultHandler() {
    }
    /**
     * ターミナル操作の結果を統一的に処理
     *
     * @param operation 実行するオペレーション
     * @param context ログ用のコンテキスト名
     * @param successMessage 成功時の通知メッセージ（省略時は通知なし）
     * @param notificationService 通知サービス（省略時は通知なし）
     * @returns 成功時はデータ、失敗時はnull
     */
    OperationResultHandler.handleTerminalOperation = function (operation, context, successMessage, notificationService) {
        return __awaiter(this, void 0, void 0, function () {
            var result, reason, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, operation()];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            (0, logger_1.extension)("\u2705 [".concat(context, "] Operation successful"));
                            if (successMessage && notificationService) {
                                notificationService.showSuccess(successMessage);
                            }
                            return [2 /*return*/, result.data || null];
                        }
                        else {
                            reason = result.reason || 'Operation failed';
                            (0, logger_1.extension)("\u26A0\uFE0F [".concat(context, "] Operation failed: ").concat(reason));
                            if (notificationService) {
                                notificationService.showError(reason);
                            }
                            return [2 /*return*/, null];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        errorMessage = "Operation error: ".concat(String(error_1));
                        (0, logger_1.extension)("\u274C [".concat(context, "] ").concat(errorMessage));
                        if (notificationService) {
                            notificationService.showError(errorMessage);
                        }
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 同期的なオペレーション結果処理
     */
    OperationResultHandler.handleSyncOperation = function (operation, context, successMessage, notificationService) {
        try {
            var result = operation();
            if (result.success) {
                (0, logger_1.extension)("\u2705 [".concat(context, "] Operation successful"));
                if (successMessage && notificationService) {
                    notificationService.showSuccess(successMessage);
                }
                return result.data || null;
            }
            else {
                var reason = result.reason || 'Operation failed';
                (0, logger_1.extension)("\u26A0\uFE0F [".concat(context, "] Operation failed: ").concat(reason));
                if (notificationService) {
                    notificationService.showError(reason);
                }
                return null;
            }
        }
        catch (error) {
            var errorMessage = "Operation error: ".concat(String(error));
            (0, logger_1.extension)("\u274C [".concat(context, "] ").concat(errorMessage));
            if (notificationService) {
                notificationService.showError(errorMessage);
            }
            return null;
        }
    };
    /**
     * 複数オペレーションのバッチ処理
     */
    OperationResultHandler.handleBatchOperations = function (operations, context, notificationService) {
        return __awaiter(this, void 0, void 0, function () {
            var successful, failed, i, operation, result, summary;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        successful = [];
                        failed = [];
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < operations.length)) return [3 /*break*/, 5];
                        operation = operations[i];
                        if (!operation) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.handleTerminalOperation(operation, "".concat(context, "-BATCH-").concat(i), undefined, undefined // バッチ処理では個別通知は行わない
                            )];
                    case 2:
                        result = _a.sent();
                        if (result !== null) {
                            successful.push(result);
                        }
                        else {
                            failed.push({ index: i, reason: 'Operation failed' });
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        failed.push({ index: i, reason: 'Invalid operation' });
                        _a.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 1];
                    case 5:
                        summary = "Batch operation completed: ".concat(successful.length, " successful, ").concat(failed.length, " failed");
                        (0, logger_1.extension)("\uD83D\uDCCA [".concat(context, "] ").concat(summary));
                        if (notificationService) {
                            if (failed.length === 0) {
                                notificationService.showSuccess("All ".concat(successful.length, " operations completed successfully"));
                            }
                            else if (successful.length === 0) {
                                notificationService.showError("All ".concat(failed.length, " operations failed"));
                            }
                            else {
                                notificationService.showWarning(summary);
                            }
                        }
                        return [2 /*return*/, { successful: successful, failed: failed }];
                }
            });
        });
    };
    /**
     * オペレーション結果を作成するヘルパー
     */
    OperationResultHandler.createResult = function (success, data, reason, error) {
        return { success: success, data: data, reason: reason, error: error };
    };
    /**
     * 成功結果を作成
     */
    OperationResultHandler.success = function (data) {
        return this.createResult(true, data);
    };
    /**
     * 失敗結果を作成
     */
    OperationResultHandler.failure = function (reason, error) {
        return this.createResult(false, undefined, reason, error);
    };
    return OperationResultHandler;
}());
exports.OperationResultHandler = OperationResultHandler;
