# Implementation Tasks: VS Code Standard Terminal Features

## Phase 1: Research & Setup (v0.1.128)

### 1.1 VS Code Source Code Research ✅ COMPLETED
**Goal**: Research VS Code terminal implementation patterns from source code

- [x] 1.1.1 Run `/terminal-research How does VS Code serialize terminal scrollback?` ✅
  - **VS Code Implementation**: XtermSerializer.generateReplayEvent() uses SerializeAddon (`ptyService.ts:1314-1340`)
  - **Data Structure**: IPtyHostProcessReplayEvent with cols, rows, serialized data
  - **Storage Format**: JSON with scrollback limit from `terminal.integrated.scrollback` config
  - **Current Codebase**: ScrollbackManager (`src/webview/managers/ScrollbackManager.ts`) with ANSI preservation
- [x] 1.1.2 Run `/terminal-research How does VS Code handle IME composition events?` ✅
  - **VS Code Implementation**: CompositionHelper.ts (xterm.js) with 3-phase event handling
  - **Critical Pattern**: setTimeout(0) strategy for reliable text extraction
  - **Keycode 229**: Detection for IME-active state
  - **Current Codebase**: IMEHandler (`src/webview/managers/input/handlers/IMEHandler.ts:91-113`)
- [x] 1.1.3 Run `/terminal-research How does VS Code render cursor styles?` ✅
  - **VS Code Implementation**: terminalConfiguration.ts with cursorStyle, cursorBlink, cursorWidth options
  - **Style Mapping**: VS Code 'line' → xterm.js 'bar' for consistency (`xtermTerminal.ts:1009-1015`)
  - **Dynamic Updates**: Setter methods for runtime cursor changes (`xtermTerminal.ts:763-788`)
  - **Current Codebase**: TerminalCreationService defaults (`src/webview/services/TerminalCreationService.ts:87-90`)
- [x] 1.1.4 Run `/terminal-research What are VS Code's terminal theme integration patterns?` ✅
  - **VS Code Implementation**: TerminalInstanceColorProvider with location-based background (`terminalInstance.ts:2890+`)
  - **ANSI Mapping**: getXtermTheme() maps 16 ANSI colors from VS Code theme (`xtermTerminal.ts:450+`)
  - **Reactive Updates**: onDidColorThemeChange listener for dynamic theme switching
  - **Current Codebase**: ThemeManager (`src/webview/utils/ThemeManager.ts`) with CSS variable extraction
- [x] 1.1.5 Document VS Code version used (v1.85.0) in design.md ✅
  - **File**: `openspec/changes/add-vscode-standard-terminal-features/design.md` (lines 19-37)
  - **Research Date**: 2025-01-10
  - **Key References**: Scrollback serialization, IME composition, cursor styles, theme integration

### 1.2 Feature Flag Infrastructure
- [ ] 1.2.1 Add feature flag configuration schema to package.json
- [ ] 1.2.2 Create `FeatureFlagService` for centralized flag management
- [ ] 1.2.3 Add configuration properties:
  - `secondaryTerminal.features.enhancedScrollbackPersistence` (default: false)
  - `secondaryTerminal.features.scrollbackLineLimit` (default: 1000, range: 200-3000)
  - `secondaryTerminal.features.vscodeStandardIME` (default: false)
  - `secondaryTerminal.features.vscodeKeyboardShortcuts` (default: true)
  - `secondaryTerminal.features.vscodeStandardCursor` (default: false)
  - `secondaryTerminal.features.fullANSISupport` (default: true)
- [ ] 1.2.4 Write unit tests for FeatureFlagService (85%+ coverage)
- [ ] 1.2.5 Update ConfigurationService to load feature flags

### 1.3 WebView Lifecycle Stability (Decision 5) ✅ COMPLETED
**Goal**: Implement VS Code ViewPane pattern to prevent duplicate HTML rendering on panel position changes

- [x] 1.3.1 Add `_bodyRendered` flag to SecondaryTerminalProvider (ViewPane pattern)
  - Add `private _bodyRendered = false;` alongside existing flags (line 68)
  - Update `resolveWebviewView()` to check `_bodyRendered` first and return early (lines 169-181)
  - Set `_bodyRendered = true` after complete initialization (line 195)
  - Reset flag to `false` in `dispose()` (line 2479)
- [x] 1.3.2 Consolidate visibility listeners (reduce 3 → 1)
  - Remove duplicate visibility listeners from multiple locations
  - Create single `_registerVisibilityListener()` method (lines 264-322)
  - Implement state save/restore pattern (no HTML re-initialization)
  - Add diagnostic logging for visibility changes
