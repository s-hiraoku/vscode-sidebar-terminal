"use strict";
/**
 * Logging utility for VS Code extension
 * Provides environment-aware logging with configurable levels
 */
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performance = exports.extension = exports.provider = exports.webview = exports.terminal = exports.error = exports.warn = exports.info = exports.debug = exports.logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["NONE"] = 4] = "NONE";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var Logger = /** @class */ (function () {
    function Logger() {
        // Check environment and set appropriate log level
        var isWebViewEnvironment = typeof window !== 'undefined' && typeof process === 'undefined';
        if (isWebViewEnvironment) {
            // WebView environment - use conservative logging in production
            this.isDevelopment = this.detectWebViewDevMode();
            this.level = this.isDevelopment ? LogLevel.INFO : LogLevel.WARN;
        }
        else {
            // Extension environment
            this.isDevelopment =
                process.env.NODE_ENV === 'development' || process.env.VSCODE_DEBUG_MODE === 'true';
            this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
        }
    }
    Logger.prototype.detectWebViewDevMode = function () {
        var _a, _b, _c, _d;
        // Check for development indicators in WebView environment
        if (typeof window !== 'undefined') {
            // VS Code development host detection
            var isDevHost = ((_a = window.location) === null || _a === void 0 ? void 0 : _a.hostname) === 'localhost' ||
                ((_b = window.location) === null || _b === void 0 ? void 0 : _b.protocol) === 'vscode-webview:';
            // Check for debug flags in URL or global variables
            var hasDebugFlag = ((_d = (_c = window.location) === null || _c === void 0 ? void 0 : _c.search) === null || _d === void 0 ? void 0 : _d.includes('debug=true')) ||
                window.VSCODE_DEBUG === true;
            return isDevHost || hasDebugFlag;
        }
        return false;
    };
    Logger.prototype.setLevel = function (level) {
        this.level = level;
    };
    Logger.prototype.safeStringify = function (obj) {
        if (typeof obj === 'string')
            return obj;
        if (typeof obj === 'number' || typeof obj === 'boolean')
            return String(obj);
        if (obj === null || obj === undefined)
            return String(obj);
        try {
            return JSON.stringify(obj, null, 2);
        }
        catch (_a) {
            return '[Complex Object]';
        }
    };
    Logger.prototype.debug = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.level <= LogLevel.DEBUG) {
            var safeArgs = args.map(function (arg) { return (typeof arg === 'object' ? _this.safeStringify(arg) : arg); });
            console.log.apply(console, __spreadArray(['[DEBUG]'], safeArgs, false));
        }
    };
    Logger.prototype.info = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.level <= LogLevel.INFO) {
            var safeArgs = args.map(function (arg) { return (typeof arg === 'object' ? _this.safeStringify(arg) : arg); });
            console.log.apply(console, __spreadArray(['[INFO]'], safeArgs, false));
        }
    };
    Logger.prototype.warn = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.level <= LogLevel.WARN) {
            var safeArgs = args.map(function (arg) { return (typeof arg === 'object' ? _this.safeStringify(arg) : arg); });
            console.warn.apply(console, __spreadArray(['[WARN]'], safeArgs, false));
        }
    };
    Logger.prototype.error = function () {
        var _this = this;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.level <= LogLevel.ERROR) {
            var safeArgs = args.map(function (arg) { return (typeof arg === 'object' ? _this.safeStringify(arg) : arg); });
            console.error.apply(console, __spreadArray(['[ERROR]'], safeArgs, false));
        }
    };
    // Convenience methods for common use cases
    Logger.prototype.terminal = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.debug.apply(this, __spreadArray(['🔌 [TERMINAL]'], args, false));
    };
    Logger.prototype.webview = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.debug.apply(this, __spreadArray(['🌐 [WEBVIEW]'], args, false));
    };
    Logger.prototype.provider = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.debug.apply(this, __spreadArray(['📡 [PROVIDER]'], args, false));
    };
    Logger.prototype.extension = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.debug.apply(this, __spreadArray(['🔧 [EXTENSION]'], args, false));
    };
    Logger.prototype.performance = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        this.debug.apply(this, __spreadArray(['⚡ [PERF]'], args, false));
    };
    return Logger;
}());
// Export singleton instance
exports.logger = new Logger();
// Export convenience functions
var debug = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.debug.apply(exports.logger, args);
};
exports.debug = debug;
var info = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.info.apply(exports.logger, args);
};
exports.info = info;
var warn = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.warn.apply(exports.logger, args);
};
exports.warn = warn;
var error = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.error.apply(exports.logger, args);
};
exports.error = error;
var terminal = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.terminal.apply(exports.logger, args);
};
exports.terminal = terminal;
var webview = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.webview.apply(exports.logger, args);
};
exports.webview = webview;
var provider = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.provider.apply(exports.logger, args);
};
exports.provider = provider;
var extension = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.extension.apply(exports.logger, args);
};
exports.extension = extension;
var performance = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return exports.logger.performance.apply(exports.logger, args);
};
exports.performance = performance;
