---
name: code-simplifier
description: "Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality. This skill should be used after implementing features or bug fixes to clean up code, when refactoring for readability, or when reducing unnecessary complexity. It launches the code-simplifier subagent provided by the code-simplifier@claude-plugins-official plugin."
---

# Code Simplifier

This skill launches the `code-simplifier` subagent (provided by the `code-simplifier@claude-plugins-official` plugin installed in user scope) to simplify and refine code while preserving all functionality.

## When to Use

- After implementing a feature or bug fix, to clean up the resulting code
- When code has grown overly complex and needs simplification
- When the user requests code cleanup, simplification, or readability improvements
- To remove unnecessary abstractions, redundant logic, or dead code
- To improve naming, reduce nesting, and streamline control flow

## Workflow

### Step 1: Identify Target Files

Determine which files to simplify. By default, focus on recently modified files in the current branch:

```bash
git diff --name-only HEAD~1  # Files changed in last commit
git diff --name-only         # Uncommitted changes
```

If the user specifies particular files or directories, use those instead.

### Step 2: Launch the Subagent

Invoke the `code-simplifier` subagent via the Task tool with `subagent_type: "code-simplifier"`:

```
Task tool call:
  subagent_type: "code-simplifier"
  description: "Simplify recently modified code"
  prompt: "Simplify and refine the following files: <file list>. Preserve all existing functionality."
```

The subagent is an Opus-powered specialist that:
- Preserves exact functionality while improving how code is written
- Applies project standards from CLAUDE.md (ES modules, naming conventions, etc.)
- Reduces unnecessary complexity and nesting
- Avoids nested ternary operators, preferring switch/if-else for clarity
- Chooses clarity over brevity

### Step 3: Prompt Construction

Include in the prompt:
- The specific files or code areas to simplify
- Any constraints (e.g., "preserve the public API", "do not change test files")
- The type of simplification needed (e.g., "reduce nesting", "improve naming", "remove dead code")

#### Example Invocations

**After a feature implementation:**
```
Task tool:
  subagent_type: "code-simplifier"
  description: "Simplify header factory code"
  prompt: "Simplify the recently modified files in the current branch. Files: src/webview/factories/HeaderFactory.ts, src/webview/managers/UIManager.ts. Preserve all functionality. Focus on reducing complexity and improving readability."
```

**Targeted cleanup:**
```
Task tool:
  subagent_type: "code-simplifier"
  description: "Simplify TerminalManager dispose"
  prompt: "Simplify src/terminal/TerminalManager.ts. The dispose() method has grown too complex. Reduce nesting, extract helper functions if needed, and improve variable naming. Do not change the public API."
```

**Branch-wide cleanup:**
```
Task tool:
  subagent_type: "code-simplifier"
  description: "Simplify all changed files"
  prompt: "Review and simplify all TypeScript files changed in the current branch compared to main. Run: git diff --name-only main...HEAD -- '*.ts' to find changed files. Preserve all functionality and tests."
```

### Step 4: Review Results

After the subagent completes:
1. Review the changes for correctness
2. Run tests to verify functionality is preserved: `npm run test:unit`
3. Run the linter to verify code quality: `npm run lint`