- [x] 1.3.3 Add ViewPane lifecycle tests
  - Test: `resolveWebviewView` ignores duplicate calls ✅
  - Test: HTML set exactly once ✅
  - Test: Listeners registered exactly once ✅
  - Test: Panel position change preserves state ✅
  - Test: Visibility change does not re-initialize HTML ✅
  - **File**: `src/test/unit/providers/SecondaryTerminalProvider-ViewPaneLifecycle.test.ts`
- [x] 1.3.4 Performance monitoring
  - Add metrics: `resolveWebviewView` call count (lines 153-154)
  - Add metrics: HTML set operations (target: 1) (lines 365-366)
  - Add metrics: Listener registrations (target: 1) (lines 257-258)
  - Add metrics: Panel movement time (target: < 200ms) (lines 174-175)
  - **Public API**: `getPerformanceMetrics()` (lines 2448-2457)
  - **Logging**: `_logPerformanceMetrics()` (lines 2432-2442)
- [x] 1.3.5 Update CLAUDE.md documentation
  - Document ViewPane pattern implementation ✅
  - Add troubleshooting guide for WebView lifecycle issues ✅
  - Reference VS Code source files used ✅
  - **File**: `src/providers/CLAUDE.md` (lines 35-119)

### 1.4 Dependency Verification
- [ ] 1.4.1 Verify xterm.js version compatibility (current: 5.5.0)
- [ ] 1.4.2 Install xterm-addon-serialize if not present
- [ ] 1.4.3 Verify xterm-addon-webgl for performance optimization
- [ ] 1.4.4 Run `npm audit` and resolve any vulnerabilities
- [ ] 1.4.5 Update package.json with any new dependencies

## Phase 2: Enhanced Scrollback Persistence (v0.1.129)

### 2.1 Serialization Enhancement
- [ ] 2.1.1 Refactor `StandardTerminalPersistenceManager.ts`:
  - Integrate xterm-addon-serialize
  - Implement VS Code serialization patterns from research
  - Add error handling for serialization failures
- [ ] 2.1.2 Update `OptimizedTerminalPersistenceService.ts`:
  - Increase default scrollback from 200 to 1000 lines
  - Add configuration-based limit (200-3000)
  - Implement storage size validation
- [ ] 2.1.3 Add serialization metadata:
  - Terminal dimensions (rows × columns)
  - Cursor position
  - Selection ranges
  - Shell integration data
  - Working directory
- [ ] 2.1.4 Implement VS Code standard save timing in `StandardTerminalSessionManager.ts`:
  - Add `setupAutoSave()` method to register `vscode.workspace.onWillSaveState` listener
  - Implement auto-save on window close/reload (via `onWillSaveState` event)
  - Add `dispose()` method to clean up event listeners
  - Implement debounced real-time save with 30-second delay (optional)
  - Update `ExtensionLifecycle.deactivate()` to call `dispose()` on StandardTerminalSessionManager
  - Add logging for auto-save triggers and completion
  - Test save timing with "Reload Window" command
  - Verify data persistence after window reload

### 2.2 Progressive Loading
- [ ] 2.2.1 Implement chunk-based loading in `StandardTerminalPersistenceManager.ts`:
  - Initial load: 500 lines
  - Chunk size: 500 lines
  - Add "Load more history" UI indicator
- [ ] 2.2.2 Add performance benchmarks:
  - Target: < 1000ms for large scrollback (3000 lines)
  - Target: < 500ms for small scrollback (< 500 lines)
- [ ] 2.2.3 Implement lazy loading trigger on scroll-to-top

### 2.3 Backward Compatibility
- [ ] 2.3.1 Add migration logic for old 200-line format
- [ ] 2.3.2 Test restoration of existing saved sessions
- [ ] 2.3.3 Ensure no data loss during format migration
- [ ] 2.3.4 Add migration progress indicators

### 2.4 Storage Optimization
- [ ] 2.4.1 Verify gzip compression is active and effective (60%+ reduction)
- [ ] 2.4.2 Implement storage limit enforcement (default 10MB)
- [ ] 2.4.3 Add user warnings when approaching storage limits
- [ ] 2.4.4 Implement automatic cleanup of sessions older than 30 days
- [ ] 2.4.5 Add configuration for retention period

### 2.5 Testing
- [ ] 2.5.1 Write unit tests for enhanced serialization (90%+ coverage)
- [ ] 2.5.2 Write integration tests for progressive loading
- [ ] 2.5.3 Write performance tests for large scrollback restoration
- [ ] 2.5.4 Test backward compatibility with old session format
- [ ] 2.5.5 Test storage limit enforcement
- [ ] 2.5.6 Run full test suite: `npm run test:unit`

