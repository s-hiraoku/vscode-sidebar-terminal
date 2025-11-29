# Terminal Layout Visual Guide

**Visual diagrams showing VS Code terminal layout patterns**

---

## Bottom Panel - Horizontal Layout (Side-by-Side)

```
┌─────────────────────────────────────────────────────────────────────┐
│ .terminal-groups-container.horizontal                               │
│ display: flex; flex-direction: row;                                 │
│                                                                       │
│  ┌──────────────────────────────┬──────────────────────────────┐   │
│  │ .terminal-container          │ .terminal-container          │   │
│  │ flex: 1 1 0;                 │ flex: 1 1 0;                 │   │
│  │ min-width: 80px;             │ min-width: 80px;             │   │
│  │ height: 100%;                │ height: 100%;                │   │
│  │                               │ border-left: 1px solid;      │   │
│  │  ┌────────────────────────┐  │  ┌────────────────────────┐  │   │
│  │  │ .terminal-header       │  │  │ .terminal-header       │  │   │
│  │  │ Terminal 1             │  │  │ Terminal 2             │  │   │
│  │  └────────────────────────┘  │  └────────────────────────┘  │   │
│  │  ┌────────────────────────┐  │  ┌────────────────────────┐  │   │
│  │  │ .terminal-body         │  │  │ .terminal-body         │  │   │
│  │  │ flex: 1 1 auto;        │  │  │ flex: 1 1 auto;        │  │   │
│  │  │                         │  │  │                         │  │   │
│  │  │  ┌──────────────────┐  │  │  │  ┌──────────────────┐  │  │   │
│  │  │  │ .xterm           │  │  │  │  │ .xterm           │  │  │   │
│  │  │  │ position:        │  │  │  │  │ position:        │  │  │   │
│  │  │  │ absolute;        │  │  │  │  │ absolute;        │  │  │   │
│  │  │  │ bottom: 0;       │  │  │  │  │ bottom: 0;       │  │  │   │
│  │  │  └──────────────────┘  │  │  │  └──────────────────┘  │  │   │
│  │  └────────────────────────┘  │  └────────────────────────┘  │   │
│  └──────────────────────────────┴──────────────────────────────┘   │
│                                                                       │
│  Width Distribution:                                                 │
│  Terminal 1: 50% width (flex: 1)                                    │
│  Terminal 2: 50% width (flex: 1)                                    │
│  Height: 100% for both                                               │
└─────────────────────────────────────────────────────────────────────┘
```

### With 3 Terminals

```
┌────────────────────────────────────────────────────────────────────────────┐
│ .terminal-groups-container.horizontal                                      │
│                                                                              │
│  ┌──────────────────┬──────────────────┬──────────────────┐               │
│  │ Terminal 1       │ Terminal 2       │ Terminal 3       │               │
│  │ flex: 1 (33.3%)  │ flex: 1 (33.3%)  │ flex: 1 (33.3%)  │               │
│  │ min-width: 80px  │ min-width: 80px  │ min-width: 80px  │               │
│  │ height: 100%     │ height: 100%     │ height: 100%     │               │
│  │                  │                  │                  │               │
│  │  [xterm area]    │  [xterm area]    │  [xterm area]    │               │
│  │                  │                  │                  │               │
│  └──────────────────┴──────────────────┴──────────────────┘               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Left Sidebar - Vertical Layout (Stacked)

```
┌─────────────────────────────────────────────┐
│ .terminal-groups-container.vertical         │
│ display: flex; flex-direction: column;      │
│                                               │
│  ┌─────────────────────────────────────┐   │
│  │ .terminal-container                 │   │
│  │ flex: 1 1 0;                        │   │
│  │ min-height: 80px;                   │   │
│  │ width: 100%;                        │   │
│  │                                      │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ .terminal-header              │  │   │
│  │  │ Terminal 1                    │  │   │
│  │  └───────────────────────────────┘  │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ .terminal-body                │  │   │
│  │  │                                │  │   │
│  │  │  ┌─────────────────────────┐  │  │   │
│  │  │  │ .xterm                  │  │  │   │
│  │  │  │ position: absolute;     │  │  │   │
│  │  │  │ top: 0;                 │  │  │   │
│  │  │  └─────────────────────────┘  │  │   │
│  │  └───────────────────────────────┘  │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  ─────────────────────────────────────      │ ← border-top
│                                              │
│  ┌─────────────────────────────────────┐   │
│  │ .terminal-container                 │   │
│  │ flex: 1 1 0;                        │   │
│  │ min-height: 80px;                   │   │
│  │ width: 100%;                        │   │
│  │ border-top: 1px solid;              │   │
│  │                                      │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ .terminal-header              │  │   │
│  │  │ Terminal 2                    │  │   │
│  │  └───────────────────────────────┘  │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ .terminal-body                │  │   │
│  │  │                                │  │   │
│  │  │  ┌─────────────────────────┐  │  │   │
│  │  │  │ .xterm                  │  │  │   │
│  │  │  │ position: absolute;     │  │  │   │
│  │  │  │ top: 0;                 │  │  │   │
│  │  │  └─────────────────────────┘  │  │   │
│  │  └───────────────────────────────┘  │   │
│  └─────────────────────────────────────┘   │
│                                              │
│  Height Distribution:                        │
│  Terminal 1: 50% height (flex: 1)           │
│  Terminal 2: 50% height (flex: 1)           │
│  Width: 100% for both                        │
└─────────────────────────────────────────────┘
```

---

## Layout Transformation: Bottom → Left

### Before (Bottom Panel)

```
┌──────────────────────────────────────────┐
│ VS Code Window                           │
│                                           │
│  ┌────────────────────────────────────┐  │
│  │ Editor Area                        │  │
│  │                                     │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ BOTTOM PANEL                       │  │
│  │ ┌──────────────┬──────────────┐   │  │
│  │ │ Terminal 1   │ Terminal 2   │   │  │ ← HORIZONTAL
│  │ │ (50% width)  │ (50% width)  │   │  │
│  │ └──────────────┴──────────────┘   │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### After (Left Sidebar)

