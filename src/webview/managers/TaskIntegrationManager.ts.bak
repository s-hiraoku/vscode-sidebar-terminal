/**
 * Task Integration Manager
 * Integrates VS Code tasks with Secondary Sidebar Terminal
 * - Task execution in dedicated terminals
 * - Problem detection and matching
 * - Task status monitoring
 * - Terminal/task association management
 */

// import { Terminal } from '@xterm/xterm'; // Removed: not used in current implementation
import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';

export interface TaskDefinition {
  type: string;
  label: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: { [key: string]: string };
  group?: 'build' | 'test' | 'clean' | string;
  presentation?: {
    echo?: boolean;
    reveal?: 'always' | 'silent' | 'never';
    focus?: boolean;
    panel?: 'shared' | 'dedicated' | 'new';
    showReuseMessage?: boolean;
    clear?: boolean;
    close?: boolean;
  };
  problemMatcher?: string | string[];
  runOptions?: {
    runOn?: 'default' | 'folderOpen';
  };
  _disposeProblemMonitoring?: () => void; // Internal cleanup function
}

export interface TaskExecution {
  taskId: string;
  task: TaskDefinition;
  terminalId: string;
  startTime: number;
  endTime?: number;
  exitCode?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  problems: TaskProblem[];
}

export interface TaskProblem {
  severity: 'error' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  source: string;
}

export interface ProblemMatcher {
  name: string;
  pattern: {
    regexp: RegExp;
    file?: number;
    line?: number;
    column?: number;
    severity?: number;
    message?: number;
  }[];
  background?: {
    activeOnStart?: boolean;
    beginsPattern?: RegExp;
    endsPattern?: RegExp;
  };
}

/**
 * Task Integration Manager
 * Provides VS Code task system integration for Secondary Sidebar Terminal
 */
export class TaskIntegrationManager {
  private coordinator: IManagerCoordinator | null = null;
  private activeTasks = new Map<string, TaskExecution>();
  private taskTerminals = new Map<string, string>(); // terminalId -> taskId
  private problemMatchers = new Map<string, ProblemMatcher>();
  private taskHistory: TaskExecution[] = [];

  constructor() {
    this.initializeBuiltinProblemMatchers();
    this.initializeErrorNotificationStyles();
  }

  public setCoordinator(coordinator: IManagerCoordinator): void {
    this.coordinator = coordinator;
    console.log('🎯 Task Integration Manager initialized');
  }

  /**
   * Execute a task in a terminal
   */
  public async executeTask(task: TaskDefinition): Promise<TaskExecution> {
    const taskId = this.generateTaskId(task);
    const terminalId = await this.getOrCreateTerminalForTask(task, taskId);

    const execution: TaskExecution = {
      taskId,
      task,
      terminalId,
      startTime: Date.now(),
      status: 'running',
      problems: [],
    };

    this.activeTasks.set(taskId, execution);
    this.taskTerminals.set(terminalId, taskId);

    // Send task command to terminal
    await this.executeTaskInTerminal(execution);

    // Start problem monitoring
    this.startProblemMonitoring(execution);

    console.log(`🎯 Task started: ${task.label} (${taskId})`);
    return execution;
  }

  /**
   * Get or create terminal for task execution
   */
  private async getOrCreateTerminalForTask(task: TaskDefinition, taskId: string): Promise<string> {
    const presentation = task.presentation || {};

    let terminalId: string;

    switch (presentation.panel) {
      case 'new':
        // Always create new terminal
        terminalId = await this.createTaskTerminal(task, taskId);
        break;

      case 'shared':
        // Use shared terminal for all tasks
        terminalId = await this.getOrCreateSharedTerminal();
        break;

      case 'dedicated':
      default:
        // Dedicated terminal per task type/group
        terminalId = await this.getOrCreateDedicatedTerminal(task, taskId);
        break;
    }

    return terminalId;
  }

  private async createTaskTerminal(task: TaskDefinition, taskId: string): Promise<string> {
    if (!this.coordinator) {
      throw new Error('Coordinator not set');
    }

    const terminalName = `Task: ${task.label}`;
    const terminalId = `task-${taskId}`;

    await this.coordinator.createTerminal(terminalId, terminalName, {
      cwd: task.cwd,
      env: task.env,
    });

    return terminalId;
  }

