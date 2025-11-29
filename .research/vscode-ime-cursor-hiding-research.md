# VS Code Terminal IME Cursor Hiding - Research Summary

## Executive Summary

VS Code's xterm.js library implements cursor hiding during IME composition through a **three-layer approach**:

1. **CoreService Flag**: `coreService.isCursorHidden` - Primary visibility control
2. **CursorBlinkStateManager**: Controls cursor blink animation and visibility state
3. **Renderer Check**: Conditional rendering based on visibility flags

The current implementation in this project **correctly implements** this pattern in `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/webview/managers/input/handlers/IMEHandler.ts`.

---

## Key Source Files

### xterm.js Core Files (Authoritative Reference)

1. **CompositionHelper.ts** (`src/browser/input/CompositionHelper.ts`)
   - Manages IME composition lifecycle
   - Handles `compositionstart`, `compositionupdate`, `compositionend` events
   - Positions composition view overlay at cursor position
   - **Does NOT directly control cursor visibility** (handled by renderer)

2. **CursorBlinkStateManager.ts** (`addons/addon-webgl/src/CursorBlinkStateManager.ts`)
   - Controls cursor blink timing and visibility state
   - Provides `isCursorVisible` boolean flag
   - Methods: `pause()`, `resume()`, `restartBlinkAnimation()`
   - Used by WebGL renderer to control cursor rendering

3. **WebglRenderer.ts** (`addons/addon-webgl/src/WebglRenderer.ts`)
   - **Line 357-360**: Cursor rendering logic
   - **Line 408-409**: Cursor visibility determination
   - Checks `coreService.isCursorHidden` and `_cursorBlinkStateManager.value.isCursorVisible`

---

## VS Code's Cursor Visibility Architecture

### Three-Layer Visibility Control

```typescript
// Layer 1: CoreService Flag (Primary Control)
const isCursorVisible =
  this._coreService.isCursorInitialized &&
  !this._coreService.isCursorHidden &&  // ← Primary flag
  (!this._cursorBlinkStateManager.value ||
   this._cursorBlinkStateManager.value.isCursorVisible);

// Layer 2: CursorBlinkStateManager (Blink Animation)
if (!this._cursorBlinkStateManager.value ||
    this._cursorBlinkStateManager.value.isCursorVisible) {
  this._rectangleRenderer.value.renderCursor();
}

// Layer 3: Renderer Conditional (Final Rendering)
if (isCursorVisible && row === cursorY && x === cursorX) {
  this._model.cursor = {
    x: cursorX,
    y: viewportRelativeCursorY,
    width: cell.getWidth(),
    style: cursorStyle,
    cursorWidth: terminal.options.cursorWidth,
    dpr: this._devicePixelRatio
  };
}
```

### WebglRenderer.ts - Cursor Rendering Logic

**File**: `addons/addon-webgl/src/WebglRenderer.ts`

**Key Lines**:

```typescript
// Line 357-360: Main render loop
if (!this._cursorBlinkStateManager.value ||
    this._cursorBlinkStateManager.value.isCursorVisible) {
  this._rectangleRenderer.value.renderCursor();
}

// Line 406-410: Visibility calculation in _updateModel()
const isCursorVisible =
  this._coreService.isCursorInitialized &&
  !this._coreService.isCursorHidden &&  // ← PRIMARY FLAG FOR IME
  (!this._cursorBlinkStateManager.value ||
   this._cursorBlinkStateManager.value.isCursorVisible);
this._model.cursor = undefined;

// Line 477-500: Cursor model setup and color overrides
if (isCursorVisible && row === cursorY) {
  if (x === cursorX) {
    this._model.cursor = {
      x: cursorX,
      y: viewportRelativeCursorY,
      width: cell.getWidth(),
      style: this._coreBrowserService.isFocused ? cursorStyle :
             terminal.options.cursorInactiveStyle,
      cursorWidth: terminal.options.cursorWidth,
      dpr: this._devicePixelRatio
    };
    lastCursorX = cursorX + cell.getWidth() - 1;
  }
  // Override colors for cursor cell in block mode
  if (x >= cursorX && x <= lastCursorX &&
      ((this._coreBrowserService.isFocused && cursorStyle === 'block') ||
       (!this._coreBrowserService.isFocused &&
        terminal.options.cursorInactiveStyle === 'block'))) {
    this._cellColorResolver.result.fg =
      Attributes.CM_RGB |
      (this._themeService.colors.cursorAccent.rgba >> 8 & Attributes.RGB_MASK);
    this._cellColorResolver.result.bg =
      Attributes.CM_RGB |
      (this._themeService.colors.cursor.rgba >> 8 & Attributes.RGB_MASK);
  }
}
```