```
┌──────────────────────────────────────────┐
│ VS Code Window                           │
│                                           │
│  ┌───────┬──────────────────────────────┐│
│  │ LEFT  │ Editor Area                  ││
│  │ PANEL │                               ││
│  │       │                               ││
│  │ ┌───┐ │                               ││
│  │ │ T │ │                               ││
│  │ │ 1 │ │                               ││ ← VERTICAL
│  │ ├───┤ │                               ││
│  │ │ T │ │                               ││
│  │ │ 2 │ │                               ││
│  │ └───┘ │                               ││
│  └───────┴──────────────────────────────┘│
└──────────────────────────────────────────┘
```

---

## Flexbox Layout Mechanics

### Horizontal (Bottom Panel)

```
Container: flex-direction: row;

┌─────────────────────────────────────────────┐
│ Main Axis (→)                               │
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ Terminal 1   │  │ Terminal 2   │        │
│  │ flex: 1      │  │ flex: 1      │        │
│  │              │  │              │        │
│  │ Grows to     │  │ Grows to     │        │
│  │ fill 50%     │  │ fill 50%     │        │
│  │ of width     │  │ of width     │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
│ Cross Axis (↓): height: 100%                │
└─────────────────────────────────────────────┘
```

### Vertical (Left Sidebar)

```
Container: flex-direction: column;

┌───────────────────┐
│ Main Axis (↓)     │
│                   │
│  ┌─────────────┐ │
│  │ Terminal 1  │ │
│  │ flex: 1     │ │
│  │             │ │
│  │ Grows to    │ │
│  │ fill 50%    │ │
│  │ of height   │ │
│  └─────────────┘ │
│  ┌─────────────┐ │
│  │ Terminal 2  │ │
│  │ flex: 1     │ │
│  │             │ │
│  │ Grows to    │ │
│  │ fill 50%    │ │
│  │ of height   │ │
│  └─────────────┘ │
│                   │
│ Cross Axis (→):   │
│ width: 100%       │
└───────────────────┘
```

---

## Border Placement

### Horizontal (Side-by-Side)

```
┌────────────┬────────────┬────────────┐
│ Terminal 1 │ Terminal 2 │ Terminal 3 │
│ NO border  │ LEFT border│ LEFT border│
└────────────┴────────────┴────────────┘
             ↑            ↑
             │            │
      border-left   border-left
```

**CSS**: `.horizontal > .terminal-container:not(:first-child) { border-left: 1px solid; }`

### Vertical (Stacked)

```
┌────────────┐
│ Terminal 1 │
│ NO border  │
├────────────┤ ← border-top
│ Terminal 2 │
│ TOP border │
├────────────┤ ← border-top
│ Terminal 3 │
│ TOP border │
└────────────┘
```

**CSS**: `.vertical > .terminal-container:not(:first-child) { border-top: 1px solid; }`

---

## xterm.js Positioning

### Horizontal (Bottom Panel)

