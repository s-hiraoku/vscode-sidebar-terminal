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
  startupPatterns?: string[];

  /** Regex patterns for startup detection (case-insensitive) */
  startupRegexPatterns?: RegExp[];

  /** Keywords that indicate agent activity */
  activityKeywords: string[];

  /** Patterns that indicate explicit agent termination */
  terminationPatterns: string[];

  /** Regex patterns for termination detection */
  terminationRegexPatterns: RegExp[];

  /** Patterns that indicate agent is waiting for user input or approval */
  waitingPatterns?: WaitingPatternDefinition;
}

/**
 * Waiting pattern definitions for detecting when an agent is idle
 */
export interface WaitingPatternDefinition {
  /** Regex patterns for input prompt detection */
  inputPromptRegexPatterns?: RegExp[];
  /** Regex patterns for tool approval prompt detection */
  toolApprovalRegexPatterns?: RegExp[];
}

/**
 * Result of a waiting pattern match
 */
export interface WaitingPatternMatch {
  /** Type of waiting detected */
  waitingType: 'input' | 'approval';
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
      startupPatterns: ['Welcome to Claude Code!', 'Tips for getting started'],
      startupRegexPatterns: [
        // Allow "ClaudeCode" as some TUIs can lose the visible whitespace after ANSI stripping.
        /Claude\s*Code/i,
      ],
      activityKeywords: ['claude', 'anthropic'],
      terminationPatterns: ['[Process completed]'],
      terminationRegexPatterns: [/\[Process completed\]/i, /\[process exited with code \d+\]/i],
      waitingPatterns: {
        inputPromptRegexPatterns: [
          // Claude's waiting prompt can include inline hint text or terminal-mode residue.
          /^❯(?:\s+.*)?$/,
        ],
        toolApprovalRegexPatterns: [
          /Allow\s+(once|always)\?/i,
          /needs your permission/i,
          /\(Y\/n\)/,
          /\(y\/N\)/,
          /\(y\/n\/always\)/i,
        ],
      },
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
        'gemini mcp',
        'gemini skills',
        'gemini extensions',
        'gemini hooks',
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
        /gemini\s+(?:mcp|skills|extensions|hooks)/i,
      ],
      activityKeywords: ['gemini', 'google', 'google ai'],
      terminationPatterns: ['Agent powering down. Goodbye!'],
      terminationRegexPatterns: [/Agent powering down\.\s*Goodbye!/i],
      waitingPatterns: {
        inputPromptRegexPatterns: [/^gemini\s*>\s*$/i],
        toolApprovalRegexPatterns: [
          /Do you approve/i,
          /Allow\s+command/i,
          /Approve\?\s*\(/i,
          /Proceed\s+(Once|Always)/i,
          /\[y\/N\]/,
          /\(y\/n\/always\)/i,
        ],
      },
    });

    // OpenAI Codex patterns
    patterns.set('codex', {
      type: 'codex',
      commandPrefixes: ['codex ', 'codex'],
      startupPatterns: ['OpenAI Codex'],
      startupRegexPatterns: [/OpenAI\s+Codex/i],
      activityKeywords: ['codex', 'openai'],
      terminationPatterns: [],
      terminationRegexPatterns: [/\[process exited with code \d+\]/i],
      waitingPatterns: {
        inputPromptRegexPatterns: [/^codex\s*>\s*$/i],
        toolApprovalRegexPatterns: [
          /ask me to approve/i,
          /\[y\/N\]/,
          /\(Y\/n\)/,
        ],
      },
    });

    // GitHub Copilot CLI patterns
    patterns.set('copilot', {
      type: 'copilot',
      commandPrefixes: ['copilot ', 'copilot', 'gh copilot'],
      startupPatterns: ['Welcome to GitHub Copilot CLI'],
      startupRegexPatterns: [/GitHub\s+Copilot/i],
      activityKeywords: ['copilot', 'github'],
      terminationPatterns: [],
      terminationRegexPatterns: [/\[process exited with code \d+\]/i],
      waitingPatterns: {
        inputPromptRegexPatterns: [/^copilot\s*>\s*$/i],
        toolApprovalRegexPatterns: [
          /Yes,\s+proceed/i,
          /Yes,\s+and\s+(remember|approve)/i,
          /\[y\/N\]/,
          /\(Y\/n\)/,
        ],
      },
    });

    // OpenCode patterns
    patterns.set('opencode', {
      type: 'opencode',
      commandPrefixes: ['opencode ', 'opencode'],
      startupPatterns: [],
      startupRegexPatterns: [
        /OpenCode\s+(?:Zen|Base)/i,
      ],
      activityKeywords: ['opencode', 'open code'],
      terminationPatterns: [],
      terminationRegexPatterns: [/\[process exited with code \d+\]/i],
      waitingPatterns: {
        inputPromptRegexPatterns: [/^opencode\s*>\s*$/i],
        toolApprovalRegexPatterns: [],
      },
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
      processCompletion: [],
      explicitTermination: [
        '[process completed]',
        '[process exited',
        'agent powering down',
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
        'stack overflow',
        'out of memory',
        'terminated unexpectedly',
        'crashed',
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
      for (const pattern of patterns.startupPatterns ?? []) {
        if (output.includes(pattern)) {
          return agentType;
        }
      }

      // Check regex patterns
      for (const regex of patterns.startupRegexPatterns ?? []) {
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
   * Match output against waiting patterns for a specific agent type
   * @param agentType Agent type to check
   * @param output Cleaned terminal output
   * @returns Waiting pattern match or null
   */
  public matchWaitingPattern(agentType: AgentType, output: string): WaitingPatternMatch | null {
    if (!output || !output.trim()) {
      return null;
    }

    const patterns = this.agentPatterns.get(agentType);
    if (!patterns?.waitingPatterns) {
      return null;
    }

    const { waitingPatterns } = patterns;
    const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);

    // Check each line against approval patterns first (more specific)
    for (const line of lines) {
      if (waitingPatterns.toolApprovalRegexPatterns) {
        for (const regex of waitingPatterns.toolApprovalRegexPatterns) {
          if (regex.test(line)) {
            return { waitingType: 'approval' };
          }
        }
      }
    }

    // Input waiting should be determined by the latest rendered line only.
    // Older prompt lines can remain in a buffered redraw while the agent is actively working.
    const lastLine = lines.at(-1);
    if (lastLine && waitingPatterns.inputPromptRegexPatterns) {
      for (const regex of waitingPatterns.inputPromptRegexPatterns) {
        if (regex.test(lastLine)) {
          return { waitingType: 'input' };
        }
      }
    }

    return null;
  }

  /**
   * Get waiting patterns for a specific agent type
   * @param agentType Agent type
   * @returns Waiting pattern definition or undefined
   */
  public getWaitingPatterns(agentType: AgentType): WaitingPatternDefinition | undefined {
    return this.agentPatterns.get(agentType)?.waitingPatterns;
  }

  /**
   * Clean ANSI escape sequences from terminal data
   * @param text Raw terminal text
   * @returns Cleaned text
   */
  public cleanAnsiEscapeSequences(text: string): string {
    return (
      text
        // CSI sequences (colors, cursor, private modes)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        // OSC sequences terminated by BEL (multi-digit parameter support)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\][0-9;]*[^\x07]*\x07/g, '')
        // OSC sequences terminated by ST (ESC \)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\][0-9;]*[^\x1b]*\x1b\\/g, '')
        // Remaining lone ESC sequences (SS3, DCS, APC, keypad modes)
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b[^[\]]/g, '')
        // Remove carriage return
        .replace(/\r/g, '')
        // Remove control characters but preserve newlines for line-based matching
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
        .trim()
    );
  }
}