---

## CompositionHelper Pattern (IME Event Management)

**File**: `src/browser/input/CompositionHelper.ts`

### Composition Lifecycle

```typescript
export class CompositionHelper {
  private _isComposing: boolean;
  public get isComposing(): boolean { return this._isComposing; }

  // Composition Start - Activate composition view
  public compositionstart(): void {
    this._isComposing = true;
    this._compositionPosition.start = this._textarea.value.length;
    this._compositionView.textContent = '';
    this._dataAlreadySent = '';
    this._compositionView.classList.add('active');
  }

  // Composition Update - Update composition view
  public compositionupdate(ev: Pick<CompositionEvent, 'data'>): void {
    this._compositionView.textContent = ev.data;
    this.updateCompositionElements();
    setTimeout(() => {
      this._compositionPosition.end = this._textarea.value.length;
    }, 0);
  }

  // Composition End - Hide composition view and send data
  public compositionend(): void {
    this._finalizeComposition(true);
  }

  private _finalizeComposition(waitForPropagation: boolean): void {
    this._compositionView.classList.remove('active');
    this._isComposing = false;

    if (!waitForPropagation) {
      // Immediate send for non-composition keystrokes
      const input = this._textarea.value.substring(
        this._compositionPosition.start,
        this._compositionPosition.end
      );
      this._coreService.triggerDataEvent(input, true);
    } else {
      // Delayed send using setTimeout(0) for proper event propagation
      this._isSendingComposition = true;
      setTimeout(() => {
        if (this._isSendingComposition) {
          this._isSendingComposition = false;
          let input;
          currentCompositionPosition.start += this._dataAlreadySent.length;
          if (this._isComposing) {
            input = this._textarea.value.substring(
              currentCompositionPosition.start,
              this._compositionPosition.start
            );
          } else {
            input = this._textarea.value.substring(
              currentCompositionPosition.start
            );
          }
          if (input.length > 0) {
            this._coreService.triggerDataEvent(input, true);
          }
        }
      }, 0);
    }
  }
}
```

### Key Design Patterns

1. **Position Tracking**: Composition view positioned at cursor location
2. **Async Finalization**: `setTimeout(0)` for proper event propagation
3. **Data Deduplication**: Tracks `_dataAlreadySent` to avoid duplicate characters
4. **Recursive Updates**: `updateCompositionElements()` recursively updates positioning

---

## CursorBlinkStateManager Pattern

**File**: `addons/addon-webgl/src/CursorBlinkStateManager.ts`

### Architecture

