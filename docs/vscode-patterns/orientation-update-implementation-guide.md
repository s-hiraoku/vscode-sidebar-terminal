# Layout Orientation Update - Implementation Guide

**Problem:** Preventing redundant orientation updates when layout changes occur.

**VS Code Solution:** Guard clauses + cached state comparison (NO debouncing/throttling)

---

## Core Pattern: Guard Clause with Cached State

```typescript
// VS Code Pattern from terminalGroup.ts:557-574
layout(width: number, height: number): void {
    if (this._splitPaneContainer) {
        // Step 1: Get current position from service
        const newPanelPosition = this._layoutService.getPanelPosition();
        const newTerminalLocation = this._viewDescriptorService.getViewLocationById(TERMINAL_VIEW_ID)!;

        // Step 2: Compare with CACHED state
        const terminalPositionChanged =
            newPanelPosition !== this._panelPosition ||
            newTerminalLocation !== this._terminalLocation;

        // Step 3: Only update if changed
        if (terminalPositionChanged) {
            const newOrientation = /* calculate based on position */;
            this._splitPaneContainer.setOrientation(newOrientation);  // Has internal guard
            this._panelPosition = newPanelPosition;     // Update cache
            this._terminalLocation = newTerminalLocation;  // Update cache
            this._onPanelOrientationChanged.fire(this._splitPaneContainer.orientation);
        }

        // Step 4: Always update dimensions (separate concern)
        this._splitPaneContainer.layout(width, height);
    }
}
```

---

## Double Guard Pattern

VS Code uses guards at TWO levels:

### Level 1: In layout() method
```typescript
const terminalPositionChanged = newPosition !== this._cachedPosition;
if (terminalPositionChanged) {
    this._splitPaneContainer.setOrientation(newOrientation);
    this._cachedPosition = newPosition;
}
```

### Level 2: In setOrientation() method
```typescript
setOrientation(orientation: Orientation): void {
    if (this.orientation === orientation) {
        return;  // Early exit - prevents expensive DOM operations
    }
    this.orientation = orientation;
    // ... expensive DOM operations only happen here
}
```

**Why two levels?**
- First guard prevents unnecessary function calls
- Second guard is defensive (in case called from multiple places)

---

## State Management Pattern

```typescript
class TerminalGroup {
    // Cached state (single source of truth)
    private _panelPosition: Position = Position.BOTTOM;
    private _terminalLocation: ViewContainerLocation = ViewContainerLocation.Panel;

    // Initialization: Set state ONCE
    constructor(...) {
        if (this._container) {
            this.attachToElement(this._container);  // Sets initial state
        }
        // Fire initial orientation event (happens ONCE)
        this._onPanelOrientationChanged.fire(/* initial orientation */);
    }

    // Dynamic updates: Compare cached state
    layout(width: number, height: number): void {
        const newPosition = this._layoutService.getPanelPosition();
        if (newPosition !== this._panelPosition) {  // Compare to cache
            // Update orientation
            this._panelPosition = newPosition;  // Update cache
        }
    }
}
```

---

## Preventing Layout Calculations During Batch Operations

```typescript
// VS Code pattern from terminalGroup.ts:198-203
private _withDisabledLayout(innerFunction: () => void): void {
    // Disable layout for all children
    this._children.forEach(c => c.instance.disableLayout = true);

    // Perform batch operations
    innerFunction();

    // Re-enable layout
    this._children.forEach(c => c.instance.disableLayout = false);
}

// Usage in setOrientation
setOrientation(orientation: Orientation): void {
    if (this.orientation === orientation) {
        return;
    }
    this.orientation = orientation;

    // Clear DOM
    while (this._container.children.length > 0) {
        this._container.children[0].remove();
    }

    // Recreate split view
    this._createSplitView();

    // Batch add views WITHOUT triggering intermediate layouts
    this._withDisabledLayout(() => {
        this._children.forEach(child => {
            child.orientation = orientation;
            this._splitView.addView(child, 1);
        });
    });
}
```

**Purpose:** Prevents multiple reflows when adding/removing DOM elements

---

## Implementation Checklist

### ✅ Required Guards

- [ ] Cache current orientation state
- [ ] Cache current panel location state
- [ ] Compare cached state before updating
- [ ] Early exit in setOrientation if no change
- [ ] Only fire events when orientation actually changes

### ✅ Separation of Concerns

- [ ] Orientation updates separate from dimension updates
- [ ] Initialization separate from dynamic updates
- [ ] One method calculates orientation (single source of truth)

### ✅ Race Condition Prevention

