# Documentation Verification Checklist

This checklist helps verify documentation consistency with implementation.

## Quick Verification Commands

```bash
# Get current version from package.json
node -p "require('./package.json').version"

# List all commands in package.json
node -p "require('./package.json').contributes.commands.map(c => c.command).join('\n')"

# List all configuration options
node -p "Object.keys(require('./package.json').contributes.configuration.properties).join('\n')"

# List all keybindings
node -p "require('./package.json').contributes.keybindings.map(k => k.key + ' -> ' + k.command).join('\n')"
```

## Pre-Release Documentation Checklist

### Version Numbers

- [ ] package.json version matches release
- [ ] CHANGELOG.md has entry for new version
- [ ] README.md version badge will auto-update (no action needed)

### Feature Documentation

For each new feature:

- [ ] Feature described in README.md
- [ ] Added to CHANGELOG.md under correct section
- [ ] If architecture change, updated CLAUDE.md
- [ ] If WebView change, consider src/webview/CLAUDE.md
- [ ] If test pattern change, consider src/test/CLAUDE.md

### Configuration Options

For each new/changed config:

- [ ] Listed in README.md Configuration section
- [ ] Default value documented correctly
- [ ] Description matches package.json

### Keyboard Shortcuts

For each new/changed shortcut:

- [ ] Listed in README.md Keyboard Shortcuts
- [ ] Platform-specific keys documented (Mac/Win/Linux)
- [ ] Description matches actual behavior

### Commands

For each new/changed command:

- [ ] Listed in README.md Command Palette section
- [ ] Command ID matches package.json

## Consistency Verification Steps

### Step 1: Version Check

```bash
# Verify CHANGELOG has current version
grep -q "## \[$(node -p 'require("./package.json").version')\]" CHANGELOG.md && echo "✓ Version in CHANGELOG" || echo "✗ Missing version in CHANGELOG"
```

### Step 2: Command Documentation Check

```bash
# List undocumented commands
node -e "
const pkg = require('./package.json');
const fs = require('fs');
const readme = fs.readFileSync('README.md', 'utf8');
pkg.contributes.commands.forEach(cmd => {
  if (!readme.includes(cmd.command.replace('secondaryTerminal.', ''))) {
    console.log('Undocumented:', cmd.command);
  }
});
"
```

### Step 3: Configuration Documentation Check

```bash
# List undocumented configs
node -e "
const pkg = require('./package.json');
const fs = require('fs');
const readme = fs.readFileSync('README.md', 'utf8');
Object.keys(pkg.contributes.configuration.properties).forEach(key => {
  if (!readme.includes(key)) {
    console.log('Undocumented config:', key);
  }
});
"
```

### Step 4: Architecture Consistency Check

Verify these architecture descriptions match implementation:

| Description in CLAUDE.md | Verify in Code |
|--------------------------|----------------|
| Manager-Coordinator pattern | src/webview/main.ts structure |
| TerminalManager singleton | src/terminals/TerminalManager.ts |
| ID Recycling System | TerminalManager ID allocation |
| Session Persistence | src/sessions/ implementation |

### Step 5: Performance Metrics Verification

Documented performance values in README.md/CLAUDE.md should match actual measurements:

| Metric | Document Location | How to Verify |
|--------|-------------------|---------------|
| Build size | README.md | `ls -lh out/*.js` |
| Buffer interval | CLAUDE.md | Check PerformanceManager constant |
| Session save interval | CLAUDE.md | Check SessionManager constant |
| Scrollback limit | CLAUDE.md | Check configuration default |

## Common Documentation Drift Patterns

### 1. New Features Not Documented

**Symptom**: Feature exists in code but not in README.md

**Detection**:
```bash
# Check recent commits for feature additions
git log --oneline --since="2 weeks ago" | grep -i "add\|feat\|new"
```

**Fix**: Add to README.md features section and CHANGELOG.md

### 2. Outdated Architecture Diagrams

**Symptom**: Manager list in CLAUDE.md doesn't match actual managers

**Detection**:
```bash
# List actual managers
ls src/webview/managers/
```

**Fix**: Update manager hierarchy in CLAUDE.md

### 3. Configuration Defaults Changed

**Symptom**: Default value in docs differs from package.json

**Detection**: Run configuration check script above

**Fix**: Update README.md Configuration section

### 4. Keyboard Shortcuts Modified

**Symptom**: Documented shortcut doesn't work or works differently

**Detection**: Run keybindings check, test manually

**Fix**: Update README.md Keyboard Shortcuts table

### 5. Japanese Documentation Out of Sync

**Symptom**: README.md and docs/README_ja.md have different features listed

**Detection**: Compare feature sections manually

**Fix**: Update docs/README_ja.md to match README.md

## Automated Checks

### GitHub Actions Integration

```yaml
# Example workflow job for doc consistency
doc-consistency:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Check version in CHANGELOG
      run: |
        VERSION=$(node -p "require('./package.json').version")
        grep -q "## \[$VERSION\]" CHANGELOG.md || exit 1
```

### Pre-commit Hook (Optional)

```bash
#!/bin/bash
# .git/hooks/pre-commit
if git diff --cached --name-only | grep -q "package.json"; then
  echo "package.json changed - verify documentation is updated"
  # Could add automatic checks here
fi
```