```
.terminal-body (relative)
└── .xterm (absolute)
    top: auto;     ← Not set
    bottom: 0;     ← Anchored to bottom
    left: 0;
    right: 0;

┌────────────────┐
│ .terminal-body │
│                │
│ ┌────────────┐ │
│ │            │ │
│ │   .xterm   │ │
│ │            │ │ ← Bottom aligned
│ └────────────┘ │
└────────────────┘
```

### Vertical (Sidebar)

```
.terminal-body (relative)
└── .xterm (absolute)
    top: 0;        ← Anchored to top
    bottom: auto;  ← Not set (except last)
    left: 0;
    right: 0;

┌────────────────┐
│ .terminal-body │
│ ┌────────────┐ │
│ │            │ │
│ │   .xterm   │ │
│ │            │ │ ← Top aligned
│ └────────────┘ │
│                │
└────────────────┘
```

---

## Responsive Behavior

### Adding Terminal

**Before**: 2 terminals, 50% each

```
┌────────────────┬────────────────┐
│ Terminal 1     │ Terminal 2     │
│ flex: 1 (50%)  │ flex: 1 (50%)  │
└────────────────┴────────────────┘
```

**After**: 3 terminals, 33.3% each

```
┌───────────┬───────────┬───────────┐
│ Terminal 1│ Terminal 2│ Terminal 3│
│ flex: 1   │ flex: 1   │ flex: 1   │
│ (33.3%)   │ (33.3%)   │ (33.3%)   │
└───────────┴───────────┴───────────┘
```

**Flex calculation**: `width = containerWidth / numberOfTerminals`

### Removing Terminal

**Before**: 3 terminals, 33.3% each

```
┌───────────┬───────────┬───────────┐
│ Terminal 1│ Terminal 2│ Terminal 3│
│ flex: 1   │ flex: 1   │ flex: 1   │
└───────────┴───────────┴───────────┘
```

**After**: 2 terminals, 50% each

```
┌────────────────┬────────────────┐
│ Terminal 1     │ Terminal 3     │
│ flex: 1 (50%)  │ flex: 1 (50%)  │
└────────────────┴────────────────┘
```

---

## Size Constraints

### Minimum Widths (Horizontal)

```
Container width: 200px
Min width per terminal: 80px
Max terminals that fit: 2

┌────────────┬────────────┐
│ Terminal 1 │ Terminal 2 │
│ 100px      │ 100px      │
└────────────┴────────────┘

If 3 terminals added:
┌─────┬─────┬─────┐
│  T1 │  T2 │  T3 │
│ 66px│ 66px│ 66px│ ← Less than minimum!
└─────┴─────┴─────┘

Solution: Add horizontal scrollbar or wrap
```

### Minimum Heights (Vertical)

```
Container height: 200px
Min height per terminal: 80px
Max terminals that fit: 2

┌────────┐
│ Term 1 │
│ 100px  │
├────────┤
│ Term 2 │
│ 100px  │
└────────┘

If 3 terminals added:
┌────────┐
│ Term 1 │
│  66px  │ ← Less than minimum!
├────────┤
│ Term 2 │
│  66px  │
├────────┤
│ Term 3 │
│  66px  │
└────────┘

Solution: Add vertical scrollbar
```

---

## Event Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ User moves panel from BOTTOM to LEFT                         │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ VS Code Layout Service detects panel position change         │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ Extension: SecondaryTerminalProvider.updatePanelPosition()   │
│ - Detects new position: 'left'                              │
│ - Posts message to webview                                  │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ WebView: PanelLocationHandler receives message              │
│ {                                                            │
│   type: 'panelPositionChanged',                             │
│   position: 'left'                                          │
│ }                                                            │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ PanelLocationHandler.calculateOrientation('left')           │
│ Returns: 'vertical'                                          │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ PanelLocationHandler.applyOrientation('vertical')           │
│ 1. Get container element                                    │
│ 2. Remove 'horizontal' class                                │
│ 3. Add 'vertical' class                                     │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ Browser applies CSS                                          │
│ .terminal-groups-container.vertical {                       │
│   flex-direction: column;                                   │
│ }                                                            │
└──────────────────────────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│ Result: Terminals now stacked vertically                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Summary

**Bottom Panel**: Horizontal flexbox, side-by-side, equal widths
**Sidebar**: Vertical flexbox, stacked, equal heights
**Switch**: Change CSS class, flexbox does the rest
**Borders**: On non-first children only
**xterm**: Absolutely positioned within terminal-body
