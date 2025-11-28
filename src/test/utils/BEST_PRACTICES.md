# Test Infrastructure Best Practices

## Test Organization

### 1. One Test Class Per Test File

```typescript
// ✅ Good
class MyServiceTest extends BaseTest {
  public service!: MyService;
}

describe('MyService', () => {
  const test = new MyServiceTest();
  // All tests use this instance
});

// ❌ Bad - Multiple test classes
class Test1 extends BaseTest {}
class Test2 extends BaseTest {}
```

### 2. Descriptive Test Class Names

```typescript
// ✅ Good - Clear what's being tested
class TerminalDataBufferServiceTest extends BaseTest {}
class ShellIntegrationServiceTest extends BaseTest {}

// ❌ Bad - Generic names
class Test extends BaseTest {}
class MyTest extends BaseTest {}
```

### 3. Organize Tests by Feature

```typescript
describe('MyService', () => {
  const test = new MyServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  describe('Feature A', () => {
    it('should handle case 1', () => {});
    it('should handle case 2', () => {});
  });

  describe('Feature B', () => {
    it('should work correctly', () => {});
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {});
  });
});
```

## Setup and Teardown

### 1. Always Call Super

```typescript
// ✅ Good
protected override setup(): void {
  super.setup(); // FIRST
  this.service = new Service();
}

protected override teardown(): void {
  if (this.service) {
    this.service.dispose();
  }
  super.teardown(); // LAST
}

// ❌ Bad - Missing super calls
protected override setup(): void {
  this.service = new Service(); // Missing super.setup()
}
```

### 2. Cleanup Order Matters

```typescript
// ✅ Good - Cleanup in reverse order of creation
protected override teardown(): void {
  if (this.service2) this.service2.dispose(); // Created second
  if (this.service1) this.service1.dispose(); // Created first
  super.teardown(); // Always last
}

// ❌ Bad - Wrong order
protected override teardown(): void {
  super.teardown(); // Too early!
  if (this.service) this.service.dispose(); // Won't have sandbox
}
```

### 3. Null Checks in Teardown

```typescript
// ✅ Good - Defensive null checks
protected override teardown(): void {
  if (this.service) {
    this.service.dispose();
  }
  super.teardown();
}

// ❌ Bad - Assumes service exists
protected override teardown(): void {
  this.service.dispose(); // May throw if setup failed
  super.teardown();
}
```

## Property Visibility

### 1. Use Public for Test Access

```typescript
// ✅ Good - Public properties accessible in tests
class MyTest extends BaseTest {
  public service!: MyService;
  public mockDep!: sinon.SinonStubbedInstance<Dependency>;
}

// Usage in tests
it('should work', () => {
  test.service.method(); // ✅ Works
  test.mockDep.verify(); // ✅ Works
});

// ❌ Bad - Protected not accessible
class MyTest extends BaseTest {
  protected service!: MyService; // Can't access in tests
}
```

### 2. Use Protected for Helpers

```typescript
class MyTest extends BaseTest {
  public service!: MyService;

  // ✅ Good - Protected helpers
  protected createTestData(): Data {
    return { id: 'test' };
  }
}

// Can use in test class methods, but cleaner test bodies
```

## Mocking and Stubbing

### 1. Create Stubs in Setup

```typescript
// ✅ Good - Consistent mocks for all tests
protected override setup(): void {
  super.setup();
  this.mockDep = this.sandbox.createStubInstance(Dependency);
  this.service = new Service(this.mockDep);
}

// ❌ Bad - Creating mocks in each test
it('test 1', () => {
  const mockDep = test.sandbox.createStubInstance(Dependency);
  // Inconsistent across tests
});
```

### 2. Reset Stubs Between Tests

```typescript
// ✅ Good - Automatic reset via sandbox
// BaseTest automatically restores sandbox in teardown

// ❌ Bad - Manual reset
afterEach(() => {
  mockDep.someMethod.reset(); // Not needed with sandbox
});
```

### 3. Use Sandbox for All Stubs

```typescript
// ✅ Good - All stubs tracked by sandbox
const stub = test.sandbox.stub(obj, 'method');
const spy = test.sandbox.spy(obj, 'method');

// ❌ Bad - Standalone stubs (not cleaned up)
const stub = sinon.stub(obj, 'method'); // Manual cleanup needed
```

## Async Testing

### 1. Use AsyncTest for Time-Based Tests

