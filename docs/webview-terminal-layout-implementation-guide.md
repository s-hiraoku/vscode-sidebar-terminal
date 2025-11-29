# WebView Terminal Layout Implementation Guide

**Based on**: VS Code Terminal Split Layout Analysis
**Target**: Fixing side-by-side terminal display in bottom panel
**Current Issue**: Terminals stack vertically instead of displaying horizontally

---

## Problem Statement

When the panel is at the BOTTOM position, terminals should display **side-by-side** (horizontally), but currently they stack **vertically**.

**Root Cause**: Missing orientation detection and dynamic layout switching based on panel position.

---

## Solution Overview

Implement VS Code's pattern:
1. Detect panel position from extension
2. Calculate orientation (horizontal for bottom, vertical for sidebar)
3. Apply CSS class to container
4. Let flexbox handle the actual layout

---

## Implementation Steps

### Step 1: Add Panel Position Detection in Extension

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/providers/SecondaryTerminalProvider.ts`

```typescript
import * as vscode from 'vscode';

export class SecondaryTerminalProvider {
    private _view?: vscode.WebviewView;

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this._view = webviewView;

        // ... existing setup code ...

        // NEW: Send initial panel position
        this.updatePanelPosition();

        // NEW: Listen for panel position changes
        vscode.window.onDidChangeActiveColorTheme(() => {
            // Panel position might have changed
            this.updatePanelPosition();
        });
    }

    private updatePanelPosition(): void {
        if (!this._view) {
            return;
        }

        // Detect panel position
        const panelPosition = this.getPanelPosition();

        // Send to webview
        this._view.webview.postMessage({
            type: 'panelPositionChanged',
            position: panelPosition
        });
    }

    private getPanelPosition(): 'bottom' | 'top' | 'left' | 'right' {
        // VS Code API doesn't directly expose panel position
        // We can infer it from the view's location
        if (!this._view) {
            return 'bottom';
        }

        // Check if view is in panel or sidebar
        // ViewColumn.Panel means it's in the panel area
        // ViewColumn.One/Two/etc means it's in sidebar

        // For now, default to bottom
        // TODO: Use proper detection when API is available
        return 'bottom';
    }
}
```

**IMPORTANT NOTE**: VS Code API doesn't currently expose panel position directly. We have two options:

1. **Option A (Recommended)**: Add configuration setting
   ```json
   {
       "sidebarTerminal.layout.detectPanelPosition": {
           "type": "boolean",
           "default": true,
           "description": "Automatically detect panel position and adjust terminal layout"
       }
   }
   ```

2. **Option B**: Use ViewDescriptorService pattern (requires more investigation)

### Step 2: Add Message Handler in WebView

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/webview/managers/PanelLocationHandler.ts`

Create a new handler for panel position changes:

```typescript
import { BaseManager } from './BaseManager';

export type PanelPosition = 'bottom' | 'top' | 'left' | 'right';
export type TerminalOrientation = 'horizontal' | 'vertical';

export class PanelLocationHandler extends BaseManager {
    private currentPosition: PanelPosition = 'bottom';
    private currentOrientation: TerminalOrientation = 'horizontal';

    public initialize(): void {
        // Listen for panel position changes from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'panelPositionChanged') {
                this.handlePanelPositionChange(message.position);
            }
        });

        // Apply initial orientation
        this.applyOrientation();
    }

    private handlePanelPositionChange(position: PanelPosition): void {
        if (this.currentPosition === position) {
            return;
        }

        this.currentPosition = position;
        const newOrientation = this.calculateOrientation(position);

        if (this.currentOrientation !== newOrientation) {
            this.currentOrientation = newOrientation;
            this.applyOrientation();
        }
    }

    private calculateOrientation(position: PanelPosition): TerminalOrientation {
        // VS Code logic: HORIZONTAL for bottom/top, VERTICAL for left/right
        if (position === 'bottom' || position === 'top') {
            return 'horizontal';
        } else {
            return 'vertical';
        }
    }

    private applyOrientation(): void {
        const container = document.querySelector('.terminal-groups-container');
        if (!container) {
            console.warn('Terminal groups container not found');
            return;
        }

        // Remove all orientation classes
        container.classList.remove('horizontal', 'vertical');

        // Add current orientation class
        container.classList.add(this.currentOrientation);

        console.log(`Applied terminal orientation: ${this.currentOrientation} (panel position: ${this.currentPosition})`);
    }

    public getCurrentOrientation(): TerminalOrientation {
        return this.currentOrientation;
    }

    public getCurrentPosition(): PanelPosition {
        return this.currentPosition;
    }

    public dispose(): void {
        // Cleanup if needed
    }
}
```

