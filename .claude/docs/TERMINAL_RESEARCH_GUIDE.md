# Terminal Research Command - Implementation Guide

## How the Command Works

The `/terminal-research` command is designed to be executed by Claude Code, not by you directly. When invoked, Claude will:

1. Read the command file (`.claude/commands/terminal-research.md`)
2. Execute the workflow defined in the command
3. Invoke the three specialized agents in parallel
4. Synthesize results and provide comprehensive guidance

## Command Invocation

```bash
# In Claude Code, simply type:
/terminal-research How does VS Code handle terminal IME composition?
```

Claude will automatically:
- Launch vscode-terminal-resolver agent
- Launch serena-semantic-search agent
- Launch xterm-info-analyzer agent
- Wait for all agents to complete
- Aggregate and present findings

## Agent Responsibilities

### 1. vscode-terminal-resolver
**Purpose**: Fetch authoritative implementation patterns from VS Code source

**What it does**:
- Searches microsoft/vscode GitHub repository
- Finds terminal-related source files
- Extracts relevant code patterns
- Provides official implementation examples

**Example output**:
```
Found VS Code's IME handling in src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts:
- Uses compositionstart/compositionupdate/compositionend events
- Handles composition state with dedicated flag
- Prevents duplicate input during composition
```

### 2. serena-semantic-search
**Purpose**: Find similar patterns in current codebase using semantic analysis

**What it does**:
- Uses Serena MCP for semantic code search
- Identifies related implementations
- Maps current architectural patterns
- Highlights existing solutions

**Example output**:
```
Found similar IME handling in current codebase:
- src/webview/managers/InputManager.ts:156 - composition event handlers
- Uses isComposing flag similar to VS Code pattern
- Integrates with xterm.js compositionstart/end events
```

### 3. xterm-info-analyzer
**Purpose**: Provide official xterm.js documentation and API guidance

**What it does**:
- Retrieves xterm.js API documentation
- Explains configuration options
- Provides usage examples
- Recommends best practices

**Example output**:
```
Xterm.js Composition Events:
- Terminal.onCompositionStart: Fired when IME composition begins
- Terminal.onCompositionUpdate: Fired during composition
- Terminal.onCompositionEnd: Fired when composition completes
- Recommended: Track composition state to prevent duplicate writes
```

## Expected Workflow Example

### User Query
```
/terminal-research How should I optimize terminal output buffering for AI CLI agents?
```

### Claude's Execution Plan
```markdown
I'll research terminal output buffering by invoking three specialized agents in parallel:

1. vscode-terminal-resolver: Analyze VS Code's buffering strategy
2. serena-semantic-search: Find current buffering implementation
3. xterm-info-analyzer: Get xterm.js write performance recommendations
```

### Agent Results (Parallel Execution)

**vscode-terminal-resolver**:
```
VS Code uses a write buffer with requestAnimationFrame for batching:
- Buffers writes for 16ms (60fps) by default
- Uses Terminal.write() with batched strings
- Implements adaptive buffering for high-frequency output
Reference: src/vs/workbench/contrib/terminal/browser/terminalInstance.ts
```

**serena-semantic-search**:
```
Current implementation in PerformanceManager:
- BUFFER_FLUSH_INTERVAL = 16ms (normal output)
- CLI_AGENT_FLUSH_INTERVAL = 4ms (AI agents)
- Uses requestAnimationFrame for batching
File: src/webview/managers/PerformanceManager.ts:45-67
```

**xterm-info-analyzer**:
```
Xterm.js Performance Best Practices:
- Batch writes using Terminal.write() instead of writeln()
- Use writeUtf8() for binary data (fastest)
- Avoid frequent write calls (< 16ms interval)
- Consider using Terminal.write() with '\n' for line breaks
```

### Synthesized Output
```markdown
## Terminal Research Results: Output Buffering for AI CLI Agents

### VS Code Implementation
VS Code uses 16ms buffering with requestAnimationFrame, which provides 60fps
output rendering. For high-frequency output, they implement adaptive buffering.

### Current Codebase Patterns
Your PerformanceManager already follows VS Code patterns with 16ms normal
buffering. Good optimization: 4ms flush interval for CLI agents (250fps).

File reference: src/webview/managers/PerformanceManager.ts:45-67

### Xterm.js Best Practices
Xterm.js recommends batching writes and using Terminal.write() over writeln().
Current implementation correctly batches output before writing.

### Synthesis & Recommendations
✅ Current implementation aligns with VS Code and xterm.js best practices
✅ CLI agent optimization (4ms) is appropriate for real-time AI output
⚠️ Consider: Adding adaptive buffering like VS Code for extreme scenarios

Suggested enhancement:
```typescript
// src/webview/managers/PerformanceManager.ts
private adaptiveFlushInterval(): number {
  const queueSize = this.outputQueue.length;
  if (queueSize > 1000) return 8; // Slow down if queue is huge
  if (this.isCliAgent) return 4;  // Fast for AI agents
  return 16; // Standard 60fps
}
```
```

