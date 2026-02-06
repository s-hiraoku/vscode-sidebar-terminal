# VS Code Sidebar Terminal - Comprehensive Test Plan

## Executive Summary

This test plan provides comprehensive test scenarios for the VS Code Sidebar Terminal extension (Secondary Terminal). The extension provides a sidebar-based terminal interface with advanced features including terminal lifecycle management, session persistence, AI agent detection, and sophisticated WebView interactions. All scenarios are designed to be implementable with Playwright Test framework and organized by priority level.

**Extension Version**: v0.1.127
**Test Framework**: Playwright Test
**Platform Coverage**: Windows, macOS, Linux

## Application Overview

### Core Features

1. **Terminal Lifecycle Management**
   - Create up to 5 terminals with ID recycling (IDs 1-5)
   - Terminal creation, deletion, and switching
   - Atomic operations to prevent race conditions
   - Process state management (ProcessState/InteractionState)

2. **Session Persistence**
   - Automatic session save every 5 minutes
   - Restore terminals across VS Code restarts
   - Scrollback preservation (up to 1000 lines per terminal)
   - Active terminal restoration

3. **AI Agent Detection**
   - Real-time detection: Claude Code, GitHub Copilot, Gemini CLI, Codex CLI
   - Visual status indicators in terminal headers
   - State transitions: None → Connected → Active → Disconnected
   - Security: Regex-based pattern matching (no substring vulnerabilities)

4. **WebView Interactions**
   - Alt+Click cursor positioning
   - IME composition (Japanese/Chinese input)
   - Copy/paste functionality
   - ANSI color rendering with theme support
   - Performance-optimized output buffering (16ms flush interval, 4ms for AI agents)

5. **Configuration Management**
   - Font settings, shell selection, theme application
   - Max terminals limit, split view settings
   - Feature flags (persistent sessions, AI detection, shell integration)

---

## Test Scenarios

### 1. Terminal Lifecycle Management

#### 1.1 Single Terminal Creation (P0 - Critical)

**Prerequisites**:

- VS Code with extension installed
- No existing terminals in sidebar

**Steps**:

1. Open VS Code
2. Click Secondary Terminal icon in activity bar
3. Verify terminal appears in sidebar
4. Check terminal ID is 1
5. Verify terminal header shows "Terminal 1"
6. Verify shell prompt appears within 2 seconds

**Expected Results**:

- Terminal initializes successfully
- Terminal ID = 1
- Shell prompt visible
- No error messages in console

**Priority**: P0
**Automation**: Yes
**Platform**: All

---

#### 1.2 Multiple Terminal Creation (P0 - Critical)

**Prerequisites**:

- VS Code with extension installed
- Secondary Terminal view visible

**Steps**:

1. Create first terminal (should get ID 1)
2. Click "Split Terminal" icon or use Cmd+\ (Mac) / Ctrl+Shift+5 (Windows/Linux)
3. Create second terminal (should get ID 2)
4. Repeat until 5 terminals exist
5. Verify all terminals visible in tabs
6. Attempt to create 6th terminal

**Expected Results**:

- Terminals 1-5 created successfully
- Each terminal has unique ID
- All terminals accessible via tabs
- 6th terminal creation shows warning: "Maximum 5 terminals reached"
- No duplicate IDs assigned

**Priority**: P0
**Automation**: Yes
**Platform**: All

---

#### 1.3 Terminal ID Recycling (P1 - Important)

**Prerequisites**:

- 5 active terminals (IDs 1-5)

**Steps**:

1. Delete terminal with ID 3 using trash icon
2. Wait for deletion to complete (process cleanup)
3. Create new terminal
4. Verify new terminal gets ID 3 (recycled)
5. Delete terminal ID 1
6. Create another terminal
7. Verify newest terminal gets ID 1

**Expected Results**:

- IDs are recycled in order of deletion
- No gaps in ID sequence when terminals are recreated
- Terminal name matches recycled ID
- No race conditions (test atomic operation)

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 1.4 Terminal Deletion Edge Cases (P1 - Important)

**Prerequisites**:

- Multiple terminals active

**Steps**:

1. **Test: Delete last terminal**
   - Create terminal (ID 1)
   - Enable `protectLastTerminal: true` in settings
   - Attempt to delete terminal 1
   - Verify warning appears: "Cannot delete last terminal"

2. **Test: Delete terminal with confirmation**
   - Create 2 terminals
   - Enable `confirmBeforeKill: true` in settings
   - Delete terminal 2
   - Verify confirmation dialog appears
   - Click "Cancel"
   - Verify terminal still exists
   - Delete again and click "OK"
   - Verify terminal deleted

3. **Test: Concurrent deletion prevention**
   - Create 3 terminals
   - Rapidly click delete on terminal 2 twice
   - Verify only one delete operation occurs
   - Verify no infinite loop or duplicate deletion