- [ ] Null check before accessing _splitPaneContainer
- [ ] Lazy initialization (only create if doesn't exist)
- [ ] Disable layout flag during batch operations

### ❌ NOT Needed

- [ ] ~~Debouncing~~ (guard clauses are sufficient)
- [ ] ~~Throttling~~ (state comparison prevents redundant calls)
- [ ] ~~requestAnimationFrame~~ (not used by VS Code)

---

## Code Example for Your Project

```typescript
export class TerminalContainerManager {
    // Cached state
    private _currentOrientation: 'horizontal' | 'vertical' | null = null;
    private _cachedPanelLocation: string | null = null;
    private _layoutDisabled: boolean = false;

    /**
     * Initialize orientation during setup
     */
    initialize(container: HTMLElement, panelLocation: string): void {
        // Set initial state
        this._cachedPanelLocation = panelLocation;
        this._currentOrientation = this.calculateOrientation(panelLocation);

        // Apply initial orientation
        this.applyOrientation(this._currentOrientation, container);

        // Fire initial event
        this.fireOrientationChanged(this._currentOrientation);
    }

    /**
     * Update layout dimensions and orientation if needed
     * Called on resize, panel move, etc.
     */
    layout(width: number, height: number, panelLocation: string): void {
        // Guard: Skip if layout disabled
        if (this._layoutDisabled) {
            return;
        }

        // Check if panel location changed
        const locationChanged = panelLocation !== this._cachedPanelLocation;

        if (locationChanged) {
            // Calculate new orientation
            const newOrientation = this.calculateOrientation(panelLocation);

            // Check if orientation changed
            const orientationChanged = newOrientation !== this._currentOrientation;

            if (orientationChanged) {
                // Update orientation
                this.setOrientation(newOrientation);

                // Fire event
                this.fireOrientationChanged(newOrientation);
            }

            // Update cache (even if orientation didn't change)
            this._cachedPanelLocation = panelLocation;
        }

        // Always update dimensions (separate from orientation)
        this.updateDimensions(width, height);
    }

    /**
     * Update orientation with guard clause
     */
    private setOrientation(orientation: 'horizontal' | 'vertical'): void {
        // Guard: Early exit if no change
        if (this._currentOrientation === orientation) {
            return;
        }

        // Disable layout during DOM updates
        this._layoutDisabled = true;

        try {
            // Update container classes/styles
            this.applyOrientation(orientation, this.container);

            // Update cached state
            this._currentOrientation = orientation;
        } finally {
            // Re-enable layout
            this._layoutDisabled = false;
        }
    }

    /**
     * Calculate orientation based on panel location
     * (Single source of truth)
     */
    private calculateOrientation(panelLocation: string): 'horizontal' | 'vertical' {
        // Same logic as VS Code
        return panelLocation === 'bottom' || panelLocation === 'top'
            ? 'horizontal'
            : 'vertical';
    }

    /**
     * Apply orientation to DOM
     */
    private applyOrientation(orientation: 'horizontal' | 'vertical', container: HTMLElement): void {
        // Remove old orientation class
        container.classList.remove('horizontal', 'vertical');

        // Add new orientation class
        container.classList.add(orientation);

        // Update any orientation-specific styles or properties
    }

    /**
     * Update container dimensions
     */
    private updateDimensions(width: number, height: number): void {
        // Update container size
        // Update child terminal sizes
    }

    /**
     * Fire orientation changed event
     */
    private fireOrientationChanged(orientation: 'horizontal' | 'vertical'): void {
        // Notify listeners of orientation change
    }
}
```

---

## Testing Scenarios

1. **Initial load** - Orientation set once, no redundant updates
2. **Panel move left→right** - Orientation updates once (vertical→vertical, no change)
3. **Panel move bottom→left** - Orientation updates once (horizontal→vertical)
4. **Window resize** - Dimensions update, orientation doesn't (if location same)
5. **Rapid panel moves** - Each move processed, but orientation only updates when actually changes

---

## Performance Characteristics

Using VS Code's pattern:

- **Initial load:** 1 orientation calculation + 1 DOM update
- **Layout with no position change:** 0 orientation updates (guard clause exits early)
- **Layout with position change but same orientation:** 0 DOM updates (setOrientation guard exits)
- **Layout with orientation change:** 1 orientation calculation + 1 DOM update

**No debouncing overhead:**
- No timer management
- No queued updates
- No delayed execution
- Immediate response to changes

---

## Common Pitfalls to Avoid

### ❌ Calculating orientation multiple times
```typescript
// BAD
if (this.calculateOrientation() !== this._orientation) {
    this.setOrientation(this.calculateOrientation());  // Calculates twice!
}
```

### ✅ Calculate once and cache
```typescript
// GOOD
const newOrientation = this.calculateOrientation();
if (newOrientation !== this._orientation) {
    this.setOrientation(newOrientation);
}
```

### ❌ Updating cache before checking change
```typescript
// BAD
const locationChanged = location !== this._cachedLocation;
this._cachedLocation = location;  // Updated too early!
if (locationChanged) {
    // ...
}
```

### ✅ Update cache after successful change
```typescript
// GOOD
const locationChanged = location !== this._cachedLocation;
if (locationChanged) {
    // ... handle change ...
    this._cachedLocation = location;  // Update cache after
}
```

---

## Summary

VS Code's approach is **simple and efficient**:

1. **Cache state** - Remember last known position/orientation
2. **Compare before update** - Check if state actually changed
3. **Guard at multiple levels** - Prevent redundant operations
4. **Separate concerns** - Orientation updates vs. dimension updates
5. **Disable during batch** - Prevent intermediate layouts

**No debouncing needed** because guard clauses prevent redundant work naturally.
