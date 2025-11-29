# VS Code Terminal Link Handling - Implementation Guide

This document explains how VS Code's integrated terminal detects and handles clickable links (both URLs and file paths), based on research from the official VS Code repository.

## Overview

VS Code's terminal link system uses xterm.js's **Link Provider API** to enable clicking on URLs and file paths in terminal output. The implementation was modernized in PR #90336, replacing regex-based link matchers with a provider-based system that detects links on-demand when hovering.

**Key Repository Reference**: `microsoft/vscode` (MIT License)
**Primary Location**: `src/vs/workbench/contrib/terminalContrib/links/browser/`

---

## Architecture Overview

### Core Components

```
TerminalLinkManager (Coordinator)
├── Link Detectors (ITerminalLinkDetector)
│   ├── TerminalLocalLinkDetector (file paths)
│   ├── TerminalUriLinkDetector (URLs)
│   └── TerminalWordLinkProvider (fallback word matching)
├── Link Detector Adapters (xterm.js integration)
│   └── TerminalLinkDetectorAdapter (ILinkProvider)
├── Link Resolvers (ITerminalLinkResolver)
│   └── Validates paths and URIs against filesystem
└── Link Openers (ITerminalLinkOpener)
    ├── TerminalLocalFileLinkOpener
    ├── TerminalLocalFolderInWorkspaceLinkOpener
    ├── TerminalLocalFolderOutsideWorkspaceLinkOpener
    ├── TerminalSearchLinkOpener
    └── TerminalUrlLinkOpener
```

---

## Key Files and Their Purposes

### Link Detection Core

| File | Purpose |
|------|---------|
| **terminalLinkManager.ts** | Main coordinator - registers providers with xterm.js, handles activation flow |
| **links.ts** | Interface definitions (ITerminalLinkDetector, ITerminalSimpleLink, ITerminalLinkResolver) |
| **terminalLinkDetectorAdapter.ts** | Adapter that implements xterm.js ILinkProvider interface, bridges detectors to xterm.js |

### Link Detectors

| File | Purpose |
|------|---------|
| **terminalLocalLinkDetector.ts** | Detects local file paths using three-pass strategy (primary parsing, fallback matchers, attribute-based) |
| **terminalUriLinkDetector.ts** | Detects URLs using LinkComputer, validates file:// URIs against filesystem |
| **terminalWordLinkProvider.ts** | Fallback detector for generic words based on wordSeparators setting |

### Link Actions

| File | Purpose |
|------|---------|
| **terminalLink.ts** | TerminalLink class - implements ILink interface, handles hover/activation/leave events |
| **terminalLinkOpeners.ts** | Five opener implementations for files, folders (workspace/external), search, and URLs |
| **terminalLinkParsing.ts** | Regex patterns and parsing utilities for link text extraction |

---

## Link Detection Flow

### 1. Provider Registration (Initialization)

```typescript
// In TerminalLinkManager constructor
constructor(xterm: Terminal, ...) {
  // Create detectors in priority order
  this._detectors = [
    new TerminalLocalLinkDetector(...),  // File paths
    new TerminalUriLinkDetector(...),     // URLs
    new TerminalWordLinkProvider(...)     // Fallback words
  ];

  // Wrap each detector in adapter for xterm.js compatibility
  this._standardLinkProviders = this._detectors.map(
    detector => new TerminalLinkDetectorAdapter(detector, ...)
  );

  // Register with xterm.js
  this._registerStandardLinkProviders();
}

private _registerStandardLinkProviders() {
  for (const provider of this._standardLinkProviders) {
    this._xterm.registerLinkProvider(provider);
  }
}
```

### 2. Detection Trigger (On Hover/Viewport Change)

When xterm.js needs links for a visible buffer line:

```typescript
// In TerminalLinkDetectorAdapter
async provideLinks(y: number): Promise<ILink[]> {
  // Avoid duplicate detection requests
  if (this._activeProvideRequest?.y === y) {
    return this._activeProvideRequest.promise;
  }

  // Get wrapped lines context (multi-line links)
  const bufferLines = this._getBufferLineContext(y);

  // Call detector's detect() method
  const links = await this._detector.detect(
    bufferLines,
    startLine,
    endLine
  );

  // Transform to TerminalLink instances
  return links.map(link => new TerminalLink(
    link.bufferRange,
    link.text,
    link.uri,
    ...
  ));
}
```

