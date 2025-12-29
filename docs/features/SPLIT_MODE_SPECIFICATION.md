# Split Mode Specification

## Overview
This document defines the complete behavior specification for terminal display modes in the VS Code Sidebar Terminal extension.

## Display Modes

### 1. Normal Mode
- **Definition**: Single terminal displayed without split layout
- **When Active**: Only 1 terminal exists in the system
- **Layout**: Terminal takes full available height in terminal-body

### 2. Fullscreen Mode
- **Definition**: One terminal displayed in full view, others hidden
- **When Active**: User explicitly toggles fullscreen for a specific terminal
- **Layout**: Selected terminal takes full available height, other terminals are hidden (but still exist)

### 3. Split Mode
- **Definition**: Multiple terminals displayed simultaneously with equal height distribution
- **When Active**: 2+ terminals exist and user is not in fullscreen mode
- **Layout**: All terminals divided equally in vertical direction

## Core Requirements

### REQ-1: Terminal Height Distribution in Split Mode
**Description**: All visible terminals must have equal height in split mode.

**Rules**:
- Available height = terminal-body clientHeight
- Each terminal height = Available height / Number of terminals
- Resizers (4px each) between terminals are automatically handled by flexbox
- Tab bar height is automatically excluded by flexbox layout

**Expected Behavior**:
```
2 terminals: Each terminal = 50% of available height
3 terminals: Each terminal = 33.33% of available height
4 terminals: Each terminal = 25% of available height
5 terminals: Each terminal = 20% of available height
```

**Test Cases**:
- TC-1.1: Create 2 terminals in split mode → Each terminal height is equal
- TC-1.2: Create 5 terminals in split mode → All 5 terminals visible with equal height
- TC-1.3: No terminal should be cut off or hidden
- TC-1.4: Sum of all terminal heights + resizers should not exceed available height

### REQ-2: Adding Terminal in Split Mode
**Description**: When adding a new terminal in split mode, all terminals (existing + new) must be redistributed equally.

**Sequence**:
1. User clicks "+" button or creates new terminal
2. New terminal is created
3. Split layout is immediately refreshed
4. All terminals (N+1) are displayed with equal height

**Expected Behavior**:
```
Before: 3 terminals, each 33.33% height
Add 1 terminal
After: 4 terminals, each 25% height
```

**Test Cases**:
- TC-2.1: Start with 2 terminals → Add 1 → Result: 3 terminals equally distributed
- TC-2.2: Start with 4 terminals → Add 1 → Result: 5 terminals equally distributed
- TC-2.3: New terminal should be visible immediately after creation
- TC-2.4: All existing terminals remain visible

### REQ-3: Adding Terminal in Fullscreen Mode
**Description**: When adding a new terminal while in fullscreen mode, system must transition to split mode first, then add new terminal.

**Sequence**:
1. User is in fullscreen mode (1 terminal visible, N-1 hidden)
2. User clicks "+" button
3. System switches to split mode → All N existing terminals become visible
4. Wait 250ms for layout to complete
5. Create new terminal
6. Refresh split layout with N+1 terminals

**Expected Behavior**:
```
Before: Fullscreen with terminal-1 visible (3 total terminals exist)
Click "+"
Transition: Split mode with 3 terminals visible
After: Split mode with 4 terminals visible (all equal height)
```

**Test Cases**:
- TC-3.1: Fullscreen (3 terminals) → Add terminal → Result: Split mode with 4 terminals
- TC-3.2: During transition, all existing terminals must become visible before new terminal is created
- TC-3.3: Final state must show N+1 terminals all with equal height
- TC-3.4: No terminal should be missing or hidden

### REQ-4: Removing Terminal in Split Mode
**Description**: When removing a terminal in split mode, remaining terminals must be redistributed equally.

**Sequence**:
1. User closes a terminal (via X button or tab close)
2. Terminal is removed from system
3. If 2+ terminals remain: Refresh split layout with N-1 terminals
4. If 1 terminal remains: Switch to normal mode

**Expected Behavior**:
```
Before: 4 terminals, each 25% height
Remove 1 terminal
After: 3 terminals, each 33.33% height
```

**Test Cases**:
- TC-4.1: 4 terminals → Remove 1 → Result: 3 terminals equally distributed
- TC-4.2: 2 terminals → Remove 1 → Result: 1 terminal in normal mode (full height)
- TC-4.3: All remaining terminals should be visible
- TC-4.4: No empty space or gaps should remain

### REQ-5: Removing Terminal in Fullscreen Mode
**Description**: When removing a terminal while in fullscreen mode, system must maintain appropriate display mode.

