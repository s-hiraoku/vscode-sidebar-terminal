"use strict";
/**
 * 統一された設定アクセスサービス
 *
 * VS Code設定へのアクセスを集約し、キャッシュ機能付きで
 * 一貫性のある設定管理を提供します。
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationService = void 0;
var vscode = require("vscode");
var logger_1 = require("../utils/logger");
/**
 * 統一された設定サービス
 */
var ConfigurationService = /** @class */ (function () {
    function ConfigurationService() {
        this.configCache = new Map();
        this.changeHandlers = new Set();
        this.disposables = [];
        this.setupConfigurationWatcher();
    }
    /**
     * シングルトンインスタンスを取得
     */
    ConfigurationService.getInstance = function () {
        if (!this.instance) {
            this.instance = new ConfigurationService();
        }
        return this.instance;
    };
    /**
     * リソースを解放
     */
    ConfigurationService.prototype.dispose = function () {
        this.disposables.forEach(function (d) { return d.dispose(); });
        this.disposables = [];
        this.configCache.clear();
        this.changeHandlers.clear();
    };
    // === VS Code設定セクション取得 ===
    /**
     * Secondary Terminal設定を取得
     */
    ConfigurationService.prototype.getSecondaryTerminalConfig = function () {
        return vscode.workspace.getConfiguration('secondaryTerminal');
    };
    /**
     * Terminal統合設定を取得
     */
    ConfigurationService.prototype.getTerminalIntegratedConfig = function () {
        return vscode.workspace.getConfiguration('terminal.integrated');
    };
    /**
     * エディター設定を取得
     */
    ConfigurationService.prototype.getEditorConfig = function () {
        return vscode.workspace.getConfiguration('editor');
    };
    /**
     * ワークベンチ設定を取得
     */
    ConfigurationService.prototype.getWorkbenchConfig = function () {
        return vscode.workspace.getConfiguration('workbench');
    };
    // === キャッシュ付き設定値取得 ===
    /**
     * キャッシュ付きで設定値を取得
     */
    ConfigurationService.prototype.getCachedValue = function (section, key, defaultValue) {
        var cacheKey = "".concat(section, ".").concat(key);
        if (this.configCache.has(cacheKey)) {
            return this.configCache.get(cacheKey);
        }
        var value = vscode.workspace.getConfiguration(section).get(key, defaultValue);
        this.configCache.set(cacheKey, value);
        return value;
    };
    /**
     * 設定値を強制的に再読み込み
     */
    ConfigurationService.prototype.refreshValue = function (section, key, defaultValue) {
        var cacheKey = "".concat(section, ".").concat(key);
        this.configCache.delete(cacheKey);
        return this.getCachedValue(section, key, defaultValue);
    };
    /**
     * 複数の設定値をバッチで取得
     */
    ConfigurationService.prototype.getBatchValues = function (configs) {
        var result = {};
        for (var _i = 0, configs_1 = configs; _i < configs_1.length; _i++) {
            var config = configs_1[_i];
            var fullKey = "".concat(config.section, ".").concat(config.key);
            result[fullKey] = this.getCachedValue(config.section, config.key, config.defaultValue);
        }
        return result;
    };
    // === 具体的な設定値取得メソッド ===
    /**
     * Terminal関連設定を取得
     */
    ConfigurationService.prototype.getTerminalSettings = function () {
        return {
            // Secondary Terminal設定
            maxTerminals: this.getCachedValue('secondaryTerminal', 'maxTerminals', 5),
            shell: this.getCachedValue('secondaryTerminal', 'shell', ''),
            shellArgs: this.getCachedValue('secondaryTerminal', 'shellArgs', []),
            cwd: this.getCachedValue('secondaryTerminal', 'cwd', ''),
            env: this.getCachedValue('secondaryTerminal', 'env', {}),
            // フォント設定
            fontFamily: this.getCachedValue('secondaryTerminal', 'fontFamily', 'Menlo, Monaco, \'Courier New\', monospace'),
            fontSize: this.getCachedValue('secondaryTerminal', 'fontSize', 12),
            lineHeight: this.getCachedValue('secondaryTerminal', 'lineHeight', 1.2),
            // 表示設定
            cursorBlink: this.getCachedValue('secondaryTerminal', 'cursorBlink', true),
            cursorStyle: this.getCachedValue('secondaryTerminal', 'cursorStyle', 'block'),
            theme: this.getCachedValue('secondaryTerminal', 'theme', 'dark'),
            // ヘッダー設定
            showHeader: this.getCachedValue('secondaryTerminal', 'showHeader', true),
            headerTitle: this.getCachedValue('secondaryTerminal', 'headerTitle', 'Terminal'),
            // パフォーマンス設定
            scrollback: this.getCachedValue('secondaryTerminal', 'scrollback', 1000),
            fastScrollModifier: this.getCachedValue('secondaryTerminal', 'fastScrollModifier', 'alt'),
            // CLI Agent設定
            enableCliAgentIntegration: this.getCachedValue('secondaryTerminal', 'enableCliAgentIntegration', true),
            enableGitHubCopilotIntegration: this.getCachedValue('secondaryTerminal', 'enableGitHubCopilotIntegration', true),
        };
    };
    /**
     * Alt+Click関連設定を取得
     */
    ConfigurationService.prototype.getAltClickSettings = function () {
        return {
            altClickMovesCursor: this.getCachedValue('terminal.integrated', 'altClickMovesCursor', true),
            multiCursorModifier: this.getCachedValue('editor', 'multiCursorModifier', 'alt'),
        };
    };
    /**
     * 永続化セッション設定を取得
     */
    ConfigurationService.prototype.getPersistentSessionSettings = function () {
        return {
            enablePersistentSessions: this.getCachedValue('terminal.integrated', 'enablePersistentSessions', true),
            persistentSessionScrollback: this.getCachedValue('terminal.integrated', 'persistentSessionScrollback', 100),
            persistentSessionReviveProcess: this.getCachedValue('terminal.integrated', 'persistentSessionReviveProcess', 'onExitAndWindowClose'),
        };
    };
    /**
     * テーマ関連設定を取得
     */
    ConfigurationService.prototype.getThemeSettings = function () {
        return {
            colorTheme: this.getCachedValue('workbench', 'colorTheme', 'Default Dark Modern'),
            iconTheme: this.getCachedValue('workbench', 'iconTheme', 'vs-seti'),
            preferredDarkColorTheme: this.getCachedValue('workbench', 'preferredDarkColorTheme', 'Default Dark Modern'),
            preferredLightColorTheme: this.getCachedValue('workbench', 'preferredLightColorTheme', 'Default Light Modern'),
        };
    };
    // === 設定値更新 ===
    /**
     * 設定値を更新
     */
    ConfigurationService.prototype.updateValue = function (section_1, key_1, value_1) {
        return __awaiter(this, arguments, void 0, function (section, key, value, target) {
            var cacheKey, error_1;
            if (target === void 0) { target = vscode.ConfigurationTarget.Workspace; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, vscode.workspace.getConfiguration(section).update(key, value, target)];
                    case 1:
                        _a.sent();
                        cacheKey = "".concat(section, ".").concat(key);
                        this.configCache.set(cacheKey, value);
                        (0, logger_1.extension)("\u2705 [CONFIG] Updated ".concat(section, ".").concat(key, " = ").concat(JSON.stringify(value)));
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        (0, logger_1.extension)("\u274C [CONFIG] Failed to update ".concat(section, ".").concat(key, ": ").concat(String(error_1)));
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 複数の設定値をバッチで更新
     */
    ConfigurationService.prototype.updateBatchValues = function (updates) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, _i, updates_1, update, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        _i = 0, updates_1 = updates;
                        _a.label = 1;
                    case 1:
                        if (!(_i < updates_1.length)) return [3 /*break*/, 6];
                        update = updates_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.updateValue(update.section, update.key, update.value, update.target || vscode.ConfigurationTarget.Workspace)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        errors.push("".concat(update.section, ".").concat(update.key, ": ").concat(String(error_2)));
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        if (errors.length > 0) {
                            throw new Error("Batch update failed for: ".concat(errors.join(', ')));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // === 設定変更監視 ===
    /**
     * 設定変更ハンドラーを追加
     */
    ConfigurationService.prototype.onConfigurationChanged = function (handler) {
        var _this = this;
        this.changeHandlers.add(handler);
        return {
            dispose: function () {
                _this.changeHandlers.delete(handler);
            }
        };
    };
    /**
     * 特定セクションの設定変更を監視
     */
    ConfigurationService.prototype.onSectionChanged = function (section, handler) {
        return this.onConfigurationChanged(function (changedSection, key, newValue, oldValue) {
            if (changedSection === section) {
                handler(key, newValue, oldValue);
            }
        });
    };
    // === プライベートメソッド ===
    /**
     * 設定変更ウォッチャーを設定
     */
    ConfigurationService.prototype.setupConfigurationWatcher = function () {
        var _this = this;
        var disposable = vscode.workspace.onDidChangeConfiguration(function (event) {
            // 関連セクションのキャッシュをクリア
            var sectionsToWatch = [
                'secondaryTerminal',
                'terminal.integrated',
                'editor',
                'workbench'
            ];
            for (var _i = 0, sectionsToWatch_1 = sectionsToWatch; _i < sectionsToWatch_1.length; _i++) {
                var section = sectionsToWatch_1[_i];
                if (event.affectsConfiguration(section)) {
                    _this.clearSectionCache(section);
                    // 変更ハンドラーに通知
                    _this.notifyConfigurationChange(section, event);
                }
            }
        });
        this.disposables.push(disposable);
    };
    /**
     * セクションのキャッシュをクリア
     */
    ConfigurationService.prototype.clearSectionCache = function (section) {
        var _this = this;
        var keysToDelete = [];
        this.configCache.forEach(function (value, key) {
            if (key.startsWith("".concat(section, "."))) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(function (key) { return _this.configCache.delete(key); });
        (0, logger_1.extension)("\uD83E\uDDF9 [CONFIG] Cleared cache for section: ".concat(section));
    };
    /**
     * 設定変更をハンドラーに通知
     */
    ConfigurationService.prototype.notifyConfigurationChange = function (section, event) {
        // 簡単な実装: セクション全体が変更されたと通知
        // より詳細な実装では、個別のキー変更を検出
        this.changeHandlers.forEach(function (handler) {
            handler(section, '*', null, null);
        });
    };
    return ConfigurationService;
}());
exports.ConfigurationService = ConfigurationService;
