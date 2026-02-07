# VS Code API Mocking Strategies

## Complete Mock Factory

```typescript
// test/helpers/vscode-mock-factory.ts
import { vi, type Mock } from 'vitest';

export class VSCodeMockFactory {
  createExtensionContext(): MockExtensionContext {
    return new MockExtensionContext();
  }

  createTerminal(options?: Partial<vscode.Terminal>): MockTerminal {
    return new MockTerminal(options);
  }

  createWebviewPanel(options?: Partial<vscode.WebviewPanel>): MockWebviewPanel {
    return new MockWebviewPanel(options);
  }

  createOutputChannel(name: string): MockOutputChannel {
    return new MockOutputChannel(name);
  }

  createStatusBarItem(): MockStatusBarItem {
    return new MockStatusBarItem();
  }

  createTextDocument(content: string, uri?: vscode.Uri): MockTextDocument {
    return new MockTextDocument(content, uri);
  }

  createTextEditor(document: MockTextDocument): MockTextEditor {
    return new MockTextEditor(document);
  }
}
```

## Extension Context Mock

```typescript
// test/helpers/mock-extension-context.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export class MockExtensionContext implements vscode.ExtensionContext {
  subscriptions: { dispose(): any }[] = [];
  workspaceState: MockMemento;
  globalState: MockMemento & { setKeysForSync: Mock };
  secrets: MockSecretStorage;
  extensionUri: vscode.Uri;
  extensionPath: string;
  environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection;
  storagePath: string | undefined;
  globalStoragePath: string;
  logPath: string;
  extensionMode: vscode.ExtensionMode;
  extension: vscode.Extension<any>;
  storageUri: vscode.Uri | undefined;
  globalStorageUri: vscode.Uri;
  logUri: vscode.Uri;
  languageModelAccessInformation: vscode.LanguageModelAccessInformation;

  constructor() {
    this.workspaceState = new MockMemento();
    this.globalState = Object.assign(
      new MockMemento(),
      { setKeysForSync: vi.fn() }
    );
    this.secrets = new MockSecretStorage();
    this.extensionUri = vscode.Uri.file('/mock/extension');
    this.extensionPath = '/mock/extension';
    this.storagePath = '/mock/storage';
    this.globalStoragePath = '/mock/global-storage';
    this.logPath = '/mock/logs';
    this.extensionMode = vscode.ExtensionMode.Test;
    this.storageUri = vscode.Uri.file('/mock/storage');
    this.globalStorageUri = vscode.Uri.file('/mock/global-storage');
    this.logUri = vscode.Uri.file('/mock/logs');
    this.extension = {
      id: 'test.extension',
      extensionUri: this.extensionUri,
      extensionPath: this.extensionPath,
      isActive: true,
      packageJSON: {},
      extensionKind: vscode.ExtensionKind.Workspace,
      exports: undefined,
      activate: vi.fn().mockResolvedValue(undefined)
    };
    this.environmentVariableCollection = {
      persistent: true,
      description: 'Test',
      replace: vi.fn(),
      append: vi.fn(),
      prepend: vi.fn(),
      get: vi.fn(),
      forEach: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getScoped: vi.fn()
    } as any;
    this.languageModelAccessInformation = {
      onDidChange: vi.fn(),
      canSendRequest: vi.fn().mockReturnValue(true)
    } as any;
  }

  asAbsolutePath(relativePath: string): string {
    return `/mock/extension/${relativePath}`;
  }
}

class MockMemento implements vscode.Memento {
  private storage = new Map<string, any>();

  keys(): readonly string[] {
    return Array.from(this.storage.keys());
  }

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get(key: string, defaultValue?: any) {
    return this.storage.get(key) ?? defaultValue;
  }

  update(key: string, value: any): Thenable<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }
}

class MockSecretStorage implements vscode.SecretStorage {
  private secrets = new Map<string, string>();
  private _onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  readonly onDidChange = this._onDidChange.event;

  get(key: string): Thenable<string | undefined> {
    return Promise.resolve(this.secrets.get(key));
  }

  store(key: string, value: string): Thenable<void> {
    this.secrets.set(key, value);
    this._onDidChange.fire({ key });
    return Promise.resolve();
  }

  delete(key: string): Thenable<void> {
    this.secrets.delete(key);
    this._onDidChange.fire({ key });
    return Promise.resolve();
  }
}
```

