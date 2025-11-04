# VS Code Terminal Layout Direction Research

**Date:** November 4, 2025
**Source:** microsoft/vscode repository (main branch)
**Research Objective:** Understand how VS Code's integrated terminal handles layout direction based on panel location

---

## Executive Summary

VS Code uses a **panel position detection + orientation mapping** system to control terminal layout direction. The key insight is:

- **Bottom/Top Panel** → Horizontal position → `Orientation.HORIZONTAL` → Terminals side-by-side
- **Sidebar (Left/Right)** → Vertical position → `Orientation.VERTICAL` → Terminals stacked

The system dynamically detects panel location changes and reconfigures the SplitView orientation in real-time.

---

## 1. Panel Location Detection

### Key Source Files
- `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts` (lines 470-485)
- `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts` (lines 135-147)

### Detection Pattern

VS Code uses two services to detect panel location:

```typescript
// From terminalGroup.ts
this._panelPosition = this._layoutService.getPanelPosition();
this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
```

**Key Services:**
1. **`IWorkbenchLayoutService.getPanelPosition()`**: Returns `Position.BOTTOM`, `Position.TOP`, `Position.LEFT`, or `Position.RIGHT`
2. **`IViewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)`**: Returns `ViewContainerLocation.Panel`, `ViewContainerLocation.Sidebar`, or `ViewContainerLocation.AuxiliaryBar`

### Position Detection Helper

```typescript
// From terminalGroup.ts (lines 598-606)
private _getPosition(): Position {
    switch (this._terminalLocation) {
        case ViewContainerLocation.Panel:
            return this._panelPosition;
        case ViewContainerLocation.Sidebar:
            return this._layoutService.getSideBarPosition();
        case ViewContainerLocation.AuxiliaryBar:
            return this._layoutService.getSideBarPosition() === Position.LEFT
                ? Position.RIGHT
                : Position.LEFT;
    }
}
```

---

## 2. Orientation Mapping Logic

### Core Algorithm

The orientation is determined by checking if the position is horizontal:

```typescript
// From terminalGroup.ts (line 608-610)
private _getOrientation(): Orientation {
    return isHorizontal(this._getPosition())
        ? Orientation.HORIZONTAL
        : Orientation.VERTICAL;
}
```

The `isHorizontal()` helper function (from `IWorkbenchLayoutService`) checks:

```typescript
// From layoutService.ts
function isHorizontal(position: Position): boolean {
    return position === Position.BOTTOM || position === Position.TOP;
}
```

### Orientation Rules

| Panel Location | Position | isHorizontal? | Orientation | Terminal Layout |
|----------------|----------|---------------|-------------|-----------------|
| Bottom Panel | `Position.BOTTOM` | ✅ Yes | `Orientation.HORIZONTAL` | Side-by-side (row) |
| Top Panel | `Position.TOP` | ✅ Yes | `Orientation.HORIZONTAL` | Side-by-side (row) |
| Left Sidebar | `Position.LEFT` | ❌ No | `Orientation.VERTICAL` | Stacked (column) |
| Right Sidebar | `Position.RIGHT` | ❌ No | `Orientation.VERTICAL` | Stacked (column) |

---

## 3. SplitView Orientation Configuration

### Initial Setup

When a terminal group is attached to an element, the orientation is set:

```typescript
// From terminalGroup.ts (lines 471-475)
attachToElement(element: HTMLElement): void {
    this._container = element;
    // ...
    this._panelPosition = this._layoutService.getPanelPosition();
    this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;

    const orientation = this._terminalLocation === ViewContainerLocation.Panel
        && isHorizontal(this._panelPosition)
        ? Orientation.HORIZONTAL
        : Orientation.VERTICAL;

    this._splitPaneContainer = this._instantiationService.createInstance(
        SplitPaneContainer,
        this._groupElement,
        orientation
    );
}
```

### SplitPaneContainer Orientation

The `SplitPaneContainer` class handles the actual split view:

```typescript
// From terminalGroup.ts (lines 39-48)
class SplitPaneContainer extends Disposable {
    constructor(
        private _container: HTMLElement,
        public orientation: Orientation,
    ) {
        super();
        this._width = this._container.offsetWidth;
        this._height = this._container.offsetHeight;
        this._createSplitView();
        this._splitView.layout(
            this.orientation === Orientation.HORIZONTAL
                ? this._width
                : this._height
        );
    }

    private _createSplitView(): void {
        this._splitViewDisposables.clear();
        this._splitView = new SplitView(this._container, {
            orientation: this.orientation
        });
        // ...
    }
}
```

---

## 4. Dynamic Orientation Changes

### Real-time Detection on Layout

VS Code monitors layout changes and updates orientation dynamically:

```typescript
// From terminalGroup.ts (lines 549-562)
layout(width: number, height: number): void {
    if (this._splitPaneContainer) {
        // Check if the panel position changed and rotate panes if so
        const newPanelPosition = this._layoutService.getPanelPosition();
        const newTerminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
        const terminalPositionChanged = newPanelPosition !== this._panelPosition
            || newTerminalLocation !== this._terminalLocation;

        if (terminalPositionChanged) {
            const newOrientation = newTerminalLocation === ViewContainerLocation.Panel
                && isHorizontal(newPanelPosition)
                ? Orientation.HORIZONTAL
                : Orientation.VERTICAL;

            this._splitPaneContainer.setOrientation(newOrientation);
            this._panelPosition = newPanelPosition;
            this._terminalLocation = newTerminalLocation;
            this._onPanelOrientationChanged.fire(this._splitPaneContainer.orientation);
        }

        this._splitPaneContainer.layout(width, height);
    }
}
```

### Orientation Change Handler

When orientation changes, the SplitView is recreated:

```typescript
// From terminalGroup.ts (lines 169-188)
setOrientation(orientation: Orientation): void {
    if (this.orientation === orientation) {
        return;
    }
    this.orientation = orientation;

    // Remove old split view
    while (this._container.children.length > 0) {
        this._container.children[0].remove();
    }

    // Create new split view with updated orientation
    this._createSplitView();
    this._withDisabledLayout(() => {
        this._children.forEach(child => {
            child.orientation = orientation;
            this._splitView.addView(child, 1);
        });
    });
}
```

### Event Notification

The `onPanelOrientationChanged` event is fired to notify other components:

```typescript
// From terminalGroup.ts (lines 363-364, 559)
private readonly _onPanelOrientationChanged = this._register(new Emitter<Orientation>());
readonly onPanelOrientationChanged = this._onPanelOrientationChanged.event;

// Fired after orientation change
this._onPanelOrientationChanged.fire(this._splitPaneContainer.orientation);
```

---

## 5. CSS Class Management (TerminalTabbedView)

### Visual Feedback with CSS Classes

The `TerminalTabbedView` adds a CSS class to visually indicate vertical layout:

```typescript
// From terminalTabbedView.ts (lines 29-31)
const enum CssClass {
    ViewIsVertical = 'terminal-side-view',
}
```

```typescript
// From terminalTabbedView.ts (lines 135-143)
this._register(this._terminalGroupService.onDidChangePanelOrientation((orientation) => {
    this._panelOrientation = orientation;
    if (this._panelOrientation === Orientation.VERTICAL) {
        this._terminalContainer.classList.add(CssClass.ViewIsVertical);
    } else {
        this._terminalContainer.classList.remove(CssClass.ViewIsVertical);
    }
}));
```

**CSS Application:**
- **Vertical (Sidebar)**: `.terminal-side-view` class added → Enables column-specific styling
- **Horizontal (Panel)**: `.terminal-side-view` class removed → Default row styling

---

## 6. SplitPane Layout Logic

### Orientation-Aware Layout

Each split pane adjusts its layout based on orientation:

```typescript
// From terminalGroup.ts (lines 212-224)
class SplitPane implements IView {
    layout(size: number): void {
        // Only layout when both sizes are known
        if (!size || !this.orthogonalSize) {
            return;
        }

        if (this.orientation === Orientation.VERTICAL) {
            this.instance.layout({
                width: this.orthogonalSize,
                height: size
            });
        } else {
            this.instance.layout({
                width: size,
                height: this.orthogonalSize
            });
        }
    }
}
```

