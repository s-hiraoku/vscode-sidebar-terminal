---
description: Generate implementation-specialized agent and slash command from OpenSpec change specification
argument-hint: <change-id>
---

# OpenSpec Agents Generator (Meta-Command)

Analyze OpenSpec change specifications and automatically generate:

1. Implementation-specialized agent (`.claude/agents/{change-id}-implementer.md`)
2. Dedicated slash command (`.claude/commands/implement-{change-id}.md`)

Both generated artifacts integrate with MCP servers and Skills for optimal implementation efficiency.

## Execution Workflow

When this command is invoked (e.g., `/openspec:agents-gen fix-terminal-initialization-bugs`):

### Step 1: Validate OpenSpec Change

**Input**: `{ARGUMENTS}` (change-id)

**Validation**:

```bash
# Check if OpenSpec change exists
if [ ! -d "openspec/changes/{ARGUMENTS}" ]; then
    echo "❌ Error: OpenSpec change '{ARGUMENTS}' not found"
    echo "Available changes:"
    ls -1 openspec/changes/
    exit 1
fi

# Check required files
required_files=("proposal.md" "tasks.md")
for file in "${required_files[@]}"; do
    if [ ! -f "openspec/changes/{ARGUMENTS}/$file" ]; then
        echo "❌ Error: Missing required file: $file"
        exit 1
    fi
done
```

**Output**: ✅ Validation passed / ❌ Validation failed with error details

---

### Step 2: Analyze OpenSpec Specification

**Files to Read**:

1. `openspec/changes/{ARGUMENTS}/proposal.md` - Problem statement, solution, scope
2. `openspec/changes/{ARGUMENTS}/tasks.md` - Implementation phases and tasks
3. `openspec/changes/{ARGUMENTS}/specs/**/*.md` - Delta specifications (if exists)

**Analysis Objectives**:

#### 2.1 Extract Technical Domain

Determine primary technical areas affected:

- **Terminal Lifecycle Management**: Terminal creation, deletion, process states
- **WebView Development**: Message routing, UI rendering, event handling
- **Performance Optimization**: Rendering, memory, buffering
- **Testing**: Unit tests, integration tests, E2E tests (Playwright)
- **Configuration Management**: Settings, profiles, feature toggles
- **Session Persistence**: Scrollback save/restore, state serialization
- **AI Agent Detection**: Pattern matching, visual indicators
- **Error Handling**: Race conditions, memory leaks, validation

**Extraction Pattern**:

```
Read proposal.md:
  - Analyze "Problem Statement" section → Identify affected domains
  - Analyze "Scope" section → Determine implementation areas
  - Extract file paths mentioned → Map to technical domains

Read tasks.md:
  - Count phases → Determine complexity
  - Identify tools mentioned (xterm.js, node-pty, etc.)
  - Extract test requirements → Testing domain involvement

Read specs/*.md (if exists):
  - Directory names indicate capabilities
  - Requirements indicate implementation scope
```

**Output**:

```markdown
## Technical Domain Analysis

**Primary Domains**:

- {Domain 1} (Confidence: High/Medium/Low)
- {Domain 2} (Confidence: High/Medium/Low)

**Affected Files** (from proposal.md and tasks.md):

- src/path/to/file1.ts - {Domain}
- src/path/to/file2.ts - {Domain}

**Complexity Assessment**:

- Total Phases: {X}
- Estimated Hours: {Y}
- Test Coverage Required: Unit + Integration + E2E (Yes/No)
```

---

#### 2.2 Determine Required MCP Servers

Based on technical domains, determine which MCP servers are needed:

**Mapping Rules**:

| Domain                   | Required MCPs               | Purpose                                        |
| ------------------------ | --------------------------- | ---------------------------------------------- |
| Terminal Lifecycle       | `github`, `deepwiki`        | Fetch VS Code terminal patterns, xterm.js docs |
| WebView Development      | `github`, `playwright`      | VS Code WebView patterns, E2E testing          |
| Performance Optimization | `chrome-devtools`           | Performance profiling, memory analysis         |
| Testing                  | `playwright`                | Browser automation for E2E tests               |
| Configuration            | `github`, `npm`             | VS Code config patterns, dependency checks     |
| Session Persistence      | `github`, `filesystem`      | VS Code storage patterns, file operations      |
| AI Agent Detection       | `brave-search`, `firecrawl` | Research agent CLIs, documentation             |
| Error Handling           | `github`                    | VS Code error handling patterns                |

