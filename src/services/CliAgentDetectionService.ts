/**
 * Comprehensive CLI Agent Detection Service
 *
 * Extracted from TerminalManager to follow Single Responsibility Principle.
 * Handles all CLI Agent detection, state management, and termination logic.
 */

import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';
import {
  ICliAgentDetectionService,
  ICliAgentPatternDetector,
  ICliAgentStateManager,
  ICliAgentDetectionConfig,
  CliAgentDetectionResult,
  TerminationDetectionResult,
  CliAgentState,
  DisconnectedAgentInfo,
  DetectionCacheEntry,
  DetectionConfig,
} from '../interfaces/CliAgentService';

/**
 * CLI Agent Pattern Detection Implementation
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

/**
 * CLI Agent State Manager Implementation
 */
export class CliAgentStateManager implements ICliAgentStateManager {
  private _connectedAgentTerminalId: string | null = null;
  private _connectedAgentType: 'claude' | 'gemini' | null = null;
  private _disconnectedAgents = new Map<string, DisconnectedAgentInfo>();

  private readonly _onStatusChange = new vscode.EventEmitter<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }>();

  setConnectedAgent(terminalId: string, type: 'claude' | 'gemini', terminalName?: string): void {
    // 🚨 FIX: Prevent unnecessary state changes for already connected agent
    if (this._connectedAgentTerminalId === terminalId && this._connectedAgentType === type) {
      log(
        `ℹ️ [STATE-MANAGER] Agent ${type} in terminal ${terminalId} is already CONNECTED, skipping state change`
      );
      return;
    }

    // Handle previous connected agent
    const previousConnectedId = this._connectedAgentTerminalId;
    const previousType = this._connectedAgentType;

    // Set new connected agent
    this._connectedAgentTerminalId = terminalId;
    this._connectedAgentType = type;

    // Remove from disconnected if it was there
    this._disconnectedAgents.delete(terminalId);

    // Move previous connected agent to disconnected (only if different terminal)
    if (previousConnectedId && previousConnectedId !== terminalId && previousType) {
      this._disconnectedAgents.set(previousConnectedId, {
        type: previousType,
        startTime: new Date(),
        terminalName,
      });

      this._onStatusChange.fire({
        terminalId: previousConnectedId,
        status: 'disconnected',
        type: previousType,
        terminalName,
      });

      log(
        `📝 [STATE-MANAGER] Moved previous CONNECTED terminal ${previousConnectedId} to DISCONNECTED tracking`
      );
    }

    // Emit connected event for new agent
    this._onStatusChange.fire({
      terminalId,
      status: 'connected',
      type,
      terminalName,
    });

    log(
      `🎯 [STATE-MANAGER] Set terminal ${terminalId} as CONNECTED (${type}). DISCONNECTED agents: ${this._disconnectedAgents.size}`
    );
  }

  setAgentTerminated(terminalId: string): void {
    if (this._connectedAgentTerminalId === terminalId) {
      const agentType = this._connectedAgentType;

      // Clear the connected agent
      this._connectedAgentTerminalId = null;
      this._connectedAgentType = null;

      // Fire status change to 'none' for the terminated agent
      this._onStatusChange.fire({
        terminalId,
        status: 'none',
        type: null,
      });

      log(`[CLI Agent] ${agentType} agent terminated in terminal: ${terminalId}`);

      // Promote latest disconnected agent
      this.promoteLatestDisconnectedAgent();
    } else if (this._disconnectedAgents.has(terminalId)) {
      // DISCONNECTED agent terminated - just remove from tracking
      const agentInfo = this._disconnectedAgents.get(terminalId);
      this._disconnectedAgents.delete(terminalId);

      // Fire status change to 'none'
      this._onStatusChange.fire({
        terminalId,
        status: 'none',
        type: null,
      });

      log(
        `🗑️ [STATE-MANAGER] DISCONNECTED agent ${agentInfo?.type} terminated in terminal: ${terminalId}`
      );
    }
  }

  promoteLatestDisconnectedAgent(): void {
    if (this._disconnectedAgents.size === 0) {
      log('ℹ️ [AUTO-PROMOTION] No DISCONNECTED agents to promote');
      return;
    }

    // Find the most recently started DISCONNECTED agent
    let latestAgent: {
      terminalId: string;
      info: DisconnectedAgentInfo;
    } | null = null;

    for (const [terminalId, info] of this._disconnectedAgents.entries()) {
      if (!latestAgent || info.startTime > latestAgent.info.startTime) {
        latestAgent = { terminalId, info };
      }
    }

    if (latestAgent) {
      const { terminalId, info } = latestAgent;

      // Remove from disconnected tracking
      this._disconnectedAgents.delete(terminalId);

      // Set as new CONNECTED agent
      this._connectedAgentTerminalId = terminalId;
      this._connectedAgentType = info.type;

      // Fire status change to 'connected'
      this._onStatusChange.fire({
        terminalId,
        status: 'connected',
        type: info.type,
        terminalName: info.terminalName,
      });

      log(
        `🚀 [AUTO-PROMOTION] Promoted terminal ${terminalId} (${info.type}) from DISCONNECTED to CONNECTED (specification compliance)`
      );
      log(`📊 [AUTO-PROMOTION] Remaining DISCONNECTED agents: ${this._disconnectedAgents.size}`);
    }
  }

  getConnectedAgentTerminalId(): string | null {
    return this._connectedAgentTerminalId;
  }

  getConnectedAgentType(): 'claude' | 'gemini' | null {
    return this._connectedAgentType;
  }

  isAgentConnected(terminalId: string): boolean {
    return this._connectedAgentTerminalId === terminalId;
  }

  clearAllState(): void {
    this._connectedAgentTerminalId = null;
    this._connectedAgentType = null;
    this._disconnectedAgents.clear();
  }

  getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return new Map(this._disconnectedAgents);
  }

  get onStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this._onStatusChange.event;
  }

  dispose(): void {
    this.clearAllState();
    this._onStatusChange.dispose();
  }

  /**
   * 🚨 NEW: Heartbeat mechanism to validate connected agent state
   * This helps prevent state loss during extended usage
   */
  validateConnectedAgentState(): void {
    if (!this._connectedAgentTerminalId) {
      return; // No connected agent to validate
    }

    const terminalId = this._connectedAgentTerminalId;
    const agentType = this._connectedAgentType;

    log(`💓 [HEARTBEAT] Validating connected agent state: terminal ${terminalId} (${agentType})`);

    // For now, we just log the validation
    // In the future, this could include more sophisticated checks
    // like checking if the terminal process is still alive
  }

  /**
   * 🚨 NEW: Force refresh connected agent state
   * This can be used as fallback when file reference fails
   */
  refreshConnectedAgentState(): boolean {
    const disconnectedAgents = this._disconnectedAgents;

    if (disconnectedAgents.size > 0) {
      log(
        `🔄 [REFRESH] Attempting to refresh state from ${disconnectedAgents.size} disconnected agents`
      );

      // Try to promote the most recent disconnected agent if no connected agent exists
      if (!this._connectedAgentTerminalId) {
        this.promoteLatestDisconnectedAgent();
        return this._connectedAgentTerminalId !== null;
      }
    }

    return this._connectedAgentTerminalId !== null;
  }
}

