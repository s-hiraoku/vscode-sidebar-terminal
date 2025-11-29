# Terminal Layout Documentation Index

**Investigation Date**: 2025-11-04
**Topic**: VS Code Terminal Split Layout Implementation

---

## Quick Navigation

### 🎯 Start Here

**New to this investigation?** Start with the [Summary](./TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md)

**Want to implement?** Go to the [Implementation Guide](./webview-terminal-layout-implementation-guide.md)

**Need quick reference?** Check the [Quick Reference](./terminal-layout-quick-reference.md)

**Visual learner?** See the [Visual Guide](./terminal-layout-visual-guide.md)

---

## Document Structure

```
docs/
├── TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md    ← START HERE
├── vscode-terminal-split-layout-analysis.md    ← Deep technical details
├── webview-terminal-layout-implementation-guide.md  ← How to implement
├── terminal-layout-quick-reference.md          ← Quick lookup
└── terminal-layout-visual-guide.md             ← Diagrams and visuals
```

---

## Documents Overview

### 1. Summary (10 min read)
**File**: `TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md`

**Read this if**: You want a high-level overview of findings

**Contains**:
- Investigation results
- Key findings
- Core patterns discovered
- Implementation recommendations
- Next steps

**Best for**: Project managers, reviewers, getting started

---

### 2. Deep Dive Analysis (45 min read)
**File**: `vscode-terminal-split-layout-analysis.md`

**Read this if**: You need complete technical understanding

**Contains**:
- Exact DOM structure
- Complete TypeScript implementation
- Full CSS styles
- Step-by-step initialization
- Event handling details
- Performance considerations

**Best for**: Developers implementing the feature, architects

**Key Sections**:
1. DOM Structure (exact hierarchy)
2. Orientation Logic (panel position detection)
3. SplitView Implementation (SplitPaneContainer class)
4. CSS Styles (borders, alignment, sizing)
5. Event Handling (orientation changes)
6. Critical Implementation Details
7. Step-by-Step Initialization Sequence
8. Comparison: Bottom Panel vs. Sidebar
9. Key Takeaways for Our Implementation
10. Implementation Pattern for WebView
11. Testing Scenarios

---

### 3. Implementation Guide (30 min read)
**File**: `webview-terminal-layout-implementation-guide.md`

**Read this if**: You're ready to implement the feature

**Contains**:
- Step-by-step implementation instructions
- TypeScript code snippets (copy-paste ready)
- CSS patterns
- Message protocol
- Testing plan
- Debugging tips
- Common issues and solutions

**Best for**: Developers actively coding the feature

**Implementation Steps**:
1. Add panel position detection in extension
2. Add message handler in webview
3. Update terminal container HTML
4. Add CSS for orientation-based layout
5. Integrate PanelLocationHandler

**Includes**:
- PanelLocationHandler class (complete code)
- Extension integration code
- WebView integration code
- CSS styles
- Testing checklist

---

### 4. Quick Reference (5 min read)
**File**: `terminal-layout-quick-reference.md`

**Read this if**: You need quick lookup during implementation

**Contains**:
- Minimal DOM structure
- Essential CSS (copy-paste ready)
- TypeScript snippets
- Message protocol
- Decision tree
- Testing checklist
- Common mistakes

**Best for**: Quick reference while coding, code reviews

**Perfect for**:
- Looking up CSS patterns
- Checking message format
- Verifying orientation logic
- Testing checklist

---

### 5. Visual Guide (20 min read)
**File**: `terminal-layout-visual-guide.md`

**Read this if**: You prefer visual understanding

**Contains**:
- ASCII diagrams of layout structures
- Visual representation of flexbox mechanics
- Border placement diagrams
- xterm positioning illustrations
- Responsive behavior diagrams
- Event flow diagram
- Size constraint diagrams

**Best for**: Visual learners, understanding layout mechanics

**Diagrams Include**:
- Bottom panel layout (side-by-side)
- Left sidebar layout (stacked)
- Layout transformation (bottom → left)
- Flexbox mechanics
- Border placement
- xterm positioning
- Responsive behavior
- Event flow

---

## Reading Paths

### Path 1: Quick Implementation (1 hour)
For developers who want to implement quickly:

1. Read [Summary](./TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md) (10 min)
2. Read [Quick Reference](./terminal-layout-quick-reference.md) (5 min)
3. Read [Implementation Guide](./webview-terminal-layout-implementation-guide.md) (30 min)
4. Implement using guide as reference (remaining time)

### Path 2: Deep Understanding (2 hours)
For developers who want complete understanding:

1. Read [Summary](./TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md) (10 min)
2. Read [Deep Dive Analysis](./vscode-terminal-split-layout-analysis.md) (45 min)
3. Review [Visual Guide](./terminal-layout-visual-guide.md) (20 min)
4. Read [Implementation Guide](./webview-terminal-layout-implementation-guide.md) (30 min)
5. Implement using all docs as reference (remaining time)

### Path 3: Visual Learner (1 hour)
For visual learners:

1. Read [Summary](./TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md) (10 min)
2. Read [Visual Guide](./terminal-layout-visual-guide.md) (20 min)
3. Read [Quick Reference](./terminal-layout-quick-reference.md) (5 min)
4. Read [Implementation Guide](./webview-terminal-layout-implementation-guide.md) (25 min)

### Path 4: Code Reviewer (30 min)
For reviewing implementation:

