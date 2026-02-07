# Project Context

## Purpose
Secondary Terminal is a production-ready VS Code extension providing advanced terminal management in the sidebar with exceptional AI agent integration. The extension enables developers to manage up to 5 concurrent terminal instances with full ProcessState/InteractionState management, persistent session restoration, and optimized performance for modern CLI coding agents like Claude Code, Codex CLI, Gemini CLI, and GitHub Copilot.

**Key Goals:**
- Provide VS Code-standard compliant terminal management with full ProcessState/InteractionState tracking
- Enable seamless integration with CLI coding agents (Claude Code, Codex, Gemini, GitHub Copilot)
- Support efficient multi-agent workflows with smart file reference sharing
- Maintain production-grade quality with zero TypeScript compilation errors
- Ensure persistent session restoration across VS Code restarts

## Tech Stack

### Core Technologies
- **TypeScript 5.3.3**: Strict typing with comprehensive interfaces and zero compilation errors
- **Node.js >=18.0.0**: Backend runtime for extension host
- **VS Code Extension API 1.74.0+**: Full VS Code extension development framework
- **webpack 5.89.0**: Production bundling with optimized builds

### Terminal Technologies
- **@homebridge/node-pty-prebuilt-multiarch 0.13.1**: Cross-platform PTY (pseudo-terminal) implementation
- **xterm.js 5.5.0**: Full-featured terminal emulation in browser
- **xterm.js addons**: fit, search, serialize, unicode11, web-links, webgl

### Build & Testing
- **Vitest 3.x**: Test framework with comprehensive test suite (275+ tests), built-in assertions, mocking (vi.fn/vi.spyOn/vi.mock), and v8 coverage reporting (targeting 85%+ coverage)
- **ESLint 8.56.0**: Code quality with @typescript-eslint plugins
- **Prettier 3.1.1**: Code formatting

### CI/CD
- **GitHub Actions**: Automated testing, multi-platform builds, marketplace publishing
- **@vscode/vsce 3.6.0**: VS Code extension packaging and publishing
- **Platform Targets**: Windows (x64, ARM64), macOS (x64, ARM64), Linux (x64, ARM64, ARMhf), Alpine (x64, ARM64)

## Project Conventions

### Code Style
- **TypeScript Strict Mode**: All code must compile with strict type checking
- **ESLint Rules**: 0 errors tolerated, warnings acceptable if documented
- **Prettier Formatting**: Automated formatting for consistency
- **File Naming**: kebab-case for files, PascalCase for classes, camelCase for functions/variables
- **Line Length**: Aim for 100 characters, max 120 for readability
- **Comments**: Required for complex logic, AI agent detection patterns, and security patterns
- **Imports**: Organized by type (external, internal, types), alphabetically within groups

### Architecture Patterns

#### Singleton TerminalManager Pattern
- **Atomic Operations**: All terminal operations use atomic patterns to prevent race conditions
- **ID Recycling System**: Terminal IDs 1-5 are recycled to maintain consistent UX
- **Process Lifecycle**: Explicit lifecycle states (ProcessState/InteractionState from VS Code)
- **Session Persistence**: Terminal states saved every 5 minutes with restoration support

#### WebView Manager-Coordinator Pattern
```
TerminalWebviewManager (Coordinator)
├── MessageManager     # Extension ↔ WebView communication
├── UIManager         # Theme management and visual feedback
├── InputManager      # Keyboard/IME handling, Alt+Click support
├── PerformanceManager # Output buffering (16ms flush interval)
├── NotificationManager # User notifications
└── TerminalLifecycleManager # Terminal creation/deletion
```

#### Service-Oriented Architecture
- **WebView HTML Generation Service**: Centralized HTML generation with CSP security
- **Message Routing Service**: Plugin-based message handler architecture (20+ commands)
- **Unified Provider Coordinator**: Reduced complexity by 33% through service extraction

#### AI Agent Detection System
- **Strategy Pattern**: Agent-specific detection logic (Claude, Copilot, Codex, Gemini)
- **Pattern Matching**: Regex patterns with word boundaries (NOT includes() for security)
- **Real-time Detection**: Debounced output monitoring with status indicators
- **Security**: URL substring sanitization using regex patterns

### Testing Strategy

#### TDD Workflow
1. **Red Phase**: Write failing test (`npm run tdd:red`)
2. **Green Phase**: Minimal implementation (`npm run tdd:green`)
3. **Refactor Phase**: Improve code quality (`npm run tdd:refactor`)
4. **Quality Gate**: Verify TDD compliance (`npm run tdd:quality-gate`)

#### Test Categories
- **Unit Tests**: 275+ tests covering core functionality (fast, reliable)
- **Integration Tests**: Component interaction and AI agent scenarios
- **Performance Tests**: Buffer management, memory optimization, CPU usage
- **Edge Cases**: Error handling, resource cleanup, concurrent operations

#### Coverage Requirements
- **Overall Coverage**: 85%+ target (currently achieving 70%+ lines)
- **Critical Paths**: 90%+ for TerminalManager, session management, AI detection
- **Pre-Release Gate**: `npm run pre-release:check` must pass before releases

#### Test Execution
```bash
npm run test:unit           # Unit tests only (fastest)
npm run test:integration    # Integration tests
npm run test:performance    # Performance tests
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode for development
```

### Git Workflow

