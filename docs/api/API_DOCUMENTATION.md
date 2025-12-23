# Secondary Terminal API Documentation

This document provides an overview of the API documentation for the Secondary Terminal VS Code extension, generated using TypeDoc.

## Overview

The Secondary Terminal extension provides a production-ready terminal experience in the VS Code sidebar with advanced features including:

- Terminal lifecycle management
- Session persistence and restoration
- Shell integration for enhanced terminal features
- Command history and working directory tracking
- File reference shortcuts (@mention functionality)
- GitHub Copilot Chat integration
- Split terminal support with dynamic direction
- Phase 8 advanced features (decorations and links)

## Accessing the API Documentation

### Local Development
The generated API documentation is available in HTML format at `docs/api/index.html`.

Open this file in your web browser to browse the complete API reference:

```bash
# Open the documentation (example for different platforms)
# macOS
open docs/api/index.html

# Linux
xdg-open docs/api/index.html

# Windows
start docs/api/index.html
```

### Generating Documentation

Use the following npm scripts to work with the API documentation:

```bash
# Generate documentation
npm run docs:generate

# Clean generated documentation
npm run docs:clean

# Watch mode (auto-regenerate on changes)
npm run docs:watch
```

## Documentation Structure

The API documentation is organized into the following categories:

### Core Components
- **ExtensionLifecycle**: Main lifecycle management for the extension
  - Handles activation, deactivation, and resource cleanup
  - Manages all component initialization and dependency injection
  - Coordinates session management and restoration

- **Extension Module**: Entry point with activation/deactivation functions
  - `activate()`: Called by VS Code when extension activates
  - `deactivate()`: Called when extension is being deactivated

### Providers
- Terminal providers for sidebar integration
- WebView providers for UI rendering
- Session providers for data persistence

### Managers
- **TerminalManager**: Terminal lifecycle management
- **SessionManager**: Session persistence and restoration
- **StateManager**: Application state management

### Services
- **Shell Integration Services**: Enhanced terminal features
- **Configuration Services**: Extension settings management
- **Keyboard Shortcut Services**: Keyboard handling
- **Decoration Services**: Visual enhancements (Phase 8)
- **Link Services**: Link detection and handling (Phase 8)

### Commands
- **File Reference Commands**: @mention functionality
- **Terminal Commands**: Terminal operations
- **Copilot Commands**: GitHub Copilot integration

### Utilities
- **Logging**: Structured logging system
- **Version Management**: Version information utilities
- **Common Utilities**: Shared utility functions

## Contributing to Documentation

When adding new public APIs or modifying existing ones, please follow these guidelines:

### 1. Add JSDoc Comments

Use the TypeDoc-compatible JSDoc format:

```typescript
/**
 * Brief one-line description of the function or class.
 *
 * Detailed description providing context and usage information.
 * Can span multiple lines and include additional details.
 *
 * @param paramName - Description of the parameter and its purpose
 * @param optionalParam - Description (optional parameters should be noted)
 * @returns Description of the return value and what it represents
 *
 * @remarks
 * Additional notes, implementation details, or important considerations.
 * Use this section for:
 * - Performance considerations
 * - Side effects
 * - Related functionality
 * - Breaking changes
 *
 * @example
 * ```typescript
 * // Example usage with realistic scenario
 * const manager = new TerminalManager();
 * const terminal = manager.createTerminal();
 * ```
 *
 * @throws {Error} Description of when and why this might throw
 * @see RelatedClass - Link to related functionality
 * @public
 */
```

### 2. Use Appropriate Visibility Tags

- `@public` - Public API that will be included in generated documentation
- `@internal` - Internal implementation details, excluded from documentation
- `@private` - Private members (prefer TypeScript `private` keyword)
- `@protected` - Protected members accessible to subclasses

### 3. Documentation Best Practices

#### Required Elements
- Brief description (first paragraph)
- `@param` tags for all parameters
- `@returns` tag for return values

#### Recommended Elements
- `@remarks` for important implementation details
- `@example` for non-trivial functionality
- `@throws` for error conditions

