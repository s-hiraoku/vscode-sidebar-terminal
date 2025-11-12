/**
 * CLI Agent Detection - Centralized Components
 *
 * This module provides centralized CLI Agent detection capabilities.
 * All CLI agent detection logic is consolidated here to eliminate duplication.
 *
 * Architecture:
 * - CliAgentPatternRegistry: Single source of truth for all pattern definitions
 * - CliAgentDetectionEngine: Unified detection logic for all CLI agents
 * - CliAgentStateStore: Centralized state management with observer pattern
 *
 * Usage:
 * ```typescript
 * import { CliAgentDetectionEngine, CliAgentStateStore } from './services/cliAgent';
 *
 * const engine = CliAgentDetectionEngine.getInstance();
 * const stateStore = CliAgentStateStore.getInstance();
 *
 * // Detect from input
 * const result = engine.detectFromInput('claude help');
 *
 * // Update state
 * if (result.isDetected && result.agentType) {
 *   stateStore.setConnectedAgent(terminalId, result.agentType);
 * }
 * ```
 */

export {
  CliAgentPatternRegistry,
  AgentType,
  AgentPatternDefinition,
  ShellPromptPatterns,
} from './CliAgentPatternRegistry';

export {
  CliAgentDetectionEngine,
  DetectionResult,
  TerminationDetectionResult,
} from './CliAgentDetectionEngine';

export {
  CliAgentStateStore,
  AgentState,
  DisconnectedAgentInfo,
  StateChangeEvent,
  StateObserver,
  StateSnapshot,
} from './CliAgentStateStore';