**Layout Direction:**
- **Vertical Orientation**: Each pane gets fixed `width`, variable `height` (stacked vertically)
- **Horizontal Orientation**: Each pane gets variable `width`, fixed `height` (arranged horizontally)

---

## 7. Implementation Recommendations for Our Extension

### Recommended Approach

Based on VS Code's patterns, here's how to implement panel-aware layout direction:

#### 1. Detect Panel Location

```typescript
// In SecondaryTerminalProvider or TerminalLifecycleManager
private detectPanelLocation(): 'sidebar' | 'panel' {
    // Check webview panel location
    // VS Code extensions can detect this via panel position
    const panelPosition = vscode.window.activeTerminal?.location;

    // For webviews, we can infer from panel dimensions:
    // Narrow width (< certain threshold) = likely sidebar
    // Wide width = likely bottom panel

    return this.webviewPanel.viewColumn === vscode.ViewColumn.One
        ? 'sidebar'
        : 'panel';
}
```

#### 2. Map Location to Flex Direction

```typescript
private getFlexDirection(location: 'sidebar' | 'panel'): 'row' | 'column' {
    // VS Code pattern: horizontal panel = row, vertical panel = column
    return location === 'panel' ? 'row' : 'column';
}
```

#### 3. Apply CSS Dynamically

```typescript
// In WebViewHtmlGenerationService or TerminalContainerManager
private applyLayoutDirection(direction: 'row' | 'column'): void {
    const style = `
        .terminal-container {
            display: flex;
            flex-direction: ${direction};
            width: 100%;
            height: 100%;
        }
    `;

    // Send to webview via message
    this.messageManager.sendMessage({
        type: 'update-layout-direction',
        direction: direction
    });
}
```

#### 4. Listen for Panel Position Changes

```typescript
// In SecondaryTerminalProvider
private setupPanelLocationMonitoring(): void {
    // Monitor webview panel visibility/dimension changes
    this.webviewPanel.onDidChangeViewState(e => {
        const newLocation = this.detectPanelLocation();
        if (newLocation !== this.currentLocation) {
            this.currentLocation = newLocation;
            const direction = this.getFlexDirection(newLocation);
            this.applyLayoutDirection(direction);
        }
    });
}
```

#### 5. WebView-Side Layout Application

```typescript
// In main.ts (webview)
window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'update-layout-direction') {
        const container = document.querySelector('.terminal-container');
        if (container) {
            container.style.flexDirection = message.direction;
            // Also update any CSS class for additional styling
            container.classList.toggle('sidebar-layout', message.direction === 'column');
        }
    }
});
```

### CSS Strategy

```css
/* In webview styles */
.terminal-container {
    display: flex;
    width: 100%;
    height: 100%;
    /* Default: row (bottom panel) */
    flex-direction: row;
}

/* Sidebar-specific styling */
.terminal-container.sidebar-layout {
    flex-direction: column;
}

/* Terminal header adjustments for sidebar */
.terminal-container.sidebar-layout .terminal-header {
    /* Adjust header for vertical layout */
    min-height: 32px;
}
```

---

## 8. Key Takeaways

### Core Patterns from VS Code

1. **Service-Based Detection**: Use platform services (`IWorkbenchLayoutService`, `IViewDescriptorService`) to detect panel location
2. **Position → Orientation Mapping**: Bottom/Top = Horizontal, Left/Right = Vertical
3. **Dynamic Reconfiguration**: Monitor layout changes and update orientation in real-time
4. **Event-Driven Updates**: Fire events when orientation changes to notify dependent components
5. **SplitView Rebuild**: When orientation changes, recreate the SplitView with new orientation
6. **CSS Class Management**: Add visual feedback classes (`.terminal-side-view`) for styling

### Implementation Priorities

**High Priority:**
1. Implement panel location detection (sidebar vs. bottom panel)
2. Map location to flex-direction (row/column)
3. Send layout direction updates to webview via messages

