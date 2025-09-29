# Changelog

All notable changes to the "Secondary Terminal" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.105] - 2025-09-30

### Added
- **Version Information Display**: Added version information functionality
  - Created VersionUtils class to retrieve version from package.json
  - Added version display in Terminal Settings panel with "About" section
  - Added "Show Version" command to command palette
  - Version information automatically sent from Extension to WebView on initialization

### Changed
- **Panel Title Updated**: Changed activity bar title from "Secondary Terminal" to "SC" for cleaner UI

### Fixed
- Fixed TypeScript compilation errors in VersionUtils and IManagerCoordinator interface

## [0.1.104] - 2025-09-30

### Added
- **GitHub Copilot CLI Support**: Added detection for GitHub Copilot CLI
  - Detects "Welcome to GitHub Copilot CLI" startup message
  - Supports `copilot` and `gh copilot` command detection
  - Full integration with status indicators and state management
  - Compatible with connected/disconnected state transitions

### Changed
- **Simplified AI Agent Detection**: Streamlined detection patterns for better reliability
  - Claude Code now detected simply by "Welcome to Claude Code!" message
  - OpenAI Codex detected by "OpenAI Codex" message
  - GitHub Copilot CLI detected by "Welcome to GitHub Copilot CLI" message
  - Gemini CLI now supports ASCII art detection for unique startup graphics
  - Removed complex pattern matching for cleaner, more maintainable code
  - Standardized activity detection across all agents to reduce false positives
  - Improved detection accuracy and reduced false positives

### Fixed
- **Disconnected Agent Reconnection**: Fixed issue where disconnected AI agents couldn't be re-detected
  - Removed skip logic that prevented startup detection for disconnected agents
  - Disconnected agents can now properly transition back to connected state on restart
  - Improved state management for seamless agent reconnection

## [0.1.103] - 2025-09-29

### Fixed
- **Agent Status Button Reliability**: Simplified and improved AI Agent status toggle functionality
  - Removed complex status detection logic that caused intermittent connection failures
  - Agent Status button now consistently shows "Connected" status when pressed
  - Eliminated header elements cache inconsistency issues
  - Streamlined Extension ↔ WebView communication for agent status updates
  - Fixed race conditions between UI updates and status synchronization

## [0.1.102] - 2025-09-29

### Improved
- **Terminal Tab UI**: Made tabs more compact and visually lighter
  - Reduced tab height from 32px to 24px for a slimmer profile
  - Decreased padding and margins for more efficient space usage
  - Removed font weight (bold) for cleaner, lighter text appearance
  - Centered text both horizontally and vertically within tabs
  - Reduced icon and font sizes for better proportions
  - Overall more streamlined and space-efficient tab interface

## [0.1.101] - 2025-09-27

### Added
- **Always-Visible AI Agent Status**: Disabled auto-hide functionality for AI Agent status display
  - AI Agent status remains visible permanently once detected
  - Status no longer disappears when agent terminates
  - Consistent status visibility for Claude Code, Gemini CLI, and other AI tools
- **Simplified Terminal Tab Interface**: Removed close buttons and editing capabilities from terminal tabs
  - Terminal tabs no longer display close (×) buttons for cleaner interface
  - Disabled double-click tab name editing to prevent accidental modifications
  - Streamlined context menu with only essential actions (Duplicate, Move to New Window)

### Fixed
- **TypeScript Compilation**: Resolved remaining compilation errors for production stability
  - Fixed ConfigManager interface compatibility issues
  - Corrected event listener type safety in RefactoredTerminalWebviewManager
  - Added null-safety checks in TerminalTabManager
  - Eliminated unsafe method references and undefined property access
- **Security**: Fixed CodeQL High severity alert for incomplete URL substring sanitization
  - Replaced vulnerable `includes()` checks with regex patterns using word boundaries
  - Prevents URL injection attacks in CLI agent detection patterns
  - Addresses CWE-20 (Improper Input Validation) vulnerability

### Improved
- **Code Quality**: Enhanced type safety by removing `any` type usage where possible
  - Replaced `any` type with proper TypeScript type assertions
  - Added null-safe operations with optional chaining
  - Improved event handling with proper type casting