#### Branching Strategy
- **main**: Production-ready code, protected branch
- **for-publish**: Release preparation branch, CI/CD targets this
- **feature/[name]**: Feature development branches
- **hotfix/[name]**: Emergency fix branches
- **refactor/[name]**: Code refactoring branches

#### Commit Conventions
- **Format**: `type: brief description` (50 chars max)
- **Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`
- **Breaking Changes**: Mark with `BREAKING:` prefix in commit body
- **Examples**:
  - `feat: add GitHub Copilot CLI detection`
  - `fix: resolve terminal scrollback restoration (Issue #201)`
  - `refactor: extract WebView HTML generation service`

#### Release Process (GitHub Actions)
1. **Update Version**: `npm version patch --no-git-tag-version` (NO tag yet)
2. **Commit Changes**: `git add -A && git commit -m "v{version}: Description"`
3. **Push & Wait**: `git push` then verify CI passes
4. **Tag After CI Success**: `git tag v{version} && git push origin v{version}`
5. **Automated Workflow**: Creates release, builds 9 platforms, publishes to marketplace

**Benefits**: Prevents version number waste on CI failures, clean git history

## Domain Context

### VS Code Extension Development
- **Extension Host**: Node.js runtime, access to file system, PTY processes
- **WebView**: Browser environment, isolated with Content Security Policy (CSP)
- **Message Passing**: Extension ↔ WebView communication via postMessage
- **Activation Events**: `onView:secondaryTerminal`, `onCommand:secondaryTerminal.focusTerminal`

### Terminal Emulation
- **PTY (Pseudo-Terminal)**: node-pty spawns shell processes with PTY interface
- **xterm.js**: Renders terminal output in browser, handles input, cursor, ANSI codes
- **Shell Integration**: Command tracking, working directory detection, history
- **Session Persistence**: Serializes terminal state, restores scrollback (1000 lines)

### AI Agent Integration Patterns
- **Detection**: Pattern matching on terminal output (startup messages, CLI prompts)
- **Status Tracking**: Connected → Active → Disconnected lifecycle
- **File References**: `@filename` format for sharing code with AI agents
- **Performance**: 250fps output processing during active AI sessions (vs 60fps normal)

### Security Considerations
- **CSP (Content Security Policy)**: Strict CSP for WebView HTML
- **Nonce-based Script Loading**: Unique nonces for inline scripts
- **URL Sanitization**: Regex patterns with word boundaries (NOT includes())
- **No Credential Storage**: Use VS Code SecretStorage for sensitive data

## Important Constraints

### Technical Constraints
- **VS Code API Version**: Minimum 1.74.0 for core features
- **Node.js Version**: >=18.0.0 required for modern features
- **Terminal Limit**: Maximum 5 terminals (configurable via settings)
- **Session Scrollback**: 1000 lines max per terminal for persistent sessions
- **Storage Limit**: 20MB maximum for scrollback data
- **Platform Support**: Windows, macOS (Intel & ARM), Linux (x64, ARM64, ARMhf), Alpine

### Performance Constraints
- **Buffer Flush Intervals**:
  - Normal: 16ms (~60fps)
  - AI Agent Active: 4ms (~250fps)
  - Typing: Immediate processing
  - Large Output: Immediate for >1000 chars
- **Memory Management**: Comprehensive cleanup on disposal required for all managers
- **WebView Bundle Size**: Keep under 1.5MB for fast loading

### Quality Constraints
- **TypeScript**: Zero compilation errors tolerated
- **ESLint**: Zero errors (warnings acceptable with documentation)
- **Test Coverage**: 85%+ target, 70%+ minimum for release
- **TDD Compliance**: 50%+ (targeting 85%)

### Known Issues & Workarounds
- **Ubuntu CI Timeout**: Tests may timeout after 30min (known runner issue), tests pass on Windows/macOS
- **CodeQL False Positives**: May report substring sanitization issues, use regex with word boundaries
- **IME Composition**: Special handling required for Japanese/Chinese input in InputManager

## External Dependencies

### VS Code APIs
- **window.createTerminalRenderer**: Core terminal rendering API
- **window.createWebviewViewProvider**: WebView panel creation
- **workspace.getConfiguration**: Settings management
- **commands.registerCommand**: Command registration
- **ExtensionContext.globalState**: Persistent storage for sessions

### Shell Integration
- **System Shell Detection**: Automatic detection of bash, zsh, fish, powershell, cmd
- **Working Directory**: PWD tracking via shell integration sequences
- **Command Markers**: OSC sequences for command start/end detection

### AI Agent CLIs
- **Claude Code**: `claude-code` command, detects "Claude Code" startup message
- **Codex CLI**: `codex` command, OpenAI-powered development assistance
- **GitHub Copilot**: `copilot` or `gh copilot`, detects "Welcome to GitHub Copilot CLI"
- **Gemini CLI**: `gemini code`, detects ASCII art GEMINI graphics


### Build & Deployment
- **VS Code Marketplace**: Publishing via vsce tool with VSCE_PAT token
- **GitHub Releases**: Automated release creation with platform-specific VSIX files
- **GitHub Actions**: CI/CD workflows for testing, building, publishing

### Testing Infrastructure
- **Vitest**: Test framework with built-in assertion, mocking (vi.fn/vi.spyOn/vi.mock), and v8 coverage
- **jsdom**: Browser environment simulation for WebView testing
