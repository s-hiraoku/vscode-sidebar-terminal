# Terminal Commands - Quick Reference

This guide explains the terminal-related slash commands and agents available in this project.

## Commands Overview

| Command | Purpose | Agents Used | Output |
|---------|---------|-------------|--------|
| `/terminal-research` | Research only | 3 research agents | Research report |
| `/terminal-implement` | Research + Implementation | 3 research + 1 implementation | Working code + tests |

## Available Agents

### Research Agents (Phase 1)

1. **vscode-terminal-resolver**
   - Analyzes VS Code's official terminal source code
   - Provides authoritative implementation patterns
   - Located: `.claude/agents/vscode-terminal-resolver.md`

2. **serena-semantic-search**
   - Searches current codebase semantically using Serena MCP
   - Identifies existing patterns and architecture
   - Located: `.claude/agents/serena-semantic-search.md`

3. **xterm-info-analyzer**
   - Retrieves official xterm.js documentation
   - Provides API references and best practices
   - Located: `.claude/agents/xterm-info-analyzer.md`

### Implementation Agent (Phase 2)

4. **terminal-implementer**
   - Implements features following TDD methodology
   - Uses research findings to guide implementation
   - Ensures code quality and best practices
   - Located: `.claude/agents/terminal-implementer.md`

## Quick Start

### Research a Terminal Feature
```bash
/terminal-research How does VS Code handle IME composition?
```

**What happens:**
1. Launches 3 research agents in parallel
2. Aggregates findings from VS Code, current codebase, and xterm.js
3. Provides comprehensive research report

**Use when:**
- Planning a feature
- Understanding implementation patterns
- Debugging complex issues
- Learning VS Code patterns

### Implement a Terminal Feature
```bash
/terminal-implement Add terminal tab completion support
```

**What happens:**
1. **Phase 1**: Launches 3 research agents in parallel
2. **Phase 2**: Uses research to implement feature with TDD
3. Produces working code with tests

**Use when:**
- Adding new terminal features
- Fixing terminal bugs
- Optimizing performance
- Following VS Code best practices

## Workflow Examples

### Example 1: Simple Feature Addition

```bash
# Command
/terminal-implement Add keyboard shortcut Ctrl+L to clear terminal

# Phase 1: Research (Parallel)
# - vscode-terminal-resolver: Searches VS Code for clear terminal implementation
# - serena-semantic-search: Finds KeybindingManager in codebase
# - xterm-info-analyzer: Gets terminal.clear() API docs

# Phase 2: Implementation
# - terminal-implementer:
#   1. Writes tests for clear functionality
#   2. Implements keyboard shortcut handler
#   3. Integrates with existing KeybindingManager
#   4. Adds dispose handler

# Output:
# - src/managers/KeybindingManager.ts:123 - Added Ctrl+L handler
# - src/test/unit/KeybindingManager.test.ts:45 - Added test coverage
# - All tests passing ✅
```

### Example 2: Performance Optimization

```bash
# Command
/terminal-implement Optimize terminal rendering for AI CLI output

# Phase 1: Research
# - VS Code: Adaptive buffering with requestAnimationFrame
# - Current code: PerformanceManager with 16ms interval
# - Xterm.js: Batch writes for performance

# Phase 2: Implementation
# - Adds adaptive buffering logic
# - Reduces interval to 4ms for CLI agents
# - Tests high-frequency output scenarios

# Output:
# - src/webview/managers/PerformanceManager.ts:67 - Adaptive interval
# - Performance improvement: 60fps → 250fps for AI agents ✅
```

### Example 3: Bug Fix

```bash
# Command
/terminal-implement Fix terminal scrollback restoration after reload

# Phase 1: Research
# - VS Code: Serialization pattern for terminal state
# - Current code: SessionManager stores scrollback
# - Xterm.js: Terminal.write() for restoration

# Phase 2: Implementation
# - Fixes scrollback buffer serialization
# - Adds proper state restoration
# - Tests reload scenarios

# Output:
# - src/services/terminal/SessionManager.ts:234 - Fixed serialization
# - Issue #201 resolved ✅
```

## Command Comparison

### When to use `/terminal-research`

**Pros:**
- Faster (no implementation time)
- Good for planning and understanding
- Provides comprehensive context
- Useful for architectural decisions

**Cons:**
- No code produced
- Manual implementation needed
- Requires follow-up work

**Example scenarios:**
```bash
# Planning phase
/terminal-research What patterns does VS Code use for terminal lifecycle?

# Learning
/terminal-research How does xterm.js handle performance optimization?

# Debugging investigation
/terminal-research How should terminal memory be managed?
```

### When to use `/terminal-implement`

**Pros:**
- Complete solution (research + code)
- TDD compliance guaranteed
- Production-ready implementation
- Immediate testing possible

**Cons:**
- Takes longer (research + implementation)
- May require refinement for complex features
- Consumes more tokens

**Example scenarios:**
```bash
# Feature development
/terminal-implement Add terminal split view support

# Bug fixing
/terminal-implement Fix IME composition duplicate input

# Performance work
/terminal-implement Reduce terminal memory footprint
```

## Agent Invocation Patterns

### Research Phase (Parallel)
```typescript
// Claude will invoke all 3 agents simultaneously:
Task(vscode-terminal-resolver, query)
Task(serena-semantic-search, query)  } Single message,
Task(xterm-info-analyzer, query)     } 3 parallel tasks
```