**Expected Results**:

- Last terminal protection works
- Confirmation dialog prevents accidental deletion
- Atomic delete operation prevents race conditions
- `_terminalBeingKilled` set prevents duplicate operations

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 1.5 Terminal Switching and Focus (P1 - Important)

**Prerequisites**:

- 3 active terminals

**Steps**:

1. Click tab for Terminal 1
2. Verify Terminal 1 is visible and focused
3. Click tab for Terminal 3
4. Verify Terminal 3 is visible and focused
5. Use keyboard shortcut Alt+Cmd+Right (Mac) or Alt+Right (Windows/Linux)
6. Verify focus moves to next terminal (wrap to Terminal 1)
7. Use Alt+Cmd+Left to move to previous terminal
8. Type command in focused terminal
9. Verify command appears in correct terminal

**Expected Results**:

- Tab clicks switch terminal correctly
- Keyboard shortcuts cycle through terminals
- Focus indicator visible on active terminal
- Input directed to focused terminal only
- `onTerminalFocus` event fires correctly

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

### 2. Session Persistence and Restoration

#### 2.1 Basic Session Save and Restore (P0 - Critical)

**Prerequisites**:

- Settings: `enablePersistentSessions: true`
- Settings: `persistentSessionReviveProcess: "onExitAndWindowClose"`

**Steps**:

1. Create 2 terminals
2. Terminal 1: Run `cd /tmp && echo "Terminal 1 test"`
3. Terminal 2: Run `ls -la`
4. Wait for auto-save (30 seconds) or trigger manual save
5. Close VS Code completely
6. Reopen VS Code
7. Open Secondary Terminal view

**Expected Results**:

- Both terminals restored automatically
- Terminal 1 shows scrollback with "Terminal 1 test"
- Terminal 2 shows scrollback with directory listing
- Working directories preserved
- Active terminal from previous session is focused

**Priority**: P0
**Automation**: Yes (with VS Code reload simulation)
**Platform**: All

---

#### 2.2 Scrollback Restoration (P1 - Important)

**Prerequisites**:

- Settings: `persistentSessionScrollback: 1000`
- Settings: `enablePersistentSessions: true`

**Steps**:

1. Create terminal
2. Generate 1500 lines of output:
   ```bash
   for i in {1..1500}; do echo "Line $i"; done
   ```
3. Trigger session save
4. Reload VS Code
5. Open restored terminal
6. Scroll to top of terminal output

**Expected Results**:

- Last 1000 lines of output preserved
- Lines 501-1500 visible in scrollback
- Lines 1-500 not preserved (exceeds limit)
- ANSI colors preserved in scrollback
- Scrollbar position indicates correct buffer size

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 2.3 Multi-Terminal Session Restoration (P1 - Important)

**Prerequisites**:

- Settings: `maxTerminals: 5`
- Settings: `enablePersistentSessions: true`

**Steps**:

1. Create 5 terminals with different activities:
   - Terminal 1: `cd ~/projects && ls`
   - Terminal 2: Run Python script
   - Terminal 3: Start node REPL
   - Terminal 4: Run long-running process
   - Terminal 5: Regular shell prompt
2. Set Terminal 3 as active (focused)
3. Trigger session save
4. Reload VS Code

**Expected Results**:

- All 5 terminals restored in correct order
- Terminal IDs match (1-5)
- Terminal 3 is active/focused after restore
- Each terminal shows appropriate scrollback
- Working directories preserved for each terminal
- Long-running process notice or resumption hint shown

**Priority**: P1
**Automation**: Partial (long-running process requires manual verification)
**Platform**: All

---

#### 2.4 Session Expiry and Cleanup (P2 - Nice-to-have)

**Prerequisites**:

- Settings: `persistentSessionScrollback: 1000`

**Steps**:

1. Create session with 2 terminals
2. Save session to storage
3. Manually modify session timestamp to 8 days old in VS Code global storage:
   ```javascript
   // Access via Extension Host debugging
   context.globalState.update('standard-terminal-session-v3', {
     ...sessionData,
     timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
   });
   ```
4. Reload VS Code
5. Open Secondary Terminal

**Expected Results**:

- Expired session not restored (7-day limit)
- New fresh terminal created
- No error messages about corrupt data
- Old session data cleaned from storage

**Priority**: P2
**Automation**: Yes (with storage manipulation)
**Platform**: All

---

#### 2.5 Session Save/Restore with AI Agents (P1 - Important)

**Prerequisites**:

- Claude Code or Gemini CLI installed
- Settings: `enablePersistentSessions: true`

**Steps**:

1. Terminal 1: Start Claude Code session
   ```bash
   claude "write a hello world script"
   ```
