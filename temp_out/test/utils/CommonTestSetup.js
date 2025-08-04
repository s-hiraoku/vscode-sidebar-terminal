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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMockTerminalManagerForCliAgent = exports.createMockCliAgentDetectionService = exports.setupCliAgentTestPatterns = exports.setupTerminalTestMocks = exports.setupCliAgentTestMocks = exports.cleanupTestEnvironment = exports.setupTestEnvironment = exports.cleanupGlobalDOM = exports.setupGlobalDOM = exports.createTestDOMEnvironment = exports.setupProcessMock = exports.setupVSCodeMock = void 0;
/**
 * Common test setup utilities to reduce code duplication across test files
 */
var sinon = require("sinon");
var jsdom_1 = require("jsdom");
/**
 * Standard VS Code API mock setup
 */
var setupVSCodeMock = function () {
    if (typeof global.vscode === 'undefined') {
        global.vscode = {
            workspace: {
                getConfiguration: function () { return ({ get: function () { return undefined; } }); },
            },
        };
    }
};
exports.setupVSCodeMock = setupVSCodeMock;
/**
 * Standard process mock setup for test environment
 */
var setupProcessMock = function () {
    var originalProcess = global.process;
    global.process = __assign(__assign({}, originalProcess), { nextTick: function (callback) { return setImmediate(callback); }, env: __assign(__assign({}, originalProcess.env), { NODE_ENV: 'test' }) });
};
exports.setupProcessMock = setupProcessMock;
/**
 * Create a standard JSDOM environment with notification container
 */
var createTestDOMEnvironment = function (withNotificationContainer) {
    if (withNotificationContainer === void 0) { withNotificationContainer = false; }
    var htmlContent = withNotificationContainer
        ? "<!DOCTYPE html>\n       <html>\n         <body>\n           <div id=\"notification-container\"></div>\n         </body>\n       </html>"
        : '<!DOCTYPE html><html><body></body></html>';
    return new jsdom_1.JSDOM(htmlContent);
};
exports.createTestDOMEnvironment = createTestDOMEnvironment;
/**
 * Setup global DOM objects
 */
var setupGlobalDOM = function (dom) {
    var document = dom.window.document;
    global.document = document;
    global.window = dom.window;
    global.HTMLElement = dom.window.HTMLElement;
    global.getComputedStyle = dom.window.getComputedStyle;
};
exports.setupGlobalDOM = setupGlobalDOM;
/**
 * Cleanup global DOM objects
 */
var cleanupGlobalDOM = function () {
    delete global.document;
    delete global.window;
    delete global.HTMLElement;
    delete global.getComputedStyle;
};
exports.cleanupGlobalDOM = cleanupGlobalDOM;
/**
 * Complete test environment setup
 */
var setupTestEnvironment = function (options) {
    if (options === void 0) { options = {}; }
    var _a = options.withClock, withClock = _a === void 0 ? false : _a, _b = options.withNotificationContainer, withNotificationContainer = _b === void 0 ? false : _b;
    // Setup mocks
    (0, exports.setupVSCodeMock)();
    (0, exports.setupProcessMock)();
    // Create DOM environment
    var dom = (0, exports.createTestDOMEnvironment)(withNotificationContainer);
    (0, exports.setupGlobalDOM)(dom);
    // Create sandbox and optional clock
    var sandbox = sinon.createSandbox();
    var clock = withClock ? sinon.useFakeTimers() : undefined;
    return {
        dom: dom,
        document: dom.window.document,
        sandbox: sandbox,
        clock: clock,
    };
};
exports.setupTestEnvironment = setupTestEnvironment;
/**
 * Complete test environment cleanup
 */
var cleanupTestEnvironment = function (env) {
    if (env.clock) {
        env.clock.restore();
    }
    env.sandbox.restore();
    (0, exports.cleanupGlobalDOM)();
};
exports.cleanupTestEnvironment = cleanupTestEnvironment;
/**
 * Common CLI Agent test setup - Mock CLI Agent detection patterns
 */
var setupCliAgentTestMocks = function (sandbox) {
    // Mock data patterns for CLI Agent tests
    var mockCliAgentPatterns = {
        claudePrompt: '> claude-code "',
        geminiPrompt: '> gemini code "',
        claudeComplete: 'Claude Code task completed successfully',
        geminiComplete: 'Gemini Code task completed successfully',
    };
    // Common CLI Agent status mock
    var mockCliAgentStatus = {
        isActive: false,
        activeAgent: null,
        lastActivity: Date.now(),
    };
    return {
        mockCliAgentPatterns: mockCliAgentPatterns,
        mockCliAgentStatus: mockCliAgentStatus,
    };
};
exports.setupCliAgentTestMocks = setupCliAgentTestMocks;
/**
 * Common terminal test setup - Mock terminal states and data
 */
