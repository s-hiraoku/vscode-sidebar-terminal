# VS Code-Style Scrollback Service Implementation

## Summary

Successfully implemented VS Code-compatible scrollback service with comprehensive testing.

## Implementation Status

### ✅ Completed

1. **IScrollbackService Interface** (`src/services/scrollback/IScrollbackService.ts`)
   - VS Code-compatible scrollback service interface
   - Configuration with VS Code defaults (10MB, 10 seconds, 1000/100 lines)
   - Flow control constants (100K/5K watermarks)
   - Replay event format matching VS Code pattern

2. **ScrollbackService** (`src/services/scrollback/ScrollbackService.ts`)
   - Time-bounded recording (10 seconds default)
   - Size-bounded recording (10MB default)
   - Flow control tracking
   - Terminal dimension tracking
   - Configurable scrollback limits

3. **Comprehensive Tests** (`src/test/unit/services/scrollback/ScrollbackService.test.ts`)
   - 42 tests, all passing
   - Coverage: basic operations, size limits, time limits, flow control
   - Performance tests: 1000 rapid writes, large chunks
   - Edge cases: non-existent terminals, duplicate sessions

4. **Logger Integration** (`src/utils/logger.ts`)
   - Added `scrollback()` logging category
   - DEBUG level with 📋 icon

## Architecture

```
ScrollbackService
├── Recording Management
│   ├── startRecording(terminalId)
│   ├── stopRecording(terminalId)
│   └── recordData(terminalId, data)
├── Serialization
│   ├── getSerializedData(terminalId, options)
│   └── getReplayEvent(terminalId)
├── Flow Control
│   ├── acknowledgeChars(terminalId, charCount)
│   ├── shouldPausePty(terminalId)
│   └── shouldResumePty(terminalId)
└── Monitoring
    ├── getScrollbackStats(terminalId)
    └── updateTerminalDimensions(terminalId, cols, rows)
```

## Integration Points

### Current State
The persistence service currently uses xterm.js `SerializeAddon` directly:
- `ConsolidatedTerminalPersistenceService` line 1081: `serializeAddon.serialize()`
- WebView persistence manager uses SerializeAddon for serialization

### Integration Options

#### Option 1: Replace SerializeAddon (Full Integration)
Replace direct SerializeAddon usage with ScrollbackService:

```typescript
// Instead of:
const content = serializeAddon.serialize({ scrollback: 100 });

// Use:
scrollbackService.startRecording(terminalId);
// ... record terminal output via pty.onData ...
const content = scrollbackService.getSerializedData(terminalId, { scrollback: 100 });
```

#### Option 2: Hybrid Approach (Recommended)
Use ScrollbackService for recording with limits, SerializeAddon for final serialization:

```typescript
// Record with time/size limits
scrollbackService.startRecording(terminalId);
pty.onData(data => {
  scrollbackService.recordData(terminalId, data);
  
  // Flow control
  if (scrollbackService.shouldPausePty(terminalId)) {
    pty.pause();
  }
});

// When saving, use SerializeAddon (already working)
const content = serializeAddon.serialize({ scrollback: 100 });

// Or use ScrollbackService if needed
const stats = scrollbackService.getScrollbackStats(terminalId);
if (stats.sizeLimitReached || stats.timeLimitReached) {
  // Handle truncation
}
```

## Benefits Over Direct SerializeAddon

1. **Time Limits**: Automatic 10-second recording limit (VS Code pattern)
2. **Size Limits**: 10MB limit prevents excessive memory usage
3. **Flow Control**: Built-in PTY pause/resume via watermarks
4. **Statistics**: Detailed recording stats for monitoring
5. **VS Code Compatibility**: Matches VS Code TerminalRecorder design

## Next Steps

To fully integrate:

1. **Add to TerminalManager**: Initialize ScrollbackService per terminal
2. **Hook into PTY Data**: Call `recordData()` on pty.onData events
3. **Use in Persistence**: Replace/augment SerializeAddon usage
4. **Implement Flow Control**: Use `shouldPausePty()`/`shouldResumePty()`

## Configuration

Default values (VS Code-compatible):
```typescript
{
  scrollback: 1000,                    // Active terminal buffer
  persistentSessionScrollback: 100,     // Saved session limit
  maxRecordingSize: 10 * 1024 * 1024,  // 10MB
  maxRecordingDuration: 10000,          // 10 seconds
  flowControlHighWatermark: 100000,     // Pause PTY
  flowControlLowWatermark: 5000,        // Resume PTY
}
```

## Test Coverage

- ✅ 42/42 tests passing
- ✅ Size limit enforcement
- ✅ Time limit enforcement (with async tests)
- ✅ Flow control watermark detection
- ✅ Performance tests (1000 writes < 1 second)
- ✅ Unicode handling (Japanese, emoji)
- ✅ Edge cases (null checks, duplicate sessions)

## References

- VS Code: `src/vs/platform/terminal/common/terminalRecorder.ts`
- Interface: `src/services/scrollback/IScrollbackService.ts`
- Implementation: `src/services/scrollback/ScrollbackService.ts`
- Tests: `src/test/unit/services/scrollback/ScrollbackService.test.ts`

## Commit

`f943e3e` - feat: implement VS Code-style scrollback service with comprehensive tests