**Output**:

```markdown
## Required MCP Servers

**Essential**:

- `github` - VS Code source code reference
- `{other MCPs}` - {Purpose}

**Optional**:

- `{MCP}` - {Purpose}

**Justification**:
{Explanation of why each MCP is needed for this specific change}
```

---

#### 2.3 Determine Required Skills (Agents)

Based on workflow phases in tasks.md:

**Mapping Rules**:

| Phase Type           | Required Skills/Agents                                                      | Purpose                        |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| Research & Design    | `vscode-terminal-resolver`, `serena-semantic-search`, `xterm-info-analyzer` | Gather implementation guidance |
| Implementation       | `terminal-implementer`, `tdd-quality-engineer`                              | TDD implementation             |
| Performance Analysis | `terminal-performance-analyzer`                                             | Profiling and optimization     |
| API Validation       | `vscode-api-validator`                                                      | Check API usage                |
| Testing              | `playwright-test-planner`, `playwright-test-generator`                      | E2E test creation              |
| Security             | `security-auditor`                                                          | Vulnerability scanning         |
| Memory               | `memory-leak-detector`                                                      | Leak detection                 |

**Output**:

```markdown
## Required Skills/Agents

**Research Phase**:

- `vscode-terminal-resolver` - VS Code patterns
- `serena-semantic-search` - Codebase search
- `xterm-info-analyzer` - xterm.js docs (if terminal-related)

**Implementation Phase**:

- `terminal-implementer` - TDD implementation
- `tdd-quality-engineer` - Test suite creation

**Validation Phase**:

- `vscode-api-validator` - API usage validation
- `terminal-performance-analyzer` - Performance profiling (if applicable)
- `security-auditor` - Security checks (if applicable)

**Testing Phase** (if E2E required):

- `playwright-test-planner` - Test scenarios
- `playwright-test-generator` - Test implementation
```

---

### Step 3: Generate Implementation-Specialized Agent

**Output File**: `.claude/agents/{ARGUMENTS}-implementer.md`

**Agent Template**:

```markdown
---
name: {change-id}-implementer
description: Specialized agent for implementing OpenSpec change: {change title}. Handles {primary domains}. Integrates with {MCP servers} and {Skills/Agents}.
tools: ["*"]
model: sonnet
color: purple
---

# {Change Title} Implementation Agent

You are a specialized agent for implementing OpenSpec change: **{change-id}**.

## OpenSpec Context

**Change ID**: {change-id}
**Location**: `openspec/changes/{change-id}/`

**Problem Statement** (from proposal.md):
{Extract problem statement from proposal.md}

**Success Criteria** (from proposal.md):
{Extract success criteria from proposal.md}

**Scope** (from proposal.md):

- **In Scope**: {Extract in-scope items}
- **Out of Scope**: {Extract out-of-scope items}

---

## Technical Domain Focus

**Primary Domains**:

- {Domain 1} - {Description}
- {Domain 2} - {Description}

**Affected Files** (from tasks.md):
{Extract file paths from tasks.md}

**Complexity**: {X} phases, ~{Y} hours estimated

---

## Implementation Workflow

### Phase 1: Research ({hours}h)

**Agents to Use** (in parallel):

1. **vscode-terminal-resolver**
   - Purpose: Fetch VS Code implementation patterns
   - Prompt: "How does VS Code handle {specific feature}? Focus on {files mentioned in proposal}."
   - MCP: Uses `github` MCP for source code access

2. **serena-semantic-search**
   - Purpose: Find similar implementations in current codebase
   - Prompt: "Search for {feature keywords} in the codebase. Identify existing patterns in {managers/controllers mentioned}."
   - MCP: Uses Serena MCP

3. **xterm-info-analyzer** (if terminal-related)
   - Purpose: Get xterm.js API documentation
   - Prompt: "How does xterm.js handle {feature}? Include API references and best practices."
   - MCP: Uses `deepwiki` MCP

**Parallel Execution**:
```

Use a single message with multiple Task tool calls to run all 3 agents in parallel.

```

**Expected Output**:
- VS Code implementation patterns (100-200 words)
- Current codebase architecture (100-200 words)
- Xterm.js APIs and best practices (100-200 words)

---

### Phase 2: Implementation ({hours}h)

**Agent to Use**: `terminal-implementer`

**Input**: Research findings from Phase 1

**Prompt Template**:
```

