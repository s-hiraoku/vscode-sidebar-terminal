# VS Code API Mocking Strategies

## Complete Mock Factory

```typescript
// test/helpers/vscode-mock-factory.ts
import * as sinon from 'sinon';

export class VSCodeMockFactory {
  private sandbox: sinon.SinonSandbox;

  constructor(sandbox: sinon.SinonSandbox) {
    this.sandbox = sandbox;
  }

  createExtensionContext(): MockExtensionContext {
    return new MockExtensionContext(this.sandbox);
  }

  createTerminal(options?: Partial<vscode.Terminal>): MockTerminal {
    return new MockTerminal(this.sandbox, options);
  }

  createWebviewPanel(options?: Partial<vscode.WebviewPanel>): MockWebviewPanel {
    return new MockWebviewPanel(this.sandbox, options);
  }

  createOutputChannel(name: string): MockOutputChannel {
    return new MockOutputChannel(this.sandbox, name);
  }

  createStatusBarItem(): MockStatusBarItem {
    return new MockStatusBarItem(this.sandbox);
  }

  createTextDocument(content: string, uri?: vscode.Uri): MockTextDocument {
    return new MockTextDocument(this.sandbox, content, uri);
  }

  createTextEditor(document: MockTextDocument): MockTextEditor {
    return new MockTextEditor(this.sandbox, document);
  }
}
```

## Extension Context Mock

```typescript
// test/helpers/mock-extension-context.ts
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export class MockExtensionContext implements vscode.ExtensionContext {
  subscriptions: { dispose(): any }[] = [];
  workspaceState: MockMemento;
  globalState: MockMemento & { setKeysForSync: sinon.SinonStub };
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

  constructor(private sandbox: sinon.SinonSandbox) {
    this.workspaceState = new MockMemento(sandbox);
    this.globalState = Object.assign(
      new MockMemento(sandbox),
      { setKeysForSync: sandbox.stub() }
    );
    this.secrets = new MockSecretStorage(sandbox);
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
      activate: sandbox.stub().resolves()
    };
    this.environmentVariableCollection = {
      persistent: true,
      description: 'Test',
      replace: sandbox.stub(),
      append: sandbox.stub(),
      prepend: sandbox.stub(),
      get: sandbox.stub(),
      forEach: sandbox.stub(),
      delete: sandbox.stub(),
      clear: sandbox.stub(),
      getScoped: sandbox.stub()
    } as any;
    this.languageModelAccessInformation = {
      onDidChange: sandbox.stub(),
      canSendRequest: sandbox.stub().returns(true)
    } as any;
  }

  asAbsolutePath(relativePath: string): string {
    return `/mock/extension/${relativePath}`;
  }
}

class MockMemento implements vscode.Memento {
  private storage = new Map<string, any>();

  constructor(private sandbox: sinon.SinonSandbox) {}

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

  constructor(private sandbox: sinon.SinonSandbox) {}

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
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export class MockTerminal implements vscode.Terminal {
  name: string;
  processId: Thenable<number | undefined>;
  creationOptions: Readonly<vscode.TerminalOptions>;
  exitStatus: vscode.TerminalExitStatus | undefined;
  state: vscode.TerminalState;
  shellIntegration: vscode.TerminalShellIntegration | undefined;

  private _sendText: sinon.SinonStub;
  private _show: sinon.SinonStub;
  private _hide: sinon.SinonStub;
  private _dispose: sinon.SinonStub;

  private outputBuffer: string[] = [];
  private inputBuffer: string[] = [];

  constructor(
    private sandbox: sinon.SinonSandbox,
    options?: Partial<vscode.Terminal>
  ) {
    this.name = options?.name ?? 'Mock Terminal';
    this.processId = Promise.resolve(options?.processId ?? 12345);
    this.creationOptions = options?.creationOptions ?? {};
    this.exitStatus = options?.exitStatus;
    this.state = options?.state ?? { isInteractedWith: false };

    this._sendText = sandbox.stub().callsFake((text: string) => {
      this.inputBuffer.push(text);
    });
    this._show = sandbox.stub();
    this._hide = sandbox.stub();
    this._dispose = sandbox.stub();
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

  getSendTextStub(): sinon.SinonStub {
    return this._sendText;
  }

  getShowStub(): sinon.SinonStub {
    return this._show;
  }

  getHideStub(): sinon.SinonStub {
    return this._hide;
  }

  getDisposeStub(): sinon.SinonStub {
    return this._dispose;
  }
}
```

## WebView Panel Mock

