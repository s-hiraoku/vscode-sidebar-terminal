/**
 * Main entry point for the Secondary Terminal VS Code extension.
 * This module exports the activation and deactivation functions required by VS Code.
 *
 * @module extension
 */

import * as vscode from 'vscode';
import { ExtensionLifecycle } from './core/ExtensionLifecycle';

/**
 * Singleton instance of the extension lifecycle manager.
 * @internal
 */
const lifecycle = new ExtensionLifecycle();

/**
 * Activates the Secondary Terminal extension.
 *
 * This function is called by VS Code when the extension is activated. It initializes
 * all core components including the terminal manager, session management, command handlers,
 * and service integrations.
 *
 * @param context - The extension context provided by VS Code, containing subscriptions
 *                  and other extension-specific resources.
 * @returns A promise that resolves when activation is complete. The promise resolves
 *          immediately to prevent VS Code's activation spinner from hanging.
 *
 * @remarks
 * The activation process includes:
 * - Initializing the terminal manager for terminal lifecycle management
 * - Setting up session persistence for terminal restoration
 * - Registering all command handlers and keyboard shortcuts
 * - Initializing shell integration for enhanced terminal features
 * - Setting up Phase 8 services (decorations and links)
 * - Configuring WebView providers for the sidebar terminal UI
 *
 * @example
 * ```typescript
 * // Called automatically by VS Code when extension is activated
 * export function activate(context: vscode.ExtensionContext): Promise<void> {
 *   return lifecycle.activate(context);
 * }
 * ```
 *
 * @throws Will not throw errors; instead logs errors and shows user notifications
 * @public
 */
export function activate(context: vscode.ExtensionContext): Promise<void> {
  return lifecycle.activate(context);
}

/**
 * Deactivates the Secondary Terminal extension.
 *
 * This function is called by VS Code when the extension is being deactivated or
 * when VS Code is shutting down. It performs cleanup operations including saving
 * terminal sessions and disposing of all resources.
 *
 * @returns A promise that resolves when deactivation is complete, ensuring all
 *          cleanup operations have finished.
 *
 * @remarks
 * The deactivation process includes:
 * - Saving current terminal sessions for restoration on next startup
 * - Disposing of the standard session manager and cleanup timers
 * - Disposing of keyboard shortcut service
 * - Disposing of Phase 8 services (decorations and links)
 * - Disposing of terminal manager and all terminal instances
 * - Disposing of sidebar provider and WebView resources
 * - Cleaning up command handlers
 * - Disposing of shell integration service
 *
 * @example
 * ```typescript
 * // Called automatically by VS Code when extension is deactivated
 * export async function deactivate(): Promise<void> {
 *   await lifecycle.deactivate();
 * }
 * ```
 *
 * @throws Will not throw errors; instead logs errors for debugging
 * @public
 */
export async function deactivate(): Promise<void> {
  await lifecycle.deactivate();
}