Implement OpenSpec change: {change-id}

**Problem**: {problem statement}

**Research Findings**:

- VS Code: {vscode-terminal-resolver summary}
- Codebase: {serena-semantic-search summary}
- Xterm.js: {xterm-info-analyzer summary}

**Tasks** (from tasks.md):
{Extract Phase 2 tasks from tasks.md}

**Requirements**:

1. Follow TDD: Red → Green → Refactor
2. Use patterns from VS Code research
3. Integrate with existing managers: {list from tasks.md}
4. Implement dispose handlers
5. Add file:line references

**Success Criteria**:
{Extract success criteria from proposal.md}

**Deliverables**:

- Production code with tests
- Implementation summary (100-200 words)

```

**Expected Output**:
- Code implementation
- Unit tests
- Integration tests (if applicable)
- File:line references

---

### Phase 3: Validation ({hours}h)

**Agents to Use** (in parallel):

1. **vscode-api-validator**
   - Purpose: Validate VS Code API usage
   - Prompt: "Validate API usage in files: {files modified}. Check for deprecated patterns, missing dispose handlers, and incorrect WebView usage."

2. **terminal-performance-analyzer** (if performance-critical)
   - Purpose: Profile performance
   - Prompt: "Analyze performance impact of changes in: {files modified}. Compare against benchmarks: {relevant benchmarks}."

3. **security-auditor** (if security-sensitive)
   - Purpose: Security audit
   - Prompt: "Audit security in: {files modified}. Check for regex vs includes(), shell injection, path traversal."

**Expected Output**:
- API validation report
- Performance analysis report (if applicable)
- Security audit report (if applicable)

---

### Phase 4: Testing ({hours}h)

#### 4.1 TDD Unit/Integration Tests

**Agent**: `tdd-quality-engineer`

**Prompt**:
```

Create comprehensive test suite for OpenSpec change: {change-id}

**Implementation**: {summary from Phase 2}

**Test Requirements** (from tasks.md):
{Extract Phase 3 test tasks from tasks.md}

**Coverage Target**: >80%

Follow t-wada TDD methodology: Red → Green → Refactor

```

#### 4.2 E2E Tests (if applicable)

**Agent 1**: `playwright-test-planner`

**Prompt**:
```

Create E2E test scenarios for: {change-id}

**Feature**: {feature description}
**User Flows**: {extract from proposal.md}

```

**Agent 2**: `playwright-test-generator`

**Prompt**:
```

Implement E2E tests for scenarios: {scenarios from planner}

**Test Priority**: {P0/P1/P2 from proposal if mentioned}

````

---

## MCP Server Integration

### Configured MCPs

{List only MCPs relevant to this change}

**{MCP Name}**:
- **Purpose**: {Why needed for this change}
- **Usage**: {When to use in workflow}

---

## Quality Checklist

Before marking implementation complete:

**Code Quality**:
- [ ] All tasks in `tasks.md` completed
- [ ] Success criteria from `proposal.md` met
- [ ] TDD workflow followed (Red → Green → Refactor)
- [ ] Dispose handlers implemented
- [ ] TypeScript strict mode compliance
- [ ] File:line references provided

**Testing**:
- [ ] Unit tests passing
- [ ] Integration tests passing (if applicable)
- [ ] E2E tests passing (if applicable)
- [ ] Coverage > 80%

**Validation**:
- [ ] `vscode-api-validator` report clean
- [ ] `terminal-performance-analyzer` benchmarks met (if applicable)
- [ ] `security-auditor` no vulnerabilities (if applicable)

**Documentation**:
- [ ] CLAUDE.md updated (if architecture changed)
- [ ] Inline comments added
- [ ] OpenSpec change archived after deployment

---

## Output Format

After completing all phases, provide:

```markdown
## Implementation Complete: {change-id}

### Research Phase
**VS Code Patterns**: {summary}
**Codebase Architecture**: {summary}
**Xterm.js APIs**: {summary}

### Implementation Phase
**Files Modified**:
- {file}:{line} - {description}
- {file}:{line} - {description}

**Key Decisions**:
- {Decision 1}
- {Decision 2}

### Validation Phase
**API Validation**: ✅ PASSED / ⚠️ WARNINGS / ❌ FAILED
**Performance**: ✅ Benchmarks met / ⚠️ Minor issues / ❌ Critical issues
**Security**: ✅ Clean / ⚠️ Minor issues / ❌ Vulnerabilities found

### Testing Phase
**Unit Tests**: {X} passing
**Integration Tests**: {Y} passing
**E2E Tests**: {Z} passing
**Coverage**: {N}%

### Success Criteria Validation
{For each criterion from proposal.md, mark ✅ or ❌}
- [ ] {Criterion 1}: ✅
- [ ] {Criterion 2}: ✅

### Next Steps
1. Run full test suite: `npm run test`
2. Build extension: `npm run compile`
3. Manual testing in VS Code
4. Archive OpenSpec change: `/openspec:archive {change-id}`
````

---

## Important Reminders

- ✅ Always follow TDD workflow
- ✅ Use parallel agent execution when possible
- ✅ Provide file:line references
- ✅ Validate against success criteria
- ✅ Use MCP servers for research
- ✅ Request concise summaries (100-200 words)
- ❌ Never skip validation phase
- ❌ Never mark complete without meeting success criteria
- ❌ Never skip dispose handlers

````

---

### Step 4: Generate Dedicated Slash Command

**Output File**: `.claude/commands/implement-{ARGUMENTS}.md`

**Command Template**:
```markdown
---
description: Implement OpenSpec change: {change title} using specialized agent
---

# Implement: {Change Title}

Execute the specialized implementation agent for OpenSpec change **{change-id}**.

## Quick Start

Simply invoke this command:
```bash
/implement-{change-id}
````

This will launch the `{change-id}-implementer` agent with pre-configured workflow.

---

## What This Command Does

**Launches**: `.claude/agents/{change-id}-implementer.md`

**Workflow Phases**:

1. **Research** ({hours}h): Gather VS Code patterns, codebase context, xterm.js docs
2. **Implementation** ({hours}h): TDD implementation following research findings
3. **Validation** ({hours}h): API validation, performance check, security audit
4. **Testing** ({hours}h): Unit/Integration/E2E test creation

**Total Estimated Time**: ~{total hours}h

---

## OpenSpec Context

**Change ID**: {change-id}
**Problem**: {One-sentence problem statement}
**Solution**: {One-sentence solution}
**Scope**: {Primary technical domains}

**Full Specification**: `openspec/changes/{change-id}/`

- proposal.md - Problem statement and success criteria
- tasks.md - Detailed implementation tasks
- specs/ - Delta specifications

---

## Execution Flow

When you run `/implement-{change-id}`, the agent will:

### 1. Research Phase (Parallel)

- Launch `vscode-terminal-resolver` → VS Code patterns
- Launch `serena-semantic-search` → Current codebase
- Launch `xterm-info-analyzer` → xterm.js docs (if applicable)

### 2. Implementation Phase

- Launch `terminal-implementer` with research findings
- Follow TDD: Red → Green → Refactor
- Implement all tasks from `tasks.md` Phase 2

### 3. Validation Phase (Parallel)

- Launch `vscode-api-validator` → API checks
- Launch `terminal-performance-analyzer` → Performance (if applicable)
- Launch `security-auditor` → Security (if applicable)

### 4. Testing Phase

- Launch `tdd-quality-engineer` → Unit/Integration tests
- Launch `playwright-test-planner` + `playwright-test-generator` → E2E tests (if applicable)

---

## Success Criteria

The implementation is complete when:
{Extract success criteria from proposal.md as checklist}

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] All tests passing
- [ ] Coverage > 80%
- [ ] Validation reports clean

---

## Next Steps After Implementation

1. **Verify Build**: `npm run compile`
2. **Run Tests**: `npm run test`
3. **Manual Testing**: Load extension in VS Code
4. **Pre-Release Check**: `npm run pre-release:check`
5. **Archive OpenSpec**: `/openspec:archive {change-id}`

---

## Related Commands

- `/openspec:proposal` - Create new OpenSpec change
- `/openspec:apply {change-id}` - Mark change as applied
- `/openspec:archive {change-id}` - Archive completed change
- `/terminal-research <query>` - Research terminal patterns

````

---

### Step 5: Output Summary

After generating both files, provide:

```markdown
## OpenSpec Agents Generated

**Change ID**: {ARGUMENTS}
**Generated Files**:
✅ `.claude/agents/{ARGUMENTS}-implementer.md`
✅ `.claude/commands/implement-{ARGUMENTS}.md`

