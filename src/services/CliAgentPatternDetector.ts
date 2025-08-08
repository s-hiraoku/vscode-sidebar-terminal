import { ICliAgentPatternDetector } from '../interfaces/CliAgentService';
import { terminal as log } from '../utils/logger';

/**
 * Responsible for detecting CLI agent startup and shell prompt patterns in terminal output
 */
export class CliAgentPatternDetector implements ICliAgentPatternDetector {
  /**
   * Detect Claude Code startup patterns
   */
  detectClaudeStartup(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase();

    // 🚨 FIXED: Exclude only specific non-startup messages with more precise patterns
    if (
      line.includes('claude may read') || // Permission messages
      line.includes('documentation is available at') || // URL references
      line.includes('configuration files are located') // Configuration paths
    ) {
      return false;
    }

    return (
      cleanLine.includes('Welcome to Claude Code!') ||
      cleanLine.includes('> Try "edit <filepath>') ||
      cleanLine.includes("I'm Claude") ||
      cleanLine.includes('I am Claude') ||
      cleanLine.includes('Powered by Claude') ||
      cleanLine.includes('CLI tool for Claude') ||
      // More specific startup patterns only
      (line.includes('claude') && (line.includes('starting') || line.includes('initializing'))) ||
      (line.includes('claude') && line.includes('ready')) ||
      (line.includes('anthropic') && line.includes('claude')) ||
      (line.includes('claude code') &&
        (line.includes('starting') || line.includes('launched') || line.includes('welcome'))) ||
      // Model-specific patterns - only if in startup context
      (line.includes('claude sonnet') &&
        (line.includes('ready') || line.includes('initialized') || line.includes('starting'))) ||
      (line.includes('claude opus') &&
        (line.includes('ready') || line.includes('initialized') || line.includes('starting'))) ||
      (line.includes('claude haiku') &&
        (line.includes('ready') || line.includes('initialized') || line.includes('starting'))) ||
      // Model-specific patterns
      line.includes('claude-3') ||
      line.includes('claude 3') ||
      (line.includes('anthropic') && line.includes('assistant')) ||
      // Generic activation patterns
      (line.includes('claude') &&
        (line.includes('activated') ||
          line.includes('connected') ||
          line.includes('ready') ||
          line.includes('started') ||
          line.includes('available') ||
          line.includes('launched') ||
          line.includes('initialized')))
    );
  }

  /**
   * Detect Gemini CLI startup patterns
   */
  detectGeminiStartup(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase();

    // 🚨 FIXED: Exclude only specific update notifications with more precise patterns
    if (
      line.includes('update available:') || // Update notifications with colon
      (line.includes('version') && line.includes('available!')) || // Version updates
      line.includes('new model is available') // Model availability announcements
    ) {
      return false;
    }

    if (line.includes('gemini')) {
      // Specific startup context indicators only
      if (
        (line.includes('gemini cli') && (line.includes('starting') || line.includes('launched'))) ||
        (line.includes('gemini') && line.includes('cli') && line.includes('ready')) ||
        (line.includes('google') && line.includes('gemini') && line.includes('initialized')) ||
        (line.includes('gemini') && line.includes('activated')) ||
        (line.includes('gemini') && line.includes('connected') && line.includes('ready')) ||
        (line.includes('gemini') && line.includes('started') && !line.includes('error')) ||
        (line.includes('welcome') && line.includes('gemini')) ||
        (line.includes('gemini') && line.includes('initialized')) ||
        (line.includes('gemini') && line.includes('launching')) ||
        (line.includes('gemini') && line.includes('loading') && !line.includes('error'))
      ) {
        return true;
      }
    }

    // Specific Gemini CLI output patterns (enhanced)
    return (
      // Version patterns
      line.includes('gemini-2.5-pro') ||
      line.includes('gemini-1.5-pro') ||
      line.includes('gemini-pro') ||
      line.includes('gemini flash') ||
      // File and documentation patterns
      line.includes('gemini.md') ||
      line.includes('tips for getting started') ||
      // Company/service patterns
      line.includes('google ai') ||
      line.includes('google generative ai') ||
      line.includes('gemini api') ||
      line.includes('ai studio') ||
      line.includes('vertex ai') ||
      // Prompt patterns
      line.includes('gemini>') ||
      line.includes('gemini $') ||
      line.includes('gemini #') ||
      line.includes('gemini:') ||
      // Banner patterns (enhanced)
      (line.includes('█') && line.includes('gemini')) ||
      (line.includes('*') && line.includes('gemini') && line.includes('*')) ||
      (line.includes('=') && line.includes('gemini') && line.includes('=')) ||
      // Command execution confirmation
      line.includes('gemini --help') ||
      line.includes('gemini chat') ||
      line.includes('gemini code') ||
      line.includes('gemini repl') ||
      line.includes('gemini interactive') ||
      // Startup messages
      line.includes('gemini cli starting') ||
      line.includes('gemini session started') ||
      line.includes('connecting to gemini') ||
      line.includes('gemini model loaded') ||
      // Authentication patterns
      line.includes('gemini authenticated') ||
      line.includes('gemini login successful') ||
      // Additional model patterns
      line.includes('using gemini') ||
      (line.includes('model:') && line.includes('gemini')) ||
      // Enhanced simple patterns
      line.includes('gemini-exp') ||
      line.includes('gemini experimental') ||
      line.includes('gemini-thinking') ||
      // Common startup indicators
      (line.includes('google') && line.includes('ai') && line.includes('gemini')) ||
      // Direct command execution patterns
      line.startsWith('gemini ') ||
      line.startsWith('gemini>') ||
      line.includes('> gemini') ||
      line.includes('$ gemini')
    );
  }