### 3. Link Detection Strategies

#### Local File Path Detection (TerminalLocalLinkDetector)

**Three-Pass Approach**:

1. **Primary Parsing**: Uses `detectLinks()` function
   - Validates absolute paths (`/path/to/file`)
   - Validates relative paths with command detection (`./file.txt`)
   - Fallback resolution against initial working directory

2. **Fallback Matchers**: Language-specific regex patterns
   ```typescript
   const fallbackMatchers = [
     // Python: File "<path>", line 339
     /"((?:\.\.[\/\\]|[a-zA-Z]:[\/\\]|\.{0,2}\/)[^\(\)<>:\"\[\]]+)"/,

     // C++: C:\foo\bar(339) or C:\foo\bar:339
     /([^\s\(\)\[\]]+)\((\d+)\)/,

     // PowerShell: At C:\foo\bar.ps1:339 char:12
     /at ([^\(\)<>:\"\[\]]+):(\d+) char:(\d+)/
   ];
   ```

3. **Attribute-Based Detection**: Split by styled segments (underlined/bold)

**Performance Limits**:
```typescript
const maxLineLength = 2000;           // Characters per line
const maxResolvedLinksPerLine = 10;   // Links to validate
const maxLinkLength = 1024;            // Individual link length
```

#### URL Detection (TerminalUriLinkDetector)

```typescript
async detect(lines: IBufferLine[], startLine: number, endLine: number) {
  // Use LinkComputer for URL extraction
  const adapter = new TerminalLinkAdapter(lines, startLine);
  const computedLinks = LinkComputer.computeLinks(adapter);

  // Validate each link
  for (const link of computedLinks) {
    // Filter by length (max 2048 chars)
    if (link.url.length > 2048) continue;

    // Validate file:// URIs against filesystem
    if (link.url.scheme === 'file') {
      const resolved = await this._linkResolver.resolveLink(
        link.url.path,
        processInfo.cwd
      );
      if (resolved) {
        links.push(createLink(resolved));
      }
    } else {
      // Non-file URLs pass through
      links.push(createLink(link.url));
    }
  }

  return links; // Max 10 per line
}
```

---

## Link Activation Flow

### 1. User Click Detection

```typescript
// In TerminalLinkManager, registered with xterm.js
this._xterm.options.linkHandler = {
  activate: (event: MouseEvent, text: string) => {
    this._handleLinkActivation(event, text);
  },
  hover: (event: MouseEvent, text: string, range: IBufferRange) => {
    this._showHover(event, text, range);
  }
};
```

### 2. Modifier Key Validation

```typescript
private _handleLinkActivation(event: MouseEvent, text: string) {
  // Check if correct modifier key is pressed
  const modifier = this._configurationService.getValue(
    'editor.multiCursorModifier'
  );

  const isValidModifier = (
    (modifier === 'alt' && event.altKey) ||
    (modifier === 'ctrlCmd' && (event.ctrlKey || event.metaKey))
  );

  if (!isValidModifier) {
    return; // Ignore click without modifier
  }

  // Proceed with activation
  this._openLink(text);
}
```

### 3. Link Opening

```typescript
private async _openLink(link: ITerminalSimpleLink) {
  // Determine link type and get appropriate opener
  const opener = this._getOpener(link.type);

  // Open with context
  await opener.open(link);
}
```

### 4. Link Opener Implementations

#### File Links
```typescript
// TerminalLocalFileLinkOpener
async open(link: ITerminalSimpleLink) {
  // Extract line/column from suffix (e.g., "file.ts:42:10")
  const { path, line, column } = this._parseFilePath(link.text);

  // Open in editor
  await this._editorService.openEditor({
    resource: link.uri,
    options: {
      pinned: true,                    // Keep editor tab visible
      selection: { startLine: line, startColumn: column }
    }
  });
}
```

