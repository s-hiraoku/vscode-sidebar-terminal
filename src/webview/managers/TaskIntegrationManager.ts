/**
 * Task Integration Manager
 * Integrates VS Code tasks with Secondary Sidebar Terminal
 * - Task execution in dedicated terminals
 * - Problem detection and matching  
 * - Task status monitoring
 * - Terminal/task association management
 */

import { Terminal } from '@xterm/xterm';
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
      problems: []
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
      env: task.env
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

  private async getOrCreateDedicatedTerminal(task: TaskDefinition, taskId: string): Promise<string> {
    const dedicatedKey = task.group || task.type || 'default';
    const dedicatedTerminalId = `dedicated-${dedicatedKey}`;
    
    // Check if dedicated terminal already exists
    const existingTerminal = this.coordinator?.getTerminalInstance(dedicatedTerminalId);
    if (existingTerminal) {
      return dedicatedTerminalId;
    }

    // Create dedicated terminal
    if (this.coordinator) {
      await this.coordinator.createTerminal(dedicatedTerminalId, `${task.group || task.type} Tasks`, {
        cwd: task.cwd,
        env: task.env
      });
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
      const escapedArgs = task.args.map(arg => {
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
      .map(name => this.problemMatchers.get(name))
      .filter((matcher): matcher is ProblemMatcher => !!matcher);
  }

  private processProblemMatching(execution: TaskExecution, output: string): void {
    const problemMatchers = this.getProblemMatchersForTask(execution.task);
    
    problemMatchers.forEach(matcher => {
      matcher.pattern.forEach(pattern => {
        const matches = output.matchAll(new RegExp(pattern.regexp, 'gm'));
        
        for (const match of matches) {
          const problem: TaskProblem = {
            severity: this.getSeverityFromMatch(match, pattern),
            message: this.getMessageFromMatch(match, pattern),
            file: this.getFileFromMatch(match, pattern),
            line: this.getLineFromMatch(match, pattern),
            column: this.getColumnFromMatch(match, pattern),
            source: matcher.name
          };
          
          execution.problems.push(problem);
          console.warn(`🎯 Problem detected: ${problem.severity} - ${problem.message}`);
        }
      });
    });
  }

  private getSeverityFromMatch(match: RegExpMatchArray, pattern: any): 'error' | 'warning' | 'info' {
    if (pattern.severity && match[pattern.severity]) {
      const severity = match[pattern.severity].toLowerCase();
      if (severity.includes('error')) return 'error';
      if (severity.includes('warn')) return 'warning';
    }
    return 'error'; // Default to error
  }

  private getMessageFromMatch(match: RegExpMatchArray, pattern: any): string {
    return pattern.message && match[pattern.message] ? match[pattern.message] : match[0];
  }

  private getFileFromMatch(match: RegExpMatchArray, pattern: any): string | undefined {
    return pattern.file && match[pattern.file] ? match[pattern.file] : undefined;
  }

  private getLineFromMatch(match: RegExpMatchArray, pattern: any): number | undefined {
    return pattern.line && match[pattern.line] ? parseInt(match[pattern.line], 10) : undefined;
  }

  private getColumnFromMatch(match: RegExpMatchArray, pattern: any): number | undefined {
    return pattern.column && match[pattern.column] ? parseInt(match[pattern.column], 10) : undefined;
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
    console.log(`🎯 Task ${execution.status}: ${execution.task.label} (${duration}ms, exit code: ${exitCode})`);

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
        type: 'error'
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
      .filter(exec => exec.terminalId === terminalId)
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))[0];

    if (lastTask) {
      this.executeTask(lastTask.task);
    }
  }

  private initializeBuiltinProblemMatchers(): void {
    // TypeScript/JavaScript problem matcher
    this.problemMatchers.set('$tsc', {
      name: 'tsc',
      pattern: [{
        regexp: /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS(\d+):\s+(.+)$/,
        file: 1,
        line: 2,
        column: 3,
        severity: 4,
        message: 6
      }]
    });

    // ESLint problem matcher
    this.problemMatchers.set('$eslint-stylish', {
      name: 'eslint-stylish',
      pattern: [{
        regexp: /^\s*(.+?):(\d+):(\d+):\s+(error|warning):\s+(.+?)\s+(.+)$/,
        file: 1,
        line: 2,
        column: 3,
        severity: 4,
        message: 5
      }]
    });

    // Node.js problem matcher
    this.problemMatchers.set('$node-sass', {
      name: 'node-sass',
      pattern: [{
        regexp: /^Error:\s+(.+?)\s+in\s+(.+?):(\d+)$/,
        message: 1,
        file: 2,
        line: 3,
        severity: 1 // All are errors
      }]
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
      hash = ((hash << 5) - hash) + char;
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