### Step 3: Update Terminal Container HTML

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/webview/main.ts`

Ensure the terminal container has the right structure:

```html
<div class="terminal-groups-container horizontal">
    <div class="terminal-container" data-terminal-id="1">
        <div class="terminal-header">...</div>
        <div class="terminal-body">...</div>
    </div>
    <div class="terminal-container" data-terminal-id="2">
        <div class="terminal-header">...</div>
        <div class="terminal-body">...</div>
    </div>
    <!-- More terminals... -->
</div>
```

### Step 4: Add CSS for Orientation-Based Layout

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/media/webview.css`

Add the following styles:

```css
/* Terminal Groups Container - Base */
.terminal-groups-container {
    display: flex;
    height: 100%;
    width: 100%;
    position: relative;
    overflow: hidden;
}

/* Horizontal Orientation (Side-by-Side for Bottom/Top Panel) */
.terminal-groups-container.horizontal {
    flex-direction: row;
}

.terminal-groups-container.horizontal > .terminal-container {
    flex: 1 1 0;
    min-width: 80px;
    height: 100%;
    overflow: hidden;
}

.terminal-groups-container.horizontal > .terminal-container:not(:first-child) {
    border-left: 1px solid var(--vscode-terminal-border, var(--vscode-panel-border));
}

/* Vertical Orientation (Stacked for Left/Right Sidebar) */
.terminal-groups-container.vertical {
    flex-direction: column;
}

.terminal-groups-container.vertical > .terminal-container {
    flex: 1 1 0;
    min-height: 80px;
    width: 100%;
    overflow: hidden;
}

.terminal-groups-container.vertical > .terminal-container:not(:first-child) {
    border-top: 1px solid var(--vscode-terminal-border, var(--vscode-panel-border));
}

/* Terminal Container - Base */
.terminal-container {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    position: relative;
}

/* Terminal Header */
.terminal-header {
    flex: 0 0 auto;
    min-height: 35px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

/* Terminal Body */
.terminal-body {
    flex: 1 1 auto;
    position: relative;
    overflow: hidden;
}

/* xterm.js container */
.terminal-body .xterm {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

/* Alignment for different orientations */
.terminal-groups-container.horizontal .terminal-body .xterm {
    /* Bottom align in horizontal mode */
    top: auto;
    bottom: 0;
}

.terminal-groups-container.vertical .terminal-body .xterm:not(:last-child) {
    /* Top align in vertical mode (except last terminal) */
    top: 0;
    bottom: auto;
}
```

### Step 5: Integrate PanelLocationHandler in WebView

**File**: `/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish/src/webview/main.ts`

```typescript
import { PanelLocationHandler } from './managers/PanelLocationHandler';

class WebViewManager {
    private panelLocationHandler?: PanelLocationHandler;

    public initialize(): void {
        // ... existing initialization ...

        // NEW: Initialize panel location handler
        this.panelLocationHandler = new PanelLocationHandler();
        this.panelLocationHandler.initialize();

        // ... rest of initialization ...
    }

    public dispose(): void {
        // ... existing disposal ...

        this.panelLocationHandler?.dispose();
        this.panelLocationHandler = undefined;
    }
}
```

---

## Alternative: Configuration-Based Approach

If panel position detection is not available, use a configuration setting:

### Add Configuration

**File**: `package.json`

```json
{
    "configuration": {
        "properties": {
            "sidebarTerminal.layout.orientation": {
                "type": "string",
                "enum": ["auto", "horizontal", "vertical"],
                "default": "auto",
                "enumDescriptions": [
                    "Automatically detect orientation based on panel position",
                    "Force horizontal layout (side-by-side)",
                    "Force vertical layout (stacked)"
                ],
                "description": "Terminal layout orientation"
            }
        }
    }
}
```

### Update Handler

```typescript
export class PanelLocationHandler extends BaseManager {
    private configuredOrientation?: TerminalOrientation;

    public initialize(): void {
        // Listen for configuration changes
        window.addEventListener('message', (event) => {
            const message = event.data;

            if (message.type === 'configurationChanged') {
                this.handleConfigurationChange(message.config);
            } else if (message.type === 'panelPositionChanged') {
                this.handlePanelPositionChange(message.position);
            }
        });

        this.applyOrientation();
    }

    private handleConfigurationChange(config: any): void {
        const orientationSetting = config['sidebarTerminal.layout.orientation'];

        if (orientationSetting === 'horizontal' || orientationSetting === 'vertical') {
            this.configuredOrientation = orientationSetting;
        } else {
            this.configuredOrientation = undefined; // Auto
        }

        this.applyOrientation();
    }

    private applyOrientation(): void {
        const container = document.querySelector('.terminal-groups-container');
        if (!container) {
            return;
        }

        // Use configured orientation if set, otherwise use calculated
        const orientation = this.configuredOrientation || this.currentOrientation;

        container.classList.remove('horizontal', 'vertical');
        container.classList.add(orientation);
    }
}
```

