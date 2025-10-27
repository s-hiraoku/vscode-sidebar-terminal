# Phase 2 Week 1: BufferManagementService Integration Guide

## Overview

This document describes how to integrate BufferManagementService with TerminalManager. The actual integration will occur in **Phase 2 Week 3** when DIContainer is bootstrapped in ExtensionLifecycle.

## Current Buffer Implementation in TerminalManager

### Private Properties (src/terminals/TerminalManager.ts:60-63)

```typescript
private readonly _dataBuffers = new Map<string, string[]>();
private readonly _dataFlushTimers = new Map<string, NodeJS.Timeout>();
private readonly DATA_FLUSH_INTERVAL = 8; // ~125fps
private readonly MAX_BUFFER_SIZE = 50;
```

### Methods to Replace

#### 1. `_bufferData(terminalId: string, data: string)` (line 1049)
**Purpose**: Buffer incoming terminal data
**Current Logic**:
- Validates terminal ID
- Creates buffer if doesn't exist
- Normalizes ANSI escape sequences
- Pushes data to buffer
- Flushes immediately if buffer full (>= 50 chars) or data large (> 1000 chars)
- Otherwise schedules periodic flush

**Migration to BufferManagementService**:
```typescript
// OLD
this._bufferData(terminalId, data);

// NEW (after Phase 2 Week 3)
const terminalIdNum = parseInt(terminalId, 10);
const buffered = this._bufferService.write(terminalIdNum, normalizedData);
if (!buffered) {
  // Data was flushed immediately due to overflow
}
```

#### 2. `_scheduleFlush(terminalId: string)` (line 1111)
**Purpose**: Schedule periodic buffer flush
**Current Logic**:
- Creates timer if doesn't exist
- Flushes after DATA_FLUSH_INTERVAL (8ms)

**Migration**: Handled automatically by BufferManagementService timer

#### 3. `_flushBuffer(terminalId: string)` (line 1120)
**Purpose**: Flush single terminal buffer
**Current Logic**:
- Validates terminal ID
- Checks terminal still exists
- Clears flush timer
- Gets buffer data
- Joins buffer content
- Clears buffer array
- Sends to WebView via MessageManager

**Migration to BufferManagementService**:
```typescript
// OLD
this._flushBuffer(terminalId);

// NEW (after Phase 2 Week 3)
const terminalIdNum = parseInt(terminalId, 10);
const data = this._bufferService.flush(terminalIdNum);
if (data) {
  // Send to WebView
  this._messageManager?.postMessage({
    command: 'output',
    terminalId: terminalIdNum,
    data: data
  });
}
```

#### 4. `_flushAllBuffers()` (line 1180)
**Purpose**: Flush all terminal buffers
**Current Logic**:
- Iterates all buffer keys
- Calls `_flushBuffer` for each

**Migration to BufferManagementService**:
```typescript
// OLD
this._flushAllBuffers();

// NEW (after Phase 2 Week 3)
const flushedData = this._bufferService.flushAll();
for (const [terminalId, data] of flushedData) {
  // Send to WebView
  this._messageManager?.postMessage({
    command: 'output',
    terminalId,
    data
  });
}
```

### Usage Points to Update

#### 1. Data Reception (lines 391, 1540)
```typescript
// OLD
this._bufferData(terminalId, data);

// NEW
const terminalIdNum = parseInt(terminalId, 10);
this._bufferService.write(terminalIdNum, data);
```

#### 2. Disposal Cleanup (lines 1020-1026)
```typescript
// OLD
this._flushAllBuffers();
for (const timer of this._dataFlushTimers.values()) {
  clearTimeout(timer);
}
this._dataBuffers.clear();
this._dataFlushTimers.clear();

// NEW
this._bufferService.dispose();
```

#### 3. Terminal Removal (lines 1219-1225)
```typescript
// OLD
this._flushBuffer(terminalId);
this._dataBuffers.delete(terminalId);
const timer = this._dataFlushTimers.get(terminalId);
if (timer) {
  clearTimeout(timer);
  this._dataFlushTimers.delete(terminalId);
}

// NEW
const terminalIdNum = parseInt(terminalId, 10);
this._bufferService.disposeBuffer(terminalIdNum);
```

## Configuration Differences

### Current TerminalManager Configuration
- **Flush Interval**: 8ms (125fps)
- **Max Buffer Size**: 50 characters
- **Adaptive Buffering**: Not implemented
- **CLI Agent Optimization**: Not implemented

### BufferManagementService Configuration
- **Default Flush Interval**: 16ms (60fps)
- **CLI Agent Flush Interval**: 4ms (250fps)
- **Max Buffer Size**: 50 characters
- **Adaptive Buffering**: Enabled by default
- **CLI Agent Optimization**: Automatic

### Migration Strategy

