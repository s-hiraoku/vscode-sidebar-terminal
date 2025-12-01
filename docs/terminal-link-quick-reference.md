# Terminal Link Handling - Quick Reference

Quick reference for implementing link detection and activation in VS Code extension terminals.

## Core Flow

```
User Hovers Over Terminal
    ↓
xterm.js calls provider.provideLinks(y)
    ↓
TerminalLinkDetectorAdapter gathers buffer lines
    ↓
Detector.detect() runs (Local/URI/Word)
    ↓
Returns ITerminalSimpleLink[]
    ↓
Adapter transforms to TerminalLink (ILink)
    ↓
xterm.js displays decorations (underline, pointer)
    ↓
User Clicks with Modifier Key
    ↓
linkHandler.activate(event, text)
    ↓
TerminalLinkManager validates modifier key
    ↓
Appropriate LinkOpener.open(link)
    ↓
File/Folder/URL opens
```

## Key Interfaces

### ILinkProvider (xterm.js)
```typescript
interface ILinkProvider {
  provideLinks(y: number): Promise<ILink[]>;
}
```

### ITerminalLinkDetector (VS Code)
```typescript
interface ITerminalLinkDetector {
  readonly maxLinkLength: number;
  detect(
    lines: IBufferLine[],
    startLine: number,
    endLine: number
  ): Promise<ITerminalSimpleLink[]>;
}
```

### ITerminalSimpleLink (VS Code)
```typescript
interface ITerminalSimpleLink {
  text: string;
  bufferRange: IBufferRange;
  type: TerminalBuiltinLinkType | { id: string };
  uri?: URI;
  label?: string;
  activate?(): void;
}
```

### ILink (xterm.js)
```typescript
interface ILink {
  range: IBufferRange;
  text: string;
  decorations?: {
    pointerCursor?: boolean;
    underline?: boolean;
  };
  activate(event: MouseEvent, text: string): void;
  hover?(event: MouseEvent, text: string): void;
  leave?(): void;
}
```

## Registration Pattern

```typescript
// 1. Create detectors
const localDetector = new TerminalLocalLinkDetector(...);
const uriDetector = new TerminalUriLinkDetector(...);

// 2. Wrap in adapters
const adapters = [
  new TerminalLinkDetectorAdapter(localDetector, ...),
  new TerminalLinkDetectorAdapter(uriDetector, ...)
];

// 3. Register with xterm.js
for (const adapter of adapters) {
  disposables.push(
    xterm.registerLinkProvider(adapter)
  );
}

// 4. Set custom link handler
xterm.options.linkHandler = {
  activate: (event, text) => {
    this._openLink(event, text);
  },
  hover: (event, text, range) => {
    this._showHover(event, text, range);
  }
};
```

## Detection Strategies

### Local File Links

**Three-Pass Approach**:

1. **Primary parsing**: Absolute and relative paths
   ```typescript
   // Examples detected:
   /absolute/path/to/file.ts
   ./relative/file.ts
   ../parent/file.ts
   C:\Windows\path\file.txt
   ```

2. **Fallback matchers**: Language-specific formats
   ```typescript
   // Python:  File "path.py", line 42
   // C++:     C:\file.cpp(339)
   // Node.js: at file.js:42:10
   ```

3. **Attribute-based**: Styled terminal segments

### URL Links

```typescript
// Use LinkComputer from VS Code's link detection
const adapter = new TerminalLinkAdapter(bufferLines);
const links = LinkComputer.computeLinks(adapter);

// Filter and validate
for (const link of links) {
  if (link.url.scheme === 'file') {
    // Validate against filesystem
    const resolved = await linkResolver.resolveLink(link.url.path);
    if (resolved) links.push(resolved);
  } else {
    // Pass through http/https
    links.push(link);
  }
}
```

## Link Opening

### Pattern
```typescript
interface ITerminalLinkOpener {
  open(link: ITerminalSimpleLink): Promise<void>;
}

// Five standard openers:
class TerminalLocalFileLinkOpener {
  // Opens file in editor with line/column
}

class TerminalLocalFolderInWorkspaceLinkOpener {
  // Reveals in explorer
}

class TerminalLocalFolderOutsideWorkspaceLinkOpener {
  // Opens new window
}

class TerminalSearchLinkOpener {
  // Tries CWD resolution → workspace search → quick access
}

class TerminalUrlLinkOpener {
  // Delegates to file/folder openers or opens external URL
}
```

## Wrapped Line Handling

```typescript
// Get wrapped lines before and after target
private _getBufferLineContext(y: number): IBufferLine[] {
  const lines: IBufferLine[] = [];
  const maxLines = Math.ceil(maxLinkLength / terminalCols);

  // Get previous wrapped lines
  for (let i = y - 1; i >= 0 && lines.length < maxLines; i--) {
    const line = buffer.getLine(i);
    if (!line?.isWrapped) break;
    lines.unshift(line);
  }

  // Add current line
  lines.push(buffer.getLine(y));

  // Get next wrapped lines
  for (let i = y + 1; i < buffer.length; i++) {
    if (lines.length >= maxLines) break;
    const line = buffer.getLine(i);
    if (!line?.isWrapped) break;
    lines.push(line);
  }

  return lines;
}

// Reconstruct text
private _getTextFromLines(lines: IBufferLine[]): string {
  let text = '';
  for (let i = 0; i < lines.length; i++) {
    text += lines[i].translateToString(true); // trimRight
    if (!lines[i].isWrapped && i < lines.length - 1) {
      text += ' '; // Add space between unwrapped lines
    }
  }
  return text;
}
```

## Performance Limits

