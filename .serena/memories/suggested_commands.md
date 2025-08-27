# Suggested Commands for VS Code Sidebar Terminal Development

## Build and Compilation
```bash
npm run compile           # Build extension and webview
npm run watch            # Watch mode for development
npm run package          # Production build with optimizations
npm run compile-tests    # Compile test files only
npm run watch-tests      # Watch test files
```

## Testing Commands (CRITICAL - TDD Required)
```bash
npm test                 # Run unit tests only (recommended for development)
npm run test:unit       # Run unit tests explicitly
npm run test:coverage   # Run tests with coverage reporting
npm run pretest         # Compile tests + build + lint (runs before test)

# TDD Workflow Commands
npm run tdd:interactive  # Interactive TDD workflow
npm run tdd:red         # Verify failing tests
npm run tdd:green       # Verify passing tests
npm run tdd:refactor    # Quality check after refactoring
npm run tdd:check-quality    # Comprehensive quality analysis
npm run tdd:quality-gate     # CI/CD quality gate check
```

## Code Quality
```bash
npm run lint            # ESLint checking (MUST pass before commit)
npm run format          # Prettier formatting
```

## VS Code Development
- Press `F5` to launch Extension Development Host
- Use "Developer: Reload Window" command to reload during development
- Console logs visible in VS Code Developer Tools (`Ctrl+Shift+I`)

## Extension Packaging and Release
```bash
npm run vsce:package    # Create .vsix package
npm run vsce:publish    # Publish to marketplace

# Platform-specific builds
npm run vsce:package:darwin-arm64   # macOS Apple Silicon
npm run vsce:package:darwin-x64     # macOS Intel
npm run vsce:package:win32-x64      # Windows 64-bit
npm run vsce:package:linux-x64      # Linux 64-bit

# Release Management (includes quality gates)
npm run release:patch   # Increment patch version and create release
npm run release:minor   # Increment minor version and create release
npm run release:major   # Increment major version and create release
```

## Darwin (macOS) System Commands
```bash
# File operations
ls -la              # List files with details
find . -name "*.ts" # Find TypeScript files
grep -r "pattern"   # Search for pattern recursively

# Git operations
git status          # Check git status
git diff            # View changes
git add .           # Stage changes
git commit -m "msg" # Commit with message
git push            # Push to remote

# Process management
ps aux | grep node  # Find node processes
lsof -i :3000      # Check port usage
```

## Critical Pre-Commit Checklist
1. Run `npm test` - All tests MUST pass
2. Run `npm run lint` - Zero errors required
3. Run `npm run format` - Ensure code formatting
4. Run `npm run compile` - No TypeScript errors
5. Update tests for any new functionality