- **User Experience**: Based on user review feedback (2025-09-27) addressing UX polish issues
  - Cleaner terminal tab interface without cluttered close buttons
  - Consistent AI agent status visibility for better workflow continuity
  - Reduced accidental tab modifications through simplified interaction model

### Changed
- **AI Agent Detection**: Modified termination detection to preserve status visibility
  - Commented out `setAgentTerminated()` calls in CliAgentDetectionService
  - Changed default `autoHideStatus` configuration from `true` to `false`
  - AI agent status now persists across agent restart cycles
- **Terminal Tab Management**: Simplified tab interaction model
  - Removed close button functionality from tab components
  - Disabled rename functionality in tab context menus
  - Maintained essential navigation and management features

### Technical Details
- **Configuration Changes**: Updated default values in ConfigManager and UnifiedConfigurationService
- **State Management**: Preserved AI agent state persistence while disabling auto-termination
- **Component Updates**: Modified TerminalTabList component for simplified UI
- **Type Safety**: Enhanced null checking and optional chaining throughout codebase

## [0.1.100] - 2025-01-27

### Added
- **Emergency Rollback System**: Comprehensive automated rollback infrastructure for critical release issues
  - Emergency rollback with one-command execution
  - Automated backup and restoration of previous versions
  - VS Code Marketplace monitoring and automated response
  - Rollback verification and health checks
- **Release Automation**: Enhanced release management with quality gates and safety checks
  - Automated version management scripts
  - Pre-release quality validation
  - Multi-platform VSIX packaging support
  - Continuous marketplace monitoring

### Fixed
- **Test Suite Stability**: Major improvements to test reliability and CI/CD pipeline stability
  - ✅ **Async Operations Tests**: Fixed all 10 async operation tests that were previously failing
  - ✅ **Concurrent Terminal Creation**: Resolved timeout issues in concurrent resource management tests
  - ✅ **CLI Agent Detection**: Fixed debouncing and caching test reliability
  - ✅ **Circuit Breaker Pattern**: Corrected failure simulation for deterministic test results
  - ✅ **Session Restoration**: Enhanced interruption recovery test stability
  - ✅ **WebView Communication**: Improved timeout handling in communication tests
- **Performance Tests**: Enhanced DOM mocking for Node.js test environment compatibility
  - Added proper event listener mocking for DOM elements
  - Improved browser environment simulation for performance tests
  - Fixed `document is not defined` errors in test suite

### Improved
- **Test Determinism**: Replaced random-based test logic with deterministic patterns
  - Removed fake timer dependencies that caused infinite loops
  - Implemented predictable success/failure patterns for testing
  - Enhanced test reliability across different environments
- **Development Workflow**: Streamlined release process with automated quality checks
  - Pre-release validation with comprehensive test coverage
  - Automated lint and type checking integration
  - Enhanced CI/CD pipeline stability
- **Performance Optimization**: Continued improvements from previous releases
  - CPU usage optimization (87% reduction in buffer flush frequency)
  - Enhanced terminal prompt initialization
  - Improved resource management and cleanup

### Changed
- **Test Architecture**: Moved from timer-based to Promise-based async testing
  - Eliminated `clock.tick()` dependencies in favor of natural Promise resolution
  - Simplified test setup and teardown processes
  - Improved test execution speed and reliability
- **Release Process**: Enhanced version management and deployment automation
  - Automated backup creation before releases
  - Rollback planning and verification workflows
  - Quality gate enforcement for all releases

## [0.1.95] - 2025-01-26

### Added
- **Documentation Organization**: Organized 25+ documentation files into structured docs directory with categorized subdirectories
  - `/docs/architecture/` - Technical architecture and refactoring documentation
  - `/docs/development/` - Development process and improvement documentation
  - `/docs/guides/` - User guides and implementation documentation
  - `/docs/releases/` - Release notes and release process documentation
  - `/docs/testing/` - Testing documentation and guides
- **Enhanced Documentation Navigation**: Created comprehensive docs/README.md with directory structure and quick links
- **Codex CLI Support**: Added support for Codex CLI AI agent integration
- **Dependency Updates**: Updated @xterm/addon-web-links from v0.10.0 to v0.11.0 for improved link handling

