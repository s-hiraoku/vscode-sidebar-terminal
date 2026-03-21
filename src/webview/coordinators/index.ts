/**
 * WebView Coordinators
 *
 * LightweightTerminalWebviewManagerから抽出されたコーディネーター群
 */

export { TerminalOperationsCoordinator, type ITerminalOperationsDependencies } from './TerminalOperationsCoordinator';
export { ResizeCoordinator, type IResizeDependencies } from './ResizeCoordinator';
export { CliAgentCoordinator, type ICliAgentCoordinatorDependencies } from './CliAgentCoordinator';
export { DebugCoordinator, type IDebugCoordinatorDependencies } from './DebugCoordinator';
export { SettingsCoordinator, type ISettingsCoordinatorDependencies } from './SettingsCoordinator';
export {
  TerminalStateCoordinator,
  type ITerminalStateCoordinatorDependencies,
  type SystemStatusSnapshot,
} from './TerminalStateCoordinator';
export {
  PanelLocationController,
  type IPanelLocationControllerDependencies,
} from './PanelLocationController';
