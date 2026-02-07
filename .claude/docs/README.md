# Terminal Command System Documentation

This directory contains documentation for the terminal research and implementation workflow.

## Quick Start

### Research Terminal Implementation
```bash
/terminal-research How does VS Code handle IME composition events?
```
Launches 3 agents in parallel to gather implementation guidance.

### Research + Implement
```bash
/terminal-implement Add terminal tab completion support
```
Researches and implements the feature with TDD.

## Documentation Files

| File | Description |
|------|-------------|
| `README.md` | This file - overview of the documentation |
| `TERMINAL_COMMANDS_README.md` | Complete command reference and usage guide |
| `TERMINAL_RESEARCH_GUIDE.md` | Detailed research workflow guide |

## Available Commands

### `/terminal-research`
- **Purpose**: Research terminal implementation patterns
- **Location**: `.claude/commands/terminal-research.md`
- **Agents**: vscode-terminal-resolver, serena-semantic-search, xterm-info-analyzer
- **Output**: Research report with VS Code patterns, codebase analysis, and xterm.js docs

### `/terminal-implement`
- **Purpose**: Research and implement terminal features end-to-end
- **Location**: `.claude/commands/terminal-implement.md`
- **Agents**: 3 research agents + terminal-implementer
- **Output**: Working code with tests following TDD

## Available Agents

### Research Agents
1. **vscode-terminal-resolver** (`.claude/agents/vscode-terminal-resolver.md`)
   - Analyzes VS Code official terminal implementation
   - Provides authoritative patterns from microsoft/vscode

2. **serena-semantic-search** (`.claude/agents/serena-semantic-search.md`)
   - Semantic code search using Serena MCP
   - Finds similar patterns in current codebase

3. **xterm-info-analyzer** (`.claude/agents/xterm-info-analyzer.md`)
   - Retrieves official xterm.js documentation
   - Provides API references and best practices

### Implementation Agent
4. **terminal-implementer** (`.claude/agents/terminal-implementer.md`)
   - Implements features using TDD methodology
   - Ensures code quality and VS Code pattern compliance
   - Produces production-ready code with tests

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    /terminal-implement                      │
└─────────────────────────────────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────┐
│              Phase 1: Research (Parallel)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │ vscode-terminal- │  │ serena-semantic- │  │  xterm-   │ │
│  │    resolver      │  │     search       │  │  info-    │ │
│  │                  │  │                  │  │ analyzer  │ │
│  └──────────────────┘  └──────────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             v
                   Aggregate Research
                             │
                             v
┌─────────────────────────────────────────────────────────────┐
│          Phase 2: Implementation (Sequential)               │
├─────────────────────────────────────────────────────────────┤
│                  ┌──────────────────┐                       │
│                  │    terminal-     │                       │
│                  │   implementer    │                       │
│                  │                  │                       │
│                  │  (TDD Workflow)  │                       │
│                  └──────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                             │
                             v
                Working Code + Tests + Docs
```

## Example Usage

### Feature Development
```bash
# Full workflow: Research + Implementation
/terminal-implement Add Ctrl+K shortcut to clear terminal

# Result:
# - src/managers/KeybindingManager.ts - Shortcut handler added
# - src/test/unit/KeybindingManager.test.ts - Tests added
# - All tests passing ✅
```

### Performance Optimization
```bash
/terminal-implement Optimize terminal rendering for high-frequency output

# Result:
# - src/webview/managers/PerformanceManager.ts - Adaptive buffering
# - Performance: 60fps → 250fps for AI agents ✅
```

### Bug Fix
```bash
/terminal-implement Fix terminal scrollback restoration after reload

# Result:
# - src/services/terminal/SessionManager.ts - Fixed serialization
# - Issue #201 resolved ✅
```

### Research Only
```bash
# Just gather information without implementing
/terminal-research What patterns does VS Code use for terminal lifecycle?

# Result:
# - Research report with patterns and recommendations
# - No code changes
```

## Quality Standards

All implementations via `terminal-implementer` guarantee:

- ✅ **TDD Compliance**: Tests written first (Red → Green → Refactor)
- ✅ **Type Safety**: No `any` types, full TypeScript strictness
- ✅ **Memory Safety**: Dispose handlers for all managers
- ✅ **Thread Safety**: Atomic operations to prevent race conditions
- ✅ **Security**: Regex patterns instead of vulnerable includes()
- ✅ **Performance**: Optimized buffering and resource management
- ✅ **Documentation**: Code references in file:line format

## Development Workflow Integration

```bash
# 1. Implement feature
/terminal-implement Add terminal split view support