## Phase 3: Standard Input Handling (v0.1.130)

### 3.1 IME Composition Refactoring
- [ ] 3.1.1 Refactor `InputManager.ts` handleIMEComposition():
  - Apply VS Code composition event patterns from research
  - Add isComposing state flag
  - Implement compositionstart/update/end handlers
  - Prevent duplicate character insertion
- [ ] 3.1.2 Test with Japanese IME (hiragana, katakana, kanji)
- [ ] 3.1.3 Test with Chinese pinyin IME
- [ ] 3.1.4 Test composition cancellation (ESC key)
- [ ] 3.1.5 Document IME handling patterns with VS Code source references

### 3.2 Keyboard Shortcut Handling
- [ ] 3.2.1 Refactor `InputManager.ts` handleKeyboardEvent():
  - Implement Ctrl+C copy/SIGINT logic matching VS Code
  - Implement Ctrl+V paste logic
  - Add Ctrl+Insert (copy) and Shift+Insert (paste) for Windows/Linux
  - Add platform-specific Command key handling for macOS
- [ ] 3.2.2 Test keyboard shortcuts on all platforms (Windows, macOS, Linux)
- [ ] 3.2.3 Ensure shortcuts don't conflict with AI agent detection
- [ ] 3.2.4 Add unit tests for keyboard event processing (85%+ coverage)

### 3.3 Multi-line Paste Handling
- [ ] 3.3.1 Refactor `InputManager.ts` handlePaste():
  - Add confirmation prompt for 3+ line pastes
  - Implement bracketed paste mode support
  - Add shell-specific escaping (bash/zsh: backslash, PowerShell: backtick)
  - Apply VS Code paste patterns from research
- [ ] 3.3.2 Test multi-line paste with special characters (quotes, newlines)
- [ ] 3.3.3 Test bracketed paste mode with different shells
- [ ] 3.3.4 Add unit tests for paste escaping logic (90%+ coverage)

### 3.4 Alt+Click Link Handling
- [ ] 3.4.1 Refactor link detection in `InputManager.ts`:
  - Apply VS Code linkifier regex patterns
  - Support file paths with line:column (e.g., src/app.ts:42:7)
  - Support URLs (HTTP, HTTPS, FTP)
  - Support relative and absolute file paths
- [ ] 3.4.2 Implement Alt+Click handler:
  - Open files in editor at specified line/column
  - Open URLs in external browser
  - Handle click on non-link text gracefully
- [ ] 3.4.3 Test link detection with various path formats
- [ ] 3.4.4 Ensure compatibility with AI agent detection (no conflicts)
- [ ] 3.4.5 Add unit tests for link detection regex (85%+ coverage)

### 3.5 Testing
- [ ] 3.5.1 Write comprehensive input handling integration tests
- [ ] 3.5.2 Test IME with all supported languages
- [ ] 3.5.3 Test keyboard shortcuts on Windows, macOS, Linux
- [ ] 3.5.4 Test paste handling edge cases
- [ ] 3.5.5 Test Alt+Click with AI agents (Claude Code, Copilot, Gemini)
- [ ] 3.5.6 Run full test suite: `npm run test:unit`

## Phase 4: Display Rendering Improvements (v0.1.131)

### 4.1 ANSI Sequence Support
- [ ] 4.1.1 Verify xterm.js configuration supports 256-color mode
- [ ] 4.1.2 Enable true color (24-bit RGB) support
- [ ] 4.1.3 Test all text formatting sequences:
  - Bold, italic, underline, strikethrough
  - Foreground and background colors
  - Reset sequences
  - Combining multiple formats
- [ ] 4.1.4 Test cursor control sequences (CUP, CUU, CUD, CUF, CUB)
- [ ] 4.1.5 Verify ANSI rendering matches VS Code exactly

### 4.2 Cursor Rendering
- [ ] 4.2.1 Refactor `UIManager.ts` cursor rendering:
  - Apply VS Code cursor patterns from research
  - Implement block cursor style
  - Implement bar (vertical line) cursor style
  - Implement underline cursor style
- [ ] 4.2.2 Implement cursor blinking:
  - Sync with `terminal.integrated.cursorBlinking` setting
  - Use 530ms blink interval (matching VS Code)
  - Pause blinking when terminal loses focus
- [ ] 4.2.3 Sync cursor color with terminal theme
- [ ] 4.2.4 Test cursor rendering in all styles and themes
- [ ] 4.2.5 Add unit tests for cursor logic (85%+ coverage)

