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

    // 🔧 FIXED: More specific exclusion patterns to avoid false positives
    if (
      line.includes('claude may read') || // Permission messages
      line.includes('documentation is available at') || // URL references
      line.includes('configuration files are located') || // Configuration paths
      line.includes('error:') || // Error messages
      line.includes('warning:') || // Warning messages
      line.includes('failed') || // Failure messages
      line.includes('cannot') || // Cannot messages
      line.includes('unable') || // Unable messages
      line.includes('not found') || // Not found messages
      (line.includes('available') && !line.includes('claude') && !line.includes('now')) // Generic availability messages
    ) {
      return false;
    }

    // Check for very specific startup patterns first
    if (
      cleanLine.includes('Welcome to Claude Code!') ||
      cleanLine.includes('> Try "edit <filepath>') ||
      cleanLine.includes("I'm Claude") ||
      cleanLine.includes('I am Claude') ||
      cleanLine.includes('Powered by Claude') ||
      cleanLine.includes('CLI tool for Claude') ||
      cleanLine.includes('Claude Code is ready') ||
      cleanLine.includes('Claude assistant initialized') ||
      cleanLine.includes('Starting Claude Code session') ||
      // More common actual Claude Code outputs
      cleanLine.includes('claude --help') ||
      cleanLine.includes('claude --version') ||
      cleanLine.includes('Usage: claude') ||
      (cleanLine.includes('claude') && cleanLine.includes('Available commands')) ||
      (cleanLine.includes('claude') && cleanLine.includes('Options:'))
    ) {
      return true;
    }

    // Model-specific startup patterns (more restrictive)
    if (
      (line.includes('claude-3-sonnet') &&
        (line.includes('ready') || line.includes('initialized'))) ||
      (line.includes('claude-3-opus') &&
        (line.includes('ready') || line.includes('initialized'))) ||
      (line.includes('claude-3-haiku') &&
        (line.includes('ready') || line.includes('initialized'))) ||
      (line.includes('claude sonnet 4') &&
        (line.includes('ready') || line.includes('initialized'))) ||
      (line.includes('claude opus 4') && (line.includes('ready') || line.includes('initialized')))
    ) {
      return true;
    }

    // Very specific combined patterns that indicate startup
    if (line.includes('claude')) {
      if (
        (line.includes('starting') && line.includes('session')) ||
        (line.includes('initializing') && (line.includes('assistant') || line.includes('model'))) ||
        (line.includes('connected') && line.includes('successfully')) ||
        (line.includes('launched') && (line.includes('successfully') || line.includes('code'))) ||
        (line.includes('ready') && (line.includes('assistant') || line.includes('help'))) ||
        (line.includes('activated') && line.includes('mode')) ||
        // More common interactive patterns
        line.includes('how can i help') ||
        line.includes('how may i help') ||
        (line.includes('what would you like') && line.includes('help')) ||
        line.includes('claude >') ||
        line.includes('claude:')
      ) {
        return true;
      }
    }

    // Anthropic-specific patterns
    if (
      line.includes('anthropic') &&
      line.includes('claude') &&
      (line.includes('assistant') || line.includes('model') || line.includes('ready'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Detect Gemini CLI startup patterns
   */
  detectGeminiStartup(cleanLine: string): boolean {
    const line = cleanLine.toLowerCase();

    // 🔧 FIXED: More specific exclusion patterns to avoid false positives
    if (
      line.includes('update available:') || // Update notifications
      (line.includes('version') && line.includes('available!')) || // Version updates
      line.includes('new model is available') || // Model availability
      line.includes('error:') || // Error messages
      line.includes('warning:') || // Warning messages
      line.includes('failed') || // Failure messages
      line.includes('cannot') || // Cannot messages
      line.includes('unable') || // Unable messages
      line.includes('not found') || // Not found messages
      (line.includes('available') && !line.includes('gemini') && !line.includes('now')) // Generic availability
    ) {
      return false;
    }

    // Check for very specific startup patterns first
    if (
      cleanLine.includes('Welcome to Gemini') ||
      cleanLine.includes('Gemini CLI started') ||
      cleanLine.includes('Google Gemini is ready') ||
      cleanLine.includes('Gemini Code assistant') ||
      cleanLine.includes('Starting Gemini session') ||
      cleanLine.includes('Gemini model initialized') ||
      // 🔧 FIX: Add patterns from actual log output
      (cleanLine.includes('You are running Gemini CLI') && cleanLine.includes('directory')) ||
      cleanLine.includes('Type your message or @path/to/file') ||
      // More common actual Gemini CLI outputs
      cleanLine.includes('gemini --help') ||
      cleanLine.includes('gemini --version') ||
      cleanLine.includes('Usage: gemini') ||
      (cleanLine.includes('gemini') && cleanLine.includes('Available commands')) ||
      (cleanLine.includes('gemini') && cleanLine.includes('Options:')) ||
      // Interactive patterns when Gemini starts
      (cleanLine.includes('gemini') && cleanLine.includes('how can i help')) ||
      (cleanLine.includes('gemini') && cleanLine.includes('what would you like')) ||
      cleanLine.includes('gemini >') ||
      cleanLine.includes('gemini:') ||
      // More basic command patterns
      cleanLine.startsWith('gemini ') ||
      cleanLine === 'gemini' || // 🔧 FIX: Support simple 'gemini' command
      /^gemini\s+/.test(cleanLine) ||
      // Common Gemini interactive prompts
      (line.includes('gemini') && (line.includes('hello') || line.includes('hi there'))) ||
      // Google AI specific patterns
      (line.includes('google') && line.includes('gemini') && line.includes('chat'))
    ) {
      return true;
    }

    // Very specific combined patterns that indicate startup
    if (line.includes('gemini')) {
      // Check for startup context
      if (
        (line.includes('cli') &&
          (line.includes('starting') || line.includes('launched') || line.includes('ready'))) ||
        (line.includes('google') && line.includes('initialized')) ||
        (line.includes('connected') && line.includes('successfully')) ||
        (line.includes('session') && (line.includes('started') || line.includes('ready'))) ||
        (line.includes('welcome') && !line.includes('back')) ||
        (line.includes('initialized') && (line.includes('model') || line.includes('assistant'))) ||
        (line.includes('launching') && !line.includes('error')) ||
        (line.includes('loading') && line.includes('model') && !line.includes('error'))
      ) {
        return true;
      }
    }

    // Model-specific patterns (more restrictive)
    if (
      line.includes('gemini-2.5-pro') || // 🔧 FIX: Detect gemini-2.5-pro without additional context
      line.includes('gemini-1.5-pro') || // 🔧 FIX: Detect gemini-1.5-pro without additional context
      line.includes('gemini-pro') || // 🔧 FIX: Detect gemini-pro without additional context
      line.includes('gemini flash') || // 🔧 FIX: Detect gemini flash without additional context
      line.includes('gemini-exp') || // 🔧 FIX: Detect experimental models
      (line.includes('gemini') && line.includes('context left')) // 🔧 FIX: Detect context display
    ) {
      return true;
    }

    // Very specific prompt patterns that indicate an active session
    if (
      /^gemini>\s*$/.test(cleanLine) ||
      /^gemini\s*\$\s*$/.test(cleanLine) ||
      /^gemini\s*#\s*$/.test(cleanLine) ||
      /^gemini:\s*$/.test(cleanLine)
    ) {
      return true;
    }

    // Google AI specific patterns
    if (
      (line.includes('google ai') || line.includes('google generative ai')) &&
      line.includes('gemini') &&
      (line.includes('ready') || line.includes('initialized') || line.includes('connected'))
    ) {
      return true;
    }

    // 🔧 FALLBACK: More lenient patterns for edge cases
    // These should catch cases where the above patterns miss legitimate Gemini usage
    if (line.includes('gemini')) {
      // Any line that starts with gemini command (very basic)
      if (/^gemini\s/.test(line) || line.trim() === 'gemini') {
        return true;
      }

      // Common interactive patterns that might indicate Gemini is starting
      if (
        line.includes('welcome') ||
        line.includes('hello') ||
        line.includes('ready') ||
        line.includes('help') ||
        line.includes('available') ||
        line.includes('starting')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect shell prompt return after CLI agent exits
   */
  detectShellPrompt(cleanLine: string): boolean {
    // 🔧 FIXED: More restrictive patterns to avoid false positives from AI agent output

    // Skip empty lines
    if (!cleanLine || cleanLine.trim().length === 0) {
      return false;
    }

    // Skip lines that are too long to be shell prompts (likely agent output)
    if (cleanLine.length > 100) {
      return false;
    }

    // Skip lines with certain keywords that indicate AI agent output
    // 🔧 FIXED: Don't filter out lines just because they contain 'claude' or 'gemini'
    // as these might be legitimate shell prompts or commands
    const agentOutputIndicators = [
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
    ];

    const lowerLine = cleanLine.toLowerCase();

    // More sophisticated filtering: only exclude if it looks like AI output
    if (agentOutputIndicators.some((indicator) => lowerLine.includes(indicator))) {
      return false;
    }

    // Special handling for claude/gemini keywords - only exclude if it looks like AI output
    if (
      (lowerLine.includes('claude') || lowerLine.includes('gemini')) &&
      (lowerLine.includes('thinking') ||
        lowerLine.includes('response') ||
        lowerLine.includes('help you') ||
        lowerLine.includes('i am') ||
        lowerLine.includes("i'm") ||
        lowerLine.includes('what would you'))
    ) {
      return false;
    }

    // Look for common shell prompt patterns that appear after CLI tools exit
    const shellPromptPatterns = [
      // Very specific patterns first
      // Standard bash/zsh prompts with username@hostname (strict)
      /^[\w.-]+@[\w.-]+:[~\/]?[\w\/.~-]*\$\s*$/,
      /^[\w.-]+@[\w.-]+\s+[~\/]?[\w\/.~-]*[$%#]\s*$/,

      // Oh My Zsh themes with symbols (strict)
      /^➜\s+[~\/]?[\w\/.~-]*\s*$/,
      /^[➜▶⚡]\s+[~\/]?[\w\/.~-]*\s*$/,

      // Starship prompt variations (exact)
      /^❯\s*$/,
      /^❯\s+\[.*?\].*$/, // 🔧 FIX: Handle Starship with ANSI sequences like "❯ [?2004h"

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

      // 🔧 MORE FLEXIBLE patterns for basic shell prompts
      // These are more likely to catch real shell prompts after agent exit
      /^\w+\$\s*$/, // Simple word followed by $
      /^\w+%\s*$/, // Simple word followed by %
      /^\w+#\s*$/, // Simple word followed by # (root)
      /^[\w-]+:\s*.*\$\s*$/, // hostname: path$
      /^.*@.*:\s*.*\$\s*$/, // user@host: path$

      // Terminal-specific patterns that might indicate CLI tool exit
      /^Last login:/,
      /^logout$/i,
      // 🔧 REMOVED: /^exit$/i - Too generic, causes false positives when user types "exit"
      /^Connection to .* closed\.$/,
      /^Session terminated\.$/i,
    ];

    const matched = shellPromptPatterns.some((pattern, index) => {
      const result = pattern.test(cleanLine);
      if (result) {
        log(`✅ [SHELL-PROMPT] Pattern ${index} matched: ${pattern} for line: "${cleanLine}"`);
      }
      return result;
    });

    if (matched) {
      log(`✅ [SHELL-PROMPT] Shell prompt detected (potential termination): "${cleanLine}"`);
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
