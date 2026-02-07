# Secondary Terminal Documentation

VS Code Sidebar Terminal 拡張機能のドキュメントです。

## Directory Structure

```
docs/
├── api/           # API documentation
├── architecture/  # System architecture & patterns
├── development/   # Development guides (TDD, debugging)
├── features/      # Feature specifications
├── operations/    # CI/CD, releases, rollback
├── research/      # VS Code terminal research
├── security/      # Security documentation
└── testing/       # Testing guides & patterns
```

## Quick Navigation

| Category | Description | Key Documents |
|----------|-------------|---------------|
| [api/](api/) | API reference | [API_DOCUMENTATION.md](api/API_DOCUMENTATION.md) |
| [architecture/](architecture/) | System design | [ARCHITECTURE_ANALYSIS.md](architecture/ARCHITECTURE_ANALYSIS.md) |
| [development/](development/) | Dev guides | [TDD_GUIDELINES.md](development/TDD_GUIDELINES.md), [DEBUG.md](development/DEBUG.md) |
| [features/](features/) | Feature specs | [SPLIT_MODE_SPECIFICATION.md](features/SPLIT_MODE_SPECIFICATION.md) |
| [operations/](operations/) | CI/CD & releases | [RELEASE_PROCESS.md](operations/RELEASE_PROCESS.md) |
| [research/](research/) | VS Code patterns | [README.md](research/README.md) |
| [security/](security/) | Security docs | [SECURITY_AUDIT_REPORT.md](security/SECURITY_AUDIT_REPORT.md) |
| [testing/](testing/) | Test guides | [README.md](testing/README.md) |

## Directory Details

### `/api`
API documentation and TypeDoc reference.
- `API_DOCUMENTATION.md` - API documentation guide

### `/architecture`
System architecture and design patterns.
- `ARCHITECTURE_ANALYSIS.md` - System architecture overview
- `COMPONENT-RELATIONSHIPS.md` - Component dependencies
- `clean-architecture.md` - Clean architecture principles
- `template-method-pattern.md` - Pattern usage
- `rendering-optimization-benchmarks.md` - Performance metrics

### `/development`
Development workflow and debugging guides.
- `TDD_GUIDELINES.md` - TDD guidelines
- `TDD-BEST-PRACTICES.md` - TDD best practices
- `TDD-OPERATIONS-GUIDE.md` - TDD operations
- `DEBUG.md` - Debugging guide
- `logging-guide.md` - Logging guide

### `/features`
Feature specifications and comparisons.
- `ACCESSIBILITY.md` - Accessibility features
- `AGENT_WORKFLOWS.md` - AI agent workflows
- `cli-agent-status-specification.md` - CLI agent detection
- `COMPARISON_WITH_VSCODE_TERMINAL.md` - VS Code comparison
- `SPLIT_MODE_SPECIFICATION.md` - Split mode spec
- `TERMINAL_DISPLAY_MODE_SPEC.md` - Display mode spec

### `/operations`
CI/CD, releases, and operational procedures.
- `CI-CD-INTEGRATION.md` - CI/CD integration
- `RELEASE_PROCESS.md` - Release process
- `AUTOMATED_ROLLBACK_SYSTEM.md` - Automated rollback
- `EMERGENCY_ROLLBACK.md` - Emergency procedures
- `ROLLBACK_QUICK_REFERENCE.md` - Quick reference
- `releases/` - Version-specific release notes

### `/research`
VS Code terminal implementation research.
- Terminal initialization patterns
- WebView message patterns
- Panel location and layout patterns
- xterm.js best practices
- See [research/README.md](research/README.md) for full index

### `/security`
Security documentation and audit reports.
- `SECURITY_AUDIT_REPORT.md` - Security audit report
- `MEMORY_LEAK_PREVENTION.md` - Memory leak prevention

### `/testing`
Testing documentation and guides.
- `getting-started.md` - Getting started
- `best-practices.md` - Best practices
- `troubleshooting.md` - Troubleshooting
- `patterns/` - Testing patterns (unit, integration, e2e)
- `tools/` - Tool guides (vitest, coverage)
- See [testing/README.md](testing/README.md) for full index

## Related Documentation

- **Root**: [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Security**: [SECURITY.md](../SECURITY.md)
- **Test CLAUDE.md**: [src/test/CLAUDE.md](../src/test/CLAUDE.md)
- **WebView CLAUDE.md**: [src/webview/CLAUDE.md](../src/webview/CLAUDE.md)

---
**Last Updated**: 2025-12-24
