# Agent Workflows: Best Practices for VS Code Sidebar Terminal Development

This guide provides reusable Agent workflows and patterns for efficient development in the VS Code Sidebar Terminal extension.

## Table of Contents

1. [Overview](#overview)
2. [Available Agents](#available-agents)
3. [Common Workflows](#common-workflows)
4. [Agent Selection Guide](#agent-selection-guide)
5. [Parallel Execution Patterns](#parallel-execution-patterns)
6. [Project-Specific Patterns](#project-specific-patterns)
7. [Performance Tips](#performance-tips)
8. [Troubleshooting](#troubleshooting)

## Overview

### What are Agents?

Agents are specialized AI assistants designed for specific development tasks. They have deep expertise in particular domains and follow established patterns for consistent, high-quality results.

### Why Use Agents?

- **Consistency**: Follow proven architectural patterns
- **Efficiency**: Parallel execution reduces development time
- **Quality**: Built-in testing and validation
- **Maintainability**: Code adheres to project standards
- **Knowledge**: Access to VS Code source code and best practices

### Agent Types

- **Research Agents**: Gather information and analyze patterns
- **Implementation Agents**: Write production-ready code
- **Quality Assurance Agents**: Create tests and validate quality
- **Refactoring Agents**: Improve code structure and patterns

## Available Agents

### Research & Analysis

| Agent | Purpose | Use When |
|-------|---------|----------|
| `vscode-terminal-resolver` | VS Code source code analysis | Need authoritative terminal implementation patterns |
| `serena-semantic-search` | Semantic code search | Finding similar patterns in codebase |
| `xterm-info-analyzer` | Xterm.js documentation | Terminal rendering and API questions |
| `Explore` | Fast codebase exploration | Quick file/pattern discovery |

### Implementation

| Agent | Purpose | Use When |
|-------|---------|----------|
| `terminal-implementer` | Production terminal code | Implementing terminal features |
| `lsmc-coding-agent` | Language server features | Working with LSP/MCP protocols |
| `general-purpose` | Complex multi-step tasks | Tasks not covered by specialized agents |

### Quality & Testing

| Agent | Purpose | Use When |
|-------|---------|----------|
| `tdd-quality-engineer` | TDD test creation | Need comprehensive test coverage |
| `playwright-test-generator` | E2E browser tests | Testing WebView UI |
| `playwright-test-healer` | Fix failing tests | Tests broken after changes |
| `playwright-test-planner` | Test planning | Planning comprehensive test scenarios |

### Refactoring

| Agent | Purpose | Use When |
|-------|---------|----------|
| `similarity-based-refactoring` | Pattern consolidation | Finding duplicate code patterns |
| `serena-mcp-refactoring` | Structural improvements | Improving code architecture |

### Meta-Agents

| Agent | Purpose | Use When |
|-------|---------|----------|
| `webview-stability-investigator` | WebView issue investigation | WebView stability problems |

## Common Workflows

### Workflow 1: New Feature Implementation

**Scenario**: Implementing a new terminal feature (e.g., custom keyboard shortcuts)

```bash
# Step 1: Research VS Code patterns (15 min)
Task(vscode-terminal-resolver): "How does VS Code implement custom keyboard shortcuts in the integrated terminal? Focus on key binding registration and handler implementation."

# Step 2: Search existing implementations (10 min)
Task(serena-semantic-search): "Find keyboard shortcut handling patterns in the codebase, focusing on InputManager and keyboard event handling."

# Step 3: Implement feature (45 min)
Task(terminal-implementer): "Implement custom keyboard shortcuts following VS Code patterns [paste research findings], integrating with InputManager in src/webview/managers/InputManager.ts."

# Step 4: Create tests (30 min)
Task(tdd-quality-engineer): "Create comprehensive test suite for custom keyboard shortcuts, covering all key combinations and edge cases."
```

**Total Time**: ~100 minutes
**Parallel Opportunity**: Steps 1 & 2 can run simultaneously (~15 min instead of 25 min)

### Workflow 2: Bug Investigation & Fix

**Scenario**: Terminal output is corrupted with specific characters

```bash
# Step 1: Research solution (parallel execution)
Task(vscode-terminal-resolver): "How does VS Code handle character encoding in terminal output? Focus on UTF-8, emoji, and CJK character handling."
Task(serena-semantic-search): "Find character encoding and output handling in PerformanceManager and terminal rendering code."

# Step 2: Identify root cause (10 min)
# Manually analyze findings

# Step 3: Implement fix (30 min)
Task(terminal-implementer): "Fix character encoding issue in PerformanceManager based on VS Code pattern [paste findings]."

# Step 4: Create regression tests (20 min)
Task(tdd-quality-engineer): "Create regression tests for character encoding, covering UTF-8, emoji, and CJK characters."
```

**Total Time**: ~75 minutes
**Parallel Savings**: ~10 minutes

### Workflow 3: Performance Optimization

**Scenario**: Terminal output is slow with high-frequency updates

```bash
# Step 1: Research patterns (parallel)
Task(vscode-terminal-resolver): "How does VS Code optimize terminal output buffering and rendering performance?"
Task(xterm-info-analyzer): "What are xterm.js best practices for high-frequency output optimization?"

# Step 2: Analyze current implementation (15 min)
Task(serena-semantic-search): "Find output buffering and performance optimization patterns in PerformanceManager and related code."

# Step 3: Identify bottlenecks (15 min)
# Use VS Code DevTools and profiling

# Step 4: Implement optimizations (45 min)
Task(terminal-implementer): "Optimize output buffering in PerformanceManager following VS Code patterns [paste findings], maintaining 60fps target."

# Step 5: Performance tests (25 min)
Task(tdd-quality-engineer): "Create performance tests for output buffering, including high-frequency scenarios and benchmarks."
```

**Total Time**: ~115 minutes
**Parallel Savings**: ~15 minutes

### Workflow 4: Code Refactoring

**Scenario**: Clean up duplicate initialization code

```bash
# Step 1: Identify duplication (20 min)
Task(similarity-based-refactoring): "Analyze terminal initialization code for duplicate patterns across managers in src/webview/managers/ and src/terminals/."

# Step 2: Plan consolidation (15 min)
# Review agent recommendations and plan strategy

# Step 3: Research patterns (15 min)
Task(vscode-terminal-resolver): "How does VS Code structure terminal initialization to avoid duplication?"

# Step 4: Refactor code (60 min)
Task(terminal-implementer): "Refactor terminal initialization following similarity-based-refactoring recommendations [paste findings], consolidating duplicate code."

# Step 5: Validate with tests (25 min)
Task(tdd-quality-engineer): "Ensure test coverage for refactored initialization code, verifying no regression."
```

**Total Time**: ~135 minutes

### Workflow 5: WebView Stability Investigation

**Scenario**: WebView fails to initialize intermittently

```bash
# Option A: Use meta-agent (recommended)
Task(webview-stability-investigator): "Investigate WebView initialization failures, focusing on DOM ready detection and element availability."

# Option B: Manual execution (for fine-grained control)
# See openspec/changes/investigate-webview-stability/AGENT_GUIDE.md
```

**Total Time**: ~125 minutes (with parallel execution)

## Agent Selection Guide

### Decision Tree

```
What is your task?
│
├─ Implementing terminal feature?
│  ├─ Need VS Code patterns? → vscode-terminal-resolver
│  ├─ Search existing code? → serena-semantic-search
│  ├─ Xterm.js questions? → xterm-info-analyzer
│  └─ Ready to implement? → terminal-implementer
│
├─ Investigating bug?
│  ├─ Terminal-specific? → vscode-terminal-resolver + serena-semantic-search
│  ├─ WebView-related? → webview-stability-investigator
│  └─ General investigation? → Explore
│
├─ Refactoring code?
│  ├─ Find duplicates? → similarity-based-refactoring
│  ├─ Improve structure? → serena-mcp-refactoring
│  └─ Semantic search? → serena-semantic-search
│
├─ Writing tests?
│  ├─ Unit/integration? → tdd-quality-engineer
│  ├─ E2E tests? → playwright-test-generator
│  ├─ Fix failing tests? → playwright-test-healer
│  └─ Plan test coverage? → playwright-test-planner
│
└─ Complex multi-step task?
   └─ general-purpose
```

### When to Use Multiple Agents

**Parallel Execution** (Fastest):
- Independent research tasks
- Multiple testing strategies
- Simultaneous analysis from different perspectives

**Sequential Execution** (Most Common):
- Research → Implementation → Testing
- Analysis → Refactoring → Validation
- Investigation → Fix → Regression tests

**Combined Approach** (Most Efficient):
- Parallel research + Sequential implementation
- Parallel testing + Sequential validation

## Parallel Execution Patterns

### Pattern 1: Multi-Source Research

Execute multiple research agents simultaneously:

```bash
# Single message with multiple Task calls:
Task(vscode-terminal-resolver): "Research VS Code pattern for [feature]"
Task(serena-semantic-search): "Search codebase for [feature] implementations"
Task(xterm-info-analyzer): "Get xterm.js best practices for [feature]"
```

**Time Saved**: 60-70%
**Best For**: Initial research phase

### Pattern 2: Parallel Testing

Execute multiple testing agents simultaneously:

```bash
# Single message with multiple Task calls:
Task(tdd-quality-engineer): "Create unit tests for [feature]"
Task(playwright-test-generator): "Create E2E tests for [feature]"
```

**Time Saved**: ~50%
**Best For**: Quality assurance phase

### Pattern 3: Analysis + Search

Combine different analysis approaches:

```bash
# Single message with multiple Task calls:
Task(serena-semantic-search): "Find [pattern] implementations"
Task(similarity-based-refactoring): "Identify duplicate [pattern] code"
```

**Time Saved**: ~40%
**Best For**: Refactoring preparation

### Common Mistakes

❌ **Don't do this** (Sequential when parallel is possible):
```bash
# Slow - each task waits for previous
Task(vscode-terminal-resolver): "Research..."
# Wait for completion...
Task(serena-semantic-search): "Search..."
# Wait for completion...
Task(xterm-info-analyzer): "Get docs..."
```

✅ **Do this instead** (Parallel execution):
```bash
# Fast - all execute simultaneously
Task(vscode-terminal-resolver): "Research..."
Task(serena-semantic-search): "Search..."
Task(xterm-info-analyzer): "Get docs..."
```

## Project-Specific Patterns

### Pattern: Terminal Manager Integration

When implementing features that integrate with TerminalManager:

1. **Research**: `vscode-terminal-resolver` for VS Code lifecycle patterns
2. **Search**: `serena-semantic-search` for existing TerminalManager usage
3. **Implement**: `terminal-implementer` following atomic operation patterns
4. **Test**: `tdd-quality-engineer` for lifecycle scenarios

**Critical Considerations**:
- ID recycling (1-5)
- Atomic operations
- Dispose handlers
- Session persistence

### Pattern: WebView Manager Feature

When implementing features in WebView managers:

1. **Research**: `vscode-terminal-resolver` + `xterm-info-analyzer` (parallel)
2. **Search**: `serena-semantic-search` for Manager-Coordinator pattern
3. **Implement**: `terminal-implementer` following Manager pattern
4. **Test**: `tdd-quality-engineer` + `playwright-test-generator` (parallel)

**Critical Considerations**:
- Manager-Coordinator pattern
- Message passing
- DOM manipulation
- Performance buffering

### Pattern: IME/Input Handling

When implementing keyboard or IME features:

1. **Research**: `vscode-terminal-resolver` for VS Code input handling
2. **Search**: `serena-semantic-search` for InputManager patterns
3. **Xterm**: `xterm-info-analyzer` for xterm.js input API
4. **Implement**: `terminal-implementer` with IME considerations
5. **Test**: `tdd-quality-engineer` for composition events

**Critical Considerations**:
- Composition events
- Key binding conflicts
- Platform differences (Windows/macOS/Linux)
- CJK character handling

### Pattern: Performance Optimization

When optimizing terminal performance:

1. **Benchmark**: Manual profiling with VS Code DevTools
2. **Research**: `vscode-terminal-resolver` (parallel) + `xterm-info-analyzer` (parallel)
3. **Analyze**: `serena-semantic-search` for current bottlenecks
4. **Implement**: `terminal-implementer` with performance metrics
5. **Validate**: `tdd-quality-engineer` for performance tests

**Critical Considerations**:
- Buffer flush intervals (16ms = 60fps)
- CLI agent detection (4ms = 250fps)
- Session save interval (5 minutes)
- Scrollback limits (2000 lines)

## Performance Tips

### Optimize Agent Prompts

**Bad Prompt** (Vague):
```
"Help me with terminal stuff"
```

**Good Prompt** (Specific):
```
"How does VS Code implement terminal process lifecycle management, specifically focusing on creation, disposal, and cleanup in TerminalProcessManager (src/vs/workbench/contrib/terminal/node/)? Provide file:line references."
```

### Provide Context

Always include:
- Specific files or directories
- Current problem/requirement
- Relevant research findings (for implementation agents)
- Expected output format

### Use Agent Strengths

Match task to agent expertise:
- Terminal patterns → `vscode-terminal-resolver`
- Semantic search → `serena-semantic-search`
- Implementation → `terminal-implementer`
- Testing → `tdd-quality-engineer`

### Maximize Parallelism

Identify independent tasks and run agents simultaneously:
- Research agents (usually parallel)
- Testing agents (usually parallel)
- Analysis agents (sometimes parallel)

## Troubleshooting

### Problem: Agent Returns Incomplete Results

**Symptoms**:
- Missing file references
- Vague recommendations
- Incomplete code snippets

**Solutions**:
1. **Increase specificity**: Provide more detailed prompts
2. **Narrow scope**: Break complex queries into smaller parts
3. **Provide context**: Include relevant file paths and code
4. **Re-run**: Sometimes agents need a second attempt

### Problem: Conflicting Agent Recommendations

**Symptoms**:
- Different agents suggest different approaches
- Unclear which pattern to follow

**Solutions**:
1. **Prioritize sources**:
   - VS Code patterns (most authoritative)
   - Xterm.js official docs
   - Project-specific constraints
2. **Synthesize**: Combine best aspects of each recommendation
3. **Document decision**: Explain rationale in comments

### Problem: Slow Agent Execution

**Symptoms**:
- Agents take longer than expected
- Timeout errors

**Solutions**:
1. **Run in parallel**: Use simultaneous execution
2. **Reduce scope**: Limit files/directories to search
3. **Simplify query**: Break into multiple focused tasks
4. **Check system load**: Ensure adequate resources

### Problem: Implementation Doesn't Match Project Patterns

**Symptoms**:
- Generated code violates architecture
- TypeScript errors
- Test failures

**Solutions**:
1. **Review CLAUDE.md**: Ensure agent understands project patterns
2. **Provide examples**: Show existing code that follows patterns
3. **Manual adaptation**: Adjust agent output to fit architecture
4. **Use terminal-implementer**: Specialized for this project

### Problem: Tests Fail After Implementation

**Symptoms**:
- Unit tests fail
- Integration tests fail
- TDD compliance issues

**Solutions**:
1. **Review TDD workflow**: Ensure Red → Green → Refactor
2. **Check atomic operations**: Verify no race conditions
3. **Validate dispose handlers**: Ensure cleanup implemented
4. **Use tdd-quality-engineer**: Let agent fix tests

## Measuring Success

### Metrics to Track

1. **Development Time**:
   - With agents vs. without agents
   - Parallel vs. sequential execution

2. **Code Quality**:
   - Test coverage percentage
   - TDD compliance rate
   - Pattern adherence score

3. **Agent Effectiveness**:
   - Success rate of agent recommendations
   - Time saved through parallel execution
   - Re-work required after agent output

### Continuous Improvement

1. **Document patterns**: Add successful workflows to this guide
2. **Share learnings**: Update team on effective agent usage
3. **Refine prompts**: Iterate on prompts for better results
4. **Track time**: Measure actual vs. estimated time savings

## Examples from the Project

### Example 1: AI Agent Detection Feature

**Implementation**: `src/webview/managers/cli-agent-detector.ts`

**Agent Workflow Used**:
1. Research: VS Code terminal detection patterns
2. Search: Existing detection code in codebase
3. Implement: Following security patterns (regex not includes())
4. Test: Comprehensive unit tests with TDD

**Result**: Secure, performant agent detection with visual indicators

### Example 2: Session Persistence

**Implementation**: `src/services/session/SessionManager.ts`

**Agent Workflow Used**:
1. Research: VS Code terminal storage service
2. Search: Existing persistence patterns
3. Implement: Session save/restore with atomic operations
4. Test: Integration tests for lifecycle scenarios

**Result**: Reliable session persistence with 5-minute auto-save

### Example 3: Performance Optimization

**Implementation**: `src/webview/managers/PerformanceManager.ts`

**Agent Workflow Used**:
1. Benchmark: Manual profiling (60ms → 16ms target)
2. Research: VS Code buffering strategies
3. Analyze: Bottlenecks in output handling
4. Implement: Optimized buffering (16ms = 60fps)
5. Test: Performance benchmarks and stress tests

**Result**: 4x performance improvement for terminal output

## Resources

- **Agent Definitions**: `.claude/agents/*.md`
- **OpenSpec Guide**: `openspec/AGENTS.md`
- **Development Guide**: `CLAUDE.md`
- **WebView Investigation**: `openspec/changes/investigate-webview-stability/AGENT_GUIDE.md`

## Contributing

When you discover effective agent workflows:

1. Document the workflow in this guide
2. Include timing estimates
3. Add to appropriate section
4. Provide real examples from the project

---

**Last Updated**: 2025-11-03
**Maintainer**: VS Code Sidebar Terminal Team