2. Terminal 2: Regular shell
3. Wait for Claude Code to enter "Active" state (output streaming)
4. Trigger session save
5. Reload VS Code

**Expected Results**:

- Both terminals restored
- Terminal 1 shows Claude Code scrollback
- Claude status indicator shows "Disconnected" (session not active)
- Terminal 2 shows normal scrollback
- No attempt to restart Claude Code automatically
- Scrollback includes ANSI-colored Claude output

**Priority**: P1
**Automation**: Partial (requires Claude Code availability)
**Platform**: macOS (Claude Code primary platform)

---

### 3. AI Agent Detection

#### 3.1 Claude Code Detection (P0 - Critical)

**Prerequisites**:

- Claude Code installed and configured
- Settings: `enableCliAgentIntegration: true`

**Steps**:

1. Create new terminal
2. Verify initial status indicator shows "None"
3. Start Claude Code:
   ```bash
   claude "list files in current directory"
   ```
4. Observe terminal header status indicator

**Expected Results**:

- Status transitions: None → Connected (on startup banner)
- Status transitions: Connected → Active (on output streaming)
- Status indicator color: Blue (Connected), Green (Active)
- Detection pattern matches: `/\b(claude|anthropic)\s+(code|ai)/i`
- No false positives from filenames like "claude-helper.js"

**Priority**: P0
**Automation**: Partial (requires Claude Code)
**Platform**: macOS, Linux

---

#### 3.2 GitHub Copilot Detection (P1 - Important)

**Prerequisites**:

- GitHub CLI with Copilot installed
- Settings: `enableGitHubCopilotIntegration: true`

**Steps**:

1. Create new terminal
2. Test detection for multiple variants:
   - Variant 1: `gh copilot suggest "how to list files"`
   - Variant 2: `copilot` (if standalone installed)
   - Variant 3: `github-copilot` command
3. Observe status indicator for each variant

**Expected Results**:

- All variants detected successfully
- Status shows "Connected" when command starts
- Status shows "Active" during suggestion output
- Detection pattern: `/(^|\s)(gh\s+copilot|github\s+copilot|copilot)(\s|$)/i`
- No false positive from "mycopilot" variable names
- Visual indicator matches Copilot brand (distinct color)

**Priority**: P1
**Automation**: Partial (requires GitHub Copilot)
**Platform**: All

---

#### 3.3 Gemini CLI Detection (P1 - Important)

**Prerequisites**:

- Gemini CLI installed
- Settings: `enableCliAgentIntegration: true`

**Steps**:

1. Create new terminal
2. Start Gemini CLI (shows ASCII art banner):
   ```bash
   gemini-cli chat
   ```
3. Observe detection during banner display
4. Send message to Gemini
5. Observe status during response streaming

**Expected Results**:

- Detection occurs on ASCII art banner appearance
- Status: None → Connected → Active
- Detection pattern matches Gemini-specific output signatures
- Status persists during multi-turn conversation
- ANSI colors in Gemini output preserved

**Priority**: P1
**Automation**: Partial (requires Gemini CLI)
**Platform**: All

---

#### 3.4 Multi-Agent Scenario (P1 - Important)

**Prerequisites**:

- Claude Code and GitHub Copilot available
- 3 terminals created

**Steps**:

1. Terminal 1: Start Claude Code session
2. Terminal 2: Start GitHub Copilot session
3. Terminal 3: Regular shell (no agent)
4. Switch between terminals
5. Verify each terminal shows correct status

**Expected Results**:

- Terminal 1: Shows Claude Code status (Active/Connected)
- Terminal 2: Shows GitHub Copilot status (Active/Connected)
- Terminal 3: Shows "None" status
- Switching terminals updates status indicator correctly
- No status cross-contamination between terminals
- TerminalManager maintains separate state per terminal ID

**Priority**: P1
**Automation**: Partial (requires multiple agents)
**Platform**: macOS, Linux

---

#### 3.5 Agent Termination Detection (P1 - Important)

**Prerequisites**:

- Claude Code session active

**Steps**:

1. Start Claude Code with command
2. Verify status shows "Active"
3. Wait for Claude Code to complete (exit)
4. Observe status change

**Expected Results**:

- Status transitions: Active → Disconnected
- Termination detected via patterns:
  - Shell prompt reappearance
  - Process exit message
  - Grace period (1 second) before status change
- Visual indicator changes to gray/dimmed
- Termination state persists until next agent start

**Priority**: P1
**Automation**: Partial
**Platform**: All

---

#### 3.6 Security: False Positive Prevention (P0 - Critical)

**Prerequisites**:

- Terminal with no AI agents

**Steps**:

