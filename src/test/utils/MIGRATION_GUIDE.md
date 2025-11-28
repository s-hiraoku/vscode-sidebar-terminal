# Test Infrastructure Migration Guide

## Overview

This guide helps you migrate existing tests to use our standardized base test classes, reducing boilerplate and improving maintainability.

## Available Base Classes

### 1. BaseTest - Foundation for All Tests

**Use When:**

- Testing services, utilities, or standalone functions
- Need sandbox and mock management
- No special async or domain requirements

**Example:**

```typescript
import { BaseTest } from '../utils';
import { MyService } from '../../../services/MyService';

class MyServiceTest extends BaseTest {
  public service!: MyService;

  protected override setup(): void {
    super.setup();
    this.service = new MyService();
  }

  protected override teardown(): void {
    if (this.service) {
      this.service.dispose();
    }
    super.teardown();
  }
}

describe('MyService', () => {
  const test = new MyServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  it('should work correctly', () => {
    // Use test.service, test.sandbox, test.vscode
    expect(test.service.method()).to.equal(expected);
  });
});
```

### 2. ConfigurationTest - Configuration Testing

**Use When:**

- Testing configuration services
- Need to simulate config changes
- Working with VSCode settings

**Example:**

```typescript
import { ConfigurationTest } from '../utils';
import { ConfigService } from '../../../config/ConfigService';

class ConfigServiceTest extends ConfigurationTest {
  public configService!: ConfigService;

  protected override setup(): void {
    super.setup();
    this.resetSingleton(ConfigService as any);
    this.configService = ConfigService.getInstance();
  }

  protected override getDefaultConfig() {
    return {
      'myExtension.setting1': 'default',
      'myExtension.setting2': true,
    };
  }
}

describe('ConfigService', () => {
  const test = new ConfigServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  it('should handle config changes', () => {
    // Trigger config change
    test.triggerSectionChange('myExtension');

    // Verify behavior
    expect(test.configService.getSetting('setting1')).to.equal('default');
  });
});
```

### 3. AsyncTest - Async Operations & Timers

**Use When:**

- Testing async operations
- Need fake timers for time-based testing
- Working with promises and timeouts

**Example:**

```typescript
import { AsyncTest } from '../utils';
import { AsyncService } from '../../../services/AsyncService';

class AsyncServiceTest extends AsyncTest {
  public service!: AsyncService;
  protected useFakeTimers = true; // Enable fake timers

  protected override setup(): void {
    super.setup();
    this.service = new AsyncService();
  }
}

describe('AsyncService', () => {
  const test = new AsyncServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  it('should handle delayed operations', async () => {
    const promise = test.track(test.service.delayedOperation());

    // Advance time by 1000ms
    await test.tick(1000);

    const result = await promise;
    expect(result).to.equal(expected);
  });
});
```

### 4. WebViewTest - WebView Testing

**Use When:**

- Testing WebView managers or coordinators
- Need message queue simulation
- Working with webview communication

**Example:**

```typescript
import { WebViewTest } from '../utils';
import { MessageManager } from '../../../webview/MessageManager';

class MessageManagerTest extends WebViewTest {
  public manager!: MessageManager;
  public mockCoordinator!: IManagerCoordinator;

  protected override setup(): void {
    super.setup();

    this.mockCoordinator = {
      postMessageToExtension: this.sandbox.stub(),
      getActiveTerminalId: () => 'terminal-1',
    } as any;

    this.manager = new MessageManager(this.mockCoordinator);
  }
}

describe('MessageManager', () => {
  const test = new MessageManagerTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  it('should post messages', () => {
    test.manager.postMessage({ command: 'test' });

    // Check message queue
    const messages = test.getPostedMessages();
    expect(messages).to.have.length(1);
  });
});
```

### 5. TerminalTest - Terminal Testing

**Use When:**

- Testing terminal managers or services
- Need mock terminal creation
- Working with terminal processes

**Example:**

```typescript
import { TerminalTest } from '../utils';
import { TerminalService } from '../../../services/TerminalService';

class TerminalServiceTest extends TerminalTest {
  public service!: TerminalService;

  protected override setup(): void {
    super.setup();
    this.service = new TerminalService();
  }
}

describe('TerminalService', () => {
  const test = new TerminalServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  it('should create terminals', () => {
    const terminal = test.createMockTerminal({
      id: 1,
      name: 'Test Terminal',
    });

    // Simulate terminal data
    test.simulateTerminalData(1, 'hello\n');

    // Check output
    const output = test.getTerminalOutput(1);
    expect(output).to.include('hello');
  });
});
```

## Migration Steps

### Step 1: Identify the Right Base Class

Look at what your test is testing:

- **Service/Utility** → BaseTest
- **Configuration** → ConfigurationTest
- **Async/Timers** → AsyncTest
- **WebView** → WebViewTest
- **Terminal** → TerminalTest

### Step 2: Create the Test Class