### 4.3 Font and Theme Integration
- [ ] 4.3.1 Refactor `UIManager.ts` theme synchronization:
  - Apply VS Code IThemeService patterns from research
  - Sync with `terminal.integrated.fontFamily`
  - Sync with `terminal.integrated.fontSize`
  - Sync with `terminal.integrated.fontWeight`
  - Support font ligatures if `editor.fontLigatures` enabled
- [ ] 4.3.2 Implement theme change detection and propagation
- [ ] 4.3.3 Map ANSI color palette to VS Code theme colors
- [ ] 4.3.4 Test with light and dark themes
- [ ] 4.3.5 Test font family/size changes and terminal reflow
- [ ] 4.3.6 Add unit tests for theme integration (85%+ coverage)

### 4.4 Rendering Performance
- [ ] 4.4.1 Verify 60fps rendering (16ms frame time) for normal output
- [ ] 4.4.2 Implement requestAnimationFrame batching for writes
- [ ] 4.4.3 Add throttling for high-frequency output
- [ ] 4.4.4 Enable WebGL renderer when `terminal.integrated.gpuAcceleration` is "on"
- [ ] 4.4.5 Implement graceful fallback to canvas renderer
- [ ] 4.4.6 Add performance benchmarks:
  - Target: 60fps for normal output
  - Target: Responsive input during rapid output
  - Target: Smooth scrolling (150ms animation)
- [ ] 4.4.7 Run performance tests: `npm run test:performance`

### 4.5 Selection and Scrolling
- [ ] 4.5.1 Verify text selection works correctly (single-click, drag, double-click, triple-click)
- [ ] 4.5.2 Implement Shift+Click selection extension
- [ ] 4.5.3 Implement smooth scrolling when `terminal.integrated.smoothScrolling` enabled
- [ ] 4.5.4 Implement scrollback freeze behavior (no auto-scroll when scrolled up)
- [ ] 4.5.5 Add "Scroll to bottom" indicator when scrolled up
- [ ] 4.5.6 Test selection and scrolling with large scrollback (3000 lines)

### 4.6 Testing
- [ ] 4.6.1 Write visual regression tests for cursor rendering
- [ ] 4.6.2 Write visual regression tests for theme changes
- [ ] 4.6.3 Test ANSI sequences with automated test suite
- [ ] 4.6.4 Test font changes and terminal reflow
- [ ] 4.6.5 Test selection and scrolling behaviors
- [ ] 4.6.6 Run full test suite: `npm run test:unit`

## Phase 5: Integration & Testing (v0.1.132)

### 5.1 End-to-End Integration
- [ ] 5.1.1 Test all three capabilities together (scrollback + input + display)
- [ ] 5.1.2 Test with AI agents (Claude Code, Copilot, Gemini, CodeRabbit)
- [ ] 5.1.3 Verify no conflicts with existing features:
  - AI agent detection
  - 5-terminal limit
  - Session persistence
  - Alt+Option+L file reference sharing
- [ ] 5.1.4 Test on all supported platforms:
  - Windows (x64, ARM64)
  - macOS (Intel, Apple Silicon)
  - Linux (x64, ARM64, ARMhf)
- [ ] 5.1.5 Test with different shells (bash, zsh, fish, PowerShell, cmd)

### 5.2 Performance Validation
- [ ] 5.2.1 Run performance test suite: `npm run test:performance`
- [ ] 5.2.2 Benchmark scrollback restoration times
- [ ] 5.2.3 Benchmark rendering performance (60fps target)
- [ ] 5.2.4 Benchmark storage usage (verify compression effectiveness)
- [ ] 5.2.5 Profile memory usage with 5 terminals and 1000-line scrollback each

### 5.3 Test Coverage
- [ ] 5.3.1 Run coverage report: `npm run test:coverage`
- [ ] 5.3.2 Ensure 85%+ overall coverage
- [ ] 5.3.3 Ensure 90%+ coverage for critical paths:
  - Serialization/deserialization
  - IME composition handling
  - Keyboard shortcut processing
  - Theme integration
- [ ] 5.3.4 Fix any coverage gaps

### 5.4 Documentation
- [ ] 5.4.1 Update README.md with new features
- [ ] 5.4.2 Update CHANGELOG.md with v0.1.128-132 changes
- [ ] 5.4.3 Document feature flags in package.json descriptions
- [ ] 5.4.4 Add migration guide for users upgrading from v0.1.127
- [ ] 5.4.5 Update CLAUDE.md with implementation patterns used
- [ ] 5.4.6 Document VS Code source references in design.md

