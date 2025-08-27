"use strict";
/**
 * 統一されたメッセージファクトリー
 *
 * Extension ↔ WebView 間の通信メッセージを一貫性をもって作成します。
 * 重複していたメッセージ構築パターンを統一します。
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageFactory = void 0;
/**
 * 統一されたメッセージファクトリー
 */
var MessageFactory = /** @class */ (function () {
    function MessageFactory() {
    }
    /**
     * 基本的なターミナルメッセージを作成
     */
    MessageFactory.createTerminalMessage = function (command, terminalId, additionalData) {
        if (additionalData === void 0) { additionalData = {}; }
        return __assign({ command: command, terminalId: terminalId, timestamp: Date.now() }, additionalData);
    };
    // === WebView → Extension メッセージ ===
    /**
     * ターミナル作成要求メッセージ
     */
    MessageFactory.createTerminalCreationRequest = function () {
        return this.createTerminalMessage('createTerminal');
    };
    /**
     * ターミナル削除要求メッセージ
     */
    MessageFactory.createTerminalDeletionRequest = function (terminalId, requestSource) {
        if (requestSource === void 0) { requestSource = 'panel'; }
        return this.createTerminalMessage('deleteTerminal', terminalId, {
            requestSource: requestSource,
        });
    };
    /**
     * ターミナル入力メッセージ
     */
    MessageFactory.createTerminalInputMessage = function (terminalId, data) {
        return this.createTerminalMessage('input', terminalId, { data: data });
    };
    /**
     * ターミナルリサイズメッセージ
     */
    MessageFactory.createTerminalResizeMessage = function (terminalId, cols, rows) {
        return this.createTerminalMessage('resize', terminalId, { cols: cols, rows: rows });
    };
    /**
     * フォーカス要求メッセージ
     */
    MessageFactory.createTerminalFocusMessage = function (terminalId) {
        return this.createTerminalMessage('focusTerminal', terminalId);
    };
    /**
     * 設定要求メッセージ
     */
    MessageFactory.createSettingsRequest = function () {
        return this.createTerminalMessage('getSettings');
    };
    /**
     * Scrollback データ要求メッセージ
     */
    MessageFactory.createScrollbackDataRequest = function (terminalId, scrollbackLines, maxLines) {
        return this.createTerminalMessage('getScrollbackData', terminalId, {
            scrollbackLines: scrollbackLines,
            maxLines: maxLines,
        });
    };
    /**
     * エラー報告メッセージ
     */
    MessageFactory.createErrorReport = function (context, message, stack, terminalId) {
        return this.createTerminalMessage('error', terminalId, {
            context: context,
            message: message,
            stack: stack,
        });
    };
    // === Extension → WebView メッセージ ===
    /**
     * ターミナル作成完了メッセージ
     */
    MessageFactory.createTerminalCreatedMessage = function (terminal, config) {
        return this.createTerminalMessage('terminalCreated', terminal.id, {
            terminalName: terminal.name,
            terminalInfo: {
                originalId: terminal.id,
                name: terminal.name,
                number: terminal.number,
                cwd: terminal.cwd || process.cwd(),
                isActive: terminal.isActive,
            },
            config: config,
        });
    };
    /**
     * ターミナル削除完了メッセージ
     */
    MessageFactory.createTerminalRemovedMessage = function (terminalId) {
        return this.createTerminalMessage('terminalRemoved', terminalId);
    };
    /**
     * ターミナル出力メッセージ
     */
    MessageFactory.createTerminalOutputMessage = function (terminalId, data) {
        return this.createTerminalMessage('output', terminalId, { data: data });
    };
    /**
     * ターミナル状態更新メッセージ
     */
    MessageFactory.createStateUpdateMessage = function (state, activeTerminalId) {
        return this.createTerminalMessage('stateUpdate', activeTerminalId, {
            state: state,
            activeTerminalId: activeTerminalId,
        });
    };
    /**
     * CLI Agent状態更新メッセージ
     */
    MessageFactory.createCliAgentStatusUpdate = function (activeTerminalName, status, agentType) {
        return this.createTerminalMessage('cliAgentStatusUpdate', undefined, {
            cliAgentStatus: {
                activeTerminalName: activeTerminalName,
                status: status,
                agentType: agentType,
            },
        });
    };
    /**
     * CLI Agent完全状態同期メッセージ
     */
    MessageFactory.createCliAgentFullStateSync = function (terminalStates, connectedAgentId, connectedAgentType, disconnectedCount) {
        return this.createTerminalMessage('cliAgentFullStateSync', undefined, {
            terminalStates: terminalStates,
            connectedAgentId: connectedAgentId,
            connectedAgentType: connectedAgentType,
            disconnectedCount: disconnectedCount,
        });
    };
    /**
     * 設定応答メッセージ
     */
    MessageFactory.createSettingsResponse = function (settings, fontSettings) {
        return this.createTerminalMessage('settingsResponse', undefined, {
            settings: settings,
            fontSettings: fontSettings,
        });
    };
    /**
     * Scrollback復元メッセージ
     */
    MessageFactory.createScrollbackRestoreMessage = function (terminalId, scrollbackContent) {
        return this.createTerminalMessage('restoreScrollback', terminalId, {
            scrollbackContent: scrollbackContent,
        });
    };
    /**
     * セッション復元完了メッセージ
     */
    MessageFactory.createSessionRestoreCompleted = function (restoredCount, skippedCount, partialSuccess) {
        if (skippedCount === void 0) { skippedCount = 0; }
        if (partialSuccess === void 0) { partialSuccess = false; }
        return this.createTerminalMessage('sessionRestoreCompleted', undefined, {
            restoredCount: restoredCount,
            skippedCount: skippedCount,
            partialSuccess: partialSuccess,
        });
    };
    /**
     * セッション復元エラーメッセージ
     */
    MessageFactory.createSessionRestoreError = function (error, errorType, recoveryAction) {
        if (errorType === void 0) { errorType = 'unknown'; }
        return this.createTerminalMessage('sessionRestoreError', undefined, {
            error: error,
            errorType: errorType,
            recoveryAction: recoveryAction,
        });
    };
    /**
     * 汎用エラーメッセージ
     */
    MessageFactory.createErrorMessage = function (message, context, terminalId) {
        return this.createTerminalMessage('error', terminalId, {
            message: message,
            context: context,
        });
    };
    // === ユーティリティメソッド ===
    /**
     * メッセージにリクエストIDを追加
     */
    MessageFactory.addRequestId = function (message, requestId) {
        return __assign(__assign({}, message), { requestId: requestId });
    };
    /**
     * メッセージのタイムスタンプを更新
     */
    MessageFactory.updateTimestamp = function (message) {
        return __assign(__assign({}, message), { timestamp: Date.now() });
    };
    /**
     * メッセージをクローンして変更
     */
    MessageFactory.cloneMessage = function (message, modifications) {
        if (modifications === void 0) { modifications = {}; }
        return __assign(__assign({}, message), modifications);
    };
    return MessageFactory;
}());
exports.MessageFactory = MessageFactory;
