/**
 * 共通の型定義とインターフェース
 *
 * NOTE: このファイルは後方互換性のために維持されています。
 * 新しい型は shared.ts に統合され、ここから再エクスポートされます。
 */

// ===== 統合された型システムからの再エクスポート =====

// shared.ts から全ての型をインポートして再エクスポート
export {
  // 基本設定型
  BaseTerminalConfig,
  DisplayConfig,
  ShellConfig,
  TerminalLimitsConfig,
  InteractionConfig,
  ExtensionTerminalConfig,
  WebViewTerminalConfig,
  PartialTerminalSettings,
  WebViewFontSettings,
  WebViewTerminalSettings,
  CompleteTerminalSettings,
  WebViewDisplayConfig,
  CompleteExtensionConfig,

  // ターミナル管理型
  TerminalInfo,
  TerminalState,
  DeleteResult,
  TerminalInstance,
  TerminalDimensions,
  TerminalEvent,
  AltClickState,
  TerminalInteractionEvent,

  // メッセージ通信型
  WebviewMessage,
  VsCodeMessage,

  // 型エイリアス
  TerminalTheme,
  SplitDirection,
  CliAgentStatusType,
  TerminalConfig,
  TerminalSettings,
  ExtensionConfig,

  // 設定キー定数
  CONFIG_SECTIONS,
  CONFIG_KEYS,

  // 型ガード関数
  isBaseTerminalConfig,
  isExtensionTerminalConfig,
} from './shared';

// IPty interface is now defined in node-pty.d.ts for @homebridge/node-pty-prebuilt-multiarch
// Import IPty from the node-pty module when needed
