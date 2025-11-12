/**
 * Unit tests for ExtensionPersistenceService
 *
 * Tests the consolidated Extension-side persistence service that replaced
 * multiple legacy implementations.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { ExtensionPersistenceService } from '../../../services/ExtensionPersistenceService';
import { TerminalManager } from '../../../terminals/TerminalManager';
import { PERSISTENCE_CONSTANTS } from '../../../types/Persistence';

suite('ExtensionPersistenceService Tests', () => {
  let service: ExtensionPersistenceService;
  let context: vscode.ExtensionContext;
  let terminalManager: TerminalManager;
  let mockGlobalState: Map<string, any>;

  setup(() => {
    mockGlobalState = new Map();

    // Create mock context
    context = {
      globalState: {
        get: (key: string) => mockGlobalState.get(key),
        update: (key: string, value: any) => {
          mockGlobalState.set(key, value);
          return Promise.resolve();
        },
      },
      subscriptions: [],
    } as any;

    terminalManager = new TerminalManager();
    service = new ExtensionPersistenceService(context, terminalManager);
  });

  teardown(() => {
    service.dispose();
  });

  test('should initialize successfully', () => {
    assert.ok(service, 'Service should be created');
  });

  test('should save empty session when no terminals exist', async () => {
    const result = await service.saveCurrentSession();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.terminalCount, 0);
  });

  test('should save session with terminals', async () => {
    // Create test terminals
    const terminal1 = terminalManager.createTerminal();
    const terminal2 = terminalManager.createTerminal();

    const result = await service.saveCurrentSession();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.terminalCount, 2);
  });

  test('should retrieve session info after save', async () => {
    // Create and save terminals
    terminalManager.createTerminal();
    await service.saveCurrentSession();

    const sessionInfo = service.getSessionInfo();

    assert.ok(sessionInfo);
    assert.strictEqual(sessionInfo.exists, true);
    assert.ok(sessionInfo.terminals);
    assert.strictEqual(sessionInfo.terminals.length, 1);
  });

  test('should return null session info when no session exists', () => {
    const sessionInfo = service.getSessionInfo();

    assert.ok(sessionInfo);
    assert.strictEqual(sessionInfo.exists, false);
  });

  test('should clear session successfully', async () => {
    // Save a session first
    terminalManager.createTerminal();
    await service.saveCurrentSession();

    // Verify session exists
    let sessionInfo = service.getSessionInfo();
    assert.strictEqual(sessionInfo?.exists, true);

    // Clear session
    await service.clearSession();

    // Verify session is cleared
    sessionInfo = service.getSessionInfo();
    assert.strictEqual(sessionInfo?.exists, false);
  });

  test('should get session stats', () => {
    const stats = service.getSessionStats();

    assert.ok(stats);
    assert.strictEqual(typeof stats.hasSession, 'boolean');
    assert.strictEqual(typeof stats.terminalCount, 'number');
    assert.strictEqual(typeof stats.configEnabled, 'boolean');
  });

  test('should handle restore with no session data', async () => {
    const result = await service.restoreSession();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.restoredCount, 0);
    assert.strictEqual(result.skippedCount, 0);
  });

  test('should skip restore when terminals already exist', async () => {
    // Create and save a session
    terminalManager.createTerminal();
    await service.saveCurrentSession();

    // Create a new terminal (simulating existing terminals)
    terminalManager.createTerminal();

    const result = await service.restoreSession(false);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.restoredCount, 0);
    // Should skip the saved terminal
    assert.ok(result.skippedCount > 0);
  });

  test('should handle serialization response', () => {
    const mockData = {
      'terminal-1': {
        content: 'test content',
        metadata: {
          lines: 10,
          size: 100,
          compressed: false,
        },
      },
    };

    // Should not throw
    assert.doesNotThrow(() => {
      service.handleSerializationResponse(mockData);
    });
  });

  test('should throw error when service is disposed', async () => {
    service.dispose();

    await assert.rejects(
      async () => await service.saveCurrentSession(),
      /Service disposed/
    );
  });

  test('should use correct storage key', async () => {
    terminalManager.createTerminal();
    await service.saveCurrentSession();

    // Check if data was saved with correct key
    const storedData = mockGlobalState.get(PERSISTENCE_CONSTANTS.STORAGE_KEY);
    assert.ok(storedData, 'Data should be stored with correct key');
  });

  test('should include session version in saved data', async () => {
    terminalManager.createTerminal();
    await service.saveCurrentSession();

    const storedData = mockGlobalState.get(PERSISTENCE_CONSTANTS.STORAGE_KEY);
    assert.strictEqual(storedData.version, PERSISTENCE_CONSTANTS.SESSION_VERSION);
  });

  test('should include timestamp in saved data', async () => {
    const beforeTime = Date.now();
    terminalManager.createTerminal();
    await service.saveCurrentSession();
    const afterTime = Date.now();

    const storedData = mockGlobalState.get(PERSISTENCE_CONSTANTS.STORAGE_KEY);
    assert.ok(storedData.timestamp >= beforeTime);
    assert.ok(storedData.timestamp <= afterTime);
  });
});