  private async getOrCreateSharedTerminal(): Promise<string> {
    const sharedTerminalId = 'shared-task-terminal';

    // Check if shared terminal already exists
    const existingTerminal = this.coordinator?.getTerminalInstance(sharedTerminalId);
    if (existingTerminal) {
      return sharedTerminalId;
    }

    // Create shared terminal
    if (this.coordinator) {
      await this.coordinator.createTerminal(sharedTerminalId, 'Tasks', {});
    }

    return sharedTerminalId;
  }

  private async getOrCreateDedicatedTerminal(
    task: TaskDefinition,
    _taskId: string
  ): Promise<string> {
    const dedicatedKey = task.group || task.type || 'default';
    const dedicatedTerminalId = `dedicated-${dedicatedKey}`;

    // Check if dedicated terminal already exists
    const existingTerminal = this.coordinator?.getTerminalInstance(dedicatedTerminalId);
    if (existingTerminal) {
      return dedicatedTerminalId;
    }

    // Create dedicated terminal
    if (this.coordinator) {
      await this.coordinator.createTerminal(
        dedicatedTerminalId,
        `${task.group || task.type} Tasks`,
        {
          cwd: task.cwd,
          env: task.env,
        }
      );
    }

    return dedicatedTerminalId;
  }

  /**
   * Execute task command in terminal
   */
  private async executeTaskInTerminal(execution: TaskExecution): Promise<void> {
    const { task, terminalId } = execution;
    const terminal = this.coordinator?.getTerminalInstance(terminalId)?.terminal;

    if (!terminal) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    const presentation = task.presentation || {};

    // Clear terminal if requested
    if (presentation.clear) {
      terminal.clear();
    }

    // Show command echo if enabled (default: true)
    if (presentation.echo !== false) {
      const command = this.buildCommandString(task);
      terminal.write(`\r\n\x1b[1m> Executing task: ${task.label}\x1b[0m\r\n`);
      terminal.write(`\x1b[2m> ${command}\x1b[0m\r\n\r\n`);
    }

    // Focus terminal if requested
    if (presentation.focus) {
      this.coordinator?.setActiveTerminalId(terminalId);
    }

    // Send command to terminal
    const command = this.buildCommandString(task);
    terminal.paste(command + '\r');
  }

  private buildCommandString(task: TaskDefinition): string {
    let command = task.command;

    if (task.args && task.args.length > 0) {
      // Properly escape arguments
      const escapedArgs = task.args.map((arg) => {
        if (arg.includes(' ') || arg.includes('"')) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      });
      command += ' ' + escapedArgs.join(' ');
    }

    return command;
  }

  /**
   * Start monitoring terminal output for problems
   */
  private startProblemMonitoring(execution: TaskExecution): void {
    const terminal = this.coordinator?.getTerminalInstance(execution.terminalId)?.terminal;
    if (!terminal) return;

    const problemMatchers = this.getProblemMatchersForTask(execution.task);
    if (problemMatchers.length === 0) return;

    // Monitor terminal output for problems
    const outputBuffer: string[] = [];

    const onData = terminal.onData((data: string) => {
      outputBuffer.push(data);

      // Process output for problems periodically
      if (outputBuffer.length > 10) {
        this.processProblemMatching(execution, outputBuffer.join(''));
        outputBuffer.length = 0;
      }
    });

    // Store disposal function for cleanup
    execution.task._disposeProblemMonitoring = () => onData.dispose();
  }

  private getProblemMatchersForTask(task: TaskDefinition): ProblemMatcher[] {
    if (!task.problemMatcher) return [];

    const matchers: string[] = Array.isArray(task.problemMatcher)
      ? task.problemMatcher
      : [task.problemMatcher];

    return matchers
      .map((name) => this.problemMatchers.get(name))
      .filter((matcher): matcher is ProblemMatcher => !!matcher);
  }