```typescript
export class CursorBlinkStateManager {
  public isCursorVisible: boolean;
  private _blinkInterval: number | undefined;
  private _blinkStartTimeout: number | undefined;
  private _animationFrame: number | undefined;
  private _animationTimeRestarted: number | undefined;

  constructor(
    private _renderCallback: () => void,
    private _coreBrowserService: ICoreBrowserService
  ) {
    this.isCursorVisible = true;
    if (this._coreBrowserService.isFocused) {
      this._restartInterval();
    }
  }

  // Pause blinking and make cursor visible
  public pause(): void {
    this.isCursorVisible = true;
    if (this._blinkInterval) {
      this._coreBrowserService.window.clearInterval(this._blinkInterval);
      this._blinkInterval = undefined;
    }
    // ... clear timers
  }

  // Resume blinking animation
  public resume(): void {
    this.pause();  // Clear existing timers
    this._animationTimeRestarted = undefined;
    this._restartInterval();
    this.restartBlinkAnimation();
  }

  // Restart blink animation (force visible first)
  public restartBlinkAnimation(): void {
    if (this.isPaused) return;
    this._animationTimeRestarted = Date.now();
    this.isCursorVisible = true;
    if (!this._animationFrame) {
      this._animationFrame = this._coreBrowserService.window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = undefined;
      });
    }
  }

  private _restartInterval(timeToStart: number = BLINK_INTERVAL): void {
    // Setup initial timeout to hide cursor
    this._blinkStartTimeout = this._coreBrowserService.window.setTimeout(() => {
      this.isCursorVisible = false;
      this._animationFrame = this._coreBrowserService.window.requestAnimationFrame(() => {
        this._renderCallback();
        this._animationFrame = undefined;
      });

      // Setup blink interval
      this._blinkInterval = this._coreBrowserService.window.setInterval(() => {
        this.isCursorVisible = !this.isCursorVisible;
        this._animationFrame = this._coreBrowserService.window.requestAnimationFrame(() => {
          this._renderCallback();
          this._animationFrame = undefined;
        });
      }, BLINK_INTERVAL);
    }, timeToStart);
  }
}
```

### Key Methods

- **`pause()`**: Stops blinking, sets `isCursorVisible = true`
- **`resume()`**: Restarts blinking from initial visible state
- **`restartBlinkAnimation()`**: Resets blink timing, forces visible
- **`isPaused`**: Check if blink animation is paused

---

## Current Implementation Analysis

