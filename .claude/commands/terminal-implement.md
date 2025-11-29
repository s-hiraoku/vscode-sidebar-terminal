---
description: Research and implement terminal features end-to-end
argument-hint: <feature description>
---

# Terminal Implementation Command

Research terminal implementation patterns and immediately implement the feature following VS Code best practices.

## Execution Workflow

When this command is invoked (e.g., `/terminal-implement Add terminal tab completion support`):

### Phase 1: Parallel Research (3 agents)

Launch all three research agents in parallel using a single message with multiple Task tool calls:

**Agent 1: vscode-terminal-resolver**
- Task description: "Analyze VS Code terminal implementation"
- Prompt: "Search the VS Code repository for how it implements: {ARGUMENTS}. Focus on terminal-related source code in src/vs/workbench/contrib/terminal/. Provide code references, implementation patterns, and key architectural decisions. Summary: 100-200 words."

**Agent 2: serena-semantic-search**
- Task description: "Search codebase semantically"
- Prompt: "Use Serena MCP to semantically search the current codebase for implementations related to: {ARGUMENTS}. Focus on TerminalManager, WebView managers, and xterm.js integrations. Identify existing patterns and architectural decisions. Provide file paths and line numbers. Summary: 100-200 words."

**Agent 3: xterm-info-analyzer**
- Task description: "Get xterm.js documentation"
- Prompt: "Retrieve xterm.js documentation and best practices for: {ARGUMENTS}. Include API references, configuration options, usage examples, and performance considerations. Summary: 100-200 words."

### Phase 2: Implementation (1 agent)

After research agents complete, launch the implementation agent:

**Agent 4: terminal-implementer**
- Task description: "Implement terminal feature"
- Prompt: "Implement: {ARGUMENTS}

**Research Findings:**

**VS Code Implementation:**
{vscode-terminal-resolver summary}

**Current Codebase:**
{serena-semantic-search summary}

**Xterm.js Best Practices:**
{xterm-info-analyzer summary}

**Implementation Requirements:**
1. Follow TDD workflow: Write tests first (Red), implement (Green), refactor (Refactor)
2. Use patterns from VS Code research findings
3. Integrate with existing managers identified in codebase search
4. Follow xterm.js best practices from documentation
5. Maintain atomic operations and dispose handlers
6. Provide file:line references in implementation

**Deliverables:**
- Production-ready code with tests
- Implementation summary (100-200 words)
- File references with line numbers"

## Output Format

After all agents complete, provide a comprehensive implementation report:

```markdown
## Terminal Implementation: {ARGUMENTS}

### Research Phase

**VS Code Patterns:**
{vscode-terminal-resolver findings}

**Current Architecture:**
{serena-semantic-search findings}

**Xterm.js APIs:**
{xterm-info-analyzer findings}

### Implementation Phase

{terminal-implementer summary}

**Files Modified:**
- src/path/to/file.ts:line - Description
- src/test/unit/file.test.ts:line - Test coverage

**Key Decisions:**
- Architectural pattern chosen: [pattern]
- VS Code pattern followed: [reference]
- Xterm.js API used: [API]

**Next Steps:**
1. Run `npm run test:unit` to verify tests
2. Run `npm run compile` to build
3. Test feature manually in extension
4. Review code quality with `npm run lint`
```

## Example Usage

### Simple Feature
```bash
/terminal-implement Add keyboard shortcut to clear terminal
```

### Complex Feature
```bash
/terminal-implement Implement terminal tab completion with fuzzy matching
```

### Performance Optimization
```bash
/terminal-implement Optimize terminal rendering for high-frequency output
```

### Bug Fix
```bash
/terminal-implement Fix terminal scrollback restoration after window reload
```

## Workflow Diagram

```
User: /terminal-implement <feature>
         |
         v
Phase 1: Research (Parallel)
         ├─> vscode-terminal-resolver
         ├─> serena-semantic-search
         └─> xterm-info-analyzer
         |
         v
    Aggregate Research
         |
         v
Phase 2: Implementation
         └─> terminal-implementer
         |
         v
    Implementation Report
         |
         v
    Ready to Test
```

## Important Notes

### Sequential Execution
- **Phase 1**: All 3 research agents run in parallel
- **Phase 2**: After Phase 1 completes, launch implementer with aggregated findings
- Do NOT launch all 4 agents at once (implementer needs research results)

### Agent Communication
- Research agents provide concise summaries (100-200 words each)
- Pass all 3 research summaries to terminal-implementer
- Implementer uses research to guide implementation decisions

### Error Handling

**If research agents find no results:**
- Proceed with implementation using general best practices
- Document in implementation report that specific patterns weren't found

**If implementer encounters issues:**
- Report blockers clearly
- Suggest additional research needed
- Provide partial implementation if possible

## Quality Gates

The terminal-implementer agent will ensure:
- ✅ TDD compliance (tests written first)
- ✅ Type safety (no `any` types)
- ✅ Dispose handlers implemented
- ✅ Atomic operations for thread safety
- ✅ Performance optimization
- ✅ Security patterns (regex over includes())

## Testing After Implementation

After the command completes, run:
```bash
# Verify tests pass
npm run test:unit

# Check type safety
npm run compile

# Run linting
npm run lint

# Test manually
code . (and launch extension)
```

## When to Use This Command

**Use `/terminal-implement` when:**
- Adding new terminal features
- Fixing terminal-related bugs
- Optimizing terminal performance
- Implementing missing VS Code patterns

**Don't use this command for:**
- Non-terminal features
- Simple text changes
- Documentation-only updates
- Configuration changes

## Key Benefits

1. **Authoritative Guidance**: VS Code patterns ensure production quality
2. **Contextual Implementation**: Understands existing codebase structure
3. **Best Practices**: Follows official xterm.js recommendations
4. **TDD Compliance**: Tests written first, ensuring reliability
5. **Complete Workflow**: Research → Implementation → Testing
6. **Atomic Operations**: Thread-safe by default
7. **Performance Optimized**: Follows proven optimization patterns

## Advanced Usage

### Research-Only Mode
If you only want research without implementation, use:
```bash
/terminal-research <query>
```

### Implementation-Only Mode
If you already have research and want to implement:
```bash
# Directly invoke terminal-implementer agent with research context
```

### Iterative Development
```bash
# Implement core feature
/terminal-implement Add terminal split view support

# After testing, optimize
/terminal-implement Optimize terminal split view rendering performance

# Fix issues found
/terminal-implement Fix terminal split view focus handling
```

## Integration with TDD Workflow

The command enforces t-wada's TDD methodology:

1. **Red Phase** (terminal-implementer writes failing tests)
   - Comprehensive test coverage
   - Edge cases considered

2. **Green Phase** (terminal-implementer implements feature)
   - Minimal working solution
   - Tests pass

3. **Refactor Phase** (terminal-implementer optimizes)
   - Follow VS Code patterns
   - Improve code quality
   - Maintain test coverage

## Command Composition

This command combines:
- `/terminal-research` (Phase 1: Research)
- `terminal-implementer` agent (Phase 2: Implementation)

For complex workflows, you can break it down:
```bash
# Step 1: Research first
/terminal-research How does VS Code handle terminal sessions?

# Step 2: Review research, then implement
/terminal-implement Implement terminal session persistence based on research
```

## Documentation

For complete command reference and usage examples, see:
- Command overview: `.claude/docs/TERMINAL_COMMANDS_README.md`
- Research guide: `.claude/docs/TERMINAL_RESEARCH_GUIDE.md`
- Implementation agent: `.claude/agents/terminal-implementer.md`
