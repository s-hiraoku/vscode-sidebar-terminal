/**
 * Integration Tests for Session Persistence - Following t-wada's TDD Methodology
 *
 * These tests verify the complete session persistence system:
 * - Terminal state serialization and deserialization
 * - Scrollback history preservation
 * - Session restoration across VS Code restarts
 * - Multiple terminal session management
 * - Error recovery during persistence operations
 * - Performance characteristics of persistence
 *
 * TDD Integration Approach:
 * 1. RED: Write failing tests for complete persistence workflows
 * 2. GREEN: Implement persistence coordination between components
 * 3. REFACTOR: Optimize persistence while maintaining reliability
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { setupTestEnvironment, resetTestEnvironment, mockVscode } from '../../shared/TestSetup';
import { StandardTerminalPersistenceManager } from '../../../webview/managers/StandardTerminalPersistenceManager';
import { TerminalLifecycleManager } from '../../../webview/managers/TerminalLifecycleManager';
import { RefactoredMessageManager } from '../../../webview/managers/RefactoredMessageManager';
import {
  generateTerminalId,
  normalizeTerminalInfo
} from '../../../utils/common';

interface TerminalSessionData {
  id: string;
  name: string;
  scrollback: string[];
  isActive: boolean;
  workingDirectory?: string;
  environmentVariables?: Record<string, string>;
  timestamp: number;
}

describe('Session Persistence Integration - TDD Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let persistenceManager: StandardTerminalPersistenceManager;
  let lifecycleManager: TerminalLifecycleManager;
  let messageManager: RefactoredMessageManager;
  let mockExtensionContext: any;
  let mockGlobalState: Map<string, any>;

  beforeEach(() => {
    setupTestEnvironment();
    sandbox = sinon.createSandbox();

    // Mock global state storage
    mockGlobalState = new Map();

    // Mock extension context with globalState
    mockExtensionContext = {
      globalState: {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          return mockGlobalState.get(key) ?? defaultValue;
        }),
        update: sandbox.stub().callsFake(async (key: string, value: any) => {
          mockGlobalState.set(key, value);
          return Promise.resolve();
        }),
        keys: sandbox.stub().callsFake(() => {
          return Array.from(mockGlobalState.keys());
        })
      },
      subscriptions: [],
      workspaceState: {
        get: sandbox.stub(),
        update: sandbox.stub().resolves()
      }
    };

    // Initialize managers
    persistenceManager = new StandardTerminalPersistenceManager();
    lifecycleManager = new TerminalLifecycleManager();
    messageManager = new RefactoredMessageManager();

    // Mock coordinator
    const mockCoordinator = {
      getManager: sandbox.stub(),
      isReady: sandbox.stub().returns(true),
      dispose: sandbox.stub(),
      initialize: sandbox.stub(),
      logger: sandbox.stub()
    };

    mockCoordinator.getManager.withArgs('StandardTerminalPersistenceManager').returns(persistenceManager);
    mockCoordinator.getManager.withArgs('TerminalLifecycleManager').returns(lifecycleManager);
    mockCoordinator.getManager.withArgs('RefactoredMessageManager').returns(messageManager);
  });

  afterEach(() => {
    resetTestEnvironment();
    persistenceManager.dispose();
    lifecycleManager.dispose();
    messageManager.dispose();
    sandbox.restore();
  });

  describe('Terminal Session Serialization', () => {

    describe('RED Phase - Complete Session Capture', () => {

      it('should serialize complete terminal session including scrollback', async () => {
        // RED: Complete terminal state should be serializable

        // Step 1: Create terminal with scrollback history
        const terminalId = generateTerminalId();
        const terminalInfo = normalizeTerminalInfo({
          id: terminalId,
          name: 'Serialization Test Terminal',
          isActive: true
        });

        const scrollbackData = [
          'Welcome to terminal session',
          '$ ls -la',
          'total 8',
          'drwxr-xr-x  3 user  staff   96 Oct 21 10:00 .',
          'drwxr-xr-x  4 user  staff  128 Oct 21 09:30 ..',
          '-rw-r--r--  1 user  staff   45 Oct 21 10:00 file.txt',
          '$ echo "Hello World"',
          'Hello World',
          '$ pwd',
          '/Users/user/projects/test'
        ];

        // Step 2: Add scrollback to terminal
        for (const line of scrollbackData) {
          await persistenceManager.addScrollbackLine(terminalId, line);
        }

        // Step 3: Set additional terminal state
        await persistenceManager.setTerminalWorkingDirectory(terminalId, '/Users/user/projects/test');
        await persistenceManager.setTerminalEnvironment(terminalId, {
          'NODE_ENV': 'development',
          'PATH': '/usr/local/bin:/usr/bin:/bin'
        });

        // Step 4: Serialize terminal session
        const serializedSession = await persistenceManager.serializeTerminalSession(terminalId);

        expect(serializedSession).to.be.an('object');
        expect(serializedSession.id).to.equal(terminalId);
        expect(serializedSession.name).to.equal('Serialization Test Terminal');
        expect(serializedSession.scrollback).to.deep.equal(scrollbackData);
        expect(serializedSession.isActive).to.be.true;
        expect(serializedSession.workingDirectory).to.equal('/Users/user/projects/test');
        expect(serializedSession.environmentVariables).to.deep.equal({
          'NODE_ENV': 'development',
          'PATH': '/usr/local/bin:/usr/bin:/bin'
        });
        expect(serializedSession.timestamp).to.be.a('number');
        expect(serializedSession.timestamp).to.be.greaterThan(Date.now() - 5000); // Recent
      });

      it('should serialize multiple terminal sessions simultaneously', async () => {
        // RED: Multiple terminals should be serializable together

        const terminalCount = 5;
        const terminals: TerminalSessionData[] = [];

        // Step 1: Create multiple terminals with different states
        for (let i = 0; i < terminalCount; i++) {
          const terminalId = generateTerminalId();
          const terminalInfo = normalizeTerminalInfo({
            id: terminalId,
            name: `Terminal ${i + 1}`,
            isActive: i === 0 // First terminal is active
          });

          // Add unique scrollback for each terminal
          const scrollback = [
            `Terminal ${i + 1} started`,
            `$ echo "Terminal ${i + 1}"`,
            `Terminal ${i + 1}`,
            `$ date`,
            new Date().toISOString()
          ];

          for (const line of scrollback) {
            await persistenceManager.addScrollbackLine(terminalId, line);
          }

          await persistenceManager.setTerminalWorkingDirectory(terminalId, `/path/to/terminal/${i + 1}`);

          terminals.push({
            id: terminalId,
            name: terminalInfo.name,
            scrollback,
            isActive: terminalInfo.isActive,
            workingDirectory: `/path/to/terminal/${i + 1}`,
            timestamp: Date.now()
          });
        }

        // Step 2: Serialize all terminals
        const sessionData = await persistenceManager.serializeAllSessions();

        expect(sessionData).to.be.an('object');
        expect(sessionData.terminals).to.have.length(terminalCount);
        expect(sessionData.activeTerminalId).to.equal(terminals[0].id);
        expect(sessionData.version).to.be.a('string');
        expect(sessionData.timestamp).to.be.a('number');

        // Step 3: Verify each terminal was serialized correctly
        sessionData.terminals.forEach((serializedTerminal, index) => {
          const originalTerminal = terminals[index];
          expect(serializedTerminal.id).to.equal(originalTerminal.id);
          expect(serializedTerminal.name).to.equal(originalTerminal.name);
          expect(serializedTerminal.scrollback).to.deep.equal(originalTerminal.scrollback);
          expect(serializedTerminal.isActive).to.equal(originalTerminal.isActive);
          expect(serializedTerminal.workingDirectory).to.equal(originalTerminal.workingDirectory);
        });
      });

      it('should handle large scrollback history efficiently', async () => {
        // RED: Large scrollback should be serialized without performance issues

        const terminalId = generateTerminalId();
        const terminalInfo = normalizeTerminalInfo({
          id: terminalId,
          name: 'Large Scrollback Terminal',
          isActive: true
        });

        // Generate large scrollback (10,000 lines)
        const largeScrollback: string[] = [];
        for (let i = 0; i < 10000; i++) {
          largeScrollback.push(`Line ${i}: This is a test line with some content ${Math.random()}`);
        }

        const startTime = Date.now();

        // Add scrollback efficiently
        await persistenceManager.addScrollbackBatch(terminalId, largeScrollback);

        // Serialize the session
        const serializedSession = await persistenceManager.serializeTerminalSession(terminalId);

        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(serializedSession.scrollback).to.have.length(10000);
        expect(duration).to.be.lessThan(2000); // Should complete within 2 seconds

        // Verify scrollback integrity
        expect(serializedSession.scrollback[0]).to.equal(largeScrollback[0]);
        expect(serializedSession.scrollback[9999]).to.equal(largeScrollback[9999]);
      });

      it('should compress scrollback data to optimize storage', async () => {
        // RED: Scrollback compression should reduce storage requirements

        const terminalId = generateTerminalId();

        // Create repetitive content that compresses well
        const repetitiveContent = Array(1000).fill('This is a repeated line of terminal output').join('\n');
        const scrollback = repetitiveContent.split('\n');

        await persistenceManager.addScrollbackBatch(terminalId, scrollback);

        const serializedSession = await persistenceManager.serializeTerminalSession(terminalId);
        const compressedData = await persistenceManager.compressSessionData(serializedSession);

        // Original data size
        const originalSize = JSON.stringify(serializedSession).length;

        // Compressed data should be significantly smaller
        expect(compressedData.compressed).to.be.true;
        expect(compressedData.originalSize).to.equal(originalSize);
        expect(compressedData.compressedSize).to.be.lessThan(originalSize * 0.1); // At least 90% compression

        // Verify decompression works
        const decompressedSession = await persistenceManager.decompressSessionData(compressedData);
        expect(decompressedSession).to.deep.equal(serializedSession);
      });

    });

  });

  describe('Session Restoration and Recovery', () => {

    describe('RED Phase - Complete Session Restoration', () => {

      it('should restore terminal session with complete state', async () => {
        // RED: Restored terminals should have identical state

        // Step 1: Create and serialize original session
        const originalTerminalId = generateTerminalId();
        const originalScrollback = [
          'Original session started',
          '$ npm install',
          'added 150 packages in 30s',
          '$ npm test',
          'All tests passed!'
        ];

        for (const line of originalScrollback) {
          await persistenceManager.addScrollbackLine(originalTerminalId, line);
        }

        await persistenceManager.setTerminalWorkingDirectory(originalTerminalId, '/project/root');
        await persistenceManager.setTerminalEnvironment(originalTerminalId, {
          'NODE_ENV': 'test',
          'CI': 'true'
        });

        const serializedSession = await persistenceManager.serializeTerminalSession(originalTerminalId);

        // Step 2: Clear current state (simulate restart)
        persistenceManager.clearAllSessions();

        // Step 3: Restore from serialized data
        const restoreResult = await persistenceManager.restoreTerminalSession(serializedSession);

        expect(restoreResult.success).to.be.true;
        expect(restoreResult.terminalId).to.be.a('string');

        // Step 4: Verify restored state matches original
        const restoredSession = await persistenceManager.getTerminalSession(restoreResult.terminalId);

        expect(restoredSession.name).to.equal(serializedSession.name);
        expect(restoredSession.scrollback).to.deep.equal(originalScrollback);
        expect(restoredSession.workingDirectory).to.equal('/project/root');
        expect(restoredSession.environmentVariables).to.deep.equal({
          'NODE_ENV': 'test',
          'CI': 'true'
        });
      });

      it('should restore multiple terminals maintaining relative state', async () => {
        // RED: Multiple terminal restoration should preserve relationships

        // Step 1: Create multiple terminals with relationships
        const terminals = [];
        for (let i = 0; i < 3; i++) {
          const terminalId = generateTerminalId();
          const terminal = {
            id: terminalId,
            name: `Project Terminal ${i + 1}`,
            scrollback: [
              `Terminal ${i + 1} initialized`,
              `$ cd /project/module${i + 1}`,
              `$ git status`,
              'On branch main'
            ],
            isActive: i === 1, // Middle terminal is active
            workingDirectory: `/project/module${i + 1}`
          };

          for (const line of terminal.scrollback) {
            await persistenceManager.addScrollbackLine(terminalId, line);
          }

          await persistenceManager.setTerminalWorkingDirectory(terminalId, terminal.workingDirectory);

          terminals.push(terminal);
        }

        // Step 2: Serialize all sessions
        const allSessions = await persistenceManager.serializeAllSessions();

        // Step 3: Clear and restore
        persistenceManager.clearAllSessions();

        const restoreResult = await persistenceManager.restoreAllSessions(allSessions);

        expect(restoreResult.success).to.be.true;
        expect(restoreResult.restoredTerminals).to.have.length(3);

        // Step 4: Verify terminal relationships
        const restoredSessions = await persistenceManager.getAllSessions();
        expect(restoredSessions.terminals).to.have.length(3);

        // Active terminal should be preserved
        const activeTerminal = restoredSessions.terminals.find(t => t.isActive);
        expect(activeTerminal).to.exist;
        expect(activeTerminal!.name).to.equal('Project Terminal 2'); // Was index 1

        // Working directories should be preserved
        restoredSessions.terminals.forEach((terminal, index) => {
          expect(terminal.workingDirectory).to.equal(`/project/module${index + 1}`);
        });
      });

      it('should handle corrupted session data gracefully', async () => {
        // RED: Corrupted session data should not prevent restoration

        // Step 1: Create valid session data
        const validSession = {
          id: generateTerminalId(),
          name: 'Valid Terminal',
          scrollback: ['Valid content'],
          isActive: true,
          timestamp: Date.now()
        };

        // Step 2: Create corrupted session data
        const corruptedSessions = {
          version: '1.0.0',
          timestamp: Date.now(),
          activeTerminalId: 'invalid-id',
          terminals: [
            validSession,
            {
              // Missing required fields
              name: 'Corrupted Terminal',
              scrollback: null, // Invalid scrollback
              isActive: 'not-boolean' // Invalid type
            },
            {
              id: 'another-valid-id',
              name: 'Another Valid Terminal',
              scrollback: ['Another valid line'],
              isActive: false,
              timestamp: Date.now()
            }
          ]
        };

        // Step 3: Attempt restoration
        const restoreResult = await persistenceManager.restoreAllSessions(corruptedSessions as any);

        expect(restoreResult.success).to.be.true;
        expect(restoreResult.warnings).to.have.length.greaterThan(0);

        // Step 4: Verify only valid terminals were restored
        const restoredSessions = await persistenceManager.getAllSessions();
        expect(restoredSessions.terminals).to.have.length(2); // Only valid ones

        // Corrupted terminal should be skipped
        const terminalNames = restoredSessions.terminals.map(t => t.name);
        expect(terminalNames).to.include('Valid Terminal');
        expect(terminalNames).to.include('Another Valid Terminal');
        expect(terminalNames).to.not.include('Corrupted Terminal');
      });

      it('should implement progressive session restoration for large datasets', async () => {
        // RED: Large session datasets should restore progressively

        // Step 1: Create large session dataset
        const largeSessionCount = 50;
        const terminals = [];

        for (let i = 0; i < largeSessionCount; i++) {
          terminals.push({
            id: generateTerminalId(),
            name: `Bulk Terminal ${i + 1}`,
            scrollback: Array(100).fill(`Line ${i}`), // 100 lines each
            isActive: i === 0,
            timestamp: Date.now()
          });
        }

        const largeSessionData = {
          version: '1.0.0',
          timestamp: Date.now(),
          activeTerminalId: terminals[0].id,
          terminals
        };

        // Step 2: Start progressive restoration
        const progressCallback = sandbox.stub();
        const restorePromise = persistenceManager.restoreAllSessionsProgressively(
          largeSessionData,
          { batchSize: 10, progressCallback }
        );

        // Step 3: Monitor progress
        let restoreResult;
        const startTime = Date.now();

        restoreResult = await restorePromise;

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Step 4: Verify progressive restoration
        expect(restoreResult.success).to.be.true;
        expect(restoreResult.restoredTerminals).to.have.length(largeSessionCount);

        // Progress should have been reported multiple times
        expect(progressCallback.callCount).to.be.greaterThan(3); // At least 4 batches

        // Should complete in reasonable time despite size
        expect(duration).to.be.lessThan(10000); // Less than 10 seconds

        // Verify all terminals were restored
        const finalSessions = await persistenceManager.getAllSessions();
        expect(finalSessions.terminals).to.have.length(largeSessionCount);
      });

    });

  });

  describe('VS Code GlobalState Integration', () => {

    describe('RED Phase - Persistent Storage Integration', () => {

      it('should persist sessions to VS Code globalState', async () => {
        // RED: Sessions should be saved to VS Code globalState for persistence

        const terminalId = generateTerminalId();
        const scrollback = ['Persistence test line 1', 'Persistence test line 2'];

        for (const line of scrollback) {
          await persistenceManager.addScrollbackLine(terminalId, line);
        }

        // Trigger persistence to globalState
        await persistenceManager.persistToGlobalState(mockExtensionContext);

        // Verify data was saved to globalState
        expect(mockExtensionContext.globalState.update).to.have.been.called;

        const savedData = mockGlobalState.get('terminalSessions');
        expect(savedData).to.exist;
        expect(savedData.terminals).to.have.length(1);
        expect(savedData.terminals[0].scrollback).to.deep.equal(scrollback);
      });

      it('should restore sessions from VS Code globalState on startup', async () => {
        // RED: Sessions should be automatically restored from globalState

        // Step 1: Pre-populate globalState with session data
        const sessionData = {
          version: '1.0.0',
          timestamp: Date.now(),
          activeTerminalId: 'startup-terminal-1',
          terminals: [
            {
              id: 'startup-terminal-1',
              name: 'Startup Terminal',
              scrollback: ['Welcome back!', 'Your session was restored'],
              isActive: true,
              timestamp: Date.now()
            }
          ]
        };

        mockGlobalState.set('terminalSessions', sessionData);

        // Step 2: Initialize persistence manager (simulates startup)
        const newPersistenceManager = new StandardTerminalPersistenceManager();
        await newPersistenceManager.initializeFromGlobalState(mockExtensionContext);

        // Step 3: Verify sessions were restored
        const restoredSessions = await newPersistenceManager.getAllSessions();
        expect(restoredSessions.terminals).to.have.length(1);
        expect(restoredSessions.terminals[0].name).to.equal('Startup Terminal');
        expect(restoredSessions.terminals[0].scrollback).to.deep.equal(sessionData.terminals[0].scrollback);

        newPersistenceManager.dispose();
      });

      it('should handle globalState size limits gracefully', async () => {
        // RED: Should manage storage within VS Code globalState limits

        // Create session data that approaches size limits
        const largeScrollback = Array(10000).fill('Large scrollback line with substantial content');
        const terminalId = generateTerminalId();

        await persistenceManager.addScrollbackBatch(terminalId, largeScrollback);

        // Mock globalState.update to simulate size limit error
        mockExtensionContext.globalState.update.callsFake(async (key: string, value: any) => {
          const serialized = JSON.stringify(value);
          if (serialized.length > 1024 * 1024) { // 1MB limit simulation
            throw new Error('Storage quota exceeded');
          }
          mockGlobalState.set(key, value);
        });

        // Attempt persistence - should handle gracefully
        const persistResult = await persistenceManager.persistToGlobalState(mockExtensionContext);

        expect(persistResult.success).to.be.true;
        expect(persistResult.compressionUsed).to.be.true;

        // Should have applied compression or truncation to fit
        const savedData = mockGlobalState.get('terminalSessions');
        expect(savedData).to.exist;

        const savedSize = JSON.stringify(savedData).length;
        expect(savedSize).to.be.lessThan(1024 * 1024); // Under limit
      });

      it('should maintain session integrity across VS Code restarts', async () => {
        // RED: Sessions should survive complete VS Code restart cycle

        // Step 1: Create complex session state
        const terminals = [];
        for (let i = 0; i < 3; i++) {
          const terminalId = generateTerminalId();
          const scrollback = [
            `Terminal ${i + 1} session start`,
            `$ cd /workspace/project${i + 1}`,
            `$ npm run dev`,
            `Server started on port ${3000 + i}`
          ];

          for (const line of scrollback) {
            await persistenceManager.addScrollbackLine(terminalId, line);
          }

          await persistenceManager.setTerminalWorkingDirectory(terminalId, `/workspace/project${i + 1}`);

          terminals.push({
            id: terminalId,
            scrollback,
            workingDirectory: `/workspace/project${i + 1}`
          });
        }

        // Step 2: Persist to globalState
        await persistenceManager.persistToGlobalState(mockExtensionContext);

        // Step 3: Simulate VS Code restart - dispose and recreate
        persistenceManager.dispose();

        const newPersistenceManager = new StandardTerminalPersistenceManager();
        await newPersistenceManager.initializeFromGlobalState(mockExtensionContext);

        // Step 4: Verify complete session integrity
        const restoredSessions = await newPersistenceManager.getAllSessions();
        expect(restoredSessions.terminals).to.have.length(3);

        restoredSessions.terminals.forEach((terminal, index) => {
          const originalTerminal = terminals[index];
          expect(terminal.scrollback).to.deep.equal(originalTerminal.scrollback);
          expect(terminal.workingDirectory).to.equal(originalTerminal.workingDirectory);
        });

        newPersistenceManager.dispose();
      });

    });

  });

  describe('Performance and Resource Management', () => {

    describe('RED Phase - Persistence Performance', () => {

      it('should perform session operations within acceptable time limits', async () => {
        // RED: Persistence operations should be fast

        const terminalCount = 10;
        const scrollbackSize = 1000;

        // Create multiple terminals with substantial scrollback
        const startTime = Date.now();

        for (let i = 0; i < terminalCount; i++) {
          const terminalId = generateTerminalId();
          const scrollback = Array(scrollbackSize).fill(`Terminal ${i} line`);

          await persistenceManager.addScrollbackBatch(terminalId, scrollback);
          await persistenceManager.setTerminalWorkingDirectory(terminalId, `/path/${i}`);
        }

        // Serialize all sessions
        const serializedSessions = await persistenceManager.serializeAllSessions();

        // Persist to storage
        await persistenceManager.persistToGlobalState(mockExtensionContext);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        expect(serializedSessions.terminals).to.have.length(terminalCount);
        expect(totalTime).to.be.lessThan(5000); // Should complete within 5 seconds
      });

      it('should manage memory efficiently during persistence operations', async () => {
        // RED: Persistence should not cause memory leaks

        const initialMemory = process.memoryUsage().heapUsed;

        // Perform many persistence cycles
        for (let cycle = 0; cycle < 20; cycle++) {
          const terminalId = generateTerminalId();
          const scrollback = Array(500).fill(`Cycle ${cycle} line`);

          await persistenceManager.addScrollbackBatch(terminalId, scrollback);
          await persistenceManager.serializeTerminalSession(terminalId);
          await persistenceManager.clearTerminalSession(terminalId);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 20MB)
        expect(memoryIncrease).to.be.lessThan(20 * 1024 * 1024);
      });

      it('should handle concurrent persistence operations safely', async () => {
        // RED: Concurrent persistence should not cause corruption

        const concurrentOperations = 20;
        const promises = [];

        // Start many concurrent persistence operations
        for (let i = 0; i < concurrentOperations; i++) {
          promises.push((async () => {
            const terminalId = generateTerminalId();
            const scrollback = [`Concurrent operation ${i}`, `Line ${i}`];

            await persistenceManager.addScrollbackBatch(terminalId, scrollback);
            return persistenceManager.serializeTerminalSession(terminalId);
          })());
        }

        const results = await Promise.all(promises);

        // All operations should succeed
        expect(results).to.have.length(concurrentOperations);
        results.forEach((result, index) => {
          expect(result.scrollback).to.include(`Concurrent operation ${index}`);
        });

        // Final state should be consistent
        const allSessions = await persistenceManager.getAllSessions();
        expect(allSessions.terminals).to.have.length(concurrentOperations);
      });

      it('should implement efficient incremental persistence', async () => {
        // RED: Only changed data should be persisted incrementally

        // Create initial session
        const terminalId = generateTerminalId();
        await persistenceManager.addScrollbackLine(terminalId, 'Initial line');

        const firstPersist = await persistenceManager.persistToGlobalState(mockExtensionContext);
        expect(firstPersist.changeCount).to.equal(1); // New terminal

        // Add more content
        await persistenceManager.addScrollbackLine(terminalId, 'Second line');
        await persistenceManager.addScrollbackLine(terminalId, 'Third line');

        const secondPersist = await persistenceManager.persistToGlobalState(mockExtensionContext);
        expect(secondPersist.changeCount).to.equal(1); // Same terminal, updated

        // Create another terminal
        const terminalId2 = generateTerminalId();
        await persistenceManager.addScrollbackLine(terminalId2, 'New terminal line');

        const thirdPersist = await persistenceManager.persistToGlobalState(mockExtensionContext);
        expect(thirdPersist.changeCount).to.equal(2); // Two terminals with changes

        // No changes - should be fast
        const fourthPersist = await persistenceManager.persistToGlobalState(mockExtensionContext);
        expect(fourthPersist.changeCount).to.equal(0); // No changes
        expect(fourthPersist.skippedDueToNoChanges).to.be.true;
      });

    });

  });

  describe('Error Recovery and Resilience', () => {

    describe('RED Phase - Persistence Error Handling', () => {

      it('should recover from storage failures gracefully', async () => {
        // RED: Storage failures should not lose session data

        const terminalId = generateTerminalId();
        const criticalScrollback = [
          'Important work session',
          '$ git commit -m "Critical changes"',
          '[main 1234567] Critical changes',
          '$ git push',
          'Everything up-to-date'
        ];

        await persistenceManager.addScrollbackBatch(terminalId, criticalScrollback);

        // Mock storage failure
        mockExtensionContext.globalState.update.rejects(new Error('Storage device full'));

        // Attempt persistence - should handle gracefully
        const persistResult = await persistenceManager.persistToGlobalState(mockExtensionContext);

        expect(persistResult.success).to.be.false;
        expect(persistResult.error).to.include('Storage device full');
        expect(persistResult.fallbackUsed).to.be.true;

        // Session data should still be available in memory
        const sessionData = await persistenceManager.getTerminalSession(terminalId);
        expect(sessionData.scrollback).to.deep.equal(criticalScrollback);

        // Should retry persistence when storage is available
        mockExtensionContext.globalState.update.resolves();

        const retryResult = await persistenceManager.retryFailedPersistence();
        expect(retryResult.success).to.be.true;
      });

      it('should maintain data integrity during partial failures', async () => {
        // RED: Partial failures should not corrupt entire session

        // Create multiple terminals
        const terminals = [];
        for (let i = 0; i < 5; i++) {
          const terminalId = generateTerminalId();
          terminals.push(terminalId);

          await persistenceManager.addScrollbackLine(terminalId, `Terminal ${i} data`);
        }

        // Mock failure for specific terminal
        const failingTerminalId = terminals[2];
        const originalSerialize = persistenceManager.serializeTerminalSession.bind(persistenceManager);

        persistenceManager.serializeTerminalSession = sandbox.stub().callsFake(async (id: string) => {
          if (id === failingTerminalId) {
            throw new Error('Serialization failed for terminal');
          }
          return originalSerialize(id);
        });

        // Attempt to serialize all sessions
        const result = await persistenceManager.serializeAllSessions();

        expect(result.terminals).to.have.length(4); // 4 successful, 1 failed
        expect(result.errors).to.have.length(1);
        expect(result.errors[0]).to.include('Serialization failed');

        // Other terminals should be unaffected
        const successfulIds = result.terminals.map(t => t.id);
        expect(successfulIds).to.not.include(failingTerminalId);
        expect(successfulIds).to.have.length(4);
      });

      it('should implement automatic backup and recovery', async () => {
        // RED: Automatic backups should enable recovery from corruption

        // Create session data
        const terminalId = generateTerminalId();
        const originalScrollback = ['Original session data', 'Important work'];

        await persistenceManager.addScrollbackBatch(terminalId, originalScrollback);

        // Create automatic backup
        await persistenceManager.createAutomaticBackup(mockExtensionContext);

        // Simulate data corruption
        mockGlobalState.set('terminalSessions', { corrupted: true });

        // Attempt to restore from backup
        const recoveryResult = await persistenceManager.recoverFromBackup(mockExtensionContext);

        expect(recoveryResult.success).to.be.true;
        expect(recoveryResult.backupUsed).to.be.true;

        // Verify data was recovered
        const recoveredSessions = await persistenceManager.getAllSessions();
        expect(recoveredSessions.terminals).to.have.length(1);
        expect(recoveredSessions.terminals[0].scrollback).to.deep.equal(originalScrollback);
      });

    });

  });

});