### Project Implementation (IMEHandler.ts)

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/webview/managers/input/handlers/IMEHandler.ts`

**Lines 403-491**: `hideCursor()` method

```typescript
private hideCursor(terminalId: string): void {
  const terminal = this.coordinator.getTerminalInstance(terminalId);

  // 1. Hide cursor using xterm.js internal API
  coreService.isCursorHidden = true;  // ✅ CORRECT - Primary flag

  // 2. Control CursorBlinkStateManager for WebGL renderer
  const blinkManager = renderer._cursorBlinkStateManager.value;
  this.originalBlinkStates.set(terminalId, {
    wasPaused: blinkManager.isPaused,
    originalIsCursorVisible: blinkManager.isCursorVisible
  });

  blinkManager.isCursorVisible = false;  // ✅ CORRECT - Secondary control
  if (!blinkManager.isPaused) {
    blinkManager.pause();  // ✅ CORRECT - Stop blinking
  }

  // 3. ADDITIONAL: Clear buffer cell at cursor position
  // This removes the visible half-width space character
  const buffer = bufferService.buffer;
  const line = buffer.lines.get(buffer.y);
  const nullCell = buffer.getNullCell();
  line.setCell(buffer.x, nullCell);  // ✅ ENHANCEMENT - Not in VS Code

  // 4. Trigger render refresh
  renderService._onRequestRefreshRows.fire({ start: buffer.y, end: buffer.y });
}
```

**Lines 496-585**: `showCursor()` method

```typescript
private showCursor(terminalId: string): void {
  const terminal = this.coordinator.getTerminalInstance(terminalId);

  // 1. Restore buffer cell content if saved (ENHANCEMENT)
  const savedData = this.savedCellData.get(terminalId);
  // ... restoration logic (project-specific)

  // 2. Show cursor using xterm.js internal API
  coreService.isCursorHidden = false;  // ✅ CORRECT - Primary flag

  // 3. Restore CursorBlinkStateManager state
  const blinkManager = renderer._cursorBlinkStateManager.value;
  const originalState = this.originalBlinkStates.get(terminalId);

  if (originalState) {
    blinkManager.isCursorVisible = originalState.originalIsCursorVisible;
    if (!originalState.wasPaused && blinkManager.isPaused) {
      blinkManager.resume();  // ✅ CORRECT - Restore blinking
    }
  }

  // 4. Trigger render refresh
  renderService._onRequestRefreshRows.fire({ start: buffer.y, end: buffer.y });
}
```

### Comparison with VS Code Pattern

| Aspect | VS Code (xterm.js) | Current Implementation | Status |
|--------|-------------------|------------------------|--------|
| Primary visibility flag | `coreService.isCursorHidden` | ✅ Implemented (Line 427, 548) | ✅ CORRECT |
| Blink state control | `CursorBlinkStateManager.pause()` | ✅ Implemented (Line 443) | ✅ CORRECT |
| State restoration | Implicit via resume | ✅ Explicit state tracking (Line 434-438) | ✅ ENHANCED |
| Buffer cell clearing | N/A | ✅ Clear cell during composition (Line 472-477) | ✅ ENHANCEMENT |
| Render refresh | Automatic | ✅ Manual trigger (Line 481) | ✅ CORRECT |

---

## Architectural Decisions

### VS Code's Design Choices

1. **Separation of Concerns**:
   - **CompositionHelper**: IME event management, positioning
   - **CursorBlinkStateManager**: Cursor visibility timing
   - **Renderer**: Final visibility determination and rendering

2. **Flag Hierarchy**:
   - `isCursorInitialized`: Ensure cursor system is ready
   - `isCursorHidden`: Primary visibility control (IME, etc.)
   - `isCursorVisible`: Blink animation state

3. **Render Triggering**:
   - Uses event-driven rendering (`_onRequestRedraw.fire()`)
   - Minimal redraws (single row when possible)

4. **Composition Positioning**:
   - Hidden textarea positioned at cursor location
   - Composition view overlay displays IME candidates
   - Cursor remains in buffer but hidden from view

### Project Enhancements

1. **Buffer Cell Clearing**:
   - **Problem**: Japanese IME shows half-width space at cursor
   - **Solution**: Clear buffer cell during composition
   - **Restoration**: Save and restore original cell data

2. **Explicit State Tracking**:
   - Store original `isCursorVisible` and `isPaused` states
   - Ensures perfect restoration after composition
   - Handles edge cases (cursor already paused, etc.)

3. **Multi-Terminal Support**:
   - Track hidden cursor state per terminal ID
   - Prevent double-hiding or double-showing
   - Clean state management with `Set` and `Map`

---

## Implementation Recommendations

### Current Implementation Status: ✅ CORRECT + ENHANCED

The current implementation in `IMEHandler.ts` **correctly follows VS Code's pattern** and adds valuable enhancements:

✅ **Correctly Implemented**:
1. Primary cursor hiding via `coreService.isCursorHidden`
2. Blink state control via `CursorBlinkStateManager`
3. Render refresh triggering
4. Composition event handling

✅ **Valuable Enhancements**:
1. Buffer cell clearing (removes half-width space artifact)
2. Explicit state restoration (more robust than VS Code)
3. Multi-terminal state tracking
4. Saved cell data restoration

### Minor Improvements (Optional)

1. **Add Error Recovery**:
   ```typescript
   // In showCursor(), add fallback if state restoration fails
   if (!originalState) {
     this.logger('No original state found, using default visible state');
     blinkManager.isCursorVisible = true;
     if (blinkManager.isPaused) {
       blinkManager.resume();
     }
   }
   ```

2. **Add Cursor Position Validation**:
   ```typescript
   // Before clearing buffer cell
   if (cursorX >= 0 && cursorX < buffer.cols &&
       cursorY >= 0 && cursorY < buffer.rows) {
     // Clear cell
   } else {
     this.logger('Cursor out of bounds, skipping cell clear');
   }
   ```

3. **Add Render Debouncing** (if performance becomes an issue):
   ```typescript
   private requestRenderRefresh(terminalId: string, row: number): void {
     if (this.renderRefreshTimers.has(terminalId)) {
       clearTimeout(this.renderRefreshTimers.get(terminalId));
     }
     this.renderRefreshTimers.set(terminalId, setTimeout(() => {
       renderService._onRequestRefreshRows.fire({ start: row, end: row });
       this.renderRefreshTimers.delete(terminalId);
     }, 0));
   }
   ```

---

## Testing Strategy

### Test Scenarios

1. **Basic IME Composition**:
   - Type Japanese: "あ" → "あい" → "あいう" → Enter
   - Verify cursor hidden during composition
   - Verify cursor restored after Enter

2. **Composition Cancellation**:
   - Start composition, press ESC
   - Verify cursor restored immediately

3. **Multi-Terminal IME**:
   - Start composition in Terminal 1
   - Switch to Terminal 2
   - Complete composition in Terminal 1
   - Verify no state leakage

4. **Blink State Preservation**:
   - Configure cursor blinking enabled
   - Start composition (cursor should stop blinking)
   - Complete composition (cursor should resume blinking)

5. **Buffer Cell Restoration**:
   - Position cursor over existing text
   - Start composition
   - Verify original text preserved
   - Complete composition
   - Verify original text restored

### Performance Testing

1. **High-Frequency Composition**:
   - Rapid typing with IME
   - Monitor CPU usage
   - Verify no render thrashing

2. **Multiple Terminals**:
   - 5 terminals with IME active in different terminals
   - Verify state isolation
   - Check memory usage

---

## References

### xterm.js Source Files

1. **CompositionHelper.ts**:
   - URL: `https://github.com/xtermjs/xterm.js/blob/master/src/browser/input/CompositionHelper.ts`
   - Primary IME event handling
   - Composition view positioning

