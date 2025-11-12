# Result Pattern Guide

This guide explains how to use the standardized Result pattern for error handling in the VSCode Sidebar Terminal extension.

## Overview

The Result pattern provides a type-safe, explicit way to handle errors without using exceptions. It makes error handling predictable and forces developers to handle both success and failure cases.

## Benefits

- **Type Safety**: Errors are part of the type system, making them impossible to ignore
- **Explicit Error Handling**: All operations clearly indicate they can fail
- **No Silent Failures**: Callers must explicitly handle both success and error cases
- **Better Error Context**: Errors include structured information (code, message, context, cause)
- **Composable**: Results can be easily chained and transformed

## Basic Usage

### Creating Results

```typescript
import { success, failure, failureWithCode, ErrorCode } from '../types/Result';

// Success result
function getUser(id: string): Result<User, ErrorDetail> {
  const user = findUser(id);
  if (user) {
    return success(user);
  }
  return failureWithCode(
    ErrorCode.RESOURCE_NOT_FOUND,
    `User ${id} not found`,
    { userId: id }
  );
}
```

### Handling Results

```typescript
import { isSuccess, isFailure } from '../types/Result';

const result = getUser('123');

if (isSuccess(result)) {
  console.log('User:', result.value);
} else {
  console.error('Error:', result.error.message);
  console.error('Error code:', result.error.code);
}
```

### Using unwrapOr for Default Values

```typescript
import { unwrapOr } from '../types/Result';

const result = getUser('123');
const user = unwrapOr(result, DEFAULT_USER);
```

## Advanced Usage

### Chaining Operations with flatMap

```typescript
import { flatMap } from '../types/Result';

function getUserEmail(userId: string): Result<string, ErrorDetail> {
  return flatMap(
    getUser(userId),
    (user) => success(user.email)
  );
}
```

### Transforming Values with map

```typescript
import { map } from '../types/Result';

const result = getUser('123');
const userName = map(result, (user) => user.name);
```

### Handling Errors with mapError

```typescript
import { mapError } from '../types/Result';

const result = getTerminal('term-1');
const converted = mapError(result, (error) => ({
  ...error,
  message: `Terminal operation failed: ${error.message}`
}));
```

### Combining Multiple Results

```typescript
import { combine } from '../types/Result';

const userResults = [
  getUser('1'),
  getUser('2'),
  getUser('3')
];

const combined = combine(userResults);
if (isSuccess(combined)) {
  console.log('All users:', combined.value);
} else {
  console.error('Failed to load user:', combined.error);
}
```

### Converting Promises to Results

```typescript
import { fromPromise, tryCatchAsync } from '../types/Result';

// Method 1: Using fromPromise
const result = await fromPromise(fetchData());

// Method 2: Using tryCatchAsync
const result = await tryCatchAsync(async () => {
  const data = await fetchData();
  return processData(data);
});
```

### Wrapping Throwing Code

```typescript
import { tryCatch } from '../types/Result';

const result = tryCatch(() => {
  return JSON.parse(jsonString);
});
```

## Integration with BaseMessageHandler

The `BaseMessageHandler` class now supports Result-based error handling:

```typescript
import { BaseMessageHandler } from '../messaging/handlers/BaseMessageHandler';
import { Result, success, ErrorDetail } from '../../types/Result';

export class MyHandler extends BaseMessageHandler {
  // Optional: Implement Result-based handler
  async handleWithResult(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<Result<void, ErrorDetail>> {
    // Validate message
    const validation = this.validateMessageWithResult(message, ['terminalId']);
    if (isFailure(validation)) {
      return validation;
    }

    // Execute operation with automatic error handling
    return this.executeWithResult(context, message.command, async () => {
      // Your operation here
      await doSomething(message.terminalId);
    });
  }
}
```

## Integration with OperationResultHandler

The `OperationResultHandler` class has been updated to support the new Result type:

```typescript
import { OperationResultHandler } from '../utils/OperationResultHandler';
import { success, failureWithCode, ErrorCode } from '../types/Result';

// Convert Result to OperationResult
const operationResult = OperationResultHandler.fromResult(
  success({ data: 'value' })
);

// Convert OperationResult to Result
const result = OperationResultHandler.toResult(operationResult);

// Handle Result-based operations
const value = await OperationResultHandler.handleResultOperation(
  async () => performOperation(),
  'MyContext',
  'Operation completed successfully',
  notificationService
);

// Wrap functions that throw
const result = await OperationResultHandler.wrapWithResult(
  async () => riskyOperation(),
  ErrorCode.TERMINAL_PROCESS_ERROR,
  'Failed to perform risky operation',
  { terminalId: 'term-1' }
);
```

## Error Codes

Standard error codes are provided in the `ErrorCode` enum:

### Terminal Errors
- `TERMINAL_NOT_FOUND` - Terminal with specified ID not found
- `TERMINAL_CREATION_FAILED` - Failed to create terminal
- `TERMINAL_ALREADY_EXISTS` - Terminal with ID already exists
- `TERMINAL_DISPOSED` - Terminal has been disposed
- `TERMINAL_PROCESS_ERROR` - Terminal process encountered an error

