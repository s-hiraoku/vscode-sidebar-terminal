# VS Code Terminal Location Detection Patterns

This document details how VS Code detects terminal view location (panel vs sidebar) and determines terminal orientation based on the official VS Code source code.

## Sources
- **Repository**: microsoft/vscode
- **Primary Files**:
  - `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts`
  - `src/vs/workbench/contrib/terminal/browser/terminalView.ts`
  - `src/vs/workbench/contrib/terminal/browser/terminalService.ts`
  - `src/vs/workbench/common/views.ts`
  - `src/vs/workbench/services/layout/browser/layoutService.ts`
  - `src/vs/base/browser/ui/sash/sash.ts`

---

## 1. Core Enums and Types

### ViewContainerLocation Enum
Defines where view containers can be positioned:

```typescript
export const enum ViewContainerLocation {
    Sidebar,
    Panel,
    AuxiliaryBar
}
```

**Helper Constants:**
```typescript
export const ViewContainerLocations = [
    ViewContainerLocation.Sidebar,
    ViewContainerLocation.Panel,
    ViewContainerLocation.AuxiliaryBar
];

export function ViewContainerLocationToString(location: ViewContainerLocation): string {
    switch (location) {
        case ViewContainerLocation.Sidebar: return 'sidebar';
        case ViewContainerLocation.Panel: return 'panel';
        case ViewContainerLocation.AuxiliaryBar: return 'auxiliarybar';
    }
}
```

### TerminalLocation Enum
Simplified terminal-specific locations:

```typescript
export enum TerminalLocation {
    Panel = 1,
    Editor = 2
}
```

**Note**: `TerminalLocation.Panel` means "in the terminal view" (which could be in bottom panel, sidebar, or auxiliary bar). The actual container location is determined separately via `ViewContainerLocation`.

### Panel Position Enum
Defines panel positioning:

```typescript
export const enum Position {
    LEFT,
    RIGHT,
    BOTTOM,
    TOP
}
```

**Helper Function:**
```typescript
export function isHorizontal(position: Position): boolean {
    return position === Position.BOTTOM || position === Position.TOP;
}
```

### Orientation Enum
For split pane layout direction:

```typescript
export const enum Orientation {
    VERTICAL,
    HORIZONTAL
}
```

---

## 2. View Location Detection APIs

### IViewDescriptorService Interface
The primary service for detecting view container locations:

```typescript
interface IViewDescriptorService {
    // Get the current location of a view by its ID
    getViewLocationById(viewId: string): ViewContainerLocation | null;

    // Get the view container that contains a specific view
    getViewContainerByViewId(viewId: string): ViewContainer | null;

    // Get the current location of a view container
    getViewContainerLocation(viewContainer: ViewContainer): ViewContainerLocation | null;

    // Get the default location for a view container
    getDefaultViewContainerLocation(viewContainer: ViewContainer): ViewContainerLocation | null;

    // Get all view containers at a specific location
    getViewContainersByLocation(location: ViewContainerLocation): ReadonlyArray<ViewContainer>;

    // Events for tracking location changes
    readonly onDidChangeContainerLocation: Event<{ viewContainer: ViewContainer, from: ViewContainerLocation, to: ViewContainerLocation }>;
}
```

### ILayoutService Interface
For panel position detection:

```typescript
interface ILayoutService {
    // Get current panel position (LEFT, RIGHT, BOTTOM, TOP)
    getPanelPosition(): Position;

    // Event fired when panel position changes
    readonly onDidChangePanelPosition: Event<string>;
}
```

---

## 3. Terminal View Location Detection Pattern

### Implementation in TerminalGroup
**File**: `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts`