```typescript
// test/helpers/mock-webview-panel.ts
import * as sinon from 'sinon';
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

  private _reveal: sinon.SinonStub;
  private _dispose: sinon.SinonStub;

  constructor(
    private sandbox: sinon.SinonSandbox,
    options?: Partial<vscode.WebviewPanel>
  ) {
    this.viewType = options?.viewType ?? 'testView';
    this.title = options?.title ?? 'Test Panel';
    this.webview = new MockWebview(sandbox);
    this.options = options?.options ?? {};
    this.viewColumn = options?.viewColumn ?? vscode.ViewColumn.One;
    this.active = options?.active ?? true;
    this.visible = options?.visible ?? true;

    this._reveal = sandbox.stub();
    this._dispose = sandbox.stub().callsFake(() => {
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

  private _postMessage: sinon.SinonStub;
  private _asWebviewUri: sinon.SinonStub;
  private receivedMessages: any[] = [];

  constructor(private sandbox: sinon.SinonSandbox) {
    this.options = {};
    this.html = '';
    this.cspSource = 'https://test.vscode-cdn.net';

    this._postMessage = sandbox.stub().callsFake((message) => {
      this.receivedMessages.push(message);
      return Promise.resolve(true);
    });

    this._asWebviewUri = sandbox.stub().callsFake((uri: vscode.Uri) => {
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

  getPostMessageStub(): sinon.SinonStub {
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
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export interface WindowStubs {
  showInformationMessage: sinon.SinonStub;
  showWarningMessage: sinon.SinonStub;
  showErrorMessage: sinon.SinonStub;
  showQuickPick: sinon.SinonStub;
  showInputBox: sinon.SinonStub;
  showOpenDialog: sinon.SinonStub;
  showSaveDialog: sinon.SinonStub;
  createTerminal: sinon.SinonStub;
  createWebviewPanel: sinon.SinonStub;
  createOutputChannel: sinon.SinonStub;
  createStatusBarItem: sinon.SinonStub;
  withProgress: sinon.SinonStub;
  setStatusBarMessage: sinon.SinonStub;
}

export function stubWindowAPI(sandbox: sinon.SinonSandbox): WindowStubs {
  return {
    showInformationMessage: sandbox.stub(vscode.window, 'showInformationMessage'),
    showWarningMessage: sandbox.stub(vscode.window, 'showWarningMessage'),
    showErrorMessage: sandbox.stub(vscode.window, 'showErrorMessage'),
    showQuickPick: sandbox.stub(vscode.window, 'showQuickPick'),
    showInputBox: sandbox.stub(vscode.window, 'showInputBox'),
    showOpenDialog: sandbox.stub(vscode.window, 'showOpenDialog'),
    showSaveDialog: sandbox.stub(vscode.window, 'showSaveDialog'),
    createTerminal: sandbox.stub(vscode.window, 'createTerminal'),
    createWebviewPanel: sandbox.stub(vscode.window, 'createWebviewPanel'),
    createOutputChannel: sandbox.stub(vscode.window, 'createOutputChannel'),
    createStatusBarItem: sandbox.stub(vscode.window, 'createStatusBarItem'),
    withProgress: sandbox.stub(vscode.window, 'withProgress'),
    setStatusBarMessage: sandbox.stub(vscode.window, 'setStatusBarMessage')
  };
}

export function configureDefaultBehaviors(stubs: WindowStubs): void {
  // Default to user selecting "Yes" in confirmations
  stubs.showInformationMessage.resolves('Yes');
  stubs.showWarningMessage.resolves('Yes');
  stubs.showErrorMessage.resolves(undefined);

  // Default quick pick to first item
  stubs.showQuickPick.callsFake(async (items) => {
    const resolvedItems = await items;
    return Array.isArray(resolvedItems) ? resolvedItems[0] : undefined;
  });

  // Default input box to empty string
  stubs.showInputBox.resolves('');
}
```

## Workspace API Stubs

