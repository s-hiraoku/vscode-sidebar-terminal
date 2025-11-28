# Analysis Tools for Bug Hunting

Comprehensive guide to static and dynamic analysis tools for finding bugs in VS Code extensions.

## Static Analysis Tools

### TypeScript Compiler (tsc)

The TypeScript compiler is the first line of defense.

```bash
# Basic type checking
npx tsc --noEmit

# Strict mode - catches more issues
npx tsc --noEmit --strict

# Individual strict flags for targeted analysis
npx tsc --noEmit --noImplicitAny        # Find implicit any types
npx tsc --noEmit --strictNullChecks     # Find null/undefined issues
npx tsc --noEmit --noUnusedLocals       # Find unused variables
npx tsc --noEmit --noUnusedParameters   # Find unused parameters
npx tsc --noEmit --noImplicitReturns    # Find missing returns
npx tsc --noEmit --noFallthroughCasesInSwitch  # Find switch fallthrough
```

**Recommended tsconfig.json for Bug Hunting**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### ESLint

ESLint with TypeScript support catches additional issues.

```bash
# Run ESLint
npx eslint src/ --ext .ts

# With specific rules for bug hunting
npx eslint src/ --ext .ts --rule 'no-floating-promises: error'
npx eslint src/ --ext .ts --rule '@typescript-eslint/no-misused-promises: error'
```

**Recommended ESLint Rules for Bug Hunting**:
```json
{
  "rules": {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "warn",
    "@typescript-eslint/strict-boolean-expressions": "warn",
    "no-return-await": "error",
    "require-await": "warn",
    "no-async-promise-executor": "error",
    "no-promise-executor-return": "error"
  }
}
```

### Grep-Based Analysis

Pattern-based searches for common bugs.

```bash
# Memory leak detection
grep -rn "addEventListener" src/ --include="*.ts"
grep -rn "setInterval\|setTimeout" src/ --include="*.ts"
grep -rn "vscode\.\w+\.on\w+" src/ --include="*.ts" | grep -v "subscriptions.push"

# Race condition detection
grep -rn "async.*{" src/ --include="*.ts" | wc -l  # Count async functions
grep -rn "Promise.all\|Promise.race" src/ --include="*.ts"

# Error handling gaps
grep -rn "\.then\(" src/ --include="*.ts" | grep -v "\.catch\("
grep -rn "catch\s*(\s*)\s*{" src/ --include="*.ts"  # Empty catch params
grep -rn "catch\s*{" src/ --include="*.ts" -A 1 | grep "^\s*}$"  # Empty catch blocks

# Security issues
grep -rn "eval\|new Function" src/ --include="*.ts"
grep -rn "innerHTML\|outerHTML" src/ --include="*.ts"
grep -rn "child_process" src/ --include="*.ts"

# Code smells
grep -rn "as any" src/ --include="*.ts"
grep -rn "@ts-ignore\|@ts-nocheck" src/ --include="*.ts"
grep -rn "TODO\|FIXME\|HACK\|BUG\|XXX" src/ --include="*.ts"
grep -rn "console\.\(log\|debug\|info\)" src/ --include="*.ts"
```

### AST-Based Analysis

For deeper analysis, use TypeScript's AST.

