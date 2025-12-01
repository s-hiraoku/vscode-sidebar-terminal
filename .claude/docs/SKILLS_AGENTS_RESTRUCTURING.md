# Skills and Agents Restructuring Documentation

This document describes the restructuring of Skills and Agents to eliminate duplication and improve efficiency.

## Background

The project had accumulated redundant Skills and Agents over time, causing:
- Context token waste due to duplicated knowledge
- Confusion about which component to use
- Maintenance burden of keeping multiple sources in sync

## Restructuring Date

2025-11-29

---

## Before Restructuring

### Skills (16 total)

#### MCP-related Skills (5)
| Skill | Lines | Purpose |
|-------|-------|---------|
| `mcp-deepwiki` | ~80 | GitHub repository documentation |
| `mcp-brave-search` | ~80 | Web search guidance |
| `mcp-playwright` | ~120 | Browser automation |
| `mcp-firecrawl` | ~100 | Web scraping |
| `mcp-chrome-devtools` | ~130 | Browser debugging |

#### Terminal-related Skills (2) - **OVERLAP**
| Skill | Lines | Purpose |
|-------|-------|---------|
| `xterm-expert` | **1258** | xterm.js API, addons, performance |
| `vscode-terminal-expert` | **892** | VS Code terminal patterns, PTY integration |

**Issue**: Both skills cover terminal implementation with overlapping content.

#### VS Code Extension Skills (7) - **OVERLAP**
| Skill | Lines | Purpose |
|-------|-------|---------|
| `vscode-extension-expert` | ~600 | General VS Code extension development |
| `vscode-extension-debugger` | ~400 | Debugging VS Code extensions |
| `vscode-extension-refactorer` | ~350 | Refactoring extension code |
| `vscode-webview-expert` | ~500 | WebView implementation |
| `vscode-bug-hunter` | ~300 | Bug detection in extensions |
| `vscode-tdd-expert` | ~400 | Test-driven development |
| `vscode-test-setup` | ~250 | Test environment setup |

**Issue**: Many overlapping concepts across these 7 skills.

#### Other Skills (2)
| Skill | Lines | Purpose |
|-------|-------|---------|
| `skill-creator` | ~200 | Creating new skills |
| (empty slot) | - | - |

### Agents (20 total)

#### Terminal-related Agents (3) - **REDUNDANT**
| Agent | Lines | Function |
|-------|-------|----------|
| `xterm-info-analyzer` | **80** | Queries about xterm.js |
| `vscode-terminal-resolver` | **107** | Resolve terminal implementation issues |
| `terminal-implementer` | ~150 | Implement terminal features |

**Issue**: `xterm-info-analyzer` and `vscode-terminal-resolver` essentially duplicate what Skills already contain.

#### Research/Search Agents (3)
| Agent | Lines | Function |
|-------|-------|----------|
| `serena-semantic-search` | ~100 | Semantic code search |
| `serena-mcp-refactoring` | ~100 | Code refactoring with Serena |
| `similarity-based-refactoring` | ~100 | Pattern-based refactoring |

#### Quality/Testing Agents (2)
| Agent | Lines | Function |
|-------|-------|----------|
| `tdd-quality-engineer` | ~150 | TDD implementation |
| `playwright-test-*` | ~100 | Playwright test management (3 agents) |

#### Infrastructure Agents (9)
| Agent | Lines | Function |
|-------|-------|----------|
| `security-auditor` | ~100 | Security analysis |
| `memory-leak-detector` | ~100 | Memory leak detection |
| `platform-compatibility-tester` | ~100 | Cross-platform testing |
| `vscode-api-validator` | ~100 | VS Code API validation |
| `terminal-performance-analyzer` | ~100 | Performance analysis |
| `webview-stability-investigator` | ~100 | WebView stability |
| `openspec-scaffolder` | ~80 | OpenSpec scaffolding |
| `release-manager` | ~100 | Release management |
| `lsmc-coding-agent` | ~100 | LSMC protocol coding |

#### Guide/Helper Agents (3)
| Agent | Lines | Function |
|-------|-------|----------|
| `claude-code-guide` | ~100 | Claude Code documentation |
| `Explore` | ~50 | Codebase exploration |
| `Plan` | ~50 | Task planning |

### Token Usage Analysis (Before)

| Category | Estimated Tokens |
|----------|-----------------|
| MCP Skills | ~2,500 |
| Terminal Skills (2) | **~10,750** (duplicated) |
| VS Code Skills (7) | **~14,000** (overlapping) |
| Agents (20) | ~10,000 |
| **Total** | **~37,250** |

---

## After Restructuring

### Skills (7 total)

#### MCP-related Skills (5) - No change
| Skill | Lines | Purpose |
|-------|-------|---------|
| `mcp-deepwiki` | ~80 | GitHub repository documentation |
| `mcp-brave-search` | ~80 | Web search guidance |
| `mcp-playwright` | ~120 | Browser automation |
| `mcp-firecrawl` | ~100 | Web scraping |
| `mcp-chrome-devtools` | ~130 | Browser debugging |