/**
 * CLI Agent Detection Configuration Implementation
 */
export class CliAgentDetectionConfig implements ICliAgentDetectionConfig {
  private config: DetectionConfig = {
    debounceMs: 25,
    cacheTtlMs: 1000,
    maxBufferSize: 50,
    skipMinimalData: true,
  };

  getConfig(): DetectionConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * LRU Cache Implementation for Detection Cache
 */
class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove old entry if exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add new entry
    this.cache.set(key, value);

    // Remove least recently used if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Main CLI Agent Detection Service Implementation
 */
export class CliAgentDetectionService implements ICliAgentDetectionService {
  private readonly patternDetector: ICliAgentPatternDetector;
  private readonly stateManager: ICliAgentStateManager;
  private readonly configManager: ICliAgentDetectionConfig;

  // Detection cache with LRU eviction
  private readonly detectionCache: LRUCache<string, DetectionCacheEntry>;

  constructor(
    patternDetector?: ICliAgentPatternDetector,
    stateManager?: ICliAgentStateManager,
    configManager?: ICliAgentDetectionConfig
  ) {
    this.patternDetector = patternDetector || new CliAgentPatternDetector();
    this.stateManager = stateManager || new CliAgentStateManager();
    this.configManager = configManager || new CliAgentDetectionConfig();

    // Initialize LRU cache with reasonable size limit
    this.detectionCache = new LRUCache<string, DetectionCacheEntry>(50);
  }

