# Terminal Restoration Function Test Guide

## 📋 Overview
This guide provides comprehensive steps to verify the terminal session restoration functionality in the VS Code Secondary Terminal Extension.

## 🔧 1. Development Environment Setup

### Build and Launch Extension

```bash
# Navigate to project root
cd /Volumes/SSD/development/workspace/vscode-sidebar-terminal/vscode-sidebar-terminal

# Install dependencies
npm install

# Build the extension
npm run compile

# Optional: Enable watch mode for development
npm run watch
```

### Launch Extension Development Host

1. **Open VS Code** with the extension project
2. **Press F5** to launch Extension Development Host
3. **Open Developer Console**:
   - `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
   - Go to Console tab to monitor logs

### Verify Extension Loading

Check the console for initialization logs:
```
[Extension] Secondary Terminal extension activated
[EXTENSION] TerminalManager initialized
[PERSISTENCE] StandardSessionManager initialized
```

## 🧪 2. Core Restoration Test Scenarios

### Test Scenario 1: Basic Session Restoration

#### Step 1: Create Terminal and Add Content
1. **Open Secondary Terminal Panel**:
   - Click the Terminal icon in Activity Bar
   - Or use Command Palette: `Secondary Terminal: Focus Terminal`

2. **Create Terminal Content**:
   ```bash
   # Create some command history
   echo "Test session restoration - $(date)"
   pwd
   ls -la
   echo "This content should be restored"
   ```

3. **Verify Data is Present**:
   - Scroll through terminal to see all output
   - Note the terminal name/ID in the header

#### Step 2: Trigger Session Save
1. **Manual Save** (if available):
   - Command Palette: `Secondary Terminal: Save Terminal Session`

2. **Automatic Save Verification**:
   - Check console logs for save events:
   ```
   [EXTENSION] Terminal created - immediate save: Terminal 1
   [PERSISTENCE] Session saved successfully: 1 terminals
   ```

#### Step 3: Restart VS Code
1. **Close VS Code completely** (`Cmd+Q` on Mac, `Alt+F4` on Windows/Linux)
2. **Reopen VS Code** with the same workspace
3. **Launch Extension Development Host again** (F5)

#### Step 4: Verify Restoration
1. **Check Terminal Panel**:
   - Terminal should automatically appear
   - Previous content should be visible

2. **Console Log Verification**:
   ```
   [PERSISTENCE] Restoration started for 1 terminals
   [PERSISTENCE] Session restore completed: 1 restored, 0 skipped
   ```

### Test Scenario 2: Multiple Terminal Restoration

#### Create Multiple Terminals
1. **Create 3-4 terminals** with different content:
   ```bash
   # Terminal 1
   echo "Terminal 1 content"
   npm --version

   # Terminal 2 (new split)
   echo "Terminal 2 content"  
   node --version

   # Terminal 3
   echo "Terminal 3 content"
   git --version
   ```

2. **Use Split Functionality**:
   - Click split button in terminal header
   - Or use keybinding: `Cmd+\` (Mac) or `Ctrl+Shift+5`

#### Verify Multi-Terminal Restoration
1. **Restart VS Code**
2. **Check all terminals are restored**:
   - Correct number of terminals
   - Each terminal has its content
   - Split layout preserved

### Test Scenario 3: Edge Case Testing

#### Empty Terminal Handling
1. **Create empty terminal** (no commands executed)
2. **Restart VS Code**
3. **Verify behavior**: Should restore terminal structure even if empty

#### Long Content Testing  
1. **Generate long output**:
   ```bash
   # Generate lots of content
   for i in {1..50}; do echo "Line $i - testing scrollback restoration"; done
   ```
2. **Test scrollback restoration**: Previous content should be scrollable

#### Error Content Testing
1. **Create error output**:
   ```bash
   # Generate error output
   ls /nonexistent/directory
   grep "nonexistent" /nonexistent/file
   ```
2. **Verify error content is restored**

## 🔍 3. Debug and Monitoring Points

### Extension Host Console Logs

Monitor these key log patterns:

#### Initialization Logs
```
[EXTENSION] Extension activated
[PERSISTENCE] StandardSessionManager initialized
[TERMINAL-MANAGER] TerminalManager initialized with max 5 terminals
```

#### Session Save Logs  
```
[EXTENSION] Terminal created - immediate save: Terminal 1
[PERSISTENCE] Saving session with 1 terminals
[PERSISTENCE] Session saved successfully: 1 terminals
```

#### Session Restore Logs
```
[PERSISTENCE] Attempting to restore 1 saved terminals
[PERSISTENCE] Restoration started for 1 terminals  
[WEBVIEW] Session restore message received for Terminal 1
[PERSISTENCE] Session restore completed: 1 restored, 0 skipped
```

### WebView Console Logs

**Access WebView Console**:
1. Right-click in terminal area
2. Select "Inspect Element"
3. Check Console tab

Expected WebView logs:
```
[WEBVIEW] TerminalWebviewManager initialized
[WEBVIEW] Session restore message received
[WEBVIEW] Created terminal for session restore: terminal-1234
[WEBVIEW] Restored scrollback for terminal: terminal-1234
```

### VS Code Storage Inspector

**Check Persistent Storage**:
1. Open Command Palette
2. Search: `Developer: Reload Window With Extensions Disabled`
3. Check if data persists across reloads

## 🚨 4. Troubleshooting Guide

### Common Issues and Solutions

#### Issue: No Terminals Restored
**Symptoms**: VS Code restarts but no terminals appear

**Debug Steps**:
1. **Check Storage Permissions**:
   ```bash
   # Check VS Code has write permissions
   ls -la ~/.vscode/extensions/
   ```

2. **Verify Extension Activation**:
   - Look for activation logs in console
   - Check if extension icon appears in Activity Bar

3. **Check Configuration**:
   ```json
   // In VS Code settings.json
   "secondaryTerminal.enablePersistentSessions": true,
   "secondaryTerminal.persistentSessionReviveProcess": "onExitAndWindowClose"
   ```

**Solution**:
- Ensure extension is properly activated
- Verify storage permissions
- Check settings configuration

#### Issue: Partial Content Restoration
**Symptoms**: Terminal restored but content is incomplete

**Debug Steps**:
1. **Check Scrollback Settings**:
   ```json
   "secondaryTerminal.persistentSessionScrollback": 100,
   "secondaryTerminal.scrollbackLines": 1000
   ```

2. **Monitor Buffer Extraction**:
   - Look for buffer extraction logs in WebView console
   - Check for memory or size limitations

**Solution**:
- Increase scrollback buffer size
- Check for content truncation settings

#### Issue: Performance Problems
**Symptoms**: Slow restoration or VS Code freezes

**Debug Steps**:
1. **Check Terminal Count**:
   ```json
   "secondaryTerminal.maxTerminals": 5
   ```

2. **Monitor Memory Usage**: 
   - Use VS Code Developer Tools
   - Check for memory leaks

**Solution**:
- Reduce max terminal count
- Clear corrupted sessions: `Secondary Terminal: Clear Corrupted Terminal History`

### Error Log Analysis

#### Critical Errors
```
[PERSISTENCE] Failed to restore terminal session: Error details
[EXTENSION] Terminal restore error: Terminal 1 - Unknown error
```

#### Warning Signs
```
[PERSISTENCE] Session restore skipped: Invalid data format
[WEBVIEW] restoreTerminalScrollback method not found
```

## 📊 5. Quality Verification Checklist

### ✅ Pre-Test Checklist
- [ ] Extension compiled without errors
- [ ] All dependencies installed
- [ ] VS Code Development Host launched
- [ ] Developer Console accessible

### ✅ Functionality Tests
- [ ] Single terminal creates and restores correctly
- [ ] Multiple terminals restore with proper content
- [ ] Split terminal layout preserved
- [ ] Command history maintained
- [ ] Scrollback content accessible
- [ ] Error outputs preserved

### ✅ Edge Case Tests  
- [ ] Empty terminals handled gracefully
- [ ] Large content buffers work correctly
- [ ] Mixed content types (text, errors, colors) preserved
- [ ] Special characters and Unicode supported

### ✅ Performance Tests
- [ ] Restoration completes within 5 seconds
- [ ] No memory leaks detected
- [ ] Multiple restart cycles work correctly
- [ ] Large session data handled efficiently

## 🔧 6. Advanced Testing

### Automated Test Execution

```bash
# Run test suites
npm run test:unit
npm run test:integration  
npm run test:performance

