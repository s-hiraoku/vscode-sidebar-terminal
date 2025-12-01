/**
 * Simple Terminal WebView Module
 *
 * Entry point for the simplified terminal display flow.
 * Based on VS Code standard terminal patterns.
 *
 * Usage:
 * - Import this module in the WebView HTML
 * - The module self-initializes when DOM is ready
 *
 * Key Components:
 * - SimpleTerminalWebView: Main WebView manager
 * - XtermInstance: Single terminal wrapper
 * - Types: Message and configuration types
 */

export { SimpleTerminalWebView, webviewManager } from './SimpleTerminalWebView';
export { XtermInstance, XtermCreateResult, XtermCallbacks } from './XtermInstance';
export * from './types';
