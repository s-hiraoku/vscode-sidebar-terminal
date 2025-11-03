# Investigate WebView Stability Using VS Code Standard Patterns

## Why

During recent debugging, we discovered that WebView terminal initialization has stability issues:

1. **iframe Architecture Discovery**: VS Code wraps WebView content in an iframe (`active-frame`), causing context mismatch between script execution (parent frame) and DOM (child frame)
2. **Initialization Fragility**: `document.getElementById('terminal-body')` fails intermittently, leading to retry loops and unpredictable behavior
3. **Complex Workarounds Failed**: Attempted iframe detection and DOM monkey-patching became too complex and unreliable
4. **Original Code Was Working**: The code was originally functional - complexity arose from attempting to refactor without understanding VS Code's standard patterns

**Key Insight**: We need to investigate how VS Code's official terminal implements WebView initialization to avoid reinventing problematic patterns.

## What Changes

This investigation will use specialized AI agents to:

### 1. Research VS Code Standard Patterns
- **Agent**: `vscode-terminal-resolver`
- **Objective**: Fetch and analyze VS Code's terminal WebView initialization from `microsoft/vscode` repository
- **Focus Areas**:
  - How VS Code handles WebViewViewProvider initialization
  - DOM ready detection and element availability patterns
  - Script loading and execution timing
  - iframe handling (if any) in standard implementation

### 2. Document Current Architecture Issues
- **Agent**: `serena-semantic-search`
- **Objective**: Search our codebase for similar patterns and potential conflicts
- **Focus Areas**:
  - WebView initialization code paths
  - Terminal manager creation and lifecycle
  - Message passing between Extension and WebView
  - Existing workarounds and their effectiveness

### 3. Design Stable Implementation
- **Agent**: `terminal-implementer`
- **Objective**: Implement production-ready code following VS Code patterns
- **Focus Areas**:
  - Proper DOM ready detection
  - Reliable element availability checks
  - Graceful degradation for edge cases
  - Clear error messages for diagnostics

### 4. Create Comprehensive Tests
- **Agent**: `tdd-quality-engineer`
- **Objective**: Prevent regression with thorough testing
- **Focus Areas**:
  - WebView initialization scenarios
  - DOM element availability edge cases
  - Message passing reliability
  - Performance under various conditions

## Impact

### Investigation Outputs
- **Document**: VS Code standard WebView initialization patterns
- **Analysis**: Current implementation gaps and anti-patterns
- **Design**: Proposed stable implementation following VS Code standards
- **Tests**: Comprehensive test suite for WebView stability

### Affected Code (Analysis Phase)
- `src/webview/main.ts`: Entry point initialization logic
- `src/services/webview/WebViewHtmlGenerationService.ts`: HTML generation and script injection
- `src/webview/managers/LightweightTerminalWebviewManager.ts`: Manager initialization
- `src/providers/SecondaryTerminalProvider.ts`: WebViewViewProvider implementation

### Benefits
- **Stability**: Eliminate initialization retry loops and edge cases
- **Maintainability**: Follow proven VS Code patterns instead of custom workarounds
- **Debuggability**: Clear understanding of WebView lifecycle
- **Future-proof**: Align with VS Code's evolution and best practices

### Risks
- **Time Investment**: Agent-based investigation requires setup and validation
- **Breaking Changes Potential**: May discover need for significant refactoring
- **Learning Curve**: Team needs to understand new patterns

### Next Steps After Investigation
1. Review agent findings and recommendations
2. Create implementation proposal based on discoveries
3. Apply changes incrementally with feature flags
4. Monitor stability improvements in production

## Dependencies

### Required Agents
- `vscode-terminal-resolver`: VS Code source code analysis
- `serena-semantic-search`: Codebase pattern search
- `terminal-implementer`: Production code implementation
- `tdd-quality-engineer`: Test creation and validation

### Required Tools
- `/terminal-research`: Research command for VS Code patterns
- Access to microsoft/vscode repository
- VS Code extension development environment