# Generate coverage report
npm run test:coverage
```

### Manual Stress Testing

1. **Heavy Load Test**:
   ```bash
   # Generate extensive content
   for i in {1..1000}; do echo "Stress test line $i"; done
   ```

2. **Rapid Creation/Destruction**:
   - Quickly create and close terminals
   - Test restoration stability

3. **Long-Running Sessions**:
   - Keep terminals open for extended periods
   - Test persistence across multiple VS Code sessions

## 🎯 7. Success Criteria

The restoration functionality passes if:

1. **Reliability**: 95%+ successful restoration rate
2. **Performance**: Restoration completes within 5 seconds
3. **Data Integrity**: All terminal content preserved accurately  
4. **User Experience**: Seamless restore without user intervention
5. **Error Handling**: Graceful fallback when restoration fails

## 📝 8. Test Documentation

### Test Results Template

```markdown
## Test Session: [Date/Time]

### Environment
- VS Code Version: [version]
- Extension Version: [version]
- Operating System: [OS details]

### Test Results
| Test Scenario | Status | Notes |
|---------------|--------|-------|
| Basic Restoration | ✅/❌ | [details] |
| Multiple Terminals | ✅/❌ | [details] |
| Edge Cases | ✅/❌ | [details] |

### Performance Metrics
- Restoration Time: [seconds]
- Memory Usage: [MB]
- Success Rate: [%]

### Issues Found
[List any issues with reproduction steps]
```

## 🚀 9. Next Steps After Testing

Based on test results, consider:

1. **Performance Optimizations**:
   - Buffer compression improvements
   - Lazy loading implementation
   - Progressive restoration

2. **Feature Enhancements**:
   - Session naming and management
   - Selective restoration options
   - Export/import functionality

3. **Reliability Improvements**:
   - Better error recovery
   - Data validation enhancements
   - Backup/fallback mechanisms

---

This comprehensive test guide ensures thorough validation of the terminal restoration functionality. Follow each section systematically to identify issues and verify proper operation.