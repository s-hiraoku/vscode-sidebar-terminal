/**
 * CLI Agent Pattern Registry
 *
 * Centralized registry for all CLI Agent detection patterns.
 * This serves as the single source of truth for pattern definitions.
 *
 * Responsibilities:
 * - Store and manage all CLI Agent patterns (Claude, Gemini, Codex)
 * - Provide pattern access methods
 * - Support pattern updates and extensions
 */

/**
 * Agent type definition
 */
export type AgentType = 'claude' | 'gemini' | 'codex';

/**
 * Pattern definition for a CLI Agent
 */
export interface AgentPatternDefinition {
  /**
   * Agent type (claude, gemini, codex)
   */
  type: AgentType;

  /**
   * Startup patterns to detect agent launch
   */
  startupPatterns: {
    /**
     * Exact match strings (case-sensitive unless specified)
     */
    exactMatches: string[];

    /**
     * Regular expression patterns
     */
    regexPatterns: RegExp[];

    /**
     * Combined keyword patterns (all keywords must be present)
     */
    combinedKeywords: {
      required: string[];
      optional?: string[];
    }[];

    /**
     * Model-specific patterns (e.g., claude-3-sonnet, gemini-2.5-pro)
     */
    modelPatterns: string[];
  };

  /**
   * Exclusion patterns to avoid false positives
   */
  exclusionPatterns: {
    /**
     * Keywords that indicate this is NOT an agent startup
     */
    keywords: string[];

    /**
     * Regex patterns to exclude
     */
    regexPatterns: RegExp[];
  };

  /**
   * Termination patterns to detect agent exit
   */
  terminationPatterns: {
    /**
     * Explicit termination messages
     */
    explicitMessages: string[];

    /**
     * Process completion patterns
     */
    processCompletion: RegExp[];

    /**
     * Session end indicators
     */
    sessionEndIndicators: string[];
  };
}

/**
 * Shell prompt pattern definitions
 */
export interface ShellPromptPatterns {
  /**
   * Common shell prompt regex patterns
   */
  promptPatterns: RegExp[];

  /**
   * Maximum length for a valid shell prompt
   */
  maxPromptLength: number;

  /**
   * Keywords that indicate AI output (not shell prompts)
   */
  aiOutputIndicators: string[];
}

/**
 * CLI Agent Pattern Registry
 * Single source of truth for all agent detection patterns
 */
export class CliAgentPatternRegistry {
  private static instance: CliAgentPatternRegistry;

  /**
   * Pattern definitions for each agent type
   */
  private readonly agentPatterns: Map<AgentType, AgentPatternDefinition>;

  /**
   * Shell prompt patterns
   */
  private readonly shellPromptPatterns: ShellPromptPatterns;

  /**
   * ANSI escape sequence cleaning patterns
   */
  private readonly ansiCleaningPatterns: RegExp[];