#### Folder Links (Workspace)
```typescript
// TerminalLocalFolderInWorkspaceLinkOpener
async open(link: ITerminalSimpleLink) {
  // Reveal in VS Code explorer
  await this._commandService.executeCommand(
    'revealInExplorer',
    link.uri
  );
}
```

#### Folder Links (External)
```typescript
// TerminalLocalFolderOutsideWorkspaceLinkOpener
async open(link: ITerminalSimpleLink) {
  // Open new VS Code window for external folder
  await this._hostService.openWindow({
    forceNewWindow: true,
    uri: link.uri
  });
}
```

#### URL Links
```typescript
// TerminalUrlLinkOpener
async open(link: ITerminalSimpleLink) {
  if (link.uri.scheme === 'file') {
    // Determine if file or directory
    const stat = await this._fileService.stat(link.uri);
    const opener = stat.isDirectory
      ? this._folderOpener
      : this._fileOpener;
    await opener.open(link);
  } else {
    // Open external URL
    await this._openerService.open(link.uri, {
      allowTunneling: true  // Support remote development
    });
  }
}
```

#### Search Links (Low Confidence Matches)
```typescript
// TerminalSearchLinkOpener
async open(link: ITerminalSimpleLink) {
  // Strategy 1: Try exact match with CWD resolution
  const resolvedPath = this._resolveWithCwd(link.text);
  if (await this._fileExists(resolvedPath)) {
    return this._openFile(resolvedPath);
  }

  // Strategy 2: Search workspace for matching files
  const matches = await this._searchService.fileSearch(link.text);
  if (matches.length === 1) {
    return this._openFile(matches[0]);
  }

  // Strategy 3: Open quick access with search term
  await this._quickInputService.quickAccess.show(link.text);
}
```

---

## Link Hover Behavior

### Visual Decorations

The `TerminalLink` class manages hover states:

```typescript
// In TerminalLink.hover()
hover(event: MouseEvent, isHovering: boolean) {
  // Check modifier key state
  const modifier = this._getActiveModifier();
  const showDecoration = (
    (modifier === 'alt' && event.altKey) ||
    (modifier === 'ctrlCmd' && (event.ctrlKey || event.metaKey))
  );

  // Apply visual feedback
  this.decorations = {
    pointerCursor: showDecoration,
    underline: showDecoration
  };

  // Schedule tooltip display (configurable delay)
  this._tooltipScheduler = setTimeout(() => {
    this._showTooltip(event);
  }, this._hoverDelay);

  // Track mouse movement to reset tooltip timer
  this._onMouseMove = (moveEvent) => {
    if (this._hasMovedSignificantly(event, moveEvent)) {
      this._resetTooltipTimer();
    }
  };
}
```

### Tooltip Content

```typescript
private _showTooltip(event: MouseEvent) {
  const tooltip = this._createTooltip(this.type);

  // Examples of tooltip text:
  // - "Open file in editor" (local file)
  // - "Follow link" (URL)
  // - "Search workspace" (low-confidence match)
  // - "Open folder" (directory)

  this._hoverWidget.show(tooltip, event.clientX, event.clientY);
}
```

---

## Integration with xterm.js

### ILinkProvider Interface

VS Code's `TerminalLinkDetectorAdapter` implements xterm.js's `ILinkProvider`:

```typescript
interface ILinkProvider {
  /**
   * Called when xterm needs links for a buffer line.
   * @param y The y position (0-based) in the viewport.
   */
  provideLinks(y: number): Promise<ILink[] | undefined>;
}

interface ILink {
  range: IBufferRange;        // Line and column positions
  text: string;               // Display text
  decorations?: {
    pointerCursor?: boolean;  // Show pointer cursor on hover
    underline?: boolean;      // Underline the link
  };

  activate(event: MouseEvent, text: string): void;
  hover?(event: MouseEvent, text: string): void;
  leave?(): void;
}
```

### Registration Pattern

```typescript
// In TerminalLinkManager
private _registerStandardLinkProviders() {
  // Register in priority order (first registered = highest priority)
  this._disposables.push(
    this._xterm.registerLinkProvider(this._externalLinkProvider)
  );

  for (const provider of this._standardLinkProviders) {
    this._disposables.push(
      this._xterm.registerLinkProvider(provider)
    );
  }
}
```