  // =================== Detection Methods ===================

  detectFromInput(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      // Check for enter key to process command
      if (data.includes('\r') || data.includes('\n')) {
        const command = data
          .replace(/[\r\n]/g, '')
          .trim()
          .toLowerCase();

        // Enhanced startup detection for both Claude and Gemini
        if (
          command.startsWith('claude') ||
          command.startsWith('gemini') ||
          command.includes('claude-code') ||
          command.includes('claude code') ||
          command.includes('gemini code') ||
          command.includes('gemini-code') ||
          // Additional common CLI patterns
          command.includes('/claude') ||
          command.includes('/gemini') ||
          command.includes('./claude') ||
          command.includes('./gemini') ||
          command.includes('npx claude') ||
          command.includes('npx gemini') ||
          // Python execution patterns
          command.includes('python claude') ||
          command.includes('python gemini') ||
          command.includes('python -m claude') ||
          command.includes('python -m gemini') ||
          // Node execution patterns
          command.includes('node claude') ||
          command.includes('node gemini')
        ) {
          let agentType: 'claude' | 'gemini';

          if (command.includes('claude') || command.includes('claude-code')) {
            agentType = 'claude';
          } else {
            agentType = 'gemini';
          }

          log(
            `🚀 [CLI-AGENT] ${agentType} startup command detected from input: "${command}" in terminal ${terminalId}`
          );

          return {
            type: agentType,
            confidence: 1.0,
            source: 'input',
            detectedLine: command,
          };
        }

        // Check for termination commands
        if (this.stateManager.isAgentConnected(terminalId)) {
          const isExitCommand = this.isExitCommand(command);
          if (isExitCommand) {
            log(
              `🔍 [CLI-AGENT] Exit command detected from user input: "${command}" in terminal ${terminalId}`
            );
            // Note: We don't return a detection result here because termination
            // should be detected from output, not input
          }
        }
      }
    } catch (error) {
      log('ERROR: CLI Agent input detection failed:', error);
    }

    return null;
  }

  detectFromOutput(terminalId: string, data: string): CliAgentDetectionResult | null {
    const config = this.configManager.getConfig();

    // Optimization: Only apply debouncing for non-connected terminals
    const isConnectedTerminal = this.stateManager.isAgentConnected(terminalId);

    if (!isConnectedTerminal) {
      // Apply debouncing and caching for non-connected terminals
      const now = Date.now();
      const cacheEntry = this.detectionCache.get(terminalId);

      if (cacheEntry) {
        // Check if we need to debounce
        if (now - cacheEntry.timestamp < config.debounceMs) {
          return null; // Skip detection due to debounce
        }

        // Check if data is identical to previous (avoid reprocessing)
        if (cacheEntry.lastData === data) {
          this.detectionCache.set(terminalId, { lastData: data, timestamp: now });
          return null; // Skip identical data
        }
      }

      // Update cache
      this.detectionCache.set(terminalId, { lastData: data, timestamp: now });

      // Early exit for empty or insignificant data
      if (config.skipMinimalData && (!data || data.trim().length < 3)) {
        return null;
      }
    }

    // Process detection
    return this.processOutputDetection(terminalId, data);
  }

