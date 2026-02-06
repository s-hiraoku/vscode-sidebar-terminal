/**
 * CLI Agent Pattern Registry
 *
 * Centralized registry for all CLI Agent detection patterns.
 * This eliminates code duplication by providing a single source of truth
 * for pattern definitions across Claude, Gemini, Codex, Copilot, and OpenCode agents.
 *
 * Benefits:
 * - ~80% code reduction by eliminating duplicated pattern definitions
 * - Single point of maintenance for all detection patterns
 * - Consistent detection behavior across all services
 * - Improved extensibility for adding new agent types
 */
import { AgentType } from '../types/shared';

/**
 * Pattern definitions for a specific agent type
 */
export interface AgentPatternDefinition {
  /** Agent type identifier */
  type: AgentType;

  /** Command prefixes that trigger the agent (e.g., "claude", "gemini") */
  commandPrefixes: string[];

  /** String patterns that indicate agent startup */
  startupPatterns: string[];

  /** Regex patterns for startup detection (case-insensitive) */
  startupRegexPatterns: RegExp[];

  /** Keywords that indicate agent activity */
  activityKeywords: string[];

  /** Patterns that indicate explicit agent termination */
  terminationPatterns: string[];

  /** Regex patterns for termination detection */
  terminationRegexPatterns: RegExp[];
}

/**
 * Shell prompt patterns used for termination detection
 */
export interface ShellPromptPatterns {
  /** Standard shell prompt patterns */
  standard: RegExp[];

  /** Process completion indicators */
  processCompletion: string[];

  /** Explicit termination messages */
  explicitTermination: string[];

  /** Process crash indicators */
  crashIndicators: string[];
}

/**
 * Centralized pattern registry for CLI Agent detection
 */
export class CliAgentPatternRegistry {
  private readonly agentPatterns: Map<AgentType, AgentPatternDefinition>;
  private readonly shellPromptPatterns: ShellPromptPatterns;

  constructor() {
    this.agentPatterns = this.initializeAgentPatterns();
    this.shellPromptPatterns = this.initializeShellPromptPatterns();
  }

  /**
   * Initialize all agent pattern definitions
   */
  private initializeAgentPatterns(): Map<AgentType, AgentPatternDefinition> {
    const patterns = new Map<AgentType, AgentPatternDefinition>();

    // Claude Code patterns
    patterns.set('claude', {
      type: 'claude',
      commandPrefixes: ['claude ', 'claude'],
      startupPatterns: ['Welcome to Claude Code!'],
      startupRegexPatterns: [/Claude\s+Code/],
      activityKeywords: ['claude', 'anthropic'],
      terminationPatterns: [
        'session ended',
        'goodbye claude',
        'claude session terminated',
        'exiting claude',
        'claude exited',
        'exit',
        'quit',
        'goodbye',
        'bye',
      ],
      terminationRegexPatterns: [/session terminated/i, /connection closed/i, /process exited/i],
    });

    // Gemini CLI patterns
    patterns.set('gemini', {
      type: 'gemini',
      commandPrefixes: ['gemini ', 'gemini'],
      startupPatterns: [
        'Welcome to Gemini',
        'Gemini CLI started',
        'Google Gemini is ready',
        'Gemini Code assistant',
        'Starting Gemini session',
        'Gemini model initialized',
        'Type your message or @path/to/file',
        'gemini --help',
        'gemini --version',
        'Usage: gemini',
        'gemini >',
        'gemini:',
      ],
      startupRegexPatterns: [
        /You are running Gemini CLI.*directory/i,
        /gemini.*Available commands/i,
        /gemini.*Options:/i,
        /gemini.*how can i help/i,
        /gemini.*what would you like/i,
        /^gemini\s+/,
        /gemini-2\.5-pro/i,
        /gemini-1\.5-pro/i,
        /gemini-pro/i,
        /gemini flash/i,
        /gemini-exp/i,
        /gemini.*context left/i,
        /google.*gemini.*chat/i,
      ],
      activityKeywords: ['gemini', 'google', 'google ai'],
      terminationPatterns: [
        'session ended',
        'goodbye gemini',
        'gemini session terminated',
        'exiting gemini',
        'gemini exited',
        'exit',
        'quit',
        'goodbye',
        'bye',
      ],
      terminationRegexPatterns: [/session terminated/i, /connection closed/i, /process exited/i],
    });

    // OpenAI Codex patterns
    patterns.set('codex', {
      type: 'codex',
      commandPrefixes: ['codex ', 'codex'],
      startupPatterns: ['OpenAI Codex'],
      startupRegexPatterns: [/OpenAI\s+Codex/i],
      activityKeywords: ['codex', 'openai'],
      terminationPatterns: [
        'session ended',
        'goodbye codex',
        'codex session terminated',
        'exiting codex',
        'codex exited',
        'exit',
        'quit',
        'goodbye',
        'bye',
      ],
      terminationRegexPatterns: [/session terminated/i, /connection closed/i, /process exited/i],
    });

    // GitHub Copilot CLI patterns
    patterns.set('copilot', {
      type: 'copilot',
      commandPrefixes: ['copilot ', 'copilot', 'gh copilot'],
      startupPatterns: ['Welcome to GitHub Copilot CLI'],
      startupRegexPatterns: [/GitHub\s+Copilot\s+CLI/i],
      activityKeywords: ['copilot', 'github'],
      terminationPatterns: [
        'session ended',
        'goodbye copilot',
        'copilot session terminated',
        'exiting copilot',
        'copilot exited',
        'exit',
        'quit',
        'goodbye',
        'bye',
      ],
      terminationRegexPatterns: [/session terminated/i, /connection closed/i, /process exited/i],
    });

    // OpenCode patterns
    patterns.set('opencode', {
      type: 'opencode',
      commandPrefixes: ['opencode ', 'opencode'],
      startupPatterns: ['Welcome to OpenCode', 'OpenCode CLI'],
      startupRegexPatterns: [/welcome\s+to\s+open\s*code/i, /open\s*code\s+cli/i],
      activityKeywords: ['opencode', 'open code'],
      terminationPatterns: [
        'session ended',
        'goodbye opencode',
        'opencode session terminated',
        'exiting opencode',
        'opencode exited',
        'exit',
        'quit',
        'goodbye',
        'bye',
      ],
      terminationRegexPatterns: [/session terminated/i, /connection closed/i, /process exited/i],
    });

    return patterns;
  }