  private constructor() {
    this.agentPatterns = new Map();
    this.shellPromptPatterns = this.initializeShellPromptPatterns();
    this.ansiCleaningPatterns = this.initializeAnsiCleaningPatterns();

    // Initialize patterns for each agent type
    this.registerClaudePatterns();
    this.registerGeminiPatterns();
    this.registerCodexPatterns();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CliAgentPatternRegistry {
    if (!CliAgentPatternRegistry.instance) {
      CliAgentPatternRegistry.instance = new CliAgentPatternRegistry();
    }
    return CliAgentPatternRegistry.instance;
  }

  /**
   * Get pattern definition for a specific agent type
   */
  public getAgentPatterns(agentType: AgentType): AgentPatternDefinition | undefined {
    return this.agentPatterns.get(agentType);
  }

  /**
   * Get all registered agent types
   */
  public getAllAgentTypes(): AgentType[] {
    return Array.from(this.agentPatterns.keys());
  }

  /**
   * Get shell prompt patterns
   */
  public getShellPromptPatterns(): ShellPromptPatterns {
    return this.shellPromptPatterns;
  }

  /**
   * Get ANSI cleaning patterns
   */
  public getAnsiCleaningPatterns(): RegExp[] {
    return this.ansiCleaningPatterns;
  }

  /**
   * Register or update patterns for a specific agent
   */
  public registerAgentPatterns(agentType: AgentType, patterns: AgentPatternDefinition): void {
    this.agentPatterns.set(agentType, patterns);
  }

  /**
   * Initialize Claude Code patterns
   */
  private registerClaudePatterns(): void {
    const claudePatterns: AgentPatternDefinition = {
      type: 'claude',
      startupPatterns: {
        exactMatches: [
          'Welcome to Claude Code!',
          "> Try \"edit <filepath>'",
          "I'm Claude",
          'I am Claude',
          'Powered by Claude',
          'CLI tool for Claude',
          'Claude Code is ready',
          'Claude assistant initialized',
          'Starting Claude Code session',
          'claude --help',
          'claude --version',
          'Usage: claude',
        ],
        regexPatterns: [
          /claude.*Available commands/i,
          /claude.*Options:/i,
          /^claude\s+/,
          /claude\s*>/,
          /claude:/,
        ],
        combinedKeywords: [
          {
            required: ['claude', 'starting', 'session'],
          },
          {
            required: ['claude', 'initializing'],
            optional: ['assistant', 'model'],
          },
          {
            required: ['claude', 'connected', 'successfully'],
          },
          {
            required: ['claude', 'launched'],
            optional: ['successfully', 'code'],
          },
          {
            required: ['claude', 'ready'],
            optional: ['assistant', 'help'],
          },
          {
            required: ['claude', 'activated', 'mode'],
          },
          {
            required: ['claude', 'how can i help'],
          },
          {
            required: ['claude', 'how may i help'],
          },
          {
            required: ['claude', 'what would you like', 'help'],
          },
          {
            required: ['anthropic', 'claude'],
            optional: ['assistant', 'model', 'ready'],
          },
        ],
        modelPatterns: [
          'claude-3-sonnet',
          'claude-3-opus',
          'claude-3-haiku',
          'claude sonnet 4',
          'claude opus 4',
        ],
      },
      exclusionPatterns: {
        keywords: [
          'claude may read',
          'documentation is available at',
          'configuration files are located',
          'error:',
          'warning:',
          'failed',
          'cannot',
          'unable',
          'not found',
        ],
        regexPatterns: [
          /available.*(?!claude)(?!now)/i,
        ],
      },
      terminationPatterns: {
        explicitMessages: [
          'session ended',
          'goodbye claude',
          'claude session terminated',
          'exiting claude',
          'claude exited',
          'connection closed',
          'session terminated',
          'session completed',
          'process finished',
          'claude session ended',
          'command not found: claude',
        ],
        processCompletion: [
          /^\[process exited with code \d+\]$/,
          /^process exited with code \d+$/,
          /^exited with code \d+$/,
        ],
        sessionEndIndicators: [
          'cleaning up',
          'session closed',
          'terminating',
          'shutting down',
          'disconnected',
        ],
      },
    };

    this.agentPatterns.set('claude', claudePatterns);
  }

  /**
   * Initialize Gemini CLI patterns
   */
  private registerGeminiPatterns(): void {
    const geminiPatterns: AgentPatternDefinition = {
      type: 'gemini',
      startupPatterns: {
        exactMatches: [
          'Welcome to Gemini',
          'Gemini CLI started',
          'Google Gemini is ready',
          'Gemini Code assistant',
          'Starting Gemini session',
          'Gemini model initialized',
          'You are running Gemini CLI',
          'Type your message or @path/to/file',
          'gemini --help',
          'gemini --version',
          'Usage: gemini',
          'gemini',
        ],
        regexPatterns: [
          /gemini.*Available commands/i,
          /gemini.*Options:/i,
          /^gemini\s+/,
          /^gemini>\s*$/,
          /^gemini\s*\$\s*$/,
          /^gemini\s*#\s*$/,
          /^gemini:\s*$/,
          /gemini\s*>/,
          /gemini:/,
        ],
        combinedKeywords: [
          {
            required: ['gemini', 'cli'],
            optional: ['starting', 'launched', 'ready'],
          },
          {
            required: ['gemini', 'google', 'initialized'],
          },
          {
            required: ['gemini', 'connected', 'successfully'],
          },
          {
            required: ['gemini', 'session'],
            optional: ['started', 'ready'],
          },
          {
            required: ['gemini', 'welcome'],
          },
          {
            required: ['gemini', 'initialized'],
            optional: ['model', 'assistant'],
          },
          {
            required: ['gemini', 'how can i help'],
          },
          {
            required: ['gemini', 'what would you like'],
          },
          {
            required: ['google ai', 'gemini'],
            optional: ['ready', 'initialized', 'connected'],
          },
          {
            required: ['google generative ai', 'gemini'],
            optional: ['ready', 'initialized', 'connected'],
          },
        ],
        modelPatterns: [
          'gemini-2.5-pro',
          'gemini-1.5-pro',
          'gemini-pro',
          'gemini flash',
          'gemini-exp',
          'gemini.*context left',
        ],
      },
      exclusionPatterns: {
        keywords: [
          'update available:',
          'version.*available!',
          'new model is available',
          'error:',
          'warning:',
          'failed',
          'cannot',
          'unable',
          'not found',
        ],
        regexPatterns: [
          /available.*(?!gemini)(?!now)/i,
        ],
      },
      terminationPatterns: {
        explicitMessages: [
          'session ended',
          'goodbye gemini',
          'gemini session terminated',
          'exiting gemini',
          'gemini exited',
          'connection closed',
          'gemini session ended',
          'command not found: gemini',
        ],
        processCompletion: [
          /^\[process exited with code \d+\]$/,
          /^process exited with code \d+$/,
          /^exited with code \d+$/,
        ],
        sessionEndIndicators: [
          'cleaning up',
          'session closed',
          'terminating',
          'shutting down',
          'disconnected',
        ],
      },
    };

    this.agentPatterns.set('gemini', geminiPatterns);
  }

  /**
   * Initialize OpenAI Codex patterns
   */
  private registerCodexPatterns(): void {
    const codexPatterns: AgentPatternDefinition = {
      type: 'codex',
      startupPatterns: {
        exactMatches: [
          'Welcome to Codex',
          'Codex CLI started',
          'OpenAI Codex is ready',
          'Codex assistant',
          'Starting Codex session',
          'Codex initialized',
          'codex --help',
          'codex --version',
          'Usage: codex',
          'codex',
        ],
        regexPatterns: [
          /codex.*Available commands/i,
          /codex.*Options:/i,
          /^codex\s+/,
          /^codex>\s*$/,
          /^codex\s*\$\s*$/,
          /^codex\s*#\s*$/,
          /^codex:\s*$/,
          /codex\s*>/,
          /codex:/,
        ],
        combinedKeywords: [
          {
            required: ['codex', 'cli'],
            optional: ['starting', 'launched', 'ready'],
          },
          {
            required: ['codex', 'openai', 'initialized'],
          },
          {
            required: ['codex', 'connected', 'successfully'],
          },
          {
            required: ['codex', 'session'],
            optional: ['started', 'ready'],
          },
          {
            required: ['codex', 'welcome'],
          },
          {
            required: ['codex', 'initialized'],
            optional: ['model', 'assistant'],
          },
          {
            required: ['codex', 'how can i help'],
          },
          {
            required: ['codex', 'what would you like'],
          },
          {
            required: ['openai', 'codex', 'cli'],
          },
        ],
        modelPatterns: [
          'code-davinci',
          'code-cushman',
          'codex-davinci',
          'codex-cushman',
          'openai.*codex',
        ],
      },
      exclusionPatterns: {
        keywords: [
          'error:',
          'warning:',
          'failed',
          'cannot',
          'unable',
          'not found',
          'deprecated',
        ],
        regexPatterns: [
          /available.*(?!codex)(?!now)/i,
        ],
      },
      terminationPatterns: {
        explicitMessages: [
          'session ended',
          'goodbye codex',
          'codex session terminated',
          'exiting codex',
          'codex exited',
          'connection closed',
          'codex session ended',
          'command not found: codex',
        ],
        processCompletion: [
          /^\[process exited with code \d+\]$/,
          /^process exited with code \d+$/,
          /^exited with code \d+$/,
        ],
        sessionEndIndicators: [
          'cleaning up',
          'session closed',
          'terminating',
          'shutting down',
          'disconnected',
        ],
      },
    };

    this.agentPatterns.set('codex', codexPatterns);
  }

  /**
   * Initialize shell prompt patterns
   */
  private initializeShellPromptPatterns(): ShellPromptPatterns {
    return {
      promptPatterns: [
        // Standard bash/zsh prompts with username@hostname (strict)
        /^[\w.-]+@[\w.-]+:[~\/]?[\w\/.~-]*\$\s*$/,
        /^[\w.-]+@[\w.-]+\s+[~\/]?[\w\/.~-]*[$%#]\s*$/,

        // Oh My Zsh themes with symbols (strict)
        /^➜\s+[~\/]?[\w\/.~-]*\s*$/,
        /^[➜▶⚡]\s+[~\/]?[\w\/.~-]*\s*$/,

        // Starship prompt variations (exact)
        /^❯\s*$/,
        /^❯\s+\[.*?\].*$/,

        // Simple shell prompts (exact match only)
        /^[$%#>]\s*$/,

        // PowerShell patterns (strict)
        /^PS\s+[A-Z]:\\[\w\\.-]*>\s*$/,
        /^PS>\s*$/,

        // Fish shell patterns (strict)
        /^[\w.-]+\s+[~\/][\w\/.-]*>\s*$/,

        // Python/conda environment prompts (strict)
        /^\([\w.-]+\)\s+[~\/]?[\w\/.~-]*[$%#]\s*$/,

        // Directory-only prompts (strict)
        /^~\$\s*$/,
        /^\/[\w\/.~-]*\$\s*$/,
        /^\.\/[\w\/.~-]*\$\s*$/,
        /^[A-Z]:\\[\w\\.-]*>\s*$/,

        // Time-based prompts (strict)
        /^\[\d{1,2}:\d{2}(:\d{2})?\]\s*[~\/]?[\w\/.~-]*[$%#]\s*$/,

        // Git-aware prompts (strict)
        /^[\w.-]+\s+git:\([^)]+\)\s*[~\/]?[\w\/.~-]*\$\s*$/,

        // More flexible patterns for basic shell prompts
        /^\w+\$\s*$/,
        /^\w+%\s*$/,
        /^\w+#\s*$/,
        /^[\w-]+:\s*.*\$\s*$/,
        /^.*@.*:\s*.*\$\s*$/,

        // Jupyter/IPython style
        /^In\s*\[\d+\]:\s*$/,
        /^Out\s*\[\d+\]:\s*$/,

        // Terminal-specific patterns
        /^Last login:/,
        /^logout$/i,
        /^Connection to .* closed\.$/,
        /^Session terminated\.$/i,
      ],
      maxPromptLength: 100,
      aiOutputIndicators: [
        'assistant',
        'response',
        'token',
        'output',
        'thinking',
        'processing',
        'generating',
        'analyzing',
        'understanding',
        'error:',
        'warning:',
        'info:',
        'debug:',
        'trace:',
        'markdown',
        'function',
        'class',
        'import',
        'export',
        'const',
        'let',
        'var',
        'return',
        'if',
        'else',
        'for',
        'while',
      ],
    };
  }

  /**
   * Initialize ANSI escape sequence cleaning patterns
   */
  private initializeAnsiCleaningPatterns(): RegExp[] {
    return [
      // Basic ANSI escape sequences (color, cursor movement, etc.)
      // eslint-disable-next-line no-control-regex
      /\x1b\[[0-9;]*[A-Za-z]/g,
      // OSC sequences (window title settings, etc.)
      // eslint-disable-next-line no-control-regex
      /\x1b\][0-9];[^\x07]*\x07/g,
      // Escape sequence termination
      // eslint-disable-next-line no-control-regex
      /\x1b\\/g,
      // Private mode settings
      // eslint-disable-next-line no-control-regex
      /\x1b\?[0-9]*[hl]/g,
      // Application/normal keypad
      // eslint-disable-next-line no-control-regex
      /\x1b[=>]/g,
      // Control characters
      // eslint-disable-next-line no-control-regex
      /[\x00-\x1F\x7F]/g,
    ];
  }
}