  detectTermination(terminalId: string, data: string): TerminationDetectionResult {
    try {
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(trimmed);
        const fullyCleanLine = cleanLine
          .replace(/[│╭╰─╯]/g, '') // Remove box characters only
          .trim();

        if (!fullyCleanLine || fullyCleanLine.length < 2) continue;

        // Check for shell prompt return
        if (this.patternDetector.detectShellPrompt(fullyCleanLine)) {
          return {
            isTerminated: true,
            reason: 'shell_prompt',
            detectedLine: fullyCleanLine,
          };
        }

        // Check for user exit commands
        const lowerLine = fullyCleanLine.toLowerCase();
        if (this.isExitCommand(lowerLine)) {
          return {
            isTerminated: true,
            reason: 'exit_command',
            detectedLine: fullyCleanLine,
          };
        }

        // Check for termination messages
        if (this.hasTerminationMessage(lowerLine)) {
          return {
            isTerminated: true,
            reason: 'termination_message',
            detectedLine: fullyCleanLine,
          };
        }

        // Check for process exit indicators
        if (this.hasProcessExitIndicator(lowerLine)) {
          return {
            isTerminated: true,
            reason: 'process_exit',
            detectedLine: fullyCleanLine,
          };
        }
      }
    } catch (error) {
      log('ERROR: CLI Agent termination detection failed:', error);
    }

