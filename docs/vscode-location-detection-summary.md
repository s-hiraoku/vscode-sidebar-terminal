# VS Code Terminal Location Detection - Quick Reference

## Executive Summary

VS Code uses **two separate services** to determine terminal orientation:

1. **IViewDescriptorService** - Detects which container holds the terminal (Panel, Sidebar, AuxiliaryBar)
2. **ILayoutService** - Detects the panel's position (Bottom, Top, Left, Right)

The terminal orientation is calculated by combining both pieces of information.

---

## Core Pattern (from terminalGroup.ts)

```typescript
// Step 1: Get view container location
const viewLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID);

// Step 2: Get panel position
const panelPosition = this._layoutService.getPanelPosition();

// Step 3: Calculate orientation
const orientation = viewLocation === ViewContainerLocation.Panel &&
                   isHorizontal(panelPosition) ?
                   Orientation.HORIZONTAL :
                   Orientation.VERTICAL;
```

---

## Key APIs

### ViewContainerLocation Enum
```typescript
export const enum ViewContainerLocation {
    Sidebar,        // Left/right sidebar
    Panel,          // Bottom/side panel area
    AuxiliaryBar    // Additional bar (floating windows)
}
```

### Panel Position Enum
```typescript
export const enum Position {
    LEFT,
    RIGHT,
    BOTTOM,
    TOP
}

// Helper function
export function isHorizontal(position: Position): boolean {
    return position === Position.BOTTOM || position === Position.TOP;
}
```

### Orientation Enum
```typescript
export const enum Orientation {
    VERTICAL,      // Stacked vertically
    HORIZONTAL     // Stacked horizontally
}
```

---

## Detection Logic

### Rule: When is orientation HORIZONTAL?
```typescript
// ONLY when BOTH conditions are true:
// 1. Terminal is in the Panel container
// 2. Panel is positioned at BOTTOM or TOP

if (viewLocation === ViewContainerLocation.Panel &&
    (panelPosition === Position.BOTTOM || panelPosition === Position.TOP)) {
    return Orientation.HORIZONTAL;
}
```

### Rule: When is orientation VERTICAL?
```typescript
// ALL other cases:
// - Terminal in Sidebar (always vertical)
// - Terminal in AuxiliaryBar (always vertical)
// - Terminal in Panel but panel is LEFT or RIGHT (vertical)

return Orientation.VERTICAL;
```

---

## Service Injection Pattern

```typescript
export class TerminalManager {
    constructor(
        @IViewDescriptorService private readonly _viewDescriptorService: IViewDescriptorService,
        @ILayoutService private readonly _layoutService: ILayoutService
    ) {
        // Use the services
    }
}
```

---

## Event Handling Pattern

```typescript
// Listen for container location changes (drag & drop)
this._register(this._viewDescriptorService.onDidChangeContainerLocation(e => {
    if (e.viewContainer.id === TERMINAL_VIEW_ID) {
        // View moved from e.from to e.to
        this.updateOrientation();
    }
}));

// Listen for panel position changes
this._register(this._layoutService.onDidChangePanelPosition(() => {
    // Panel moved (e.g., bottom → left)
    this.updateOrientation();
}));
```

---

## Critical Finding for VS Code Extensions

**VS Code Extension API Limitation**: The `IViewDescriptorService` and `ILayoutService` are **internal workbench APIs** not exposed to extensions.

### What Extensions CAN Do:
- Register views in specific containers via `package.json`
- Let users manually move views via UI commands

### What Extensions CANNOT Do:
- Programmatically detect current view location
- Detect if view is in panel vs sidebar at runtime
- Listen to location change events

### Workaround for Extensions:
```typescript
// Option 1: Configuration-based
const config = vscode.workspace.getConfiguration('myExtension');
const orientation = config.get('layout.orientation');

// Option 2: Dimension-based heuristic
const aspectRatio = width / height;
const orientation = aspectRatio > 1.5 ? 'horizontal' : 'vertical';

// Option 3: Static (recommended for sidebar extensions)
const orientation = 'vertical'; // Always vertical in sidebar
```