```typescript
// test/helpers/workspace-stubs.ts
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export interface WorkspaceStubs {
  getConfiguration: sinon.SinonStub;
  openTextDocument: sinon.SinonStub;
  findFiles: sinon.SinonStub;
  createFileSystemWatcher: sinon.SinonStub;
  applyEdit: sinon.SinonStub;
  saveAll: sinon.SinonStub;
}

export function stubWorkspaceAPI(sandbox: sinon.SinonSandbox): WorkspaceStubs {
  return {
    getConfiguration: sandbox.stub(vscode.workspace, 'getConfiguration'),
    openTextDocument: sandbox.stub(vscode.workspace, 'openTextDocument'),
    findFiles: sandbox.stub(vscode.workspace, 'findFiles'),
    createFileSystemWatcher: sandbox.stub(vscode.workspace, 'createFileSystemWatcher'),
    applyEdit: sandbox.stub(vscode.workspace, 'applyEdit'),
    saveAll: sandbox.stub(vscode.workspace, 'saveAll')
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
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export class MockCommandRegistry {
  private commands = new Map<string, (...args: any[]) => any>();
  private sandbox: sinon.SinonSandbox;
  private registerCommandStub: sinon.SinonStub;
  private executeCommandStub: sinon.SinonStub;
  private getCommandsStub: sinon.SinonStub;

  constructor(sandbox: sinon.SinonSandbox) {
    this.sandbox = sandbox;
    this.setupStubs();
  }

  private setupStubs(): void {
    this.registerCommandStub = this.sandbox
      .stub(vscode.commands, 'registerCommand')
      .callsFake((command: string, callback: (...args: any[]) => any) => {
        this.commands.set(command, callback);
        return {
          dispose: () => {
            this.commands.delete(command);
          }
        };
      });

    this.executeCommandStub = this.sandbox
      .stub(vscode.commands, 'executeCommand')
      .callsFake(async (command: string, ...args: any[]) => {
        const handler = this.commands.get(command);
        if (handler) {
          return handler(...args);
        }
        throw new Error(`Command not found: ${command}`);
      });

    this.getCommandsStub = this.sandbox
      .stub(vscode.commands, 'getCommands')
      .callsFake(async () => {
        return Array.from(this.commands.keys());
      });
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
import * as sinon from 'sinon';
import * as vscode from 'vscode';

export class MockFileSystem {
  private files = new Map<string, Uint8Array>();
  private directories = new Set<string>();
  private sandbox: sinon.SinonSandbox;

  constructor(sandbox: sinon.SinonSandbox) {
    this.sandbox = sandbox;
  }

  createMockFs(): vscode.FileSystem {
    return {
      stat: this.sandbox.stub().callsFake((uri: vscode.Uri) => {
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

      readFile: this.sandbox.stub().callsFake((uri: vscode.Uri) => {
        const content = this.files.get(uri.fsPath);
        if (content) {
          return Promise.resolve(content);
        }
        throw vscode.FileSystemError.FileNotFound(uri);
      }),

      writeFile: this.sandbox.stub().callsFake((uri: vscode.Uri, content: Uint8Array) => {
        this.files.set(uri.fsPath, content);
        return Promise.resolve();
      }),

      delete: this.sandbox.stub().callsFake((uri: vscode.Uri) => {
        this.files.delete(uri.fsPath);
        this.directories.delete(uri.fsPath);
        return Promise.resolve();
      }),

      rename: this.sandbox.stub().callsFake((source: vscode.Uri, target: vscode.Uri) => {
        const content = this.files.get(source.fsPath);
        if (content) {
          this.files.set(target.fsPath, content);
          this.files.delete(source.fsPath);
        }
        return Promise.resolve();
      }),

      copy: this.sandbox.stub().callsFake((source: vscode.Uri, target: vscode.Uri) => {
        const content = this.files.get(source.fsPath);
        if (content) {
          this.files.set(target.fsPath, content);
        }
        return Promise.resolve();
      }),

      createDirectory: this.sandbox.stub().callsFake((uri: vscode.Uri) => {
        this.directories.add(uri.fsPath);
        return Promise.resolve();
      }),

      readDirectory: this.sandbox.stub().callsFake((uri: vscode.Uri) => {
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

      isWritableFileSystem: this.sandbox.stub().returns(true)
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
import { VSCodeMockFactory } from '../helpers/vscode-mock-factory';
import { stubWindowAPI, configureDefaultBehaviors } from '../helpers/window-stubs';
import { MockCommandRegistry } from '../helpers/command-stubs';

suite('My Extension Tests', () => {
  let sandbox: sinon.SinonSandbox;
  let mockFactory: VSCodeMockFactory;
  let windowStubs: WindowStubs;
  let commandRegistry: MockCommandRegistry;

  setup(() => {
    sandbox = sinon.createSandbox();
    mockFactory = new VSCodeMockFactory(sandbox);
    windowStubs = stubWindowAPI(sandbox);
    configureDefaultBehaviors(windowStubs);
    commandRegistry = new MockCommandRegistry(sandbox);
  });

  teardown(() => {
    sandbox.restore();
  });

  test('should create terminal with mock', async () => {
    // Arrange
    const mockTerminal = mockFactory.createTerminal({ name: 'Test' });
    windowStubs.createTerminal.returns(mockTerminal);

    // Act
    const terminal = vscode.window.createTerminal('Test');
    terminal.sendText('echo hello');

    // Assert
    expect(mockTerminal.getSendTextStub()).to.have.been.calledWith('echo hello');
  });
});
```
