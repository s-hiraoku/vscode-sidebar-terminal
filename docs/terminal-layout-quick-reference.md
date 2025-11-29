# Terminal Layout Quick Reference

**Quick reference for VS Code terminal split layout patterns**

---

## DOM Structure

```html
<!-- Bottom Panel (Side-by-Side) -->
<div class="terminal-groups-container horizontal">
    <div class="terminal-container" data-terminal-id="1">
        <div class="terminal-header">Terminal 1</div>
        <div class="terminal-body">
            <div class="xterm">...</div>
        </div>
    </div>
    <div class="terminal-container" data-terminal-id="2">
        <div class="terminal-header">Terminal 2</div>
        <div class="terminal-body">
            <div class="xterm">...</div>
        </div>
    </div>
</div>
```

---

## CSS (Minimal)

```css
/* Container */
.terminal-groups-container {
    display: flex;
    height: 100%;
    width: 100%;
}

/* Horizontal = Side-by-side */
.terminal-groups-container.horizontal {
    flex-direction: row;
}

.terminal-groups-container.horizontal > .terminal-container {
    flex: 1 1 0;
    min-width: 80px;
    height: 100%;
}

.terminal-groups-container.horizontal > .terminal-container:not(:first-child) {
    border-left: 1px solid var(--vscode-terminal-border);
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

.terminal-groups-container.vertical > .terminal-container:not(:first-child) {
    border-top: 1px solid var(--vscode-terminal-border);
}

/* Terminal Container */
.terminal-container {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.terminal-header {
    flex: 0 0 auto;
    min-height: 35px;
}

.terminal-body {
    flex: 1 1 auto;
    position: relative;
}

.terminal-body .xterm {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}
```

---

## TypeScript

```typescript
// Detect orientation
function getOrientation(panelPosition: 'bottom' | 'top' | 'left' | 'right'): 'horizontal' | 'vertical' {
    return (panelPosition === 'bottom' || panelPosition === 'top')
        ? 'horizontal'
        : 'vertical';
}

// Apply orientation
function applyOrientation(orientation: 'horizontal' | 'vertical'): void {
    const container = document.querySelector('.terminal-groups-container');
    container?.classList.remove('horizontal', 'vertical');
    container?.classList.add(orientation);
}

// Handle panel position change
window.addEventListener('message', (event) => {
    if (event.data.type === 'panelPositionChanged') {
        const orientation = getOrientation(event.data.position);
        applyOrientation(orientation);
    }
});
```

---

## Message Protocol

### Extension → WebView

```typescript
// Send panel position to webview
webview.postMessage({
    type: 'panelPositionChanged',
    position: 'bottom' | 'top' | 'left' | 'right'
});
```

### WebView → Extension

```typescript
// Request current panel position
vscode.postMessage({
    type: 'requestPanelPosition'
});
```

---

## Decision Tree

```
Panel Position?
├── BOTTOM or TOP
│   └── Apply "horizontal" class → Side-by-side layout
└── LEFT or RIGHT
    └── Apply "vertical" class → Stacked layout
```

---

## VS Code Source References

| File | Lines | Purpose |
|------|-------|---------|
| `terminalGroup.ts` | 451-457 | Orientation calculation |
| `terminalGroup.ts` | 494-505 | Layout on position change |
| `terminalGroup.ts` | 35-167 | SplitPaneContainer implementation |
| `terminal.css` | 38-42 | Container height styles |
| `terminal.css` | 73-82 | Split terminal borders |

---

## Testing Checklist

- [ ] Bottom panel + 2 terminals = side-by-side
- [ ] Bottom panel + 3 terminals = side-by-side (equal width)
- [ ] Left sidebar + 2 terminals = stacked
- [ ] Move panel bottom→left = layout changes
- [ ] Move panel left→bottom = layout changes
- [ ] Add terminal = layout updates
- [ ] Remove terminal = layout updates
- [ ] Resize panel = terminals resize proportionally

---

## Common Mistakes

❌ **Using `display: grid`** - VS Code uses flexbox
❌ **Setting explicit widths** - Use `flex: 1 1 0` instead
❌ **Forgetting to remove old class** - Always remove before adding
❌ **Missing min-width/min-height** - Prevents terminals from disappearing
❌ **Wrong border selector** - Use `:not(:first-child)` for borders

---

## Key Metrics

- **Minimum terminal width**: 80px
- **Minimum terminal height**: 80px
- **Default orientation**: Horizontal (bottom panel)
- **Layout recalculation**: On panel position change
- **CSS transitions**: Disabled by default (performance)
