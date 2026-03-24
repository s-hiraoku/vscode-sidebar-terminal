---
name: release
description: Bump version in package.json and auto-generate CHANGELOG.md using standard-version for vscode-sidebar-terminal. Triggered by /release or /version commands.
---

# Release Version Update

Bump version and auto-generate CHANGELOG.md for the VS Code extension using `standard-version`.

## Usage

```
/release <version-type>
```

### Version Types

- `patch` - Increment patch version (e.g., 0.3.1 → 0.3.2)
- `minor` - Increment minor version (e.g., 0.3.1 → 0.4.0)
- `major` - Increment major version (e.g., 0.3.1 → 1.0.0)

## Workflow

### Step 1: Read Current Version

```bash
node -p "require('./package.json').version"
```

### Step 2: Check Unreleased Commits

Show commits since the last release tag to verify there are changes to release:

```bash
git log v$(node -p "require('./package.json').version")..HEAD --oneline
```

If there are no commits, warn the user and stop.

### Step 3: Bump Version and Generate CHANGELOG

Use standard-version to bump version in `package.json` and `package-lock.json`, and auto-generate `CHANGELOG.md` from conventional commits:

```bash
npm run release:patch   # for patch
npm run release:minor   # for minor
npm run release:major   # for major
```

This runs `npx standard-version --release-as <type>` which:
- Bumps version in `package.json` and `package-lock.json`
- Generates CHANGELOG.md entries from conventional commit messages
- Creates a commit with the changes
- Does NOT create a tag or push (configured in `.versionrc.cjs`)

### Step 4: Report Results

Display:
- Old version → New version
- CHANGELOG.md diff (new entries)
- Reminder: "Push with `git push`, then create tag after CI passes"

## Important Notes

- **Do NOT create git tags** — that is a separate step done after CI passes
- **Do NOT push** — the user decides when to push
- The `.versionrc.cjs` config maps conventional commits to changelog sections:
  - `feat` → Added
  - `fix` → Fixed
  - `perf`, `refactor`, `docs` → Changed
  - `revert` → Reverted
  - `style`, `test`, `chore`, `ci` → hidden

## File Locations

- Version: `package.json` (`"version"` field)
- Lock file: `package-lock.json` (`"version"` field)
- Changelog: `CHANGELOG.md`
- Config: `.versionrc.cjs`

## Examples

```
/release patch    # 0.3.1 → 0.3.2
/release minor    # 0.3.1 → 0.4.0
/release major    # 0.3.1 → 1.0.0
```
