/**
 * Common test setup utilities to reduce code duplication across test files
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import * as sinon from 'sinon';
import { JSDOM } from 'jsdom';

export interface TestEnvironment {
  dom: JSDOM;
  document: Document;
  sandbox: sinon.SinonSandbox;
  clock?: sinon.SinonFakeTimers;
}

/**
 * Standard VS Code API mock setup
 * IMPORTANT: Always reset vscode mock to avoid conflicts with global TestSetup stubs
 */
export const setupVSCodeMock = (): void => {
  // Delete existing vscode mock to avoid "already stubbed" errors
  delete (global as any).vscode;

  // Create fresh mock
  (global as any).vscode = {
    workspace: {
      getConfiguration: () => ({ get: () => undefined }),
    },
  };
};

/**
 * Standard process mock setup for test environment
 * IMPORTANT: Don't overwrite process completely to preserve EventEmitter methods
 */
export const setupProcessMock = (): void => {
  const originalProcess = global.process;

  // Don't overwrite process - just modify properties to avoid breaking EventEmitter methods
  if (!originalProcess.nextTick || typeof originalProcess.nextTick !== 'function') {
    (originalProcess as any).nextTick = (callback: () => void) => setImmediate(callback);
  }
  if (!originalProcess.env.NODE_ENV) {
    originalProcess.env.NODE_ENV = 'test';
  }
};

/**
 * Create a standard JSDOM environment with notification container
 */
export const createTestDOMEnvironment = (withNotificationContainer = false): JSDOM => {
  const htmlContent = withNotificationContainer
    ? `<!DOCTYPE html>
       <html>
         <body>
           <div id="notification-container"></div>
         </body>
       </html>`
    : '<!DOCTYPE html><html><body></body></html>';

  return new JSDOM(htmlContent);
};

/**
 * Setup global DOM objects
 */
export const setupGlobalDOM = (dom: JSDOM): void => {
  const document = dom.window.document;
  (global as Record<string, unknown>).document = document;
  (global as Record<string, unknown>).window = dom.window;
  (global as Record<string, unknown>).HTMLElement = dom.window.HTMLElement;
  (global as Record<string, unknown>).getComputedStyle = dom.window.getComputedStyle;
};

/**
 * Cleanup global DOM objects
 */
export const cleanupGlobalDOM = (): void => {
  delete (global as Record<string, unknown>).document;
  delete (global as Record<string, unknown>).window;
  delete (global as Record<string, unknown>).HTMLElement;
  delete (global as Record<string, unknown>).getComputedStyle;
};

/**
 * Complete test environment setup
 */
export const setupTestEnvironment = (
  options: {
    withClock?: boolean;
    withNotificationContainer?: boolean;
  } = {}
): TestEnvironment => {
  const { withClock = false, withNotificationContainer = false } = options;

  // Setup mocks
  setupVSCodeMock();
  setupProcessMock();

  // Create DOM environment
  const dom = createTestDOMEnvironment(withNotificationContainer);
  setupGlobalDOM(dom);

  // Create sandbox and optional clock
  const sandbox = sinon.createSandbox();
  const clock = withClock ? sinon.useFakeTimers() : undefined;

  return {
    dom,
    document: dom.window.document,
    sandbox,
    clock,
  };
};

/**
 * Complete test environment cleanup
 */
export const cleanupTestEnvironment = (env: TestEnvironment): void => {
  if (env.clock) {
    env.clock.restore();
  }
  env.sandbox.restore();
  cleanupGlobalDOM();
};

/**
 * Common CLI Agent test setup - Mock CLI Agent detection patterns
 */
export const setupCliAgentTestMocks = (
  sandbox: sinon.SinonSandbox
): {
  mockCliAgentPatterns: Record<string, string>;
  mockCliAgentStatus: Record<string, unknown>;
} => {
  // Mock data patterns for CLI Agent tests
  const mockCliAgentPatterns = {
    claudePrompt: '> claude-code "',
    geminiPrompt: '> gemini code "',
    claudeComplete: 'Claude Code task completed successfully',
    geminiComplete: 'Gemini Code task completed successfully',
  };

  // Common CLI Agent status mock
  const mockCliAgentStatus = {
    isActive: false,
    activeAgent: null,
    lastActivity: Date.now(),
  };

  return {
    mockCliAgentPatterns,
    mockCliAgentStatus,
  };
};

/**
 * Common terminal test setup - Mock terminal states and data
 */
export const setupTerminalTestMocks = (
  sandbox: sinon.SinonSandbox
): {
  mockTerminalData: Record<string, unknown>;
  mockTerminalManagerState: Record<string, unknown>;
} => {
  // Mock terminal data
  const mockTerminalData = {
    terminalId: 'test-terminal-1',
    processId: 12345,
    title: 'Test Terminal',
    isActive: true,
    scrollbackBuffer: ['test line 1', 'test line 2', 'test line 3'],
  };

  // Mock terminal manager state
  const mockTerminalManagerState = {
    terminals: new Map(),
    activeTerminalId: 'test-terminal-1',
    terminalCount: 1,
  };

  return {
    mockTerminalData,
    mockTerminalManagerState,
  };
};

/**
 * CLI Agent specific test patterns and mocks
 */
export const setupCliAgentTestPatterns = (): {
  validPromptPatterns: string[];
  cliAgentCommands: Record<string, string[]>;
  completionPatterns: string[];
  falsePositivePatterns: string[];
} => {
  // Standard shell prompts for termination detection
  const validPromptPatterns = [
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
  const cliAgentCommands = {
    claude: [
      'claude-code "help"',
      'claude-code "fix the bug"',
      'claude-code "refactor this function"',
    ],
    gemini: ['gemini code "analyze"', 'gemini code "optimize"', 'gemini code "test"'],
  };

  // CLI Agent completion patterns
  const completionPatterns = [
    'Claude Code task completed successfully',
    'Gemini Code task completed successfully',
    'Task completed.',
    'Done.',
  ];

  // False positive patterns that should NOT trigger CLI Agent detection
  const falsePositivePatterns = [
    'echo "claude-code test"',
    'cat file_with_claude_in_name.txt',
    'grep "gemini" logs.txt',
    'ls -la',
    'npm install',
    'git status',
  ];

  return {
    validPromptPatterns,
    cliAgentCommands,
    completionPatterns,
    falsePositivePatterns,
  };
};

/**
 * Mock CLI Agent detection service for testing
 */
export const createMockCliAgentDetectionService = (
  sandbox: sinon.SinonSandbox
): Record<string, sinon.SinonStub> => {
  const mockService = {
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

/**
 * Setup mock terminal manager for CLI Agent tests
 */
export const setupMockTerminalManagerForCliAgent = (
  sandbox: sinon.SinonSandbox
): Record<string, sinon.SinonStub> => {
  const mockTerminalManager = {
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