### Improved
- **Project Structure**: Cleaned up root directory by moving documentation files to organized subdirectories
- **Developer Experience**: Improved project navigation with cleaner root directory and structured documentation
- **Documentation Maintenance**: Better organization for easier documentation updates and maintenance

### Changed
- **Documentation Structure**: Moved all supplementary .md files from root to `/docs/` with logical categorization
- **Root Directory**: Kept only essential files (README.md, CHANGELOG.md, package.json, etc.) in project root

## [0.1.94] - 2025-01-26

### Added
- **Comprehensive AI Agent Integration Guide**: Added detailed documentation for Claude Code, Gemini CLI, GitHub Copilot, and CodeRabbit CLI integration
  - Step-by-step getting started guide with concrete examples
  - Advanced multi-agent workflow documentation
  - Troubleshooting section for common AI agent issues
  - Pro tips for maximizing AI agent productivity
- **CLI Coding Agent Era Positioning**: Enhanced marketing positioning to emphasize value for modern AI-assisted development
- **Zenn Blog Article Integration**: Added references to comprehensive Japanese blog article for detailed usage examples

### Improved
- **Documentation Quality**: Completely revamped README.md with modern AI agent workflow focus
  - Added "Why Secondary Terminal?" section explaining value proposition
  - Enhanced file reference system documentation
  - Improved keyboard shortcuts explanation with AI agent context
- **Development Transparency**: Added clear development status notices to set appropriate user expectations
  - Active development notice with bug acknowledgment
  - Known limitations section for better user understanding
  - Enhanced support section with clearer issue reporting guidance
- **Marketplace Presence**: Updated package.json description and keywords for better discoverability
  - Added TypeScript, production-ready, CodeRabbit CLI, slash command, code review keywords
  - Enhanced description emphasizing AI agent integration capabilities

### Changed
- **License**: Updated copyright year to 2024-2025
- **Contributing References**: Fixed non-existent CONTRIBUTING.md references to point to GitHub Issues

## [0.1.93] - 2025-01-26

### Fixed
- **TypeScript Compilation**: Completed systematic resolution of all remaining TypeScript compilation errors
  - Fixed 102 remaining compilation errors from previous 541 total errors
  - Resolved method signature mismatches, type import errors, and undefined references
  - All test files now compile successfully without errors
- **Code Quality**: Eliminated all ESLint unused variable errors through comprehensive cleanup
  - Removed 17 unused variables, parameters, and imports across the codebase
  - Maintained code functionality while improving maintainability
  - Only remaining ESLint warnings are acceptable `@typescript-eslint/no-explicit-any` types (333 warnings)
- **Test Infrastructure**: Enhanced test stability and compilation reliability
  - Fixed orphaned `await` statements and method call mismatches
  - Updated test mocks to match current API signatures
  - Improved test execution consistency

### Improved
- **Build Process**: Achieved zero TypeScript compilation errors across entire codebase
  - Extension build: 562 KiB (stable)
  - WebView build: 1.05 MiB (stable)
  - All builds now complete without warnings or errors
- **Release Readiness**: Established comprehensive quality gates for production deployment
  - Complete TypeScript strict mode compliance
  - ESLint error-free codebase (warnings acceptable)
  - Stable test suite with high success rate

## [0.1.92] - 2025-01-24

### Added
- **CodeRabbit Integration**: Added custom slash command for Claude Code to run CodeRabbit CLI reviews
  - Smart mode selection: defaults to `--prompt-only` for AI agent integration
  - Support for `--plain` mode for detailed human-readable feedback
  - Flexible argument passing for custom CodeRabbit CLI flags
  - Located in `.claude/commands/coderabbit.md` for seamless Claude Code integration

### Fixed
- **Input Manager**: Resolved merge conflict and logger inconsistencies in keyboard shortcut handling
  - Fixed logger function calls from `.info()` and `.error()` methods to simple function calls
  - Removed merge conflict markers that were preventing compilation

## [0.1.91] - 2025-01-24

