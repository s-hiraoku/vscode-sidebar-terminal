# Integration Test Framework for Refactored Terminal Management System

## Overview

This directory contains a comprehensive integration test framework specifically designed for the refactored terminal management system. The framework provides:

- **Service Composition Testing** - Validates that all injected services work together correctly
- **End-to-End Workflow Testing** - Tests complete user scenarios from terminal creation to deletion
- **Event Flow Validation** - Monitors and validates event coordination between services
- **Performance Monitoring** - Tracks resource usage and memory leaks during tests
- **Error Handling Verification** - Ensures graceful error handling across service boundaries

## Architecture

### Core Components

#### 1. IntegrationTestFramework.ts

The main framework that provides:

- **MockServiceFactory** - Creates mock implementations of all services with realistic behavior
- **EventFlowTracker** - Monitors event flow between services and validates proper sequencing
- **PerformanceMonitor** - Tracks memory usage and detects leaks during test execution
- **Test Environment Setup** - Configures VS Code test environment with proper mocks

#### 2. TerminalManager.integration.test.ts

Comprehensive tests for `RefactoredTerminalManager`:

- Service composition and dependency injection validation
- Complete terminal lifecycle testing (create → use → delete)
- CLI Agent detection integration across services
- Error handling across service boundaries
- Performance under service composition
- Concurrent operations without race conditions

#### 3. Provider.integration.test.ts

Integration tests for `RefactoredSecondaryTerminalProvider`:

- WebView resolution and resource management
- Message routing and event coordination
- Configuration flow and settings management
- Service composition within provider context
- Resource cleanup and memory leak prevention

## Key Features

### Service Composition Testing

The framework validates that the refactored architecture maintains the same functionality as the original code while providing improved maintainability:

```typescript
// Example: Testing service composition
const terminalManager = new RefactoredTerminalManager(
  mockLifecycleManager,
  mockCliAgentService,
  mockBufferingService,
  mockStateManager
);

// Verify services work together
const health = terminalManager.getServiceHealth();
framework.validateServiceHealth(health);
```

### Event Flow Validation

Tracks and validates event flow between services:

```typescript
eventTracker.startTracking();

// Perform operations
terminalManager.createTerminal();
terminalManager.focusTerminal(terminalId);

// Validate event sequence
const expectedEvents = ['create-start', 'create-end', 'focus-start', 'focus-end'];
eventTracker.validateEventSequence(expectedEvents);
```

### Performance Monitoring

Continuously monitors performance and memory usage:

```typescript
// Memory leak detection
const { result, duration } = await framework.measureOperation('terminal-creation', () =>
  terminalManager.createTerminal()
);

// Validate performance thresholds
expect(duration).to.be.lessThan(100, 'Operation should be fast');
performanceMonitor.checkMemoryLeak(512); // Max 512KB increase
```

### Error Isolation Testing

Verifies that service failures don't cascade:

```typescript
// Make one service fail
(mockLifecycleManager.createTerminal as sinon.SinonStub).throws(new Error('Service failure'));

// Other services should still function
const stats = terminalManager.getPerformanceMetrics();
expect(stats.bufferingStats).to.exist; // Buffering service still works
```

## Test Configuration

### Framework Configuration

```typescript
const framework = await setupIntegrationTest('Test Name', {
  enablePerformanceMonitoring: true,
  enableMemoryLeakDetection: true,
  enableEventFlowTracking: true,
  maxOperationTime: 1000,
  maxMemoryIncrease: 512,
  eventTimeoutMs: 5000,
});
```

### Performance Thresholds

- **Service Initialization**: < 200ms
- **Terminal Operations**: < 100ms
- **Memory Increase**: < 1024KB during test
- **Event Processing**: > 20 events/sec throughput

## Running Integration Tests

### Individual Test Suites

```bash
# Run integration tests only
npm run test:integration

# Run performance tests only
npm run test:performance

# Run both integration and performance tests
npm run test:refactored

# Run all tests (unit + integration + performance)
npm run test:all
```

### Test Output

The framework provides detailed reporting:

```
🧪 Integration Test Report
=========================

📊 Event Flow Report
==================
Total Events: 8
Event Types: 4 (create-start, create-end, focus-start, focus-end)
Services Involved: 3 (TerminalManager, LifecycleManager, StateManager)
Duration: 45ms

📊 Performance Report
====================
Samples: 10
Memory Usage (KB):
  Average: 1024.5
  Max: 1156
  Min: 987
  Increase: 132.0
```

## Test Scenarios Covered

### Terminal Manager Integration Tests

1. **Service Composition and Dependency Injection**
   - Service health validation
   - Service isolation with communication
   - Performance metrics aggregation

2. **End-to-End Terminal Workflow**
   - Complete lifecycle: create → use → delete
   - Data buffering and CLI agent detection integration
   - Multiple terminal isolation

3. **CLI Agent Detection Integration**
   - Cross-service coordination
   - Agent switching between terminals
   - Terminal removal with cleanup

4. **Error Handling Across Service Boundaries**
   - Lifecycle manager error handling
   - State manager validation errors
   - CLI agent service error isolation
   - Buffering service error containment

5. **Performance and Resource Management**
   - Service composition performance
   - Resource disposal and memory leak prevention
   - Concurrent operations without race conditions

### Provider Integration Tests

1. **Provider Initialization and Service Composition**
   - All services with dependency injection
   - Terminal manager access for backward compatibility
   - Provider configuration handling

2. **WebView Resolution and Resource Management**
   - Resource configuration and message router setup
   - Error handling during resolution
   - Initial settings transmission

3. **Message Routing and Event Coordination**
   - Message handler setup for all operations
   - WebView ready message handling
   - Terminal operation messages with service coordination

4. **Resource Management and Cleanup**
   - Proper service disposal
   - Multiple disposal call handling
   - Memory leak prevention during lifecycle

5. **Performance and Scalability**
   - Multiple WebView operations performance
   - High-frequency message routing efficiency

## Performance Test Suite

### Service Initialization Performance

- RefactoredTerminalManager initialization timing
- RefactoredSecondaryTerminalProvider initialization timing
- Multiple service initialization without degradation

### Terminal Operations Performance

- Terminal creation under stress
- Input operations under stress
- Concurrent terminal operations
- Terminal deletion performance

### Data Buffering Performance

- High-frequency data buffering efficiency
- Concurrent buffering load testing

### Event Handling Throughput

- High-throughput event processing
- Event ordering under high load

### Memory Leak Detection

- Repeated service creation/disposal
- Provider lifecycle stress testing
- Resource cleanup under stress

## Best Practices

### 1. TDD Implementation

All tests follow Test-Driven Development principles:

- Tests written before implementation
- Red-Green-Refactor cycle adherence
- Comprehensive coverage of user scenarios

### 2. Realistic Mock Behavior

Mock services provide realistic behavior:

- Event emitters for proper event flow
- Asynchronous operations where appropriate
- Error conditions for robustness testing

### 3. Performance Validation

Every test includes performance validation:

- Operation timing measurements
- Memory usage monitoring
- Throughput requirements verification

### 4. Error Handling Testing

Comprehensive error scenario coverage:

- Service failure isolation
- Graceful degradation testing
- Recovery mechanism validation

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout values in test configuration
   - Check for hanging promises in async operations

2. **Memory Leak Warnings**
   - Verify all services are properly disposed
   - Check for retained event listeners

3. **Event Flow Validation Failures**
   - Ensure proper event timing in tests
   - Verify mock service event emission

### Debug Output

Enable detailed debugging:

```typescript
const framework = await setupIntegrationTest('Test Name', {
  enableDebugging: true,
});
```

This will provide verbose logging of:

- Service initialization
- Event flow tracking
- Performance measurements
- Error handling

## Future Enhancements

1. **WebView Integration Testing**
   - Real WebView component testing
   - Browser automation for UI testing

2. **VS Code Extension Testing**
   - Full extension host integration
   - Real VS Code environment testing

3. **Load Testing**
   - High-concurrency stress testing
   - Extended duration testing

4. **Cross-Platform Testing**
   - Platform-specific behavior validation
   - Node-pty integration testing

The integration test framework ensures that the refactored terminal management system maintains all existing functionality while providing improved architecture, maintainability, and performance.