---

## File References

### Source Files (VS Code Internal)
- **terminalGroup.ts**: Main orientation logic
  - Line ~150-200: `_getOrientation()` method
  - Uses both services to calculate orientation

- **views.ts**: ViewContainerLocation enum
  - Defines Sidebar, Panel, AuxiliaryBar

- **layoutService.ts**: Panel position API
  - `getPanelPosition()` method
  - `onDidChangePanelPosition` event
  - `isHorizontal()` helper function

- **sash.ts**: Orientation enum
  - `Orientation.HORIZONTAL` and `Orientation.VERTICAL`

### Constants
```typescript
// Terminal view ID (used for location lookup)
const TERMINAL_VIEW_ID = 'terminal';
```

---

## Visual Reference

```
┌─────────────────────────────────────────────┐
│ Sidebar (VERTICAL)                          │
│ ┌─────────────┐                             │
│ │ Terminal 1  │                             │
│ ├─────────────┤                             │
│ │ Terminal 2  │  ← Always stacked vertically│
│ ├─────────────┤                             │
│ │ Terminal 3  │                             │
│ └─────────────┘                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Panel @ BOTTOM (HORIZONTAL)                 │
│ ┌──────┬──────┬──────┐                      │
│ │Term 1│Term 2│Term 3│  ← Side-by-side     │
│ └──────┴──────┴──────┘                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Panel @ LEFT (VERTICAL)                     │
│ ┌─────────────┐                             │
│ │ Terminal 1  │                             │
│ ├─────────────┤                             │
│ │ Terminal 2  │  ← Stacked vertically       │
│ ├─────────────┤                             │
│ │ Terminal 3  │                             │
│ └─────────────┘                             │
└─────────────────────────────────────────────┘
```

---

## Truth Table

| View Location | Panel Position | Orientation |
|---------------|----------------|-------------|
| Sidebar       | N/A            | VERTICAL    |
| AuxiliaryBar  | N/A            | VERTICAL    |
| Panel         | BOTTOM         | HORIZONTAL  |
| Panel         | TOP            | HORIZONTAL  |
| Panel         | LEFT           | VERTICAL    |
| Panel         | RIGHT          | VERTICAL    |

---

## Implementation Checklist

For implementing VS Code-style terminal location detection:

- [ ] Inject `IViewDescriptorService` (workbench internal only)
- [ ] Inject `ILayoutService` (workbench internal only)
- [ ] Get view location via `getViewLocationById(TERMINAL_VIEW_ID)`
- [ ] Get panel position via `getPanelPosition()`
- [ ] Calculate orientation using combined logic
- [ ] Listen to `onDidChangeContainerLocation` event
- [ ] Listen to `onDidChangePanelPosition` event
- [ ] Update orientation on either event
- [ ] Apply appropriate CSS classes/layout

**For VS Code Extensions**: Skip workbench APIs, use configuration or dimension-based detection instead.

---

## Next Steps for vscode-sidebar-terminal

### Recommendation: Keep It Simple

Since this extension is designed for the **sidebar**:

1. **Static Orientation**: Always use `VERTICAL` orientation
2. **No Dynamic Detection**: Sidebar location is fixed
3. **Configuration Option**: Let users override if needed

```typescript
// Recommended approach
export class StandardTerminalSessionManager {
    private readonly ORIENTATION = Orientation.VERTICAL;

    private applyLayout(): void {
        // Always use vertical layout for sidebar terminals
        this.layoutTerminals(this.ORIENTATION);
    }
}
```

### If Supporting Panel Migration

Only implement if users request the ability to move terminal to panel:

1. Add configuration setting for orientation
2. Use dimension-based heuristic as fallback
3. Document that auto-detection isn't possible in extensions

---

## Full Documentation

See `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/docs/vscode-terminal-location-detection.md` for complete implementation details, code examples, and integration patterns.
