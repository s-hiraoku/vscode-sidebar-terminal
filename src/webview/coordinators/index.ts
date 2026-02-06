/**
 * WebView Coordinators
 *
 * LightweightTerminalWebviewManagerから抽出されたコーディネーター群
 */

export { TerminalOperationsCoordinator, type ITerminalOperationsDependencies } from './TerminalOperationsCoordinator';
export { ResizeCoordinator, type IResizeDependencies } from './ResizeCoordinator';
export { CliAgentCoordinator, type ICliAgentCoordinatorDependencies } from './CliAgentCoordinator';
export { DebugCoordinator, type IDebugCoordinatorDependencies } from './DebugCoordinator';