### 5.5 Pre-Release Checks
- [ ] 5.5.1 Run `npm run pre-release:check` (must pass)
- [ ] 5.5.2 Run `npm run compile` (zero errors)
- [ ] 5.5.3 Run `npm run lint` (zero errors)
- [ ] 5.5.4 Run `npm run format` (code formatted)
- [ ] 5.5.5 Run `npm run tdd:quality-gate` (TDD compliance)

## Phase 6: Beta Testing (v0.1.133-135)

### 6.1 Beta Release Preparation
- [ ] 6.1.1 Create beta release notes highlighting new features
- [ ] 6.1.2 Document opt-in process for beta testers
- [ ] 6.1.3 Set up telemetry for feature usage (if applicable)
- [ ] 6.1.4 Create feedback collection form/issue template
- [ ] 6.1.5 Release v0.1.133 with features disabled by default

### 6.2 Beta Testing Execution
- [ ] 6.2.1 Recruit 10-20 beta testers
- [ ] 6.2.2 Provide instructions for enabling feature flags
- [ ] 6.2.3 Monitor feedback channels (GitHub issues, discussions)
- [ ] 6.2.4 Collect performance metrics and bug reports
- [ ] 6.2.5 Conduct weekly check-ins with beta testers

### 6.3 Bug Fixes & Refinements
- [ ] 6.3.1 Triage and prioritize reported issues
- [ ] 6.3.2 Fix critical bugs (blocking issues)
- [ ] 6.3.3 Fix high-priority bugs (major functionality issues)
- [ ] 6.3.4 Address performance concerns
- [ ] 6.3.5 Release v0.1.134 and v0.1.135 with fixes

### 6.4 Validation
- [ ] 6.4.1 Confirm all critical bugs resolved
- [ ] 6.4.2 Verify performance meets targets
- [ ] 6.4.3 Ensure test coverage remains 85%+
- [ ] 6.4.4 Get beta tester approval for default enablement
- [ ] 6.4.5 Prepare for v0.2.0 major release

## Phase 7: Default Enablement (v0.2.0)

### 7.1 Feature Activation
- [ ] 7.1.1 Update default feature flag values:
  - `enhancedScrollbackPersistence`: true
  - `vscodeStandardIME`: true
  - `vscodeStandardCursor`: true
  - `fullANSISupport`: true (already default)
- [ ] 7.1.2 Remove feature flag code (breaking change for v0.2.0)
- [ ] 7.1.3 Update configuration schema to reflect new defaults

### 7.2 Release Preparation
- [ ] 7.2.1 Write comprehensive v0.2.0 release notes
- [ ] 7.2.2 Create migration guide for users with custom configurations
- [ ] 7.2.3 Update documentation with new default behavior
- [ ] 7.2.4 Run final `npm run pre-release:check`
- [ ] 7.2.5 Increment version to v0.2.0: `npm version minor --no-git-tag-version`

### 7.3 Release Execution
- [ ] 7.3.1 Commit changes: `git add -A && git commit -m "v0.2.0: VS Code standard terminal features"`
- [ ] 7.3.2 Push to GitHub: `git push`
- [ ] 7.3.3 Wait for CI to pass (all platforms)
- [ ] 7.3.4 Create git tag: `git tag v0.2.0 && git push origin v0.2.0`
- [ ] 7.3.5 Automated workflow creates release and publishes to marketplace

### 7.4 Post-Release Monitoring
- [ ] 7.4.1 Monitor GitHub issues for new bug reports
- [ ] 7.4.2 Monitor VS Code Marketplace reviews
- [ ] 7.4.3 Track download metrics and adoption rate
- [ ] 7.4.4 Prepare hotfix process if critical issues arise
- [ ] 7.4.5 Schedule v0.2.1 patch release if needed

## Dependencies

### Parallel Work Opportunities
- Phases 2, 3, and 4 can be partially parallelized after Phase 1 completes
- Testing tasks (2.5, 3.5, 4.6) can run in parallel during development

### Sequential Dependencies
- Phase 1 must complete before 2, 3, 4 (feature flags and research needed)
- Phase 5 depends on completion of 2, 3, 4 (integration testing)
- Phase 6 depends on Phase 5 (beta testing requires stable build)
- Phase 7 depends on Phase 6 (default enablement requires beta validation)

### External Dependencies
- VS Code terminal research via `/terminal-research` command
- vscode-terminal-resolver agent availability
- xterm.js addon availability (serialize, webgl)
- Beta tester availability and feedback