---

### Agent Summary

**Name**: {change-id}-implementer
**Purpose**: Implement {change title}
**Domains**: {Primary domains}
**Complexity**: {X} phases, ~{Y} hours

**MCP Servers Integrated**:
{List MCPs with purpose}

**Skills/Agents Used**:
{List agents in workflow}

**Workflow**:
1. Research ({hours}h) - {agents}
2. Implementation ({hours}h) - {agents}
3. Validation ({hours}h) - {agents}
4. Testing ({hours}h) - {agents}

---

### Slash Command Summary

**Command**: `/implement-{change-id}`
**Description**: {One-sentence description}
**Estimated Time**: ~{total hours}h

**Quick Usage**:
```bash
# Start implementation
/implement-{change-id}

# The agent will handle all phases automatically
````

---

### Next Steps

1. **Review Generated Files**:
   - Check `.claude/agents/{change-id}-implementer.md` for accuracy
   - Review `.claude/commands/implement-{change-id}.md` for completeness

2. **Start Implementation**:

   ```bash
   /implement-{change-id}
   ```

3. **Monitor Progress**:
   - Research phase: Gather findings from 3 agents
   - Implementation phase: Follow TDD workflow
   - Validation phase: Review validation reports
   - Testing phase: Ensure >80% coverage

4. **Complete and Archive**:
   ```bash
   /openspec:archive {change-id}
   ```

---

### Customization

If you need to modify the generated agent or command:

**Agent**: `.claude/agents/{change-id}-implementer.md`

- Adjust workflow phases
- Add/remove MCP servers
- Change agent prompts
- Update success criteria

**Command**: `.claude/commands/implement-{change-id}.md`

- Update description
- Modify execution flow
- Adjust time estimates

---

## Success Criteria

続きをします。 お願いします。
This meta-command succeeds when:

- ✅ Agent file created with complete workflow
- ✅ Command file created with clear instructions
- ✅ All MCPs and Skills correctly identified
- ✅ Workflow phases mapped from tasks.md
- ✅ Success criteria extracted from proposal.md
- ✅ Both files are syntactically valid Markdown
- ✅ Generated command is immediately executable

---

## Error Handling

**If OpenSpec change not found**:

```
❌ Error: OpenSpec change '{ARGUMENTS}' not found
Available changes: {list}
```

**If required files missing**:

```
❌ Error: Missing required file: {file}
Required files: proposal.md, tasks.md
```

**If analysis fails**:

```
⚠️ Warning: Could not extract {field} from {file}
Using fallback: {default value}
```

---

## Quality Checklist

Before completing meta-command execution:

- [ ] Both files generated successfully
- [ ] Agent workflow includes all phases from tasks.md
- [ ] MCPs correctly mapped to technical domains
- [ ] Skills/Agents correctly identified
- [ ] Success criteria extracted from proposal.md
- [ ] Time estimates preserved from tasks.md
- [ ] Command description is clear
- [ ] Both files use valid YAML frontmatter
- [ ] Markdown formatting is correct

````

---

## Example Execution

**Input**:
```bash
/openspec:agents-gen fix-terminal-initialization-bugs
````

**Analysis**:

- Reads `openspec/changes/fix-terminal-initialization-bugs/proposal.md`
- Reads `openspec/changes/fix-terminal-initialization-bugs/tasks.md`
- Identifies domains: Terminal Lifecycle, WebView, Message Routing
- Identifies MCPs: `github`, `deepwiki`
- Identifies agents: vscode-terminal-resolver, serena-semantic-search, terminal-implementer, etc.

**Output**:

- `.claude/agents/fix-terminal-initialization-bugs-implementer.md` (specialized agent)
- `.claude/commands/implement-fix-terminal-initialization-bugs.md` (slash command)

**Usage After Generation**:

```bash
/implement-fix-terminal-initialization-bugs
# Agent executes full workflow automatically
```

---

## Benefits of This Approach

1. **Consistency**: Every OpenSpec change gets a standardized implementation workflow
2. **Efficiency**: Pre-configured MCPs and Skills reduce manual coordination
3. **Context Preservation**: OpenSpec context embedded in agent (problem, success criteria, scope)
4. **Traceability**: Clear mapping from OpenSpec tasks to agent workflow
5. **Reusability**: Generated command can be run multiple times during implementation
6. **Quality**: Built-in validation and testing phases ensure thorough implementation