**Option 1: Match Current Behavior** (Recommended for Phase 2 Week 3)
```typescript
// Initialize with current TerminalManager settings
bufferService.initializeBuffer(terminalId, {
  flushInterval: 8,  // Match current 125fps
  maxBufferSize: 50,
  adaptiveBuffering: false  // Disable initially for stability
});
```

**Option 2: Use New Defaults** (Can enable later after testing)
```typescript
// Use BufferManagementService defaults
bufferService.initializeBuffer(terminalId);
// Benefits: CLI Agent optimization, adaptive buffering
```

## Event Handling

### Subscribe to Buffer Events

```typescript
// In TerminalManager constructor or initialize()
this._bufferService.subscribe(BufferFlushedEvent, (event) => {
  const { terminalId, data } = event.data;

  // Send to WebView
  this._messageManager?.postMessage({
    command: 'output',
    terminalId,
    data
  });
});

this._bufferService.subscribe(BufferOverflowEvent, (event) => {
  const { terminalId, size, maxSize } = event.data;
  log(`⚠️ [BUFFER] Overflow for terminal ${terminalId}: ${size}/${maxSize}`);
});
```

## CLI Agent Integration

### Automatic Optimization

When CLI agent is detected, BufferManagementService automatically switches to high-performance mode:

```typescript
// Current: Manual high-frequency output handling in TerminalManager
// Future: Automatic via BufferManagementService

// When CLI agent detected (in _handleCliAgentStatusUpdate or similar)
this._bufferService.onCliAgentDetected(terminalId);

// When CLI agent disconnects
this._bufferService.onCliAgentDisconnected(terminalId);
```

## Testing Strategy

### Phase 2 Week 3 Integration Testing

1. **Unit Tests**: ✅ Already complete (40 tests, 100% pass)

2. **Integration Tests**: Create in Phase 2 Week 3
   - Test TerminalManager with BufferManagementService
   - Verify data flow: Terminal → Buffer → WebView
   - Test CLI agent mode switching
   - Test disposal and cleanup

3. **Manual Testing Checklist**:
   - [ ] Normal terminal output displays correctly
   - [ ] High-frequency output (e.g., `cat large_file.txt`) performs well
   - [ ] CLI agent detection triggers performance mode
   - [ ] Multiple terminals buffer independently
   - [ ] Terminal deletion cleans up buffers
   - [ ] Extension reload/dispose cleans up all buffers
   - [ ] No memory leaks after extended use

## Rollback Plan

If integration causes issues in Phase 2 Week 3:

1. **Feature Flag**: Add configuration setting
   ```json
   "secondaryTerminal.experimental.useBufferService": false
   ```

2. **Conditional Usage**: Keep old buffer code as fallback
   ```typescript
   if (config.get('experimental.useBufferService')) {
     this._bufferService.write(terminalId, data);
   } else {
     this._bufferData(terminalId, data); // Legacy
   }
   ```

3. **Complete Rollback**: Revert to commit before integration

## Performance Expectations

### Current Implementation
- Flush interval: 8ms (125fps)
- No CLI agent optimization
- Fixed timing for all scenarios

### After BufferManagementService Integration
- **Normal Mode**: 16ms (60fps) - slightly slower but more efficient
- **CLI Agent Mode**: 4ms (250fps) - 2x faster than current
- **Adaptive**: Automatically switches based on context
- **Net Result**: Better overall performance and responsiveness

## Dependencies

### Required for Integration (Phase 2 Week 3)
- ✅ BufferManagementService implemented
- ✅ Comprehensive test suite (40 tests)
- ✅ Service registration helper created
- ⏳ DIContainer bootstrapped in ExtensionLifecycle
- ⏳ EventBus integrated in TerminalManager
- ⏳ Integration tests created

### Safe Integration Order
1. Bootstrap DIContainer in ExtensionLifecycle
2. Register EventBus as singleton
3. Register BufferManagementService
4. Update TerminalManager constructor to accept BufferManagementService
5. Replace buffer methods with service calls
6. Subscribe to buffer events
7. Remove old buffer code
8. Run comprehensive test suite
9. Manual testing with real terminals
10. Feature flag for gradual rollout

## Status

- **Phase 2 Week 1**: ✅ Complete
  - BufferManagementService implemented
  - 40 unit tests (100% pass)
  - Service registration helper created
  - Integration documentation complete

- **Phase 2 Week 3**: ⏳ Pending
  - Actual TerminalManager integration
  - DIContainer bootstrap
  - Integration testing
  - Performance validation

## Contact

For questions about BufferManagementService integration:
- Review this document
- Check `src/services/buffer/IBufferManagementService.ts` for interface
- Check `src/test/unit/services/buffer/BufferManagementService.test.ts` for usage examples
- Reference PHASE2_PLAN.md for overall architecture