```typescript
export class TerminalGroup extends Disposable implements ITerminalGroup {
    private _terminalLocation: ViewContainerLocation;
    private _panelPosition: Position;

    private readonly _onPanelOrientationChanged = this._register(new Emitter<Orientation>());
    readonly onPanelOrientationChanged = this._onPanelOrientationChanged.event;

    constructor(
        @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
        @ILayoutService private readonly _layoutService: ILayoutService,
        // ... other services
    ) {
        super();

        // Detect initial location
        this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
        this._panelPosition = this._layoutService.getPanelPosition();

        // Listen for location changes
        this._register(this._viewDescriptorService.onDidChangeContainerLocation(e => {
            if (e.viewContainer.id === TERMINAL_VIEW_ID) {
                this._terminalLocation = e.to;
                this._onPanelOrientationChanged.fire(this._getOrientation());
            }
        }));

        // Listen for panel position changes
        this._register(this._layoutService.onDidChangePanelPosition(() => {
            this._panelPosition = this._layoutService.getPanelPosition();
            this._onPanelOrientationChanged.fire(this._getOrientation());
        }));
    }

    private _getOrientation(): Orientation {
        // Terminals in Panel with horizontal position → HORIZONTAL orientation
        // Everything else (Sidebar, AuxiliaryBar, vertical panel) → VERTICAL orientation
        const orientation = this._terminalLocation === ViewContainerLocation.Panel &&
                           isHorizontal(this._panelPosition) ?
                           Orientation.HORIZONTAL :
                           Orientation.VERTICAL;
        return orientation;
    }
}
```

---

## 4. Key Detection Patterns

### Pattern 1: Detecting if Terminal is in Panel vs Sidebar

```typescript
// Inject IViewDescriptorService
constructor(
    @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService
) {
    // Get current location
    const location = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);

    if (location === ViewContainerLocation.Panel) {
        // Terminal is in bottom/side panel
    } else if (location === ViewContainerLocation.Sidebar) {
        // Terminal is in sidebar
    } else if (location === ViewContainerLocation.AuxiliaryBar) {
        // Terminal is in auxiliary bar
    }
}
```

### Pattern 2: Detecting Panel Position (Bottom vs Side)

```typescript
// Inject ILayoutService
constructor(
    @ILayoutService private readonly _layoutService: ILayoutService
) {
    const panelPosition = this._layoutService.getPanelPosition();

    if (panelPosition === Position.BOTTOM || panelPosition === Position.TOP) {
        // Panel is horizontal (bottom or top)
    } else {
        // Panel is vertical (left or right)
    }

    // Or use the helper function
    if (isHorizontal(panelPosition)) {
        // Panel is bottom or top
    }
}
```

### Pattern 3: Determining Terminal Orientation

```typescript
// Combine view location and panel position
private getTerminalOrientation(): Orientation {
    const viewLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);
    const panelPosition = this._layoutService.getPanelPosition();

    // Only horizontal when in Panel and panel is bottom/top
    if (viewLocation === ViewContainerLocation.Panel && isHorizontal(panelPosition)) {
        return Orientation.HORIZONTAL;
    }

    // Vertical for all other cases:
    // - Sidebar (always vertical)
    // - AuxiliaryBar (always vertical)
    // - Panel with left/right position (vertical)
    return Orientation.VERTICAL;
}
```

### Pattern 4: Listening for Location Changes

```typescript
// Listen for view container location changes
this._register(this._viewDescriptorService.onDidChangeContainerLocation(e => {
    if (e.viewContainer.id === TERMINAL_VIEW_ID) {
        console.log(`Terminal moved from ${e.from} to ${e.to}`);
        // Re-evaluate orientation
        this.updateOrientation();
    }
}));

// Listen for panel position changes
this._register(this._layoutService.onDidChangePanelPosition(positionString => {
    console.log(`Panel moved to ${positionString}`);
    const newPosition = this._layoutService.getPanelPosition();
    // Re-evaluate orientation
    this.updateOrientation();
}));
```

---

## 5. Terminal Split Direction Logic

### Implementation in TerminalTabbedView
**File**: `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`

```typescript
export class TerminalTabbedView extends Disposable {
    private _splitView: SplitView;
    private _panelOrientation: Orientation = Orientation.HORIZONTAL;

    constructor() {
        // Create split view with HORIZONTAL orientation by default
        this._splitView = new SplitView(parentElement, {
            orientation: Orientation.HORIZONTAL,
            proportionalLayout: false
        });

        // Listen for orientation changes from terminal group
        this._register(this._terminalGroupService.onDidChangePanelOrientation(orientation => {
            this._panelOrientation = orientation;

            // Apply CSS class for vertical layout
            if (orientation === Orientation.VERTICAL) {
                this._terminalContainer.classList.add('terminal-view-is-vertical');
            } else {
                this._terminalContainer.classList.remove('terminal-view-is-vertical');
            }

            // Adjust layout dimensions based on orientation
            this.layout(this._width, this._height);
        }));
    }
}
```

---

## 6. Complete Integration Example

Here's a complete example showing how to implement location detection in a terminal extension:

```typescript
import { Disposable } from 'vs/base/common/lifecycle';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { ViewContainerLocation } from 'vs/workbench/common/views';
import { Position, isHorizontal, ILayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IViewDescriptorService } from 'vs/workbench/services/views/common/viewDescriptorService';

const TERMINAL_VIEW_ID = 'terminal';

export class TerminalLocationManager extends Disposable {
    private _currentLocation: ViewContainerLocation;
    private _currentPanelPosition: Position;
    private _currentOrientation: Orientation;

    constructor(
        @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
        @ILayoutService private readonly _layoutService: ILayoutService
    ) {
        super();

        // Initialize current state
        this._currentLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
        this._currentPanelPosition = this._layoutService.getPanelPosition();
        this._currentOrientation = this._calculateOrientation();

        // Set up location change listener
        this._register(this._viewDescriptorService.onDidChangeContainerLocation(e => {
            if (e.viewContainer.id === TERMINAL_VIEW_ID) {
                this._onLocationChanged(e.from, e.to);
            }
        }));

        // Set up panel position change listener
        this._register(this._layoutService.onDidChangePanelPosition(() => {
            this._onPanelPositionChanged();
        }));
    }

    private _calculateOrientation(): Orientation {
        // VS Code's logic: HORIZONTAL only when in Panel AND panel is bottom/top
        if (this._currentLocation === ViewContainerLocation.Panel &&
            isHorizontal(this._currentPanelPosition)) {
            return Orientation.HORIZONTAL;
        }
        return Orientation.VERTICAL;
    }

    private _onLocationChanged(from: ViewContainerLocation, to: ViewContainerLocation): void {
        console.log(`Terminal location changed: ${ViewContainerLocationToString(from)} → ${ViewContainerLocationToString(to)}`);

        this._currentLocation = to;
        const newOrientation = this._calculateOrientation();

        if (newOrientation !== this._currentOrientation) {
            this._currentOrientation = newOrientation;
            this._applyOrientation();
        }
    }

    private _onPanelPositionChanged(): void {
        const newPosition = this._layoutService.getPanelPosition();
        console.log(`Panel position changed: ${this._currentPanelPosition} → ${newPosition}`);

        this._currentPanelPosition = newPosition;
        const newOrientation = this._calculateOrientation();

        if (newOrientation !== this._currentOrientation) {
            this._currentOrientation = newOrientation;
            this._applyOrientation();
        }
    }

    private _applyOrientation(): void {
        if (this._currentOrientation === Orientation.HORIZONTAL) {
            console.log('Applying horizontal layout (terminal in bottom/top panel)');
            // Apply horizontal split layout
        } else {
            console.log('Applying vertical layout (terminal in sidebar/aux bar or side panel)');
            // Apply vertical split layout
        }
    }

    public isInPanel(): boolean {
        return this._currentLocation === ViewContainerLocation.Panel;
    }

    public isInSidebar(): boolean {
        return this._currentLocation === ViewContainerLocation.Sidebar;
    }

    public isInAuxiliaryBar(): boolean {
        return this._currentLocation === ViewContainerLocation.AuxiliaryBar;
    }

    public getOrientation(): Orientation {
        return this._currentOrientation;
    }
}
```