```typescript
const MAX_LINE_LENGTH = 2000;           // Skip detection for long lines
const MAX_RESOLVED_LINKS_PER_LINE = 10; // Limit filesystem validation
const MAX_LINK_LENGTH = 2048;            // Individual link max
```

## Modifier Key Detection

```typescript
private _isValidActivation(event: MouseEvent): boolean {
  const modifier = this._config.get('editor.multiCursorModifier');

  return (
    (modifier === 'alt' && event.altKey) ||
    (modifier === 'ctrlCmd' && (event.ctrlKey || event.metaKey))
  );
}
```

## Hover Decorations

```typescript
// In TerminalLink.hover()
hover(event: MouseEvent, isHovering: boolean) {
  const showDecoration = this._checkModifierKey(event);

  // Apply visual feedback
  this.decorations = {
    pointerCursor: showDecoration,
    underline: showDecoration
  };

  // Schedule tooltip (with configurable delay)
  this._tooltipScheduler = setTimeout(() => {
    this._showTooltip();
  }, this._hoverDelay);
}
```

## Security: Scheme Validation

```typescript
private async _validateScheme(uri: URI): Promise<boolean> {
  const allowedSchemes = this._config.get(
    'terminal.integrated.allowedLinkSchemes'
  );

  if (allowedSchemes.includes(uri.scheme)) {
    return true;
  }

  // Prompt user
  const result = await this._dialogService.confirm({
    message: `Allow opening ${uri.scheme} links?`,
    detail: uri.toString()
  });

  if (result.confirmed) {
    allowedSchemes.push(uri.scheme);
  }

  return result.confirmed;
}
```

## File Path Parsing

```typescript
// Extract line and column from suffixes
// Supported formats:
//   file.ts:42          → line 42
//   file.ts:42:10       → line 42, column 10
//   file.ts(42)         → line 42
//   file.ts(42,10)      → line 42, column 10
//   file.ts (42)        → line 42 (with space)

interface ParsedPath {
  path: string;
  line?: number;
  column?: number;
}

function parseFilePath(text: string): ParsedPath {
  // Use regex to extract components
  const match = text.match(
    /^(.+?)(?::(\d+)(?::(\d+))?|\((\d+)(?:,\s?(\d+))?\))?$/
  );

  if (!match) return { path: text };

  return {
    path: match[1],
    line: parseInt(match[2] || match[4] || '0'),
    column: parseInt(match[3] || match[5] || '0')
  };
}
```

## Extension API Example

```typescript
// Register custom link provider
const provider: vscode.TerminalLinkProvider = {
  provideTerminalLinks(context: vscode.TerminalLinkContext) {
    const links: vscode.TerminalLink[] = [];

    // Custom detection (e.g., Jira tickets)
    const regex = /\b([A-Z]+-\d+)\b/g;
    let match;

    while (match = regex.exec(context.line)) {
      links.push({
        startIndex: match.index,
        length: match[0].length,
        tooltip: `Open ${match[1]}`,
        data: match[1]
      });
    }

    return links;
  },

  handleTerminalLink(link: vscode.TerminalLink) {
    // Open in browser
    vscode.env.openExternal(
      vscode.Uri.parse(`https://jira.company.com/browse/${link.data}`)
    );
  }
};

vscode.window.registerTerminalLinkProvider(provider);
```

## Common Patterns

### Deduplication
```typescript
private _activeRequest?: { y: number; promise: Promise<ILink[]> };

async provideLinks(y: number): Promise<ILink[]> {
  if (this._activeRequest?.y === y) {
    return this._activeRequest.promise; // Reuse
  }

  const promise = this._detect(y);
  this._activeRequest = { y, promise };
  return promise;
}
```

### Disposal
```typescript
class TerminalLinkDetectorAdapter implements ILinkProvider {
  private _disposables: IDisposable[] = [];

  dispose() {
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}
```

### Error Handling
```typescript
async provideLinks(y: number): Promise<ILink[]> {
  try {
    return await this._detector.detect(lines, start, end);
  } catch (error) {
    console.error('Link detection failed:', error);
    return []; // Fail gracefully
  }
}
```

## Key Files Reference

| File | Location |
|------|----------|
| Link Manager | `terminalContrib/links/browser/terminalLinkManager.ts` |
| Interfaces | `terminalContrib/links/browser/links.ts` |
| Adapter | `terminalContrib/links/browser/terminalLinkDetectorAdapter.ts` |
| Local Detector | `terminalContrib/links/browser/terminalLocalLinkDetector.ts` |
| URI Detector | `terminalContrib/links/browser/terminalUriLinkDetector.ts` |
| Link Class | `terminalContrib/links/browser/terminalLink.ts` |
| Openers | `terminalContrib/links/browser/terminalLinkOpeners.ts` |

## Testing Checklist

- [ ] Absolute file paths detected
- [ ] Relative file paths detected
- [ ] File paths with line:column detected
- [ ] HTTP/HTTPS URLs detected
- [ ] file:// URLs validated
- [ ] Wrapped lines handled correctly
- [ ] Wide characters (CJK) handled
- [ ] Modifier key activates links
- [ ] Hover shows decorations
- [ ] Tooltip displays correctly
- [ ] Long lines (>2000 chars) skipped
- [ ] Max links per line (10) enforced
- [ ] Unknown schemes prompt user
- [ ] File openers work correctly
- [ ] URL openers work correctly
- [ ] Folder openers work correctly
- [ ] Search fallback works
- [ ] Extension API functional

---

**Quick Reference Version**: 1.0
**For detailed explanations, see**: `vscode-terminal-link-handling.md`