1. Create terminal
2. Test potential false positive scenarios:
   ```bash
   # Should NOT trigger detection
   echo "github copilot is great"
   cat mycopilot.txt
   npm install @claude/sdk
   ls claude-files/
   export GEMINI_API_KEY="test"
   ```
3. Observe status indicator (should remain "None")
4. Test valid detection:
   ```bash
   claude "test command"  # SHOULD trigger
   ```

**Expected Results**:

- False positive tests: Status remains "None"
- Valid command: Status changes to "Connected"
- Regex patterns use word boundaries: `/(^|\s)claude(\s|$)/i`
- Substring matches (vulnerable approach) NOT used
- Security: No code injection via crafted terminal output

**Priority**: P0
**Automation**: Yes
**Platform**: All

---

### 4. WebView Interactions

#### 4.1 Keyboard Input and Special Keys (P0 - Critical)

**Prerequisites**:

- Terminal created and focused

**Steps**:

1. Type alphanumeric text: `hello world`
2. Press Enter
3. Test special keys:
   - Arrow keys (Up/Down for history, Left/Right for cursor)
   - Tab (auto-completion)
   - Ctrl+C (interrupt)
   - Ctrl+D (EOF)
   - Ctrl+L (clear screen)
4. Test keyboard shortcuts:
   - Ctrl+A / Cmd+A (select all)
   - Ctrl+C / Cmd+C (copy when text selected)
   - Ctrl+V / Cmd+V (paste)

**Expected Results**:

- All text appears correctly in terminal
- Special keys behave as expected in shell
- Ctrl+C copies when text selected, sends SIGINT otherwise
- Paste works from clipboard
- No key events lost during high-frequency typing

**Priority**: P0
**Automation**: Yes
**Platform**: All

---

#### 4.2 Alt+Click Cursor Positioning (P1 - Important)

**Prerequisites**:

- Settings: `altClickMovesCursor: true`
- Terminal with multi-line output

**Steps**:

1. Run command to generate output:
   ```bash
   echo "Line 1: First line"
   echo "Line 2: Second line"
   echo "Line 3: Third line"
   ```
2. Hold Alt/Option key
3. Click in middle of "Second" word on Line 2
4. Release Alt/Option
5. Type text
6. Verify cursor position

**Expected Results**:

- Cursor moves to clicked position
- ANSI escape sequences sent to move cursor
- Text inserted at correct position
- Works with both Alt (Windows/Linux) and Option (Mac)
- Disabled when `altClickMovesCursor: false`

**Priority**: P1
**Automation**: Partial (click position calculation complex)
**Platform**: All

---

#### 4.3 IME Composition (Japanese Input) (P1 - Important)

**Prerequisites**:

- Japanese IME enabled on system
- Terminal focused

**Steps**:

1. Switch to Japanese input mode
2. Type romaji: `nihongo` (日本語)
3. Observe composition underline
4. Press Space to select kanji candidates
5. Press Enter to confirm: 日本語
6. Verify final text in terminal

**Expected Results**:

- Composition events handled correctly
- Underline shows during composition (compositionstart)
- Candidate selection works
- Final text committed correctly (compositionend)
- No duplicate characters
- IMEHandler properly manages composition state

**Priority**: P1
**Automation**: No (requires IME)
**Platform**: macOS, Windows (with Japanese IME)

---

#### 4.4 IME Composition (Chinese Input) (P2 - Nice-to-have)

**Prerequisites**:

- Chinese (Simplified or Traditional) IME enabled
- Terminal focused

**Steps**:

1. Switch to Chinese input mode
2. Type pinyin: `zhongwen` (中文)
3. Select characters from candidate window
4. Confirm input
5. Verify text appears correctly

**Expected Results**:

- Composition handled for both Simplified and Traditional Chinese
- Candidate selection works
- Multi-byte characters display correctly
- No encoding issues
- IME state cleared after composition

**Priority**: P2
**Automation**: No (requires IME)
**Platform**: macOS, Windows, Linux (with Chinese IME)

---

#### 4.5 Copy and Paste Functionality (P0 - Critical)

**Prerequisites**:

- Terminal with output

**Steps**:

1. Run command: `echo "Test content for copy-paste"`
2. Select "Test content" with mouse drag
3. Press Ctrl+C / Cmd+C (or right-click → Copy)
4. Verify selection is copied to clipboard
5. Click in terminal to position cursor
6. Press Ctrl+V / Cmd+V (or right-click → Paste)
7. Verify text pasted correctly

**Expected Results**:

- Text selection visible with highlight
- Copy places text in system clipboard
- Paste inserts text at cursor position
- Multi-line copy/paste preserves line breaks
- ANSI escape codes removed from copied text
- Paste works from external applications

**Priority**: P0
**Automation**: Yes
**Platform**: All

---

#### 4.6 Scrolling Behavior (P1 - Important)

