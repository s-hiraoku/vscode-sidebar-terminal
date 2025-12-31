/**
 * システム全体の定数定義
 *
 * @refactored ドメイン別ファイルに分割されました。
 * 各定数は src/constants/domains/ に移動しています。
 * このファイルは後方互換性のためにre-exportを提供します。
 *
 * 新しいコードでは直接ドメインファイルからインポートすることを推奨します：
 * @example
 * import { PERFORMANCE_CONSTANTS } from './constants/domains/PerformanceConstants';
 * import { TERMINAL_CONSTANTS } from './constants/domains/TerminalConstants';
 *
 * @see https://github.com/s-hiraoku/vscode-sidebar-terminal/issues/226
 */

// ドメイン別定数をre-export（後方互換性のため）
export * from './domains';
