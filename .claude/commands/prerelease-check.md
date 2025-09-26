# Pre-release Checklist for VS Code Sidebar Terminal

This document outlines the comprehensive verification steps to be performed before releasing the VS Code Sidebar Terminal extension.
The primary focus is to ensure build quality, test coverage, and functional correctness.

## Prerequisites

- Node.js >=18.0.0 is installed
- VS Code >=1.74.0 is available for testing
- Project dependencies are installed (`npm install`)
- Clean git working directory

## 1. Development Environment Setup

### 1.1 Initial Setup Verification

```bash
# Verify Node.js version
node --version  # Should be >= 18.0.0

# Install dependencies
npm install

# Verify TypeScript compilation
npm run compile
```

Expected: Clean compilation without errors

### 1.2 Build System Verification

```bash
# Test webpack compilation
npm run compile

# Test production build
npm run package

# Verify output files exist
ls -la dist/extension.js dist/webview.js
```

Expected: Both extension.js and webview.js files are generated successfully

## 2. Code Quality and Standards

### 2.1 Lint Checks

```bash
# Run ESLint checks
npm run lint
```

Expected: Zero lint errors (warnings for TypeScript `any` types are acceptable)

### 2.2 Code Formatting

```bash
# Apply consistent formatting
npm run format

# Verify no files changed after formatting
git status
```

Expected: No unstaged changes after formatting

### 2.3 TypeScript Compilation

```bash
# Compile tests
npm run compile-tests

# Verify out/ directory structure
ls -la out/test/
```

Expected: Complete test compilation without TypeScript errors

## 3. Test Suite Execution

### 3.1 Unit Tests

```bash
# Run core unit tests
npm test

# Run with coverage reporting
npm run test:coverage
```

Expected: 
- Test success rate: ≥93%
- Test coverage: ≥85%
- Total tests: ≥275

### 3.2 Integration Tests

```bash
# Run integration test suite
npm run test:integration
```

Expected: All integration scenarios pass

### 3.3 Performance Tests

```bash
# Run performance test suite
npm run test:performance
```

Expected: Performance benchmarks within acceptable ranges

### 3.4 Comprehensive Test Suite

```bash
# Run all test categories
npm run test:all
```

Expected: Complete test suite execution with acceptable pass rates

## 4. Extension Functionality Testing

### 4.1 Terminal Management

**Test Terminal Creation:**
- Press F5 to launch Extension Development Host
- Open Command Palette (Cmd+Shift+P)
- Search "Focus Terminal" or use Ctrl+`
- Verify terminal appears in sidebar

**Test Multiple Terminals:**
- Create multiple terminals (up to 5)
- Test split terminal functionality
- Verify terminal deletion and cleanup
- Test terminal recycling (numbers 1-5)

### 4.2 Core Features Testing

**Terminal Persistence:**
```bash
# Test session save/restore
# In Extension Development Host:
# 1. Create terminals with command history
# 2. Run: Secondary Terminal: Save Terminal Session
# 3. Restart VS Code
# 4. Verify terminals and history are restored
```

**CLI Agent Integration:**
```bash
# Test CLI Agent detection
# 1. Start Claude Code or Gemini in terminal
# 2. Verify AI Agent toggle button (✨) appears
# 3. Verify status changes (connected/disconnected)
# 4. Test Alt+Click cursor positioning behavior
```

**File Reference Commands:**
```bash
# Test @filename integration (Cmd+Option+L / Ctrl+Alt+L)
# 1. Open a file in editor
# 2. Press Cmd+Option+L (Mac) or Ctrl+Alt+L (Windows/Linux)
# 3. Verify @filename is sent to terminal

# Test GitHub Copilot integration (Cmd+K Cmd+C)
# 1. Open a file in editor
# 2. Press Cmd+K Cmd+C
# 3. Verify Copilot Chat opens with #file: reference
```

### 4.3 Alt+Click Cursor Positioning

```bash
# Test Alt+Click functionality
# 1. Enable: terminal.integrated.altClickMovesCursor = true
# 2. Enable: editor.multiCursorModifier = "alt"
# 3. Hold Alt and click in terminal
# 4. Verify cursor moves to click position
# 5. Test during CLI Agent execution (should be disabled)
```

## 5. Platform-Specific Testing

### 5.1 Cross-Platform Build Testing

```bash
# Test platform-specific builds
npm run vsce:package:darwin-x64    # macOS Intel
npm run vsce:package:darwin-arm64  # macOS Apple Silicon
npm run vsce:package:linux-x64     # Linux 64-bit
npm run vsce:package:win32-x64     # Windows 64-bit