**Prerequisites**:

- Terminal with scrollback content

**Steps**:

1. Generate 100 lines of output:
   ```bash
   for i in {1..100}; do echo "Line $i"; done
   ```
2. Test scroll methods:
   - Mouse wheel scroll up/down
   - Scrollbar drag
   - Keyboard: Page Up/Page Down
   - Keyboard: Cmd+Up / Cmd+Down (scroll to command)
3. Run new command while scrolled up
4. Observe auto-scroll behavior

**Expected Results**:

- All scroll methods work smoothly
- Scrollbar position reflects buffer position
- Auto-scroll to bottom when new output appears
- Auto-scroll disabled when user manually scrolls up
- Cmd+Up/Down scrolls to previous/next command (with shell integration)
- Scrollback limit (2000 lines default) enforced

**Priority**: P1
**Automation**: Partial (scroll position verification)
**Platform**: All

---

#### 4.7 ANSI Color Rendering (P1 - Important)

**Prerequisites**:

- Terminal created

**Steps**:

1. Test 16-color ANSI:
   ```bash
   echo -e "\033[31mRed\033[0m \033[32mGreen\033[0m \033[34mBlue\033[0m"
   ```
2. Test 256-color:
   ```bash
   for i in {0..255}; do echo -ne "\033[38;5;${i}m${i} \033[0m"; done
   ```
3. Test true color (24-bit):
   ```bash
   echo -e "\033[38;2;255;100;0mOrange (RGB)\033[0m"
   ```
4. Test text formatting:
   ```bash
   echo -e "\033[1mBold\033[0m \033[3mItalic\033[0m \033[4mUnderline\033[0m"
   ```

**Expected Results**:

- 16 basic colors render correctly
- 256-color palette displays accurately
- True color (RGB) renders correctly
- Bold, italic, underline formatting visible
- Color reset (\033[0m) works
- Settings: `fullANSISupport: true` enables all features

**Priority**: P1
**Automation**: Yes (color detection possible)
**Platform**: All

---

#### 4.8 Theme Changes (P1 - Important)

**Prerequisites**:

- Terminal with content

**Steps**:

1. VS Code theme: Light theme
2. Verify terminal background is light
3. Verify text is dark colored
4. Switch to dark theme (Settings → Color Theme)
5. Verify terminal background is dark
6. Verify text is light colored
7. Switch to high contrast theme
8. Verify high contrast colors applied

**Expected Results**:

- Terminal colors update immediately on theme change
- Background, foreground, cursor colors match theme
- ANSI colors adjusted for theme (light/dark variants)
- No visual artifacts during transition
- UIManager.updateTheme() called on theme change event
- Settings: `theme: "auto"` follows VS Code theme

**Priority**: P1
**Automation**: Yes (theme switching)
**Platform**: All

---

### 5. Configuration Management

#### 5.1 Font Settings (P1 - Important)

**Prerequisites**:

- Terminal created

**Steps**:

1. Open Settings: Secondary Terminal → Font Size
2. Change font size from 12 to 16
3. Verify terminal text size increases
4. Change font family to "Courier New"
5. Verify font family changes
6. Change line height to 1.5
7. Verify line spacing increases

**Expected Results**:

- Font size change applies immediately
- Font family change applies immediately
- Line height adjusts spacing
- Settings persist across VS Code restarts
- Font weight (normal/bold) settings work
- Letter spacing adjustment works

**Priority**: P1
**Automation**: Yes (font rendering verification)
**Platform**: All

---

#### 5.2 Shell Selection (P1 - Important)

**Prerequisites**:

- Multiple shells available (bash, zsh, fish, etc.)

**Steps**:

1. Open Settings: Secondary Terminal → Shell
2. Set shell to `/bin/zsh` (or other available shell)
3. Create new terminal
4. Verify zsh prompt appears
5. Run zsh-specific command
6. Change shell to `/bin/bash`
7. Create another terminal
8. Verify bash prompt appears

**Expected Results**:

- Shell setting applies to new terminals
- Existing terminals unaffected by setting change
- Invalid shell path shows error notification
- Shell args setting works (e.g., `-l` for login shell)
- Platform-specific default shells respected

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 5.3 Max Terminals Limit (P1 - Important)

**Prerequisites**:

- No active terminals

**Steps**:

1. Set `maxTerminals: 3` in settings
2. Create 3 terminals successfully
3. Attempt to create 4th terminal
4. Verify error message: "Maximum 3 terminals reached"
5. Delete one terminal
6. Create new terminal (should succeed)
7. Change setting to `maxTerminals: 5`
8. Create 2 more terminals (should reach 5 total)

**Expected Results**:

- Limit enforced strictly
- Clear error message when limit reached
- Deletion frees up slot for new terminal
- Setting change applies immediately
- Terminal number manager respects limit

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 5.4 Feature Toggles (P2 - Nice-to-have)

**Prerequisites**:

- Extension installed

**Steps**:

1. **Persistent Sessions Toggle**:
   - Set `enablePersistentSessions: false`
   - Create terminal, add content
   - Reload VS Code
   - Verify terminal NOT restored

2. **AI Detection Toggle**:
   - Set `enableCliAgentIntegration: false`
   - Start Claude Code
   - Verify no status indicator appears

3. **Shell Integration Toggle**:
   - Set `enableShellIntegration: false`
   - Create terminal
   - Verify no command markers or working directory tracking

4. **Alt+Click Toggle**:
   - Set `altClickMovesCursor: false`
   - Alt+Click in terminal
   - Verify cursor does NOT move

**Expected Results**:

- Each feature toggle works independently
- Disabling features removes related UI elements
- No errors when features disabled
- Settings persist across sessions

**Priority**: P2
**Automation**: Yes
**Platform**: All

---

### 6. Split Terminal and Layout

#### 6.1 Vertical Split (P1 - Important)

**Prerequisites**:

- One terminal active

**Steps**:

1. Click "Split Terminal" icon (vertical split icon)
2. Verify two terminals visible side-by-side
3. Verify left terminal retains content
4. Verify right terminal is new (empty)
5. Resize VS Code window width
6. Verify both terminals resize proportionally

**Expected Results**:

- Split creates two equal-width terminals
- Original terminal content preserved
- Both terminals independently scrollable
- Splitter bar visible between terminals
- Each terminal has own scrollbar

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 6.2 Horizontal Split (P1 - Important)

**Prerequisites**:

- One terminal active
- Panel location: Bottom

**Steps**:

1. Set `dynamicSplitDirection: true`
2. Set `panelLocation: "panel"` (bottom panel)
3. Click horizontal split icon
4. Verify two terminals stacked vertically
5. Drag splitter bar to resize top/bottom
6. Verify resize works smoothly

**Expected Results**:

- Horizontal split creates stacked layout
- Splitter draggable with mouse
- Minimum height enforced (100px default)
- Both terminals fully functional
- Dynamic split direction respects panel location

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 6.3 Maximum Split Terminals (P2 - Nice-to-have)

**Prerequisites**:

- Settings: `maxSplitTerminals: 3`

**Steps**:

1. Create and split until 3 terminals visible
2. Attempt 4th split
3. Verify warning message
4. Close one terminal
5. Attempt split again (should succeed)

**Expected Results**:

- Maximum 3 terminals in split view
- Error message when limit reached
- Split view reorganizes when terminal closed
- Remaining terminals resize to fill space

**Priority**: P2
**Automation**: Yes
**Platform**: All

---

### 7. Error Handling and Edge Cases

#### 7.1 Invalid Shell Path (P1 - Important)

**Prerequisites**:

- Extension active

**Steps**:

1. Set shell to invalid path: `/invalid/shell/path`
2. Create new terminal
3. Observe error handling

**Expected Results**:

- Error notification shown: "Failed to start terminal: shell not found"
- Terminal creation fails gracefully
- No crash or unhandled exception
- Fallback to system default shell (optional)
- Error logged to Extension Host console

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 7.2 Working Directory Does Not Exist (P1 - Important)

**Prerequisites**:

- Extension active

**Steps**:

1. Set `defaultDirectory: "/nonexistent/path"`
2. Create terminal
3. Observe fallback behavior

**Expected Results**:

- Warning notification shown
- Terminal created with fallback directory (workspace root or home)
- Terminal functional despite invalid directory
- Error logged with details

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 7.3 Rapid Terminal Creation (Race Condition Test) (P1 - Important)

**Prerequisites**:

- No active terminals

**Steps**:

1. Rapidly click "Create Terminal" 5 times in quick succession
2. Wait for all operations to complete
3. Count active terminals

**Expected Results**:

- Exactly 5 terminals created (no duplicates)
- All terminals have unique IDs
- No race condition errors in console
- Operation queue prevents concurrent issues
- `operationQueue` in TerminalManager serializes operations

**Priority**: P1
**Automation**: Yes
**Platform**: All

---

#### 7.4 Memory Leak Prevention (P2 - Nice-to-have)

**Prerequisites**:

- Extension active

**Steps**:

1. Record initial memory usage (Extension Host)
2. Create and delete 20 terminals in sequence
3. Wait 1 minute (allow garbage collection)
4. Record final memory usage
5. Calculate memory delta

**Expected Results**:

- Memory increase < 10MB after 20 create/delete cycles
- Event listeners properly disposed
- No orphaned PTY processes
- `dispose()` methods called for all managers
- Cleanup interval (30 seconds) removes dead references

**Priority**: P2
**Automation**: Partial (memory profiling)
**Platform**: All

---

#### 7.5 Large Output Handling (P2 - Nice-to-have)

**Prerequisites**:

- Terminal created

**Steps**:

1. Generate large output (10MB+):
   ```bash
   cat /dev/urandom | base64 | head -c 10M
   ```
2. Observe terminal responsiveness during output
3. Verify scrollback limit enforced
4. Test scrolling during output

**Expected Results**:

- Terminal remains responsive
- Output buffering prevents UI freeze (16ms flush interval)
- Scrollback limited to 2000 lines (oldest discarded)
- Memory usage stays reasonable
- PerformanceManager batches output efficiently

**Priority**: P2
**Automation**: Yes
**Platform**: All

---

### 8. Cross-Platform Compatibility

#### 8.1 Windows-Specific Features (P1 - Important)

**Prerequisites**:

- Windows OS
- Extension installed

**Steps**:

1. Test PowerShell as default shell
2. Test Command Prompt (cmd.exe)
3. Test Git Bash (if installed)
4. Test WSL integration (if available)
5. Verify keyboard shortcuts (Ctrl-based)

**Expected Results**:

- PowerShell works with proper prompt detection
- cmd.exe works with ANSI support
- Git Bash recognized and functional
- WSL terminals supported
- Windows-specific keyboard shortcuts functional

**Priority**: P1
**Automation**: Yes
**Platform**: Windows only

---

#### 8.2 macOS-Specific Features (P1 - Important)

**Prerequisites**:

- macOS
- Extension installed

**Steps**:

1. Test default shell (zsh on modern macOS)
2. Test bash (legacy shell)
3. Test Command key shortcuts (Cmd+K, Cmd+\)
4. Test Option+Click for Alt+Click
5. Verify Rosetta 2 compatibility (Apple Silicon)

**Expected Results**:

- zsh works with proper prompt
- bash functional
- Cmd shortcuts work (not Ctrl)
- Option+Click moves cursor
- Works on both Intel and Apple Silicon Macs

**Priority**: P1
**Automation**: Yes
**Platform**: macOS only

---

#### 8.3 Linux-Specific Features (P1 - Important)

**Prerequisites**:

- Linux (Ubuntu/Debian/Fedora/Arch)
- Extension installed

**Steps**:

1. Test bash as default shell
2. Test zsh, fish (if installed)
3. Test Ctrl-based keyboard shortcuts
4. Verify different terminal emulators compatibility
5. Test on different desktop environments (GNOME, KDE, XFCE)

**Expected Results**:

- Multiple shells supported
- Ctrl shortcuts functional
- Works across desktop environments
- No X11/Wayland compatibility issues
- Node-pty binaries compatible with distro

**Priority**: P1
**Automation**: Partial
**Platform**: Linux only

---

## Test Execution Guidelines

### Environment Setup

1. **VS Code Installation**:
   - Use latest stable VS Code version
   - Install extension from VSIX file
   - Configure platform-specific settings

2. **Dependencies**:
   - Node.js 18+ installed
   - Playwright Test installed: `npm install -D @playwright/test`
   - Platform-specific shells available

3. **Test Data**:
   - Sample scripts for output generation
   - Mock AI agent simulators (for consistent testing)
   - Test workspace with known file structure

### Automation Strategy

**Playwright Test Setup**:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Terminal operations should be sequential
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'terminal-lifecycle',
      testMatch: '**/terminal-lifecycle.spec.ts',
    },
    {
      name: 'session-persistence',
      testMatch: '**/session-persistence.spec.ts',
    },
    {
      name: 'ai-agent-detection',
      testMatch: '**/ai-agent-detection.spec.ts',
    },
    {
      name: 'webview-interactions',
      testMatch: '**/webview-interactions.spec.ts',
    },
  ],
});
```

**Sample Test Implementation**:

```typescript
// tests/terminal-lifecycle.spec.ts
import { test, expect } from '@playwright/test';
import { VSCodeExtension } from './utils/vscode-helper';

