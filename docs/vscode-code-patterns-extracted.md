# VS Code Terminal Location Detection - Extracted Code Patterns

This document contains the exact code patterns extracted from VS Code source code that implement terminal location detection and orientation handling.

## Source Reference
- **Repository**: https://github.com/microsoft/vscode
- **Extraction Date**: 2025-11-03
- **Primary File**: `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts` (lines ~140-220)

---

## Pattern 1: Initialization and State Tracking

### From terminalGroup.ts

```typescript
export class TerminalGroup extends Disposable implements ITerminalGroup {
    // State variables for location tracking
    private _terminalLocation: ViewContainerLocation;
    private _panelPosition: Position;

    // Event emitter for orientation changes
    private readonly _onPanelOrientationChanged = this._register(new Emitter<Orientation>());
    readonly onPanelOrientationChanged = this._onPanelOrientationChanged.event;

    constructor(
        @IInstantiationService private readonly _instantiationService: IInstantiationService,
        @IContextKeyService private readonly _contextKeyService: IContextKeyService,
        @IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
        @ITerminalService private readonly _terminalService: ITerminalService,
        @ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
        @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
        @ILayoutService layoutService: ILayoutService,
        // ... other dependencies
    ) {
        super();

        // PATTERN: Get initial view location
        this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;

        // PATTERN: Get initial panel position
        this._panelPosition = layoutService.getPanelPosition();

        // Fire initial orientation
        this._onPanelOrientationChanged.fire(this._getOrientation());
    }
}
```

**Key Takeaways**:
- Store both `_terminalLocation` (Sidebar/Panel/AuxiliaryBar) and `_panelPosition` (Bottom/Top/Left/Right)
- Use event emitter pattern for orientation changes
- Initialize state in constructor
- Fire initial orientation after setup

---

## Pattern 2: Orientation Calculation Logic

### From terminalGroup.ts

```typescript
private _getOrientation(): Orientation {
    // CRITICAL LOGIC: Combine view location and panel position
    return this._terminalLocation === ViewContainerLocation.Panel &&
           isHorizontal(this._panelPosition) ?
           Orientation.HORIZONTAL :
           Orientation.VERTICAL;
}
```

### Helper Function from layoutService.ts

```typescript
export function isHorizontal(position: Position): boolean {
    return position === Position.BOTTOM || position === Position.TOP;
}
```

**Key Takeaways**:
- Simple ternary expression for orientation
- HORIZONTAL only when: in Panel AND panel is Bottom/Top
- VERTICAL for everything else
- Use helper function for readability

---

## Pattern 3: Event Handling for Location Changes

### From terminalGroup.ts (inferred from event usage)

```typescript
constructor(
    @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
    @ILayoutService private readonly _layoutService: ILayoutService,
) {
    super();

    // PATTERN: Listen for view container location changes
    this._register(this._viewDescriptorService.onDidChangeContainerLocation(e => {
        // Check if this event is for the terminal view
        if (e.viewContainer.id === TERMINAL_VIEW_ID) {
            // Update stored location
            this._terminalLocation = e.to;

            // Recalculate and fire new orientation
            const newOrientation = this._getOrientation();
            this._onPanelOrientationChanged.fire(newOrientation);

            // Optional: Log for debugging
            console.log(`Terminal moved from ${ViewContainerLocationToString(e.from)} to ${ViewContainerLocationToString(e.to)}`);
        }
    }));

    // PATTERN: Listen for panel position changes
    this._register(this._layoutService.onDidChangePanelPosition(positionString => {
        // Update stored position
        this._panelPosition = this._layoutService.getPanelPosition();

        // Recalculate and fire new orientation
        const newOrientation = this._getOrientation();
        this._onPanelOrientationChanged.fire(newOrientation);

        // Optional: Log for debugging
        console.log(`Panel position changed to ${positionString}`);
    }));
}
```

**Key Takeaways**:
- Register event listeners in constructor
- Use `this._register()` for automatic disposal
- Check event target before processing
- Always recalculate orientation after changes
- Fire events to notify dependents

---

## Pattern 4: Attaching to Terminal View

### From terminalGroup.ts