### Added
- **CodeRabbit Integration**: Added custom slash command for Claude Code to run CodeRabbit CLI reviews
  - Smart mode selection: defaults to `--prompt-only` for AI agent integration
  - Support for `--plain` mode for detailed human-readable feedback
  - Flexible argument passing for custom CodeRabbit CLI flags
  - Located in `.claude/commands/coderabbit.md` for seamless Claude Code integration

### Fixed
- **Input Manager**: Resolved merge conflict and logger inconsistencies in keyboard shortcut handling
  - Fixed logger function calls from `.info()` and `.error()` methods to simple function calls
  - Removed merge conflict markers that were preventing compilation

## [0.1.90] - 2025-01-15

### Added
- **VS Code Standard Terminal Compliance**: Enhanced terminal processing logic using VS Code's standard terminal implementation as reference
- **Process State Management**: Added VS Code-compliant ProcessState enum (Uninitialized, Launching, Running, KilledDuringLaunch, KilledByUser, KilledByProcess)
- **InteractionState Enum**: Added terminal interaction state tracking (None, ReplayOnly, Session)
- **Enhanced Error Handling**: Improved error recovery mechanisms throughout terminal lifecycle
- **State Change Notifications**: Added process state change events for monitoring and debugging

### Fixed
- **Compilation Errors**: Resolved critical TypeScript compilation issues in core services
- **CliAgentDetectionService**: Fixed cache entry type mismatches affecting detection accuracy
- **MessageRouter**: Resolved unused variable compilation warnings
- **TerminalManager**: Fixed function signature errors in shell platform detection
- **Type Safety**: Corrected interface compatibility issues across webview managers
- **Production Build**: All production code now compiles successfully without errors

### Changed
- **Terminal Event Handling**: Enhanced _setupTerminalEvents with VS Code-inspired state tracking
- **Cache Management**: Improved DetectionCacheEntry usage for better performance
- **Error Messages**: Enhanced error reporting with proper string conversion
- **Code Quality**: Reduced lint errors from 404 to 64, with remaining issues being non-critical warnings

### Technical Details
- **Architecture**: Implemented VS Code standard patterns for terminal process lifecycle
- **State Management**: Added comprehensive state tracking with proper event emission
- **Performance**: Optimized caching and detection mechanisms
- **Build System**: Production webpack build generates clean, optimized packages
- **Quality Assurance**: Maintained ESLint compliance with acceptable warning levels

### Development
- **Release Readiness**: Core functionality verified and production-ready
- **Documentation**: Updated code comments and type definitions
- **Testing**: Core services compile and function correctly
- **CI/CD**: Automated build pipeline produces deployable artifacts

## [0.1.88] - 2024-12-15

### Fixed
- **Critical Startup Fix**: Resolved extension initialization failures on Apple Silicon Macs
- **WebView Initialization**: Fixed RefactoredMessageManager Promise handling errors
- **ARM64 Compatibility**: Rebuilt node-pty with proper ARM64 architecture support

### Added
- **Unified Configuration Service**: Consolidated 4 overlapping configuration services
- **Consolidated Message Service**: Unified 3 duplicate message handling implementations
- **Content Security Policy**: Enhanced CSP compliance for improved security

### Changed
- **Test Infrastructure**: Comprehensive test suite improvements with better mocking
- **Type Safety**: Enhanced type guards and eliminated unsafe TypeScript usage
- **Error Reporting**: Improved error messages with detailed context and stack traces

## [0.1.87] - 2024-09-07

### Added
- **Auto-Scroll Feature**: VS Code standard terminal auto-scroll behavior implementation
- **Enhanced User Experience**: Automatic scrolling to bottom on new output
- **xterm.js Integration**: Native scroll API for reliable implementation

### Fixed
- **Terminal Scroll Behavior**: Consistent with VS Code integrated terminal
- **Performance**: Zero-overhead lightweight auto-scroll implementation

### Technical
- **Quality Assurance**: 275+ tests passing, comprehensive ESLint compliance
- **Package Size**: 3.76MB multi-platform VSIX package
- **Platform Support**: 9 platforms including macOS, Linux, Windows, and Alpine

---

### Legend
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements