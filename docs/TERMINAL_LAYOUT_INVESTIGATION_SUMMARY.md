# Terminal Layout Investigation Summary

**Date**: 2025-11-04
**Investigator**: Claude Code (VS Code Terminal Resolver Agent)
**Objective**: Understand how VS Code displays terminals side-by-side in bottom panel

---

## Investigation Results

### Key Finding

VS Code uses a **SplitView widget** with **dynamic orientation** based on panel position, NOT pure CSS flexbox or grid.

### Critical Discovery

```typescript
// VS Code's orientation logic (terminalGroup.ts:451-457)
const orientation = terminalLocation === ViewContainerLocation.Panel && isHorizontal(panelPosition)
    ? Orientation.HORIZONTAL  // Bottom/Top → Side-by-side
    : Orientation.VERTICAL;   // Left/Right → Stacked
```

**Translation**:
- Bottom panel = HORIZONTAL orientation = Terminals displayed side-by-side
- Left/Right sidebar = VERTICAL orientation = Terminals stacked vertically

---

## Documents Created

### 1. Deep Dive Analysis
**File**: `vscode-terminal-split-layout-analysis.md` (10,000+ words)

**Contains**:
- Complete DOM structure hierarchy
- Full SplitView implementation details
- Orientation switching logic
- CSS styles for split terminals
- Step-by-step initialization sequence
- Comparison: Bottom panel vs. sidebar

**Key Sections**:
1. DOM Structure (exact hierarchy)
2. Orientation Logic (panel position detection)
3. SplitView Implementation (SplitPaneContainer class)
4. CSS Styles (borders, alignment, sizing)
5. Event Handling (orientation changes)
6. Critical Implementation Details (prevent flicker)
7. Step-by-Step Initialization Sequence
8. Comparison Table

### 2. Implementation Guide
**File**: `webview-terminal-layout-implementation-guide.md`

**Contains**:
- Practical implementation steps for our WebView
- TypeScript code snippets
- CSS patterns adapted from VS Code
- Message protocol for extension ↔ webview
- Testing plan with test cases
- Debugging tips

**Implementation Steps**:
1. Add panel position detection in extension
2. Add message handler in webview
3. Update terminal container HTML
4. Add CSS for orientation-based layout
5. Integrate PanelLocationHandler

**Alternative**: Configuration-based approach if panel position detection unavailable

### 3. Quick Reference
**File**: `terminal-layout-quick-reference.md`

**Contains**:
- Minimal DOM structure
- Essential CSS (copy-paste ready)
- TypeScript snippets
- Message protocol
- Decision tree
- Testing checklist

**Perfect for**: Quick lookup during implementation

### 4. Visual Guide
**File**: `terminal-layout-visual-guide.md`

**Contains**:
- ASCII diagrams of layout structures
- Visual representation of flexbox mechanics
- Border placement diagrams
- xterm positioning illustrations
- Responsive behavior diagrams
- Event flow diagram

**Perfect for**: Understanding layout visually

---

## Core Patterns Discovered

### 1. Two-Level Layout Architecture

```
Outer SplitView
├── Tabs Container (index 0 or 1)
└── Terminal Container (index 1 or 0)
    └── Inner SplitView (per group)
        ├── Terminal 1 (SplitPane)
        ├── Terminal 2 (SplitPane)
        └── Terminal N (SplitPane)
```

### 2. Orientation Calculation

```typescript
function getOrientation(panelPosition: Position): Orientation {
    return (panelPosition === Position.BOTTOM || panelPosition === Position.TOP)
        ? Orientation.HORIZONTAL
        : Orientation.VERTICAL;
}
```

### 3. Layout Application

```typescript
if (orientation === Orientation.HORIZONTAL) {
    // Side-by-side: share width, full height
    children.forEach(pane => pane.orthogonalLayout(height));
    splitView.layout(width);
} else {
    // Stacked: share height, full width
    children.forEach(pane => pane.orthogonalLayout(width));
    splitView.layout(height);
}
```

### 4. CSS Pattern

```css
/* Horizontal = Side-by-side */
.terminal-groups-container.horizontal {
    flex-direction: row;
}
.terminal-groups-container.horizontal > .terminal-container {
    flex: 1 1 0;
    min-width: 80px;
    height: 100%;
}

/* Vertical = Stacked */
.terminal-groups-container.vertical {
    flex-direction: column;
}
.terminal-groups-container.vertical > .terminal-container {
    flex: 1 1 0;
    min-height: 80px;
    width: 100%;
}
```

---

## Implementation Recommendation

### For Our WebView

**Approach**: Hybrid (VS Code pattern + WebView constraints)

1. **Extension Side**:
   - Detect panel position (or use configuration)
   - Send position to webview via message

2. **WebView Side**:
   - Calculate orientation from position
   - Apply CSS class to container
   - Let flexbox handle layout

3. **CSS**:
   - Use flexbox (not SplitView widget)
   - Apply `flex-direction` based on orientation
   - Use `flex: 1 1 0` for equal distribution

### Why This Approach?

- ✅ Follows VS Code's proven logic
- ✅ Simpler than implementing full SplitView widget
- ✅ Flexbox handles sizing automatically
- ✅ Easy to test and debug
- ✅ Maintains consistency with VS Code UX

---

## Key Metrics