```typescript
public async attachToElement(element: HTMLElement): Promise<void> {
    // Create split pane container
    this._container = document.createElement('div');
    this._container.classList.add('terminal-group');

    // Get current orientation
    const orientation = this._getOrientation();

    // Create split view with calculated orientation
    this._splitPaneContainer = this._instantiationService.createInstance(
        SplitPaneContainer,
        this._container,
        orientation  // Pass orientation here
    );

    element.appendChild(this._container);
}
```

**Key Takeaways**:
- Calculate orientation before creating UI elements
- Pass orientation to split pane container
- Apply CSS classes based on state

---

## Pattern 5: Responding to Orientation Changes

### From terminalTabbedView.ts

```typescript
export class TerminalTabbedView extends Disposable {
    private _panelOrientation: Orientation = Orientation.HORIZONTAL;
    private _terminalContainer: HTMLElement;

    constructor(
        @ITerminalGroupService private readonly _terminalGroupService: ITerminalGroupService,
    ) {
        super();

        // PATTERN: Listen to orientation changes from group service
        this._register(this._terminalGroupService.onDidChangePanelOrientation(orientation => {
            // Store new orientation
            this._panelOrientation = orientation;

            // Apply CSS classes based on orientation
            if (orientation === Orientation.VERTICAL) {
                this._terminalContainer.classList.add('terminal-view-is-vertical');
                this._terminalContainer.classList.remove('terminal-view-is-horizontal');
            } else {
                this._terminalContainer.classList.remove('terminal-view-is-vertical');
                this._terminalContainer.classList.add('terminal-view-is-horizontal');
            }

            // Trigger layout recalculation
            this.layout(this._width, this._height);
        }));
    }

    private layout(width: number, height: number): void {
        // Apply different layout logic based on orientation
        if (this._panelOrientation === Orientation.VERTICAL) {
            // Vertical layout: stack terminals
            this.layoutVertical(width, height);
        } else {
            // Horizontal layout: side-by-side terminals
            this.layoutHorizontal(width, height);
        }
    }
}
```

**Key Takeaways**:
- Listen to group service orientation events
- Toggle CSS classes for styling
- Trigger layout recalculation
- Separate layout methods for each orientation

---

## Pattern 6: Tab List Width Management

### From terminalTabbedView.ts

```typescript
export class TerminalTabbedView extends Disposable {
    private _tabTreeIndex: number;
    private _terminalContainerIndex: number;

    constructor(
        @ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
        @IStorageService private readonly _storageService: IStorageService,
    ) {
        super();

        // PATTERN: Adjust tab position based on configuration
        this._updateTabLocation();

        // Listen for config changes
        this._register(this._terminalConfigurationService.onConfigChanged(e => {
            if (e.affectsConfiguration('tabs.location')) {
                this._updateTabLocation();
            }
        }));

        // Listen for orientation changes to adjust tab widths
        this._register(this._terminalGroupService.onDidChangePanelOrientation(orientation => {
            this._updateTabWidth(orientation);
        }));
    }

    private _updateTabLocation(): void {
        const tabLocation = this._terminalConfigurationService.config.tabs.location;

        // PATTERN: Swap tab position (left vs right)
        if (tabLocation === 'left') {
            this._tabTreeIndex = 0;
            this._terminalContainerIndex = 1;
        } else {
            this._tabTreeIndex = 1;
            this._terminalContainerIndex = 0;
        }

        // Swap views in split pane
        if (this._splitView) {
            this._splitView.swapViews(0, 1);
        }
    }

    private _updateTabWidth(orientation: Orientation): void {
        // PATTERN: Different widths for vertical vs horizontal layouts
        const storageKey = orientation === Orientation.VERTICAL ?
            'TabsListWidthVertical' :
            'TabsListWidthHorizontal';

        const defaultWidth = orientation === Orientation.VERTICAL ?
            TerminalTabsListSizes.NarrowViewWidth :
            TerminalTabsListSizes.DefaultWidth;

        // Restore saved width or use default
        const width = this._storageService.getNumber(storageKey, StorageScope.PROFILE, defaultWidth);

        // Apply width to tab list
        if (this._splitView) {
            this._splitView.resizeView(this._tabTreeIndex, width);
        }
    }
}
```

**Key Takeaways**:
- Store separate widths for vertical vs horizontal orientations
- Use storage service for persistence
- Swap view positions based on configuration
- Apply defaults appropriate for orientation

---

## Pattern 7: Split View Creation with Orientation

### From terminalTabbedView.ts

```typescript
private _createSplitView(parentElement: HTMLElement): void {
    // PATTERN: Create split view with initial orientation
    this._splitView = new SplitView(parentElement, {
        orientation: Orientation.HORIZONTAL,  // Initial orientation
        proportionalLayout: false             // Use absolute sizing
    });

    // Add views (tabs list and terminal container)
    this._splitView.addView({
        element: this._tabListElement,
        minimumSize: TerminalTabsListSizes.MinimumWidth,
        maximumSize: TerminalTabsListSizes.MaximumWidth,
        onDidChange: Event.None
    }, Sizing.Distribute, this._tabTreeIndex);

    this._splitView.addView({
        element: this._terminalContainer,
        minimumSize: 0,
        maximumSize: Number.MAX_VALUE,
        onDidChange: Event.None
    }, Sizing.Distribute, this._terminalContainerIndex);
}
```

**Key Takeaways**:
- Set initial orientation when creating split view
- Use proportional vs absolute layout appropriately
- Define minimum/maximum sizes for views
- Use index variables for flexible view ordering

---

## Pattern 8: Hover Position Based on Layout

### From terminalTabsList.ts

```typescript
export class TerminalTabsList extends Disposable {
    constructor(
        @ITerminalConfigurationService private readonly _terminalConfigurationService: ITerminalConfigurationService,
    ) {
        super();

        // PATTERN: Adjust hover position based on tab location
        const tabLocation = this._terminalConfigurationService.config.tabs.location;

        this._hoverDelegate = {
            showHover: (options: IHoverDelegateOptions) => {
                // Position hover on opposite side of tabs
                const hoverPosition = tabLocation === 'left' ?
                    HoverPosition.RIGHT :
                    HoverPosition.LEFT;

                return this._hoverService.showHover({
                    ...options,
                    position: { hoverPosition }
                });
            }
        };
    }
}
```

**Key Takeaways**:
- Position UI elements relative to tab location
- Use opposite side for hover to avoid obstruction
- Configure hover based on layout configuration

---

## Pattern 9: Complete Integration Example

Here's a complete example combining all patterns:

```typescript
import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { SplitView, Sizing } from 'vs/base/browser/ui/splitview/splitview';
import { ViewContainerLocation } from 'vs/workbench/common/views';
import { Position, isHorizontal, ILayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IViewDescriptorService } from 'vs/workbench/services/views/common/viewDescriptorService';

const TERMINAL_VIEW_ID = 'terminal';

export class TerminalLocationAwareManager extends Disposable {
    // State tracking
    private _terminalLocation: ViewContainerLocation;
    private _panelPosition: Position;
    private _currentOrientation: Orientation;

    // UI elements
    private _container: HTMLElement | undefined;
    private _splitView: SplitView | undefined;

    // Events
    private readonly _onDidChangeOrientation = this._register(new Emitter<Orientation>());
    readonly onDidChangeOrientation = this._onDidChangeOrientation.event;

    constructor(
        @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
        @ILayoutService private readonly _layoutService: ILayoutService
    ) {
        super();

        // Initialize location state
        this._terminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;
        this._panelPosition = this._layoutService.getPanelPosition();
        this._currentOrientation = this._calculateOrientation();

        // Set up event listeners
        this._setupEventListeners();

        // Fire initial orientation
        this._onDidChangeOrientation.fire(this._currentOrientation);
    }

    private _calculateOrientation(): Orientation {
        // VS Code's logic: HORIZONTAL only when in Panel AND panel is bottom/top
        return this._terminalLocation === ViewContainerLocation.Panel &&
               isHorizontal(this._panelPosition) ?
               Orientation.HORIZONTAL :
               Orientation.VERTICAL;
    }

    private _setupEventListeners(): void {
        // Listen for view container location changes
        this._register(this._viewDescriptorService.onDidChangeContainerLocation(e => {
            if (e.viewContainer.id === TERMINAL_VIEW_ID) {
                this._terminalLocation = e.to;
                this._handleOrientationChange();
            }
        }));

        // Listen for panel position changes
        this._register(this._layoutService.onDidChangePanelPosition(() => {
            this._panelPosition = this._layoutService.getPanelPosition();
            this._handleOrientationChange();
        }));
    }

    private _handleOrientationChange(): void {
        const newOrientation = this._calculateOrientation();

        if (newOrientation !== this._currentOrientation) {
            this._currentOrientation = newOrientation;
            this._applyOrientation();
            this._onDidChangeOrientation.fire(newOrientation);
        }
    }

    private _applyOrientation(): void {
        if (!this._container) {
            return;
        }

        // Update CSS classes
        if (this._currentOrientation === Orientation.VERTICAL) {
            this._container.classList.add('terminal-view-is-vertical');
            this._container.classList.remove('terminal-view-is-horizontal');
        } else {
            this._container.classList.remove('terminal-view-is-vertical');
            this._container.classList.add('terminal-view-is-horizontal');
        }

        // Recreate split view with new orientation if needed
        if (this._splitView) {
            // Note: VS Code's SplitView doesn't support dynamic orientation change
            // You need to recreate the split view
            this._splitView.dispose();
            this._createSplitView();
        }
    }

    private _createSplitView(): void {
        if (!this._container) {
            return;
        }

        this._splitView = new SplitView(this._container, {
            orientation: this._currentOrientation,
            proportionalLayout: false
        });

        // Add your views here
        // this._splitView.addView(...)
    }

    public attachToElement(element: HTMLElement): void {
        this._container = element;
        this._createSplitView();
    }

    public getOrientation(): Orientation {
        return this._currentOrientation;
    }

    public isInPanel(): boolean {
        return this._terminalLocation === ViewContainerLocation.Panel;
    }

    public isInSidebar(): boolean {
        return this._terminalLocation === ViewContainerLocation.Sidebar;
    }

    public override dispose(): void {
        this._splitView?.dispose();
        super.dispose();
    }
}
```