```typescript
// analysis/find-unhandled-promises.ts
import * as ts from 'typescript';

function analyzeFile(sourceFile: ts.SourceFile) {
  function visit(node: ts.Node) {
    // Find call expressions that return Promise but aren't awaited
    if (ts.isCallExpression(node)) {
      const parent = node.parent;
      if (!ts.isAwaitExpression(parent) &&
          !ts.isReturnStatement(parent)) {
        // Potential unhandled promise
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        console.log(`Potential unhandled promise at line ${pos.line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}
```

## Dynamic Analysis Tools

### VS Code Developer Tools

Built-in Chrome DevTools for the Extension Host.

**Opening Developer Tools**:
- Command Palette: "Developer: Toggle Developer Tools"
- Opens Chrome DevTools for Extension Host process

**Key Panels**:

1. **Console**
   - View extension logs
   - Filter by extension name
   - Look for errors and warnings

2. **Sources**
   - Set breakpoints in extension code
   - Step through execution
   - Inspect variables

3. **Memory**
   - Take heap snapshots
   - Compare snapshots to find leaks
   - Track object allocations

4. **Performance**
   - Record performance profiles
   - Find slow functions
   - Identify jank

### Memory Profiling

**Heap Snapshot Analysis**:
```
1. Open Developer Tools
2. Go to Memory tab
3. Take heap snapshot (baseline)
4. Perform suspected leaking operation
5. Take another snapshot
6. Compare snapshots - look for retained objects
```

**Allocation Timeline**:
```
1. Memory tab > Allocation instrumentation on timeline
2. Start recording
3. Perform operations
4. Stop recording
5. Analyze allocation patterns
```

**Key Metrics to Watch**:
- `Shallow Size`: Memory held by object itself
- `Retained Size`: Memory that would be freed if object is GC'd
- `Distance`: Number of references from GC root

### Performance Profiling

**CPU Profile**:
```
1. Performance tab
2. Click Record
3. Perform operations
4. Stop recording
5. Analyze flame chart
```

**Extension Host Profiler**:
```bash
# Start VS Code with profiling
code --prof-startup
# Profile file saved to ~/.vscode/exthost-<pid>.cpuprofile
```

### WebView Developer Tools

For debugging WebView content.

```
1. Open WebView panel
2. Command Palette: "Developer: Open WebView Developer Tools"
3. Use standard Chrome DevTools
```

**Common WebView Debugging Tasks**:
- Inspect DOM structure
- Check CSS applied
- Monitor network requests from WebView
- Debug JavaScript execution
- Check console for errors

### Runtime Instrumentation

Add temporary logging for investigation.

```typescript
// Wrap function to trace calls
function trace<T extends (...args: any[]) => any>(
  name: string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    console.log(`[TRACE] ${name} called with:`, args);
    const start = performance.now();
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.then(
          (value) => {
            console.log(`[TRACE] ${name} resolved in ${performance.now() - start}ms`);
            return value;
          },
          (error) => {
            console.log(`[TRACE] ${name} rejected in ${performance.now() - start}ms:`, error);
            throw error;
          }
        );
      }
      console.log(`[TRACE] ${name} returned in ${performance.now() - start}ms`);
      return result;
    } catch (error) {
      console.log(`[TRACE] ${name} threw in ${performance.now() - start}ms:`, error);
      throw error;
    }
  }) as T;
}

// Usage
this.createTerminal = trace('createTerminal', this.createTerminal.bind(this));
```

### Memory Leak Detection

Runtime detection of leaks.

```typescript
// Track object creation/destruction
class LeakDetector<T extends object> {
  private instances = new WeakSet<T>();
  private count = 0;

  created(instance: T): void {
    this.instances.add(instance);
    this.count++;
    console.log(`[LEAK] ${this.name} created, total: ${this.count}`);
  }

  destroyed(instance: T): void {
    if (this.instances.has(instance)) {
      this.count--;
      console.log(`[LEAK] ${this.name} destroyed, remaining: ${this.count}`);
    }
  }

  constructor(private name: string) {}
}

// Usage
const terminalLeakDetector = new LeakDetector<Terminal>('Terminal');

class TerminalManager {
  createTerminal(): Terminal {
    const terminal = new Terminal();
    terminalLeakDetector.created(terminal);
    return terminal;
  }

  disposeTerminal(terminal: Terminal): void {
    terminalLeakDetector.destroyed(terminal);
    terminal.dispose();
  }
}
```

### Event Listener Tracking

Track event listener registration.

```typescript
// Debug wrapper for event registration
function trackListeners<T extends vscode.Disposable>(
  source: string,
  disposable: T
): T {
  const original = disposable.dispose.bind(disposable);
  let disposed = false;

  console.log(`[LISTENER] ${source} registered`);

  disposable.dispose = () => {
    if (!disposed) {
      disposed = true;
      console.log(`[LISTENER] ${source} disposed`);
      original();
    } else {
      console.warn(`[LISTENER] ${source} already disposed!`);
    }
  };

  return disposable;
}