  /**
   * Initialize shell prompt patterns for termination detection
   */
  private initializeShellPromptPatterns(): ShellPromptPatterns {
    return {
      standard: [
        // Standard bash/zsh prompts with username@hostname
        /^[\w.-]+@[\w.-]+:[~\/]?[\w\/.~-]*\$\s*$/,
        /^[\w.-]+@[\w.-]+\s+[~\/]?[\w\/.~-]*[$%#]\s*$/,
        // Oh My Zsh themes with symbols
        /^➜\s+[~\/]?[\w\/.~-]*\s*$/,
        /^[➜▶⚡]\s+[~\/]?[\w\/.~-]*\s*$/,
        // Starship prompt variations
        /^❯\s*$/,
        /^❯\s+\[.*?\].*$/,
        // Simple shell prompts
        /^[$%#>]\s*$/,
        // PowerShell patterns
        /^PS\s+[A-Z]:\\[\w\\.-]*>\s*$/,
        /^PS>\s*$/,
        // Fish shell patterns
        /^[\w.-]+\s+[~\/][\w\/.-]*>\s*$/,
        // Python/conda environment prompts
        /^\([\w.-]+\)\s+[~\/]?[\w\/.~-]*[$%#]\s*$/,
        // Directory-only prompts
        /^~\$\s*$/,
        /^\/[\w\/.~-]*\$\s*$/,
        /^\.\/[\w\/.~-]*\$\s*$/,
        /^[A-Z]:\\[\w\\.-]*>\s*$/,
        // Time-based prompts
        /^\[\d{1,2}:\d{2}(:\d{2})?\]\s*[~\/]?[\w\/.~-]*[$%#]\s*$/,
        // Git-aware prompts
        /^[\w.-]+\s+git:\([^)]+\)\s*[~\/]?[\w\/.~-]*\$\s*$/,
        // Powerlevel/oh-my-zsh decorated prompts (e.g. "➜ project git:(main) ✗")
        /^[➜▶⚡❯]\s+(?:[~\/]?[\w\/.-]+)(?:\s+git:\([^)]+\))?(?:\s+[✗✘✔✱✚●•±!?])?\s*$/,
        // Flexible patterns
        /^\w+\$\s*$/,
        /^\w+%\s*$/,
        /^\w+#\s*$/,
        /^[\w-]+:\s*.*\$\s*$/,
        /^.*@.*:\s*.*\$\s*$/,
        /^.*\s+\$\s*$/,
        /^.*\s+%\s*$/,
        // Terminal-specific patterns
        /^Last login:/,
        /^logout$/i,
        /^Connection to .* closed\.$/,
        /^Session terminated\.$/i,
      ],
      processCompletion: ['[done]', '[finished]', 'done', 'finished', 'complete', 'completed'],
      explicitTermination: [
        'session ended',
        'connection closed',
        'session terminated',
        'session completed',
        'process finished',
        'goodbye claude',
        'goodbye gemini',
        'exiting claude',
        'exiting gemini',
        'claude exited',
        'gemini exited',
        'claude session ended',
        'gemini session ended',
        'command not found: claude',
        'command not found: gemini',
        'command not found: codex',
        'command not found: copilot',
        'command not found: opencode',
      ],
      crashIndicators: [
        'segmentation fault',
        'core dumped',
        'fatal error',
        'panic:',
        'killed',
        'abort',
        'crashed',
        'exception',
        'stack overflow',
        'out of memory',
        'signal',
        'terminated unexpectedly',
      ],
    };
  }

  /**
   * Get pattern definition for specific agent type
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
   * Get all agent pattern definitions
   */
  public getAllAgentPatterns(): AgentPatternDefinition[] {
    return Array.from(this.agentPatterns.values());
  }

  /**
   * Get shell prompt patterns
   */
  public getShellPromptPatterns(): ShellPromptPatterns {
    return this.shellPromptPatterns;
  }

  /**
   * Check if command input matches any agent
   * @param input User command input
   * @returns Matched agent type or null
   */
  public matchCommandInput(input: string): AgentType | null {
    const lowerInput = input.toLowerCase().trim();
    if (!lowerInput) {
      return null;
    }

    const tokens = this.extractCommandTokens(lowerInput);
    const tokenMatch = this.matchCommandTokens(tokens);
    if (tokenMatch) {
      return tokenMatch;
    }

    for (const [agentType, patterns] of this.agentPatterns.entries()) {
      for (const prefix of patterns.commandPrefixes) {
        if (lowerInput.startsWith(prefix) || lowerInput === prefix.trim()) {
          return agentType;
        }
      }
    }

    return null;
  }

  private extractCommandTokens(input: string): string[] {
    const tokens = (input.match(/[^\s]+/g) || []).map((token) => this.stripTokenQuotes(token));
    if (tokens.length === 0) {
      return [];
    }

    let index = 0;

    while (index < tokens.length && this.isEnvironmentAssignment(tokens[index])) {
      index++;
    }

    if (tokens[index] === 'env') {
      index++;
      while (
        index < tokens.length &&
        (this.isEnvironmentAssignment(tokens[index]) || tokens[index].startsWith('-'))
      ) {
        index++;
      }
    }

    return tokens.slice(index);
  }

  private isEnvironmentAssignment(token: string | undefined): boolean {
    return !!token && /^[a-z_][a-z0-9_]*=/.test(token);
  }

  private stripTokenQuotes(token: string): string {
    return token.replace(/^['"]+|['"]+$/g, '');
  }

  private matchCommandTokens(tokens: string[]): AgentType | null {
    if (tokens.length === 0) {
      return null;
    }

    const directMatch = this.matchDirectCommand(tokens);
    if (directMatch) {
      return directMatch;
    }

    return this.matchWrappedCommand(tokens);
  }

  private matchDirectCommand(tokens: string[]): AgentType | null {
    const first = tokens[0];
    const second = tokens[1];
    if (!first) {
      return null;
    }

    if (first === 'gh' && second === 'copilot') {
      return 'copilot';
    }

    return this.matchAgentAlias(this.normalizeCommandToken(first));
  }

  private matchWrappedCommand(tokens: string[]): AgentType | null {
    const wrapper = tokens[0];
    if (!wrapper) {
      return null;
    }

    let targetIndex = -1;
    if (wrapper === 'npx' || wrapper === 'bunx') {
      targetIndex = 1;
    } else if ((wrapper === 'pnpm' || wrapper === 'yarn') && tokens[1] === 'dlx') {
      targetIndex = 2;
    } else if (wrapper === 'npm' && tokens[1] === 'exec') {
      targetIndex = 2;
    }

    if (targetIndex === -1) {
      return null;
    }

    const target = this.extractWrapperTarget(tokens, targetIndex);
    if (!target) {
      return null;
    }

    return this.matchAgentAlias(this.normalizePackageToken(target));
  }

  private extractWrapperTarget(tokens: string[], startIndex: number): string | null {
    for (let i = startIndex; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || token === '--') {
        continue;
      }
      if (token.startsWith('-')) {
        continue;
      }
      return token;
    }
    return null;
  }

  private normalizeCommandToken(token: string): string {
    const normalized = this.stripVersionSuffix(this.stripShellDelimiters(token));
    const pathSplit = normalized.split(/[\\/]/);
    return pathSplit[pathSplit.length - 1] || normalized;
  }

  private normalizePackageToken(token: string): string {
    const normalized = this.stripShellDelimiters(token);
    return this.stripVersionSuffix(normalized);
  }

  private stripShellDelimiters(token: string): string {
    return token.replace(/[;|&]+$/g, '');
  }

  private stripVersionSuffix(token: string): string {
    if (!token.includes('@')) {
      return token;
    }

    if (token.startsWith('@')) {
      const secondAt = token.indexOf('@', 1);
      return secondAt > 0 ? token.slice(0, secondAt) : token;
    }

    return token.split('@')[0];
  }

  private matchAgentAlias(token: string): AgentType | null {
    const normalized = token.toLowerCase();
    switch (normalized) {
      case 'claude':
      case 'claude-code':
      case '@anthropic-ai/claude-code':
        return 'claude';
      case 'gemini':
      case 'gemini-cli':
      case '@google/gemini-cli':
        return 'gemini';
      case 'codex':
      case 'openai-codex':
      case '@openai/codex':
        return 'codex';
      case 'copilot':
      case '@github/copilot':
      case 'github/copilot':
      case 'gh-copilot':
        return 'copilot';
      case 'opencode':
      case '@opencode-ai/opencode':
      case '@sst/opencode':
      case 'sst/opencode':
        return 'opencode';
      default:
        return null;
    }
  }

  /**
   * Check if output matches any agent startup pattern
   * @param output Terminal output
   * @returns Matched agent type or null
   */
  public matchStartupOutput(output: string): AgentType | null {
    for (const [agentType, patterns] of this.agentPatterns.entries()) {
      // Check string patterns
      for (const pattern of patterns.startupPatterns) {
        if (output.includes(pattern)) {
          return agentType;
        }
      }

      // Check regex patterns
      for (const regex of patterns.startupRegexPatterns) {
        if (regex.test(output)) {
          return agentType;
        }
      }
    }

    return null;
  }

  /**
   * Check if output indicates agent activity
   * @param output Terminal output
   * @param agentType Agent type to check (optional, checks all if not specified)
   * @returns True if output indicates agent activity
   */
  public isAgentActivity(output: string, agentType?: AgentType): boolean {
    // Check specific agent type if provided
    if (agentType) {
      const patterns = this.agentPatterns.get(agentType);
      if (patterns) {
        return patterns.activityKeywords.some((keyword) => this.containsKeyword(output, keyword));
      }
    }

    // Check all agent types
    for (const patterns of this.agentPatterns.values()) {
      const hasKeyword = patterns.activityKeywords.some((keyword) =>
        this.containsKeyword(output, keyword)
      );
      if (hasKeyword) {
        return true;
      }
    }

    return false;
  }

  private containsKeyword(output: string, keyword: string): boolean {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    return pattern.test(output);
  }

  /**
   * Check if line matches shell prompt pattern
   * @param line Cleaned terminal line
   * @returns True if line is a shell prompt
   */
  public isShellPrompt(line: string): boolean {
    if (!line || line.trim().length === 0) {
      return false;
    }

    // Skip lines that are too long
    if (line.length > 100) {
      return false;
    }

    // Check against standard shell prompt patterns
    return this.shellPromptPatterns.standard.some((pattern) => pattern.test(line));
  }

  /**
   * Check if line matches termination pattern for any agent
   * @param line Cleaned terminal line
   * @param agentType Agent type to check (optional, checks all if not specified)
   * @returns True if line indicates termination
   */
  public isTerminationPattern(line: string, agentType?: AgentType): boolean {
    const lowerLine = line.toLowerCase().trim();

    // Check explicit termination messages
    if (
      this.shellPromptPatterns.explicitTermination.some((pattern) =>
        lowerLine.includes(pattern.toLowerCase())
      )
    ) {
      return true;
    }

    // Check process completion
    if (
      this.shellPromptPatterns.processCompletion.some(
        (pattern) => lowerLine === pattern.toLowerCase()
      )
    ) {
      return true;
    }

    // Check crash indicators
    if (
      this.shellPromptPatterns.crashIndicators.some((pattern) =>
        lowerLine.includes(pattern.toLowerCase())
      )
    ) {
      return true;
    }

    // Check agent-specific termination patterns
    const patterns = agentType
      ? [this.agentPatterns.get(agentType)].filter(Boolean)
      : Array.from(this.agentPatterns.values());

    for (const pattern of patterns) {
      if (!pattern) continue;

      // Check string patterns
      if (pattern.terminationPatterns.some((p) => lowerLine.includes(p.toLowerCase()))) {
        return true;
      }

      // Check regex patterns
      if (pattern.terminationRegexPatterns.some((regex) => regex.test(line))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clean ANSI escape sequences from terminal data
   * @param text Raw terminal text
   * @returns Cleaned text
   */
  public cleanAnsiEscapeSequences(text: string): string {
    return (
      text
        // Basic ANSI escape sequences (colors, cursor movement, etc.)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        // OSC sequences (window title setting, etc.)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
        // Escape sequence terminator
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\\/g, '')
        // Remove carriage return
        .replace(/\r/g, '')
        // Private mode setting
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\?[0-9]*[hl]/g, '')
        // Application/normal keypad mode
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b[=>]/g, '')
        // Remove control characters
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim()
    );
  }
}
