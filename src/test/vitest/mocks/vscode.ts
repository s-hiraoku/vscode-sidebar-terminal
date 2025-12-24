/**
 * VS Code API Mock for Vitest
 * Provides a complete mock of the vscode module for testing
 */

import { vi } from 'vitest';

// URI mock
export class Uri {
  scheme: string;
  authority: string;
  path: string;
  query: string;
  fragment: string;
  fsPath: string;

  constructor(scheme: string, authority: string, path: string, query?: string, fragment?: string) {
    this.scheme = scheme;
    this.authority = authority;
    this.path = path;
    this.query = query || '';
    this.fragment = fragment || '';
    this.fsPath = path;
  }

  static file(path: string): Uri {
    return new Uri('file', '', path);
  }

  static parse(value: string): Uri {
    const url = new URL(value);
    return new Uri(url.protocol.replace(':', ''), url.host, url.pathname);
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    const newPath = `${base.path}/${pathSegments.join('/')}`;
    return new Uri(base.scheme, base.authority, newPath);
  }

  toString(): string {
    return `${this.scheme}://${this.authority}${this.path}`;
  }

  with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }): Uri {
    return new Uri(
      change.scheme ?? this.scheme,
      change.authority ?? this.authority,
      change.path ?? this.path,
      change.query ?? this.query,
      change.fragment ?? this.fragment
    );
  }

  toJSON(): object {
    return {
      scheme: this.scheme,
      authority: this.authority,
      path: this.path,
      query: this.query,
      fragment: this.fragment,
      fsPath: this.fsPath,
    };
  }
}

// Event Emitter mock
export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];

  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
  };

  fire(data: T): void {
    this.listeners.forEach(listener => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Disposable mock
export class Disposable {
  private _callOnDispose?: () => void;

  constructor(callOnDispose?: () => void) {
    this._callOnDispose = callOnDispose;
  }

  static from(...disposables: { dispose(): void }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach(d => d.dispose());
    });
  }

  dispose(): void {
    this._callOnDispose?.();
  }
}

// ThemeColor mock
export class ThemeColor {
  id: string;
  constructor(id: string) {
    this.id = id;
  }
}

// Position mock
export class Position {
  line: number;
  character: number;

  constructor(line: number, character: number) {
    this.line = line;
    this.character = character;
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  isBefore(other: Position): boolean {
    return this.line < other.line || (this.line === other.line && this.character < other.character);
  }

  isAfter(other: Position): boolean {
    return this.line > other.line || (this.line === other.line && this.character > other.character);
  }

  translate(lineDelta?: number, characterDelta?: number): Position {
    return new Position(this.line + (lineDelta || 0), this.character + (characterDelta || 0));
  }

  with(line?: number, character?: number): Position {
    return new Position(line ?? this.line, character ?? this.character);
  }
}

// Range mock
export class Range {
  start: Position;
  end: Position;

  constructor(start: Position, end: Position);
  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(startOrLine: Position | number, endOrCharacter: Position | number, endLine?: number, endCharacter?: number) {
    if (typeof startOrLine === 'number') {
      this.start = new Position(startOrLine, endOrCharacter as number);
      this.end = new Position(endLine as number, endCharacter as number);
    } else {
      this.start = startOrLine;
      this.end = endOrCharacter as Position;
    }
  }

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }

  get isSingleLine(): boolean {
    return this.start.line === this.end.line;
  }

  contains(positionOrRange: Position | Range): boolean {
    if (positionOrRange instanceof Position) {
      return !positionOrRange.isBefore(this.start) && !positionOrRange.isAfter(this.end);
    }
    return this.contains(positionOrRange.start) && this.contains(positionOrRange.end);
  }
}

// Selection mock
export class Selection extends Range {
  anchor: Position;
  active: Position;

  constructor(anchor: Position, active: Position);
  constructor(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number);
  constructor(anchorOrLine: Position | number, activeOrCharacter: Position | number, activeLine?: number, activeCharacter?: number) {
    if (typeof anchorOrLine === 'number') {
      const anchor = new Position(anchorOrLine, activeOrCharacter as number);
      const active = new Position(activeLine as number, activeCharacter as number);
      super(anchor, active);
      this.anchor = anchor;
      this.active = active;
    } else {
      super(anchorOrLine, activeOrCharacter as Position);
      this.anchor = anchorOrLine;
      this.active = activeOrCharacter as Position;
    }
  }

  get isReversed(): boolean {
    return this.anchor.isAfter(this.active);
  }
}

// TextEdit mock
export class TextEdit {
  range: Range;
  newText: string;

  constructor(range: Range, newText: string) {
    this.range = range;
    this.newText = newText;
  }

  static replace(range: Range, newText: string): TextEdit {
    return new TextEdit(range, newText);
  }

  static insert(position: Position, newText: string): TextEdit {
    return new TextEdit(new Range(position, position), newText);
  }

  static delete(range: Range): TextEdit {
    return new TextEdit(range, '');
  }
}

// CancellationTokenSource mock
export class CancellationTokenSource {
  token = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  };

  cancel(): void {
    this.token.isCancellationRequested = true;
  }

  dispose(): void {}
}

// Enums
export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum ExtensionKind {
  UI = 1,
  Workspace = 2,
}

