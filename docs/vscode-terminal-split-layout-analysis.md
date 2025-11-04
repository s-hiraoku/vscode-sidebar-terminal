# VS Code Terminal Split Layout - Deep Dive Analysis

**Date**: 2025-11-04
**Source**: microsoft/vscode repository (main branch)
**Focus**: Bottom panel side-by-side terminal layout

## Executive Summary

VS Code uses a **SplitView widget** (not flexbox or CSS Grid) to manage side-by-side terminal layout. The orientation switches dynamically based on panel position, with HORIZONTAL orientation for bottom/top panels and VERTICAL orientation for sidebars.

---

## 1. DOM Structure

### Hierarchy (Bottom Panel Scenario)

```
.pane-body.integrated-terminal
└── .split-view (parent SplitView container)
    ├── .split-view-view (index 0 or 1: tabs container)
    │   └── .tabs-container
    │       └── .tabs-list-container
    │           └── .tabs-list (TerminalTabList)
    └── .split-view-view (index 0 or 1: terminal container)
        └── .terminal-outer-container
            └── .terminal-groups-container
                └── .terminal-group (per group)
                    └── .monaco-split-view2.horizontal (inner SplitView)
                        ├── .split-view-view (per terminal)
                        │   └── .terminal-split-pane
                        │       └── .terminal-wrapper
                        │           └── .xterm
                        ├── .split-view-view (per terminal)
                        │   └── .terminal-split-pane
                        └── ... (more terminals)
```

### Key Observations

1. **Two-Level SplitView Architecture**:
   - **Outer SplitView**: Manages tabs + terminal container (HORIZONTAL orientation)
   - **Inner SplitView**: Manages individual terminals within a group (orientation based on panel position)

2. **Index Management**:
   ```typescript
   // From terminalTabbedView.ts (lines 70-71)
   this._tabTreeIndex = this._terminalConfigurationService.config.tabs.location === 'left' ? 0 : 1;
   this._terminalContainerIndex = this._terminalConfigurationService.config.tabs.location === 'left' ? 1 : 0;
   ```

3. **CSS Classes**:
   - `.terminal-split-pane`: Individual terminal container
   - `.terminal-side-view`: Applied when panel is vertical (sidebar)
   - `.monaco-split-view2.horizontal`: Split terminals horizontally (side-by-side)
   - `.monaco-split-view2.vertical`: Split terminals vertically (stacked)

---

## 2. Orientation Logic

### Panel Position Detection

**File**: `terminalGroup.ts` (lines 451-455)

```typescript
attachToElement(element: HTMLElement): void {
    this._container = element;

    if (!this._splitPaneContainer) {
        this._panelPosition = this._layoutService.getPanelPosition();
        this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
        const orientation = this._terminalLocation === ViewContainerLocation.Panel && isHorizontal(this._panelPosition)
            ? Orientation.HORIZONTAL
            : Orientation.VERTICAL;
        this._splitPaneContainer = this._instantiationService.createInstance(SplitPaneContainer, this._groupElement, orientation);
        this.terminalInstances.forEach(instance => this._splitPaneContainer!.split(instance, this._activeInstanceIndex + 1));
    }
}
```

### Orientation Switching

**File**: `terminalGroup.ts` (lines 494-505)

```typescript
layout(width: number, height: number): void {
    if (this._splitPaneContainer) {
        // Check if the panel position changed and rotate panes if so
        const newPanelPosition = this._layoutService.getPanelPosition();
        const newTerminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
        const terminalPositionChanged = newPanelPosition !== this._panelPosition || newTerminalLocation !== this._terminalLocation;

        if (terminalPositionChanged) {
            const newOrientation = newTerminalLocation === ViewContainerLocation.Panel && isHorizontal(newPanelPosition)
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

### Key Decision Points

| Panel Position | `isHorizontal()` | Terminal Orientation | Layout Direction |
|----------------|------------------|---------------------|------------------|
| BOTTOM         | true             | HORIZONTAL          | Side-by-side     |
| TOP            | true             | HORIZONTAL          | Side-by-side     |
| LEFT (sidebar) | false            | VERTICAL            | Stacked          |
| RIGHT (sidebar)| false            | VERTICAL            | Stacked          |

---

## 3. SplitView Implementation

### SplitPaneContainer Class

**File**: `terminalGroup.ts` (lines 35-167)

#### Constructor

```typescript
class SplitPaneContainer extends Disposable {
    private _height: number;
    private _width: number;
    private _splitView!: SplitView;
    private _children: SplitPane[] = [];
    private _terminalToPane: Map<ITerminalInstance, SplitPane> = new Map();