### Session Errors
- `SESSION_NOT_FOUND` - Session not found
- `SESSION_RESTORE_FAILED` - Failed to restore session
- `SESSION_SAVE_FAILED` - Failed to save session
- `SESSION_INVALID_STATE` - Session is in invalid state

### Configuration Errors
- `CONFIG_INVALID` - Configuration is invalid
- `CONFIG_LOAD_FAILED` - Failed to load configuration
- `CONFIG_SAVE_FAILED` - Failed to save configuration
- `CONFIG_MIGRATION_FAILED` - Configuration migration failed

### WebView Errors
- `WEBVIEW_NOT_INITIALIZED` - WebView not initialized
- `WEBVIEW_MESSAGE_FAILED` - WebView message failed
- `WEBVIEW_RENDER_FAILED` - WebView render failed

### Communication Errors
- `MESSAGE_INVALID` - Message format is invalid
- `MESSAGE_HANDLER_NOT_FOUND` - No handler found for message
- `MESSAGE_PROCESSING_FAILED` - Message processing failed

### Resource Errors
- `RESOURCE_NOT_FOUND` - Resource not found
- `RESOURCE_ACCESS_DENIED` - Access to resource denied
- `RESOURCE_EXHAUSTED` - Resource exhausted

### Generic Errors
- `UNKNOWN` - Unknown error
- `VALIDATION_FAILED` - Validation failed
- `TIMEOUT` - Operation timed out
- `CANCELLED` - Operation cancelled

## Best Practices

### 1. Always Handle Both Cases

```typescript
// Good
const result = getUser('123');
if (isSuccess(result)) {
  processUser(result.value);
} else {
  logError(result.error);
}

// Bad - Type system prevents this, but conceptually wrong
const result = getUser('123');
// Assuming success without checking
```

### 2. Use Appropriate Error Codes

```typescript
// Good - Specific error code
return failureWithCode(
  ErrorCode.TERMINAL_NOT_FOUND,
  'Terminal xyz not found',
  { terminalId: 'xyz' }
);

// Less ideal - Generic error code
return failureWithCode(
  ErrorCode.UNKNOWN,
  'Something went wrong'
);
```

### 3. Provide Context in Errors

```typescript
// Good - Includes context
return failureWithCode(
  ErrorCode.VALIDATION_FAILED,
  'Email validation failed',
  {
    field: 'email',
    value: emailValue,
    reason: 'invalid format'
  }
);

// Less ideal - No context
return failure('Validation failed');
```

### 4. Chain Operations for Cleaner Code

```typescript
// Good - Chained operations
const result = flatMap(
  getUserId(sessionId),
  (userId) => flatMap(
    getUser(userId),
    (user) => success(user.email)
  )
);

// Alternative - Multiple checks
const userIdResult = getUserId(sessionId);
if (isFailure(userIdResult)) {
  return userIdResult;
}
const userResult = getUser(userIdResult.value);
if (isFailure(userResult)) {
  return userResult;
}
return success(userResult.value.email);
```

### 5. Use Helper Functions Appropriately

```typescript
// Use onSuccess/onFailure for side effects
onSuccess(result, (user) => logUser(user));
onFailure(result, (error) => logError(error));

// Use map for transformations
const emailResult = map(userResult, (user) => user.email);

// Use unwrapOr for defaults
const user = unwrapOr(userResult, GUEST_USER);
```

## Migration Strategy

### Phase 1: New Code (Current)
- All new code should use the Result pattern
- Use `BaseMessageHandler` Result-based methods
- Prefer `OperationResultHandler.wrapWithResult()` for new operations

### Phase 2: Gradual Migration
- Identify high-priority services with error-prone operations
- Refactor one service at a time
- Maintain backward compatibility during transition
- Both patterns can coexist during migration

### Phase 3: Complete Adoption
- All services migrated to Result pattern
- Legacy error handling methods deprecated
- ESLint rules enforcing Result pattern usage

## Testing

Example test for Result-based functions:

```typescript
import { expect } from 'chai';
import { isSuccess, isFailure } from '../types/Result';

describe('getUserById', () => {
  it('should return success for valid user ID', () => {
    const result = getUserById('valid-id');

    expect(isSuccess(result)).to.be.true;
    if (isSuccess(result)) {
      expect(result.value.id).to.equal('valid-id');
    }
  });

  it('should return failure for invalid user ID', () => {
    const result = getUserById('invalid-id');

    expect(isFailure(result)).to.be.true;
    if (isFailure(result)) {
      expect(result.error.code).to.equal(ErrorCode.RESOURCE_NOT_FOUND);
      expect(result.error.message).to.include('not found');
    }
  });
});
```

## Further Reading

- See `src/types/Result.ts` for complete API reference
- See `src/test/unit/types/Result.test.ts` for comprehensive test examples
- See `src/messaging/handlers/BaseMessageHandler.ts` for handler integration
- See `src/utils/OperationResultHandler.ts` for operation handling integration
