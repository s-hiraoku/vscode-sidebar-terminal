# E2E Test Fixtures

This directory contains test fixtures and sample data for Playwright E2E tests.

## Directory Structure

```
fixtures/e2e/
├── terminal-output/      # Sample terminal output files
│   ├── ansi-colors.txt   # ANSI color codes for visual testing
│   └── long-output.txt   # Long output for scrollback testing
├── ai-agent-output/      # Mock AI agent startup messages
│   ├── claude-code-startup.txt
│   ├── github-copilot-startup.txt
│   └── gemini-cli-startup.txt
├── configurations/       # Test configuration files
│   ├── default-config.json    # Valid default configuration
│   └── invalid-config.json    # Invalid config for error testing
└── screenshots/          # Baseline screenshots for visual comparison
```

## Usage

### Terminal Output Fixtures

Use these files to test terminal rendering and output processing:

```typescript
import { readFileSync } from 'fs';
import { TEST_PATHS } from '../config/test-constants';

const ansiOutput = readFileSync(
  `${TEST_PATHS.TERMINAL_OUTPUT}/ansi-colors.txt`,
  'utf-8'
);
```

### AI Agent Output Fixtures

Use these files to test AI agent detection patterns:

```typescript
const claudeStartup = readFileSync(
  `${TEST_PATHS.AI_AGENT_OUTPUT}/claude-code-startup.txt`,
  'utf-8'
);
```

### Configuration Fixtures

Use these files to test configuration handling:

```typescript
const defaultConfig = require(`${TEST_PATHS.CONFIGURATIONS}/default-config.json`);
```

## Adding New Fixtures

1. Create files in the appropriate subdirectory
2. Use descriptive file names
3. Add comments in JSON files where needed
4. Update this README with new fixture descriptions

## Maintenance

- Keep fixtures small and focused
- Remove unused fixtures
- Update fixtures when features change
- Version control all fixtures
