import { BaseTest } from './BaseTest';
import * as sinon from 'sinon';

/**
 * Specialized base class for configuration-related tests
 *
 * Features:
 * - Common configuration defaults
 * - Configuration change simulation
 * - Configuration target helpers
 * - Singleton reset helpers
 *
 * Usage:
 * ```typescript
 * class MyConfigTest extends ConfigurationTest {
 *   protected getDefaultConfig() {
 *     return {
 *       'myFeature.enabled': true,
 *       'myFeature.value': 42
 *     };
 *   }
 * }
 * ```
 */
export abstract class ConfigurationTest extends BaseTest {
  protected configChangeHandlers: Array<(e: unknown) => void> = [];
  protected configChangeEmitter!: sinon.SinonStub;

  protected override setup(): void {
    super.setup();

    // Setup configuration defaults
    const defaults = this.getDefaultConfig();
    if (defaults) {
      this.configureDefaults(defaults);
    }

    // Setup configuration change emitter
    this.configChangeEmitter = this.vscode.workspace.onDidChangeConfiguration as sinon.SinonStub;
    this.configChangeEmitter.callsFake((handler: (e: unknown) => void) => {
      this.configChangeHandlers.push(handler);
      return { dispose: this.sandbox.stub() };
    });
  }

  protected override teardown(): void {
    this.configChangeHandlers = [];
    super.teardown();
  }

  /**
   * Override to provide default configuration values
   */
  protected getDefaultConfig(): Record<string, unknown> | null {
    return null;
  }

  /**
   * Simulate a configuration change event
   */
  protected triggerConfigChange(affectsConfiguration: (section: string) => boolean): void {
    const event = {
      affectsConfiguration,
    };

    this.configChangeHandlers.forEach((handler) => {
      handler(event);
    });
  }

  /**
   * Simulate a configuration change for specific sections
   */
  protected triggerSectionChange(...sections: string[]): void {
    this.triggerConfigChange((section: string) => {
      return sections.some((s) => section.startsWith(s));
    });
  }

  /**
   * Update a configuration value and optionally trigger change event
   */
  protected async updateConfig(
    key: string,
    value: unknown,
    triggerChange: boolean = true
  ): Promise<void> {
    this.vscode.configuration.get.withArgs(key).returns(value);
    this.vscode.configuration.get.withArgs(key, sinon.match.any).returns(value);

    if (triggerChange) {
      const section = key.split('.')[0];
      if (section) {
        this.triggerSectionChange(section);
      }
    }
  }

  /**
   * Update multiple configuration values
   */
  protected async updateConfigs(
    configs: Record<string, unknown>,
    triggerChange: boolean = true
  ): Promise<void> {
    Object.entries(configs).forEach(([key, value]) => {
      this.vscode.configuration.get.withArgs(key).returns(value);
      this.vscode.configuration.get.withArgs(key, sinon.match.any).returns(value);
    });

    if (triggerChange) {
      const sections = Array.from(
        new Set(
          Object.keys(configs)
            .map((key) => key.split('.')[0])
            .filter((s): s is string => s !== undefined)
        )
      );
      this.triggerSectionChange(...sections);
    }
  }

  /**
   * Get configuration target constants
   */
  protected get ConfigurationTarget() {
    return this.vscode.ConfigurationTarget;
  }

  /**
   * Assert configuration was updated with specific target
   */
  protected assertConfigUpdated(key: string, value: unknown, target?: number): void {
    const updateStub = this.vscode.configuration.update as sinon.SinonStub;

    if (target !== undefined) {
      if (!updateStub.calledWith(key, value, target)) {
        throw new Error(
          `Expected configuration "${key}" to be updated to ${JSON.stringify(value)} ` +
            `with target ${target}, but it wasn't`
        );
      }
    } else {
      if (!updateStub.calledWith(key, value)) {
        throw new Error(
          `Expected configuration "${key}" to be updated to ${JSON.stringify(value)}, ` +
            `but it wasn't`
        );
      }
    }
  }

  /**
   * Reset singleton instance (useful for configuration services)
   */
  protected resetSingleton<T extends { instance?: unknown }>(serviceClass: T): void {
    (serviceClass as { instance?: unknown }).instance = undefined;
  }

  /**
   * Mock configuration.inspect() response
   */
  protected mockInspect(
    key: string,
    globalValue?: unknown,
    workspaceValue?: unknown,
    workspaceFolderValue?: unknown,
    defaultValue?: unknown
  ): void {
    this.vscode.configuration.inspect.withArgs(key).returns({
      key,
      defaultValue,
      globalValue,
      workspaceValue,
      workspaceFolderValue,
    });
  }

  /**
   * Assert that a configuration change handler was registered
   */
  protected assertConfigChangeHandlerRegistered(): void {
    if (!this.configChangeEmitter.called) {
      throw new Error('Expected configuration change handler to be registered');
    }
  }

  /**
   * Get number of registered configuration change handlers
   */
  protected getConfigChangeHandlerCount(): number {
    return this.configChangeHandlers.length;
  }

  /**
   * Clear all registered configuration change handlers
   */
  protected clearConfigChangeHandlers(): void {
    this.configChangeHandlers = [];
  }
}
