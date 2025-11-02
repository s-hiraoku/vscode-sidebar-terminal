# Design: VS Code Standard Terminal Features

## Context

Secondary Terminal was built with a custom terminal management architecture optimized for AI CLI agents. While this provides excellent AI integration, it has diverged from VS Code's standard terminal patterns in several areas. Users expect VS Code extensions to behave identically to native features.

**Current Architecture**:
- Singleton TerminalManager with atomic operations and ID recycling (1-5)
- Manager-Coordinator pattern for WebView components
- Custom persistence with 200-line scrollback limit
- AI agent-optimized buffering (16ms normal, 4ms CLI agents)

**VS Code Terminal Architecture** (from microsoft/vscode v1.85.0):
- TerminalService + TerminalInstance pattern
- xterm.js with full addon support (serialize, search, webgl, unicode11)
- 1000-3000 line scrollback with full state serialization
- 16ms buffering with requestAnimationFrame

**VS Code Version Reference**: v1.85.0 (January 2024)
- Repository: https://github.com/microsoft/vscode
- Research conducted: 2025-01-01
- Key files referenced:
  - `src/vs/platform/terminal/node/ptyService.ts:1050-1150`
  - `src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts`
  - `src/vs/workbench/contrib/terminal/common/terminalConfiguration.ts`
  - `src/vs/workbench/contrib/terminal/common/terminalColorRegistry.ts`

## Goals / Non-Goals

### Goals
1. **Scrollback Parity**: Match VS Code's 1000-3000 line persistence with full state restoration
2. **Input Consistency**: IME, keyboard, paste behavior identical to VS Code
3. **Display Accuracy**: Complete ANSI sequence support and cursor rendering
4. **Source-Driven Implementation**: Use VS Code source code as authoritative reference
5. **Backward Compatibility**: Existing features (AI detection, 5-terminal limit) remain functional
6. **Incremental Adoption**: Feature flags allow gradual rollout and testing

### Non-Goals
1. **Architecture Overhaul**: Not replacing TerminalManager singleton pattern
2. **Unlimited Terminals**: Maintaining 5-terminal limit for design simplicity
3. **VS Code API Parity**: Not implementing VS Code's public API surface
4. **Abandon Optimizations**: Keep AI agent performance optimizations (4ms flush)

## Decisions

### Decision 1: Use vscode-terminal-resolver Agent for Source Analysis

**Rationale**: VS Code terminal implementation is battle-tested with millions of users. Rather than guessing or reimplementing, we fetch actual patterns from VS Code source.

**Alternatives Considered**:
- ❌ **Reverse engineering**: Observing VS Code behavior and guessing implementation (error-prone, incomplete)
- ❌ **Documentation only**: xterm.js docs don't cover VS Code-specific patterns (insufficient)
- ✅ **Source code reference**: Direct access to microsoft/vscode repository provides authoritative patterns

**Implementation**:
```bash
# Research phase before each capability implementation
/terminal-research How does VS Code handle terminal scrollback serialization?
/terminal-research What are VS Code's IME composition event patterns?
/terminal-research How does VS Code render cursor styles and blinking?
```

### Decision 2: Extend Serialization to 1000+ Lines with Compression

**Current State**:
- 200 lines scrollback for persistence
- gzip compression enabled
- Session save interval: 5 minutes

**New State**:
- **1000 lines default** (configurable 200-3000)
- Enhanced serialization: ANSI colors, cursor state, selection ranges
- Same compression and save interval
- Progressive loading for large scrollback

**Rationale**: VS Code users expect 1000+ line persistence. Storage concerns mitigated by:
- gzip compression (~70% reduction)
- Configurable limits (users choose storage vs. history trade-off)
- 10MB default storage limit (sufficient for 5 terminals × 1000 lines each)

**Trade-offs**:
- ✅ Better user experience (more history preserved)
- ✅ Competitive parity with VS Code
- ⚠️ Slightly longer startup time (mitigated by progressive loading)
- ⚠️ More storage usage (mitigated by compression and limits)

### Decision 3: Adapt VS Code Patterns to Existing TerminalManager

**VS Code Pattern**:
```typescript
// VS Code: TerminalService creates TerminalInstance
class TerminalInstance {
  private _ptyProcess: ITerminalChildProcess;
  private _xterm: Terminal;

  public async serialize(): Promise<ISerializedTerminal> {
    return this._xterm.serialize();
  }
}
```

**Our Adaptation**:
```typescript
// Secondary Terminal: TerminalManager manages instances
class TerminalManager {
  private readonly _terminals = new Map<string, TerminalInstance>();

  public async serializeTerminal(id: string): Promise<string> {
    const instance = this._terminals.get(id);
    // Apply VS Code serialization pattern while maintaining our structure
    return await this._persistenceService.serialize(instance);
  }
}
```