## Terminal Mock

```typescript
// test/helpers/mock-terminal.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export class MockTerminal implements vscode.Terminal {
  name: string;
  processId: Thenable<number | undefined>;
  creationOptions: Readonly<vscode.TerminalOptions>;
  exitStatus: vscode.TerminalExitStatus | undefined;
  state: vscode.TerminalState;
  shellIntegration: vscode.TerminalShellIntegration | undefined;

  private _sendText: Mock;
  private _show: Mock;
  private _hide: Mock;
  private _dispose: Mock;

  private outputBuffer: string[] = [];
  private inputBuffer: string[] = [];

  constructor(options?: Partial<vscode.Terminal>) {
    this.name = options?.name ?? 'Mock Terminal';
    this.processId = Promise.resolve(options?.processId ?? 12345);
    this.creationOptions = options?.creationOptions ?? {};
    this.exitStatus = options?.exitStatus;
    this.state = options?.state ?? { isInteractedWith: false };

    this._sendText = vi.fn().mockImplementation((text: string) => {
      this.inputBuffer.push(text);
    });
    this._show = vi.fn();
    this._hide = vi.fn();
    this._dispose = vi.fn();
  }

  sendText(text: string, shouldExecute?: boolean): void {
    this._sendText(text, shouldExecute);
  }

  show(preserveFocus?: boolean): void {
    this._show(preserveFocus);
  }

  hide(): void {
    this._hide();
  }

  dispose(): void {
    this._dispose();
  }

  // Test helpers
  simulateOutput(text: string): void {
    this.outputBuffer.push(text);
  }

  getInputHistory(): string[] {
    return [...this.inputBuffer];
  }

  getOutputHistory(): string[] {
    return [...this.outputBuffer];
  }

  getSendTextMock(): Mock {
    return this._sendText;
  }

  getShowMock(): Mock {
    return this._show;
  }

  getHideMock(): Mock {
    return this._hide;
  }

  getDisposeMock(): Mock {
    return this._dispose;
  }
}
```

## WebView Panel Mock