---

## 7. Key Takeaways

### Location Detection Strategy
1. **Use `IViewDescriptorService.getViewLocationById()`** to get the current view container location
2. **Use `ILayoutService.getPanelPosition()`** to get the panel's position (if in panel)
3. **Combine both** to determine the appropriate terminal orientation

### Orientation Rules
- **HORIZONTAL**: Terminal is in Panel AND panel is at BOTTOM or TOP
- **VERTICAL**: All other cases (Sidebar, AuxiliaryBar, or Panel at LEFT/RIGHT)

### Event Handling
- Listen to `IViewDescriptorService.onDidChangeContainerLocation` for drag-and-drop between containers
- Listen to `ILayoutService.onDidChangePanelPosition` for panel repositioning
- Both events should trigger orientation recalculation

### Services Required
```typescript
@IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService
@ILayoutService private readonly _layoutService: ILayoutService
```

---

## 8. VSCode Extension API Equivalent

For VS Code extensions (not workbench internal code), the equivalent approach would be:

```typescript
import * as vscode from 'vscode';

// Note: VS Code extension API doesn't expose ViewContainerLocation directly
// Extensions cannot detect sidebar vs panel programmatically
// However, you can:

// 1. Register view in different containers via package.json
{
  "contributes": {
    "views": {
      "panel": [{ "id": "myTerminal", "name": "My Terminal" }],
      // OR
      "sidebar": [{ "id": "myTerminal", "name": "My Terminal" }]
    }
  }
}

// 2. Let users move views via UI (View: Move View command)

// 3. Extensions cannot detect current location at runtime
// This is a workbench-internal capability only
```

**Important**: The view location detection APIs (`IViewDescriptorService`, `ILayoutService`) are **internal VS Code workbench APIs** not available in the public VS Code Extension API. Extensions building custom webviews in panels/sidebars must handle orientation statically based on their registration location.

---

## 9. Application to vscode-sidebar-terminal Extension

For this extension, since it uses a webview in the sidebar:

### Current State
- Extension is registered in sidebar via `package.json`
- Sidebar location is static (users can't drag to panel)
- Orientation should always be VERTICAL

### If Supporting Panel Migration
To support users moving the terminal to the panel:

```json
// package.json - register in both locations
{
  "contributes": {
    "views": {
      "sidebar": [
        {
          "id": "sidebarTerminal",
          "name": "Sidebar Terminal"
        }
      ],
      "panel": [
        {
          "id": "sidebarTerminal",
          "name": "Sidebar Terminal"
        }
      ]
    }
  }
}
```

However, **VS Code extension API doesn't expose location detection**. The extension cannot programmatically detect if the view is currently in sidebar vs panel.

### Recommended Approach
1. **Configuration-based**: Add a setting for users to choose orientation
```typescript
const config = vscode.workspace.getConfiguration('sidebarTerminal');
const orientation = config.get<string>('layout.orientation', 'vertical');
```

2. **Dimension-based heuristic**: Use webview dimensions to infer orientation
```typescript
// In webview
window.addEventListener('resize', () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    if (aspectRatio > 1.5) {
        // Likely in bottom panel (wide and short)
        applyHorizontalLayout();
    } else {
        // Likely in sidebar (tall and narrow)
        applyVerticalLayout();
    }
});
```

3. **Static registration**: Keep it sidebar-only with vertical orientation
   - Simpler, more predictable
   - Users who want panel terminal can use built-in terminal

---

## References

- **VS Code Source**: https://github.com/microsoft/vscode
- **View Container Location**: `src/vs/workbench/common/views.ts`
- **Terminal Group Implementation**: `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts`
- **Layout Service**: `src/vs/workbench/services/layout/browser/layoutService.ts`
- **Orientation Enum**: `src/vs/base/browser/ui/sash/sash.ts`
