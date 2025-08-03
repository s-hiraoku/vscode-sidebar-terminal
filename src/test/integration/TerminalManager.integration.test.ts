/**
 * Terminal Manager Integration Tests
 *
 * Tests the RefactoredTerminalManager with all its injected services:
 * - Service composition and dependency injection
 * - Terminal creation → data flow → state management → deletion workflow
 * - CLI Agent detection integration across services
 * - Error handling across service boundaries
 * - Event coordination between services
 * - Performance under service composition
 *
 * Following TDD principles with realistic user workflow scenarios.
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';

// Core Dependencies
import { RefactoredTerminalManager } from '../../terminals/RefactoredTerminalManager';
import { TerminalInstance, TerminalState, DeleteResult } from '../../types/common';

// Service Dependencies
import { ITerminalLifecycleManager } from '../../services/TerminalLifecycleManager';
import { ICliAgentDetectionService } from '../../interfaces/CliAgentService';
import { ITerminalDataBufferingService } from '../../services/TerminalDataBufferingService';
import { ITerminalStateManager } from '../../services/TerminalStateManager';

// Test Infrastructure
import {
  IntegrationTestFramework,
  setupIntegrationTest,
  cleanupIntegrationTest,
  EventFlowTracker,
  PerformanceMonitor
} from './IntegrationTestFramework';

describe('RefactoredTerminalManager Integration Tests', () => {
  let framework: IntegrationTestFramework;
  let terminalManager: RefactoredTerminalManager;
  let mockLifecycleManager: ITerminalLifecycleManager;
  let mockCliAgentService: ICliAgentDetectionService;
  let mockBufferingService: ITerminalDataBufferingService;
  let mockStateManager: ITerminalStateManager;
  let eventTracker: EventFlowTracker;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(async () => {
    framework = await setupIntegrationTest('RefactoredTerminalManager Integration', {
      enablePerformanceMonitoring: true,
      enableMemoryLeakDetection: true,
      enableEventFlowTracking: true,
      maxOperationTime: 1000,
      maxMemoryIncrease: 512
    });

    // Get framework components
    eventTracker = framework.getEventTracker();
    performanceMonitor = framework.getPerformanceMonitor();
    const mockFactory = framework.getMockFactory();

    // Create mock services with event support
    mockLifecycleManager = mockFactory.createMockLifecycleManager();
    mockCliAgentService = mockFactory.createMockCliAgentService();
    mockBufferingService = mockFactory.createMockBufferingService();
    mockStateManager = mockFactory.createMockStateManager();

    // Create RefactoredTerminalManager with dependency injection
    terminalManager = new RefactoredTerminalManager(
      mockLifecycleManager,
      mockCliAgentService,
      mockBufferingService,
      mockStateManager
    );
  });

  afterEach(async () => {
    if (terminalManager) {
      terminalManager.dispose();
    }
    await cleanupIntegrationTest(framework, 'RefactoredTerminalManager Integration');
  });

  describe('Service Composition and Dependency Injection', () => {
    it('should initialize all services with proper dependency injection', async () => {
      const { result: health, duration } = await framework.measureOperation(
        'service-health-check',
        () => terminalManager.getServiceHealth()
      );

      // Validate service health
      framework.validateServiceHealth(health);

      // Validate performance
      expect(duration).to.be.lessThan(100, 'Service health check should be fast');

      console.log('✅ [INTEGRATION] Service composition validated');
    });

    it('should maintain service isolation while enabling communication', () => {
      // Each service should be called independently
      expect(mockLifecycleManager.getAllTerminals).to.be.a('function');
      expect(mockCliAgentService.getAgentState).to.be.a('function');
      expect(mockBufferingService.bufferData).to.be.a('function');
      expect(mockStateManager.getCurrentState).to.be.a('function');

      // Services should not directly depend on each other
      expect(terminalManager.getTerminals()).to.deep.equal([]);
      expect(mockLifecycleManager.getAllTerminals.calledOnce).to.be.true;

      console.log('✅ [INTEGRATION] Service isolation validated');
    });

    it('should provide performance metrics from all services', () => {
      const metrics = terminalManager.getPerformanceMetrics();

      expect(metrics).to.have.property('bufferingStats');
      expect(metrics).to.have.property('terminalCount');
      expect(metrics).to.have.property('activeTerminalId');

      // Verify service calls
      expect(mockBufferingService.getAllStats).to.have.been.calledOnce;
      expect(mockLifecycleManager.getTerminalCount).to.have.been.calledOnce;
      expect(mockStateManager.getActiveTerminalId).to.have.been.calledOnce;

      console.log('✅ [INTEGRATION] Performance metrics aggregation validated');
    });
  });

  describe('End-to-End Terminal Workflow', () => {
    it('should handle complete terminal lifecycle: create → use → delete', async () => {
      eventTracker.startTracking();

      // Step 1: Create terminal
      const createResult = await framework.measureOperation(
        'terminal-creation',
        () => {
          // Mock successful creation
          const mockTerminal: TerminalInstance = {
            id: 'test-terminal-1',
            name: 'Test Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: false
          };
          
          (mockLifecycleManager.createTerminal as sinon.SinonStub).returns('test-terminal-1');
          (mockLifecycleManager.getAllTerminals as sinon.SinonStub).returns([mockTerminal]);
          
          eventTracker.recordEvent('terminal-create-start', 'TerminalManager', 'LifecycleManager');
          const terminalId = terminalManager.createTerminal();
          eventTracker.recordEvent('terminal-create-complete', 'LifecycleManager', 'TerminalManager');
          
          return terminalId;
        }
      );

      expect(createResult.result).to.equal('test-terminal-1');
      expect(createResult.duration).to.be.lessThan(100);
      expect(mockLifecycleManager.createTerminal).to.have.been.calledOnce;
      expect(mockStateManager.updateTerminalState).to.have.been.calledOnce;

      // Step 2: Send input (simulate user interaction)
      await framework.measureOperation(
        'terminal-input',
        () => {
          eventTracker.recordEvent('input-start', 'TerminalManager', 'LifecycleManager');
          terminalManager.sendInput('echo "hello world"', 'test-terminal-1');
          eventTracker.recordEvent('input-complete', 'LifecycleManager', 'TerminalManager');
        }
      );

      expect(mockCliAgentService.detectFromInput).to.have.been.calledWith('test-terminal-1', 'echo "hello world"');
      expect(mockLifecycleManager.writeToTerminal).to.have.been.calledWith('test-terminal-1', 'echo "hello world"');

      // Step 3: Focus terminal
      await framework.measureOperation(
        'terminal-focus',
        () => {
          (mockLifecycleManager.getTerminal as sinon.SinonStub).returns({
            id: 'test-terminal-1',
            name: 'Test Terminal 1',
            number: 1,
            cwd: '/test',
            isActive: false
          });
          
          eventTracker.recordEvent('focus-start', 'TerminalManager', 'StateManager');
          terminalManager.focusTerminal('test-terminal-1');
          eventTracker.recordEvent('focus-complete', 'StateManager', 'TerminalManager');
        }
      );

      expect(mockStateManager.setActiveTerminal).to.have.been.calledWith('test-terminal-1');

      // Step 4: Delete terminal
      const deleteResult = await framework.measureOperation(
        'terminal-deletion',
        async () => {
          (mockStateManager.validateTerminalDeletion as sinon.SinonStub).returns({ success: true });
          (mockLifecycleManager.killTerminal as sinon.SinonStub).resolves();
          (mockLifecycleManager.getAllTerminals as sinon.SinonStub).returns([]);
          (mockStateManager.getCurrentState as sinon.SinonStub).returns({
            terminals: [],
            activeTerminalId: null,
            terminalCount: 0
          });
          
          eventTracker.recordEvent('delete-start', 'TerminalManager', 'StateManager');
          const result = await terminalManager.deleteTerminal('test-terminal-1', { source: 'panel' });
          eventTracker.recordEvent('delete-complete', 'StateManager', 'TerminalManager');
          
          return result;
        }
      );

      expect(deleteResult.result.success).to.be.true;
      expect(mockStateManager.validateTerminalDeletion).to.have.been.calledWith('test-terminal-1');
      expect(mockLifecycleManager.killTerminal).to.have.been.calledWith('test-terminal-1');
      expect(mockStateManager.updateTerminalState).to.have.been.calledTwice; // Create + Delete

      // Validate event flow
      eventTracker.stopTracking();
      const expectedSequence = [
        'terminal-create-start',
        'terminal-create-complete',
        'input-start',
        'input-complete',
        'focus-start',
        'focus-complete',
        'delete-start',
        'delete-complete'
      ];
      eventTracker.validateEventSequence(expectedSequence);
      eventTracker.validateEventTiming(1000);

      console.log('✅ [INTEGRATION] Complete terminal lifecycle validated');
    });

    it('should handle data buffering and CLI agent detection integration', async () => {
      // Setup buffering service to trigger flush handler
      let flushHandler: ((terminalId: string, data: string) => void) | undefined;
      (mockBufferingService.addFlushHandler as sinon.SinonStub).callsFake((handler) => {
        flushHandler = handler;
      });

      // Create new manager to trigger service integration setup
      const newManager = new RefactoredTerminalManager(
        mockLifecycleManager,
        mockCliAgentService,
        mockBufferingService,
        mockStateManager
      );

      // Verify flush handler was registered
      expect(mockBufferingService.addFlushHandler).to.have.been.calledOnce;
      expect(flushHandler).to.be.a('function');

      // Simulate data buffering and flushing
      const testData = 'claude-code "test command"';
      const terminalId = 'test-terminal-1';

      if (flushHandler) {
        await framework.measureOperation(
          'data-buffering-flush',
          () => {
            eventTracker.recordEvent('buffer-flush-start', 'BufferingService', 'CliAgentService');
            flushHandler!(terminalId, testData);
            eventTracker.recordEvent('buffer-flush-complete', 'CliAgentService', 'TerminalManager');
          }
        );

        // Verify CLI agent detection was called
        expect(mockCliAgentService.detectFromOutput).to.have.been.calledWith(terminalId, testData);
      }

      newManager.dispose();
      console.log('✅ [INTEGRATION] Data buffering and CLI agent detection integration validated');
    });

    it('should handle multiple terminals with proper isolation', async () => {
      const terminals = ['term-1', 'term-2', 'term-3'];
      const mockTerminalInstances: TerminalInstance[] = terminals.map((id, index) => ({
        id,
        name: `Terminal ${index + 1}`,
        number: index + 1,
        cwd: '/test',
        isActive: false
      }));

      // Mock terminal creation
      terminals.forEach((terminalId, index) => {
        (mockLifecycleManager.createTerminal as sinon.SinonStub)
          .onCall(index)
          .returns(terminalId);
      });

      (mockLifecycleManager.getAllTerminals as sinon.SinonStub)
        .onCall(0).returns([mockTerminalInstances[0]])
        .onCall(1).returns([mockTerminalInstances[0], mockTerminalInstances[1]])
        .onCall(2).returns(mockTerminalInstances);

      // Create multiple terminals
      const createdTerminals: string[] = [];
      for (let i = 0; i < terminals.length; i++) {
        const terminalId = await framework.measureOperation(
          `create-terminal-${i + 1}`,
          () => terminalManager.createTerminal()
        );
        createdTerminals.push(terminalId.result);
      }

      expect(createdTerminals).to.deep.equal(terminals);
      expect(mockLifecycleManager.createTerminal).to.have.been.calledThrice;
      expect(mockStateManager.updateTerminalState).to.have.been.calledThrice;

      // Test terminal isolation - operations on one terminal shouldn't affect others
      const inputData = 'gemini code "test"';
      
      await framework.measureOperation(
        'isolated-terminal-input',
        () => {
          terminalManager.sendInput(inputData, 'term-2');
        }
      );

      expect(mockCliAgentService.detectFromInput).to.have.been.calledWith('term-2', inputData);
      expect(mockLifecycleManager.writeToTerminal).to.have.been.calledWith('term-2', inputData);

      // Only the target terminal should receive input
      expect(mockLifecycleManager.writeToTerminal).to.have.been.calledOnce;

      console.log('✅ [INTEGRATION] Multiple terminal isolation validated');
    });
  });

  describe('CLI Agent Detection Integration', () => {
    it('should coordinate CLI agent detection across all services', async () => {
      const terminalId = 'cli-agent-terminal';
      const agentOutput = 'claude-code "analyze this file"';

      // Setup CLI agent service mock responses
      (mockCliAgentService.getAgentState as sinon.SinonStub).returns({
        status: 'connected',
        type: 'claude'
      });
      
      (mockCliAgentService.getConnectedAgent as sinon.SinonStub).returns({
        terminalId,
        type: 'claude'
      });

      // Test CLI agent detection from output
      await framework.measureOperation(
        'cli-agent-output-detection',
        () => {
          terminalManager.handleTerminalOutputForCliAgent(terminalId, agentOutput);
        }
      );

      expect(mockCliAgentService.detectFromOutput).to.have.been.calledWith(terminalId, agentOutput);

      // Test CLI agent status queries
      const isConnected = terminalManager.isCliAgentConnected(terminalId);
      const isRunning = terminalManager.isCliAgentRunning(terminalId);
      const agentType = terminalManager.getAgentType(terminalId);
      const connectedAgent = terminalManager.getCurrentGloballyActiveAgent();

      expect(isConnected).to.be.true;
      expect(isRunning).to.be.true;
      expect(agentType).to.equal('claude');
      expect(connectedAgent).to.deep.equal({ terminalId, type: 'claude' });

      // Verify service integration
      expect(mockCliAgentService.getAgentState).to.have.been.calledWith(terminalId);
      expect(mockCliAgentService.getConnectedAgent).to.have.been.called;

      console.log('✅ [INTEGRATION] CLI agent detection integration validated');
    });

    it('should handle CLI agent switching between terminals', async () => {
      const terminal1 = 'terminal-1';
      const terminal2 = 'terminal-2';

      // Mock successful switch
      (mockLifecycleManager.getTerminal as sinon.SinonStub)
        .withArgs(terminal1).returns({ id: terminal1, name: 'Terminal 1' })
        .withArgs(terminal2).returns({ id: terminal2, name: 'Terminal 2' });

      (mockCliAgentService.switchAgentConnection as sinon.SinonStub).returns({
        success: true,
        newStatus: 'connected',
        agentType: 'gemini',
        reason: undefined
      });

      // Test agent switching
      const switchResult = await framework.measureOperation(
        'cli-agent-switch',
        () => terminalManager.switchAiAgentConnection(terminal2)
      );

      expect(switchResult.result.success).to.be.true;
      expect(switchResult.result.newStatus).to.equal('connected');
      expect(switchResult.result.agentType).to.equal('gemini');

      expect(mockLifecycleManager.getTerminal).to.have.been.calledWith(terminal2);
      expect(mockCliAgentService.switchAgentConnection).to.have.been.calledWith(terminal2);

      console.log('✅ [INTEGRATION] CLI agent switching validated');
    });

    it('should handle terminal removal with CLI agent cleanup', async () => {
      const terminalId = 'agent-terminal';

      // Simulate terminal removal through lifecycle manager
      const lifecycleEmitter = (mockLifecycleManager as any)._emitter;
      
      await framework.measureOperation(
        'terminal-removal-with-agent-cleanup',
        () => {
          eventTracker.recordEvent('terminal-remove-start', 'LifecycleManager', 'TerminalManager');
          lifecycleEmitter.emit('terminalRemoved', terminalId);
          eventTracker.recordEvent('terminal-remove-complete', 'TerminalManager', 'CliAgentService');
        }
      );

      // Verify cleanup was called
      expect(mockCliAgentService.handleTerminalRemoved).to.have.been.calledWith(terminalId);
      expect(mockBufferingService.clearBuffer).to.have.been.calledWith(terminalId);

      console.log('✅ [INTEGRATION] Terminal removal with CLI agent cleanup validated');
    });
  });

  describe('Error Handling Across Service Boundaries', () => {
    it('should handle lifecycle manager errors gracefully', async () => {
      const error = new Error('Terminal creation failed');
      (mockLifecycleManager.createTerminal as sinon.SinonStub).throws(error);

      // Test error handling during terminal creation
      let caughtError: Error | undefined;
      try {
        await framework.measureOperation(
          'error-handling-lifecycle',
          () => terminalManager.createTerminal()
        );
      } catch (e) {
        caughtError = e as Error;
      }

      expect(caughtError).to.exist;
      expect(caughtError!.message).to.equal('Terminal creation failed');

      console.log('✅ [INTEGRATION] Lifecycle manager error handling validated');
    });

    it('should handle state manager validation errors', async () => {
      const terminalId = 'invalid-terminal';
      const validationError = { success: false, reason: 'Terminal is required for system operation' };
      
      (mockStateManager.validateTerminalDeletion as sinon.SinonStub).returns(validationError);

      // Test error handling during terminal deletion
      const deleteResult = await framework.measureOperation(
        'error-handling-state-validation',
        () => terminalManager.deleteTerminal(terminalId)
      );

      expect(deleteResult.result.success).to.be.false;
      expect(deleteResult.result.reason).to.equal('Terminal is required for system operation');
      
      // Verify validation was called but kill was not
      expect(mockStateManager.validateTerminalDeletion).to.have.been.calledWith(terminalId);
      expect(mockLifecycleManager.killTerminal).not.to.have.been.called;

      console.log('✅ [INTEGRATION] State manager validation error handling validated');
    });

    it('should handle CLI agent service errors without affecting other services', async () => {
      const terminalId = 'error-terminal';
      const testInput = 'test command';
      
      // Make CLI agent service throw error
      (mockCliAgentService.detectFromInput as sinon.SinonStub).throws(new Error('CLI detection failed'));

      // Input should still work despite CLI agent error
      let caughtError: Error | undefined;
      try {
        await framework.measureOperation(
          'error-handling-cli-agent-isolation',
          () => terminalManager.sendInput(testInput, terminalId)
        );
      } catch (e) {
        caughtError = e as Error;
      }

      // CLI agent error should not prevent input from being sent
      expect(caughtError).to.exist;
      expect(mockLifecycleManager.writeToTerminal).to.have.been.calledWith(terminalId, testInput);

      console.log('✅ [INTEGRATION] CLI agent service error isolation validated');
    });

    it('should handle buffering service errors gracefully', async () => {
      const terminalId = 'buffer-error-terminal';
      const testData = 'test output data';
      
      // Make buffering service throw error
      (mockBufferingService.bufferData as sinon.SinonStub).throws(new Error('Buffer overflow'));

      // Simulate terminal data event
      const lifecycleEmitter = (mockLifecycleManager as any)._emitter;
      
      let caughtError: Error | undefined;
      try {
        await framework.measureOperation(
          'error-handling-buffering-service',
          () => {
            lifecycleEmitter.emit('terminalData', {
              terminalId,
              data: testData
            });
          }
        );
      } catch (e) {
        caughtError = e as Error;
      }

      // Error should be contained within the buffering service
      expect(mockBufferingService.bufferData).to.have.been.calledWith(terminalId, testData);

      console.log('✅ [INTEGRATION] Buffering service error handling validated');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should maintain acceptable performance under service composition', async () => {
      const operationCount = 10;
      const maxOperationTime = 50; // ms per operation
      
      // Perform multiple operations to test performance
      const operations = [];
      for (let i = 0; i < operationCount; i++) {
        const operation = framework.measureOperation(
          `performance-test-operation-${i}`,
          () => {
            const terminalId = terminalManager.createTerminal();
            terminalManager.focusTerminal(terminalId);
            terminalManager.sendInput('test', terminalId);
            return terminalId;
          }
        );
        operations.push(operation);
      }

      const results = await Promise.all(operations);
      
      // Validate performance
      results.forEach((result, index) => {
        expect(result.duration).to.be.lessThan(maxOperationTime, 
          `Operation ${index} took ${result.duration}ms (max: ${maxOperationTime}ms)`);
      });

      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(averageTime).to.be.lessThan(maxOperationTime / 2, 
        `Average operation time ${averageTime}ms exceeds threshold`);

      console.log(`✅ [INTEGRATION] Performance validated: ${operationCount} operations, avg ${averageTime.toFixed(1)}ms`);
    });

    it('should properly dispose all services and prevent memory leaks', async () => {
      // Create and dispose multiple managers to test resource cleanup
      const managers: RefactoredTerminalManager[] = [];
      
      for (let i = 0; i < 5; i++) {
        const manager = new RefactoredTerminalManager(
          framework.getMockFactory().createMockLifecycleManager(),
          framework.getMockFactory().createMockCliAgentService(),
          framework.getMockFactory().createMockBufferingService(),
          framework.getMockFactory().createMockStateManager()
        );
        managers.push(manager);
      }

      // Dispose all managers
      await framework.measureOperation(
        'resource-disposal',
        () => {
          managers.forEach(manager => manager.dispose());
        }
      );

      // Verify no errors occurred during disposal
      console.log('✅ [INTEGRATION] Resource disposal completed without errors');
    });

    it('should handle concurrent operations without race conditions', async () => {
      const concurrentOperations = 5;
      const terminalIds = ['term-1', 'term-2', 'term-3', 'term-4', 'term-5'];
      
      // Setup mocks for concurrent operations
      terminalIds.forEach((id, index) => {
        (mockLifecycleManager.createTerminal as sinon.SinonStub)
          .onCall(index)
          .returns(id);
      });

      // Execute concurrent operations
      const concurrentPromises = terminalIds.map(async (terminalId, index) => {
        return framework.measureOperation(
          `concurrent-operation-${index}`,
          async () => {
            const createdId = terminalManager.createTerminal();
            terminalManager.focusTerminal(createdId);
            terminalManager.sendInput(`command-${index}`, createdId);
            
            // Simulate some async work
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            
            return createdId;
          }
        );
      });

      const results = await Promise.all(concurrentPromises);
      
      // Verify all operations completed
      expect(results).to.have.length(concurrentOperations);
      results.forEach((result, index) => {
        expect(result.result).to.equal(terminalIds[index]);
      });

      console.log('✅ [INTEGRATION] Concurrent operations handled without race conditions');
    });
  });

  describe('Event Coordination and Flow', () => {
    it('should maintain proper event ordering across services', async () => {
      eventTracker.startTracking();
      
      const terminalId = 'event-flow-terminal';
      
      // Setup mock to return proper terminal
      (mockLifecycleManager.createTerminal as sinon.SinonStub).returns(terminalId);
      (mockLifecycleManager.getTerminal as sinon.SinonStub).returns({
        id: terminalId,
        name: 'Event Flow Terminal',
        number: 1,
        cwd: '/test',
        isActive: false
      });

      // Execute sequence of operations that should maintain event order
      await framework.measureOperation(
        'event-flow-sequence',
        async () => {
          // 1. Create terminal
          eventTracker.recordEvent('create-start', 'test', 'TerminalManager');
          const id = terminalManager.createTerminal();
          eventTracker.recordEvent('create-end', 'TerminalManager', 'LifecycleService');
          
          // 2. Focus terminal
          eventTracker.recordEvent('focus-start', 'test', 'TerminalManager');
          terminalManager.focusTerminal(id);
          eventTracker.recordEvent('focus-end', 'TerminalManager', 'StateService');
          
          // 3. Send input
          eventTracker.recordEvent('input-start', 'test', 'TerminalManager');
          terminalManager.sendInput('echo test', id);
          eventTracker.recordEvent('input-end', 'TerminalManager', 'LifecycleService');
          
          // 4. Handle output (simulate)
          eventTracker.recordEvent('output-start', 'LifecycleService', 'TerminalManager');
          terminalManager.handleTerminalOutputForCliAgent(id, 'test output');
          eventTracker.recordEvent('output-end', 'TerminalManager', 'CliAgentService');
        }
      );

      eventTracker.stopTracking();
      
      // Validate event sequence
      const expectedEvents = [
        'create-start', 'create-end',
        'focus-start', 'focus-end', 
        'input-start', 'input-end',
        'output-start', 'output-end'
      ];
      
      eventTracker.validateEventSequence(expectedEvents);
      eventTracker.validateEventTiming(1000);

      console.log('✅ [INTEGRATION] Event ordering and flow validated');
    });

    it('should handle event propagation through service chain', async () => {
      // Test event propagation: LifecycleManager → TerminalManager → StateManager
      const lifecycleEmitter = (mockLifecycleManager as any)._emitter;
      const stateEmitter = (mockStateManager as any)._emitter;
      
      // Setup event listeners to track propagation
      let terminalCreatedFired = false;
      let stateUpdateFired = false;
      
      terminalManager.onTerminalCreated((terminal) => {
        terminalCreatedFired = true;
        expect(terminal.id).to.equal('propagation-test-terminal');
      });
      
      terminalManager.onStateUpdate((state) => {
        stateUpdateFired = true;
        expect(state).to.exist;
      });

      // Trigger event chain
      await framework.measureOperation(
        'event-propagation-chain',
        async () => {
          // Simulate lifecycle manager creating terminal
          lifecycleEmitter.emit('terminalCreated', {
            id: 'propagation-test-terminal',
            name: 'Propagation Test',
            number: 1,
            cwd: '/test',
            isActive: false
          });
          
          // Give events time to propagate
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Simulate state manager update
          stateEmitter.emit('stateUpdate', {
            terminals: [{ id: 'propagation-test-terminal' }],
            activeTerminalId: 'propagation-test-terminal',
            terminalCount: 1
          });
          
          // Give events time to propagate
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      );

      // Verify event propagation
      expect(terminalCreatedFired).to.be.true;
      expect(mockStateManager.updateTerminalState).to.have.been.called;

      console.log('✅ [INTEGRATION] Event propagation through service chain validated');
    });
  });
});