```typescript
// test/helpers/mock-webview-panel.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export class MockWebviewPanel implements vscode.WebviewPanel {
  readonly viewType: string;
  title: string;
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
  webview: MockWebview;
  options: vscode.WebviewPanelOptions;
  viewColumn?: vscode.ViewColumn;
  active: boolean;
  visible: boolean;

  private _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private _onDidChangeViewState = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
  readonly onDidChangeViewState = this._onDidChangeViewState.event;

  private _reveal: Mock;
  private _dispose: Mock;

  constructor(options?: Partial<vscode.WebviewPanel>) {
    this.viewType = options?.viewType ?? 'testView';
    this.title = options?.title ?? 'Test Panel';
    this.webview = new MockWebview();
    this.options = options?.options ?? {};
    this.viewColumn = options?.viewColumn ?? vscode.ViewColumn.One;
    this.active = options?.active ?? true;
    this.visible = options?.visible ?? true;

    this._reveal = vi.fn();
    this._dispose = vi.fn().mockImplementation(() => {
      this._onDidDispose.fire();
    });
  }

  reveal(viewColumn?: vscode.ViewColumn, preserveFocus?: boolean): void {
    this._reveal(viewColumn, preserveFocus);
    this.visible = true;
  }

  dispose(): void {
    this._dispose();
  }

  // Test helpers
  simulateDispose(): void {
    this._onDidDispose.fire();
  }

  simulateViewStateChange(active: boolean, visible: boolean): void {
    this.active = active;
    this.visible = visible;
    this._onDidChangeViewState.fire({ webviewPanel: this });
  }
}

export class MockWebview implements vscode.Webview {
  options: vscode.WebviewOptions;
  html: string;
  cspSource: string;

  private _onDidReceiveMessage = new vscode.EventEmitter<any>();
  readonly onDidReceiveMessage = this._onDidReceiveMessage.event;

  private _postMessage: Mock;
  private _asWebviewUri: Mock;
  private receivedMessages: any[] = [];

  constructor() {
    this.options = {};
    this.html = '';
    this.cspSource = 'https://test.vscode-cdn.net';

    this._postMessage = vi.fn().mockImplementation((message) => {
      this.receivedMessages.push(message);
      return Promise.resolve(true);
    });

    this._asWebviewUri = vi.fn().mockImplementation((uri: vscode.Uri) => {
      return vscode.Uri.parse(`vscode-webview://test/${uri.path}`);
    });
  }

  postMessage(message: any): Thenable<boolean> {
    return this._postMessage(message);
  }

  asWebviewUri(localResource: vscode.Uri): vscode.Uri {
    return this._asWebviewUri(localResource);
  }

  // Test helpers
  simulateMessage(message: any): void {
    this._onDidReceiveMessage.fire(message);
  }

  getReceivedMessages(): any[] {
    return [...this.receivedMessages];
  }

  getPostMessageMock(): Mock {
    return this._postMessage;
  }

  clearMessages(): void {
    this.receivedMessages = [];
  }
}
```

## Window API Stubs

```typescript
// test/helpers/window-stubs.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export interface WindowStubs {
  showInformationMessage: Mock;
  showWarningMessage: Mock;
  showErrorMessage: Mock;
  showQuickPick: Mock;
  showInputBox: Mock;
  showOpenDialog: Mock;
  showSaveDialog: Mock;
  createTerminal: Mock;
  createWebviewPanel: Mock;
  createOutputChannel: Mock;
  createStatusBarItem: Mock;
  withProgress: Mock;
  setStatusBarMessage: Mock;
}

export function stubWindowAPI(): WindowStubs {
  return {
    showInformationMessage: vi.spyOn(vscode.window, 'showInformationMessage') as unknown as Mock,
    showWarningMessage: vi.spyOn(vscode.window, 'showWarningMessage') as unknown as Mock,
    showErrorMessage: vi.spyOn(vscode.window, 'showErrorMessage') as unknown as Mock,
    showQuickPick: vi.spyOn(vscode.window, 'showQuickPick') as unknown as Mock,
    showInputBox: vi.spyOn(vscode.window, 'showInputBox') as unknown as Mock,
    showOpenDialog: vi.spyOn(vscode.window, 'showOpenDialog') as unknown as Mock,
    showSaveDialog: vi.spyOn(vscode.window, 'showSaveDialog') as unknown as Mock,
    createTerminal: vi.spyOn(vscode.window, 'createTerminal') as unknown as Mock,
    createWebviewPanel: vi.spyOn(vscode.window, 'createWebviewPanel') as unknown as Mock,
    createOutputChannel: vi.spyOn(vscode.window, 'createOutputChannel') as unknown as Mock,
    createStatusBarItem: vi.spyOn(vscode.window, 'createStatusBarItem') as unknown as Mock,
    withProgress: vi.spyOn(vscode.window, 'withProgress') as unknown as Mock,
    setStatusBarMessage: vi.spyOn(vscode.window, 'setStatusBarMessage') as unknown as Mock
  };
}

export function configureDefaultBehaviors(stubs: WindowStubs): void {
  // Default to user selecting "Yes" in confirmations
  stubs.showInformationMessage.mockResolvedValue('Yes');
  stubs.showWarningMessage.mockResolvedValue('Yes');
  stubs.showErrorMessage.mockResolvedValue(undefined);

  // Default quick pick to first item
  stubs.showQuickPick.mockImplementation(async (items) => {
    const resolvedItems = await items;
    return Array.isArray(resolvedItems) ? resolvedItems[0] : undefined;
  });

  // Default input box to empty string
  stubs.showInputBox.mockResolvedValue('');
}
```

## Workspace API Stubs

```typescript
// test/helpers/workspace-stubs.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export interface WorkspaceStubs {
  getConfiguration: Mock;
  openTextDocument: Mock;
  findFiles: Mock;
  createFileSystemWatcher: Mock;
  applyEdit: Mock;
  saveAll: Mock;
}

export function stubWorkspaceAPI(): WorkspaceStubs {
  return {
    getConfiguration: vi.spyOn(vscode.workspace, 'getConfiguration') as unknown as Mock,
    openTextDocument: vi.spyOn(vscode.workspace, 'openTextDocument') as unknown as Mock,
    findFiles: vi.spyOn(vscode.workspace, 'findFiles') as unknown as Mock,
    createFileSystemWatcher: vi.spyOn(vscode.workspace, 'createFileSystemWatcher') as unknown as Mock,
    applyEdit: vi.spyOn(vscode.workspace, 'applyEdit') as unknown as Mock,
    saveAll: vi.spyOn(vscode.workspace, 'saveAll') as unknown as Mock
  };
}

export class MockConfiguration implements vscode.WorkspaceConfiguration {
  private values: Map<string, any>;

  constructor(initialValues: Record<string, any> = {}) {
    this.values = new Map(Object.entries(initialValues));
  }

  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  get(section: string, defaultValue?: any) {
    return this.values.get(section) ?? defaultValue;
  }

  has(section: string): boolean {
    return this.values.has(section);
  }

  inspect<T>(section: string): {
    key: string;
    defaultValue?: T;
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
  } | undefined {
    return {
      key: section,
      defaultValue: this.values.get(section),
      globalValue: this.values.get(section)
    };
  }

  update(
    section: string,
    value: any,
    configurationTarget?: vscode.ConfigurationTarget | boolean,
    overrideInLanguage?: boolean
  ): Thenable<void> {
    this.values.set(section, value);
    return Promise.resolve();
  }

  // Test helper
  setValue(section: string, value: any): void {
    this.values.set(section, value);
  }
}
```

## Command API Stubs

```typescript
// test/helpers/command-stubs.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export class MockCommandRegistry {
  private commands = new Map<string, (...args: any[]) => any>();
  private registerCommandMock: Mock;
  private executeCommandMock: Mock;
  private getCommandsMock: Mock;

  constructor() {
    this.setupMocks();
  }

  private setupMocks(): void {
    this.registerCommandMock = vi.spyOn(vscode.commands, 'registerCommand')
      .mockImplementation((command: string, callback: (...args: any[]) => any) => {
        this.commands.set(command, callback);
        return {
          dispose: () => {
            this.commands.delete(command);
          }
        };
      }) as unknown as Mock;

    this.executeCommandMock = vi.spyOn(vscode.commands, 'executeCommand')
      .mockImplementation(async (command: string, ...args: any[]) => {
        const handler = this.commands.get(command);
        if (handler) {
          return handler(...args);
        }
        throw new Error(`Command not found: ${command}`);
      }) as unknown as Mock;

    this.getCommandsMock = vi.spyOn(vscode.commands, 'getCommands')
      .mockImplementation(async () => {
        return Array.from(this.commands.keys());
      }) as unknown as Mock;
  }

  // Test helpers
  hasCommand(command: string): boolean {
    return this.commands.has(command);
  }

  getRegisteredCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  getCommandHandler(command: string): ((...args: any[]) => any) | undefined {
    return this.commands.get(command);
  }
}
```

## File System Mock

```typescript
// test/helpers/mock-file-system.ts
import { vi, type Mock } from 'vitest';
import * as vscode from 'vscode';

export class MockFileSystem {
  private files = new Map<string, Uint8Array>();
  private directories = new Set<string>();

