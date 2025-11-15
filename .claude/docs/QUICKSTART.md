# OpenSpec Agents & MCP - Quick Start Guide

**Get started with OpenSpec implementation automation in 5 minutes**

This guide shows you how to use the new meta-command system to automatically generate implementation-specialized agents and slash commands from OpenSpec specifications.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [5-Minute Quick Start](#5-minute-quick-start)
3. [Complete Workflow Example](#complete-workflow-example)
4. [Available Commands](#available-commands)
5. [Available Agents](#available-agents)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Prerequisites

### 1. Verify MCP Configuration

**Check if MCPs are configured**:
```bash
# macOS/Linux
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Should include these MCPs:
# - github (VS Code source code access)
# - filesystem (safe file operations)
# - npm (dependency checks)
# - deepwiki (repository documentation)
# - playwright, chrome-devtools, brave-search, firecrawl
```

**If not configured**, see [MCP_SETUP.md](MCP_SETUP.md) for setup instructions.

### 2. Restart Claude Desktop

After MCP configuration changes:
```bash
# Quit Claude Desktop completely
# Restart Claude Desktop
# MCPs will be initialized on startup
```

### 3. Verify OpenSpec CLI (Optional)

```bash
# Check if OpenSpec CLI is available
openspec --version

# If not installed:
npm install -g @openspec/cli
```

---

## 5-Minute Quick Start

### Scenario: Implement a New Feature

Let's say you want to implement a new terminal feature. Here's the fastest path:

#### Step 1: Create OpenSpec Change (1 min)

```bash
/openspec:proposal
```

**You'll be prompted for**:
- Change ID (e.g., `add-terminal-profile-sync`)
- Problem statement
- Affected capabilities

**Generated**:
- `openspec/changes/add-terminal-profile-sync/proposal.md`
- `openspec/changes/add-terminal-profile-sync/tasks.md`
- `openspec/changes/add-terminal-profile-sync/specs/{capability}/spec.md`

#### Step 2: Generate Implementation Agent (1 min)

```bash
/openspec:agents-gen add-terminal-profile-sync
```

**What happens**:
- Analyzes your OpenSpec specification
- Identifies technical domains (Terminal, WebView, etc.)
- Selects appropriate MCP servers
- Configures agent workflow

**Generated**:
- `.claude/agents/add-terminal-profile-sync-implementer.md`
- `.claude/commands/implement-add-terminal-profile-sync.md`

#### Step 3: Run Implementation (3 min)

```bash
/implement-add-terminal-profile-sync
```

**Automatic execution**:
1. **Research** (parallel):
   - VS Code patterns via `github` MCP
   - Current codebase via `serena-semantic-search`
   - xterm.js docs via `deepwiki` MCP

2. **Implementation**:
   - TDD workflow (Red → Green → Refactor)
   - Follows VS Code patterns

3. **Validation**:
   - API usage check
   - Performance analysis
   - Security audit

4. **Testing**:
   - Unit tests
   - Integration tests
   - E2E tests (if applicable)

#### Step 4: Archive (30 sec)

```bash
/openspec:archive add-terminal-profile-sync
```

**Done!** Feature implemented with:
- ✅ Production code
- ✅ Comprehensive tests
- ✅ API validation
- ✅ Documentation

---

## Complete Workflow Example

### Use Case: Fix Terminal Initialization Bug

This example shows the complete workflow from bug discovery to resolution.

#### 1. Problem Discovery

**User reports**: "Terminal prompt doesn't appear after creation"

#### 2. Create OpenSpec Change

```bash
/openspec:proposal
```

**Fill in details**:
- **Change ID**: `fix-terminal-initialization-bugs`
- **Problem**: Terminal prompt not displayed, initialization message not routed
- **Affected capabilities**: `terminal-lifecycle-management`, `webview-message-routing`

**Generated files**:
```
openspec/changes/fix-terminal-initialization-bugs/
├── proposal.md          ← Problem statement, success criteria
├── tasks.md             ← Implementation phases
└── specs/
    ├── terminal-shell-initialization/spec.md
    └── terminal-header-display/spec.md
```

#### 3. Define Tasks

**Edit `tasks.md`**:
```markdown
## Phase 1: Add Diagnostic Logging (30min)
- Task 1.1: Add WebView message sending logs
- Task 1.2: Add Extension message reception logs
- Task 1.3: Add shell initialization logs

## Phase 2: Fix Message Routing (1h)
- Task 2.1: Verify handler registration
- Task 2.2: Fix routing logic
- Task 2.3: Verify handler execution

## Phase 3: Fix Shell Initialization (1h)
- Task 3.1: Verify handler implementation
- Task 3.2: Ensure initializeShellForTerminal() called
- Task 3.3: Ensure startPtyOutput() called

## Phase 4: Testing (1.5h)
- Unit tests for message routing
- Integration tests for initialization flow
```

#### 4. Generate Specialized Agent

```bash
/openspec:agents-gen fix-terminal-initialization-bugs
```

**Output**:
```
✅ Agent created: .claude/agents/fix-terminal-initialization-bugs-implementer.md
✅ Command created: .claude/commands/implement-fix-terminal-initialization-bugs.md

Technical domains identified:
- Terminal Lifecycle Management
- WebView Message Routing
- UI Rendering

MCPs configured:
- github (VS Code patterns)
- deepwiki (xterm.js docs)

Agents configured:
- vscode-terminal-resolver (research)
- serena-semantic-search (research)
- terminal-implementer (implementation)
- tdd-quality-engineer (testing)
- vscode-api-validator (validation)
```

#### 5. Review Generated Agent

**Check `.claude/agents/fix-terminal-initialization-bugs-implementer.md`**:

```markdown
## OpenSpec Context
**Change ID**: fix-terminal-initialization-bugs
**Problem**: Terminal prompt not displayed - message routing broken

## Success Criteria (from proposal.md):
- [✓] Terminal shows shell prompt immediately
- [✓] Terminal accepts keyboard input
- [✓] initializeShellForTerminal() is called
- [✓] startPtyOutput() is called

## Workflow:
### Phase 1: Research (30min) - Parallel execution
- vscode-terminal-resolver → VS Code message routing patterns
- serena-semantic-search → Current message handling
- xterm-info-analyzer → Terminal lifecycle

### Phase 2: Implementation (1.5h)
- terminal-implementer with TDD workflow
- Fix MessageRoutingFacade
- Add diagnostic logging

### Phase 3: Validation (30min)
- vscode-api-validator → API checks
- security-auditor → Security audit

### Phase 4: Testing (1.5h)
- tdd-quality-engineer → Unit/Integration tests
```

#### 6. Run Implementation

```bash
/implement-fix-terminal-initialization-bugs
```

**Real-time progress**:

```
🔍 Phase 1: Research (Running in parallel...)

vscode-terminal-resolver:
✅ Found VS Code message routing pattern in TerminalInstance.ts:345
📝 Summary: VS Code uses promise-based handlers with retry logic

serena-semantic-search:
✅ Found MessageRoutingFacade in src/providers/services/
📝 Summary: Current routing uses category-based system

xterm-info-analyzer:
✅ Terminal emits 'onRender' event when ready
📝 Summary: Wait for first render before initialization

---

🔧 Phase 2: Implementation

terminal-implementer:
✅ Added message retry logic (3 attempts, exponential backoff)
✅ Fixed category routing in MessageRoutingFacade.ts:85
✅ Ensured handler registration before WebView init
✅ Added comprehensive logging

Files modified:
- src/webview/services/TerminalCreationService.ts:357-363
- src/providers/SecondaryTerminalProvider.ts:317
- src/providers/services/MessageRoutingFacade.ts:85
- src/terminals/TerminalManager.ts:145

---

✓ Phase 3: Validation

vscode-api-validator:
✅ No deprecated APIs
✅ Message routing follows VS Code patterns
✅ Dispose handlers correct

security-auditor:
✅ Message validation implemented
✅ No race conditions

---

🧪 Phase 4: Testing

tdd-quality-engineer:
✅ Unit tests: 15 passing (MessageRoutingFacade)
✅ Integration tests: 8 passing (initialization flow)
✅ Coverage: 87% (target: >80%)

All success criteria met ✓
```

#### 7. Verify Implementation

**Manual testing**:
```bash
# Build extension
npm run compile

# Run tests
npm run test

# Test in VS Code
# 1. Create new terminal
# 2. Verify prompt appears immediately ✅
# 3. Type commands → Input works ✅
# 4. Check AI Agent header → Displays correctly ✅
```

#### 8. Archive Change

```bash
/openspec:archive fix-terminal-initialization-bugs
```

**Result**:
```
✅ Change archived to openspec/changes/archive/
✅ Updated archive index
✅ Implementation complete
```

---

## Available Commands

### Meta-Commands

#### `/openspec:agents-gen <change-id>`

**Purpose**: Generate implementation-specialized agent from OpenSpec spec

**Example**:
```bash
/openspec:agents-gen add-terminal-profile-sync
```

**Generates**:
- `.claude/agents/{change-id}-implementer.md`
- `.claude/commands/implement-{change-id}.md`

**When to use**:
- After creating OpenSpec proposal
- Before starting implementation
- To automate agent configuration

---

### OpenSpec Commands

#### `/openspec:proposal`

**Purpose**: Create new OpenSpec change proposal

**Interactive prompts for**:
- Change ID
- Problem statement
- Affected capabilities

#### `/openspec:apply <change-id>`

**Purpose**: Mark OpenSpec change as applied (in progress)

#### `/openspec:archive <change-id>`

**Purpose**: Archive completed OpenSpec change

---

### Generated Implementation Commands

After running `/openspec:agents-gen`, you get a custom command:

#### `/implement-<change-id>`

**Purpose**: Execute full implementation workflow

**Example**:
```bash
/implement-fix-terminal-initialization-bugs
```

**Workflow**:
1. Research (parallel agent execution)
2. Implementation (TDD workflow)
3. Validation (API/performance/security)
4. Testing (unit/integration/E2E)

---

## Available Agents

### OpenSpec Workflow Agents

#### `openspec-scaffolder`

**Purpose**: Automate OpenSpec change creation

**Usage**:
```bash
Task(openspec-scaffolder): "Create OpenSpec change for add-terminal-profile-sync"
```

**Generates**:
- proposal.md with problem statement
- tasks.md with phase structure
- specs/*.md with scenario templates
- Validates with `openspec validate --strict`

**Time savings**: 30min → 5min (6x faster)

---

#### `terminal-performance-analyzer`

**Purpose**: Profile terminal performance and identify bottlenecks

**Usage**:
```bash
Task(terminal-performance-analyzer): "Analyze terminal creation performance"
```

**Analyzes**:
- Terminal creation time (<500ms target)
- Rendering FPS (60fps normal, 250fps AI agents)
- Memory usage (<20MB per terminal)
- Scrollback efficiency

**Output**:
- Current metrics vs targets
- Bottlenecks with file:line references
- Optimization recommendations
- Memory leak risk assessment

---

#### `vscode-api-validator`

**Purpose**: Validate VS Code API usage

**Usage**:
```bash
Task(vscode-api-validator): "Validate API usage in modified files"
```

**Checks**:
- Deprecated API usage → Provides replacements
- Missing dispose handlers → Shows where to add
- Incorrect WebView patterns → Fixes
- Unhandled promises → Error handling

**Integrates with**: GitHub MCP for VS Code docs

---

### Research Agents

#### `vscode-terminal-resolver`

**Purpose**: Fetch VS Code terminal implementation patterns

**Integrates with**: `github` MCP

#### `serena-semantic-search`

**Purpose**: Semantic search in current codebase

**Integrates with**: Serena MCP

#### `xterm-info-analyzer`

**Purpose**: Get xterm.js documentation

**Integrates with**: `deepwiki` MCP

---

### Implementation Agents

#### `terminal-implementer`

**Purpose**: Production-ready terminal code with TDD

**Follows**: VS Code patterns, xterm.js best practices

#### `tdd-quality-engineer`

**Purpose**: Comprehensive test suite creation

**Follows**: t-wada TDD methodology

---

### Testing Agents

#### `playwright-test-planner`

**Purpose**: Create E2E test scenarios

#### `playwright-test-generator`

**Purpose**: Implement Playwright tests

#### `playwright-test-healer`

**Purpose**: Debug and fix failing tests

---

### Validation Agents

#### `security-auditor`

**Purpose**: Security vulnerability scanning

**Checks**: regex vs includes(), shell injection, path traversal

#### `memory-leak-detector`

**Purpose**: Detect memory leaks in terminal lifecycle

---

## Troubleshooting

### Issue: MCPs not loading

**Symptoms**:
- Agents can't access github/deepwiki
- Error: "MCP server not available"

**Solution**:
```bash
# 1. Check MCP config file exists
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 2. Verify JSON is valid
# Use https://jsonlint.com to validate

# 3. Restart Claude Desktop completely
# Quit → Restart

# 4. Check MCP status in Claude Code
# Look for MCP indicators in tool calls
```

---

### Issue: Generated agent missing context

**Symptoms**:
- Agent doesn't know about success criteria
- Missing task breakdown

**Solution**:
```bash
# 1. Ensure proposal.md has all required sections:
# - Problem Statement
# - Success Criteria
# - Scope (In/Out of scope)

# 2. Ensure tasks.md has phase structure:
# - Phase 1, Phase 2, etc.
# - Task breakdown with time estimates

# 3. Re-run generation:
/openspec:agents-gen <change-id>
```

---

### Issue: Implementation command not found

**Symptoms**:
- `/implement-<change-id>` not recognized

**Solution**:
```bash
# 1. Verify command file was created:
ls .claude/commands/implement-<change-id>.md

# 2. If missing, re-run generation:
/openspec:agents-gen <change-id>

# 3. Check file permissions:
chmod 644 .claude/commands/implement-<change-id>.md

# 4. Restart Claude Code (if needed)
```

---

### Issue: Tests failing after implementation

**Symptoms**:
- Unit tests fail
- Integration tests timeout

**Solution**:
```bash
# 1. Check TypeScript compilation:
npm run compile
# Fix any compilation errors first

# 2. Run tests with verbose output:
npm run test -- --verbose

# 3. Check test logs for specific failures

# 4. Use playwright-test-healer for E2E tests:
Task(playwright-test-healer): "Debug failing test in terminal-initialization.spec.ts"
```

---

## FAQ

### Q: How long does the full workflow take?

**A**: Typical timeline:
- OpenSpec proposal creation: **5-10 min**
- Agent generation: **1 min**
- Implementation execution: **3-8 hours** (depends on complexity)
  - Research: 30min-1h
  - Implementation: 1-4h
  - Validation: 30min-1h
  - Testing: 1-2h

**Total**: About the same as manual implementation, but with:
- Higher code quality
- Complete test coverage
- Proper validation
- Less context switching

---

### Q: Can I customize the generated agent?

**A**: Yes! Edit `.claude/agents/{change-id}-implementer.md`:

```markdown
# Modify workflow phases
## Phase 2: Implementation (YOUR CUSTOM TIME)
- Add your own tasks
- Change agent prompts
- Adjust MCP usage

# Change success criteria
**Success Criteria**:
- Add your own criteria
- Modify existing ones
```

Re-run `/implement-{change-id}` with updated agent.

---

### Q: What if I don't have all MCPs configured?

**A**: The system gracefully degrades:

**With github MCP**:
- ✅ 10x faster VS Code research
- ✅ Direct source code access

**Without github MCP**:
- ⚠️ Falls back to WebFetch (slower)
- ⚠️ Limited source code access

**Recommendation**: Configure at least `github` and `filesystem` MCPs for best experience.

---

### Q: Can I use this for non-OpenSpec work?

**A**: Partially:

**Yes, you can use**:
- Individual agents (openspec-scaffolder, terminal-performance-analyzer, vscode-api-validator)
- MCP servers (github, filesystem, npm, etc.)
- Research workflow (vscode-terminal-resolver + serena-semantic-search)

**No, you cannot use**:
- `/openspec:agents-gen` (requires OpenSpec structure)
- Generated `/implement-<change-id>` commands (OpenSpec-specific)

**Alternative**: Use agents directly via `Task` tool:
```bash
Task(terminal-performance-analyzer): "Analyze current terminal performance"
```

---

### Q: How do I share generated agents with team?

**A**: Generated agents are committed to `.claude/`:

```bash
# 1. Generate agent
/openspec:agents-gen my-feature

# 2. Commit to repo
git add .claude/agents/my-feature-implementer.md
git add .claude/commands/implement-my-feature.md
git commit -m "Add implementation agent for my-feature"
git push

# 3. Team members can now use:
/implement-my-feature
```

**Note**: Each team member needs their own MCP configuration.

---

### Q: What's the difference between Agent and Skill?

**A**: In this project:

**Agent** = Specialized AI assistant with:
- Specific purpose (e.g., "implement terminal features")
- Pre-configured tools
- Defined workflow
- Can be invoked via `Task` tool

**Skill** = Same as Agent (terms used interchangeably)

**MCP** = External server providing tools:
- github MCP → GitHub API access
- filesystem MCP → File operations
- Agents/Skills use MCPs to accomplish tasks

---

### Q: Can I run multiple implementations in parallel?

**A**: Yes, but carefully:

**Parallel research** (safe):
```bash
# Research for two features simultaneously
Task(vscode-terminal-resolver): "Research feature A"
Task(serena-semantic-search): "Research feature B"
```

**Parallel implementation** (risky):
```bash
# DON'T do this - file conflicts
/implement-feature-a
/implement-feature-b  # May conflict with feature-a
```

**Recommendation**: Implement sequentially, research in parallel.

---

## Next Steps

1. **Try the quick start example** above
2. **Read detailed agent documentation**: [AGENTS_REFERENCE.md](AGENTS_REFERENCE.md)
3. **Configure MCPs**: [MCP_SETUP.md](MCP_SETUP.md)
4. **Review existing agents**: Browse `.claude/agents/`
5. **Join discussions**: Report issues or suggest improvements

---

## Additional Resources

- **OpenSpec Documentation**: `openspec/AGENTS.md`
- **CLAUDE.md**: Complete development guide
- **Agent Reference**: [AGENTS_REFERENCE.md](AGENTS_REFERENCE.md)
- **MCP Setup**: [MCP_SETUP.md](MCP_SETUP.md)

---

**Questions or issues?** Check [AGENTS_REFERENCE.md](AGENTS_REFERENCE.md) or create an issue in the repository.
