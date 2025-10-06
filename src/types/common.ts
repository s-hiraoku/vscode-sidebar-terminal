/**
 * 共通の型定義とインターフェース
 *
 * NOTE: このファイルは後方互換性のために維持されています。
 * 新しい型は shared.ts に統合され、ここから再エクスポートされます。
 */

// ===== 統合された型システムからの再エクスポート =====

// shared.ts から使用されている型のみ再エクスポート
export {
  // ターミナル管理型（使用中）
  TerminalInfo,
  TerminalInstance,
  AltClickState,
  TerminalInteractionEvent,
  PartialTerminalSettings,

  // メッセージ通信型（使用中）
  WebviewMessage,
  VsCodeMessage,
} from './shared';

// IPty interface is now defined in node-pty.d.ts for @homebridge/node-pty-prebuilt-multiarch
// Import IPty from the node-pty module when needed
