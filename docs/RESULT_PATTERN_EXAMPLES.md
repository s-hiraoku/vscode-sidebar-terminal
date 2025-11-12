# Result Pattern Usage Examples

This document provides practical examples of using the Result pattern in the VS Code Sidebar Terminal extension.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Service Implementation Examples](#service-implementation-examples)
- [Calling Result-Returning Functions](#calling-result-returning-functions)
- [Error Handling Patterns](#error-handling-patterns)
- [Testing Result-Returning Functions](#testing-result-returning-functions)

## Basic Usage

### Creating a Successful Result

```typescript
import { success } from '../types/shared';

function divideNumbers(a: number, b: number): Result<number> {
  if (b === 0) {
    return failureFromDetails({
      code: ErrorCode.INVALID_INPUT,
      message: 'Division by zero is not allowed',
      context: { a, b },
    });
  }

  return success(a / b);
}
```

### Creating a Failed Result

```typescript
import { failureFromDetails, ErrorCode } from '../types/shared';

function validateTerminalId(id: string): Result<string> {
  if (!id || id.trim().length === 0) {
    return failureFromDetails({
      code: ErrorCode.INVALID_INPUT,
      message: 'Terminal ID cannot be empty',
      context: { providedId: id },
    });
  }

  return success(id.trim());
}
```

## Service Implementation Examples

### Example 1: TerminalLifecycleService

```typescript
import {
  Result,
  ErrorCode,
  success,
  failureFromDetails,
  tryCatch,
} from '../../types/shared';

export class TerminalLifecycleService {
  /**
   * Create a new terminal with Result pattern
   */
  async createTerminal(
    options: TerminalCreationOptions
  ): Promise<Result<TerminalInstance>> {
    try {
      // Validation
      if (this._terminalsBeingCreated.has(terminalId)) {
        return failureFromDetails({
          code: ErrorCode.TERMINAL_ALREADY_EXISTS,
          message: `Terminal ${terminalId} is already being created`,
          context: { terminalId, options },
        });
      }

      // Business logic
      const ptyResult = await this.createPtyProcess(options);
      if (!ptyResult.success) {
        return ptyResult; // Propagate error
      }

      const terminal = this.buildTerminalInstance(ptyResult.value);
      return success(terminal);
    } catch (error) {
      return failureFromDetails({
        code: ErrorCode.TERMINAL_CREATION_FAILED,
        message: error instanceof Error ? error.message : 'Unknown error',
        context: { options },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Synchronous operation with Result pattern
   */
  resizeTerminal(
    terminal: TerminalInstance,
    cols: number,
    rows: number
  ): Result<void> {
    if (!terminal.pty) {
      return failureFromDetails({
        code: ErrorCode.TERMINAL_NOT_FOUND,
        message: 'Cannot resize terminal without PTY',
        context: { terminalId: terminal.id, cols, rows },
      });
    }

    return tryCatch(
      () => {
        terminal.pty!.resize(cols, rows);
      },
      (error) => ({
        code: ErrorCode.TERMINAL_PROCESS_FAILED,
        message: error instanceof Error ? error.message : 'Resize failed',
        context: { terminalId: terminal.id, cols, rows },
        cause: error instanceof Error ? error : undefined,
      })
    );
  }
}
```

### Example 2: TerminalProfileService

```typescript
import {
  Result,
  ErrorCode,
  fromPromise,
} from '../types/shared';

export class TerminalProfileService {
  /**
   * Update profile configuration with Result pattern
   */
  async updateProfileConfig(
    platform: TerminalPlatform,
    profileName: string,
    profile: TerminalProfile | null
  ): Promise<Result<void>> {
    return fromPromise(
      (async () => {
        const config = vscode.workspace.getConfiguration('sidebarTerminal');
        const profileKey = this.getProfileKeyForPlatform(platform);
        const currentProfiles = config.get(profileKey, {});

        await config.update(
          profileKey,
          { ...currentProfiles, [profileName]: profile },
          vscode.ConfigurationTarget.Global
        );
      })(),
      (error) => ({
        code: ErrorCode.CONFIG_LOAD_FAILED,
        message: error instanceof Error ? error.message : 'Config update failed',
        context: { platform, profileName },
        cause: error instanceof Error ? error : undefined,
      })
    );
  }
}
```

## Calling Result-Returning Functions

### Pattern 1: Check Success with Type Guard

```typescript
import { isSuccess, isFailure } from '../types/shared';

async function createAndActivateTerminal() {
  const result = await lifecycleService.createTerminal({ shell: '/bin/bash' });

  if (isSuccess(result)) {
    // TypeScript knows result.value is TerminalInstance
    const terminal = result.value;
    console.log(`Terminal created: ${terminal.id}`);
    await activateTerminal(terminal);
  } else {
    // TypeScript knows result.error is ResultError
    const error = result.error;
    console.error(`Failed to create terminal: ${error.message} (${error.code})`);
    showErrorMessage(error.message);
  }
}
```

### Pattern 2: Use Helper Functions

```typescript
import { onSuccess, onFailure, map, chain } from '../types/shared';

async function createTerminalWithLogging() {
  const result = await lifecycleService.createTerminal({ shell: '/bin/bash' });

  // Execute side effects
  onSuccess(result, (terminal) => {
    console.log(`✅ Terminal created: ${terminal.id}`);
  });

  onFailure(result, (error) => {
    console.error(`❌ Failed: ${error.message}`);
  });

  return result;
}

// Transform successful results
function getTerminalIdResult(
  terminalResult: Result<TerminalInstance>
): Result<string> {
  return map(terminalResult, (terminal) => terminal.id);
}

// Chain operations
async function createAndResizeTerminal() {
  const createResult = await lifecycleService.createTerminal({});

  return chain(createResult, (terminal) => {
    return lifecycleService.resizeTerminal(terminal, 80, 24);
  });
}
```

### Pattern 3: Unwrap with Default

```typescript
import { unwrapOr, unwrap } from '../types/shared';

function getTerminalIdSafe(result: Result<TerminalInstance>): string {
  // Return default value on failure
  return unwrapOr(
    map(result, (t) => t.id),
    'unknown-terminal'
  );
}

function getTerminalIdUnsafe(result: Result<TerminalInstance>): string {
  // Throws error on failure - use only when you're certain it will succeed
  try {
    const terminal = unwrap(result);
    return terminal.id;
  } catch (error) {
    console.error('Unexpected failure:', error);
    throw error;
  }
}
```

## Error Handling Patterns

### Pattern 1: Early Return on Failure

```typescript
async function complexOperation(terminalId: string): Promise<Result<void>> {
  // Step 1: Get terminal
  const getResult = await terminalService.getTerminal(terminalId);
  if (!getResult.success) {
    return getResult; // Early return with error
  }
  const terminal = getResult.value;

  // Step 2: Resize terminal
  const resizeResult = lifecycleService.resizeTerminal(terminal, 80, 24);
  if (!resizeResult.success) {
    return resizeResult;
  }

  // Step 3: Activate terminal
  const activateResult = await terminalService.activate(terminalId);
  if (!activateResult.success) {
    return activateResult;
  }

  return success(undefined);
}
```

### Pattern 2: Collect All Errors

```typescript
import { all } from '../types/shared';

async function validateAllTerminals(
  terminalIds: string[]
): Promise<Result<TerminalInstance[]>> {
  const results = await Promise.all(
    terminalIds.map((id) => terminalService.getTerminal(id))
  );

  // all() returns first error or array of all values
  return all(results);
}
```

### Pattern 3: Provide Fallback

```typescript
async function getTerminalWithFallback(
  primaryId: string,
  fallbackId: string
): Promise<Result<TerminalInstance>> {
  const primaryResult = await terminalService.getTerminal(primaryId);

  if (primaryResult.success) {
    return primaryResult;
  }

  // Try fallback
  console.warn(`Primary terminal ${primaryId} not found, trying fallback`);
  return terminalService.getTerminal(fallbackId);
}
```

## Testing Result-Returning Functions

### Testing Success Cases

```typescript
import { expect } from 'chai';
import { isSuccess } from '../types/shared';

describe('TerminalLifecycleService', () => {
  it('should create terminal successfully', async () => {
    const service = new TerminalLifecycleService();
    const result = await service.createTerminal({ shell: '/bin/bash' });

    expect(result.success).to.be.true;

    if (isSuccess(result)) {
      expect(result.value).to.have.property('id');
      expect(result.value.shell).to.equal('/bin/bash');
    }
  });

  it('should resize terminal successfully', () => {
    const service = new TerminalLifecycleService();
    const terminal = createMockTerminal();

    const result = service.resizeTerminal(terminal, 80, 24);

    expect(result.success).to.be.true;
  });
});
```

### Testing Failure Cases

```typescript
import { isFailure, ErrorCode } from '../types/shared';

describe('TerminalLifecycleService - Error Cases', () => {
  it('should fail when terminal already exists', async () => {
    const service = new TerminalLifecycleService();

    // Create first terminal
    await service.createTerminal({ terminalId: 'test-123' });

    // Try to create duplicate
    const result = await service.createTerminal({ terminalId: 'test-123' });

    expect(result.success).to.be.false;

    if (isFailure(result)) {
      expect(result.error.code).to.equal(ErrorCode.TERMINAL_ALREADY_EXISTS);
      expect(result.error.message).to.include('already being created');
      expect(result.error.context).to.have.property('terminalId', 'test-123');
    }
  });

  it('should fail to resize terminal without PTY', () => {
    const service = new TerminalLifecycleService();
    const terminalWithoutPty: TerminalInstance = {
      id: 'test-123',
      name: 'Test',
      pty: undefined, // No PTY
      isActive: false,
    };

    const result = service.resizeTerminal(terminalWithoutPty, 80, 24);

    expect(result.success).to.be.false;

    if (isFailure(result)) {
      expect(result.error.code).to.equal(ErrorCode.TERMINAL_NOT_FOUND);
    }
  });
});
```

### Testing Error Propagation

```typescript
describe('Error Propagation', () => {
  it('should propagate PTY creation errors', async () => {
    const service = new TerminalLifecycleService();
    const invalidShell = '/nonexistent/shell';

    const result = await service.createTerminal({ shell: invalidShell });

    expect(result.success).to.be.false;

    if (isFailure(result)) {
      expect(result.error.code).to.equal(ErrorCode.TERMINAL_PROCESS_FAILED);
      expect(result.error.context).to.have.property('shell', invalidShell);
      expect(result.error.cause).to.exist;
    }
  });
});
```

## Best Practices Summary

1. **Always return Result types**: Don't mix Result and throw patterns
2. **Use appropriate error codes**: Select specific ErrorCode values
3. **Include context**: Add relevant information to error.context
4. **Preserve error chains**: Include cause when wrapping errors
5. **Document return types**: Add JSDoc comments specifying Result<T>
6. **Test both paths**: Test success and failure cases
7. **Use helper functions**: Leverage map, chain, onSuccess, onFailure
8. **Early returns**: Return errors immediately instead of nesting
9. **Type guards**: Use isSuccess/isFailure for type narrowing
10. **Avoid unwrap**: Only use unwrap() when failure is truly impossible

## Additional Resources

- **Type Definitions**: `src/types/result.ts`
- **Migration Guide**: `docs/RESULT_PATTERN_MIGRATION.md`
- **Reference Implementation**: `src/services/terminal/TerminalLifecycleService.ts`
- **Test Examples**: `src/test/unit/services/terminal/TerminalLifecycleService.test.ts`