### Implementation Phase (Sequential)
```typescript
// After research completes:
const research = {
  vscode: await vscode_terminal_resolver_result,
  codebase: await serena_semantic_search_result,
  xterm: await xterm_info_analyzer_result
};

Task(terminal-implementer, { query, research })
```

## Quality Standards

All implementations via `terminal-implementer` must meet:

### ✅ Required Standards
- TDD compliance (Red → Green → Refactor)
- Type safety (no `any` types)
- Dispose handlers for all managers
- Atomic operations for thread safety
- Security patterns (regex over includes())
- Performance optimization
- File:line references in code

### ✅ Testing Requirements
- Unit tests passing
- Integration tests if applicable
- TDD compliance verified
- Edge cases covered

### ✅ Documentation
- Inline comments with VS Code references
- CLAUDE.md updates for architecture changes
- Usage examples provided

## Troubleshooting

### Research agents return no results
**Solution**: Feature might not exist in VS Code or codebase
- Proceed with xterm.js docs and general best practices
- Document in implementation that specific patterns not found

### Type errors after implementation
**Solution**:
```bash
npm run compile  # Check TypeScript errors
# Fix type issues manually or re-run with corrected types
```

### Tests failing
**Solution**:
```bash
npm run test:unit  # Run unit tests
# Review test failures and fix implementation
```

### Performance regression
**Solution**:
```bash
# Profile the change
# Compare buffering intervals
# Check for memory leaks with dispose handlers
```

## Advanced Features

### Chaining Commands
```bash
# Research first, then implement
/terminal-research Terminal session persistence patterns
# Review findings...
/terminal-implement Implement terminal session persistence
```

### Incremental Development
```bash
# Start with core feature
/terminal-implement Add basic terminal split view

# Optimize after testing
/terminal-implement Optimize split view rendering

# Fix issues found
/terminal-implement Fix split view focus management
```

### Pattern Exploration
```bash
# Understand multiple patterns
/terminal-research VS Code terminal process lifecycle
/terminal-research Xterm.js addon system
/terminal-research Terminal performance optimization techniques

# Then implement combining insights
/terminal-implement Refactor terminal lifecycle management
```

## Integration with Development Workflow

### 1. Feature Planning
```bash
/terminal-research <feature concept>
# Review research, refine requirements
```

### 2. Implementation
```bash
/terminal-implement <refined feature>
# Produces working code with tests
```

### 3. Testing
```bash
npm run test:unit     # Verify tests pass
npm run compile       # Check types
npm run lint          # Code quality
```

### 4. Manual Validation
```bash
# Launch VS Code extension
# Test feature manually
# Verify performance
```

### 5. Commit
```bash
git add .
git commit -m "feat: <feature description>"
```

## Best Practices

### Writing Good Queries

**Good (Specific):**
```bash
/terminal-implement Add Ctrl+K shortcut to clear terminal output
/terminal-research How does VS Code handle terminal IME composition events?
```

**Less Effective (Too Broad):**
```bash
/terminal-implement Make terminals better
/terminal-research How do terminals work?
```

### Query Structure
```
/terminal-[command] [Action] + [Specific Component] + [Context]

Examples:
/terminal-implement Add tab completion for terminal commands
/terminal-research How does VS Code restore terminal scrollback after reload?
```

### Leveraging Research
```bash
# Research complex patterns first
/terminal-research VS Code terminal addon architecture

# Then implement with informed decisions
/terminal-implement Add custom terminal addon for link detection
```

## File Locations

```
.claude/
├── commands/
│   ├── terminal-research.md          # Research-only command
│   ├── terminal-implement.md         # Research + Implementation
│   └── TERMINAL_COMMANDS_README.md   # This file
└── agents/
    ├── vscode-terminal-resolver.md   # VS Code patterns
    ├── serena-semantic-search.md     # Codebase search
    ├── xterm-info-analyzer.md        # Xterm.js docs
    └── terminal-implementer.md       # TDD implementation
```

## Getting Help

### Command not working?
```bash
# Check if command exists
ls .claude/commands/terminal-*.md

# Verify agent files
ls .claude/agents/terminal-*.md
ls .claude/agents/vscode-terminal-resolver.md
ls .claude/agents/serena-semantic-search.md
ls .claude/agents/xterm-info-analyzer.md
```

### Need more details?
- See `.claude/commands/TERMINAL_RESEARCH_GUIDE.md` for in-depth research command guide
- See `.claude/agents/terminal-implementer.md` for implementation standards

### Issues or feedback?
- Report at: https://github.com/s-hiraoku/vscode-sidebar-terminal/issues
- Include command used and expected vs actual behavior

## Future Enhancements

Potential additions to the workflow:

1. **Performance Profiling Agent**
   - Benchmark before/after changes
   - Identify performance regressions

2. **Security Audit Agent**
   - Check for common vulnerabilities
   - Validate security patterns

3. **Documentation Generator Agent**
   - Auto-generate API docs
   - Create usage examples

4. **Migration Helper Agent**
   - Assist with VS Code API updates
   - Handle breaking changes

## Summary

- **Quick Research**: `/terminal-research <query>`
- **Full Implementation**: `/terminal-implement <feature>`
- **4 Specialized Agents**: vscode-terminal-resolver, serena-semantic-search, xterm-info-analyzer, terminal-implementer
- **TDD Enforced**: Tests first, then implementation
- **VS Code Patterns**: Authoritative guidance from official source
- **Production Ready**: Quality gates ensure reliable code