  createMockFs(): vscode.FileSystem {
    return {
      stat: vi.fn().mockImplementation((uri: vscode.Uri) => {
        const path = uri.fsPath;
        if (this.files.has(path)) {
          return Promise.resolve({
            type: vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: this.files.get(path)!.length
          });
        }
        if (this.directories.has(path)) {
          return Promise.resolve({
            type: vscode.FileType.Directory,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
          });
        }
        throw vscode.FileSystemError.FileNotFound(uri);
      }),

      readFile: vi.fn().mockImplementation((uri: vscode.Uri) => {
        const content = this.files.get(uri.fsPath);
        if (content) {
          return Promise.resolve(content);
        }
        throw vscode.FileSystemError.FileNotFound(uri);
      }),

      writeFile: vi.fn().mockImplementation((uri: vscode.Uri, content: Uint8Array) => {
        this.files.set(uri.fsPath, content);
        return Promise.resolve();
      }),

      delete: vi.fn().mockImplementation((uri: vscode.Uri) => {
        this.files.delete(uri.fsPath);
        this.directories.delete(uri.fsPath);
        return Promise.resolve();
      }),

      rename: vi.fn().mockImplementation((source: vscode.Uri, target: vscode.Uri) => {
        const content = this.files.get(source.fsPath);
        if (content) {
          this.files.set(target.fsPath, content);
          this.files.delete(source.fsPath);
        }
        return Promise.resolve();
      }),

      copy: vi.fn().mockImplementation((source: vscode.Uri, target: vscode.Uri) => {
        const content = this.files.get(source.fsPath);
        if (content) {
          this.files.set(target.fsPath, content);
        }
        return Promise.resolve();
      }),

      createDirectory: vi.fn().mockImplementation((uri: vscode.Uri) => {
        this.directories.add(uri.fsPath);
        return Promise.resolve();
      }),

      readDirectory: vi.fn().mockImplementation((uri: vscode.Uri) => {
        const entries: [string, vscode.FileType][] = [];
        const prefix = uri.fsPath + '/';

        for (const path of this.files.keys()) {
          if (path.startsWith(prefix)) {
            const name = path.slice(prefix.length).split('/')[0];
            entries.push([name, vscode.FileType.File]);
          }
        }

        for (const path of this.directories) {
          if (path.startsWith(prefix)) {
            const name = path.slice(prefix.length).split('/')[0];
            entries.push([name, vscode.FileType.Directory]);
          }
        }

        return Promise.resolve(entries);
      }),

      isWritableFileSystem: vi.fn().mockReturnValue(true)
    };
  }

  // Test helpers
  addFile(path: string, content: string): void {
    this.files.set(path, new TextEncoder().encode(content));
  }

  addDirectory(path: string): void {
    this.directories.add(path);
  }

  getFileContent(path: string): string | undefined {
    const content = this.files.get(path);
    return content ? new TextDecoder().decode(content) : undefined;
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}
```

## Usage Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { VSCodeMockFactory } from '../helpers/vscode-mock-factory';
import { stubWindowAPI, configureDefaultBehaviors } from '../helpers/window-stubs';
import { MockCommandRegistry } from '../helpers/command-stubs';

describe('My Extension Tests', () => {
  let mockFactory: VSCodeMockFactory;
  let windowStubs: WindowStubs;
  let commandRegistry: MockCommandRegistry;

  beforeEach(() => {
    mockFactory = new VSCodeMockFactory();
    windowStubs = stubWindowAPI();
    configureDefaultBehaviors(windowStubs);
    commandRegistry = new MockCommandRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create terminal with mock', async () => {
    // Arrange
    const mockTerminal = mockFactory.createTerminal({ name: 'Test' });
    windowStubs.createTerminal.mockReturnValue(mockTerminal);

    // Act
    const terminal = vscode.window.createTerminal('Test');
    terminal.sendText('echo hello');

    // Assert
    expect(mockTerminal.getSendTextMock()).toHaveBeenCalledWith('echo hello');
  });
});
```