    return { isTerminated: false, reason: 'shell_prompt' };
  }

  // =================== State Management Methods ===================

  getAgentState(terminalId: string): CliAgentState {
    const connectedId = this.stateManager.getConnectedAgentTerminalId();
    const connectedType = this.stateManager.getConnectedAgentType();
    const disconnectedAgents = this.stateManager.getDisconnectedAgents();

    if (connectedId === terminalId) {
      return {
        terminalId,
        type: connectedType,
        status: 'connected',
      };
    }

    const disconnectedInfo = disconnectedAgents.get(terminalId);
    if (disconnectedInfo) {
      return {
        terminalId,
        type: disconnectedInfo.type,
        status: 'disconnected',
        startTime: disconnectedInfo.startTime,
        terminalName: disconnectedInfo.terminalName,
      };
    }

    return {
      terminalId,
      type: null,
      status: 'none',
    };
  }

  getConnectedAgent(): { terminalId: string; type: string } | null {
    const terminalId = this.stateManager.getConnectedAgentTerminalId();
    const type = this.stateManager.getConnectedAgentType();

    return terminalId && type ? { terminalId, type } : null;
  }

  getDisconnectedAgents(): Map<string, DisconnectedAgentInfo> {
    return this.stateManager.getDisconnectedAgents();
  }

  switchAgentConnection(terminalId: string): {
    success: boolean;
    reason?: string;
    newStatus: 'connected' | 'disconnected' | 'none';
    agentType: string | null;
  } {
    const connectedId = this.stateManager.getConnectedAgentTerminalId();
    const isCurrentlyConnected = connectedId === terminalId;

    if (isCurrentlyConnected) {
      // Already connected, ignore
      const currentType = this.stateManager.getConnectedAgentType();
      return {
        success: true,
        newStatus: 'connected',
        agentType: currentType,
      };
    }

    // Check for disconnected agent
    const disconnectedAgents = this.stateManager.getDisconnectedAgents();
    const disconnectedAgent = disconnectedAgents.get(terminalId);

    if (disconnectedAgent) {
      // Move previous connected to disconnected and promote this one
      if (connectedId) {
        // This will be handled by setConnectedAgent
      }

      this.stateManager.setConnectedAgent(
        terminalId,
        disconnectedAgent.type,
        disconnectedAgent.terminalName
      );

      return {
        success: true,
        newStatus: 'connected',
        agentType: disconnectedAgent.type,
      };
    }

    return {
      success: false,
      reason: 'No AI Agent detected in this terminal',
      newStatus: 'none',
      agentType: null,
    };
  }

  // =================== Event Management ===================

  get onCliAgentStatusChange(): vscode.Event<{
    terminalId: string;
    status: 'connected' | 'disconnected' | 'none';
    type: string | null;
    terminalName?: string;
  }> {
    return this.stateManager.onStatusChange;
  }

  // =================== Lifecycle Management ===================

  handleTerminalRemoved(terminalId: string): void {
    this.detectionCache.delete(terminalId);
    this.stateManager.setAgentTerminated(terminalId);
  }

  dispose(): void {
    this.detectionCache.clear();
    this.stateManager.dispose();
  }

  /**
   * 🚨 NEW: Start heartbeat mechanism for state validation
   */
  startHeartbeat(): void {
    // Validate state every 30 seconds
    setInterval(() => {
      this.stateManager.validateConnectedAgentState();
    }, 30000);

    log('💓 [HEARTBEAT] Started CLI Agent state validation heartbeat (30s interval)');
  }

  /**
   * 🚨 NEW: Public method to refresh agent state (for FileReferenceCommand fallback)
   */
  refreshAgentState(): boolean {
    return this.stateManager.refreshConnectedAgentState();
  }

  // =================== Private Helper Methods ===================

  private processOutputDetection(terminalId: string, data: string): CliAgentDetectionResult | null {
    try {
      const lines = data.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const cleanLine = this.patternDetector.cleanAnsiEscapeSequences(trimmed);
        const fullyCleanLine = cleanLine
          .replace(/[│╭╰─╯]/g, '') // Remove box characters only
          .trim();

        if (!fullyCleanLine || fullyCleanLine.length < 2) continue;

        // Check for termination first (for connected terminals)
        if (this.stateManager.isAgentConnected(terminalId)) {
          const terminationResult = this.detectTermination(terminalId, line);
          if (terminationResult.isTerminated) {
            this.stateManager.setAgentTerminated(terminalId);
            log(
              `🔺 [CLI-AGENT] Termination detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            return null; // Termination handled, no detection result needed
          }
        }

        // 🚨 FIX: Prevent duplicate detection for already connected agents
        if (this.stateManager.isAgentConnected(terminalId)) {
          // Agent is already connected, skip startup detection to prevent state churn
          continue;
        }

        // Check for startup patterns (only for non-connected and non-disconnected agents)
        const disconnectedAgents = this.stateManager.getDisconnectedAgents();
        const isDisconnectedAgent = disconnectedAgents.has(terminalId);

        if (!isDisconnectedAgent) {
          // Claude startup detection
          if (this.patternDetector.detectClaudeStartup(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] Claude Code startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'claude');

            return {
              type: 'claude',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          }

          // Gemini startup detection
          if (this.patternDetector.detectGeminiStartup(fullyCleanLine)) {
            log(
              `🚀 [CLI-AGENT] Gemini CLI startup detected from output: "${fullyCleanLine}" in terminal ${terminalId}`
            );
            this.stateManager.setConnectedAgent(terminalId, 'gemini');

            return {
              type: 'gemini',
              confidence: 0.9,
              source: 'output',
              detectedLine: fullyCleanLine,
            };
          }
        }
      }
    } catch (error) {
      log('ERROR: CLI Agent output detection failed:', error);
    }

    return null;
  }

  private isExitCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    return (
      lowerCommand === '/exit' ||
      lowerCommand === '/quit' ||
      lowerCommand === 'exit' ||
      lowerCommand === 'quit' ||
      lowerCommand === '/end' ||
      lowerCommand === '/bye' ||
      lowerCommand === '/goodbye' ||
      lowerCommand === '/stop' ||
      lowerCommand === '/close' ||
      lowerCommand === '/disconnect' ||
      lowerCommand.startsWith('/exit') ||
      lowerCommand.startsWith('/quit') ||
      lowerCommand === 'q' ||
      lowerCommand === ':q' ||
      lowerCommand === ':quit' ||
      lowerCommand === ':exit' ||
      lowerCommand === 'ctrl+c' ||
      lowerCommand === 'ctrl-c'
    );
  }

  private hasTerminationMessage(lowerLine: string): boolean {
    const terminationMessages = [
      'goodbye',
      'bye',
      'exiting',
      'session ended',
      'conversation ended',
      'claude code session ended',
      'gemini session ended',
      'thanks for using',
      'until next time',
      'session complete',
    ];

    return terminationMessages.some((msg) => lowerLine.includes(msg));
  }

  private hasProcessExitIndicator(lowerLine: string): boolean {
    const processExitIndicators = [
      'process exited',
      'command finished',
      'task completed',
      'execution finished',
    ];

    return processExitIndicators.some((indicator) => lowerLine.includes(indicator));
  }
}