# Verify VSIX packages are created
ls -la *.vsix
```

Expected: Platform-specific VSIX packages with correct native dependencies

### 5.2 Node-pty Integration

```bash
# Verify native module compilation
npm rebuild

# Test terminal process creation
# (This is tested through functional testing above)
```

Expected: Native module compiles for target platform

## 6. Configuration and Settings

### 6.1 Settings Schema Validation

```bash
# Verify package.json configuration schema
# Check that all settings have proper:
# - type definitions
# - default values
# - descriptions
# - enum constraints where applicable
```

### 6.2 Settings Integration Testing

**Test Core Settings:**
- `secondaryTerminal.maxTerminals` (1-5 range)
- `secondaryTerminal.enablePersistentSessions`
- `secondaryTerminal.enableCliAgentIntegration`
- `secondaryTerminal.altClickMovesCursor`
- Font family, size, and terminal appearance settings

## 7. Error Handling and Edge Cases

### 7.1 Error Scenarios

**Test Error Conditions:**
- Invalid shell configuration
- Terminal process crashes
- WebView communication failures
- Persistent session corruption

**Test Resource Limits:**
- Maximum terminal count (5)
- Large terminal output handling
- Memory usage under load
- Terminal deletion edge cases

### 7.2 Recovery Testing

**Test Recovery Mechanisms:**
- Extension reload after crash
- Terminal recovery after VS Code restart
- Corrupted session data handling
- Network communication failures

## 8. Performance and Resource Usage

### 8.1 Performance Benchmarks

```bash
# Run performance tests
npm run test:performance

# Monitor resource usage during:
# - Multiple terminal creation
# - Large output processing
# - CLI Agent detection
# - Session save/restore operations
```

Expected: Acceptable memory usage and CPU performance

### 8.2 Memory Leak Testing

**Test for Memory Leaks:**
- Create and destroy multiple terminals
- Switch between terminals frequently
- Monitor extension host memory usage
- Test WebView disposal

## 9. Release Preparation

### 9.1 Version Management

```bash
# Update version and create release
npm run release:patch   # For patch releases
npm run release:minor   # For minor releases  
npm run release:major   # For major releases
```

Expected: Version updated, git tag created, release notes generated

### 9.2 VSIX Package Validation

```bash
# Create final release package
npm run vsce:package

# Install and test the VSIX package
code --install-extension vscode-sidebar-terminal-X.X.X.vsix

# Test installed extension functionality
# (Repeat core functionality tests above)
```

Expected: VSIX installs correctly and all features work as expected

## 10. Documentation and Release Notes

### 10.1 Release Notes Generation

Generate comprehensive release notes including:
- New features and enhancements
- Bug fixes and improvements
- Breaking changes (if any)
- Migration guidance
- Known issues

### 10.2 Documentation Updates

Update relevant documentation:
- README.md features and installation
- CHANGELOG.md with version history
- Package.json description and keywords
- Extension manifest and contribution points

## Pre-release Quality Gates

### ✅ Must Pass Before Release

- [ ] **Build Quality**: Clean compilation, zero lint errors
- [ ] **Test Coverage**: ≥85% coverage, ≥93% test success rate
- [ ] **Functional Testing**: All core features working
- [ ] **Platform Testing**: VSIX packages for all supported platforms
- [ ] **Performance**: Acceptable resource usage benchmarks
- [ ] **Error Handling**: Graceful failure and recovery mechanisms
- [ ] **Documentation**: Updated release notes and documentation

### ❌ Release Blockers

- TypeScript compilation errors
- Critical test failures (>7% failure rate)
- Memory leaks or resource issues
- Core functionality regressions
- Platform-specific build failures
- Security vulnerabilities

## Testing Environment

**Development Testing:**
- VS Code Extension Development Host (F5)
- VS Code Developer Tools (Ctrl+Shift+I) for WebView debugging
- Terminal functionality in real development workflows

**Production Testing:**
- Installed VSIX package testing
- Fresh VS Code installation testing
- Cross-platform validation
- Performance benchmarking under load

## Notes and Best Practices

- **Test-Driven Development**: All features must have corresponding tests
- **Backward Compatibility**: Ensure settings and functionality remain compatible
- **Resource Management**: Proper cleanup of terminals, event listeners, and resources
- **Error Recovery**: Graceful handling of all error conditions
- **User Experience**: Maintain VS Code standard terminal behavior and UX patterns

## Last Updated

This checklist was last updated for version 0.1.87+ and should be reviewed with each major feature addition or architectural change.

---

**Remember**: Taking shortcuts in pre-release testing leads to technical debt and user issues. Complete all verification steps thoroughly before release.