// Workspace mock
export const workspace = {
  workspaceFolders: [
    {
      uri: Uri.file('/test/workspace'),
      name: 'Test Workspace',
      index: 0,
    },
  ],
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
    has: vi.fn().mockReturnValue(false),
    inspect: vi.fn().mockReturnValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }),
  onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidOpenTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidCloseTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidSaveTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeTextDocument: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  openTextDocument: vi.fn().mockResolvedValue({
    getText: vi.fn().mockReturnValue(''),
    lineAt: vi.fn().mockReturnValue({ text: '' }),
    lineCount: 0,
  }),
  fs: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 0 }),
    readDirectory: vi.fn().mockResolvedValue([]),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    isWritableFileSystem: vi.fn().mockReturnValue(true),
  },
  rootPath: '/test/workspace',
  name: 'Test Workspace',
};

// Window mock
export const window = {
  showInformationMessage: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  showErrorMessage: vi.fn().mockResolvedValue(undefined),
  showQuickPick: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  createOutputChannel: vi.fn().mockReturnValue({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
    name: 'Test Output',
  }),
  createStatusBarItem: vi.fn().mockReturnValue({
    text: '',
    tooltip: '',
    command: undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  }),
  createTerminal: vi.fn().mockReturnValue({
    name: 'Test Terminal',
    processId: Promise.resolve(1234),
    sendText: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  }),
  createWebviewPanel: vi.fn().mockReturnValue({
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      postMessage: vi.fn().mockResolvedValue(true),
      asWebviewUri: vi.fn((uri: Uri) => uri),
      cspSource: 'https://test.vscode-resource.vscode-cdn.net',
    },
    onDidDispose: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidChangeViewState: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    reveal: vi.fn(),
    dispose: vi.fn(),
    visible: true,
    viewColumn: ViewColumn.One,
  }),
  registerWebviewViewProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerTreeDataProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  createTreeView: vi.fn().mockReturnValue({
    onDidChangeSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidChangeVisibility: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidCollapseElement: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onDidExpandElement: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    reveal: vi.fn(),
    dispose: vi.fn(),
  }),
  activeTextEditor: undefined,
  visibleTextEditors: [],
  onDidChangeActiveTextEditor: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeVisibleTextEditors: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeTextEditorSelection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  withProgress: vi.fn().mockImplementation((_options, task) => task({ report: vi.fn() })),
  setStatusBarMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  showTextDocument: vi.fn().mockResolvedValue(undefined),
};

// Commands mock
export const commands = {
  registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  executeCommand: vi.fn().mockResolvedValue(undefined),
  getCommands: vi.fn().mockResolvedValue([]),
};

// Extensions mock
export const extensions = {
  getExtension: vi.fn().mockReturnValue(undefined),
  all: [],
  onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

// Languages mock
export const languages = {
  registerCompletionItemProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerHoverProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerDefinitionProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerCodeActionsProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  createDiagnosticCollection: vi.fn().mockReturnValue({
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
    forEach: vi.fn(),
    get: vi.fn(),
    has: vi.fn(),
  }),
  getDiagnostics: vi.fn().mockReturnValue([]),
};

// Env mock
export const env = {
  appName: 'Visual Studio Code',
  appRoot: '/test/vscode',
  language: 'en',
  machineId: 'test-machine-id',
  sessionId: 'test-session-id',
  clipboard: {
    readText: vi.fn().mockResolvedValue(''),
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  openExternal: vi.fn().mockResolvedValue(true),
  uriScheme: 'vscode',
  shell: '/bin/bash',
};

// Debug mock
export const debug = {
  activeDebugSession: undefined,
  breakpoints: [],
  onDidChangeActiveDebugSession: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidStartDebugSession: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidTerminateDebugSession: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  onDidChangeBreakpoints: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  registerDebugConfigurationProvider: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  startDebugging: vi.fn().mockResolvedValue(true),
};

// Context mock
export class ExtensionContext {
  subscriptions: { dispose(): void }[] = [];
  workspaceState = {
    get: vi.fn().mockReturnValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockReturnValue([]),
  };
  globalState = {
    get: vi.fn().mockReturnValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockReturnValue([]),
    setKeysForSync: vi.fn(),
  };
  secrets = {
    get: vi.fn().mockResolvedValue(undefined),
    store: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  };
  extensionPath = '/test/extension';
  extensionUri = Uri.file('/test/extension');
  storagePath = '/test/storage';
  storageUri = Uri.file('/test/storage');
  globalStoragePath = '/test/global-storage';
  globalStorageUri = Uri.file('/test/global-storage');
  logPath = '/test/logs';
  logUri = Uri.file('/test/logs');
  extensionMode = 3; // ExtensionMode.Production
  extension = {
    id: 'test.extension',
    extensionUri: Uri.file('/test/extension'),
    extensionPath: '/test/extension',
    isActive: true,
    packageJSON: {},
    extensionKind: ExtensionKind.Workspace,
    exports: undefined,
    activate: vi.fn().mockResolvedValue(undefined),
  };
  environmentVariableCollection = {
    persistent: true,
    description: undefined,
    replace: vi.fn(),
    append: vi.fn(),
    prepend: vi.fn(),
    get: vi.fn(),
    forEach: vi.fn(),
    clear: vi.fn(),
    delete: vi.fn(),
    getScoped: vi.fn(),
  };
  asAbsolutePath = vi.fn((relativePath: string) => `/test/extension/${relativePath}`);
}

// Default export
export default {
  Uri,
  EventEmitter,
  Disposable,
  ThemeColor,
  Position,
  Range,
  Selection,
  TextEdit,
  CancellationTokenSource,
  ConfigurationTarget,
  ViewColumn,
  StatusBarAlignment,
  TreeItemCollapsibleState,
  ProgressLocation,
  DiagnosticSeverity,
  ExtensionKind,
  ExtensionContext,
  workspace,
  window,
  commands,
  extensions,
  languages,
  env,
  debug,
};