### Link Detection Context

The adapter gathers context for multi-line links:

```typescript
private _getBufferLineContext(y: number): IBufferLine[] {
  const lines: IBufferLine[] = [];
  const maxLines = Math.ceil(
    this._detector.maxLinkLength / this._xterm.cols
  );

  // Get wrapped lines before target line
  for (let i = y - 1; i >= 0 && lines.length < maxLines; i--) {
    const line = this._xterm.buffer.active.getLine(i);
    if (!line?.isWrapped) break;
    lines.unshift(line);
  }

  // Add target line
  lines.push(this._xterm.buffer.active.getLine(y));

  // Get wrapped lines after target line
  for (let i = y + 1; i < this._xterm.buffer.active.length; i++) {
    if (lines.length >= maxLines) break;
    const line = this._xterm.buffer.active.getLine(i);
    if (!line?.isWrapped) break;
    lines.push(line);
  }

  return lines;
}
```

---

## Key Implementation Patterns

### 1. Deduplication of Detection Requests

```typescript
// In TerminalLinkDetectorAdapter
private _activeProvideRequest?: {
  y: number;
  promise: Promise<ILink[]>;
};

async provideLinks(y: number): Promise<ILink[]> {
  // Reuse existing promise for same line
  if (this._activeProvideRequest?.y === y) {
    return this._activeProvideRequest.promise;
  }

  const promise = this._detectAndTransformLinks(y);
  this._activeProvideRequest = { y, promise };

  return promise;
}
```

### 2. Performance Optimization

```typescript
// Limit validation to prevent filesystem overload
const MAX_LINKS_PER_LINE = 10;
const MAX_LINK_LENGTH = 2048;
const MAX_LINE_LENGTH = 2000;

// Early exit for long lines
if (lineText.length > MAX_LINE_LENGTH) {
  return [];
}

// Limit validated links
const linksToValidate = candidates.slice(0, MAX_LINKS_PER_LINE);
```

### 3. Security: Link Scheme Validation

```typescript
// Check allowed schemes before opening
const allowedSchemes = this._configurationService.getValue(
  'terminal.integrated.allowedLinkSchemes'
);

if (!allowedSchemes.includes(uri.scheme)) {
  // Prompt user to approve scheme
  const result = await this._dialogService.confirm({
    message: `Allow opening ${uri.scheme} links?`,
    detail: `The terminal wants to open: ${uri.toString()}`
  });

  if (!result.confirmed) {
    return; // Abort opening
  }

  // Remember approval
  allowedSchemes.push(uri.scheme);
}
```

### 4. Wrapped Line Handling

```typescript
// Reconstruct text from wrapped lines
private _getTextFromLines(lines: IBufferLine[]): string {
  let text = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    text += line.translateToString(true); // trimRight = true

    // Don't add space if line is wrapped
    if (!line.isWrapped && i < lines.length - 1) {
      text += ' ';
    }
  }
  return text;
}
```

---

## Configuration Settings

VS Code exposes these settings for link behavior:

```typescript
// Terminal link settings
{
  "terminal.integrated.experimentalLinkProvider": true,  // Use new provider API
  "terminal.integrated.allowedLinkSchemes": [            // Allowed URL schemes
    "http", "https", "file", "vscode", "vscode-insiders"
  ],
  "terminal.integrated.enableFileLinks": true,           // Enable file links
  "terminal.integrated.localEchoEnabled": false,         // Disable local echo

  // Editor settings affecting links
  "editor.multiCursorModifier": "alt",                   // Modifier for link activation
  "workbench.editor.enablePreview": true                 // Preview mode for opened files
}
```

---

## Extension API (Proposed)

VS Code allows extensions to register custom link providers:

```typescript
// In extension code
const provider: vscode.TerminalLinkProvider = {
  provideTerminalLinks(context: vscode.TerminalLinkContext) {
    // Custom detection logic
    const links: vscode.TerminalLink[] = [];

    // Example: Detect Jira ticket IDs
    const regex = /\b([A-Z]+-\d+)\b/g;
    let match;
    while (match = regex.exec(context.line)) {
      links.push({
        startIndex: match.index,
        length: match[0].length,
        tooltip: `Open ${match[1]} in Jira`,
        data: match[1] // Custom data passed to handler
      });
    }

    return links;
  },

  handleTerminalLink(link: vscode.TerminalLink) {
    // Open Jira ticket in browser
    const ticketId = link.data;
    vscode.env.openExternal(
      vscode.Uri.parse(`https://jira.company.com/browse/${ticketId}`)
    );
  }
};

// Register provider
const disposable = vscode.window.registerTerminalLinkProvider(provider);
```

---

## Testing Considerations

### Test Scenarios from VS Code

1. **Basic link detection**
   - File paths (absolute, relative)
   - URLs (http, https, file://)
   - Line:column suffixes (`:42`, `:42:10`, `(42)`, `(42,10)`)

2. **Edge cases**
   - Wide characters (CJK) at line boundaries
   - Wrapped lines (links spanning multiple terminal lines)
   - Links with spaces (when quoted)
   - Attribute-based links (underlined text)

3. **Performance**
   - Long lines (>2000 chars) should be skipped
   - Many links (>10 per line) should be limited
   - Rapid terminal output should debounce detection

4. **Security**
   - Unrecognized URL schemes prompt user
   - File:// links validate against filesystem
   - External links respect security settings

---

## Key Takeaways for Implementation

### 1. Use the Link Provider API (Not Regex Matchers)

The modern approach uses xterm.js's `registerLinkProvider()` instead of legacy regex matchers. This enables:
- On-demand detection (only when hovering)
- Multi-line link support (wrapped lines)
- Better performance (no viewport-wide scanning)
- Easier debugging and testing

### 2. Implement Multiple Detectors

VS Code uses a layered detection strategy:
- **Primary detectors**: High-confidence patterns (absolute paths, URLs)
- **Fallback detectors**: Language-specific error formats
- **Word detectors**: Generic word matching for quick access

### 3. Validate Before Opening

Always validate links before activation:
- Check filesystem for file:// URIs
- Verify URL schemes against allowed list
- Prompt user for unknown schemes

### 4. Handle Modifier Keys

Respect VS Code's modifier key conventions:
- Show visual decorations (underline, pointer cursor) on modifier key
- Only activate links when correct modifier is pressed
- Support both `alt` and `ctrlCmd` modifiers

### 5. Optimize for Performance

Implement limits to prevent performance issues:
- Max line length for detection
- Max links per line to validate
- Max individual link length
- Debounce rapid detection requests

### 6. Support Wrapped Lines

Terminal links can span multiple buffer lines:
- Detect wrapped lines using `line.isWrapped`
- Reconstruct text from multiple lines
- Calculate buffer ranges correctly

---

## References

### Primary Sources

- [PR #90336: Adopt terminal link provider API](https://github.com/microsoft/vscode/pull/90336)
- [Issue #95081: Terminal link provider-based links preview](https://github.com/microsoft/vscode/issues/95081)
- [Issue #91290: Allow extensions to contribute links to the terminal](https://github.com/microsoft/vscode/issues/91290)
- [Issue #141743: Simplify terminal link code structure](https://github.com/microsoft/vscode/issues/141743)

### Source Files (microsoft/vscode repository)

**Detection Core**:
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkManager.ts`
- `src/vs/workbench/contrib/terminalContrib/links/browser/links.ts`
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkDetectorAdapter.ts`

**Detectors**:
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLocalLinkDetector.ts`
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalUriLinkDetector.ts`
- `src/vs/workbench/contrib/terminal/browser/links/terminalWordLinkProvider.ts`

**Link Handling**:
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLink.ts`
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkOpeners.ts`
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkParsing.ts`

### xterm.js Integration

- [xterm.js Link Provider API documentation](https://github.com/xtermjs/xterm.js)
- [Working with xterm.js in VS Code](https://github.com/microsoft/vscode-wiki/blob/main/Working-with-xterm.js.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-29
**VS Code Version Reference**: main branch (latest)
