---
description: Run CodeRabbit CLI review with smart mode selection
argument-hint: [prompt|plain|custom-flags]
---

# Run CodeRabbit CLI

Run CodeRabbit CLI review with automatic mode selection based on arguments.

**Default behavior (no arguments or "prompt"):**
- Runs `coderabbit review --prompt-only`
- Optimized for AI agent integration and Claude Code workflows
- Provides concise, actionable feedback

**Plain mode:**
- Use argument "plain" to run `coderabbit review --plain`
- Provides detailed human-readable feedback with fix suggestions

**Custom arguments:**
- Any other arguments are passed directly to `coderabbit review`

**Examples:**
- `/coderabbit` → `coderabbit review --prompt-only`
- `/coderabbit prompt` → `coderabbit review --prompt-only`
- `/coderabbit plain` → `coderabbit review --plain`

**Requirements:**
- CodeRabbit CLI must be installed: `curl -fsSL https://cli.coderabbit.ai/install.sh | sh`
- Must be in a git repository with changes to review

```bash
if [ "$ARGUMENTS" = "" ] || [ "$ARGUMENTS" = "prompt" ]; then
    coderabbit review --prompt-only
elif [ "$ARGUMENTS" = "plain" ]; then
    coderabbit review --plain
else
    coderabbit review $ARGUMENTS
fi
```