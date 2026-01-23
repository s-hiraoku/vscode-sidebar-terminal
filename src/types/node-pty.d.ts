/**
 * Type definitions for node-pty
 *
 * The official node-pty package includes its own type definitions.
 * This file is kept for reference and backward compatibility.
 *
 * The types are exported from 'node-pty' module directly:
 * - IPty: Interface representing a pseudoterminal
 * - IPtyForkOptions: Options for Unix systems
 * - IWindowsPtyForkOptions: Options for Windows systems
 * - IDisposable: Object that can be disposed
 * - IEvent: Event listener interface
 *
 * Usage:
 *   import * as pty from 'node-pty';
 *   import type { IPty, IDisposable } from 'node-pty';
 */

// Re-export from node-pty for convenience
export type { IPty, IDisposable, IEvent, IPtyForkOptions, IWindowsPtyForkOptions } from 'node-pty';
