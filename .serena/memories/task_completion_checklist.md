# Task Completion Checklist

## Mandatory Steps When Task is Completed

### 1. Run All Tests
```bash
npm test  # MUST pass with 100% success rate for modified tests
```

### 2. Check Code Quality
```bash
npm run lint     # MUST have zero errors
npm run format   # Apply consistent formatting
```

### 3. Verify Compilation
```bash
npm run compile       # No TypeScript errors
npm run compile-tests # Test compilation must succeed
```

### 4. TDD Quality Check (if significant changes)
```bash
npm run tdd:check-quality  # Verify TDD compliance
npm run test:coverage      # Check coverage metrics
```

### 5. Update Documentation
- Update CLAUDE.md if architecture changed
- Update inline JSDoc comments
- Update README.md if features added/changed

### 6. Verification Checklist
- [ ] All new code has tests
- [ ] All tests pass
- [ ] No lint errors
- [ ] Code is properly formatted
- [ ] TypeScript compiles without errors
- [ ] No console.log() statements left
- [ ] Proper error handling implemented
- [ ] Resources properly disposed
- [ ] Memory leaks prevented

### 7. Pre-Commit Final Checks
- [ ] Run `npm run pretest` (combines compile + lint + test)
- [ ] Verify no regression in existing functionality
- [ ] Check that all TODOs are addressed or documented

### 8. Critical Areas to Double-Check
- **Interface Changes**: All implementations updated
- **Event Emitters**: Proper disposal implemented
- **Message Protocol**: Extension ↔ WebView sync maintained
- **Terminal State**: TerminalManager remains single source of truth
- **Resource Cleanup**: No memory leaks introduced

## Common Issues to Avoid
- Incomplete renames across files
- Missing test updates for interface changes
- Orphaned event listeners
- Circular dependencies
- Silent failures without error handling

## Special Considerations
- **Session Persistence**: Test VS Code restart scenarios
- **Multi-Terminal**: Test with 5 terminals
- **Platform Testing**: Consider Windows/Mac/Linux differences
- **CLI Agent Integration**: Test with Claude Code and Gemini CLI

Remember: "If it's not tested, it's not working. If it's not working, it's not implemented."