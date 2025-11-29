"use strict";
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
 * MessageFactory unit tests
 *
 * 統一されたメッセージファクトリーのテスト
 * Extension ↔ WebView 間の通信メッセージ作成機能を検証
 */
/* eslint-disable */
// @ts-nocheck
var chai_1 = require("chai");
var sinon_chai_1 = require("sinon-chai");
(0, chai_1.use)(sinon_chai_1.default);
var MessageFactory_1 = require("../../../messaging/MessageFactory");
var CommonTestSetup_1 = require("../../utils/CommonTestSetup");
describe('MessageFactory', function () {
    var testEnv;
    var mockTerminalInstance;
    var mockTerminalConfig;
    var mockTerminalState;
    beforeEach(function () {
        testEnv = (0, CommonTestSetup_1.setupTestEnvironment)();
        // Mock terminal instance
        mockTerminalInstance = {
            id: 'terminal-123',
            name: 'Terminal 1',
            number: 1,
            cwd: '/test/directory',
            isActive: true,
            pty: null,
        };
        // Mock terminal config
        mockTerminalConfig = {
            shell: '/bin/bash',
            shellArgs: ['--login'],
            cwd: '/test/directory',
            env: {},
            fontSize: 14,
            fontFamily: 'Monaco',
            theme: 'dark',
            cursorBlink: true,
            scrollback: 1000,
        };
        // Mock terminal state
        mockTerminalState = {
            terminals: [
                { id: 'terminal-1', name: 'Terminal 1', isActive: true },
                { id: 'terminal-2', name: 'Terminal 2', isActive: false },
            ],
            activeTerminalId: 'terminal-1',
            maxTerminals: 5,
            availableSlots: [3, 4, 5],
        };
    });
    afterEach(function () {
        (0, CommonTestSetup_1.cleanupTestEnvironment)(testEnv);
    });
    describe('createTerminalMessage', function () {
        it('should create basic terminal message with command', function () {
            var message = MessageFactory_1.MessageFactory.createTerminalMessage('createTerminal');
            (0, chai_1.expect)(message.command).to.equal('createTerminal');
            (0, chai_1.expect)(message.terminalId).to.be.undefined;
            (0, chai_1.expect)(message.timestamp).to.be.a('number');
            (0, chai_1.expect)(message.timestamp).to.be.closeTo(Date.now(), 100);
        });
        it('should create terminal message with terminalId', function () {
            var message = MessageFactory_1.MessageFactory.createTerminalMessage('deleteTerminal', 'terminal-456');
            (0, chai_1.expect)(message.command).to.equal('deleteTerminal');
            (0, chai_1.expect)(message.terminalId).to.equal('terminal-456');
            (0, chai_1.expect)(message.timestamp).to.be.a('number');
        });
        it('should create terminal message with additional data', function () {
            var additionalData = { data: 'test input', cols: 80, rows: 24 };
            var message = MessageFactory_1.MessageFactory.createTerminalMessage('input', 'terminal-789', additionalData);
            (0, chai_1.expect)(message.command).to.equal('input');
            (0, chai_1.expect)(message.terminalId).to.equal('terminal-789');
            (0, chai_1.expect)(message.data).to.equal('test input');
            (0, chai_1.expect)(message.cols).to.equal(80);
            (0, chai_1.expect)(message.rows).to.equal(24);
            (0, chai_1.expect)(message.timestamp).to.be.a('number');
        });
        it('should handle empty additional data object', function () {
            var message = MessageFactory_1.MessageFactory.createTerminalMessage('getSettings', undefined, {});
            (0, chai_1.expect)(message.command).to.equal('getSettings');
            (0, chai_1.expect)(message.terminalId).to.be.undefined;
            (0, chai_1.expect)(message.timestamp).to.be.a('number');
        });
    });
    describe('WebView → Extension message creation', function () {
        describe('createTerminalCreationRequest', function () {
            it('should create terminal creation request message', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalCreationRequest();
                (0, chai_1.expect)(message.command).to.equal('createTerminal');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
        });
        describe('createTerminalDeletionRequest', function () {
            it('should create terminal deletion request with default source', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalDeletionRequest('terminal-delete-123');
                (0, chai_1.expect)(message.command).to.equal('deleteTerminal');
                (0, chai_1.expect)(message.terminalId).to.equal('terminal-delete-123');
                (0, chai_1.expect)(message.requestSource).to.equal('panel');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create terminal deletion request with header source', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalDeletionRequest('terminal-delete-456', 'header');
                (0, chai_1.expect)(message.command).to.equal('deleteTerminal');
                (0, chai_1.expect)(message.terminalId).to.equal('terminal-delete-456');
                (0, chai_1.expect)(message.requestSource).to.equal('header');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
        });
        describe('createTerminalInputMessage', function () {
            it('should create terminal input message', function () {
                var inputData = 'ls -la\n';
                var message = MessageFactory_1.MessageFactory.createTerminalInputMessage('input-terminal-123', inputData);
                (0, chai_1.expect)(message.command).to.equal('input');
                (0, chai_1.expect)(message.terminalId).to.equal('input-terminal-123');
                (0, chai_1.expect)(message.data).to.equal(inputData);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should handle special characters in input', function () {
                var inputData = 'echo "Hello 世界! 🌍"\n';
                var message = MessageFactory_1.MessageFactory.createTerminalInputMessage('unicode-terminal', inputData);
                (0, chai_1.expect)(message.command).to.equal('input');
                (0, chai_1.expect)(message.terminalId).to.equal('unicode-terminal');
                (0, chai_1.expect)(message.data).to.equal(inputData);
            });
        });
        describe('createTerminalResizeMessage', function () {
            it('should create terminal resize message', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalResizeMessage('resize-terminal', 120, 30);
                (0, chai_1.expect)(message.command).to.equal('resize');
                (0, chai_1.expect)(message.terminalId).to.equal('resize-terminal');
                (0, chai_1.expect)(message.cols).to.equal(120);
                (0, chai_1.expect)(message.rows).to.equal(30);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should handle edge case dimensions', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalResizeMessage('edge-terminal', 1, 1);
                (0, chai_1.expect)(message.command).to.equal('resize');
                (0, chai_1.expect)(message.terminalId).to.equal('edge-terminal');
                (0, chai_1.expect)(message.cols).to.equal(1);
                (0, chai_1.expect)(message.rows).to.equal(1);
            });
        });
        describe('createTerminalFocusMessage', function () {
            it('should create terminal focus message', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalFocusMessage('focus-terminal-789');
                (0, chai_1.expect)(message.command).to.equal('focusTerminal');
                (0, chai_1.expect)(message.terminalId).to.equal('focus-terminal-789');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
        });
        describe('createSettingsRequest', function () {
            it('should create settings request message', function () {
                var message = MessageFactory_1.MessageFactory.createSettingsRequest();
                (0, chai_1.expect)(message.command).to.equal('getSettings');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
        });
        describe('createScrollbackDataRequest', function () {
            it('should create scrollback data request with parameters', function () {
                var message = MessageFactory_1.MessageFactory.createScrollbackDataRequest('scrollback-terminal', 500, 1000);
                (0, chai_1.expect)(message.command).to.equal('getScrollbackData');
                (0, chai_1.expect)(message.terminalId).to.equal('scrollback-terminal');
                (0, chai_1.expect)(message.scrollbackLines).to.equal(500);
                (0, chai_1.expect)(message.maxLines).to.equal(1000);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create scrollback data request without optional parameters', function () {
                var message = MessageFactory_1.MessageFactory.createScrollbackDataRequest('scrollback-terminal-2');
                (0, chai_1.expect)(message.command).to.equal('getScrollbackData');
                (0, chai_1.expect)(message.terminalId).to.equal('scrollback-terminal-2');
                (0, chai_1.expect)(message.scrollbackLines).to.be.undefined;
                (0, chai_1.expect)(message.maxLines).to.be.undefined;
            });
        });
        describe('createErrorReport', function () {
            it('should create error report with all parameters', function () {
                var stack = 'Error: Test error\n    at TestFunction (test.js:10:5)';
                var message = MessageFactory_1.MessageFactory.createErrorReport('TERMINAL_CREATION', 'Failed to create terminal', stack, 'error-terminal-123');
                (0, chai_1.expect)(message.command).to.equal('error');
                (0, chai_1.expect)(message.terminalId).to.equal('error-terminal-123');
                (0, chai_1.expect)(message.context).to.equal('TERMINAL_CREATION');
                (0, chai_1.expect)(message.message).to.equal('Failed to create terminal');
                (0, chai_1.expect)(message.stack).to.equal(stack);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create error report with minimal parameters', function () {
                var message = MessageFactory_1.MessageFactory.createErrorReport('GENERAL_ERROR', 'Something went wrong');
                (0, chai_1.expect)(message.command).to.equal('error');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.context).to.equal('GENERAL_ERROR');
                (0, chai_1.expect)(message.message).to.equal('Something went wrong');
                (0, chai_1.expect)(message.stack).to.be.undefined;
            });
        });
    });
    describe('Extension → WebView message creation', function () {
        describe('createTerminalCreatedMessage', function () {
            it('should create terminal created message', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalCreatedMessage(mockTerminalInstance, mockTerminalConfig);
                (0, chai_1.expect)(message.command).to.equal('terminalCreated');
                (0, chai_1.expect)(message.terminalId).to.equal('terminal-123');
                (0, chai_1.expect)(message.terminalName).to.equal('Terminal 1');
                (0, chai_1.expect)(message.terminalInfo).to.deep.include({
                    originalId: 'terminal-123',
                    name: 'Terminal 1',
                    number: 1,
                    cwd: '/test/directory',
                    isActive: true,
                });
                (0, chai_1.expect)(message.config).to.deep.equal(mockTerminalConfig);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should handle terminal instance without cwd', function () {
                var terminalWithoutCwd = __assign(__assign({}, mockTerminalInstance), { cwd: undefined });
                var message = MessageFactory_1.MessageFactory.createTerminalCreatedMessage(terminalWithoutCwd, mockTerminalConfig);
                (0, chai_1.expect)(message.terminalInfo.cwd).to.equal(process.cwd());
            });
        });
        describe('createTerminalRemovedMessage', function () {
            it('should create terminal removed message', function () {
                var message = MessageFactory_1.MessageFactory.createTerminalRemovedMessage('removed-terminal-456');
                (0, chai_1.expect)(message.command).to.equal('terminalRemoved');
                (0, chai_1.expect)(message.terminalId).to.equal('removed-terminal-456');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
        });
        describe('createTerminalOutputMessage', function () {
            it('should create terminal output message', function () {
                var outputData = 'user@host:~$ ls\nfile1.txt  file2.txt\n';
                var message = MessageFactory_1.MessageFactory.createTerminalOutputMessage('output-terminal-789', outputData);
                (0, chai_1.expect)(message.command).to.equal('output');
                (0, chai_1.expect)(message.terminalId).to.equal('output-terminal-789');
                (0, chai_1.expect)(message.data).to.equal(outputData);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should handle large output data', function () {
                var largeOutput = 'A'.repeat(10000);
                var message = MessageFactory_1.MessageFactory.createTerminalOutputMessage('large-output-terminal', largeOutput);
                (0, chai_1.expect)(message.command).to.equal('output');
                (0, chai_1.expect)(message.terminalId).to.equal('large-output-terminal');
                (0, chai_1.expect)(message.data).to.equal(largeOutput);
                (0, chai_1.expect)(message.data.length).to.equal(10000);
            });
        });
        describe('createStateUpdateMessage', function () {
            it('should create state update message with active terminal', function () {
                var message = MessageFactory_1.MessageFactory.createStateUpdateMessage(mockTerminalState, 'active-terminal-123');
                (0, chai_1.expect)(message.command).to.equal('stateUpdate');
                (0, chai_1.expect)(message.terminalId).to.equal('active-terminal-123');
                (0, chai_1.expect)(message.state).to.deep.equal(mockTerminalState);
                (0, chai_1.expect)(message.activeTerminalId).to.equal('active-terminal-123');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create state update message without active terminal', function () {
                var message = MessageFactory_1.MessageFactory.createStateUpdateMessage(mockTerminalState);
                (0, chai_1.expect)(message.command).to.equal('stateUpdate');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.state).to.deep.equal(mockTerminalState);
                (0, chai_1.expect)(message.activeTerminalId).to.be.undefined;
            });
        });
        describe('createCliAgentStatusUpdate', function () {
            it('should create CLI Agent status update for connected state', function () {
                var message = MessageFactory_1.MessageFactory.createCliAgentStatusUpdate('Terminal 1', 'connected', 'claude');
                (0, chai_1.expect)(message.command).to.equal('cliAgentStatusUpdate');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.cliAgentStatus).to.deep.equal({
                    activeTerminalName: 'Terminal 1',
                    status: 'connected',
                    agentType: 'claude',
                });
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create CLI Agent status update for disconnected state', function () {
                var message = MessageFactory_1.MessageFactory.createCliAgentStatusUpdate(null, 'disconnected', null);
                (0, chai_1.expect)(message.command).to.equal('cliAgentStatusUpdate');
                (0, chai_1.expect)(message.cliAgentStatus).to.deep.equal({
                    activeTerminalName: null,
                    status: 'disconnected',
                    agentType: null,
                });
            });
            it('should create CLI Agent status update for none state', function () {
                var message = MessageFactory_1.MessageFactory.createCliAgentStatusUpdate(null, 'none', null);
                (0, chai_1.expect)(message.command).to.equal('cliAgentStatusUpdate');
                (0, chai_1.expect)(message.cliAgentStatus).to.deep.equal({
                    activeTerminalName: null,
                    status: 'none',
                    agentType: null,
                });
            });
        });
        describe('createCliAgentFullStateSync', function () {
            it('should create CLI Agent full state sync message', function () {
                var terminalStates = {
                    'terminal-1': { status: 'connected', agentType: 'claude', terminalName: 'Terminal 1' },
                    'terminal-2': { status: 'disconnected', agentType: null, terminalName: 'Terminal 2' },
                };
                var message = MessageFactory_1.MessageFactory.createCliAgentFullStateSync(terminalStates, 'terminal-1', 'claude', 1);
                (0, chai_1.expect)(message.command).to.equal('cliAgentFullStateSync');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.terminalStates).to.deep.equal(terminalStates);
                (0, chai_1.expect)(message.connectedAgentId).to.equal('terminal-1');
                (0, chai_1.expect)(message.connectedAgentType).to.equal('claude');
                (0, chai_1.expect)(message.disconnectedCount).to.equal(1);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
        });
        describe('createSettingsResponse', function () {
            it('should create settings response with both settings and font settings', function () {
                var settings = { theme: 'dark', maxTerminals: 5 };
                var fontSettings = { fontFamily: 'Monaco', fontSize: 14 };
                var message = MessageFactory_1.MessageFactory.createSettingsResponse(settings, fontSettings);
                (0, chai_1.expect)(message.command).to.equal('settingsResponse');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.settings).to.deep.equal(settings);
                (0, chai_1.expect)(message.fontSettings).to.deep.equal(fontSettings);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create settings response with only settings', function () {
                var settings = { theme: 'light', showHeader: true };
                var message = MessageFactory_1.MessageFactory.createSettingsResponse(settings);
                (0, chai_1.expect)(message.command).to.equal('settingsResponse');
                (0, chai_1.expect)(message.settings).to.deep.equal(settings);
                (0, chai_1.expect)(message.fontSettings).to.be.undefined;
            });
        });
        describe('createScrollbackRestoreMessage', function () {
            it('should create scrollback restore message with structured content', function () {
                var scrollbackContent = [
                    { content: 'user@host:~$ ls', type: 'input', timestamp: 1634567890000 },
                    { content: 'file1.txt  file2.txt', type: 'output', timestamp: 1634567891000 },
                    { content: 'command not found: xyz', type: 'error', timestamp: 1634567892000 },
                ];
                var message = MessageFactory_1.MessageFactory.createScrollbackRestoreMessage('scrollback-terminal', scrollbackContent);
                (0, chai_1.expect)(message.command).to.equal('restoreScrollback');
                (0, chai_1.expect)(message.terminalId).to.equal('scrollback-terminal');
                (0, chai_1.expect)(message.scrollbackContent).to.deep.equal(scrollbackContent);
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create scrollback restore message with string array content', function () {
                var scrollbackContent = ['line 1', 'line 2', 'line 3'];
                var message = MessageFactory_1.MessageFactory.createScrollbackRestoreMessage('simple-scrollback-terminal', scrollbackContent);
                (0, chai_1.expect)(message.command).to.equal('restoreScrollback');
                (0, chai_1.expect)(message.terminalId).to.equal('simple-scrollback-terminal');
                (0, chai_1.expect)(message.scrollbackContent).to.deep.equal(scrollbackContent);
            });
        });
        describe('createSessionRestoreCompleted', function () {
            it('should create session restore completed message with success', function () {
                var message = MessageFactory_1.MessageFactory.createSessionRestoreCompleted(3, 0, false);
                (0, chai_1.expect)(message.command).to.equal('sessionRestoreCompleted');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.restoredCount).to.equal(3);
                (0, chai_1.expect)(message.skippedCount).to.equal(0);
                (0, chai_1.expect)(message.partialSuccess).to.be.false;
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create session restore completed message with partial success', function () {
                var message = MessageFactory_1.MessageFactory.createSessionRestoreCompleted(2, 1, true);
                (0, chai_1.expect)(message.command).to.equal('sessionRestoreCompleted');
                (0, chai_1.expect)(message.restoredCount).to.equal(2);
                (0, chai_1.expect)(message.skippedCount).to.equal(1);
                (0, chai_1.expect)(message.partialSuccess).to.be.true;
            });
            it('should use default values for optional parameters', function () {
                var message = MessageFactory_1.MessageFactory.createSessionRestoreCompleted(5);
                (0, chai_1.expect)(message.restoredCount).to.equal(5);
                (0, chai_1.expect)(message.skippedCount).to.equal(0);
                (0, chai_1.expect)(message.partialSuccess).to.be.false;
            });
        });
        describe('createSessionRestoreError', function () {
            it('should create session restore error message with all parameters', function () {
                var message = MessageFactory_1.MessageFactory.createSessionRestoreError('Database connection failed', 'connection_error', 'Check network connectivity');
                (0, chai_1.expect)(message.command).to.equal('sessionRestoreError');
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
                (0, chai_1.expect)(message.error).to.equal('Database connection failed');
                (0, chai_1.expect)(message.errorType).to.equal('connection_error');
                (0, chai_1.expect)(message.recoveryAction).to.equal('Check network connectivity');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create session restore error message with minimal parameters', function () {
                var message = MessageFactory_1.MessageFactory.createSessionRestoreError('Generic error');
                (0, chai_1.expect)(message.command).to.equal('sessionRestoreError');
                (0, chai_1.expect)(message.error).to.equal('Generic error');
                (0, chai_1.expect)(message.errorType).to.equal('unknown');
                (0, chai_1.expect)(message.recoveryAction).to.be.undefined;
            });
        });
        describe('createErrorMessage', function () {
            it('should create error message with all parameters', function () {
                var message = MessageFactory_1.MessageFactory.createErrorMessage('Terminal creation failed', 'TERMINAL_MANAGER', 'error-terminal-id');
                (0, chai_1.expect)(message.command).to.equal('error');
                (0, chai_1.expect)(message.terminalId).to.equal('error-terminal-id');
                (0, chai_1.expect)(message.message).to.equal('Terminal creation failed');
                (0, chai_1.expect)(message.context).to.equal('TERMINAL_MANAGER');
                (0, chai_1.expect)(message.timestamp).to.be.a('number');
            });
            it('should create error message with minimal parameters', function () {
                var message = MessageFactory_1.MessageFactory.createErrorMessage('Generic error occurred');
                (0, chai_1.expect)(message.command).to.equal('error');
                (0, chai_1.expect)(message.message).to.equal('Generic error occurred');
                (0, chai_1.expect)(message.context).to.be.undefined;
                (0, chai_1.expect)(message.terminalId).to.be.undefined;
            });
        });
    });
    describe('utility methods', function () {
        describe('addRequestId', function () {
            it('should add request ID to message', function () {
                var originalMessage = MessageFactory_1.MessageFactory.createTerminalCreationRequest();
                var messageWithRequestId = MessageFactory_1.MessageFactory.addRequestId(originalMessage, 'req-123-456');
                (0, chai_1.expect)(messageWithRequestId.requestId).to.equal('req-123-456');
                (0, chai_1.expect)(messageWithRequestId.command).to.equal(originalMessage.command);
                (0, chai_1.expect)(messageWithRequestId.timestamp).to.equal(originalMessage.timestamp);
            });
            it('should preserve all original message properties', function () {
                var originalMessage = MessageFactory_1.MessageFactory.createTerminalInputMessage('terminal-789', 'test input');
                var messageWithRequestId = MessageFactory_1.MessageFactory.addRequestId(originalMessage, 'req-789');
                (0, chai_1.expect)(messageWithRequestId.requestId).to.equal('req-789');
                (0, chai_1.expect)(messageWithRequestId.command).to.equal('input');
                (0, chai_1.expect)(messageWithRequestId.terminalId).to.equal('terminal-789');
                (0, chai_1.expect)(messageWithRequestId.data).to.equal('test input');
            });
        });
        describe('updateTimestamp', function () {
            it('should update message timestamp', function () { return __awaiter(void 0, void 0, void 0, function () {
                var originalMessage, originalTimestamp, updatedMessage;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            originalMessage = MessageFactory_1.MessageFactory.createSettingsRequest();
                            originalTimestamp = originalMessage.timestamp;
                            // Wait a bit to ensure timestamp difference
                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1); })];
                        case 1:
                            // Wait a bit to ensure timestamp difference
                            _a.sent();
                            updatedMessage = MessageFactory_1.MessageFactory.updateTimestamp(originalMessage);
                            (0, chai_1.expect)(updatedMessage.timestamp).to.be.greaterThan(originalTimestamp);
                            (0, chai_1.expect)(updatedMessage.command).to.equal(originalMessage.command);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should preserve all other message properties', function () {
                var originalMessage = MessageFactory_1.MessageFactory.createTerminalOutputMessage('terminal-update', 'output data');
                var updatedMessage = MessageFactory_1.MessageFactory.updateTimestamp(originalMessage);
                (0, chai_1.expect)(updatedMessage.command).to.equal('output');
                (0, chai_1.expect)(updatedMessage.terminalId).to.equal('terminal-update');
                (0, chai_1.expect)(updatedMessage.data).to.equal('output data');
                (0, chai_1.expect)(updatedMessage.timestamp).to.be.a('number');
            });
        });
        describe('cloneMessage', function () {
            it('should clone message without modifications', function () {
                var originalMessage = MessageFactory_1.MessageFactory.createTerminalResizeMessage('resize-test', 100, 25);
                var clonedMessage = MessageFactory_1.MessageFactory.cloneMessage(originalMessage);
                (0, chai_1.expect)(clonedMessage).to.deep.equal(originalMessage);
                (0, chai_1.expect)(clonedMessage).not.to.equal(originalMessage); // Different object reference
            });
            it('should clone message with modifications', function () {
                var originalMessage = MessageFactory_1.MessageFactory.createTerminalFocusMessage('focus-original');
                var modifications = { terminalId: 'focus-modified', extraProperty: 'test' };
                var modifiedMessage = MessageFactory_1.MessageFactory.cloneMessage(originalMessage, modifications);
                (0, chai_1.expect)(modifiedMessage.command).to.equal('focusTerminal');
                (0, chai_1.expect)(modifiedMessage.terminalId).to.equal('focus-modified');
                (0, chai_1.expect)(modifiedMessage.extraProperty).to.equal('test');
                (0, chai_1.expect)(modifiedMessage.timestamp).to.equal(originalMessage.timestamp);
            });
            it('should handle complex modifications', function () {
                var originalMessage = MessageFactory_1.MessageFactory.createStateUpdateMessage(mockTerminalState);
                var modifications = {
                    state: __assign(__assign({}, mockTerminalState), { maxTerminals: 10 }),
                    activeTerminalId: 'new-active-terminal',
                    newField: { nested: { value: 'test' } },
                };
                var modifiedMessage = MessageFactory_1.MessageFactory.cloneMessage(originalMessage, modifications);
                (0, chai_1.expect)(modifiedMessage.command).to.equal('stateUpdate');
                (0, chai_1.expect)(modifiedMessage.state.maxTerminals).to.equal(10);
                (0, chai_1.expect)(modifiedMessage.activeTerminalId).to.equal('new-active-terminal');
                (0, chai_1.expect)(modifiedMessage.newField.nested.value).to.equal('test');
            });
        });
    });
    describe('parameter validation and edge cases', function () {
        it('should handle empty string terminal IDs', function () {
            var message = MessageFactory_1.MessageFactory.createTerminalDeletionRequest('');
            (0, chai_1.expect)(message.command).to.equal('deleteTerminal');
            (0, chai_1.expect)(message.terminalId).to.equal('');
            (0, chai_1.expect)(message.requestSource).to.equal('panel');
        });
        it('should handle very long terminal IDs', function () {
            var longTerminalId = 'terminal-' + 'x'.repeat(1000);
            var message = MessageFactory_1.MessageFactory.createTerminalFocusMessage(longTerminalId);
            (0, chai_1.expect)(message.command).to.equal('focusTerminal');
            (0, chai_1.expect)(message.terminalId).to.equal(longTerminalId);
            (0, chai_1.expect)(message.terminalId.length).to.equal(1009);
        });
        it('should handle special characters in data', function () {
            var specialData = 'echo "Hello\nWorld\t\u0001\u001b[31mRed\u001b[0m"';
            var message = MessageFactory_1.MessageFactory.createTerminalInputMessage('special-terminal', specialData);
            (0, chai_1.expect)(message.command).to.equal('input');
            (0, chai_1.expect)(message.terminalId).to.equal('special-terminal');
            (0, chai_1.expect)(message.data).to.equal(specialData);
        });
        it('should handle zero and negative dimensions in resize', function () {
            var message = MessageFactory_1.MessageFactory.createTerminalResizeMessage('dimension-test', 0, -1);
            (0, chai_1.expect)(message.command).to.equal('resize');
            (0, chai_1.expect)(message.terminalId).to.equal('dimension-test');
            (0, chai_1.expect)(message.cols).to.equal(0);
            (0, chai_1.expect)(message.rows).to.equal(-1);
        });
        it('should handle empty scrollback content arrays', function () {
            var message = MessageFactory_1.MessageFactory.createScrollbackRestoreMessage('empty-scrollback', []);
            (0, chai_1.expect)(message.command).to.equal('restoreScrollback');
            (0, chai_1.expect)(message.terminalId).to.equal('empty-scrollback');
            (0, chai_1.expect)(message.scrollbackContent).to.deep.equal([]);
        });
        it('should handle null and undefined values in terminal states', function () {
            var terminalStatesWithNulls = {
                'terminal-null': { status: 'none', agentType: null, terminalName: 'Terminal Null' },
            };
            var message = MessageFactory_1.MessageFactory.createCliAgentFullStateSync(terminalStatesWithNulls, null, null, 0);
            (0, chai_1.expect)(message.command).to.equal('cliAgentFullStateSync');
            (0, chai_1.expect)(message.terminalStates).to.deep.equal(terminalStatesWithNulls);
            (0, chai_1.expect)(message.connectedAgentId).to.be.null;
            (0, chai_1.expect)(message.connectedAgentType).to.be.null;
            (0, chai_1.expect)(message.disconnectedCount).to.equal(0);
        });
    });
    describe('message consistency and format validation', function () {
        it('should ensure all messages have consistent timestamp format', function () {
            var messages = [
                MessageFactory_1.MessageFactory.createTerminalCreationRequest(),
                MessageFactory_1.MessageFactory.createTerminalDeletionRequest('test-terminal'),
                MessageFactory_1.MessageFactory.createTerminalInputMessage('test-terminal', 'test'),
                MessageFactory_1.MessageFactory.createSettingsRequest(),
                MessageFactory_1.MessageFactory.createTerminalCreatedMessage(mockTerminalInstance, mockTerminalConfig),
                MessageFactory_1.MessageFactory.createStateUpdateMessage(mockTerminalState),
            ];
            messages.forEach(function (message, index) {
                (0, chai_1.expect)(message.timestamp, "Message ".concat(index, " should have timestamp")).to.be.a('number');
                (0, chai_1.expect)(message.timestamp, "Message ".concat(index, " timestamp should be recent")).to.be.closeTo(Date.now(), 1000);
            });
        });
        it('should ensure command field is always present and valid', function () {
            var messages = [
                MessageFactory_1.MessageFactory.createTerminalCreationRequest(),
                MessageFactory_1.MessageFactory.createErrorReport('TEST', 'test error'),
                MessageFactory_1.MessageFactory.createScrollbackRestoreMessage('test', []),
                MessageFactory_1.MessageFactory.createCliAgentStatusUpdate(null, 'none', null),
            ];
            messages.forEach(function (message, index) {
                (0, chai_1.expect)(message.command, "Message ".concat(index, " should have command")).to.be.a('string');
                (0, chai_1.expect)(message.command, "Message ".concat(index, " command should not be empty")).to.not.be.empty;
            });
        });
        it('should ensure type safety for different message types', function () {
            // VsCode messages (WebView → Extension)
            var vsCodeMessage = MessageFactory_1.MessageFactory.createTerminalCreationRequest();
            (0, chai_1.expect)(vsCodeMessage).to.have.property('command');
            (0, chai_1.expect)(vsCodeMessage).to.have.property('timestamp');
            // WebView messages (Extension → WebView)
            var webViewMessage = MessageFactory_1.MessageFactory.createTerminalCreatedMessage(mockTerminalInstance, mockTerminalConfig);
            (0, chai_1.expect)(webViewMessage).to.have.property('command');
            (0, chai_1.expect)(webViewMessage).to.have.property('timestamp');
            (0, chai_1.expect)(webViewMessage).to.have.property('terminalName');
        });
    });
});