**Medium Priority:**
1. Add event listeners for panel position changes
2. Implement CSS class toggling for visual feedback
3. Add smooth transitions for orientation changes

**Low Priority:**
1. Optimize performance for rapid panel position changes
2. Add accessibility labels for different layouts
3. Persist user's last panel location preference

---

## 9. VS Code Source Code References

### Primary Files Analyzed

1. **`terminalGroup.ts`** (631 lines)
   - Lines 470-485: `attachToElement()` - Initial orientation setup
   - Lines 549-562: `layout()` - Dynamic orientation detection and updates
   - Lines 598-610: `_getPosition()` and `_getOrientation()` - Position/orientation mapping
   - Lines 169-188: `setOrientation()` - SplitView recreation on orientation change

2. **`terminalTabbedView.ts`** (508 lines)
   - Lines 29-31: CSS class enum definition
   - Lines 135-143: Panel orientation change handler with CSS class management
   - Lines 245-254: `_getLastListWidth()` - Orientation-aware sizing

### Key Dependencies

- `SplitView` from `base/browser/ui/splitview/splitview.js`
- `Orientation` enum: `HORIZONTAL` (0) or `VERTICAL` (1)
- `Position` enum: `LEFT`, `RIGHT`, `TOP`, `BOTTOM`
- `ViewContainerLocation`: `Panel`, `Sidebar`, `AuxiliaryBar`
- `isHorizontal()` helper from `IWorkbenchLayoutService`

---

## 10. Next Steps

### Immediate Actions

1. **Create Panel Location Detector**
   - Implement detection logic in `SecondaryTerminalProvider`
   - Use webview dimensions and VS Code API hints

2. **Implement Layout Direction Manager**
   - Create new manager class or extend `TerminalContainerManager`
   - Handle flex-direction switching logic

3. **Update WebView Communication**
   - Add `update-layout-direction` message type
   - Implement handler in `main.ts`

4. **Add CSS Transitions**
   - Smooth transitions for layout direction changes
   - Prevent layout thrashing during orientation switch

### Testing Plan

1. **Manual Testing:**
   - Move terminal between sidebar and bottom panel
   - Verify layout direction changes automatically
   - Check multiple terminal split layouts

2. **Automated Testing:**
   - Unit tests for panel location detection
   - Integration tests for orientation mapping
   - E2E tests for layout direction updates

3. **Performance Testing:**
   - Measure layout recalculation time
   - Ensure smooth transitions without flicker
   - Test with 5 terminals in split view

---

## Appendix: Code Snippets for Quick Reference

### VS Code Pattern: Orientation Detection

```typescript
// Detect panel location and map to orientation
const terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
const panelPosition = this._layoutService.getPanelPosition();

const orientation = terminalLocation === ViewContainerLocation.Panel
    && isHorizontal(panelPosition)
    ? Orientation.HORIZONTAL
    : Orientation.VERTICAL;
```

### VS Code Pattern: Dynamic Orientation Updates

```typescript
// Monitor layout changes
const newPanelPosition = this._layoutService.getPanelPosition();
const newTerminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
const terminalPositionChanged = newPanelPosition !== this._panelPosition
    || newTerminalLocation !== this._terminalLocation;

if (terminalPositionChanged) {
    const newOrientation = newTerminalLocation === ViewContainerLocation.Panel
        && isHorizontal(newPanelPosition)
        ? Orientation.HORIZONTAL
        : Orientation.VERTICAL;

    this._splitPaneContainer.setOrientation(newOrientation);
    this._onPanelOrientationChanged.fire(newOrientation);
}
```

### VS Code Pattern: CSS Class Management

```typescript
// Add/remove CSS class based on orientation
this._register(this._terminalGroupService.onDidChangePanelOrientation((orientation) => {
    if (orientation === Orientation.VERTICAL) {
        this._terminalContainer.classList.add('terminal-side-view');
    } else {
        this._terminalContainer.classList.remove('terminal-side-view');
    }
}));
```

---

**Research Completed:** November 4, 2025
**License:** MIT (VS Code is MIT licensed)
**Attribution:** This research is based on the official VS Code repository (microsoft/vscode)