# 2. Run tests
npm run test:unit
npm run compile
npm run lint

# 3. Manual testing
# Launch VS Code extension and test feature

# 4. Commit
git add .
git commit -m "feat: Add terminal split view support"
```

## File Structure

```
.claude/
├── commands/
│   ├── terminal-research.md          # Research-only command
│   └── terminal-implement.md         # Research + Implementation command
├── agents/
│   ├── vscode-terminal-resolver.md   # VS Code patterns agent
│   ├── serena-semantic-search.md     # Codebase search agent
│   ├── xterm-info-analyzer.md        # Xterm.js docs agent
│   └── terminal-implementer.md       # TDD implementation agent
└── docs/
    ├── README.md                      # This file
    ├── TERMINAL_COMMANDS_README.md    # Complete command reference
    └── TERMINAL_RESEARCH_GUIDE.md     # Research workflow guide
```

## Next Steps

1. **Read the complete guide**: `TERMINAL_COMMANDS_README.md`
2. **Try a simple command**: `/terminal-research How does VS Code handle terminal colors?`
3. **Implement a feature**: `/terminal-implement Add support for terminal color themes`
4. **Review agent details**: Check `.claude/agents/*.md` for agent-specific information

## Tips

### Writing Effective Queries

**Good (Specific)**:
```bash
/terminal-implement Add Ctrl+L shortcut to clear terminal output
/terminal-research How does VS Code handle terminal IME composition events?
```

**Less Effective (Too Broad)**:
```bash
/terminal-implement Make terminals better
/terminal-research How do terminals work?
```

### Choosing the Right Command

| Scenario | Command | Reason |
|----------|---------|--------|
| Learning patterns | `/terminal-research` | Fast, no code changes |
| Planning architecture | `/terminal-research` | Gather info before deciding |
| Adding feature | `/terminal-implement` | Need working code |
| Fixing bug | `/terminal-implement` | Need tests + fix |
| Optimizing performance | `/terminal-implement` | Need measurable changes |

## Troubleshooting

### Command Not Found
```bash
# Check if command file exists
ls .claude/commands/terminal-*.md

# Verify:
# - terminal-research.md
# - terminal-implement.md
```

### Agent Not Working
```bash
# Check if agent files exist
ls .claude/agents/

# Verify:
# - vscode-terminal-resolver.md
# - serena-semantic-search.md
# - xterm-info-analyzer.md
# - terminal-implementer.md
```

### Research Returns No Results
- Feature might not exist in VS Code or current codebase
- Try broader search terms
- Check xterm.js documentation for API details

### Implementation Fails Tests
```bash
# Run tests to see failures
npm run test:unit

# Check TypeScript errors
npm run compile

# Review and fix issues
```

## Getting Help

- **Command Reference**: See `TERMINAL_COMMANDS_README.md`
- **Research Guide**: See `TERMINAL_RESEARCH_GUIDE.md`
- **Agent Details**: See `.claude/agents/*.md`
- **Issues**: https://github.com/s-hiraoku/vscode-sidebar-terminal/issues

## Advanced Topics

### Chaining Commands
Research first, then implement with refined understanding:
```bash
/terminal-research Terminal session persistence patterns
# Review findings...
/terminal-implement Implement terminal session persistence with state serialization
```

### Iterative Development
Break complex features into incremental steps:
```bash
# Step 1: Core feature
/terminal-implement Add basic terminal split view

# Step 2: Optimize
/terminal-implement Optimize split view rendering performance

# Step 3: Fix issues
/terminal-implement Fix split view focus management
```

### Custom Workflows
Combine with other commands for complete workflows:
```bash
# Implement feature
/terminal-implement Add terminal color theme support

# Run quality checks
npm run pre-release:check

# Commit
git add . && git commit -m "feat: Terminal color themes"
```

## Contributing

To add new agents or commands:

1. Create agent file in `.claude/agents/`
2. Create command file in `.claude/commands/`
3. Add YAML frontmatter with description
4. Document in this README
5. Test the workflow end-to-end

## License

See project LICENSE file.