| Metric | Value | Source |
|--------|-------|--------|
| Minimum terminal width | 80px | terminalGroup.ts:26 |
| Minimum terminal height | 80px | terminalGroup.ts:26 |
| Default orientation | HORIZONTAL | Bottom panel |
| Layout recalculation trigger | Panel position change | terminalGroup.ts:494 |
| Sizing strategy | Distribute evenly | Sizing.Distribute |
| Border style | 1px solid var(--vscode-terminal-border) | terminal.css:73-82 |

---

## Files Analyzed

### Primary Sources

1. **terminalGroup.ts** (631 lines)
   - Lines 35-167: SplitPaneContainer class
   - Lines 169-210: SplitPane class
   - Lines 212-631: TerminalGroup class
   - Lines 451-457: Orientation calculation
   - Lines 494-505: Layout on position change

2. **terminalTabbedView.ts** (508 lines)
   - Lines 70-71: Index management
   - Lines 109-117: Orientation change event
   - Lines 308-323: SplitView setup

3. **terminal.css**
   - Lines 38-42: Container height styles
   - Lines 73-82: Split terminal borders
   - Lines 112-117: Terminal alignment

4. **splitview.ts**
   - SplitView widget implementation
   - Sizing enum (Distribute, Split, Auto)

---

## Testing Recommendations

### Must Test Scenarios

1. ✅ **Bottom panel + 2 terminals**
   - Expected: Side-by-side
   - Verify: Each terminal 50% width, 100% height

2. ✅ **Bottom panel + 3 terminals**
   - Expected: Side-by-side
   - Verify: Each terminal 33.3% width, 100% height

3. ✅ **Left sidebar + 2 terminals**
   - Expected: Stacked
   - Verify: Each terminal 100% width, 50% height

4. ✅ **Panel position change: bottom → left**
   - Expected: Layout changes from horizontal to vertical
   - Verify: CSS class changes, terminals re-layout

5. ✅ **Panel position change: left → bottom**
   - Expected: Layout changes from vertical to horizontal
   - Verify: CSS class changes, terminals re-layout

6. ✅ **Add terminal (bottom panel)**
   - Expected: New terminal appears side-by-side
   - Verify: All terminals resize proportionally

7. ✅ **Remove terminal (bottom panel)**
   - Expected: Remaining terminals expand
   - Verify: Space redistributed evenly

### Performance Tests

- Layout with 5 terminals
- Rapid panel position changes
- Add/remove terminals repeatedly
- Resize panel continuously

---

## Common Pitfalls to Avoid

### ❌ Don't Do This

1. **Using display: grid**
   - VS Code uses flexbox, not grid

2. **Setting explicit widths**
   - Use `flex: 1 1 0` instead

3. **Forgetting to remove old class**
   - Always remove before adding new class

4. **Missing min-width/min-height**
   - Terminals will collapse without constraints

5. **Wrong border selector**
   - Use `:not(:first-child)` for borders

6. **Pure CSS approach**
   - VS Code uses TypeScript + CSS, not CSS alone

### ✅ Do This

1. **Use flexbox with flex-direction**
2. **Apply orientation via CSS class**
3. **Calculate orientation from panel position**
4. **Use atomic class updates**
5. **Set minimum constraints**
6. **Test all panel positions**

---

## Next Steps

### Immediate Actions

1. **Implement PanelLocationHandler** (estimated: 2 hours)
   - Create handler class
   - Add message protocol
   - Wire up event listeners

2. **Update CSS** (estimated: 1 hour)
   - Add orientation-based styles
   - Test with existing terminals

3. **Add Extension Support** (estimated: 2 hours)
   - Detect panel position
   - Send messages to webview

4. **Test All Scenarios** (estimated: 3 hours)
   - Manual testing
   - Verify all panel positions
   - Check edge cases

### Future Enhancements

1. **Responsive breakpoints**
   - Auto-switch to vertical when width < 600px

2. **User preferences**
   - Allow manual orientation override

3. **Smooth transitions**
   - Animate layout changes

4. **Resizable panes**
   - Add sash/splitter between terminals

---

## References

### VS Code Repository
- **URL**: https://github.com/microsoft/vscode
- **Branch**: main
- **License**: MIT

### Key Files
- `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`
- `src/vs/workbench/contrib/terminal/browser/media/terminal.css`
- `src/vs/base/browser/ui/splitview/splitview.ts`

### Documentation Created
1. `vscode-terminal-split-layout-analysis.md` - Deep dive
2. `webview-terminal-layout-implementation-guide.md` - Implementation
3. `terminal-layout-quick-reference.md` - Quick lookup
4. `terminal-layout-visual-guide.md` - Visual diagrams

---

## Conclusion

VS Code's terminal split layout is a sophisticated system that combines:
1. **TypeScript logic** for orientation calculation
2. **SplitView widget** for layout management
3. **CSS** for visual styling
4. **Event handling** for dynamic updates

**For our WebView implementation**, we can simplify by:
1. Using **flexbox** instead of SplitView widget
2. Applying **CSS classes** based on panel position
3. Letting **browser handle** the actual layout math

This approach maintains the same UX while being easier to implement and maintain.

---

**Investigation Status**: ✅ COMPLETE

**Documents Created**: 4
**Lines Analyzed**: 1,600+
**Code Patterns Identified**: 10+
**Implementation Ready**: YES