test.describe('Terminal Lifecycle', () => {
  let vscode: VSCodeExtension;

  test.beforeEach(async () => {
    vscode = await VSCodeExtension.launch();
    await vscode.openSecondaryTerminal();
  });

  test.afterEach(async () => {
    await vscode.cleanup();
  });

  test('1.1 Single Terminal Creation', async () => {
    // Create terminal
    const terminal = await vscode.createTerminal();

    // Verify terminal ID
    expect(await terminal.getId()).toBe(1);

    // Verify terminal visible
    expect(await terminal.isVisible()).toBe(true);

    // Verify shell prompt appears
    await expect(terminal.waitForPrompt()).resolves.toBeTruthy();
  });

  test('1.2 Multiple Terminal Creation', async () => {
    const terminals = [];

    // Create 5 terminals
    for (let i = 0; i < 5; i++) {
      terminals.push(await vscode.createTerminal());
    }

    // Verify IDs are 1-5
    const ids = await Promise.all(terminals.map((t) => t.getId()));
    expect(ids).toEqual([1, 2, 3, 4, 5]);

    // Attempt 6th terminal
    await expect(vscode.createTerminal()).rejects.toThrow('Maximum 5 terminals');
  });

  test('1.3 Terminal ID Recycling', async () => {
    // Create 5 terminals
    const terminals = await Promise.all([...Array(5)].map(() => vscode.createTerminal()));

    // Delete terminal 3
    await terminals[2].delete();

    // Create new terminal
    const newTerminal = await vscode.createTerminal();

    // Verify ID is recycled
    expect(await newTerminal.getId()).toBe(3);
  });
});
```

### Test Prioritization

**P0 (Critical)**: Must pass before release

- Terminal creation and deletion
- Basic session save/restore
- AI agent detection (core functionality)
- Keyboard input and copy/paste
- Security: false positive prevention

**P1 (Important)**: Should pass before release

- ID recycling, multi-terminal management
- Scrollback restoration
- Multi-agent scenarios
- IME composition
- Theme changes
- Configuration management

**P2 (Nice-to-have)**: Can be deferred

- Session expiry
- Memory leak testing
- Large output handling
- Advanced configuration scenarios

### Acceptance Criteria

**Release Readiness**:

- All P0 tests pass: 100%
- P1 tests pass: ≥95%
- P2 tests pass: ≥80%
- No critical bugs in backlog
- Manual exploratory testing complete

**Performance Benchmarks**:

- Terminal creation: <500ms
- Session restore (5 terminals): <3 seconds
- AI agent detection: <100ms after output
- Output rendering (1000 lines): <1 second
- Memory usage (5 terminals): <100MB

**Quality Metrics**:

- Code coverage: ≥85%
- No memory leaks detected
- No race conditions in automated tests
- All platforms tested (Windows, macOS, Linux)

---

## Appendix

### A. Test Data Requirements

**Sample Scripts**:

```bash
# generate-output.sh - Large output generation
#!/bin/bash
for i in {1..1000}; do
  echo "Line $i: $(date) - Sample output with timestamp"
