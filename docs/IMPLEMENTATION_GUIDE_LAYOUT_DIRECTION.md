# Implementation Guide: Panel-Aware Layout Direction

**Quick Reference for Implementing VS Code's Layout Direction Patterns**

---

## TL;DR - The VS Code Pattern

VS Code terminals automatically adjust their split layout direction based on panel location:

- **Bottom/Top Panel** → `flex-direction: row` → Terminals side-by-side
- **Left/Right Sidebar** → `flex-direction: column` → Terminals stacked

This happens through:
1. Panel location detection via layout services
2. Position → Orientation mapping (`isHorizontal()` check)
3. Dynamic SplitView orientation updates
4. CSS class management for visual feedback

---

## Implementation Checklist

### Phase 1: Detection (High Priority)

- [ ] Create panel location detector in `SecondaryTerminalProvider`
- [ ] Implement dimension-based heuristic (sidebar = narrow width)
- [ ] Add VS Code API integration if available
- [ ] Cache current panel location state

### Phase 2: Layout Direction Management (High Priority)

- [ ] Create `PanelLocationHandler` or extend `TerminalContainerManager`
- [ ] Implement `getFlexDirection(location): 'row' | 'column'`
- [ ] Add message type `update-layout-direction` to `MessageManager`
- [ ] Send direction updates to webview

### Phase 3: WebView Integration (High Priority)

- [ ] Add message handler in `main.ts` for layout direction updates
- [ ] Apply `flex-direction` to `.terminal-container`
- [ ] Toggle CSS class `.sidebar-layout` for additional styling
- [ ] Test with multiple terminals

### Phase 4: Dynamic Updates (Medium Priority)

- [ ] Monitor `webviewPanel.onDidChangeViewState`
- [ ] Detect panel location changes
- [ ] Trigger layout direction updates
- [ ] Fire custom events for dependent components

### Phase 5: CSS & Transitions (Medium Priority)

- [ ] Add CSS transitions for smooth direction changes
- [ ] Implement sidebar-specific header styling
- [ ] Test with different themes
- [ ] Ensure no layout thrashing

### Phase 6: Testing & Optimization (Low Priority)

- [ ] Write unit tests for panel detection
- [ ] Add integration tests for orientation mapping
- [ ] Performance test with 5 terminals
- [ ] Add accessibility labels

---

## Code Templates

### 1. Panel Location Detection

```typescript
// File: src/providers/SecondaryTerminalProvider.ts

export class SecondaryTerminalProvider {
    private currentPanelLocation: 'sidebar' | 'panel' = 'panel';

    private detectPanelLocation(): 'sidebar' | 'panel' {
        // Heuristic: Sidebar panels are typically narrower
        const SIDEBAR_WIDTH_THRESHOLD = 600; // pixels

        // Option 1: Dimension-based detection
        if (this.webviewPanel.webview.html) {
            const width = this.webviewPanel.webview.options?.enableCommandUris
                ? window.innerWidth
                : SIDEBAR_WIDTH_THRESHOLD + 1;

            return width < SIDEBAR_WIDTH_THRESHOLD ? 'sidebar' : 'panel';
        }

        // Option 2: ViewColumn-based detection
        return this.webviewPanel.viewColumn === vscode.ViewColumn.One
            ? 'sidebar'
            : 'panel';
    }

    private setupPanelLocationMonitoring(): void {
        this.webviewPanel.onDidChangeViewState(e => {
            const newLocation = this.detectPanelLocation();
            if (newLocation !== this.currentPanelLocation) {
                this.currentPanelLocation = newLocation;
                this.updateLayoutDirection(newLocation);
            }
        });
    }

    private updateLayoutDirection(location: 'sidebar' | 'panel'): void {
        const direction = location === 'panel' ? 'row' : 'column';
        this.messageManager.sendMessage({
            type: 'update-layout-direction',
            direction: direction
        });
    }
}
```

### 2. WebView Message Handler