2. **CursorBlinkStateManager.ts**:
   - URL: `https://github.com/xtermjs/xterm.js/blob/master/addons/addon-webgl/src/CursorBlinkStateManager.ts`
   - Cursor blink animation control
   - Visibility state management

3. **WebglRenderer.ts**:
   - URL: `https://github.com/xtermjs/xterm.js/blob/master/addons/addon-webgl/src/WebglRenderer.ts`
   - Line 357-360: Cursor rendering check
   - Line 406-410: Visibility calculation
   - Line 477-500: Cursor model and color overrides

### VS Code Terminal Files

1. **TerminalInstance.ts**:
   - URL: `https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`
   - Terminal lifecycle management
   - xterm.js integration

2. **XtermTerminal.ts**:
   - URL: `https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts`
   - xterm.js wrapper for VS Code
   - Event handling coordination

---

## Conclusion

The current implementation in `IMEHandler.ts` **correctly implements VS Code's cursor hiding pattern** with valuable enhancements:

✅ **Core Pattern Compliance**:
- Three-layer visibility control (CoreService → BlinkManager → Renderer)
- Proper state management and restoration
- Event-driven render updates

✅ **Project-Specific Enhancements**:
- Buffer cell clearing (solves half-width space issue)
- Explicit state tracking for robust restoration
- Multi-terminal support with state isolation

**Recommendation**: Keep current implementation. The enhancements provide better user experience than vanilla VS Code/xterm.js implementation, especially for Japanese/CJK IME users.

The only minor improvements needed are error handling edge cases (cursor out of bounds, missing state restoration data) which can be added incrementally.

---

**Research Date**: 2025-10-19
**VS Code Version Referenced**: Latest stable (main branch)
**xterm.js Version Referenced**: Latest master branch
**Researcher**: Claude Code (vscode-terminal-resolver agent)