// Usage
const listener = trackListeners(
  'workspace.onDidChangeConfiguration',
  vscode.workspace.onDidChangeConfiguration(() => {})
);
```

## Automated Testing Tools

### Unit Test Coverage

```bash
# Run tests with coverage
npm run test:coverage

# Check for untested code paths
npx c8 report --reporter=text-summary
```

**Coverage Targets for Bug-Prone Areas**:
- Error handlers: 100%
- Edge cases: 100%
- Async operations: 90%+
- State mutations: 90%+

### Mutation Testing

Find untested bugs by mutating code.

```bash
# Using Stryker
npx stryker run

# Analyzes which mutations survive tests
# Surviving mutations = potential untested bugs
```

### Fuzzing

Generate random inputs to find edge cases.

```typescript
// Simple fuzzer for input validation
function fuzz(fn: (input: string) => void, iterations = 1000): void {
  const generators = [
    () => '',
    () => ' '.repeat(Math.random() * 100),
    () => 'a'.repeat(Math.random() * 10000),
    () => String.fromCharCode(...Array(100).fill(0).map(() => Math.random() * 65535)),
    () => '../'.repeat(Math.random() * 10),
    () => '<script>alert(1)</script>',
    () => '${process.exit()}',
    () => null as unknown as string,
    () => undefined as unknown as string,
  ];

  for (let i = 0; i < iterations; i++) {
    const generator = generators[Math.floor(Math.random() * generators.length)];
    try {
      fn(generator());
    } catch (error) {
      console.log(`[FUZZ] Crash with input:`, generator());
      throw error;
    }
  }
}
```

## CI/CD Integration

### Pre-Commit Hooks

```bash
# .husky/pre-commit
npx tsc --noEmit
npx eslint src/ --ext .ts --max-warnings 0
npm run test:unit
```

### GitHub Actions for Bug Detection

```yaml
name: Bug Detection
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Type Check
        run: npx tsc --noEmit --strict

      - name: Lint
        run: npx eslint src/ --ext .ts

      - name: Security Scan
        run: |
          grep -rn "eval\|innerHTML\|exec\(" src/ --include="*.ts" && exit 1 || true

      - name: Code Smell Detection
        run: |
          count=$(grep -rn "@ts-ignore\|as any" src/ --include="*.ts" | wc -l)
          echo "Found $count code smells"
          [ $count -gt 10 ] && exit 1 || true
```

## Tool Selection Guide

| Bug Type | Primary Tool | Secondary Tool |
|----------|-------------|----------------|
| Type errors | tsc --strict | ESLint |
| Memory leaks | Heap Snapshot | Custom tracking |
| Race conditions | Code review | Runtime tracing |
| Null references | strictNullChecks | Grep patterns |
| Unhandled promises | ESLint | Grep patterns |
| Performance | Performance tab | CPU profiler |
| Security | Grep + ESLint | Manual review |
| WebView issues | WebView DevTools | Console logs |

## Quick Reference

```bash
# Full analysis pipeline
npm run compile && \
npx tsc --noEmit --strict && \
npx eslint src/ --ext .ts && \
grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts"

# Memory leak scan
grep -rn "addEventListener\|setInterval\|vscode\.\w+\.on" src/ --include="*.ts" | \
grep -v "dispose\|clear\|subscriptions"

# Security scan
grep -rn "eval\|innerHTML\|exec\|spawn" src/ --include="*.ts"

# Async issue scan
grep -rn "async.*{" src/ --include="*.ts" | wc -l && \
grep -rn "try\s*{" src/ --include="*.ts" | wc -l
```
