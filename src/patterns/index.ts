/**
 * Design Patterns
 *
 * This module exports reusable design pattern implementations
 * for consistent code structure across the extension.
 */

export { Singleton } from './Singleton';
export {
  DisposableBase,
  DisposableCallback,
  toDisposable,
  type IDisposable,
} from './DisposableBase';
export {
  LazyInitializable,
  InitializationState,
  InitializationError,
  withLazyInitialization,
} from './LazyInitializable';
