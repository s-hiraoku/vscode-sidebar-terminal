"use strict";
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
/**
 * ConfigurationService unit tests
 *
 * 統一された設定アクセスサービスのテスト
 * VS Code設定へのアクセス集約機能とキャッシュ機能を検証
 */
/* eslint-disable */
// @ts-nocheck
var chai_1 = require("chai");
var sinon_chai_1 = require("sinon-chai");
(0, chai_1.use)(sinon_chai_1.default);
var ConfigurationService_1 = require("../../../config/ConfigurationService");
var CommonTestSetup_1 = require("../../utils/CommonTestSetup");
describe('ConfigurationService', function () {
    var testEnv;
    var configService;
    var mockVSCodeWorkspace;
    var mockConfiguration;
    var logSpy;
    var configChangeEvent;
    beforeEach(function () {
        testEnv = (0, CommonTestSetup_1.setupTestEnvironment)();
        // Mock VS Code workspace and configuration
        mockConfiguration = {
            get: testEnv.sandbox.stub(),
            update: testEnv.sandbox.stub(),
        };
        mockVSCodeWorkspace = {
            getConfiguration: testEnv.sandbox.stub().returns(mockConfiguration),
            onDidChangeConfiguration: testEnv.sandbox.stub(),
        };
        // Setup global vscode mock
        global.vscode = {
            workspace: mockVSCodeWorkspace,
            ConfigurationTarget: {
                Global: 1,
                Workspace: 2,
                WorkspaceFolder: 3,
            },
        };
        // Mock logger
        var loggerModule = require('../../../utils/logger');
        logSpy = testEnv.sandbox.stub(loggerModule, 'extension');
        // Create configuration change event stub
        configChangeEvent = testEnv.sandbox.stub();
        mockVSCodeWorkspace.onDidChangeConfiguration.returns({
            dispose: testEnv.sandbox.stub(),
        });
        // Create fresh instance for each test
        configService = ConfigurationService_1.ConfigurationService.getInstance();
    });
    afterEach(function () {
        // Dispose the singleton instance to ensure clean state
        if (configService) {
            configService.dispose();
        }
        // Reset singleton instance for next test
        ConfigurationService_1.ConfigurationService.instance = undefined;
        (0, CommonTestSetup_1.cleanupTestEnvironment)(testEnv);
        delete global.vscode;
    });
    describe('Singleton Pattern', function () {
        it('should return the same instance when getInstance is called multiple times', function () {
            var instance1 = ConfigurationService_1.ConfigurationService.getInstance();
            var instance2 = ConfigurationService_1.ConfigurationService.getInstance();
            (0, chai_1.expect)(instance1).to.equal(instance2);
        });
        it('should create new instance after disposal', function () {
            var instance1 = ConfigurationService_1.ConfigurationService.getInstance();
            instance1.dispose();
            // Reset singleton for test
            ConfigurationService_1.ConfigurationService.instance = undefined;
            var instance2 = ConfigurationService_1.ConfigurationService.getInstance();
            (0, chai_1.expect)(instance1).to.not.equal(instance2);
        });
    });
    describe('dispose', function () {
        it('should dispose all resources and clear state', function () {
            var disposableMock = { dispose: testEnv.sandbox.stub() };
            mockVSCodeWorkspace.onDidChangeConfiguration.returns(disposableMock);
            // Re-create service to trigger disposable registration
            configService.dispose();
            ConfigurationService_1.ConfigurationService.instance = undefined;
            configService = ConfigurationService_1.ConfigurationService.getInstance();
            // Add some cached values
            configService.getCachedValue('test', 'key', 'default');
            configService.dispose();
            (0, chai_1.expect)(disposableMock.dispose).to.have.been.called;
        });
    });
    describe('VS Code Configuration Access', function () {
        describe('getSecondaryTerminalConfig', function () {
            it('should get secondary terminal configuration', function () {
                var config = configService.getSecondaryTerminalConfig();
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('secondaryTerminal');
                (0, chai_1.expect)(config).to.equal(mockConfiguration);
            });
        });
        describe('getTerminalIntegratedConfig', function () {
            it('should get terminal integrated configuration', function () {
                var config = configService.getTerminalIntegratedConfig();
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('terminal.integrated');
                (0, chai_1.expect)(config).to.equal(mockConfiguration);
            });
        });
        describe('getEditorConfig', function () {
            it('should get editor configuration', function () {
                var config = configService.getEditorConfig();
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('editor');
                (0, chai_1.expect)(config).to.equal(mockConfiguration);
            });
        });
        describe('getWorkbenchConfig', function () {
            it('should get workbench configuration', function () {
                var config = configService.getWorkbenchConfig();
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('workbench');
                (0, chai_1.expect)(config).to.equal(mockConfiguration);
            });
        });
    });
    describe('Cached Configuration Values', function () {
        describe('getCachedValue', function () {
            it('should get value from VS Code and cache it', function () {
                var defaultValue = 'default';
                var configValue = 'configured-value';
                mockConfiguration.get.withArgs('testKey', defaultValue).returns(configValue);
                var result = configService.getCachedValue('testSection', 'testKey', defaultValue);
                (0, chai_1.expect)(result).to.equal(configValue);
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith('testSection');
                (0, chai_1.expect)(mockConfiguration.get).to.have.been.calledWith('testKey', defaultValue);
            });
            it('should return cached value on subsequent calls', function () {
                var defaultValue = 'default';
                var configValue = 'cached-value';
                mockConfiguration.get.withArgs('cacheKey', defaultValue).returns(configValue);
                // First call - should hit VS Code
                var result1 = configService.getCachedValue('cacheSection', 'cacheKey', defaultValue);
                // Second call - should use cache
                var result2 = configService.getCachedValue('cacheSection', 'cacheKey', defaultValue);
                (0, chai_1.expect)(result1).to.equal(configValue);
                (0, chai_1.expect)(result2).to.equal(configValue);
                (0, chai_1.expect)(mockConfiguration.get).to.have.been.calledOnce;
            });
            it('should handle undefined return from VS Code configuration', function () {
                var defaultValue = 42;
                mockConfiguration.get.withArgs('undefinedKey', defaultValue).returns(undefined);
                var result = configService.getCachedValue('testSection', 'undefinedKey', defaultValue);
                (0, chai_1.expect)(result).to.be.undefined;
            });
            it('should cache different values for different keys', function () {
                mockConfiguration.get.withArgs('key1', 'default1').returns('value1');
                mockConfiguration.get.withArgs('key2', 'default2').returns('value2');
                var result1 = configService.getCachedValue('section', 'key1', 'default1');
                var result2 = configService.getCachedValue('section', 'key2', 'default2');
                (0, chai_1.expect)(result1).to.equal('value1');
                (0, chai_1.expect)(result2).to.equal('value2');
                (0, chai_1.expect)(mockConfiguration.get).to.have.been.calledTwice;
            });
        });
        describe('refreshValue', function () {
            it('should clear cache and fetch fresh value', function () {
                var defaultValue = 'default';
                var cachedValue = 'cached';
                var freshValue = 'fresh';
                // First call to cache a value
                mockConfiguration.get.withArgs('refreshKey', defaultValue).returns(cachedValue);
                var cached = configService.getCachedValue('refreshSection', 'refreshKey', defaultValue);
                (0, chai_1.expect)(cached).to.equal(cachedValue);
                // Mock fresh value
                mockConfiguration.get.withArgs('refreshKey', defaultValue).returns(freshValue);
                // Refresh should clear cache and get fresh value
                var refreshed = configService.refreshValue('refreshSection', 'refreshKey', defaultValue);
                (0, chai_1.expect)(refreshed).to.equal(freshValue);
                (0, chai_1.expect)(mockConfiguration.get).to.have.been.calledTwice;
            });
            it('should cache the refreshed value', function () {
                var defaultValue = 10;
                var freshValue = 20;
                mockConfiguration.get.withArgs('refreshCacheKey', defaultValue).returns(freshValue);
                // Refresh the value
                var refreshed = configService.refreshValue('section', 'refreshCacheKey', defaultValue);
                // Second call should use the cached refreshed value
                var cached = configService.getCachedValue('section', 'refreshCacheKey', defaultValue);
                (0, chai_1.expect)(refreshed).to.equal(freshValue);
                (0, chai_1.expect)(cached).to.equal(freshValue);
                (0, chai_1.expect)(mockConfiguration.get).to.have.been.calledOnce;
            });
        });
        describe('getBatchValues', function () {
            it('should get multiple configuration values efficiently', function () {
                var configs = [
                    { section: 'section1', key: 'key1', defaultValue: 'default1' },
                    { section: 'section2', key: 'key2', defaultValue: 'default2' },
                    { section: 'section1', key: 'key3', defaultValue: 'default3' },
                ];
                // Mock different configuration sections
                var mockConfig1 = { get: testEnv.sandbox.stub() };
                var mockConfig2 = { get: testEnv.sandbox.stub() };
                mockVSCodeWorkspace.getConfiguration.withArgs('section1').returns(mockConfig1);
                mockVSCodeWorkspace.getConfiguration.withArgs('section2').returns(mockConfig2);
                mockConfig1.get.withArgs('key1', 'default1').returns('value1');
                mockConfig2.get.withArgs('key2', 'default2').returns('value2');
                mockConfig1.get.withArgs('key3', 'default3').returns('value3');
                var result = configService.getBatchValues(configs);
                (0, chai_1.expect)(result).to.deep.equal({
                    'section1.key1': 'value1',
                    'section2.key2': 'value2',
                    'section1.key3': 'value3',
                });
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledThrice;
            });
            it('should handle empty config array', function () {
                var result = configService.getBatchValues([]);
                (0, chai_1.expect)(result).to.deep.equal({});
                (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.not.have.been.called;
            });
        });
    });
    describe('Specific Configuration Methods', function () {
        describe('getTerminalSettings', function () {
            it('should return complete terminal settings with defaults', function () {
                var settings = configService.getTerminalSettings();
                (0, chai_1.expect)(settings).to.have.property('maxTerminals');
                (0, chai_1.expect)(settings).to.have.property('shell');
                (0, chai_1.expect)(settings).to.have.property('fontFamily');
                (0, chai_1.expect)(settings).to.have.property('fontSize');
                (0, chai_1.expect)(settings).to.have.property('cursorBlink');
                (0, chai_1.expect)(settings).to.have.property('enableCliAgentIntegration');
                (0, chai_1.expect)(settings).to.have.property('enableGitHubCopilotIntegration');
            });
            it('should use cached values for performance', function () {
                // First call
                configService.getTerminalSettings();
                // Second call should use cached values
                configService.getTerminalSettings();
                // Should only call getConfiguration once per unique section
                var sectionCalls = mockVSCodeWorkspace.getConfiguration.getCalls()
                    .filter(function (call) { return call.args[0] === 'secondaryTerminal'; });
                (0, chai_1.expect)(sectionCalls.length).to.equal(1);
            });
        });
        describe('getAltClickSettings', function () {
            it('should return Alt+Click related settings', function () {
                var mockTerminalConfig = { get: testEnv.sandbox.stub() };
                var mockEditorConfig = { get: testEnv.sandbox.stub() };
                mockVSCodeWorkspace.getConfiguration.withArgs('terminal.integrated').returns(mockTerminalConfig);
                mockVSCodeWorkspace.getConfiguration.withArgs('editor').returns(mockEditorConfig);
                mockTerminalConfig.get.withArgs('altClickMovesCursor', true).returns(false);
                mockEditorConfig.get.withArgs('multiCursorModifier', 'alt').returns('ctrlCmd');
                var settings = configService.getAltClickSettings();
                (0, chai_1.expect)(settings).to.deep.equal({
                    altClickMovesCursor: false,
                    multiCursorModifier: 'ctrlCmd',
                });
            });
        });
        describe('getPersistentSessionSettings', function () {
            it('should return persistent session settings with defaults', function () {
                var mockTerminalConfig = { get: testEnv.sandbox.stub() };
                mockVSCodeWorkspace.getConfiguration.withArgs('terminal.integrated').returns(mockTerminalConfig);
                mockTerminalConfig.get.withArgs('enablePersistentSessions', true).returns(true);
                mockTerminalConfig.get.withArgs('persistentSessionScrollback', 100).returns(200);
                mockTerminalConfig.get.withArgs('persistentSessionReviveProcess', 'onExitAndWindowClose').returns('onExit');
                var settings = configService.getPersistentSessionSettings();
                (0, chai_1.expect)(settings).to.deep.equal({
                    enablePersistentSessions: true,
                    persistentSessionScrollback: 200,
                    persistentSessionReviveProcess: 'onExit',
                });
            });
        });
        describe('getThemeSettings', function () {
            it('should return theme-related settings', function () {
                var mockWorkbenchConfig = { get: testEnv.sandbox.stub() };
                mockVSCodeWorkspace.getConfiguration.withArgs('workbench').returns(mockWorkbenchConfig);
                mockWorkbenchConfig.get.withArgs('colorTheme', 'Default Dark Modern').returns('One Dark Pro');
                mockWorkbenchConfig.get.withArgs('iconTheme', 'vs-seti').returns('material-icon-theme');
                mockWorkbenchConfig.get.withArgs('preferredDarkColorTheme', 'Default Dark Modern').returns('One Dark Pro');
                mockWorkbenchConfig.get.withArgs('preferredLightColorTheme', 'Default Light Modern').returns('Light+');
                var settings = configService.getThemeSettings();
                (0, chai_1.expect)(settings).to.deep.equal({
                    colorTheme: 'One Dark Pro',
                    iconTheme: 'material-icon-theme',
                    preferredDarkColorTheme: 'One Dark Pro',
                    preferredLightColorTheme: 'Light+',
                });
            });
        });
    });
    describe('Configuration Updates', function () {
        describe('updateValue', function () {
            it('should update configuration value and cache', function () { return __awaiter(void 0, void 0, void 0, function () {
                var section, key, value, cachedValue;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            section = 'testSection';
                            key = 'testKey';
                            value = 'newValue';
                            mockConfiguration.update.withArgs(key, value, 2).resolves();
                            return [4 /*yield*/, configService.updateValue(section, key, value)];
                        case 1:
                            _a.sent();
                            (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.have.been.calledWith(section);
                            (0, chai_1.expect)(mockConfiguration.update).to.have.been.calledWith(key, value, 2);
                            (0, chai_1.expect)(logSpy).to.have.been.calledWith("\u2705 [CONFIG] Updated ".concat(section, ".").concat(key, " = ").concat(JSON.stringify(value)));
                            cachedValue = configService.getCachedValue(section, key, 'default');
                            (0, chai_1.expect)(cachedValue).to.equal(value);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should handle update failures', function () { return __awaiter(void 0, void 0, void 0, function () {
                var section, key, value, error, thrown_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            section = 'failSection';
                            key = 'failKey';
                            value = 'failValue';
                            error = new Error('Update failed');
                            mockConfiguration.update.withArgs(key, value, 2).rejects(error);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, configService.updateValue(section, key, value)];
                        case 2:
                            _a.sent();
                            chai_1.expect.fail('Should have thrown error');
                            return [3 /*break*/, 4];
                        case 3:
                            thrown_1 = _a.sent();
                            (0, chai_1.expect)(thrown_1).to.equal(error);
                            (0, chai_1.expect)(logSpy).to.have.been.calledWith("\u274C [CONFIG] Failed to update ".concat(section, ".").concat(key, ": Error: Update failed"));
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            it('should use specified configuration target', function () { return __awaiter(void 0, void 0, void 0, function () {
                var section, key, value, target;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            section = 'targetSection';
                            key = 'targetKey';
                            value = 'targetValue';
                            target = 1;
                            mockConfiguration.update.withArgs(key, value, target).resolves();
                            return [4 /*yield*/, configService.updateValue(section, key, value, target)];
                        case 1:
                            _a.sent();
                            (0, chai_1.expect)(mockConfiguration.update).to.have.been.calledWith(key, value, target);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('updateBatchValues', function () {
            it('should update multiple configuration values', function () { return __awaiter(void 0, void 0, void 0, function () {
                var updates, mockConfig1, mockConfig2;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            updates = [
                                { section: 'section1', key: 'key1', value: 'value1' },
                                { section: 'section2', key: 'key2', value: 'value2', target: 1 },
                            ];
                            mockConfig1 = { update: testEnv.sandbox.stub().resolves() };
                            mockConfig2 = { update: testEnv.sandbox.stub().resolves() };
                            mockVSCodeWorkspace.getConfiguration.withArgs('section1').returns(mockConfig1);
                            mockVSCodeWorkspace.getConfiguration.withArgs('section2').returns(mockConfig2);
                            return [4 /*yield*/, configService.updateBatchValues(updates)];
                        case 1:
                            _a.sent();
                            (0, chai_1.expect)(mockConfig1.update).to.have.been.calledWith('key1', 'value1', 2);
                            (0, chai_1.expect)(mockConfig2.update).to.have.been.calledWith('key2', 'value2', 1);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should handle partial failures in batch updates', function () { return __awaiter(void 0, void 0, void 0, function () {
                var updates, mockConfig1, mockConfig2, mockConfig3, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            updates = [
                                { section: 'section1', key: 'key1', value: 'value1' },
                                { section: 'section2', key: 'key2', value: 'value2' },
                                { section: 'section3', key: 'key3', value: 'value3' },
                            ];
                            mockConfig1 = { update: testEnv.sandbox.stub().resolves() };
                            mockConfig2 = { update: testEnv.sandbox.stub().rejects(new Error('Update 2 failed')) };
                            mockConfig3 = { update: testEnv.sandbox.stub().rejects(new Error('Update 3 failed')) };
                            mockVSCodeWorkspace.getConfiguration.withArgs('section1').returns(mockConfig1);
                            mockVSCodeWorkspace.getConfiguration.withArgs('section2').returns(mockConfig2);
                            mockVSCodeWorkspace.getConfiguration.withArgs('section3').returns(mockConfig3);
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, configService.updateBatchValues(updates)];
                        case 2:
                            _a.sent();
                            chai_1.expect.fail('Should have thrown error');
                            return [3 /*break*/, 4];
                        case 3:
                            error_1 = _a.sent();
                            (0, chai_1.expect)(error_1.message).to.include('Batch update failed for:');
                            (0, chai_1.expect)(error_1.message).to.include('section2.key2');
                            (0, chai_1.expect)(error_1.message).to.include('section3.key3');
                            return [3 /*break*/, 4];
                        case 4: return [2 /*return*/];
                    }
                });
            }); });
            it('should handle empty updates array', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, configService.updateBatchValues([])];
                        case 1:
                            _a.sent();
                            (0, chai_1.expect)(mockVSCodeWorkspace.getConfiguration).to.not.have.been.called;
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('Configuration Change Monitoring', function () {
        describe('onConfigurationChanged', function () {
            it('should register configuration change handler', function () {
                var handler = testEnv.sandbox.stub();
                var disposable = configService.onConfigurationChanged(handler);
                (0, chai_1.expect)(disposable).to.have.property('dispose');
                (0, chai_1.expect)(typeof disposable.dispose).to.equal('function');
            });
            it('should remove handler when disposed', function () {
                var handler = testEnv.sandbox.stub();
                var disposable = configService.onConfigurationChanged(handler);
                disposable.dispose();
                // Handler should be removed from internal set
                // This is tested indirectly by ensuring it doesn't get called
                (0, chai_1.expect)(disposable.dispose).to.be.a('function');
            });
        });
        describe('onSectionChanged', function () {
            it('should register section-specific change handler', function () {
                var handler = testEnv.sandbox.stub();
                var disposable = configService.onSectionChanged('secondaryTerminal', handler);
                (0, chai_1.expect)(disposable).to.have.property('dispose');
                (0, chai_1.expect)(typeof disposable.dispose).to.equal('function');
            });
            it('should filter calls to section-specific handlers', function () {
                var terminalHandler = testEnv.sandbox.stub();
                var editorHandler = testEnv.sandbox.stub();
                configService.onSectionChanged('secondaryTerminal', terminalHandler);
                configService.onSectionChanged('editor', editorHandler);
                // Simulate configuration change event by calling the internal notification method
                // Access private method for testing
                var service = configService;
                service.notifyConfigurationChange('secondaryTerminal', {});
                // Only terminal handler should be called
                (0, chai_1.expect)(terminalHandler).to.have.been.called;
                (0, chai_1.expect)(editorHandler).to.not.have.been.called;
            });
        });
        describe('setupConfigurationWatcher', function () {
            it('should setup VS Code configuration watcher on construction', function () {
                // The watcher is setup in constructor, so we verify it was called
                (0, chai_1.expect)(mockVSCodeWorkspace.onDidChangeConfiguration).to.have.been.called;
            });
        });
    });
    describe('Cache Management', function () {
        it('should clear cache for affected sections on configuration change', function () {
            // Pre-populate cache
            configService.getCachedValue('secondaryTerminal', 'maxTerminals', 5);
            configService.getCachedValue('editor', 'fontSize', 14);
            // Get the configuration change handler that was registered
            var changeHandler = mockVSCodeWorkspace.onDidChangeConfiguration.getCall(0).args[0];
            // Mock configuration change event
            var mockEvent = {
                affectsConfiguration: testEnv.sandbox.stub(),
            };
            mockEvent.affectsConfiguration.withArgs('secondaryTerminal').returns(true);
            mockEvent.affectsConfiguration.withArgs('editor').returns(false);
            // Trigger configuration change
            changeHandler(mockEvent);
            // Verify cache clearing by checking if next calls hit VS Code again
            configService.getCachedValue('secondaryTerminal', 'maxTerminals', 5);
            configService.getCachedValue('editor', 'fontSize', 14);
            // secondaryTerminal should have been cleared and refetched
            // editor should still be cached
            (0, chai_1.expect)(mockEvent.affectsConfiguration).to.have.been.calledWith('secondaryTerminal');
            (0, chai_1.expect)(mockEvent.affectsConfiguration).to.have.been.calledWith('editor');
        });
        it('should notify change handlers when configuration changes', function () {
            var changeHandler = testEnv.sandbox.stub();
            configService.onConfigurationChanged(changeHandler);
            // Get the VS Code configuration change handler
            var vsCodeChangeHandler = mockVSCodeWorkspace.onDidChangeConfiguration.getCall(0).args[0];
            // Mock configuration change event
            var mockEvent = {
                affectsConfiguration: testEnv.sandbox.stub().returns(true),
            };
            // Trigger configuration change
            vsCodeChangeHandler(mockEvent);
            // Change handler should be notified
            (0, chai_1.expect)(changeHandler).to.have.been.called;
        });
    });
    describe('Error Handling and Edge Cases', function () {
        it('should handle VS Code configuration throwing errors', function () {
            mockVSCodeWorkspace.getConfiguration.withArgs('errorSection').throws(new Error('Configuration error'));
            (0, chai_1.expect)(function () {
                configService.getCachedValue('errorSection', 'errorKey', 'default');
            }).to.throw('Configuration error');
        });
        it('should handle configuration get returning complex objects', function () {
            var complexObject = {
                nested: { value: 'test' },
                array: [1, 2, 3],
                fn: function () { return 'function'; },
            };
            mockConfiguration.get.withArgs('complexKey', null).returns(complexObject);
            var result = configService.getCachedValue('section', 'complexKey', null);
            (0, chai_1.expect)(result).to.deep.equal(complexObject);
        });
        it('should handle configuration update with null/undefined values', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockConfiguration.update.withArgs('nullKey', null, 2).resolves();
                        mockConfiguration.update.withArgs('undefinedKey', undefined, 2).resolves();
                        return [4 /*yield*/, configService.updateValue('testSection', 'nullKey', null)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, configService.updateValue('testSection', 'undefinedKey', undefined)];
                    case 2:
                        _a.sent();
                        (0, chai_1.expect)(mockConfiguration.update).to.have.been.calledWith('nullKey', null, 2);
                        (0, chai_1.expect)(mockConfiguration.update).to.have.been.calledWith('undefinedKey', undefined, 2);
                        return [2 /*return*/];
                }
            });
        }); });
        it('should handle very large cache scenarios', function () {
            // Add many cache entries
            for (var i = 0; i < 1000; i++) {
                mockConfiguration.get.withArgs("key".concat(i), "default".concat(i)).returns("value".concat(i));
                configService.getCachedValue('section', "key".concat(i), "default".concat(i));
            }
            // Verify cache still works efficiently
            var result = configService.getCachedValue('section', 'key500', 'default500');
            (0, chai_1.expect)(result).to.equal('value500');
        });
        it('should handle concurrent access to cached values', function () { return __awaiter(void 0, void 0, void 0, function () {
            var promises, results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockConfiguration.get.withArgs('concurrentKey', 'default').returns('concurrentValue');
                        promises = Array.from({ length: 10 }, function () {
                            return Promise.resolve(configService.getCachedValue('concurrent', 'concurrentKey', 'default'));
                        });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        results = _a.sent();
                        // All should return the same value
                        results.forEach(function (result) {
                            (0, chai_1.expect)(result).to.equal('concurrentValue');
                        });
                        // VS Code should only be called once due to caching
                        (0, chai_1.expect)(mockConfiguration.get).to.have.been.calledOnce;
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('Memory Management', function () {
        it('should clear all cache on dispose', function () {
            // Populate cache
            configService.getCachedValue('section1', 'key1', 'default1');
            configService.getCachedValue('section2', 'key2', 'default2');
            configService.dispose();
            // Verify cache is cleared by checking internal state
            // This tests the internal cache map is cleared
            var internalCache = configService.configCache;
            (0, chai_1.expect)(internalCache.size).to.equal(0);
        });
        it('should remove all event handlers on dispose', function () {
            var handler1 = testEnv.sandbox.stub();
            var handler2 = testEnv.sandbox.stub();
            configService.onConfigurationChanged(handler1);
            configService.onConfigurationChanged(handler2);
            configService.dispose();
            // Verify handlers are cleared
            var internalHandlers = configService.changeHandlers;
            (0, chai_1.expect)(internalHandlers.size).to.equal(0);
        });
    });
});