```typescript
// File: src/webview/main.ts

interface LayoutDirectionMessage {
    type: 'update-layout-direction';
    direction: 'row' | 'column';
}

// Add to message handler
window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;

    switch (message.type) {
        case 'update-layout-direction':
            handleLayoutDirectionUpdate(message);
            break;
        // ... other cases
    }
});

function handleLayoutDirectionUpdate(message: LayoutDirectionMessage): void {
    const container = document.querySelector('.terminal-container');
    if (!container) return;

    // Update flex-direction
    (container as HTMLElement).style.flexDirection = message.direction;

    // Toggle CSS class for additional styling
    container.classList.toggle('sidebar-layout', message.direction === 'column');

    // Log for debugging
    console.log(`[LayoutDirection] Updated to: ${message.direction}`);

    // Trigger re-layout of terminals
    window.dispatchEvent(new Event('resize'));
}
```

### 3. CSS Styles

```css
/* File: src/webview/styles/terminal-container.css */

.terminal-container {
    display: flex;
    width: 100%;
    height: 100%;
    gap: 4px; /* Space between terminals */

    /* Default: row (bottom panel) */
    flex-direction: row;

    /* Smooth transitions */
    transition: flex-direction 0.2s ease-in-out;
}

/* Sidebar-specific layout */
.terminal-container.sidebar-layout {
    flex-direction: column;
}

/* Terminal wrapper adjustments */
.terminal-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0; /* Prevent overflow */
    min-height: 0; /* Prevent overflow */
}

/* Sidebar-specific terminal header */
.sidebar-layout .terminal-header {
    min-height: 32px;
    flex-shrink: 0;
}

/* Horizontal layout: terminals side-by-side */
.terminal-container:not(.sidebar-layout) .terminal-wrapper {
    min-width: 200px; /* Minimum width for horizontal splits */
}

/* Vertical layout: terminals stacked */
.terminal-container.sidebar-layout .terminal-wrapper {
    min-height: 100px; /* Minimum height for vertical splits */
}
```

### 4. Type Definitions

```typescript
// File: src/types/messages.ts

export interface UpdateLayoutDirectionMessage {
    type: 'update-layout-direction';
    direction: 'row' | 'column';
}

export type PanelLocation = 'sidebar' | 'panel';

export type FlexDirection = 'row' | 'column';

// Add to existing MessageTypes union
export type MessageTypes =
    | UpdateLayoutDirectionMessage
    | /* ... other message types */;
```

### 5. PanelLocationHandler (New Manager)

```typescript
// File: src/webview/managers/handlers/PanelLocationHandler.ts

import { MessageManager } from '../MessageManager';

export class PanelLocationHandler {
    private currentLocation: 'sidebar' | 'panel' = 'panel';
    private currentDirection: 'row' | 'column' = 'row';

    constructor(private messageManager: MessageManager) {
        this.setupMessageListener();
        this.detectInitialLocation();
    }

    private setupMessageListener(): void {
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'update-layout-direction') {
                this.applyLayoutDirection(message.direction);
            }
        });
    }

    private detectInitialLocation(): void {
        // Detect initial panel location based on dimensions
        const width = window.innerWidth;
        const SIDEBAR_THRESHOLD = 600;

        this.currentLocation = width < SIDEBAR_THRESHOLD ? 'sidebar' : 'panel';
        this.currentDirection = this.getDirectionFromLocation(this.currentLocation);

        this.applyLayoutDirection(this.currentDirection);
    }

    private getDirectionFromLocation(location: 'sidebar' | 'panel'): 'row' | 'column' {
        return location === 'panel' ? 'row' : 'column';
    }

    private applyLayoutDirection(direction: 'row' | 'column'): void {
        if (this.currentDirection === direction) return;

        this.currentDirection = direction;

        const container = document.querySelector('.terminal-container');
        if (container) {
            (container as HTMLElement).style.flexDirection = direction;
            container.classList.toggle('sidebar-layout', direction === 'column');

            console.log(`[PanelLocationHandler] Applied direction: ${direction}`);

            // Trigger resize event for terminals to re-layout
            window.dispatchEvent(new Event('resize'));
        }
    }

    public getCurrentDirection(): 'row' | 'column' {
        return this.currentDirection;
    }

    public getCurrentLocation(): 'sidebar' | 'panel' {
        return this.currentLocation;
    }
}
```

---

## Integration Points

### In SecondaryTerminalProvider

```typescript
// Add panel location monitoring
private initializeWebview(webviewPanel: vscode.WebviewPanel): void {
    // ... existing initialization code

    // Add panel location monitoring
    this.setupPanelLocationMonitoring();

    // Send initial layout direction
    const initialLocation = this.detectPanelLocation();
    this.updateLayoutDirection(initialLocation);
}
```