**Rationale**: Our TerminalManager singleton has proven stable with atomic operations and ID recycling. Rather than rewrite to match VS Code's service pattern exactly, we adapt the core algorithms while preserving our architecture.

### Decision 4: Feature Flags for Gradual Rollout

**Configuration**:
```typescript
interface TerminalFeatures {
  // Scrollback features
  enhancedScrollbackPersistence: boolean; // Default: false (v0.1.x), true (v0.2.x)
  scrollbackLineLimit: number; // Default: 1000, Range: 200-3000

  // Input features
  vscodeStandardIME: boolean; // Default: false (v0.1.x), true (v0.2.x)
  vscodeKeyboardShortcuts: boolean; // Default: true

  // Display features
  vscodeStandardCursor: boolean; // Default: false (v0.1.x), true (v0.2.x)
  fullANSISupport: boolean; // Default: true
}
```

**Rollout Strategy**:
1. **v0.1.128-130**: Implement features behind flags (default: off)
2. **v0.1.131-135**: Beta testing with opt-in users
3. **v0.2.0**: Enable by default, remove flags (major version)

## Architecture Components

### 1. Scrollback Persistence Layer

```
┌─────────────────────────────────────────────────────────┐
│ TerminalManager                                         │
│ ├─ serializeTerminal(id) ────────────────────────┐     │
│ └─ restoreTerminal(id, state) ────────────────┐  │     │
└───────────────────────────────────────────────┼──┼─────┘
                                                │  │
                    ┌───────────────────────────┘  │
                    │                              │
        ┌───────────▼───────────────┐   ┌──────────▼─────────────┐
        │ StandardTerminal          │   │ OptimizedTerminal      │
        │ PersistenceManager        │   │ PersistenceService     │
        │ (WebView side)            │   │ (Extension side)       │
        │                           │   │                        │
        │ • xterm.js serialize      │◄──┤ • Session storage      │
        │ • State restoration       │   │ • Compression          │
        │ • Progressive loading     │   │ • Workspace isolation  │
        └───────────────────────────┘   └────────────────────────┘
                    │                              │
                    └──────────────┬───────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │ VS Code Patterns    │
                        │ (via resolver)      │
                        │                     │
                        │ • Serialization     │
                        │ • Compression       │
                        │ • State management  │
                        └─────────────────────┘
```

**Key Changes**:
- `StandardTerminalPersistenceManager.ts`: Add VS Code serialization patterns from resolver
- `OptimizedTerminalPersistenceService.ts`: Increase storage limits, add progressive loading
- Feature flag: `enhancedScrollbackPersistence`

### 2. Input Handling Layer

```
┌─────────────────────────────────────────────────────────┐
│ InputManager (WebView)                                  │
│ ├─ handleIMEComposition() ───┐                         │
│ ├─ handleKeyboardEvent() ─────┼──────────┐             │
│ ├─ handlePaste() ─────────────┼──────────┼──┐          │
│ └─ handleAltClick() ──────────┼──────────┼──┼──┐       │
└───────────────────────────────┼──────────┼──┼──┼───────┘
                                │          │  │  │
                    ┌───────────┘          │  │  │
                    │                      │  │  │
        ┌───────────▼─────────┐            │  │  │
        │ VS Code IME         │            │  │  │
        │ Pattern             │            │  │  │
        │                     │            │  │  │
        │ • compositionstart  │            │  │  │
        │ • compositionupdate │            │  │  │
        │ • compositionend    │            │  │  │
        │ • Duplicate prevent │            │  │  │
        └─────────────────────┘            │  │  │
                                           │  │  │
                         ┌─────────────────┘  │  │
                         │                    │  │
              ┌──────────▼───────────┐        │  │
              │ VS Code Keyboard     │        │  │
              │ Pattern              │        │  │
              │                      │        │  │
              │ • Ctrl+C/V           │        │  │
              │ • Ctrl+Insert        │        │  │
              │ • Command key map    │        │  │
              └──────────────────────┘        │  │
                                              │  │
                            ┌─────────────────┘  │
                            │                    │
                 ┌──────────▼──────────┐         │
                 │ VS Code Paste       │         │
                 │ Pattern             │         │
                 │                     │         │
                 │ • Multi-line        │         │
                 │ • Quote escape      │         │
                 │ • Bracketed paste   │         │
                 └─────────────────────┘         │
                                                 │
                               ┌─────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ VS Code Link        │
                    │ Handler Pattern     │
                    │                     │
                    │ • File path detect  │
                    │ • URL handling      │
                    │ • Alt modifier      │
                    └─────────────────────┘
```

**Key Changes**:
- `InputManager.ts`: Refactor IME, keyboard, paste using VS Code patterns
- Feature flags: `vscodeStandardIME`, `vscodeKeyboardShortcuts`

