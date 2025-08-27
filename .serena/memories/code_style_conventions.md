# Code Style and Conventions

## TypeScript Configuration
- **Strict Mode**: Enabled with all strict checks
- **Target**: ES2022
- **Module**: CommonJS
- **No Explicit Any**: Enforced via ESLint
- **Explicit Return Types**: Required for all functions

## Naming Conventions
- **Classes**: PascalCase (e.g., `TerminalManager`, `SecandarySidebar`)
- **Interfaces**: PascalCase with 'I' prefix (e.g., `IManagerCoordinator`, `IMessageManager`)
- **Methods/Functions**: camelCase (e.g., `createTerminal`, `sendInput`)
- **Private Members**: Leading underscore (e.g., `_terminals`, `_dataEmitter`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_TERMINALS`, `DATA_FLUSH_INTERVAL`)
- **Files**: PascalCase for classes, camelCase for utilities

## Code Organization
- **Single Responsibility**: Each class/function has one clear purpose
- **Event-Driven**: Use EventEmitters for communication
- **Disposal Pattern**: Always implement proper cleanup
- **Error Handling**: Never silent failures, always log/handle errors

## ESLint Rules
- **Prettier Integration**: All code auto-formatted
- **No Unused Variables**: Except those prefixed with underscore
- **Strict Equality**: Always use === and !==
- **Semicolons**: Required
- **Quotes**: Single quotes for strings
- **Trailing Commas**: ES5 style

## Prettier Configuration
- **Print Width**: 100 characters
- **Tab Width**: 2 spaces
- **No Tabs**: Spaces only
- **Arrow Parens**: Always include
- **End of Line**: LF (Unix-style)

## Testing Conventions
- **TDD Mandatory**: Write tests first
- **Test Organization**: Mirror source structure in test/unit/
- **Naming**: describe blocks use class/module name, it blocks describe behavior
- **Mocking**: Use Sinon for stubs/spies
- **Assertions**: Use Chai with expect style

## Documentation
- **JSDoc**: Required for public methods
- **Inline Comments**: Explain WHY, not WHAT
- **README Updates**: Keep documentation current
- **CLAUDE.md**: Update for architectural changes

## Git Commit Messages
- **Format**: Conventional Commits (type: description)
- **Types**: feat, fix, docs, style, refactor, test, chore
- **Scope**: Optional, in parentheses
- **Description**: Present tense, lowercase

## Import Organization
1. Node.js built-ins
2. VS Code imports
3. External dependencies
4. Internal imports (sorted by depth)

## Key Principles (from CLAUDE.md)
- **No shortcuts**: Technical debt compounds exponentially
- **Complete implementations**: Update ALL references when changing
- **Resource management**: Always dispose what you create
- **Type safety**: Avoid 'any', use proper types
- **Test everything**: If it's not tested, it's not working