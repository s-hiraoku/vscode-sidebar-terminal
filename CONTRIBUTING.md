# Contributing to VS Code Sidebar Terminal

Thank you for your interest in contributing to VS Code Sidebar Terminal! This document provides guidelines for contributing to the project.

## Code Quality Standards

### Comment Guidelines

To maintain code quality and readability, please follow these comment guidelines:

#### TODO Comments

All TODO comments must include:
- An issue number reference: `TODO(#issue-number)`
- A clear, concise explanation of what needs to be done
- Context about why it's needed

**Good examples:**
```typescript
// TODO(#227): Extract settings logic into a dedicated SettingsService
// This should be handled by a SettingsService rather than delegating to the provider

// TODO(#123): Implement caching for terminal state
// Cache terminal state to improve performance during frequent state updates
```

**Bad examples:**
```typescript
// TODO: Fix this
// TODO: Refactor

// TODO: Move this somewhere else
```

#### Commented-Out Code

- **Never commit commented-out code** without a clear reason and timeline
- If code must be temporarily commented out, add:
  - An issue reference
  - The date it was commented
  - Expected timeline for resolution

**Example:**
```typescript
// TODO(#227): Re-enable after refactoring ConfigManager interface (commented 2024-11-12)
// Expected to be resolved by end of Q4 2024
// configManager.updateConfig({ debounceMs: 10 });
```

- Code commented out for more than 3 months should be removed
- Use git history if you need to reference old code

#### Backup Files

- **Never commit backup files** (.bak, .orig, .swp, ~, etc.)
- A pre-commit hook is in place to prevent this
- Add backup patterns to `.gitignore` if needed

### Code Style

- Follow the ESLint configuration in `.eslintrc.json`
- Use Prettier for code formatting
- Write TypeScript with strict type checking
- Include JSDoc comments for public APIs

### Testing

- Write tests for new features and bug fixes
- Ensure all tests pass before submitting a PR
- Aim for high test coverage

## Pull Request Process

1. Fork the repository and create a new branch from `for-publish`
2. Make your changes following the guidelines above
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Commit your changes with clear, descriptive commit messages
6. Push to your fork and submit a pull request to the `for-publish` branch
7. Ensure the PR description clearly describes the problem and solution

## Commit Message Guidelines

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```
refactor(sessions): Remove dead code and improve comment quality

- Removed 200+ lines of commented-out code
- Updated TODO comments with issue references
- Added pre-commit hook to prevent .bak files

Closes #227
```

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run compile`
4. Run tests: `npm test`
5. Start debugging: Press F5 in VS Code

## Questions?

If you have questions, please open an issue on GitHub.

Thank you for contributing! 🎉