## Usage Patterns

### Research Before Implementation
```bash
# Before implementing a new feature
/terminal-research How does VS Code handle terminal tab completion?

# Claude will gather comprehensive guidance before coding
```

### Debug Performance Issues
```bash
# When facing performance problems
/terminal-research What are xterm.js performance optimization techniques?

# Claude will compare VS Code, current code, and official docs
```

### Validate Current Implementation
```bash
# To verify existing code follows best practices
/terminal-research How should terminal process lifecycle be managed?

# Claude will validate current TerminalManager against VS Code patterns
```

## Tips for Effective Queries

### Good Queries (Specific)
- "How does VS Code handle terminal IME composition events?"
- "What are xterm.js best practices for scrollback buffer management?"
- "How should I implement terminal session persistence?"

### Less Effective Queries (Too Broad)
- "How do terminals work?" (Too general)
- "Fix my terminal" (Not research-oriented)
- "What is xterm.js?" (Use docs directly)

### Query Structure
```
/terminal-research [Specific terminal feature/problem] + [Implementation context]

Examples:
/terminal-research How does VS Code restore terminal state after window reload?
/terminal-research What xterm.js addons are recommended for link handling?
/terminal-research How should terminal memory be managed to prevent leaks?
```

## Integration with Development Workflow

### 1. Planning Phase
Use `/terminal-research` to gather requirements and best practices before coding.

### 2. Implementation Phase
Reference the synthesized recommendations and code examples from the research.

### 3. Validation Phase
Use research results to verify implementation aligns with VS Code and xterm.js standards.

### 4. Optimization Phase
Consult research findings when optimizing performance or fixing issues.

## Troubleshooting

### If vscode-terminal-resolver Returns No Results
- Query might be too specific to VS Code internals
- Try broader feature names (e.g., "terminal rendering" vs "xtermTerminal.ts")
- Agent will still provide other perspectives

### If serena-semantic-search Finds Nothing
- Feature might not exist in current codebase yet
- Focus on VS Code and xterm.js guidance for new implementation
- Agent helps identify what's missing

### If xterm-info-analyzer Lacks Information
- Feature might be VS Code-specific, not xterm.js
- Rely on VS Code patterns and current implementation
- Agent clarifies what's available in xterm.js API

## Advanced Usage

### Chaining Research with Implementation
```bash
# Step 1: Research
/terminal-research How does VS Code implement terminal link detection?

# Claude provides comprehensive research

# Step 2: Implement based on findings
# Claude can now code with authoritative guidance
"Based on the research, implement link detection in our terminal"
```

### Comparative Analysis
```bash
/terminal-research Compare VS Code terminal scrollback vs our implementation

# Claude will analyze both codebases and highlight differences
```

## Command Maintenance

### Updating Agent Configurations
If agent behaviors change, update the command file:

```markdown
# .claude/commands/terminal-research.md

### Agent 2: Serena Semantic Search
- Updated to use new Serena MCP query syntax
- Improved semantic matching for terminal components
```

### Adding New Agents
To integrate additional agents, extend the parallel execution section:

```markdown
### Step 2: Parallel Agent Investigation
Execute all FOUR agents concurrently:

**Agent 4: Terminal-Benchmark-Analyzer**
- Compare performance metrics
- Analyze benchmark results
```

## Best Practices

1. **Be Specific**: Clear queries get better results from all agents
2. **Use File References**: Agents provide path:line references - use them
3. **Validate Findings**: Cross-reference agent outputs for consistency
4. **Iterate**: If results aren't helpful, refine query and re-run
5. **Document**: Add research findings to code comments or CLAUDE.md

## Security Considerations

- vscode-terminal-resolver fetches only from public microsoft/vscode repository
- serena-semantic-search operates only on local codebase
- xterm-info-analyzer retrieves documentation, not code
- All agents operate in read-only mode during research

## Performance Notes

- Parallel agent execution minimizes total research time
- Each agent runs independently without blocking others
- Typical research completion: 10-30 seconds for all agents
- Claude aggregates results efficiently without token overflow