  /**
   * Detect shell prompt return after CLI agent exits
   */
  detectShellPrompt(cleanLine: string): boolean {
    // Look for common shell prompt patterns that appear after CLI tools exit
    const shellPromptPatterns = [
      // Very specific patterns first
      // Standard bash/zsh prompts with username@hostname
      /^[\w.-]+@[\w.-]+:.*[$%]\s*$/,
      /^[\w.-]+@[\w.-]+\s+.*[$%#>]\s*$/,

      // Oh My Zsh themes with symbols
      /^➜\s+[\w.-]+/,
      /^[➜▶⚡]\s+[\w.-]+/,

      // Starship prompt variations
      /^❯\s*$/,
      /^❯\s+.*$/,

      // Simple shell prompts
      /^[$%#>]\s*$/,
      /^\$\s*$/,
      /^%\s*$/,
      /^#\s*$/,
      /^>\s*$/,

      // PowerShell patterns
      /^PS\s+.*>/,

      // Fish shell patterns
      /^[\w.-]+\s+[\w/~]+>\s*$/,

      // Box drawing character prompts (Oh-My-Zsh themes)
      /^[╭┌]─[\w.-]+@[\w.-]+/,

      // Python/conda environment prompts
      /^\([\w.-]+\)\s+.*[$%#>]\s*$/,

      // More flexible patterns for various shell configurations
      /^[\w.-]+:\s*.*[$%#>]\s*$/,
      /^\w+\s+.*[$%#>]\s*$/,
      /^.*@.*:\s*.*\$\s*$/,

      // Very broad fallback patterns (order matters - these come last)
      /.*[$%]$/,
      /.*#$/,
      /.*>$/,

      // Terminal-specific patterns that might indicate CLI tool exit
      /^Last login:/,
      /^.*logout.*$/i,
      /^.*session.*ended.*$/i,

      // Even more generic - any line that looks like a prompt (DANGEROUS but necessary)
      /^[^\s]+[$%#>]\s*$/,
      /^[^\s]+\s+[^\s]+[$%#>]\s*$/,
    ];

    // 🚨 CRITICAL DEBUG: Log ALL non-empty lines to understand actual terminal output
    if (cleanLine.trim().length > 0) {
      log(`🔍 [SHELL-PROMPT-DEBUG] Processing line: "${cleanLine}" (length: ${cleanLine.length})`);

      // Show which patterns this line is being tested against
      if (
        cleanLine.includes('$') ||
        cleanLine.includes('%') ||
        cleanLine.includes('#') ||
        cleanLine.includes('>')
      ) {
        log(`🔍 [SHELL-PROMPT-DEBUG] Line contains prompt symbols: $ % # >`);
      }
    }

    const matched = shellPromptPatterns.some((pattern, index) => {
      const result = pattern.test(cleanLine);
      if (result) {
        log(`✅ [SHELL-PROMPT] Pattern ${index} matched: ${pattern} for line: "${cleanLine}"`);
      }
      return result;
    });

    if (matched) {
      log(`✅ [SHELL-PROMPT] TERMINATION DETECTED: "${cleanLine}"`);
    } else if (cleanLine.trim().length > 0 && cleanLine.trim().length < 200) {
      log(`❌ [SHELL-PROMPT] NO MATCH: "${cleanLine}"`);
    }

    return matched;
  }

  /**
   * Clean ANSI escape sequences from terminal data
   */
  cleanAnsiEscapeSequences(text: string): string {
    return (
      text
        // 基本的なANSIエスケープシーケンス（色、カーソル移動等）
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        // OSCシーケンス（ウィンドウタイトル設定等）
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\][0-9];[^\x07]*\x07/g, '')
        // エスケープシーケンス終了
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\\/g, '')
        // キャリッジリターン除去
        .replace(/\r/g, '')
        // プライベートモード設定
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\?[0-9]*[hl]/g, '')
        // アプリケーション/通常キーパッド
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b[=>]/g, '')
        // 制御文字を除去
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim()
    );
  }
}