done

# test-colors.sh - ANSI color testing
#!/bin/bash
echo -e "\033[31mRed\033[0m \033[32mGreen\033[0m \033[33mYellow\033[0m"
echo -e "\033[1mBold\033[0m \033[3mItalic\033[0m \033[4mUnderline\033[0m"
```

**Mock AI Agent Simulator**:

```javascript
// mock-claude.js - Simulates Claude Code output
const readline = require('readline');

console.log('Claude Code v1.0 (Mock)');
console.log('Type "exit" to quit\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'claude> ',
});

rl.prompt();

rl.on('line', (line) => {
  if (line.trim() === 'exit') {
    process.exit(0);
  }

  console.log(`\033[36mClaude:\033[0m Processing: ${line}`);
  setTimeout(() => {
    console.log('\033[32m✓ Complete\033[0m\n');
    rl.prompt();
  }, 500);
});
```

### B. Known Issues and Workarounds

**Issue**: Ubuntu tests timeout in CI/CD
**Workaround**: Run tests on macOS/Windows, manual Ubuntu testing
**Status**: Known limitation

**Issue**: IME composition tests require manual verification
**Workaround**: Automate key events, manual visual confirmation
**Status**: Partial automation

**Issue**: AI agent detection requires actual CLI tools
**Workaround**: Use mock simulators for consistent testing
**Status**: Mock scripts provided

### C. Related Documentation

- **CLAUDE.md**: Development guidelines and architecture
- **CHANGELOG.md**: Version history and feature additions
- **README.md**: User-facing documentation
- **src/terminals/CLAUDE.md**: Terminal manager implementation guide
- **src/sessions/CLAUDE.md**: Session persistence implementation guide
- **src/webview/CLAUDE.md**: WebView implementation guide

### D. Glossary

- **PTY**: Pseudo-terminal (node-pty process)
- **ANSI**: Escape sequences for text formatting and colors
- **IME**: Input Method Editor (for multi-byte character input)
- **CLI Agent**: AI-powered command-line tools (Claude Code, Copilot, etc.)
- **Scrollback**: Terminal output history buffer
- **WebView**: VS Code's embedded web content view
- **Session Persistence**: Saving/restoring terminal state across restarts

---

**Test Plan Version**: 1.0
**Last Updated**: 2025-01-02
**Author**: VS Code Sidebar Terminal QA Team
**Review Cycle**: Before each major release