```typescript
// Before
describe('MyTest', () => {
  let sandbox: sinon.SinonSandbox;
  let service: MyService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    service = new MyService();
  });

  afterEach(() => {
    service.dispose();
    sandbox.restore();
  });
});

// After
class MyTestClass extends BaseTest {
  public service!: MyService;

  protected override setup(): void {
    super.setup();
    this.service = new MyService();
  }

  protected override teardown(): void {
    if (this.service) {
      this.service.dispose();
    }
    super.teardown();
  }
}

describe('MyTest', () => {
  const test = new MyTestClass();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());
});
```

### Step 3: Update References

Replace all local variable references with `test.` prefix:

```bash
# Use sed for bulk replacement
sed -i '' -E 's/([^.])service\./\1test.service./g' my-test.test.ts
sed -i '' -E 's/([^.])sandbox\./\1test.sandbox./g' my-test.test.ts
```

**Manual fixes needed for:**

- Variable declarations: `const service` → `test.service`
- Function parameters: `myFunc(service)` → `myFunc(test.service)`
- Comparisons: `expect(service)` → `expect(test.service)`

### Step 4: Verify Compilation

```bash
npm run compile-tests
```

Fix any errors:

- Missing `test.` prefix
- Wrong import path (usually `../../utils` for service tests, `../utils` for config tests)
- Incorrect property visibility (should be `public`, not `protected`)

### Step 5: Run Tests

```bash
npm test -- --grep "MyTest"
```

## Common Patterns

### Pattern 1: Singleton Reset

```typescript
protected override setup(): void {
  super.setup();
  this.resetSingleton(MySingleton as any);
  this.singleton = MySingleton.getInstance();
}
```

### Pattern 2: Mock Creation

```typescript
protected override setup(): void {
  super.setup();
  this.mockDependency = this.sandbox.createStubInstance(Dependency);
  this.service = new Service(this.mockDependency);
}
```

### Pattern 3: Multiple Services

```typescript
class MultiServiceTest extends BaseTest {
  public service1!: Service1;
  public service2!: Service2;

  protected override setup(): void {
    super.setup();
    this.service1 = new Service1();
    this.service2 = new Service2(this.service1);
  }

  protected override teardown(): void {
    if (this.service2) this.service2.dispose();
    if (this.service1) this.service1.dispose();
    super.teardown();
  }
}
```

### Pattern 4: Custom Helpers

```typescript
class MyTest extends BaseTest {
  public service!: MyService;

  protected override setup(): void {
    super.setup();
    this.service = new MyService();
  }

  // Custom helper method
  protected createTestData(): TestData {
    return {
      id: 'test-1',
      name: 'Test Data',
      timestamp: Date.now(),
    };
  }
}

// Use in tests
it('should process test data', () => {
  const data = test.createTestData();
  test.service.process(data);
  // ...
});
```

## Import Paths

**Import path varies by test location:**

```typescript
// For tests in src/test/unit/config/
import { BaseTest } from '../../utils';

// For tests in src/test/unit/services/
import { BaseTest } from '../../utils';

// For tests in src/test/unit/webview/managers/
import { BaseTest } from '../../../utils';

// For tests in src/test/unit/services/terminal/
import { BaseTest } from '../../../utils';
```

**Rule of thumb:**

- Count directory depth from `src/test/unit/` to your test file
- Use `../../utils` for depth 1 (unit/something/)
- Use `../../../utils` for depth 2 (unit/something/subsomething/)

## Troubleshooting

### Error: Cannot find module '../utils'

**Fix:** Adjust import path based on test location (see Import Paths above)

### Error: Property 'sandbox' does not exist

**Fix:** Ensure class extends BaseTest and calls `super.setup()`

### Error: This member cannot have an 'override' modifier

**Fix:** Remove `override` keyword or ensure class extends a base class

### Tests fail with "sandbox is not defined"

**Fix:** Use `test.sandbox` instead of `sandbox` in test bodies

### Mock not working in nested describe

**Fix:** Ensure `beforeEach` calls `test.beforeEach()` in outer describe block

## Benefits

✅ **Reduced Boilerplate**: ~10-15 lines saved per test file
✅ **Automatic Cleanup**: No manual sandbox.restore() needed
✅ **Consistent Patterns**: Same structure across all tests
✅ **Better Maintainability**: Update once, applies everywhere
✅ **Type Safety**: Full TypeScript support
✅ **Domain Helpers**: Specialized methods for each test type

## Migration Checklist

- [ ] Identify appropriate base class
- [ ] Create test class extending base
- [ ] Move setup logic to `setup()` method
- [ ] Move teardown logic to `teardown()` method
- [ ] Update all variable references to `test.` prefix
- [ ] Fix import path if needed
- [ ] Verify compilation (`npm run compile-tests`)
- [ ] Run tests (`npm test -- --grep "TestName"`)
- [ ] Commit changes with clear message

## Examples Repository

See migrated tests for reference:

- `src/test/unit/services/terminal/TerminalDataBufferService.test.ts` - BaseTest
- `src/test/unit/config/ConfigurationService.test.ts` - ConfigurationTest
- `src/test/unit/async/AsyncOperations.test.ts` - AsyncTest
- `src/test/unit/webview/managers/ConsolidatedMessageManager.test.ts` - WebViewTest

## Questions?

See `src/test/utils/README.md` for detailed base class documentation.
