/**
 * Singleton Base Class
 *
 * Provides a consistent singleton pattern implementation across the extension.
 * This base class ensures:
 * - Type-safe singleton instantiation
 * - Testability with resetInstance() for unit tests
 * - Prevention of accidental multiple instantiation
 *
 * Usage:
 * ```typescript
 * export class MyService extends Singleton<MyService> {
 *   private constructor() {
 *     super();
 *     // Initialize...
 *   }
 *
 *   public static getInstance(): MyService {
 *     return Singleton.getInstanceOf(MyService, () => new MyService());
 *   }
 * }
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const instances = new Map<new (...args: any[]) => any, any>();

/**
 * Abstract base class for implementing the Singleton pattern.
 * Provides consistent singleton behavior across the codebase.
 */
export abstract class Singleton<T> {
  protected constructor() {
    const ctor = this.constructor;
    if (instances.has(ctor as new () => T)) {
      throw new Error(`Singleton ${ctor.name} already instantiated. Use getInstance() instead.`);
    }
  }

  /**
   * Get or create an instance of the singleton class.
   * This is the recommended way to implement getInstance() in subclasses.
   *
   * @param ctor - The constructor of the singleton class
   * @param factory - A factory function to create a new instance
   * @returns The singleton instance
   */
  protected static getInstanceOf<S>(ctor: new () => S, factory: () => S): S {
    if (!instances.has(ctor)) {
      const instance = factory();
      instances.set(ctor, instance);
    }
    return instances.get(ctor) as S;
  }

  /**
   * Reset the singleton instance for testing purposes.
   * WARNING: Only use this in test environments.
   *
   * @param ctor - The constructor of the singleton class to reset
   */
  public static resetInstance<S>(ctor: new () => S): void {
    instances.delete(ctor);
  }

  /**
   * Check if an instance exists for the given constructor.
   *
   * @param ctor - The constructor to check
   * @returns true if an instance exists
   */
  public static hasInstance<S>(ctor: new () => S): boolean {
    return instances.has(ctor);
  }

  /**
   * Get all registered singleton classes (for debugging).
   *
   * @returns Array of constructor names
   */
  public static getRegisteredSingletons(): string[] {
    return Array.from(instances.keys()).map((ctor) => ctor.name);
  }

  /**
   * Reset all singleton instances (for testing).
   * WARNING: Only use this in test environments.
   */
  public static resetAllInstances(): void {
    instances.clear();
  }
}