**Sequence**:
1. User is in fullscreen mode
2. User closes the fullscreen terminal OR closes a non-visible terminal
3. System determines appropriate mode based on remaining terminal count

**Decision Matrix**:
```
Remaining terminals = 1 → Switch to normal mode, show remaining terminal fullscreen
Remaining terminals ≥ 2 → Switch to split mode, show all remaining terminals
```

**Test Cases**:
- TC-5.1: Fullscreen (2 terminals) → Remove fullscreen terminal → Result: Remaining terminal in fullscreen
- TC-5.2: Fullscreen (3 terminals) → Remove fullscreen terminal → Result: Split mode with 2 terminals
- TC-5.3: Fullscreen (3 terminals) → Remove non-visible terminal → Result: Split mode with 2 terminals

### REQ-6: Tab Reordering in Split Mode
**Description**: When user drags and reorders tabs, terminal display order must update immediately.

**Sequence**:
1. User drags tab from position A to position B
2. Tab order is updated
3. Container order is updated
4. Split layout is refreshed with new order

**Expected Behavior**:
```
Before: Tab order [T1, T2, T3], Display order [T1, T2, T3]
Drag T3 to first position
After: Tab order [T3, T1, T2], Display order [T3, T1, T2]
```

**Test Cases**:
- TC-6.1: Reorder tabs in split mode → Display order matches tab order
- TC-6.2: Heights remain equal after reordering
- TC-6.3: All terminals remain visible after reordering
- TC-6.4: Active terminal remains correctly highlighted

### REQ-7: Fullscreen Tab Click Behavior
**Description**: Clicking a tab while in fullscreen mode should show that terminal in fullscreen.

**Sequence**:
1. User is in fullscreen mode showing terminal A
2. User clicks tab for terminal B
3. Terminal B is shown in fullscreen (replacing A)

**Test Cases**:
- TC-7.1: Click different tab in fullscreen → Display switches to clicked terminal
- TC-7.2: Only clicked terminal is visible
- TC-7.3: Tab is marked as active

## Implementation Constraints

### Layout Implementation
**Method**: CSS Flexbox with `flex: 1 1 0`

**Rationale**:
- Flexbox automatically handles equal distribution
- No manual pixel calculations required
- Automatically accounts for tab bar height
- Automatically accounts for resizer heights
- Responsive to window resizing

**Key CSS Properties**:
```css
terminal-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

terminal-split-wrapper {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
}
```

### Timing Constraints
- **Split mode transition delay**: 250ms (to ensure layout completion)
- **Tab activation delay**: 100ms (for smooth transition)
- **Refresh split mode delay**: 50ms (for DOM update completion)

### Container Management
- **Terminal containers**: Must be registered in TerminalContainerManager
- **Wrapper cache**: Split wrappers must be cached and properly cleaned up
- **Resizers**: Automatically added between terminals (N-1 resizers for N terminals)

## Error Conditions

### EC-1: Container Not Found
**Condition**: Terminal ID exists but container element is missing
**Handling**: Log error, skip that terminal in layout, continue with others

### EC-2: Zero Terminals
**Condition**: Attempt to activate split mode with 0 terminals
**Handling**: Log warning, return early without layout changes

### EC-3: Layout During Transition
**Condition**: Multiple layout requests during transition period
**Handling**: Use debouncing/delays to prevent race conditions

## Testing Strategy

### Unit Tests
- Test terminal count calculations
- Test flex property assignments
- Test container registration/unregistration
- Test mode transition logic

### Integration Tests
- Test fullscreen → split → add terminal flow
- Test split → remove terminal → normal flow
- Test tab reordering in split mode
- Test container manager and display manager coordination

### Visual Tests
- Verify equal height distribution with screenshots
- Verify no terminals are cut off
- Verify smooth transitions between modes
- Verify correct terminal count displayed

## Success Criteria

✅ All terminals visible in split mode regardless of count (2-5)
✅ Equal height distribution within 1px tolerance
✅ Fullscreen → split transition shows all existing terminals before adding new
✅ No terminals cut off or hidden unexpectedly
✅ Tab reordering immediately updates display order
✅ Terminal removal correctly redistributes remaining terminals
✅ Mode transitions are smooth and predictable

## Failure Scenarios (To Be Prevented)

❌ 5th terminal not visible (cut off)
❌ Unequal heights when adding terminal
❌ New terminal added before split mode transition completes
❌ Terminals remain hidden after mode change
❌ Tab order doesn't match display order
❌ Empty gaps or overlapping terminals