```typescript
// ✅ Good - Fake timers
class MyAsyncTest extends AsyncTest {
  protected useFakeTimers = true;
}

it('should wait', async () => {
  const promise = test.service.delayed();
  await test.tick(1000); // Instant
  await promise;
});

// ❌ Bad - Real timers (slow tests)
it('should wait', async () => {
  const promise = test.service.delayed();
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Actually waits
  await promise;
});
```

### 2. Track Promises

```typescript
// ✅ Good - Tracked promises
it('should complete', async () => {
  const promise = test.track(test.service.asyncOp());
  // Promise is tracked
  await promise;
});

// ✅ Also good - Direct await
it('should complete', async () => {
  await test.service.asyncOp();
});
```

### 3. Handle Async Errors

```typescript
// ✅ Good - Proper error handling
it('should handle errors', async () => {
  try {
    await test.service.failingOp();
    expect.fail('Should have thrown');
  } catch (error) {
    expect(error).to.be.instanceOf(Error);
  }
});

// ✅ Also good - expect().to.be.rejected
it('should reject', async () => {
  await expect(test.service.failingOp()).to.be.rejected;
});
```

## Test Independence

### 1. No Shared State

```typescript
// ✅ Good - Fresh service each test
protected override setup(): void {
  super.setup();
  this.service = new Service(); // New instance every test
}

// ❌ Bad - Shared state
class MyTest extends BaseTest {
  public service = new Service(); // Shared across tests!
}
```

### 2. Use beforeEach/afterEach

```typescript
// ✅ Good - Clean slate every test
describe('MyService', () => {
  const test = new MyServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());
});

// ❌ Bad - before/after (runs once)
describe('MyService', () => {
  const test = new MyServiceTest();

  before(() => test.beforeEach()); // Only once!
  after(() => test.afterEach());
});
```

### 3. Don't Rely on Test Order

```typescript
// ✅ Good - Each test standalone
it('test 1', () => {
  test.service.method(); // Independent
  expect(result).to.equal(expected);
});

it('test 2', () => {
  test.service.method(); // Independent
  expect(result).to.equal(expected);
});

// ❌ Bad - Test 2 depends on Test 1
it('test 1', () => {
  test.service.setState('ready');
});

it('test 2', () => {
  // Assumes test 1 ran first
  expect(test.service.getState()).to.equal('ready');
});
```

## Configuration Testing

### 1. Set Defaults in getDefaultConfig

```typescript
// ✅ Good - Centralized defaults
class ConfigTest extends ConfigurationTest {
  protected override getDefaultConfig() {
    return {
      'ext.setting1': 'default1',
      'ext.setting2': true,
    };
  }
}

// ❌ Bad - Setting in each test
it('test 1', () => {
  test.updateConfig('ext.setting1', 'value'); // Repetitive
});
```

### 2. Use triggerSectionChange

```typescript
// ✅ Good - Trigger specific section
it('should handle config change', () => {
  test.updateConfig('ext.setting1', 'new');
  test.triggerSectionChange('ext');
  // Handler called
});

// ❌ Bad - Trigger all changes
it('should handle config change', () => {
  test.updateConfig('ext.setting1', 'new');
  test.triggerConfigChange(() => true); // Too broad
});
```

## WebView Testing

### 1. Use Message Queue Assertions

```typescript
// ✅ Good - Check message queue
it('should post message', () => {
  test.manager.postMessage({ command: 'test' });

  test.assertMessagePosted('test');
  // Or
  const messages = test.getPostedMessages();
  expect(messages).to.have.length(1);
});

// ❌ Bad - Manual verification
it('should post message', () => {
  let called = false;
  test.mockWebview.postMessage = () => {
    called = true;
  };
  test.manager.postMessage({ command: 'test' });
  expect(called).to.be.true; // More verbose
});
```

### 2. Clear Queue Between Tests

```typescript
// ✅ Good - Use clearMessageQueue
it('test 1', () => {
  test.manager.postMessage({ command: 'test1' });
  expect(test.getPostedMessages()).to.have.length(1);
});

it('test 2', () => {
  // Queue auto-cleared by beforeEach
  test.manager.postMessage({ command: 'test2' });
  expect(test.getPostedMessages()).to.have.length(1);
});
```

## Terminal Testing

### 1. Use Mock Terminals