var setupTerminalTestMocks = function (sandbox) {
    // Mock terminal data
    var mockTerminalData = {
        terminalId: 'test-terminal-1',
        processId: 12345,
        title: 'Test Terminal',
        isActive: true,
        scrollbackBuffer: ['test line 1', 'test line 2', 'test line 3'],
    };
    // Mock terminal manager state
    var mockTerminalManagerState = {
        terminals: new Map(),
        activeTerminalId: 'test-terminal-1',
        terminalCount: 1,
    };
    return {
        mockTerminalData: mockTerminalData,
        mockTerminalManagerState: mockTerminalManagerState,
    };
};
exports.setupTerminalTestMocks = setupTerminalTestMocks;
/**
 * CLI Agent specific test patterns and mocks
 */
var setupCliAgentTestPatterns = function () {
    // Standard shell prompts for termination detection
    var validPromptPatterns = [
        // Standard bash/zsh prompts
        'user@hostname:~/path$',
        'user@hostname:~/path$  ',
        'user@hostname:~/workspace/project$',
        'root@server:/home#',
        // Oh-My-Zsh themes
        '➜ myproject',
        '➜  workspace',
        // Starship prompt
        '❯',
        '❯ ',
        '❯   ',
        // PowerShell
        'PS C:\\Users\\User>',
        'PS /home/user>',
        // Fish shell
        'user workspace>',
        'user ~/Documents/projects>',
        // Simple prompts
        '$',
        '$ ',
        '#',
        '# ',
        '>',
        '> ',
    ];
    // CLI Agent command patterns
    var cliAgentCommands = {
        claude: [
            'claude-code "help"',
            'claude-code "fix the bug"',
            'claude-code "refactor this function"',
        ],
        gemini: ['gemini code "analyze"', 'gemini code "optimize"', 'gemini code "test"'],
    };
    // CLI Agent completion patterns
    var completionPatterns = [
        'Claude Code task completed successfully',
        'Gemini Code task completed successfully',
        'Task completed.',
        'Done.',
    ];
    // False positive patterns that should NOT trigger CLI Agent detection
    var falsePositivePatterns = [
        'echo "claude-code test"',
        'cat file_with_claude_in_name.txt',
        'grep "gemini" logs.txt',
        'ls -la',
        'npm install',
        'git status',
    ];
    return {
        validPromptPatterns: validPromptPatterns,
        cliAgentCommands: cliAgentCommands,
        completionPatterns: completionPatterns,
        falsePositivePatterns: falsePositivePatterns,
    };
};
exports.setupCliAgentTestPatterns = setupCliAgentTestPatterns;
/**
 * Mock CLI Agent detection service for testing
 */
var createMockCliAgentDetectionService = function (sandbox) {
    var mockService = {
        isCliAgentActive: sandbox.stub(),
        detectCliAgentActivity: sandbox.stub(),
        getActiveAgent: sandbox.stub(),
        resetDetection: sandbox.stub(),
        getDetectionStats: sandbox.stub(),
    };
    // Default behavior
    mockService.isCliAgentActive.returns(false);
    mockService.getActiveAgent.returns(null);
    mockService.getDetectionStats.returns({
        totalDetections: 0,
        falsePositives: 0,
        successfulTerminations: 0,
    });
    return mockService;
};
exports.createMockCliAgentDetectionService = createMockCliAgentDetectionService;
/**
 * Setup mock terminal manager for CLI Agent tests
 */
var setupMockTerminalManagerForCliAgent = function (sandbox) {
    var mockTerminalManager = {
        createTerminal: sandbox.stub(),
        killTerminal: sandbox.stub(),
        deleteTerminal: sandbox.stub(),
        getActiveTerminal: sandbox.stub(),
        getAllTerminals: sandbox.stub(),
        focusTerminal: sandbox.stub(),
        sendData: sandbox.stub(),
        dispose: sandbox.stub(),
        // CLI Agent specific methods
        getTerminalById: sandbox.stub(),
        isTerminalActive: sandbox.stub(),
        getTerminalCount: sandbox.stub(),
    };
    // Default return values
    mockTerminalManager.getActiveTerminal.returns({
        id: 'test-terminal-1',
        title: 'Terminal 1',
        isActive: true,
    });
    mockTerminalManager.getAllTerminals.returns([
        {
            id: 'test-terminal-1',
            title: 'Terminal 1',
            isActive: true,
        },
    ]);
    mockTerminalManager.getTerminalCount.returns(1);
    mockTerminalManager.isTerminalActive.returns(true);
    return mockTerminalManager;
};
exports.setupMockTerminalManagerForCliAgent = setupMockTerminalManagerForCliAgent;
