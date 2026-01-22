# Documentation Writing Guidelines

This document provides guidelines for writing consistent, high-quality documentation.

## General Principles

### 1. Accuracy First

Documentation must accurately reflect the current implementation. Outdated documentation is worse than no documentation.

### 2. User-Centric Approach

Write from the user's perspective:
- What problem does this solve?
- How do I use this feature?
- What should I expect?

### 3. Conciseness

Be concise without sacrificing clarity. Users skim documentation.

## README.md Guidelines

### Structure

```markdown
# Product Name

[Badges]

**One-line description** - Expanded description (2-3 sentences max).

> Note/Warning if applicable

[Hero Image]

## Quick Start
- Installation (numbered steps)
- First use (numbered steps)

## Key Features
- Organized in tables or bullet points
- Group related features

## Keyboard Shortcuts
- Table format with Shortcut | Action columns
- Platform-specific (Mac/Win/Linux)

## Configuration
- JSON code blocks with comments
- Group related settings

## Troubleshooting
- Common issues with solutions

## Development
- Build/test commands

## Links
- Marketplace, GitHub, Changelog
```

### Writing Style

- **Headlines**: Use sentence case ("Key features" not "Key Features")
- **Lists**: Parallel structure (start all items same way)
- **Code**: Use fenced code blocks with language specifier
- **Tables**: Align columns, use header row
- **Links**: Descriptive text, not "click here"

### Feature Descriptions

Good:
```markdown
| Feature | Description |
|---------|-------------|
| **Session Persistence** | Auto-save/restore sessions with 1,000 lines scrollback |
```

Avoid:
```markdown
- Session Persistence: The extension saves sessions automatically and can restore them later with up to 1000 lines of scrollback history being preserved.
```

## CHANGELOG.md Guidelines

### Format (Keep a Changelog)

```markdown
# Changelog

## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Fixed
- Bug fixes

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Security
- Security fixes
```

### Entry Style

Good:
```markdown
### Fixed

- **TUI Display Height in Split Mode**: Fixed TUI applications displaying with reduced height when terminal is split (#368)
  - Detailed technical explanation if helpful
  - Additional context
```

Avoid:
```markdown
### Fixed

- fixed bug with TUI height
```

### Rules

1. Most recent release at top
2. Always include date (YYYY-MM-DD)
3. Link to GitHub issues/PRs when relevant
4. Group changes by type
5. Start entries with verb (Added, Fixed, Changed)

## CLAUDE.md Guidelines

### Purpose

Guide AI assistants and developers working on the codebase.

### Structure

```markdown
## Development Flow (Mandatory)
[Required workflow]

## Essential Development Commands
[Frequently used commands with examples]

## Architecture Overview
[High-level system design]

## Development Guidelines
[Best practices, patterns]

## Known Issues & Workarounds
[Common problems and solutions]

## Performance Optimization
[Settings, benchmarks]

## Testing Strategy
[Test commands, TDD workflow]

## Emergency Response
[Rollback procedures]
```

### Style

- Use code blocks with bash syntax highlighting
- Include both commands and expected outcomes
- Group related commands together
- Use tables for reference information
- Include file paths for cross-references

### Critical Information Highlighting

```markdown
**NEVER delete or discard uncommitted local changes without explicit user permission.**

> **Note**: This is important information users should know.

### ❌ Don't
```typescript
// Bad pattern
```

### ✅ Do
```typescript
// Good pattern
```
```

## Domain-Specific CLAUDE.md (src/*/CLAUDE.md)

### Purpose

Provide focused guidance for specific parts of the codebase.

### Language

Choose based on primary audience:
- English: International contributors, AI assistants
- Japanese: Japanese-focused teams

Consider translating Japanese files to English for broader accessibility.

### Content

Focus on:
- Architecture specific to that domain
- Implementation patterns
- Common pitfalls
- Debugging strategies
- Checklists

## Table Formatting

### Standard Table

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
```

### Aligned Values

```markdown
| Metric              | Value           |
|---------------------|-----------------|
| Build Size          | ~790 KiB        |
| Buffer Interval     | 16ms            |
| Session Save        | 5 minutes       |
```

## Code Examples

### Command Examples

```bash
# Comment explaining what this does
npm run compile
```

### Configuration Examples

```json
{
  "settingName": "value",  // Comment if needed
  "anotherSetting": true
}
```

### Code Pattern Examples

```typescript
// Brief description of pattern
function example() {
  // Implementation
}
```

## Cross-References

### Internal Links

```markdown
See [PRIVACY.md](PRIVACY.md) for details.
See [Architecture](#architecture) section above.
```

### File References

```markdown
Located in `src/webview/managers/SplitManager.ts`
```

### Code References

```markdown
The `TerminalManager.createTerminal()` method handles this.
```

## Accessibility

- Use descriptive alt text for images
- Ensure color is not the only way information is conveyed
- Use semantic markdown (headers, lists)
- Keep line length reasonable (~80-100 chars)

## Maintenance

### Review Triggers

- After each release
- After major features
- After architecture changes
- Quarterly review of all documentation

### Update Process

1. Identify what changed in code
2. Find all affected documentation
3. Update documentation
4. Verify with checklist
5. Commit documentation with related code changes