```typescript
// ✅ Good - Use createMockTerminal
it('should create terminal', () => {
  const terminal = test.createMockTerminal({
    id: 1,
    name: 'Test',
  });

  expect(terminal.id).to.equal(1);
  expect(terminal.name).to.equal('Test');
});

// ❌ Bad - Manual mock
it('should create terminal', () => {
  const terminal = {
    id: 1,
    name: 'Test',
    write: sinon.stub(), // Missing cleanup
  };
});
```

### 2. Simulate Data Flow

```typescript
// ✅ Good - Use simulateTerminalData
it('should handle data', () => {
  const terminal = test.createMockTerminal({ id: 1 });

  test.simulateTerminalData(1, 'hello\n');

  const output = test.getTerminalOutput(1);
  expect(output).to.include('hello');
});
```

## Performance

### 1. Use Fake Timers for Speed

```typescript
// ✅ Good - Instant time progression
class FastTest extends AsyncTest {
  protected useFakeTimers = true;
}

it('completes quickly', async () => {
  const promise = test.service.delay(10000);
  await test.tick(10000); // Instant
  await promise;
}); // Runs in milliseconds

// ❌ Bad - Actually waits
it('takes forever', async () => {
  await new Promise((r) => setTimeout(r, 10000)); // 10 seconds!
});
```

### 2. Minimize Setup Complexity

```typescript
// ✅ Good - Only create what's needed
protected override setup(): void {
  super.setup();
  this.service = new Service(); // Just what we need
}

// ❌ Bad - Creating unnecessary objects
protected override setup(): void {
  super.setup();
  this.service1 = new Service1(); // Not used
  this.service2 = new Service2(); // Not used
  this.service3 = new Service3(); // Actually used
}
```

## Error Messages

### 1. Descriptive Assertions

```typescript
// ✅ Good - Clear error messages
expect(result).to.equal(expected, 'Result should match expected value');

// ❌ Bad - No context
expect(result).to.equal(expected);
```

### 2. Custom Assertion Helpers

```typescript
// ✅ Good - Domain-specific assertions
protected assertTerminalState(id: number, state: string): void {
  const actual = test.service.getState(id);
  expect(actual).to.equal(state,
    `Terminal ${id} should be in state ${state}, but was ${actual}`);
}

// Use in tests
it('should transition state', () => {
  test.assertTerminalState(1, 'ready');
});
```

## Common Pitfalls

### ❌ Pitfall 1: Forgetting test. Prefix

```typescript
// ❌ Wrong
it('should work', () => {
  service.method(); // Error: service is not defined
});

// ✅ Correct
it('should work', () => {
  test.service.method();
});
```

### ❌ Pitfall 2: Wrong Import Path

```typescript
// ❌ Wrong
import { BaseTest } from '../utils'; // May not exist

// ✅ Correct - Check depth
import { BaseTest } from '../../utils'; // For services/
import { BaseTest } from '../../../utils'; // For services/terminal/
```

### ❌ Pitfall 3: Not Calling Super

```typescript
// ❌ Wrong - No super.setup()
protected override setup(): void {
  this.service = new Service(); // Sandbox not initialized!
}

// ✅ Correct
protected override setup(): void {
  super.setup(); // Initializes sandbox, mocks, etc.
  this.service = new Service();
}
```

### ❌ Pitfall 4: Protected Properties

```typescript
// ❌ Wrong - Can't access in tests
class MyTest extends BaseTest {
  protected service!: MyService;
}

it('test', () => {
  test.service.method(); // Error: protected
});

// ✅ Correct
class MyTest extends BaseTest {
  public service!: MyService;
}
```

## Summary

✅ **DO:**

- Extend appropriate base class
- Call `super.setup()` first, `super.teardown()` last
- Use `public` for properties accessed in tests
- Use `test.` prefix for all properties
- Create mocks in setup
- Use fake timers for speed
- Write independent tests

❌ **DON'T:**

- Share state between tests
- Forget `super` calls
- Use standalone stubs (use sandbox)
- Rely on test execution order
- Create mocks in test bodies
- Use real timers unless necessary
- Skip teardown cleanup

## Reference

See migrated tests for examples:

- `src/test/unit/services/terminal/TerminalDataBufferService.test.ts`
- `src/test/unit/config/ConfigurationService.test.ts`
- `src/test/unit/async/AsyncOperations.test.ts`
- `src/test/unit/webview/managers/ConsolidatedMessageManager.test.ts`