  private processProblemMatching(execution: TaskExecution, output: string): void {
    const problemMatchers = this.getProblemMatchersForTask(execution.task);

    problemMatchers.forEach((matcher) => {
      matcher.pattern.forEach((pattern) => {
        const matches = output.matchAll(new RegExp(pattern.regexp, 'gm'));

        for (const match of matches) {
          const problem: TaskProblem = {
            severity: this.getSeverityFromMatch(match, pattern),
            message: this.getMessageFromMatch(match, pattern),
            file: this.getFileFromMatch(match, pattern),
            line: this.getLineFromMatch(match, pattern),
            column: this.getColumnFromMatch(match, pattern),
            source: matcher.name,
          };

          execution.problems.push(problem);

          // Enhanced error display with source linking
          this.displayEnhancedError(problem, execution.terminalId, execution);

          console.warn(`🎯 Problem detected: ${problem.severity} - ${problem.message}`);
        }
      });
    });
  }

  /**
   * Enhanced problem matching with source linking
   */
  private processEnhancedProblemMatching(
    execution: TaskExecution,
    output: string,
    terminalId: string
  ): void {
    const problemMatchers = this.getProblemMatchersForTask(execution.task);

    problemMatchers.forEach((matcher) => {
      matcher.pattern.forEach((pattern) => {
        const matches = output.matchAll(new RegExp(pattern.regexp, 'gm'));

        for (const match of matches) {
          const problem: TaskProblem = {
            severity: this.getSeverityFromMatch(match, pattern),
            message: this.getMessageFromMatch(match, pattern),
            file: this.getFileFromMatch(match, pattern),
            line: this.getLineFromMatch(match, pattern),
            column: this.getColumnFromMatch(match, pattern),
            source: matcher.name,
          };

          execution.problems.push(problem);

          // Create enhanced error display with source linking
          this.displayEnhancedError(problem, terminalId, execution);
        }
      });
    });
  }

