/**
 * Factory-Compatible Refactored Terminal WebView Manager
 *
 * Adapts the existing RefactoredTerminalWebviewManager to work with the unified factory pattern
 * while maintaining all existing functionality and interfaces.
 */

import { RefactoredTerminalWebviewManager } from './RefactoredTerminalWebviewManager';
import type {
  IBaseManager,
  ManagerInitializationConfig,
  ManagerCreationConfig,
} from '../../factories/interfaces/ManagerFactoryInterfaces';
import { webview as log } from '../../utils/logger';

/**
 * Factory-compatible wrapper for RefactoredTerminalWebviewManager
 */
export class FactoryCompatibleRefactoredTerminalWebviewManager
  extends RefactoredTerminalWebviewManager
  implements IBaseManager
{
  public readonly name: string;
  private _factoryInitialized = false;

  constructor(_config?: ManagerCreationConfig) {
    // Call parent constructor with no parameters (it doesn't use them)
    super();

    this.name = config?.managerName || 'RefactoredTerminalWebviewManager';
    log(`🏭 [FACTORY-COMPAT] ${this.name} created via factory`);
  }

  /**
   * IBaseManager interface implementation
   */
  public get isInitialized(): boolean {
    return this._factoryInitialized;
  }

  /**
   * Factory-compatible initialization
   */
  public initialize(config: ManagerInitializationConfig): Promise<void> | void {
    log(`🚀 [FACTORY-COMPAT] Initializing ${this.name} with factory config`);

    try {
      // The parent class is already initialized in constructor
      // We just need to mark as factory-initialized
      this._factoryInitialized = true;

      log(`✅ [FACTORY-COMPAT] ${this.name} factory initialization completed`);
    } catch (error) {
      log(`❌ [FACTORY-COMPAT] ${this.name} factory initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Enhanced dispose with factory compatibility
   */
  public override dispose(): void {
    log(`🧹 [FACTORY-COMPAT] Disposing ${this.name}`);

    try {
      // Call parent dispose
      super.dispose();

      // Reset factory state
      this._factoryInitialized = false;

      log(`✅ [FACTORY-COMPAT] ${this.name} disposed successfully`);
    } catch (error) {
      log(`❌ [FACTORY-COMPAT] ${this.name} disposal error:`, error);
      throw error;
    }
  }

  /**
   * Factory diagnostics
   */
  public getFactoryInfo(): {
    name: string;
    factoryInitialized: boolean;
    parentInitialized: boolean;
    managersCreated: number;
  } {
    return {
      name: this.name,
      factoryInitialized: this._factoryInitialized,
      parentInitialized: !!this.getActiveTerminalId(), // Proxy for parent initialization
      managersCreated: Object.keys(this.getManagers()).length,
    };
  }
}
