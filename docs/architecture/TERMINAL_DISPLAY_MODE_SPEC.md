# Terminal Display Mode Specification

## 1. Background

The sidebar terminal refactor introduced multiple managers that cooperatively drive
terminal layout in the WebView:

- **TerminalLifecycleManager** – creates terminal instances and registers their DOM containers.
- **SplitManager** – builds multi-terminal layouts by wrapping containers in split wrappers and resizers.
- **DisplayModeManager** – toggles between `normal`, `fullscreen`, and `split` display modes.
- **TerminalContainerManager** – tracks terminal containers and exposes visibility helpers.
- **TerminalTabManager** – triggers mode changes when tabs are selected.

While the division of responsibilities reduced the size of the original
`TerminalWebviewManager`, recent work (Issue #198) exposed coordination gaps.
Clicking a tab should promote that terminal to fullscreen, but legacy split wrappers
and unmanaged DOM nodes keep other terminals visible. The mismatch stems from each
manager manipulating DOM nodes independently, resulting in divergent state.

## 2. Goals

1. **Single Source of Truth** for terminal container visibility and layout metadata.
2. **Predictable Mode Transitions** across `normal`, `fullscreen`, and `split`.
3. **Extensibility** for future features (e.g., layout presets, animations, pinning).
4. **Testability** via well-defined contracts and minimal direct DOM access.

## 3. Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| R1 | All terminal containers and wrappers must be registered through one manager. | Prevents “orphaned” nodes. |
| R2 | Display mode transitions must hide or remove non-active containers during fullscreen. | Visible area must be exclusive. |
| R3 | Split layout artefacts (wrappers, resizers) must be created and destroyed via the same service. | Avoid stale DOM. |
| R4 | Mode changes should be expressible as high-level intents (no direct DOM operations). | Enables unit testing. |
| R5 | Managers must expose state snapshots for diagnostics and automated tests. | Supports regression detection. |

## 4. Current-State Analysis

### 4.1 Ownership Gaps

- `SplitManager` instantiates split wrappers (`div.split-terminal-container`) and resizers.
  These nodes never pass through `TerminalContainerManager`, so visibility toggles only
  affect inner terminal containers.
- `DisplayModeManager` operates on whatever containers `TerminalContainerManager`
  reports, missing the wrappers left by `SplitManager`.

### 4.2 Lifecycle Inconsistencies

- `exitSplitMode()` attempts to move child containers back to `#terminal-body`, but
  wrappers remain when focus changes quickly or new terminals are added mid-transition.
- Multiple managers write inline styles (width, height, display), leading to conflicting
  declarations that complicate debugging.

### 4.3 Observability Limits

- No consolidated snapshot API to inspect current layout state.
- Tests need to mock DOM access in several places, increasing brittleness.

## 5. Target Architecture

### 5.1 Manager Roles

| Manager | Responsibility After Refactor |
|---------|------------------------------|
| **TerminalContainerManager** | Sole registry of containers (primary and split). Provides `applyDisplayState` to manipulate DOM. |
| **DisplayModeManager** | Computes desired mode and active terminal; delegates DOM changes to `TerminalContainerManager`. |
| **SplitManager** | Computes layout metrics (counts, heights) and requests container transformations via `TerminalContainerManager`. |
| **TerminalTabManager** | Signals mode changes; no DOM logic. |
| **TerminalLifecycleManager** | Continues as container creator and registrar. |

### 5.2 Data Contracts

```ts
interface DisplayState {
  mode: 'normal' | 'fullscreen' | 'split';
  activeTerminalId: string | null;
  terminals: Array<{
    id: string;
    container: HTMLElement;
    layout: 'normal' | 'split';
  }>;
}

type DisplayIntent =
  | { type: 'fullscreen'; terminalId: string }
  | { type: 'split'; direction: 'vertical' | 'horizontal' }
  | { type: 'normal' };
```

`DisplayModeManager` translates intents to `DisplayState` objects and calls
`TerminalContainerManager.applyDisplayState(state)`.

### 5.3 DOM Handling Rules

1. All container DOM nodes must be registered (primary containers via `registerContainer`
   and split wrappers via `registerWrapper`).
2. `TerminalContainerManager` owns creation and removal of split wrappers/resizers.
   `SplitManager` only instructs “enter split” via a method call.
3. During fullscreen, `applyDisplayState` hides every container except the active one and
   detaches wrappers/resizers into an internal pool for reuse.
4. Inline styles are minimized; rely on CSS classes (`full-screen`, `split`, `hidden`).

### 5.4 Observability

Add `getDisplaySnapshot()` returning current mode, visible terminal IDs, registered wrapper
count, and orphan detection (`domNodes - registryCount`). Instrument logging uses a single
logger channel `display` for ease of filtering.

## 6. Implementation Roadmap

### Phase 1 – Registry Consolidation
1. Extend `TerminalContainerManager` with wrapper registration methods and a centralized
   DOM mutation utility (`applyDisplayState`).
2. Update `SplitManager` to request wrapper creation via the manager instead of direct DOM
   manipulation.
3. Migrate `DisplayModeManager` to emit intents and rely on `TerminalContainerManager`.

### Phase 2 – CSS Refactor
1. Introduce semantic classes:
   - `.terminal-container--hidden`
   - `.terminal-container--fullscreen`
   - `.terminal-container--split`
2. Remove conflicting inline styles, except for computed heights during split.

### Phase 3 – Instrumentation & Tests
1. Implement `getDisplaySnapshot()` and unit tests covering:
   - normal → fullscreen → normal
   - normal → split → fullscreen → split
   - split removal cleanup
2. Add integration tests for `TerminalTabManager` to ensure tab clicks trigger the proper
   intent chain.

## 7. Open Questions

1. **Animation Support** – Do we need transitions when switching layouts? If so, consider
   a lightweight animation manager to avoid leaking styles into business logic.
2. **Horizontal Splits** – Current split logic is mostly vertical; confirm future UX needs.
3. **Persistence** – Should fullscreen vs split state persist across reloads? If yes,
   extend persistence manager with mode snapshots.

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| DOM churn causing flicker | Batch DOM mutations inside `requestAnimationFrame` in `applyDisplayState`. |
| Legacy code still mutates DOM directly | Add TypeScript interfaces restricting exposed methods; run grep-based lint check. |
| Tests become flaky due to timers | Use synchronous layout updates; gate timeouts behind optional parameters for tests. |

## 9. Glossary

- **Container**: The primary element (`div.terminal-container`) that hosts an xterm instance.
- **Wrapper**: Split-specific parent element that groups a container with splitter controls.
- **Display Intent**: High-level command describing the desired terminal layout state.
- **Display State**: Concrete, fully-resolved layout configuration applied to the DOM.