  /**
   * Display enhanced error with clickable source links
   */
  private displayEnhancedError(
    problem: TaskProblem,
    terminalId: string,
    execution: TaskExecution
  ): void {
    const terminalContainer = this.coordinator?.getTerminalElement(terminalId);
    if (!terminalContainer) return;

    // Create error notification with source link
    const errorElement = this.createErrorNotification(problem, execution);

    // Position error notification in terminal
    this.positionErrorNotification(errorElement, terminalContainer);

    // Auto-hide after delay
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
    }, 10000); // 10 second display
  }

  /**
   * Create error notification element with source linking
   */
  private createErrorNotification(problem: TaskProblem, _execution: TaskExecution): HTMLElement {
    const errorDiv = document.createElement('div');
    errorDiv.className = `task-error-notification severity-${problem.severity}`;

    // Error icon and severity
    const iconSpan = document.createElement('span');
    iconSpan.className = 'error-icon';
    iconSpan.textContent = this.getErrorIcon(problem.severity);

    // Error message
    const messageSpan = document.createElement('span');
    messageSpan.className = 'error-message';
    messageSpan.textContent = problem.message || 'Unknown error';

    // Source link (if file information available)
    let sourceLink: HTMLElement | null = null;
    if (problem.file) {
      sourceLink = document.createElement('button');
      sourceLink.className = 'error-source-link';
      sourceLink.textContent = this.formatSourceLocation(problem);
      sourceLink.title = `Open ${problem.file}${problem.line ? `:${problem.line}` : ''}`;

      sourceLink.addEventListener('click', () => {
        this.openSourceFile(problem);
      });
    }

    // Build notification content
    errorDiv.appendChild(iconSpan);
    errorDiv.appendChild(messageSpan);
    if (sourceLink) {
      errorDiv.appendChild(sourceLink);
    }

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'error-close-button';
    closeButton.textContent = '×';
    closeButton.title = 'Dismiss';
    closeButton.addEventListener('click', () => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    });
    errorDiv.appendChild(closeButton);

    return errorDiv;
  }

  /**
   * Get appropriate icon for error severity
   */
  private getErrorIcon(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '🔴';
    }
  }

  /**
   * Format source location for display
   */
  private formatSourceLocation(problem: TaskProblem): string {
    let location = problem.file || '';

    // Extract just the filename for display
    const fileName = location.split('/').pop() || location;

    if (problem.line) {
      location = `${fileName}:${problem.line}`;
      if (problem.column) {
        location += `:${problem.column}`;
      }
    } else {
      location = fileName;
    }

    return location;
  }

  /**
   * Open source file in VS Code
   */
  private openSourceFile(problem: TaskProblem): void {
    if (!problem.file || !this.coordinator) {
      console.warn('Cannot open source file: missing file information');
      return;
    }

    // Send message to extension to open file
    this.coordinator.postMessageToExtension({
      command: 'openFile',
      file: problem.file,
      line: problem.line ? parseInt(problem.line.toString()) : undefined,
      column: problem.column ? parseInt(problem.column.toString()) : undefined,
      preview: true, // Open in preview mode
    });

    console.log(`🔗 Opening source file: ${problem.file}${problem.line ? `:${problem.line}` : ''}`);
  }

  /**
   * Position error notification in terminal container
   */
  private positionErrorNotification(
    errorElement: HTMLElement,
    terminalContainer: HTMLElement
  ): void {
    // Ensure terminal container is positioned
    if (getComputedStyle(terminalContainer).position === 'static') {
      terminalContainer.style.position = 'relative';
    }

    // Position notification at top-right of terminal
    errorElement.style.position = 'absolute';
    errorElement.style.top = '10px';
    errorElement.style.right = '10px';
    errorElement.style.zIndex = '1000';
    errorElement.style.maxWidth = '400px';

    terminalContainer.appendChild(errorElement);
  }

  /**
   * Add CSS styles for error notifications
   */
  private initializeErrorNotificationStyles(): void {
    const styleId = 'task-error-notification-styles';
    if (document.getElementById(styleId)) {
      return; // Styles already added
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .task-error-notification {
        background: var(--vscode-notifications-background);
        border: 1px solid var(--vscode-notifications-border);
        border-radius: 4px;
        padding: 8px 12px;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--vscode-notifications-foreground);
        box-shadow: 0 2px 8px var(--vscode-widget-shadow);
        animation: slideInRight 0.3s ease-out;
      }

      .task-error-notification.severity-error {
        border-left: 4px solid var(--vscode-errorForeground);
      }

      .task-error-notification.severity-warning {
        border-left: 4px solid var(--vscode-warningForeground);
      }

      .task-error-notification.severity-info {
        border-left: 4px solid var(--vscode-infoForeground);
      }

      .error-icon {
        font-size: 14px;
        flex-shrink: 0;
      }

      .error-message {
        flex: 1;
        word-break: break-word;
        line-height: 1.3;
      }

      .error-source-link {
        background: var(--vscode-button-secondaryBackground);
        border: 1px solid var(--vscode-button-border);
        color: var(--vscode-button-secondaryForeground);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
        text-decoration: none;
        font-family: var(--vscode-editor-font-family);
      }

      .error-source-link:hover {
        background: var(--vscode-button-secondaryHoverBackground);
        text-decoration: underline;
      }

      .error-close-button {
        background: none;
        border: none;
        color: var(--vscode-notifications-foreground);
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 2px;
        font-size: 14px;
        line-height: 1;
        opacity: 0.7;
      }

      .error-close-button:hover {
        opacity: 1;
        background: var(--vscode-toolbar-hoverBackground);
      }

      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      /* Error notification positioning container */
      .terminal-container {
        position: relative;
      }
    `;

    document.head.appendChild(style);
  }

  private getSeverityFromMatch(
    match: RegExpMatchArray,
    pattern: any
  ): 'error' | 'warning' | 'info' {
    if (pattern.severity && match[pattern.severity]) {
      const severityGroup = match[pattern.severity];
      if (severityGroup) {
        const severity = severityGroup.toLowerCase();
        if (severity.includes('error')) return 'error';
        if (severity.includes('warn')) return 'warning';
      }
    }
    return 'error'; // Default to error
  }

  private getMessageFromMatch(match: RegExpMatchArray, pattern: any): string {
    const messageGroup = pattern.message && match[pattern.message];
    return messageGroup || match[0] || '';
  }

  private getFileFromMatch(match: RegExpMatchArray, pattern: any): string | undefined {
    return pattern.file && match[pattern.file] ? match[pattern.file] : undefined;
  }

  private getLineFromMatch(match: RegExpMatchArray, pattern: any): number | undefined {
    const lineGroup = pattern.line && match[pattern.line];
    return lineGroup ? parseInt(lineGroup, 10) : undefined;
  }

  private getColumnFromMatch(match: RegExpMatchArray, pattern: any): number | undefined {
    const columnGroup = pattern.column && match[pattern.column];
    return columnGroup ? parseInt(columnGroup, 10) : undefined;
  }

  /**
   * Handle task completion
   */
  public completeTask(terminalId: string, exitCode: number): void {
    const taskId = this.taskTerminals.get(terminalId);
    if (!taskId) return;

    const execution = this.activeTasks.get(taskId);
    if (!execution) return;

    execution.endTime = Date.now();
    execution.exitCode = exitCode;
    execution.status = exitCode === 0 ? 'completed' : 'failed';

    // Cleanup problem monitoring
    if (execution.task._disposeProblemMonitoring) {
      execution.task._disposeProblemMonitoring();
    }

    // Add to history
    this.taskHistory.push(execution);

    // Keep only last 50 executions
    if (this.taskHistory.length > 50) {
      this.taskHistory.shift();
    }

    // Remove from active tasks
    this.activeTasks.delete(taskId);
    this.taskTerminals.delete(terminalId);

    const duration = execution.endTime - execution.startTime;
    console.log(
      `🎯 Task ${execution.status}: ${execution.task.label} (${duration}ms, exit code: ${exitCode})`
    );

    // Handle post-task actions
    this.handleTaskCompletion(execution);
  }

  private handleTaskCompletion(execution: TaskExecution): void {
    const presentation = execution.task.presentation || {};

    // Close terminal if requested and task succeeded
    if (presentation.close && execution.status === 'completed') {
      setTimeout(() => {
        this.coordinator?.closeTerminal(execution.terminalId);
      }, 1000);
    }

    // Show notification for failed tasks
    if (execution.status === 'failed') {
      this.coordinator?.postMessageToExtension({
        command: 'showNotification',
        message: `Task failed: ${execution.task.label}`,
        type: 'error',
      });
    }
  }

  /**
   * Get active tasks
   */
  public getActiveTasks(): TaskExecution[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get task history
   */
  public getTaskHistory(): TaskExecution[] {
    return [...this.taskHistory];
  }

  /**
   * Get task for terminal
   */
  public getTaskForTerminal(terminalId: string): TaskExecution | undefined {
    const taskId = this.taskTerminals.get(terminalId);
    return taskId ? this.activeTasks.get(taskId) : undefined;
  }

  /**
   * Cancel running task
   */
  public cancelTask(taskId: string): void {
    const execution = this.activeTasks.get(taskId);
    if (!execution) return;

    execution.status = 'cancelled';
    execution.endTime = Date.now();

    // Send Ctrl+C to terminal to interrupt task
    const terminal = this.coordinator?.getTerminalInstance(execution.terminalId)?.terminal;
    if (terminal) {
      terminal.paste('\x03'); // Ctrl+C
    }

    this.activeTasks.delete(taskId);
    this.taskTerminals.delete(execution.terminalId);

    console.log(`🎯 Task cancelled: ${execution.task.label}`);
  }

  /**
   * Rerun last task in terminal
   */
  public rerunTaskInTerminal(terminalId: string): void {
    // Find the last task that ran in this terminal
    const lastTask = this.taskHistory
      .filter((exec) => exec.terminalId === terminalId)
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))[0];

    if (lastTask) {
      this.executeTask(lastTask.task);
    }
  }

  private initializeBuiltinProblemMatchers(): void {
    // TypeScript/JavaScript problem matcher
    this.problemMatchers.set('$tsc', {
      name: 'tsc',
      pattern: [
        {
          regexp: /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS(\d+):\s+(.+)$/,
          file: 1,
          line: 2,
          column: 3,
          severity: 4,
          message: 6,
        },
      ],
    });

    // ESLint problem matcher
    this.problemMatchers.set('$eslint-stylish', {
      name: 'eslint-stylish',
      pattern: [
        {
          regexp: /^\s*(.+?):(\d+):(\d+):\s+(error|warning):\s+(.+?)\s+(.+)$/,
          file: 1,
          line: 2,
          column: 3,
          severity: 4,
          message: 5,
        },
      ],
    });

    // Node.js problem matcher
    this.problemMatchers.set('$node-sass', {
      name: 'node-sass',
      pattern: [
        {
          regexp: /^Error:\s+(.+?)\s+in\s+(.+?):(\d+)$/,
          message: 1,
          file: 2,
          line: 3,
          severity: 1, // All are errors
        },
      ],
    });

    // Webpack problem matcher
    this.problemMatchers.set('$webpack', {
      name: 'webpack',
      pattern: [
        {
          regexp: /^ERROR in (.+?):(\d+):(\d+)\s*$/,
          file: 1,
          line: 2,
          column: 3,
          severity: 1, // Error
        },
        {
          regexp: /^WARNING in (.+?):(\d+):(\d+)\s*$/,
          file: 1,
          line: 2,
          column: 3,
          severity: 2, // Warning
        },
      ],
    });

    // Python problem matcher
    this.problemMatchers.set('$python', {
      name: 'python',
      pattern: [
        {
          regexp: /^\s*File "(.+?)", line (\d+),.*$/,
          file: 1,
          line: 2,
          severity: 1, // Error
        },
      ],
    });

    // Rust problem matcher
    this.problemMatchers.set('$rust', {
      name: 'rust',
      pattern: [
        {
          regexp: /^(error|warning)(?:\[E\d+\])?: (.+?)$/,
          severity: 1,
          message: 2,
        },
        {
          regexp: /^\s+--> (.+?):(\d+):(\d+)$/,
          file: 1,
          line: 2,
          column: 3,
        },
      ],
    });

    // Go problem matcher
    this.problemMatchers.set('$go', {
      name: 'go',
      pattern: [
        {
          regexp: /^(.+?):(\d+):(\d+):\s+(.+)$/,
          file: 1,
          line: 2,
          column: 3,
          message: 4,
        },
      ],
    });

    // Java problem matcher
    this.problemMatchers.set('$java', {
      name: 'java',
      pattern: [
        {
          regexp: /^(.+?):(\d+):\s+(error|warning):\s+(.+)$/,
          file: 1,
          line: 2,
          severity: 3,
          message: 4,
        },
      ],
    });

    // C/C++ GCC problem matcher
    this.problemMatchers.set('$gcc', {
      name: 'gcc',
      pattern: [
        {
          regexp: /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/,
          file: 1,
          line: 2,
          column: 3,
          severity: 4,
          message: 5,
        },
      ],
    });

    // Docker problem matcher
    this.problemMatchers.set('$docker', {
      name: 'docker',
      pattern: [
        {
          regexp: /^Step (\d+\/\d+) : (.+)$/,
          message: 2,
        },
        {
          regexp: /^ERROR:\s+(.+)$/,
          message: 1,
          severity: 1,
        },
      ],
    });

    // npm problem matcher
    this.problemMatchers.set('$npm', {
      name: 'npm',
      pattern: [
        {
          regexp: /^npm ERR!\s+(.+)$/,
          message: 1,
          severity: 1,
        },
        {
          regexp: /^npm WARN\s+(.+)$/,
          message: 1,
          severity: 2,
        },
      ],
    });
  }

  private generateTaskId(task: TaskDefinition): string {
    const timestamp = Date.now();
    const hash = this.hashString(JSON.stringify(task));
    return `${hash}-${timestamp}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  public dispose(): void {
    // Cancel all active tasks
    this.activeTasks.forEach((execution) => {
      if (execution.task._disposeProblemMonitoring) {
        execution.task._disposeProblemMonitoring();
      }
    });

    this.activeTasks.clear();
    this.taskTerminals.clear();
    this.taskHistory = [];
    this.coordinator = null;

    console.log('🎯 Task Integration Manager disposed');
  }
}