#### Optional Elements
- `@see` for related APIs
- `@deprecated` for deprecated functionality (include migration path)
- `@since` for version information

### 4. Writing Style Guidelines

- **Be Clear and Concise**: Use simple, direct language
- **Use Active Voice**: "Creates a terminal" not "A terminal is created"
- **Start with Verbs**: For functions/methods (e.g., "Creates", "Returns", "Validates")
- **Complete Sentences**: End descriptions with periods
- **Include Context**: Explain *why* not just *what*
- **Provide Examples**: For complex or non-obvious functionality

### 5. Code Example Guidelines

```typescript
// ❌ Bad: Too simple, no context
/**
 * @example
 * ```typescript
 * func(x);
 * ```
 */

// ✅ Good: Realistic usage with context
/**
 * @example
 * ```typescript
 * // Create and activate a new terminal
 * const lifecycle = new ExtensionLifecycle();
 * await lifecycle.activate(context);
 * ```
 */
```

### 6. Regenerate Documentation

After making changes to JSDoc comments:

```bash
# Regenerate the documentation
npm run docs:generate

# Verify the changes by opening docs/api/index.html
```

## TypeDoc Configuration

The documentation generation is configured in `typedoc.json`:

```json
{
  "entryPoints": ["src/extension.ts"],
  "entryPointStrategy": "expand",
  "out": "docs/api",
  "exclude": [
    "**/node_modules/**",
    "**/test/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  "excludePrivate": true,
  "excludeProtected": false,
  "excludeInternal": true,
  "skipErrorChecking": true
}
```

Key configuration options:
- **Entry Point**: `src/extension.ts` (expands to all imported modules)
- **Output Directory**: `docs/api/`
- **Excluded Paths**: Tests, node_modules, build outputs
- **Visibility**: Private and internal members excluded, protected included

## Documentation Maintenance

### Regular Maintenance Tasks

1. **Update with Code Changes**: Document new APIs when adding features
2. **Review in PRs**: Check documentation during code reviews
3. **Regenerate Before Release**: Ensure docs are up-to-date for each release
4. **Validate Examples**: Test code examples to ensure they work

### Quality Checklist

Before committing documentation changes:

- [ ] All public APIs have JSDoc comments
- [ ] Parameters and return values are documented
- [ ] Complex functionality includes examples
- [ ] Error conditions are documented with `@throws`
- [ ] Related APIs are cross-referenced with `@see`
- [ ] Documentation is regenerated
- [ ] Generated HTML opens without errors
- [ ] Examples are tested and functional

## Issue Tracking

This API documentation implementation addresses [Issue #236](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/236):

### Phase 1: JSDoc Comments ✅
- Added comprehensive JSDoc comments to main entry points
- Documented ExtensionLifecycle class and all public methods
- Established documentation standards and patterns

### Phase 2: TypeDoc Generation ✅
- Configured TypeDoc with `typedoc.json`
- Set up npm scripts for documentation generation
- Generated HTML documentation in `docs/api/`
- Created this documentation guide

### Phase 3: Architecture Diagrams ⏳
- To be implemented in future enhancement
- Will include component architecture diagrams
- Sequence diagrams for key flows
- Data flow diagrams

## Additional Resources

### External Documentation
- [TypeDoc Official Documentation](https://typedoc.org/)
- [TSDoc Specification](https://tsdoc.org/)
- [JSDoc Reference](https://jsdoc.app/)
- [VS Code Extension API](https://code.visualstudio.com/api)

### Internal Documentation
- [Main README](../README.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Architecture Documentation](architecture/)
- [Development Guides](guides/)

## Support and Feedback

For questions, issues, or suggestions related to the API documentation:

1. Check the [generated documentation](api/index.html) first
2. Review this guide and [CONTRIBUTING.md](CONTRIBUTING.md)
3. Search [existing issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)
4. Open a new issue with the `documentation` label if needed

---

**Last Updated**: 2025-11-12
**Documentation Format**: TypeDoc HTML
**Coverage**: Core APIs and main entry points
