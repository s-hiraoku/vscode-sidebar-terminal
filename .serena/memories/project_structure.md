# Project Structure

## Root Directory
```
vscode-sidebar-terminal/
├── src/                    # Source code
├── docs/                   # Documentation
├── scripts/               # Build and utility scripts
├── resources/             # Icons and assets
├── .github/               # GitHub Actions workflows
├── .vscode/               # VS Code workspace settings
├── .husky/                # Git hooks
├── webpack.config.js      # Webpack configuration
├── package.json           # Project manifest
├── tsconfig.json          # TypeScript configuration
├── CLAUDE.md             # AI assistant instructions
├── README.md             # Project documentation
└── CHANGELOG.md          # Version history
```

## Source Structure (src/)
```
src/
├── extension.ts           # Extension entry point
├── commands/             # Command implementations
│   ├── FileReferenceCommand.ts      # CLI Agent @filename
│   └── CopilotIntegrationCommand.ts # GitHub Copilot #file:
├── config/               # Configuration management
├── constants/            # Application constants
├── core/                 # Core functionality
│   └── ExtensionLifecycle.ts
├── integration/          # External integrations
├── providers/            # VS Code providers
│   └── SecandarySidebar.ts  # WebView provider
├── sessions/             # Session management
│   └── UnifiedSessionManager.ts
├── terminals/            # Terminal management
│   ├── TerminalManager.ts
│   └── TerminalNumberManager.ts
├── types/                # TypeScript type definitions
│   └── common.ts         # Shared interfaces
├── utils/                # Utility functions
├── webview/              # WebView frontend
│   ├── main.ts          # WebView entry point
│   ├── components/      # UI components
│   ├── core/            # Core webview logic
│   ├── interfaces/      # WebView interfaces
│   ├── managers/        # UI state managers
│   └── utils/           # WebView utilities
└── test/                 # Test files
    ├── unit/            # Unit tests
    ├── integration/     # Integration tests
    └── shared/          # Shared test utilities
```

## Key Directories

### Extension Host (Node.js environment)
- `src/terminals/`: Terminal process management with node-pty
- `src/providers/`: VS Code WebView integration
- `src/sessions/`: Terminal session persistence
- `src/commands/`: VS Code command implementations

### WebView (Browser environment)
- `src/webview/main.ts`: Central coordinator (TerminalWebviewManager)
- `src/webview/managers/`: Specialized UI managers
  - MessageManager: Extension communication
  - InputManager: Keyboard/mouse handling
  - UIManager: Visual appearance
  - SplitManager: Terminal splitting
  - PerformanceManager: Output optimization
  - ConfigManager: Settings persistence
  - NotificationManager: User feedback

### Testing
- `src/test/unit/`: Component-specific unit tests
- `src/test/shared/`: Test setup and utilities
- Uses Mocha + Chai + Sinon framework

### Build and Config
- `webpack.config.js`: Dual build for extension + webview
- `tsconfig.json`: Strict TypeScript configuration
- `.eslintrc.json`: Code quality rules
- `.prettierrc.json`: Code formatting rules

## Communication Architecture
```
Extension Host (Node.js)          WebView (Browser)
├── TerminalManager      <--->    ├── TerminalWebviewManager
├── SecandarySidebar     <--->    ├── MessageManager
└── node-pty process     <--->    └── xterm.js
```

## File Naming Patterns
- **Classes**: PascalCase.ts (e.g., TerminalManager.ts)
- **Interfaces**: IName.ts or within common.ts
- **Utils**: camelCase.ts (e.g., domUtils.ts)
- **Tests**: *.test.ts (mirrors source structure)