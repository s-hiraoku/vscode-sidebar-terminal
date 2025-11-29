# Add VS Code Standard Terminal Features

## Why

Secondary Terminal currently implements custom terminal functionality that diverges from VS Code's standard terminal in several key areas:

1. **Scrollback Persistence**: Current implementation saves only 200 lines, while VS Code standard saves 1000-3000 lines with full ANSI color preservation and cursor state
2. **Input Handling**: Custom IME, keyboard, and paste implementations don't fully match VS Code's battle-tested patterns
3. **Display Rendering**: Some ANSI sequences, cursor styles, and theme integration differ from VS Code standards

Users expect VS Code extensions to behave identically to native VS Code features. By aligning with VS Code's standard terminal implementation patterns, we ensure:
- Consistent user experience across VS Code and Secondary Terminal
- Better compatibility with shell integration and CLI tools
- Reduced maintenance burden by following proven patterns
- Easier debugging by referencing VS Code source code

## What Changes

This change implements VS Code standard terminal features by referencing VS Code's source code (microsoft/vscode) using the vscode-terminal-resolver agent:

### 1. Enhanced Scrollback Persistence
- **Increase scrollback save capacity**: 200 lines → 1000 lines (configurable up to 3000)
- **Full state restoration**: Preserve ANSI colors, cursor position, selection ranges
- **VS Code serialization format**: Use xterm.js serialize addon matching VS Code's implementation
- **Compression optimization**: Maintain gzip compression for storage efficiency

### 2. Standard Input Handling
- **IME composition**: Align with VS Code's composition event handling patterns
- **Keyboard shortcuts**: Ensure Ctrl+C, Ctrl+V, Ctrl+Insert match VS Code behavior
- **Alt+Click links**: File paths and URLs open using VS Code's link handler patterns
- **Multi-line paste**: Handle complex paste scenarios (quotes, newlines) like VS Code

### 3. Display Rendering Improvements
- **ANSI/Escape sequences**: Complete support for sequences VS Code renders
- **Cursor rendering**: Match VS Code cursor shapes (block, underline, bar) and blinking
- **Font/Theme sync**: Full integration with VS Code font and theme settings
- **Rendering performance**: Optimize to match VS Code's 60fps standard output

### 4. Implementation Approach
- **vscode-terminal-resolver**: Use specialized agent to fetch VS Code source patterns
- **Pattern adaptation**: Adapt VS Code patterns to existing TerminalManager singleton
- **Incremental deployment**: Roll out features progressively with feature flags
- **Test coverage**: Add tests matching VS Code's terminal test scenarios

## Impact

### Affected Specs
- **terminal-scrollback**: New capability for enhanced persistence
- **terminal-input**: New capability for standardized input handling
- **terminal-display**: New capability for VS Code-compliant rendering

### Affected Code
- `src/terminals/TerminalManager.ts`: Lifecycle and initialization patterns
- `src/webview/managers/InputManager.ts`: IME and keyboard event handling
- `src/webview/managers/UIManager.ts`: Display and rendering logic
- `src/webview/managers/StandardTerminalPersistenceManager.ts`: Serialization patterns
- `src/services/OptimizedTerminalPersistenceManager.ts`: Backend persistence service

### Breaking Changes
None - all changes are backward compatible with feature flags for gradual rollout.

### Migration Path
1. Existing terminals continue using current implementation
2. New terminals opt-in to VS Code standard features via configuration
3. Users can enable/disable features individually
4. Full migration to VS Code patterns in v0.2.0 major release

### Risks
- **Performance**: More complex serialization may impact startup time (mitigated by compression)
- **Compatibility**: Some custom features (AI agent detection) need integration testing
- **Maintenance**: Following VS Code patterns requires periodic synchronization with upstream

### Dependencies
- Requires `/terminal-research` command for VS Code source analysis
- Requires vscode-terminal-resolver agent for implementation guidance
- May require xterm.js addon updates for advanced features
