# Spec: Terminal Header Display

## Overview
Ensure AI Agent status is displayed correctly in terminal headers without visual corruption or layout issues.

## MODIFIED Requirements

### Requirement: Header DOM structure integrity
The terminal header must maintain proper DOM structure with all required elements properly nested and styled.

**Context**: HeaderFactory creates header elements but CSS or initialization timing may cause display corruption.

**Rationale**: Users must see clear AI Agent connection status to understand terminal state.

#### Scenario: Header creation with all elements
**Given** a terminal is being created
**When** HeaderFactory.createTerminalHeader() is called
**Then** the returned elements must include:
- `container`: Main header div with proper flexbox layout
- `titleSection`: Terminal name display area
- `statusSection`: AI Agent status display area (initially empty)
- `controlsSection`: Control buttons area
**And** all elements must have proper CSS applied
**And** flexbox layout must prevent text overflow
**And** statusSection must have `minWidth: 0` for proper truncation

#### Scenario: AI Agent status insertion
**Given** a terminal header has been created
**When** HeaderFactory.insertCliAgentStatus() is called with status 'connected' and type 'claude'
**Then** statusSection must contain:
- `statusSpan`: Text showing "AI Agent Connected"
- `indicator`: Colored dot (green for connected, red for disconnected)
**And** statusSpan must have proper text truncation CSS
**And** indicator must have blinking animation when connected
**And** text must use VS Code theme colors

#### Scenario: Header display in single terminal mode
**Given** a terminal is displayed in single mode
**When** the terminal header is rendered
**Then** the header must be visible at the top of the terminal container
**And** AI Agent status must be clearly visible if agent detected
**And** control buttons (split, close) must be properly aligned
**And** no visual corruption or overlapping elements

#### Scenario: Header display in split mode
**Given** multiple terminals are displayed in split mode
**When** terminal headers are rendered
**Then** each header must maintain proper layout
**And** AI Agent status must not overflow into other sections
**And** headers must adapt to reduced available width
**And** text truncation must activate when space is limited

### Requirement: CSS styling consistency
Terminal header styling must use VS Code theme variables and maintain consistent visual appearance.

**Context**: Custom CSS may be missing or overridden by global styles.

**Rationale**: Headers must match VS Code's visual language for professional appearance.

#### Scenario: Theme color application
**Given** a terminal header is created
**When** the header is rendered in the DOM
**Then** background color must use `var(--vscode-tab-activeBackground)`
**And** text color must use `var(--vscode-tab-activeForeground)`
**And** border must use `var(--vscode-tab-border)`
**And** AI Agent status text must use `var(--vscode-descriptionForeground)`

#### Scenario: Dark theme compatibility
**Given** VS Code is using a dark theme
**When** terminal header is displayed
**Then** all colors must be readable against dark background
**And** indicator colors must have sufficient contrast
**And** no white-on-white or black-on-black text

### Requirement: Header initialization timing
Header creation and styling must complete before terminal is displayed to user.

**Context**: Timing issues can cause headers to appear broken initially.

**Rationale**: Users should never see intermediate rendering states or broken layouts.

#### Scenario: Synchronous header creation
**Given** TerminalCreationService.createTerminal() is executing
**When** HeaderFactory.createTerminalHeader() is called
**Then** all DOM elements must be created synchronously
**And** CSS styles must be applied immediately
**And** header must be fully initialized before container is appended to DOM

#### Scenario: No flash of unstyled content
**Given** a terminal container is being appended to DOM
**When** the container becomes visible
**Then** the header must already have all styles applied
**And** no style changes should occur after visibility
**And** AI Agent status area must not cause layout shift when populated

## Validation

### Unit Tests
- Test HeaderFactory.createTerminalHeader() returns all required elements
- Test HeaderFactory.insertCliAgentStatus() creates proper DOM structure
- Test CSS class application and theme variable usage
- Test text truncation behavior with long AI Agent names

### Integration Tests
- Test header rendering in single terminal mode
- Test header rendering in split terminal mode
- Test header appearance with different VS Code themes
- Test AI Agent status updates don't cause layout shifts

### Manual Testing
- Visual inspection of header in light and dark themes
- Verify AI Agent status displays correctly for all agent types
- Test header behavior during panel resize
- Verify no visual corruption in any display mode