### 3. Display Rendering Layer

```
┌─────────────────────────────────────────────────────────┐
│ UIManager (WebView)                                     │
│ ├─ updateTheme() ─────────────┐                        │
│ ├─ renderCursor() ─────────────┼────┐                  │
│ └─ applyANSISequences() ───────┼────┼───┐              │
└───────────────────────────────┼────┼───┼──────────────┘
                                │    │   │
                    ┌───────────┘    │   │
                    │                │   │
        ┌───────────▼─────────┐      │   │
        │ VS Code Theme       │      │   │
        │ Integration         │      │   │
        │                     │      │   │
        │ • Font settings     │      │   │
        │ • Color scheme      │      │   │
        │ • Ligature support  │      │   │
        └─────────────────────┘      │   │
                                     │   │
                   ┌─────────────────┘   │
                   │                     │
        ┌──────────▼──────────┐          │
        │ VS Code Cursor      │          │
        │ Rendering           │          │
        │                     │          │
        │ • Block/Bar/Under   │          │
        │ • Blink patterns    │          │
        │ • Color sync        │          │
        └─────────────────────┘          │
                                         │
                       ┌─────────────────┘
                       │
            ┌──────────▼──────────┐
            │ VS Code ANSI        │
            │ Sequence Support    │
            │                     │
            │ • 256 colors        │
            │ • True color        │
            │ • Formatting        │
            └─────────────────────┘
```

**Key Changes**:
- `UIManager.ts`: Apply VS Code theme and cursor patterns
- Feature flag: `vscodeStandardCursor`, `fullANSISupport`

## Risks / Trade-offs

### Risk 1: VS Code Source Changes
**Risk**: VS Code updates its terminal implementation, our patterns become outdated.
**Mitigation**:
- Document VS Code version used (e.g., v1.85.0)
- Add automated checks for VS Code updates
- Re-run `/terminal-research` quarterly to verify patterns

### Risk 2: Performance Regression
**Risk**: More complex serialization/rendering may slow down terminal operations.
**Mitigation**:
- Benchmark before/after with performance tests
- Progressive loading for large scrollback
- Keep AI agent optimizations (4ms flush interval)
- Feature flags allow disabling problematic features

### Risk 3: AI Agent Compatibility
**Risk**: VS Code patterns may conflict with custom AI agent detection.
**Mitigation**:
- Preserve existing AI detection architecture
- Test all AI agents (Claude Code, Copilot, Gemini) with new features
- Add integration tests for AI + VS Code features

### Risk 4: Storage Increase
**Risk**: 1000-line scrollback increases storage usage 5x.
**Mitigation**:
- gzip compression (~70% reduction)
- Configurable limits (users control trade-off)
- Storage monitoring and warnings
- Auto-cleanup of old sessions (7-day expiry)

## Migration Plan

### Phase 1: Research & Prototyping (v0.1.128-129)
1. Run `/terminal-research` for each capability
2. Create proof-of-concept implementations
3. Add feature flags to configuration
4. Initial unit tests

### Phase 2: Implementation (v0.1.130-132)
1. **Scrollback**: Implement enhanced serialization with VS Code patterns
2. **Input**: Refactor IME/keyboard/paste handlers
3. **Display**: Update cursor rendering and ANSI support
4. Comprehensive test coverage (85%+ target)

### Phase 3: Beta Testing (v0.1.133-135)
1. Release with features disabled by default
2. Document opt-in process for beta testers
3. Collect feedback and metrics
4. Fix bugs and refine implementations

### Phase 4: Default Enablement (v0.2.0)
1. Enable features by default
2. Remove feature flags (breaking change)
3. Update documentation
4. Migration guide for advanced users

### Rollback Plan
If critical issues discovered:
1. Disable feature flags via configuration
2. Hotfix release with flags set to `false`
3. Users can manually re-enable stable features
4. Full rollback available via version downgrade

## Open Questions

1. **xterm.js Version**: Should we upgrade xterm.js to match VS Code's version exactly?
   - Currently: 5.5.0
   - VS Code uses: ~5.3.0 (stable)
   - Decision: Keep current version unless specific addons needed

2. **Serialization Format**: Binary vs. JSON for scrollback storage?
   - VS Code uses: xterm.js serialize addon (string format)
   - Current: JSON with gzip
   - Decision: Use xterm.js serialize addon for compatibility

3. **Storage Backend**: Continue using VS Code's globalState or custom storage?
   - Current: VSCode ExtensionContext.globalState
   - Alternative: Custom file-based storage
   - Decision: Keep globalState for consistency with VS Code ecosystem

4. **Test Coverage**: What percentage coverage required before default enablement?
   - Target: 85%+ (matching project standard)
   - Critical paths: 90%+ (serialization, input handling)
   - Decision: Must meet targets before v0.2.0 release
