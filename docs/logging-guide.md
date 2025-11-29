# Logging Guide

## Overview

This extension uses a structured logging system to replace scattered `console.log` statements with configurable, centralized logging.

## Logging Service

### For Extension Code (Node.js context)

Use the `LoggerService` for extension-side code:

```typescript
import { getLogger } from '../services/LoggerService';

const logger = getLogger();

logger.debug('Debug message', 'ContextName', { data: 'value' });
logger.info('Info message', 'ContextName');
logger.warn('Warning message', 'ContextName');
logger.error('Error message', 'ContextName', error);
```

### For Shared/Webview Code

Use the existing `logger` utility for webview and shared code:

```typescript
import { info, warn, error, debug } from '../utils/logger';

debug('Debug message');
info('Info message');
warn('Warning message');
error('Error message', errorObject);

// Categorized logging
import { terminal, webview, ui, lifecycle } from '../utils/logger';

terminal('Terminal created', terminalId);
webview('WebView initialized');
ui('Button clicked');
lifecycle('Component mounted');
```

## Configuration

Users can configure logging via VS Code settings:

```json
{
  "secondaryTerminal.logging.level": "warn",
  "secondaryTerminal.logging.enableTimestamp": true,
  "secondaryTerminal.logging.enableContext": true
}
```

Log levels (from least to most verbose):
- `none`: No logging
- `error`: Only errors
- `warn`: Errors and warnings (default)
- `info`: Errors, warnings, and informational messages
- `debug`: All messages including debug information

## Production Builds

### Webpack Configuration

The webpack configuration automatically strips debug logs from production builds:

- `console.log` - Removed in production
- `console.debug` - Removed in production
- `console.info` - Removed in production
- `console.warn` - Kept for important warnings
- `console.error` - Kept for error reporting

To build for production:

```bash
NODE_ENV=production npm run compile
```

### Development Mode

In development mode, logs are output to the console for debugging:

```bash
npm run compile
# or
npm run watch
```

## ESLint Rules

The codebase enforces a **no-console** rule via ESLint:

- Direct `console.*` usage is not allowed
- Use the logger utilities instead
- Exceptions: `logger.ts`, `ManagerLogger.ts`, and test files

To check for violations:

```bash
npm run lint
```

## Migration from console.log

Replace console statements with logger calls:

### Before
```typescript
console.log('Terminal created:', id);
console.warn('Something unexpected:', data);
console.error('Failed to initialize:', error);
```

### After
```typescript
import { info, warn, error } from '../utils/logger';

info('Terminal created:', id);
warn('Something unexpected:', data);
error('Failed to initialize:', error);
```

## Best Practices

1. **Use appropriate log levels**
   - `debug`: Detailed diagnostic information
   - `info`: General informational messages
   - `warn`: Warning messages for potentially harmful situations
   - `error`: Error messages for serious problems

2. **Provide context**
   ```typescript
   logger.info('Operation completed', 'TerminalManager', { terminalId, duration });
   ```

3. **Avoid sensitive data**
   - Never log passwords, tokens, or personal information
   - Be careful with user data and file paths

4. **Use categorized logging**
   ```typescript
   import { terminal, webview, ui } from '../utils/logger';

   terminal('Created terminal', terminalId);
   webview('Updated view state');
   ui('User clicked button');
   ```

5. **Performance considerations**
   - Expensive operations should be guarded:
   ```typescript
   if (logger.isDebugEnabled()) {
     logger.debug('Expensive data', JSON.stringify(largeObject));
   }
   ```

## Viewing Logs

### Extension Logs
1. Open VS Code Output panel (`View > Output`)
2. Select "Secondary Terminal" from the dropdown

### Webview Logs
1. Open Developer Tools (`Help > Toggle Developer Tools`)
2. View console output (in development mode only)

## Pre-commit Hooks (Optional)

To set up pre-commit hooks to enforce logging standards:

1. Install husky and lint-staged:
   ```bash
   npm install --save-dev husky lint-staged
   ```

2. Initialize husky:
   ```bash
   npx husky init
   ```

3. Add pre-commit hook:
   ```bash
   npx husky add .husky/pre-commit "npx lint-staged"
   ```

4. Configure lint-staged in `package.json`:
   ```json
   {
     "lint-staged": {
       "*.{ts,js}": [
         "eslint --fix",
         "prettier --write"
       ]
     }
   }
   ```

## Troubleshooting

### Logs not appearing

1. Check log level setting
2. Verify logger is imported correctly
3. Check Output panel is set to "Secondary Terminal"

### Console.log still in code

1. Run ESLint: `npm run lint`
2. Fix violations manually or use `npm run lint -- --fix`
3. Check .eslintrc.json has the no-console rule enabled

### Production logs too verbose

1. Verify `NODE_ENV=production` is set during build
2. Check webpack.config.js has terser configuration
3. Rebuild with production flag

## Related Issues

- [Issue #266](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/266) - Reduce excessive console logging with structured Logger