#### Terminal Skill (1) - **CONSOLIDATED**
| Skill | Lines | Purpose |
|-------|-------|---------|
| `terminal-expert` | **~1,500** | Unified xterm.js + VS Code terminal knowledge |

**Change**: Merged `xterm-expert` and `vscode-terminal-expert` into single `terminal-expert`.

#### VS Code Extension Skill (1) - **CONSOLIDATED**
| Skill | Lines | Purpose |
|-------|-------|---------|
| `vscode-extension-expert` | **~800** | Core extension development (references other skills on-demand) |

**Change**: Kept core knowledge in main skill, other specialized skills referenced on-demand.

### Agents (12 total)

#### Terminal Agent (1) - **REDUCED from 3**
| Agent | Lines | Function |
|-------|-------|----------|
| `terminal-implementer` | ~150 | Implements terminal features, **invokes `terminal-expert` Skill** |

**Change**: Removed `xterm-info-analyzer` and `vscode-terminal-resolver`. Their functionality is now provided by `terminal-expert` Skill invoked by `terminal-implementer`.

#### Research/Search Agents (3) - No change
| Agent | Lines | Function |
|-------|-------|----------|
| `serena-semantic-search` | ~100 | Semantic code search |
| `serena-mcp-refactoring` | ~100 | Code refactoring with Serena |
| `similarity-based-refactoring` | ~100 | Pattern-based refactoring |

#### Quality/Testing Agents (2) - No change
| Agent | Lines | Function |
|-------|-------|----------|
| `tdd-quality-engineer` | ~150 | TDD implementation, **invokes `vscode-tdd-expert` Skill** |
| `playwright-test-healer` | ~100 | Playwright test debugging |

#### Infrastructure Agents (6) - **REDUCED from 9**
| Agent | Lines | Function |
|-------|-------|----------|
| `security-auditor` | ~100 | Security analysis |
| `memory-leak-detector` | ~100 | Memory leak detection |
| `platform-compatibility-tester` | ~100 | Cross-platform testing |
| `release-manager` | ~100 | Release management |
| `openspec-scaffolder` | ~80 | OpenSpec scaffolding |
| `webview-stability-investigator` | ~100 | WebView stability |

**Change**: Removed `vscode-api-validator`, `terminal-performance-analyzer`, `lsmc-coding-agent` (functionality covered by Skills).

### Token Usage Analysis (After)

| Category | Estimated Tokens |
|----------|-----------------|
| MCP Skills | ~2,500 |
| Terminal Skill (1) | **~7,500** (30% reduction) |
| VS Code Skills | **~4,000** (70% reduction) |
| Agents (12) | ~6,000 |
| **Total** | **~20,000** |

---

## Effects of Restructuring

### 1. Token Reduction

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Skills | 16 | 7 | **56% reduction** |
| Total Agents | 20 | 12 | **40% reduction** |
| Estimated Tokens | ~37,250 | ~20,000 | **~46% reduction** |

### 2. Clarity Improvement

| Aspect | Before | After |
|--------|--------|-------|
| Terminal guidance | 2 Skills + 3 Agents (confusing) | 1 Skill + 1 Agent (clear) |
| VS Code extension | 7 Skills (overlapping) | 1 Skill + on-demand references |
| MCP usage | Direct tool calls (wasteful) | Skills guide usage |

### 3. Maintenance Improvement

| Aspect | Before | After |
|--------|--------|-------|
| Update locations | Multiple files for same topic | Single authoritative source |
| Consistency risk | High (sync issues) | Low (single source) |
| Knowledge location | Scattered | Centralized in Skills |

### 4. Agent-Skill Pattern

**New Pattern**: Agents invoke Skills for domain knowledge instead of duplicating it.

```
[User Request]
      │
      ▼
[Agent: terminal-implementer]
      │
      ├──▶ [Skill: terminal-expert]  ← Domain knowledge
      │
      └──▶ [Implementation]  ← Execution
```

**Benefits**:
- Agents remain lightweight (execution logic only)
- Skills contain comprehensive knowledge (single source of truth)
- Easy to update knowledge without changing agents
- Reduced context usage (Skills loaded on-demand)

---

## Migration Notes

### Removed Components

| Component | Reason | Replacement |
|-----------|--------|-------------|
| `xterm-info-analyzer` Agent | Redundant with Skill | Use `terminal-expert` Skill |
| `vscode-terminal-resolver` Agent | Redundant with Skill | Use `terminal-expert` Skill |
| `xterm-expert` Skill | Merged | Use `terminal-expert` Skill |
| `vscode-terminal-expert` Skill | Merged | Use `terminal-expert` Skill |

### Updated Agent Prompts

Agents now include Skill invocation instructions:

```markdown
## Implementation Workflow

1. **Invoke terminal-expert Skill** for domain knowledge
2. **Research** existing codebase patterns
3. **Implement** following VS Code patterns
4. **Test** implementation
```

---

## References

- Original MCP context usage: ~43.6k tokens (21.8% of context)
- After MCP Skills creation: ~5k tokens for MCP guidance (on-demand)
- After full restructuring: ~20k tokens total for Skills + Agents
