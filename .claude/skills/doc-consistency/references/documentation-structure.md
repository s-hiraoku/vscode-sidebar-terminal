# Documentation Structure Reference

This document describes the documentation structure for vscode-sidebar-terminal project.

## Documentation Hierarchy

```
Project Root
├── README.md              # User-facing documentation (EN)
├── CHANGELOG.md           # Version history
├── CLAUDE.md              # AI assistant development guide
├── PRIVACY.md             # Privacy policy
├── docs/
│   ├── README_ja.md       # Japanese README
│   ├── architecture/      # Architecture documentation
│   └── research/          # Research and investigation notes
├── src/
│   ├── webview/CLAUDE.md  # WebView implementation guide
│   └── test/CLAUDE.md     # TDD implementation guide
└── .claude/
    ├── docs/              # Claude Code specific documentation
    ├── skills/            # Skill definitions
    └── agents/            # Agent definitions
```

## Document Categories

### 1. User-Facing Documentation

| File | Purpose | Audience |
|------|---------|----------|
| README.md | Primary documentation, features, installation | End users |
| docs/README_ja.md | Japanese version | Japanese users |
| CHANGELOG.md | Release history and changes | Users, contributors |
| PRIVACY.md | Privacy policy | Users concerned about data |

### 2. Developer Documentation

| File | Purpose | Audience |
|------|---------|----------|
| CLAUDE.md | Development commands, architecture, guidelines | AI assistants, developers |
| src/webview/CLAUDE.md | WebView implementation patterns | AI assistants, developers |
| src/test/CLAUDE.md | TDD workflow and patterns | AI assistants, developers |

### 3. Architecture Documentation

| File | Purpose | Update Frequency |
|------|---------|-----------------|
| docs/architecture/ARCHITECTURE_ANALYSIS.md | Overall architecture | Major changes |
| docs/architecture/COMPONENT-RELATIONSHIPS.md | Component relationships | Structural changes |
| docs/architecture/clean-architecture.md | Design principles | Rarely |

### 4. Research Documentation

| File | Purpose | When to Update |
|------|---------|----------------|
| docs/research/*.md | Investigation findings | After research tasks |

## Documentation Update Triggers

### README.md Updates Required

- New feature added
- Feature behavior changed
- Keyboard shortcuts modified
- Configuration options added/changed
- Installation method changed
- Performance characteristics changed

### CHANGELOG.md Updates Required

- Every release (required)
- Format: Keep a Changelog + Semantic Versioning
- Sections: Added, Changed, Fixed, Deprecated, Removed, Security

### CLAUDE.md Updates Required

- New development commands added
- Architecture patterns changed
- Testing strategy modified
- Security patterns updated
- Performance settings changed
- Release process modified

### Domain-Specific CLAUDE.md Updates

- src/webview/CLAUDE.md: WebView manager changes, new patterns
- src/test/CLAUDE.md: Test framework changes, new patterns

## Code-Documentation Synchronization Points

### Critical Files to Cross-Reference

| Code File | Documentation | What to Sync |
|-----------|---------------|--------------|
| package.json | README.md, CHANGELOG.md | Version, features |
| src/extension.ts | README.md | Commands, activation |
| src/webview/main.ts | CLAUDE.md, src/webview/CLAUDE.md | Manager architecture |
| src/terminals/TerminalManager.ts | CLAUDE.md | Terminal management patterns |
| src/test/**/*.test.ts | src/test/CLAUDE.md | Test patterns |

### Configuration Sync Points

| Code | Documentation | Items |
|------|---------------|-------|
| package.json contributes.configuration | README.md Configuration section | Settings names, defaults, descriptions |
| package.json contributes.keybindings | README.md Keyboard Shortcuts | Shortcuts, platforms |
| package.json contributes.commands | README.md Command Palette | Command names, descriptions |

## Language Considerations

### English (Primary)

- README.md
- CHANGELOG.md
- CLAUDE.md
- All .claude/ documentation

### Japanese (Secondary)

- docs/README_ja.md
- src/webview/CLAUDE.md (currently Japanese, consider translating)
- src/test/CLAUDE.md (currently Japanese, consider translating)

### Synchronization Strategy

When updating English documentation, check if Japanese equivalent needs updating:
- README.md <-> docs/README_ja.md
