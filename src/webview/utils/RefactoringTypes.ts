/**
 * Refactoring Type Utilities
 *
 * Common type definitions to reduce `any` usage and improve type safety
 * across the refactored codebase.
 */

/**
 * Generic event listener type for improved type safety
 */
export type TypedEventListener<T extends Event = Event> = (event: T) => void;

/**
 * Generic function type with flexible parameters
 */
export type FlexibleFunction<TReturn = any> = (...args: any[]) => TReturn;

/**
 * Generic async function type
 */
export type AsyncFunction<TReturn = any> = (...args: any[]) => Promise<TReturn>;

/**
 * Generic object with string keys
 */
export type StringKeyedObject<T = any> = Record<string, T>;

/**
 * Style property type for DOM manipulation
 */
export type StyleProperty = Partial<CSSStyleDeclaration>;

/**
 * Generic factory function type
 */
export type FactoryFunction<T = any> = () => T | Promise<T>;

/**
 * Generic validation function type
 */
export type ValidationFunction<T = any> = (value: T) => boolean;

/**
 * Generic error handler type
 */
export type ErrorHandler = (error: Error, context?: string) => void;

/**
 * Generic operation result type
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generic configuration object type
 */
export type ConfigurationObject<T = any> = {
  [key: string]: T;
};

/**
 * Timer callback type
 */
export type TimerCallback = () => void;

/**
 * Disposable resource type
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Initializable resource type
 */
export interface Initializable<TConfig = any> {
  initialize(config?: TConfig): void | Promise<void>;
}

/**
 * Type-safe event emitter interface
 */
export interface TypedEventEmitter<TEvents extends Record<string, any[]>> {
  on<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void;
  off<K extends keyof TEvents>(event: K, listener: (...args: TEvents[K]) => void): void;
  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void;
}

/**
 * Utility type to make specific properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type to make specific properties required
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Constructor type for classes
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Mixin type helper
 */
export type Mixin<T extends Constructor> = T & Constructor<{}>;

/**
 * Extract function return type
 */
export type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : any;

/**
 * Extract function parameter types
 */
export type ParametersOf<T> = T extends (...args: infer P) => any ? P : never;
