# Coding Standards

**Version:** 1.0.0
**Last Updated:** 2025-11-12
**Related Issue:** [#228 - Code Quality Refactoring](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/228)

---

## Overview

This document establishes coding standards for the vscode-sidebar-terminal project to improve code quality, maintainability, and prevent technical debt accumulation. These standards are enforced through ESLint 9+ configuration and code review processes.

---

## 1. File and Function Size Limits

### Rules

- **Max File Lines:** 500 lines (excluding blanks and comments)
  - ESLint: `max-lines: ['warn', { max: 500 }]`
  - **Rationale:** Large files indicate God Classes with too many responsibilities

- **Max Function Lines:** 100 lines (excluding blanks and comments)
  - ESLint: `max-lines-per-function: ['warn', { max: 100 }]`
  - **Rationale:** Long functions are hard to understand, test, and maintain

- **Max Statements per Function:** 30 statements
  - ESLint: `max-statements: ['warn', { max: 30 }]`
  - **Rationale:** Functions with many statements are doing too much

### Recommendations

When a file exceeds 500 lines:
1. Identify distinct responsibilities
2. Extract related functionality into separate classes/modules
3. Use composition over inheritance
4. Consider creating a service/utility module

When a function exceeds 100 lines:
1. Extract helper functions
2. Break down into smaller, single-purpose functions
3. Use early returns to reduce nesting

---

## 2. Complexity Management

### Rules

- **Max Cyclomatic Complexity:** 15
  - ESLint: `complexity: ['warn', { max: 15 }]`
  - **Rationale:** High complexity makes code difficult to test and maintain

- **Max Nesting Depth:** 4 levels
  - ESLint: `max-depth: ['warn', { max: 4 }]`
  - **Rationale:** Deep nesting reduces readability

- **Max Nested Callbacks:** 3 levels
  - ESLint: `max-nested-callbacks: ['warn', { max: 3 }]`
  - **Rationale:** Prevents callback hell

### Recommendations

To reduce complexity:
1. Use **guard clauses** and **early returns**
   ```typescript
   // Bad
   function process(data: Data | null): void {
     if (data) {
       if (data.isValid) {
         if (data.items.length > 0) {
           // deep nesting
         }
       }
     }
   }

   // Good
   function process(data: Data | null): void {
     if (!data) return;
     if (!data.isValid) return;
     if (data.items.length === 0) return;

     // main logic at root level
   }
   ```

2. Extract complex conditions into well-named functions
   ```typescript
   // Bad
   if (user && user.role === 'admin' && user.permissions.includes('write')) {
     // ...
   }

   // Good
   if (isAdminWithWriteAccess(user)) {
     // ...
   }
   ```

3. Replace large switch statements with handler registries
   ```typescript
   // Bad - 20+ case statements
   switch (messageType) {
     case 'create': handleCreate(); break;
     case 'update': handleUpdate(); break;
     // ... 18 more cases
   }

   // Good - Handler registry pattern
   const handlers: Record<string, Handler> = {
     create: handleCreate,
     update: handleUpdate,
     // ...
   };
   handlers[messageType]?.();
   ```

---

## 3. Function Parameters

### Rules

- **Max Parameters:** 4 parameters
  - ESLint: `max-params: ['warn', { max: 4 }]`
  - **Rationale:** Prevents primitive obsession and improves API clarity

### Recommendations

When a function needs more than 4 parameters:
1. Use **parameter objects** or **configuration objects**
   ```typescript
   // Bad - Primitive obsession
   function createTerminal(
     shell: string,
     args: string[],
     cwd: string,
     env: Record<string, string>,
     number: number,
     retry: number,
     timeout: number
   ): Terminal {
     // ...
   }

   // Good - Parameter object
   interface TerminalConfig {
     shell: string;
     args: string[];
     cwd: string;
     env: Record<string, string>;
     number: number;
     retry?: number;
     timeout?: number;
   }

   function createTerminal(config: TerminalConfig): Terminal {
     // ...
   }
   ```

2. Use **builder pattern** for complex object creation
3. Consider if the function is doing too much (SRP violation)

---

## 4. Naming Conventions

### Rules

- **Variable Name Length:** Minimum 2 characters (except loop counters: i, j, k, x, y, z)
  - ESLint: `id-length: ['warn', { min: 2, exceptions: ['i', 'j', 'k', 'x', 'y', 'z', '_'] }]`
  - **Rationale:** Single-letter names reduce code clarity

- **Consistent Type Definitions:** Use `interface` over `type` when possible
  - ESLint: `@typescript-eslint/consistent-type-definitions: ['warn', 'interface']`

### Recommendations

#### Variable Naming

Use descriptive, intention-revealing names:

```typescript
// Bad - Unclear generic names
const result = fetchData();
const data = process(result);
const output = transform(data);
const final = format(output);

// Good - Clear, descriptive names
const rawUserData = fetchUserData();
const validatedUsers = validateUserData(rawUserData);
const enrichedUsers = enrichWithMetadata(validatedUsers);
const formattedResponse = formatUserResponse(enrichedUsers);
```

#### Method Naming Conventions

Be **consistent** with verb prefixes. Use this hierarchy:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `handle*` | Event handlers, user actions | `handleClick()`, `handleWebviewReady()` |
| `process*` | Data transformation/processing | `processMessage()`, `processTerminalData()` |
| `validate*` | Validation logic | `validateInput()`, `validateConfig()` |
| `create*` | Factory/creation methods | `createTerminal()`, `createWebview()` |
| `get*` / `fetch*` | Data retrieval | `getUserData()`, `fetchConfig()` |
| `set*` / `update*` | State modification | `setTerminalSize()`, `updateSettings()` |
| `is*` / `has*` / `can*` | Boolean predicates | `isValid()`, `hasPermission()`, `canExecute()` |

**Avoid mixing conventions**:
```typescript
// Bad - Inconsistent use of handle/process/do/execute
class MessageService {
  handleMessage() { }
  processCommand() { }
  doValidation() { }
  executeAction() { }
}

// Good - Consistent, clear separation
class MessageService {
  handleIncomingMessage() { }     // Entry point for messages
  processMessagePayload() { }     // Process/transform data
  validateMessageFormat() { }     // Validation step
  executeMessageAction() { }      // Execute business logic
}
```

#### Common Anti-Patterns to Avoid

| Anti-Pattern | Example | Better Alternative |
|--------------|---------|-------------------|
| Generic `result` | `const result = fetch()` | `const userData = fetchUserData()` |
| Generic `data` | `function process(data)` | `function processTerminalOutput(output)` |
| Generic `output` | `const output = transform()` | `const formattedHtml = transformToHtml()` |
| Abbreviations | `const cfg = getConfig()` | `const configuration = getConfiguration()` |
| Single letters (non-loop) | `const n = getName()` | `const terminalName = getName()` |

---

## 5. TypeScript Best Practices

### Rules

- **No Explicit `any`:** Forbidden (use `unknown` instead)
  - ESLint: `@typescript-eslint/no-explicit-any: 'error'`
  - **Rationale:** Type safety is essential

- **Explicit Function Return Types:** Required
  - ESLint: `@typescript-eslint/explicit-function-return-type: 'error'`
  - **Rationale:** Improves API clarity and catches errors

- **Prefer Nullish Coalescing:** Use `??` instead of `||` for defaults
  - ESLint: `@typescript-eslint/prefer-nullish-coalescing: 'warn'`
  - **Rationale:** `??` only checks for `null`/`undefined`, not falsy values

- **Prefer Optional Chaining:** Use `?.` for safe property access
  - ESLint: `@typescript-eslint/prefer-optional-chain: 'warn'`

### Recommendations

```typescript
// Bad
function getUserName(user: any): any {
  const name = user && user.profile && user.profile.name;
  return name || 'Anonymous';
}

// Good
function getUserName(user: User | null): string {
  return user?.profile?.name ?? 'Anonymous';
}
```

---

## 6. Code Organization

### Rules

- **No Duplicate Imports:** Forbidden
  - ESLint: `no-duplicate-imports: 'error'`

- **No Else After Return:** Encouraged
  - ESLint: `no-else-return: ['warn', { allowElseIf: false }]`
  - **Rationale:** Reduces nesting and improves readability

- **Max Empty Lines:** 2 consecutive empty lines
  - ESLint: `no-multiple-empty-lines: ['warn', { max: 2, maxEOF: 1, maxBOF: 0 }]`

### Recommendations

File organization structure:
```typescript
// 1. Imports (grouped and sorted)
import * as vscode from 'vscode';
import { ServiceA } from './services/ServiceA';
import { UtilityB } from './utils/UtilityB';
import type { TypeC } from './types/TypeC';

// 2. Constants
const MAX_RETRIES = 3;

// 3. Types/Interfaces
interface ComponentConfig {
  // ...
}

// 4. Class/Functions
export class Component {
  // 4a. Private fields
  private readonly config: ComponentConfig;

  // 4b. Constructor
  constructor(config: ComponentConfig) {
    this.config = config;
  }

  // 4c. Public methods
  public initialize(): void {
    // ...
  }

  // 4d. Private methods
  private setupHandlers(): void {
    // ...
  }
}
```

---

## 7. Error Handling

### Best Practices

1. **Never throw string literals**
   - ESLint: `no-throw-literal: 'error'`
   ```typescript
   // Bad
   throw 'Error occurred';

   // Good
   throw new Error('Error occurred');
   throw new CustomError('Specific error', { context });
   ```

2. **Use Result types for expected failures**
   ```typescript
   type Result<T, E = Error> =
     | { success: true; value: T }
     | { success: false; error: E };

   function parseConfig(): Result<Config> {
     try {
       const config = JSON.parse(data);
       return { success: true, value: config };
     } catch (error) {
       return { success: false, error: error as Error };
     }
   }
   ```

---

## 8. Testing Requirements

### Standards

- **Test files:** Relaxed ESLint rules (see `eslint.config.js`)
  - `max-lines-per-function: 'off'`
  - `max-lines: 'off'`
  - `@typescript-eslint/no-explicit-any: 'warn'` (instead of error)

- **Coverage targets:**
  - Lines: 70%+
  - Functions: 70%+
  - Branches: 60%+

---

## 9. Code Review Checklist

Before submitting a PR, ensure:

- [ ] No ESLint errors (warnings are acceptable with justification)
- [ ] No functions exceed 100 lines
- [ ] No files exceed 500 lines
- [ ] No functions with more than 4 parameters (use config objects)
- [ ] No nested depth exceeding 4 levels
- [ ] No cyclomatic complexity exceeding 15
- [ ] All public APIs have explicit return types
- [ ] No use of `any` type (use `unknown` or specific types)
- [ ] Descriptive variable and function names (no generic `result`, `data`, `output`)
- [ ] Consistent naming conventions (handle/process/validate/create/get/set)
- [ ] Tests pass with adequate coverage

---

## 10. Gradual Adoption Strategy

### Boy Scout Rule

**"Leave the code better than you found it"**

When working on existing code:
1. Fix ESLint warnings in files you modify
2. Refactor God Methods if you're adding functionality
3. Extract helper functions to reduce complexity
4. Improve variable names when touching related code

### Enforcement Levels

| Level | Description | Enforcement |
|-------|-------------|-------------|
| **New Code** | All new files/functions | Strict - Must pass all rules |
| **Modified Code** | Files being actively changed | Moderate - Fix what you touch |
| **Legacy Code** | Untouched existing code | Lenient - Fix opportunistically |

### Migration Plan

1. **Phase 1 (Complete):** Set up ESLint 9 with quality rules
2. **Phase 2 (Complete):** Auto-fix safe warnings
3. **Phase 3 (Ongoing):** Refactor critical files (TerminalManager, SecondaryTerminalProvider, ExtensionLifecycle)
4. **Phase 4 (Continuous):** Apply Boy Scout Rule to all code changes

---

## 11. Tools and Automation

### ESLint Integration

Run linting:
```bash
npm run lint                    # Check all files
npm run lint:fix               # Auto-fix safe issues
npx eslint 'src/**/*.ts'       # Lint specific pattern
npx eslint --fix path/to/file  # Fix specific file
```

### Pre-commit Hooks (Recommended)

Consider adding:
- Husky for Git hooks
- lint-staged for staged file linting
- Prettier for code formatting consistency

---

## 12. References

- **Issue:** [#228 - Code Quality Refactoring](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/228)
- **ESLint Documentation:** https://eslint.org/docs/latest/
- **TypeScript ESLint:** https://typescript-eslint.io/
- **Clean Code Principles:** Robert C. Martin's "Clean Code"

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-12 | 1.0.0 | Initial coding standards document |

---

**Questions or Suggestions?**
Please open an issue or discussion on GitHub.