---

## Testing Plan

### Test Cases

1. **Bottom Panel - 2 Terminals**
   - Expected: Side-by-side layout
   - Verify: Each terminal has ~50% width, 100% height

2. **Bottom Panel - 3 Terminals**
   - Expected: Side-by-side layout
   - Verify: Each terminal has ~33% width, 100% height

3. **Left Sidebar - 2 Terminals**
   - Expected: Stacked layout
   - Verify: Each terminal has 100% width, ~50% height

4. **Panel Position Change**
   - Move panel from bottom to left
   - Expected: Layout switches from horizontal to vertical
   - Verify: CSS class changes, terminals re-layout

5. **Add Terminal**
   - Add terminal while in bottom panel
   - Expected: New terminal appears side-by-side
   - Verify: All terminals resize proportionally

6. **Remove Terminal**
   - Remove terminal while in bottom panel
   - Expected: Remaining terminals expand
   - Verify: Space redistributed evenly

### Manual Testing Steps

```bash
# 1. Start extension in debug mode
npm run watch

# 2. Open VS Code
code --extensionDevelopmentPath=.

# 3. Open webview
# 4. Create 2 terminals
# 5. Verify side-by-side layout in bottom panel
# 6. Move panel to left sidebar
# 7. Verify stacked layout
# 8. Move panel back to bottom
# 9. Verify side-by-side layout returns
```

---

## Debugging Tips

### Console Logging

Add these logs to track orientation changes:

```typescript
console.log('[PanelLocationHandler] Panel position changed:', position);
console.log('[PanelLocationHandler] Calculated orientation:', newOrientation);
console.log('[PanelLocationHandler] Applied CSS class:', orientation);
```

### DevTools Inspection

1. Open WebView DevTools: `Ctrl+Shift+I` (while focused on webview)
2. Inspect `.terminal-groups-container`
3. Check for `horizontal` or `vertical` class
4. Verify flex-direction in computed styles
5. Check terminal widths/heights

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Terminals still stacked in bottom panel | Missing `horizontal` class | Check message handling |
| Terminals overlap | Missing flex properties | Check CSS for `.terminal-container` |
| Layout doesn't change on panel move | Event not firing | Check message posting from extension |
| Borders missing | Wrong border CSS | Check `:not(:first-child)` selector |

---

## Performance Considerations

1. **Debounce Panel Position Changes**
   ```typescript
   private debounceTimeout?: number;

   private handlePanelPositionChange(position: PanelPosition): void {
       if (this.debounceTimeout) {
           clearTimeout(this.debounceTimeout);
       }

       this.debounceTimeout = window.setTimeout(() => {
           this.applyPanelPosition(position);
       }, 100);
   }
   ```

2. **Batch Layout Updates**
   - Apply all orientation changes in one pass
   - Avoid triggering multiple reflows

3. **Use CSS Transitions Carefully**
   - Only animate if explicitly enabled
   - Disable during rapid panel moves

---

## Future Enhancements

1. **Responsive Breakpoints**
   - Auto-switch to vertical when width < 600px
   - Even if panel is at bottom

2. **User Preferences**
   - Allow manual orientation override
   - Save per-workspace

3. **Smooth Transitions**
   - Animate layout changes
   - Fade between orientations

4. **Resizable Panes**
   - Add sash/splitter between terminals
   - Allow manual resizing

---

## File Changes Summary

### New Files
- `/src/webview/managers/PanelLocationHandler.ts` - Panel position detection and orientation management

### Modified Files
- `/src/providers/SecondaryTerminalProvider.ts` - Add panel position detection and messaging
- `/src/webview/main.ts` - Integrate PanelLocationHandler
- `/media/webview.css` - Add orientation-based layout styles
- `/package.json` - Add configuration settings (optional)

### Lines of Code
- Extension: ~50 lines
- WebView: ~150 lines
- CSS: ~80 lines

---

## Conclusion

This implementation follows VS Code's proven pattern while adapting it to our WebView architecture:

1. ✅ Detects panel position (or uses configuration)
2. ✅ Calculates orientation (horizontal for bottom, vertical for sidebar)
3. ✅ Applies CSS class to container
4. ✅ Uses flexbox for layout
5. ✅ Supports dynamic orientation changes
6. ✅ Maintains consistent terminal sizing

**Next Step**: Implement PanelLocationHandler and test with multiple terminals in bottom panel.
