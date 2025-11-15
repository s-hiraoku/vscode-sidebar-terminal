# Result Pattern Migration Guide

This document provides guidance for migrating the codebase to use the standardized Result pattern for error handling, as specified in [Issue #224](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/224).

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution: Result Pattern](#solution-result-pattern)
- [Migration Steps](#migration-steps)
- [Code Examples](#code-examples)
- [Best Practices](#best-practices)
- [ESLint Rules](#eslint-rules)

## Overview

The Result pattern provides a type-safe, explicit way to handle errors throughout the codebase. Instead of using inconsistent error handling patterns (try-catch with void/boolean returns, silent error swallowing, or re-throwing errors), we use a discriminated union type that forces callers to handle both success and failure cases explicitly.

## Problem Statement

Before the Result pattern, the codebase exhibited four inconsistent error handling approaches:

1. **Try-catch with void return**: Errors are logged but not communicated to callers
2. **Try-catch with boolean return**: Loss of error context and details
3. **Try-catch with throw**: Inconsistent re-throwing behavior
4. **Result object**: Rarely used and non-standardized

This inconsistency led to:
- Callers not knowing what error handling pattern to expect
- Silent error swallowing
- Difficult debugging
- Unreliable error recovery

## Solution: Result Pattern

The Result pattern uses TypeScript discriminated unions:

```typescript
type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };
```

### Key Features

- **Type-safe**: TypeScript enforces handling both success and failure cases
- **Explicit**: Errors are part of the function signature
- **Consistent**: Same pattern across all services
- **Structured**: Errors include codes, messages, context, and causes
- **Composable**: Helper functions for chaining and transforming Results

## Migration Steps

### Phase 1: Define Result Types ✅

The Result pattern types are defined in `src/types/result.ts` and exported from `src/types/shared.ts`:

```typescript
import {
  Result,
  ErrorCode,
  success,
  failure,
  failureFromDetails,
  fromPromise,
  tryCatch,
} from '../../types/shared';
```

### Phase 2: Update Core Services (In Progress)

**Example: TerminalLifecycleService**

See `src/services/terminal/TerminalLifecycleService.ts` for a complete example of Result pattern implementation.

### Phase 3: Update WebView Layer

Update message handlers and WebView communication to use Result pattern.

### Phase 4: Migrate Call Sites and Add ESLint Enforcement

Update all call sites to handle Result types properly and add ESLint rules to enforce the pattern.

## Code Examples

### Before: Try-catch with throw

```typescript
async createTerminal(options: TerminalCreationOptions): Promise<TerminalInstance> {
  try {
    // ... creation logic
    return terminal;
  } catch (error) {
    log('Failed to create terminal:', error);
    throw error; // Caller must try-catch again
  }
}
```

### After: Result pattern

```typescript
async createTerminal(
  options: TerminalCreationOptions
): Promise<Result<TerminalInstance>> {
  try {
    // ... creation logic
    return success(terminal);
  } catch (error) {
    return failureFromDetails({
      code: ErrorCode.TERMINAL_CREATION_FAILED,
      message: error instanceof Error ? error.message : 'Failed to create terminal',
      context: { options },
      cause: error instanceof Error ? error : undefined,
    });
  }
}
```

### Before: Try-catch with void return (silent errors)

```typescript
resizeTerminal(terminal: TerminalInstance, cols: number, rows: number): void {
  try {
    terminal.pty.resize(cols, rows);
  } catch (error) {
    log('Error resizing terminal:', error);
    // Error swallowed - caller doesn't know it failed!
  }
}
```

### After: Result pattern

```typescript
resizeTerminal(terminal: TerminalInstance, cols: number, rows: number): Result<void> {
  if (!terminal.pty) {
    return failureFromDetails({
      code: ErrorCode.TERMINAL_NOT_FOUND,
      message: 'Cannot resize terminal without PTY',
      context: { terminalId: terminal.id, cols, rows },
    });
  }

  return tryCatch(
    () => terminal.pty!.resize(cols, rows),
    (error) => ({
      code: ErrorCode.TERMINAL_PROCESS_FAILED,
      message: error instanceof Error ? error.message : 'Failed to resize terminal',
      context: { terminalId: terminal.id, cols, rows },
      cause: error instanceof Error ? error : undefined,
    })
  );
}
```

### Calling Result-returning functions

```typescript
// Check success with type guard
const result = await lifecycleService.createTerminal(options);
if (result.success) {
  const terminal = result.value;
  // Use terminal
} else {
  const error = result.error;
  log('Failed to create terminal:', error.message, error.code);
  // Handle error appropriately
}

// Use helper functions
const result = lifecycleService.resizeTerminal(terminal, 80, 24);
onFailure(result, (error) => {
  log('Resize failed:', error.message);
  // Show error to user
});

// Chain operations
const result = await lifecycleService.createTerminal(options);
const mapped = map(result, (terminal) => terminal.id);
```

## Best Practices

### 1. Choose Appropriate Error Codes

Use specific error codes from the `ErrorCode` enum:

```typescript
// Good: Specific error code
ErrorCode.TERMINAL_NOT_FOUND
ErrorCode.TERMINAL_CREATION_FAILED
ErrorCode.CONFIG_INVALID

// Avoid: Generic error code
ErrorCode.UNKNOWN_ERROR // Only use as last resort
```

### 2. Provide Context in Errors

Include relevant context to aid debugging:

```typescript
return failureFromDetails({
  code: ErrorCode.TERMINAL_CREATION_FAILED,
  message: 'Maximum number of terminals reached',
  context: {
    maxTerminals: 5,
    attemptedNumber: terminalNumber,
    currentCount: terminals.size,
  },
});
```

### 3. Preserve Error Chains

When wrapping errors, preserve the original error as `cause`:

```typescript
return failureFromDetails({
  code: ErrorCode.FILE_READ_FAILED,
  message: 'Failed to read configuration file',
  context: { filePath },
  cause: originalError, // Preserve stack trace
});
```

### 4. Use Helper Functions

Leverage helper functions for common operations:

```typescript
// Convert Promise to Result
const result = await fromPromise(
  fs.readFile(path, 'utf8'),
  (error) => ({
    code: ErrorCode.FILE_READ_FAILED,
    message: String(error),
  })
);

// Try-catch wrapper
const result = tryCatch(
  () => JSON.parse(data),
  (error) => ({
    code: ErrorCode.DESERIALIZATION_FAILED,
    message: 'Invalid JSON',
  })
);

// Chain operations
const finalResult = chain(result, (value) => {
  return processValue(value);
});
```

### 5. Document Return Types

Always document that a function returns a Result:

```typescript
/**
 * Create a new terminal with the specified options
 * @param options - Terminal creation options
 * @returns Result containing TerminalInstance or error details
 */
async createTerminal(
  options: TerminalCreationOptions
): Promise<Result<TerminalInstance>> {
  // ...
}
```

## ESLint Rules

To enforce the Result pattern, consider adding these ESLint rules:

### Rule 1: No Throw in Service Methods

```json
{
  "rules": {
    "no-throw-literal": "error",
    "@typescript-eslint/no-throw-literal": "error"
  }
}
```

### Rule 2: Require Result Type for Service Methods

Create a custom ESLint rule to enforce Result return types in service files:

```typescript
// Example rule: service-methods-must-return-result
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Service methods should return Result type',
      category: 'Best Practices',
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        const fileName = context.getFilename();
        if (!fileName.includes('/services/')) {
          return;
        }

        const returnType = node.value.returnType;
        if (!returnType) {
          context.report({
            node,
            message: 'Service methods should have explicit Result return type',
          });
        }
        // Check if return type includes Result
        // ...
      },
    };
  },
};
```

## Migration Checklist

Use this checklist when migrating a service file:

- [ ] Import Result types from `src/types/shared.ts`
- [ ] Update method signatures to return `Result<T>` or `Promise<Result<T>>`
- [ ] Replace `throw` statements with `failureFromDetails()` or `failure()`
- [ ] Return `success()` on successful operations
- [ ] Add appropriate `ErrorCode` for each failure case
- [ ] Include context in error details
- [ ] Update all call sites to handle Results
- [ ] Update tests to verify Result handling
- [ ] Update JSDoc comments to document Result returns
- [ ] Remove try-catch blocks that only re-throw errors

## Reference Implementation

For a complete reference implementation, see:

- **Type definitions**: `src/types/result.ts`
- **Service example**: `src/services/terminal/TerminalLifecycleService.ts`
- **Helper functions**: `src/types/result.ts` (success, failure, tryCatch, etc.)

## Questions and Support

For questions about the Result pattern migration:

1. Review this guide and the reference implementation
2. Check [Issue #224](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/224)
3. Ask in pull request discussions

## Timeline

- **Phase 1** (0.5 days): Define Result types and helpers ✅
- **Phase 2** (1 day): Update core services (In Progress)
- **Phase 3** (1 day): Update WebView layer
- **Phase 4** (0.5 days): Migrate call sites and add ESLint enforcement

**Total estimated time**: 2-3 days for complete migration
