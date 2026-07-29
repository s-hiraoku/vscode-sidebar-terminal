/**
 * Commands that belong to the VS Code workbench, not the terminal webview.
 *
 * They are on the skip-shell list so the keystroke is kept away from the PTY,
 * but the webview cannot execute them — the workbench does, and only if the
 * event is left to propagate. Swallowing them makes the key do nothing at all.
 */
const WORKBENCH_OWNED_COMMANDS = new Set([
  'workbench.action.quickOpen',
  'workbench.action.showCommands',
  'workbench.action.togglePanel',
  'workbench.action.closePanel',
  'workbench.action.maximizePanel',
  'workbench.action.toggleSidebarVisibility',
  'workbench.action.toggleDevTools',
  'workbench.action.reloadWindow',
  'workbench.action.reloadWindowWithExtensionsDisabled',
  'workbench.action.zoomIn',
  'workbench.action.zoomOut',
  'workbench.action.zoomReset',
  'workbench.action.terminal.openNativeConsole',
]);

export function isWorkbenchOwnedCommand(command: string): boolean {
  return WORKBENCH_OWNED_COMMANDS.has(command);
}