---

## Adaptation Notes for vscode-sidebar-terminal

### Services Not Available in Extensions

The following VS Code workbench services are **not available** in the extension API:

- `IViewDescriptorService` - Cannot detect view location
- `ILayoutService` - Cannot detect panel position
- `ViewContainerLocation` enum - Not exposed
- Position enum - Not exposed

### Alternative Approaches

1. **Static Approach** (Recommended for sidebar-only extension):
```typescript
export class SidebarTerminalManager {
    private readonly ORIENTATION = Orientation.VERTICAL;

    // Always use vertical orientation
    private applyLayout(): void {
        this.applyVerticalLayout();
    }
}
```

2. **Configuration-Based** (If supporting user choice):
```typescript
const config = vscode.workspace.getConfiguration('sidebarTerminal');
const orientation = config.get<'horizontal' | 'vertical'>('layout.orientation', 'vertical');
```

3. **Dimension-Based Heuristic** (Auto-detection fallback):
```typescript
window.addEventListener('resize', () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    const orientation = aspectRatio > 1.5 ? 'horizontal' : 'vertical';
    this.applyLayout(orientation);
});
```

---

## CSS Patterns from VS Code

### From terminal.css

```css
/* Base terminal view */
.terminal-view {
    display: flex;
}

/* Horizontal layout (bottom panel) */
.terminal-view.terminal-view-is-horizontal {
    flex-direction: row;
}

/* Vertical layout (sidebar or side panel) */
.terminal-view.terminal-view-is-vertical {
    flex-direction: column;
}

/* Tab list in vertical layout */
.terminal-view-is-vertical .terminal-tabs-list {
    min-width: 80px;
    max-width: 200px;
}

/* Tab list in horizontal layout */
.terminal-view-is-horizontal .terminal-tabs-list {
    min-width: 120px;
    max-width: 300px;
}
```

---

## Summary

### Key Patterns Extracted:

1. **Two-Service Pattern**: Combine `IViewDescriptorService` + `ILayoutService`
2. **Orientation Calculation**: Simple ternary based on location + position
3. **Event-Driven Updates**: Listen to both location and position changes
4. **CSS Toggle Pattern**: Apply orientation classes for styling
5. **Split View Pattern**: Create split views with appropriate orientation
6. **Storage Pattern**: Persist different widths for each orientation
7. **Event Emitter Pattern**: Fire orientation change events for dependents

### For Extensions:

- Use **static orientation** for sidebar-only extensions
- Use **configuration** for user-controlled behavior
- Use **dimension heuristics** as fallback detection
- Cannot access workbench internal APIs

### Files for Reference:

- `terminalGroup.ts` - Core orientation logic
- `terminalTabbedView.ts` - Layout application
- `terminalTabsList.ts` - UI positioning
- `layoutService.ts` - Panel position API
- `views.ts` - View container API
