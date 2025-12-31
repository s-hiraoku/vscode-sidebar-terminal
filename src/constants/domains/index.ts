/**
 * ドメイン別定数のエクスポート
 *
 * SystemConstantsを分割した各ドメイン別定数ファイルを統合してエクスポートします。
 * 既存のSystemConstants.tsとの後方互換性を維持しつつ、
 * より細かい粒度でのインポートを可能にします。
 */

// 定数
export { PERFORMANCE_CONSTANTS } from './PerformanceConstants';
export type { PerformanceConstantsType } from './PerformanceConstants';

export { TERMINAL_CONSTANTS } from './TerminalConstants';
export type { TerminalConstantsType } from './TerminalConstants';

export { UI_CONSTANTS } from './UIConstants';
export type { UIConstantsType } from './UIConstants';

export { COMMUNICATION_CONSTANTS } from './CommunicationConstants';
export type { CommunicationConstantsType } from './CommunicationConstants';

export { ERROR_CONSTANTS } from './ErrorConstants';
export type { ErrorConstantsType } from './ErrorConstants';

export { TIMING_CONSTANTS } from './TimingConstants';
export type { TimingConstantsType } from './TimingConstants';

export { CONFIG_CACHE_CONSTANTS } from './ConfigCacheConstants';
export type { ConfigCacheConstantsType } from './ConfigCacheConstants';

// 列挙型
export {
  SystemStatus,
  TerminalAction,
  MessageSeverity,
  NotificationType,
  CliAgentStatus,
  TerminalState,
  SessionOperation,
  PerformanceMetric,
  ResourceType,
  ConfigurationCategory,
} from './Enums';