### In WebViewHtmlGenerationService

```typescript
// Add initial direction metadata to HTML
public generateHtml(webview: vscode.Webview): string {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <!-- ... existing head content -->
            <meta name="initial-panel-location" content="panel">
        </head>
        <body>
            <div class="terminal-container" data-direction="row">
                <!-- ... terminal content -->
            </div>
            <!-- ... existing scripts -->
        </body>
        </html>
    `;
    return html;
}
```

### In TerminalWebviewManager

```typescript
// Initialize PanelLocationHandler
constructor(/* ... dependencies */) {
    // ... existing manager initialization

    // Add panel location handler
    this.panelLocationHandler = new PanelLocationHandler(this.messageManager);
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// File: src/test/unit/handlers/PanelLocationHandler.test.ts

describe('PanelLocationHandler', () => {
    it('should detect sidebar location for narrow widths', () => {
        // Mock window.innerWidth = 500
        // Assert location = 'sidebar'
    });

    it('should detect panel location for wide widths', () => {
        // Mock window.innerWidth = 800
        // Assert location = 'panel'
    });

    it('should map sidebar to column direction', () => {
        // Assert getDirectionFromLocation('sidebar') === 'column'
    });

    it('should map panel to row direction', () => {
        // Assert getDirectionFromLocation('panel') === 'row'
    });

    it('should apply flex-direction CSS', () => {
        // Create DOM element
        // Call applyLayoutDirection('column')
        // Assert element.style.flexDirection === 'column'
    });

    it('should toggle sidebar-layout CSS class', () => {
        // Call applyLayoutDirection('column')
        // Assert element.classList.contains('sidebar-layout') === true
    });
});
```

### Integration Tests

```typescript
// File: src/test/integration/panel-location.test.ts

describe('Panel Location Integration', () => {
    it('should update layout when panel moves to sidebar', async () => {
        // Simulate panel move to sidebar
        // Verify message sent with direction: 'column'
        // Verify DOM updated
    });

    it('should update layout when panel moves to bottom', async () => {
        // Simulate panel move to bottom
        // Verify message sent with direction: 'row'
        // Verify DOM updated
    });

    it('should handle multiple terminals in sidebar layout', async () => {
        // Create 3 terminals
        // Move to sidebar
        // Verify terminals are stacked vertically
    });
});
```

---

## Performance Considerations

### Avoid Layout Thrashing

```typescript
// Batch DOM updates
function applyLayoutDirection(direction: 'row' | 'column'): void {
    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
        const container = document.querySelector('.terminal-container');
        if (container) {
            // Apply all updates at once
            (container as HTMLElement).style.flexDirection = direction;
            container.classList.toggle('sidebar-layout', direction === 'column');
        }
    });
}
```

### Debounce Resize Events

```typescript
// Debounce panel location detection
let resizeTimeout: NodeJS.Timeout;

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const newLocation = detectPanelLocation();
        if (newLocation !== currentPanelLocation) {
            updateLayoutDirection(newLocation);
        }
    }, 100); // 100ms debounce
});
```

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
- Implement `PanelLocationHandler`
- Add message types and handlers
- Create basic CSS styles

### Phase 2: Integration (Week 2)
- Integrate with `SecondaryTerminalProvider`
- Add panel location monitoring
- Test with single terminal

### Phase 3: Multi-Terminal Support (Week 3)
- Test with multiple split terminals
- Refine CSS transitions
- Fix edge cases

### Phase 4: Polish & Testing (Week 4)
- Write comprehensive tests
- Performance optimization
- Documentation updates

---

## Success Metrics

- [ ] Layout direction changes automatically when moving panel
- [ ] No layout flicker during orientation changes
- [ ] Smooth CSS transitions (< 200ms)
- [ ] Works with 1-5 terminals
- [ ] Performance: < 16ms for layout recalculation
- [ ] Zero layout thrashing detected

---

## References

- **Full Research Document**: `docs/vscode-terminal-layout-direction-research.md`
- **VS Code Source**: `src/vs/workbench/contrib/terminal/browser/terminalGroup.ts`
- **VS Code Pattern**: Service-based detection + Dynamic orientation updates
- **License**: MIT (VS Code is MIT licensed)

---

**Last Updated:** November 4, 2025
**Status:** Ready for Implementation