1. Read [Summary](./TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md) (10 min)
2. Read [Quick Reference](./terminal-layout-quick-reference.md) (5 min)
3. Review implementation against [Implementation Guide](./webview-terminal-layout-implementation-guide.md) (15 min)

---

## Key Concepts

### Orientation
- **Horizontal**: Side-by-side layout (bottom/top panel)
- **Vertical**: Stacked layout (left/right sidebar)

### Panel Position
- **Bottom**: Bottom of window → Horizontal orientation
- **Top**: Top of window → Horizontal orientation
- **Left**: Left sidebar → Vertical orientation
- **Right**: Right sidebar → Vertical orientation

### Layout Strategy
1. Detect panel position
2. Calculate orientation
3. Apply CSS class
4. Let flexbox distribute space

---

## Quick Answers

### Q: Why do terminals stack vertically in bottom panel?
**A**: Missing orientation detection. Bottom panel should use `horizontal` class, but it's probably using `vertical` or no class.

**Fix**: Implement PanelLocationHandler to detect position and apply correct class.

**See**: [Implementation Guide - Step 2](./webview-terminal-layout-implementation-guide.md#step-2-add-message-handler-in-webview)

---

### Q: What's the exact CSS needed?
**A**:
```css
.terminal-groups-container.horizontal {
    flex-direction: row;
}
.terminal-groups-container.horizontal > .terminal-container {
    flex: 1 1 0;
    min-width: 80px;
    height: 100%;
}
```

**See**: [Quick Reference - CSS](./terminal-layout-quick-reference.md#css-minimal)

---

### Q: How does VS Code detect panel position?
**A**:
```typescript
const panelPosition = this._layoutService.getPanelPosition();
const terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
const orientation = terminalLocation === ViewContainerLocation.Panel && isHorizontal(panelPosition)
    ? Orientation.HORIZONTAL
    : Orientation.VERTICAL;
```

**See**: [Deep Dive - Orientation Logic](./vscode-terminal-split-layout-analysis.md#2-orientation-logic)

---

### Q: What's the DOM structure?
**A**:
```html
<div class="terminal-groups-container horizontal">
    <div class="terminal-container">...</div>
    <div class="terminal-container">...</div>
</div>
```

**See**: [Quick Reference - DOM Structure](./terminal-layout-quick-reference.md#dom-structure)

---

### Q: How do I test this?
**A**:
1. Create 2 terminals in bottom panel → should be side-by-side
2. Move panel to left sidebar → should stack vertically
3. Move back to bottom → should return to side-by-side

**See**: [Implementation Guide - Testing Plan](./webview-terminal-layout-implementation-guide.md#testing-plan)

---

## Code Snippets

### Detect Orientation
```typescript
function getOrientation(position: 'bottom' | 'top' | 'left' | 'right'): 'horizontal' | 'vertical' {
    return (position === 'bottom' || position === 'top') ? 'horizontal' : 'vertical';
}
```

### Apply Orientation
```typescript
const container = document.querySelector('.terminal-groups-container');
container?.classList.remove('horizontal', 'vertical');
container?.classList.add(orientation);
```

### Message Protocol
```typescript
// Extension → WebView
webview.postMessage({
    type: 'panelPositionChanged',
    position: 'bottom'
});

// WebView Handler
window.addEventListener('message', (event) => {
    if (event.data.type === 'panelPositionChanged') {
        const orientation = getOrientation(event.data.position);
        applyOrientation(orientation);
    }
});
```

---

## VS Code References

### Source Files Analyzed
- `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts` (631 lines)
- `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts` (508 lines)
- `src/vs/workbench/contrib/terminal/browser/media/terminal.css`
- `src/vs/base/browser/ui/splitview/splitview.ts`

### Key Classes
- `TerminalGroup`: Manages terminal instances and layout
- `SplitPaneContainer`: Handles split view layout
- `SplitPane`: Individual terminal pane
- `TerminalTabbedView`: Overall terminal view

### Key Methods
- `attachToElement()`: Initializes layout with orientation
- `layout()`: Recalculates layout on size/position change
- `setOrientation()`: Changes orientation dynamically

---

## Related Documentation

### Internal Docs
- `CLAUDE.md` - Project instructions
- `AGENTS.md` - Agent workflows
- `CHANGELOG.md` - Version history

### External References
- [VS Code Repository](https://github.com/microsoft/vscode)
- [VS Code Terminal Docs](https://code.visualstudio.com/docs/editor/integrated-terminal)
- [Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)

---

## Contributing

### Adding to This Documentation

When updating these docs:
1. Update the specific document
2. Update this index if adding new sections
3. Update the Summary if findings change
4. Keep code snippets in sync across docs

### Document Maintenance

- **Summary**: Update when key findings change
- **Deep Dive**: Update when VS Code source changes
- **Implementation Guide**: Update as implementation evolves
- **Quick Reference**: Keep minimal and current
- **Visual Guide**: Update diagrams for clarity

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-04 | 1.0.0 | Initial investigation complete |

---

## Contact

For questions about this investigation:
- Check the [Summary](./TERMINAL_LAYOUT_INVESTIGATION_SUMMARY.md) first
- Review the [Implementation Guide](./webview-terminal-layout-implementation-guide.md)
- Refer to VS Code source code for ultimate truth

---

**Last Updated**: 2025-11-04
**Status**: Investigation Complete, Ready for Implementation
