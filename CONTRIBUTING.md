# Contributing to VS Code Sidebar Terminal

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## 🚀 Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### 📋 Before You Start

1. Check existing [Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
2. Check existing [Pull Requests](https://github.com/s-hiraoku/vscode-sidebar-terminal/pulls)
3. Read this contributing guide
4. Set up your development environment

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- VS Code 1.74.0+
- Git

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/vscode-sidebar-terminal.git
cd vscode-sidebar-terminal

# Install dependencies
npm install

# Compile the extension
npm run compile

# Start development in watch mode
npm run watch
```

### 🧪 Testing Your Changes

#### Running Tests

```bash
# Run all tests
npm test

# Run unit tests with coverage
npm run test:unit

# Compile tests only
npm run compile-tests

# Watch test files for changes
npm run watch-tests

# Run linter
npm run lint

# Format code
npm run format

# Create production build
npm run package
```

#### Debugging in VS Code

For detailed debugging instructions, including how to launch the extension, check logs, and troubleshoot common issues, please refer to the [Debugging Guide (Japanese)](DEBUG.md).

## 📝 Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Follow the existing code style
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass

### 3. Commit Your Changes

We use [Conventional Commits](https://conventionalcommits.org/):

```bash
git commit -m "feat: add new terminal split functionality"
git commit -m "fix: resolve backspace key handling issue"
git commit -m "docs: update installation instructions"
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Formatting, missing semi colons, etc
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Changes to build process or auxiliary tools

### 4. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Link to related issues
- Screenshots/GIFs if UI changes
- Test instructions

## 🎯 Coding Standards

### TypeScript

- Use strict TypeScript settings
- Provide explicit types for function parameters and return values
- Avoid `any` types - use proper interfaces
- Use meaningful variable names

### Code Style

- Follow ESLint and Prettier rules
- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for complex functions

### Architecture

- Follow the existing project structure:
  ```
  src/
  ├── constants/     # Constants and enums
  ├── providers/     # VS Code providers
  ├── terminals/     # Terminal management
  ├── types/         # TypeScript interfaces
  ├── utils/         # Utility functions
  ├── webview/       # Frontend code
  └── extension.ts   # Entry point
  ```

### Testing

- Write unit tests for new functionality
- Test terminal functionality manually
- Ensure cross-platform compatibility
- Test with different shells (bash, zsh, PowerShell, cmd)

## 🔒 Security Guidelines

Security is a top priority for this project. Please follow these guidelines when contributing:

### Never Commit Credentials

**CRITICAL**: Never commit any of the following:
- API keys, tokens, or passwords
- Private keys or certificates (`.pem`, `.key`, `.p12`, `.pfx`)
- Environment files with sensitive data
- Any hardcoded secrets in source code

These files are automatically excluded via `.gitignore`:
```
.env, .env.*, credentials.json, secrets.json
*.pem, *.key, *.p12, *.pfx
```

### Use VS Code SecretStorage API

If you need to store credentials:

✅ **CORRECT**: Use VS Code's SecretStorage API
```typescript
// Store a secret
await context.secrets.store('myExtension.apiKey', apiKey);

// Retrieve a secret
const apiKey = await context.secrets.get('myExtension.apiKey');

// Delete a secret
await context.secrets.delete('myExtension.apiKey');
```

❌ **INCORRECT**: Never do this
```typescript
// Don't hardcode credentials
const API_KEY = "sk-1234567890abcdef";

// Don't store in workspace configuration
vscode.workspace.getConfiguration().update('apiKey', key);

// Don't store in plain text files
fs.writeFileSync('credentials.json', JSON.stringify({ key }));
```

### Code Security Best Practices

1. **Avoid dangerous functions**: `eval()`, `Function()`, `setTimeout(string)`, `setInterval(string)`
   - These are blocked by our ESLint rules

2. **Validate all input**: Especially user input and data from external sources
   - Sanitize terminal input/output
   - Validate configuration values

3. **Dependencies**: Keep them updated and secure
   ```bash
   # Check for vulnerabilities
   npm audit

   # Fix vulnerabilities automatically (when possible)
   npm audit fix
   ```

4. **Environment variables**: Only use for system configuration
   - ✅ OK: `process.env.HOME`, `process.env.SHELL`
   - ❌ NOT OK: `process.env.API_KEY`, `process.env.PASSWORD`

### Security Testing

Before submitting a PR:

1. **Check for hardcoded secrets**:
   ```bash
   # Search for potential secrets (future implementation)
   git diff main | grep -iE "(password|secret|token|api_key)"
   ```

2. **Run security linters**:
   ```bash
   npm run lint
   ```

3. **Test with realistic data**: Use mock/placeholder credentials in tests

### Reporting Security Vulnerabilities

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email the maintainer directly
2. Use GitHub's "Report a vulnerability" feature
3. Include reproduction steps and potential impact

See [SECURITY.md](../SECURITY.md) for full details.

### Pre-commit Checklist

Before committing:
- [ ] No hardcoded credentials in code
- [ ] No `.env` files or credential files staged
- [ ] All secrets use VS Code SecretStorage API
- [ ] ESLint passes with no security warnings
- [ ] Tests pass and include security test cases
- [ ] Dependencies are up to date (`npm audit` clean)

## 🐛 Bug Reports

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/new/choose).

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
- What you expected would happen
- What actually happens
- Environment details (OS, VS Code version, etc.)
- Notes (possibly including why you think this might be happening)

## 💡 Feature Requests

We welcome feature requests! Please use the [feature request template](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/new?template=feature_request.md).

Consider:
- Is this feature useful to most users?
- How difficult would it be to implement?
- Does it align with the project's goals?

## 🔧 Areas Needing Help

We especially welcome contributions in these areas:

### High Priority
- **Performance Optimization**: Improve terminal rendering performance
- **Cross-platform Testing**: Ensure compatibility across Windows/macOS/Linux
- **Terminal Features**: Advanced terminal features (search, selection, etc.)

### Medium Priority
- **Accessibility**: Screen reader support, keyboard navigation
- **Themes**: Better integration with VS Code themes
- **Multi-tab Support**: Enhanced terminal tab management

### Low Priority
- **Documentation**: Improve README, add tutorials
- **Testing**: Increase test coverage
- **CI/CD**: Improve build and release process

## 📚 Resources

### VS Code Extension Development
- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)

### Terminal Technology
- [xterm.js Documentation](https://xtermjs.org/docs/)
- [node-pty Documentation](https://github.com/microsoft/node-pty)

### Project-Specific
- [Architecture Overview](./docs/architecture.md) (if available)
- [Testing Guide](./docs/testing.md) (if available)
- [Release Process Guide (Japanese)](RELEASE_PROCESS.md)

## 🤝 Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## 📄 License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

## 🙏 Questions?

Feel free to:
- [Open an issue](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/new/choose)
- Contact the maintainer: [@s-hiraoku](https://github.com/s-hiraoku)

Thank you for contributing! 🎉