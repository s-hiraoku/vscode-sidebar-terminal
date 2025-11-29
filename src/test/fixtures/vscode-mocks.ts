/**
 * VS Code API Mock Factory
 *
 * Provides consistent and reusable mocks for VS Code API objects.
 * Designed to work with the global vscode mock from mocha-setup.ts
 */

import * as sinon from 'sinon';

export interface MockWorkspaceConfiguration {
  get: sinon.SinonStub;
  has: sinon.SinonStub;
  inspect: sinon.SinonStub;
  update: sinon.SinonStub;
}

export interface MockWorkspace {
  getConfiguration: sinon.SinonStub;
  onDidChangeConfiguration: sinon.SinonStub;
  workspaceFolders?: any;
  getWorkspaceFolder: sinon.SinonStub;
}

export interface VSCodeMocks {
  workspace: MockWorkspace;
  configuration: MockWorkspaceConfiguration;
  ConfigurationTarget: {
    Global: number;
    Workspace: number;
    WorkspaceFolder: number;
  };
}

/**
 * Factory for creating VS Code API mocks
 */
export class VSCodeMockFactory {
  /**
   * Creates a mock WorkspaceConfiguration object
   */
  static createWorkspaceConfiguration(sandbox: sinon.SinonSandbox): MockWorkspaceConfiguration {
    return {
      get: sandbox.stub(),
      has: sandbox.stub().returns(true),
      inspect: sandbox.stub(),
      update: sandbox.stub().resolves(),
    };
  }

  /**
   * Creates a mock Workspace object
   */
  static createWorkspace(
    sandbox: sinon.SinonSandbox,
    config?: MockWorkspaceConfiguration
  ): MockWorkspace {
    const configuration = config || this.createWorkspaceConfiguration(sandbox);

    return {
      getConfiguration: sandbox.stub().returns(configuration),
      onDidChangeConfiguration: sandbox.stub().returns({ dispose: sandbox.stub() }),
      workspaceFolders: undefined,
      getWorkspaceFolder: sandbox.stub().returns(undefined),
    };
  }

  /**
   * Sets up mocks on the global vscode object that was created by mocha-setup.ts
   * This method reuses the existing global mock instead of creating a new one.
   *
   * @param sandbox - Sinon sandbox for cleanup
   * @returns Object containing the workspace and configuration mocks
   */
  static setupGlobalMock(sandbox: sinon.SinonSandbox): VSCodeMocks {
    const globalVscode = (global as any).vscode;

    if (!globalVscode) {
      throw new Error('Global vscode mock not initialized. Ensure mocha-setup.ts runs first.');
    }

    // Create fresh configuration mock
    const configuration = this.createWorkspaceConfiguration(sandbox);

    // Reset existing stubs if they exist
    if (globalVscode.workspace.getConfiguration) {
      if (globalVscode.workspace.getConfiguration.resetBehavior) {
        globalVscode.workspace.getConfiguration.resetBehavior();
      }
      if (globalVscode.workspace.getConfiguration.returns) {
        globalVscode.workspace.getConfiguration.returns(configuration);
      }
    }

    return {
      workspace: globalVscode.workspace,
      configuration,
      ConfigurationTarget: globalVscode.ConfigurationTarget || {
        Global: 1,
        Workspace: 2,
        WorkspaceFolder: 3,
      },
    };
  }

  /**
   * Configures a configuration mock with default values
   *
   * @param config - The configuration mock to configure
   * @param defaults - Default values for configuration keys
   */
  static configureDefaults<T extends Record<string, any>>(
    config: MockWorkspaceConfiguration,
    defaults: T
  ): void {
    Object.entries(defaults).forEach(([key, value]) => {
      config.get.withArgs(key).returns(value);
      config.get.withArgs(key, sinon.match.any).returns(value);
    });
  }

  /**
   * Creates a disposable mock
   */
  static createDisposable(sandbox: sinon.SinonSandbox) {
    return {
      dispose: sandbox.stub(),
    };
  }

  /**
   * Creates a mock event emitter
   */
  static createEventEmitter(sandbox: sinon.SinonSandbox) {
    return {
      event: sandbox.stub(),
      fire: sandbox.stub(),
      dispose: sandbox.stub(),
    };
  }
}

/**
 * Helper function to get the global vscode mock
 * Throws an error if not initialized
 */
export function getGlobalVSCodeMock(): any {
  const globalVscode = (global as any).vscode;
  if (!globalVscode) {
    throw new Error('Global vscode mock not initialized');
  }
  return globalVscode;
}

/**
 * Helper to check if a stub needs to be created or reused
 */
export function ensureStub(
  sandbox: sinon.SinonSandbox,
  object: any,
  method: string
): sinon.SinonStub {
  // If already a stub, reset and return it
  if (object[method] && object[method].isSinonProxy) {
    object[method].reset();
    return object[method];
  }

  // Otherwise create a new stub
  return sandbox.stub(object, method);
}
