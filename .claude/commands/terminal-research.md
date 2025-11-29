---
description: Research terminal implementation using multiple AI agents
argument-hint: <query>
---

# Terminal Research Command

Research terminal implementation by invoking three specialized agents in parallel.

## Execution Instructions

When this command is invoked with a query (e.g., `/terminal-research How does VS Code handle IME?`):

1. **Launch three agents in parallel** using a single message with multiple Task tool calls:

   **Agent 1: vscode-terminal-resolver**
   - Task description: "Analyze VS Code terminal implementation"
   - Prompt: "Search the VS Code repository for how it handles: {ARGUMENTS}. Focus on terminal-related source code in src/vs/workbench/contrib/terminal/. Provide code references and implementation patterns."

   **Agent 2: serena-semantic-search**
   - Task description: "Search codebase semantically"
   - Prompt: "Use Serena MCP to semantically search the current codebase for implementations related to: {ARGUMENTS}. Focus on terminal managers, WebView components, and xterm.js integrations. Provide file paths and line numbers."

   **Agent 3: xterm-info-analyzer**
   - Task description: "Get xterm.js documentation"
   - Prompt: "Retrieve xterm.js documentation and best practices for: {ARGUMENTS}. Include API references, configuration options, and usage examples."

2. **Wait for all agents** to complete their tasks

3. **Synthesize results** into a comprehensive report with this structure:

```markdown
## Terminal Research Results: {ARGUMENTS}

### VS Code Implementation
{vscode-terminal-resolver findings}
- Key patterns
- Code references (file:line)

### Current Codebase
{serena-semantic-search findings}
- Existing implementations
- File references (file:line)

### Xterm.js Best Practices
{xterm-info-analyzer findings}
- API documentation
- Configuration recommendations

### Synthesis & Recommendations
- Compare approaches (VS Code vs current vs xterm.js)
- Identify gaps or improvements
- Provide actionable next steps with code references
```

## Example Usage

```bash
/terminal-research How does VS Code handle IME composition events?
/terminal-research What are xterm.js performance optimization techniques?
/terminal-research How should terminal process lifecycle be managed?
```

## Important Notes

- **Always launch all three agents in parallel** (single message, multiple Task calls)
- Use the exact agent names: `vscode-terminal-resolver`, `serena-semantic-search`, `xterm-info-analyzer`
- Replace `{ARGUMENTS}` with the actual user query
- Request concise summaries from each agent (100-200 words)
- Provide file:line references in the synthesis section

## Agent Capabilities

**vscode-terminal-resolver**
- Searches microsoft/vscode GitHub repository
- Focuses on terminal implementation patterns
- Provides authoritative VS Code source code

**serena-semantic-search**
- Uses Serena MCP for semantic code search
- Finds similar patterns in current codebase
- Maps existing architectural decisions

**xterm-info-analyzer**
- Retrieves official xterm.js documentation
- Explains API usage and configuration
- Recommends best practices

## Documentation

For detailed usage guide, see: `.claude/docs/TERMINAL_RESEARCH_GUIDE.md`
