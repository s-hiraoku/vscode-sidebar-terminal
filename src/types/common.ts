/**
 * Common type definitions and interfaces
 *
 * NOTE: This file is maintained for backward compatibility.
 * New types are consolidated in shared.ts and re-exported from here.
 */

// ===== Re-exports from unified type system =====

// Re-export only types that are actively used from shared.ts
export {
  // Terminal management types (in use)
  TerminalInfo,
  TerminalInstance,
  AltClickState,
  TerminalInteractionEvent,
  PartialTerminalSettings,

  // Message communication types (in use)
  WebviewMessage,
  VsCodeMessage,
} from './shared';

// IPty interface is now defined in node-pty.d.ts for node-pty
// Import IPty from the node-pty module when needed
