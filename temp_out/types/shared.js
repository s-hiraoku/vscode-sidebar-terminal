"use strict";
/**
 * 共有型定義 - 全コンポーネントで使用する基本型
 * Extension Host と WebView 間で共有される型定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_KEYS = exports.CONFIG_SECTIONS = void 0;
exports.isBaseTerminalConfig = isBaseTerminalConfig;
exports.isExtensionTerminalConfig = isExtensionTerminalConfig;
// ===== 設定キー定数 =====
/**
 * 設定アクセス用のキー定数
 */
exports.CONFIG_SECTIONS = {
    SIDEBAR_TERMINAL: 'secondaryTerminal',
    EDITOR: 'editor',
    TERMINAL_INTEGRATED: 'terminal.integrated',
};
exports.CONFIG_KEYS = {
    // secondaryTerminal セクション
    THEME: 'theme',
    CURSOR_BLINK: 'cursorBlink',
    MAX_TERMINALS: 'maxTerminals',
    MIN_TERMINAL_COUNT: 'minTerminalCount',
    SHELL: 'shell',
    SHELL_ARGS: 'shellArgs',
    DEFAULT_DIRECTORY: 'defaultDirectory',
    CONFIRM_BEFORE_KILL: 'confirmBeforeKill',
    PROTECT_LAST_TERMINAL: 'protectLastTerminal',
    // editor セクション
    MULTI_CURSOR_MODIFIER: 'multiCursorModifier',
    // terminal.integrated セクション
    ALT_CLICK_MOVES_CURSOR: 'altClickMovesCursor',
    SHELL_WINDOWS: 'shell.windows',
    SHELL_OSX: 'shell.osx',
    SHELL_LINUX: 'shell.linux',
};
// ===== 型ガード関数 =====
/**
 * BaseTerminalConfig の型ガード
 */
function isBaseTerminalConfig(obj) {
    return typeof obj === 'object' && obj !== null;
}
/**
 * ExtensionTerminalConfig の型ガード
 */
function isExtensionTerminalConfig(obj) {
    return (isBaseTerminalConfig(obj) &&
        typeof obj.shell === 'string' &&
        Array.isArray(obj.shellArgs) &&
        typeof obj.maxTerminals === 'number');
}