    constructor(
        private _container: HTMLElement,
        public orientation: Orientation,
    ) {
        super();
        this._width = this._container.offsetWidth;
        this._height = this._container.offsetHeight;
        this._createSplitView();
        this._splitView.layout(this.orientation === Orientation.HORIZONTAL ? this._width : this._height);
    }

    private _createSplitView(): void {
        this._splitViewDisposables.clear();
        this._splitView = new SplitView(this._container, { orientation: this.orientation });
        this._splitViewDisposables.add(this._splitView);
        this._splitViewDisposables.add(this._splitView.onDidSashReset(() => this._splitView.distributeViewSizes()));
    }
}
```

#### Adding Terminals

```typescript
split(instance: ITerminalInstance, index: number): void {
    this._addChild(instance, index);
}

private _addChild(instance: ITerminalInstance, index: number): void {
    const child = new SplitPane(instance, this.orientation === Orientation.HORIZONTAL ? this._height : this._width);
    child.orientation = this.orientation;

    if (typeof index === 'number') {
        this._children.splice(index, 0, child);
    } else {
        this._children.push(child);
    }

    this._terminalToPane.set(instance, this._children[this._children.indexOf(child)]);

    // Critical: Use Sizing.Distribute to evenly divide space
    this._withDisabledLayout(() => this._splitView.addView(child, Sizing.Distribute, index));
    this.layout(this._width, this._height);
}
```

#### Layout Calculation

```typescript
layout(width: number, height: number): void {
    this._width = width;
    this._height = height;

    if (this.orientation === Orientation.HORIZONTAL) {
        // Side-by-side: terminals share width, full height each
        this._children.forEach(c => c.orthogonalLayout(height));
        this._splitView.layout(width);
    } else {
        // Stacked: terminals share height, full width each
        this._children.forEach(c => c.orthogonalLayout(width));
        this._splitView.layout(height);
    }
}
```

#### Orientation Switching

```typescript
setOrientation(orientation: Orientation): void {
    if (this.orientation === orientation) {
        return;
    }
    this.orientation = orientation;

    // Remove old split view DOM
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

### SplitPane Class

**File**: `terminalGroup.ts` (lines 169-210)

```typescript
class SplitPane implements IView {
    minimumSize: number = Constants.SplitPaneMinSize; // 80px
    maximumSize: number = Number.MAX_VALUE;
    orientation: Orientation | undefined;
    readonly element: HTMLElement;

    constructor(
        readonly instance: ITerminalInstance,
        public orthogonalSize: number
    ) {
        this.element = document.createElement('div');
        this.element.className = 'terminal-split-pane';
        this.instance.attachToElement(this.element);
    }

    layout(size: number): void {
        // Only layout when both sizes are known
        if (!size || !this.orthogonalSize) {
            return;
        }

        if (this.orientation === Orientation.VERTICAL) {
            // Stacked: size = height, orthogonalSize = width
            this.instance.layout({ width: this.orthogonalSize, height: size });
        } else {
            // Side-by-side: size = width, orthogonalSize = height
            this.instance.layout({ width: size, height: this.orthogonalSize });
        }
    }

    orthogonalLayout(size: number): void {
        this.orthogonalSize = size;
    }
}
```

---

## 4. CSS Styles for Split Terminals

### Core Layout Styles

```css
/* All terminal containers have 100% height */
.monaco-workbench .pane-body.integrated-terminal .terminal-outer-container,
.monaco-workbench .pane-body.integrated-terminal .terminal-groups-container,
.monaco-workbench .pane-body.integrated-terminal .terminal-group,
.monaco-workbench .pane-body.integrated-terminal .terminal-split-pane {
    height: 100%;
}

/* SplitView containers use box-sizing border-box */
.monaco-workbench .pane-body.integrated-terminal .split-view-view {
    box-sizing: border-box;
    overflow: hidden;
}
```

### Border Between Split Terminals

```css
/* Horizontal split (side-by-side) - left border on non-first terminals */
.monaco-workbench .pane-body.integrated-terminal .terminal-group .monaco-split-view2.horizontal .split-view-view:not(:first-child) {
    border-left-width: 1px;
    border-left-style: solid;
    border-color: var(--vscode-terminal-border);
}

/* Vertical split (stacked) - top border on non-first terminals */
.monaco-workbench .pane-body.integrated-terminal .terminal-group .monaco-split-view2.vertical .split-view-view:not(:first-child) {
    border-top-width: 1px;
    border-top-style: solid;
    border-color: var(--vscode-terminal-border);
}
```

### Terminal Alignment

```css
/* Bottom align terminals by default */
.monaco-workbench .terminal-editor .xterm,
.monaco-workbench .pane-body.integrated-terminal .xterm {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
}

/* Top align when vertical and NOT the last terminal */
.monaco-workbench .pane-body.integrated-terminal .monaco-split-view2.vertical .split-view-view:not(:last-child) .xterm {
    top: 0;
    bottom: auto;
}

/* Top align when panel is in sidebar (vertical orientation) */
.terminal-side-view .terminal.xterm {
    top: 0;
}
```

---

## 5. Event Handling for Orientation Changes

### Panel Orientation Change Event

**File**: `terminalTabbedView.ts` (lines 109-117)

```typescript
this._register(this._terminalGroupService.onDidChangePanelOrientation((orientation) => {
    this._panelOrientation = orientation;
    if (this._panelOrientation === Orientation.VERTICAL) {
        this._terminalContainer.classList.add(CssClass.ViewIsVertical);
    } else {
        this._terminalContainer.classList.remove(CssClass.ViewIsVertical);
    }
}));
```

### Layout Recalculation

**File**: `terminalTabbedView.ts` (lines 308-323)

```typescript
private _setupSplitView(terminalOuterContainer: HTMLElement): void {
    this._register(this._splitView.onDidSashReset(() => this._handleOnDidSashReset()));
    this._register(this._splitView.onDidSashChange(() => this._handleOnDidSashChange()));

    if (this._shouldShowTabs()) {
        this._addTabTree();
    }

    this._splitView.addView({
        element: terminalOuterContainer,
        layout: width => this._terminalGroupService.groups.forEach(tab => tab.layout(width, this._height || 0)),
        minimumSize: 120,
        maximumSize: Number.POSITIVE_INFINITY,
        onDidChange: () => Disposable.None,
        priority: LayoutPriority.High
    }, Sizing.Distribute, this._terminalContainerIndex);
}
```

---

## 6. Critical Implementation Details

### Prevent Layout Flicker

**File**: `terminalGroup.ts` (lines 162-167)

```typescript
private _withDisabledLayout(innerFunction: () => void): void {
    // Whenever manipulating views that are going to be changed immediately, disabling
    // layout/resize events in the terminal prevent bad dimensions going to the pty.
    this._children.forEach(c => c.instance.disableLayout = true);
    innerFunction();
    this._children.forEach(c => c.instance.disableLayout = false);
}
```

### Sizing Strategy

```typescript
// From splitview.ts - Sizing enum
enum Sizing {
    Distribute = 'distribute',  // Evenly distribute available space
    Split = 'split',            // Split current view
    Auto = 'auto'               // Auto-size based on content
}
```

**Usage**: When adding terminals, VS Code uses `Sizing.Distribute` to ensure equal sizing.

### Minimum Size Constraint

```typescript
const enum Constants {
    SplitPaneMinSize = 80,  // Minimum 80px per terminal
    ResizePartCellCount = 4
}
```

---

## 7. Step-by-Step Initialization Sequence

### For Bottom Panel (Side-by-Side Layout)

1. **Panel Location Detection**
   ```typescript
   const panelPosition = layoutService.getPanelPosition(); // Position.BOTTOM
   const terminalLocation = viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID); // ViewContainerLocation.Panel
   ```

2. **Orientation Calculation**
   ```typescript
   const isHorizontalPanel = isHorizontal(panelPosition); // true for BOTTOM
   const orientation = terminalLocation === ViewContainerLocation.Panel && isHorizontalPanel
       ? Orientation.HORIZONTAL  // ✓ Side-by-side
       : Orientation.VERTICAL;
   ```

3. **SplitPaneContainer Creation**
   ```typescript
   const splitPaneContainer = new SplitPaneContainer(groupElement, Orientation.HORIZONTAL);
   ```

4. **SplitView Initialization**
   ```typescript
   const splitView = new SplitView(container, { orientation: Orientation.HORIZONTAL });
   splitView.layout(containerWidth);
   ```

5. **Terminal Addition**
   ```typescript
   terminalInstances.forEach(instance => {
       const pane = new SplitPane(instance, containerHeight);
       pane.orientation = Orientation.HORIZONTAL;
       splitView.addView(pane, Sizing.Distribute, index);
   });
   ```

6. **Layout Calculation**
   ```typescript
   // HORIZONTAL: Each terminal gets equal width, full height
   children.forEach(pane => pane.orthogonalLayout(height)); // Set height
   splitView.layout(width); // Distribute width among panes

   // Result: Terminal 1 gets width/2, Terminal 2 gets width/2
   ```

7. **CSS Class Application**
   ```typescript
   // Container gets orientation class
   if (orientation === Orientation.VERTICAL) {
       terminalContainer.classList.add('terminal-side-view');
   } else {
       terminalContainer.classList.remove('terminal-side-view');
   }
   ```

---

## 8. Comparison: Bottom Panel vs. Sidebar

| Aspect | Bottom Panel | Left/Right Sidebar |
|--------|--------------|-------------------|
| **Orientation** | `Orientation.HORIZONTAL` | `Orientation.VERTICAL` |
| **Layout Direction** | Side-by-side (→) | Stacked (↓) |
| **Size Distribution** | Width shared, height full | Height shared, width full |
| **Terminal Alignment** | Bottom aligned | Top aligned |
| **CSS Class** | (none) | `.terminal-side-view` |
| **Border** | Left border on 2nd+ terminals | Top border on 2nd+ terminals |

---

## 9. Key Takeaways for Our Implementation

### ✅ What We Should Do

1. **Use Explicit Orientation Management**
   - Detect panel position on initialization
   - Switch orientation when panel moves
   - Fire orientation change events

2. **Implement Two-Level Layout**
   - Outer container: Flexbox or Grid for overall structure
   - Inner container: Explicit width/height for terminals based on orientation

3. **Apply Layout Atomically**
   - Disable layout during DOM manipulation
   - Batch size calculations
   - Apply all changes in one pass

4. **Use `display: flex` for Terminal Container**
   ```css
   .terminal-groups-container {
       display: flex;
       flex-direction: row; /* when HORIZONTAL */
   }

   .terminal-groups-container.terminal-side-view {
       flex-direction: column; /* when VERTICAL */
   }
   ```

5. **Set Explicit Dimensions**
   ```typescript
   if (orientation === Orientation.HORIZONTAL) {
       // Side-by-side
       terminal.style.width = `${widthPerTerminal}px`;
       terminal.style.height = '100%';
   } else {
       // Stacked
       terminal.style.width = '100%';
       terminal.style.height = `${heightPerTerminal}px`;
   }
   ```

### ❌ What We Should NOT Do

1. Don't rely on CSS alone for layout - VS Code uses programmatic layout
2. Don't assume flexbox will auto-distribute - calculate explicitly
3. Don't forget to update orientation on panel position changes
4. Don't apply layouts during DOM manipulation

---

## 10. Implementation Pattern for WebView

### Recommended Approach

```typescript
interface TerminalLayoutManager {
    // Detect panel position
    detectPanelPosition(): 'bottom' | 'top' | 'left' | 'right';

    // Calculate orientation
    getOrientation(position: PanelPosition): 'horizontal' | 'vertical';

    // Apply layout
    layoutTerminals(terminals: TerminalElement[], orientation: Orientation, containerSize: { width: number; height: number }): void;

    // Handle orientation change
    onPanelPositionChanged(newPosition: PanelPosition): void;
}
```

### CSS Structure

```css
/* Container base */
.terminal-groups-container {
    display: flex;
    height: 100%;
    width: 100%;
}

/* Horizontal (side-by-side) */
.terminal-groups-container.horizontal {
    flex-direction: row;
}

.terminal-groups-container.horizontal > .terminal-container {
    flex: 1 1 0;
    min-width: 80px;
    height: 100%;
    border-left: 1px solid var(--vscode-terminal-border);
}

.terminal-groups-container.horizontal > .terminal-container:first-child {
    border-left: none;
}

/* Vertical (stacked) */
.terminal-groups-container.vertical {
    flex-direction: column;
}

.terminal-groups-container.vertical > .terminal-container {
    flex: 1 1 0;
    min-height: 80px;
    width: 100%;
    border-top: 1px solid var(--vscode-terminal-border);
}

.terminal-groups-container.vertical > .terminal-container:first-child {
    border-top: none;
}
```

---

## 11. Testing Scenarios

### Must Test

1. ✅ Bottom panel with 2 terminals → side-by-side
2. ✅ Bottom panel with 3 terminals → side-by-side (equal width)
3. ✅ Move panel from bottom to left → layout switches to stacked
4. ✅ Move panel from left to bottom → layout switches to side-by-side
5. ✅ Resize panel → terminals resize proportionally
6. ✅ Add terminal while in bottom panel → new terminal appears side-by-side
7. ✅ Remove terminal → remaining terminals expand

---

## References

- **terminalGroup.ts**: Lines 35-631
- **terminalTabbedView.ts**: Lines 1-508
- **terminal.css**: Terminal styling
- **splitview.ts**: SplitView widget implementation

---

## Conclusion

VS Code's terminal split layout is **NOT** pure CSS - it's a sophisticated TypeScript-driven system that:

1. Detects panel position using layout services
2. Calculates orientation (HORIZONTAL for bottom, VERTICAL for sidebar)
3. Creates a SplitView widget with the calculated orientation
4. Adds terminals as SplitPane instances with explicit sizing
5. Distributes space evenly using `Sizing.Distribute`
6. Applies CSS classes for visual styling
7. Recalculates layout on panel position changes

**Our implementation should follow the same pattern**: Detect position → Calculate orientation → Apply layout programmatically → Style with CSS.
