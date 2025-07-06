import * as vscode from 'vscode';

/**
 * Enhanced user feedback and error handling utilities
 */

export enum FeedbackType {
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  INFO = 'info',
}

export interface FeedbackOptions {
  showNotification?: boolean;
  logToConsole?: boolean;
  timeout?: number;
  actions?: Array<{ title: string; action: () => void }>;
}

export class FeedbackManager {
  private static instance: FeedbackManager;
  private statusBarItem: vscode.StatusBarItem;
  private activeNotifications = new Map<string, vscode.Disposable>();

  private constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBarItem.text = '$(terminal) Terminal';
    this.statusBarItem.show();
  }

  public static getInstance(): FeedbackManager {
    if (!FeedbackManager.instance) {
      FeedbackManager.instance = new FeedbackManager();
    }
    return FeedbackManager.instance;
  }

  public showFeedback(type: FeedbackType, message: string, options: FeedbackOptions = {}): void {
    const { showNotification = true, logToConsole = true, timeout = 5000, actions = [] } = options;

    // Log to console
    if (logToConsole) {
      const prefix = this.getLogPrefix(type);
      console.log(`${prefix} ${message}`);
    }

    // Show notification
    if (showNotification) {
      void this.showNotification(type, message, actions);
    }

    // Update status bar temporarily
    this.updateStatusBar(type, message, timeout);
  }

  private getLogPrefix(type: FeedbackType): string {
    switch (type) {
      case FeedbackType.SUCCESS:
        return '✅ [SUCCESS]';
      case FeedbackType.WARNING:
        return '⚠️ [WARNING]';
      case FeedbackType.ERROR:
        return '❌ [ERROR]';
      case FeedbackType.INFO:
        return 'ℹ️ [INFO]';
      default:
        return '📝 [LOG]';
    }
  }

  private async showNotification(
    type: FeedbackType,
    message: string,
    actions: Array<{ title: string; action: () => void }> = []
  ): Promise<void> {
    const actionTitles = actions.map((a) => a.title);

    let selectedAction: string | undefined;

    switch (type) {
      case FeedbackType.SUCCESS:
        selectedAction = await vscode.window.showInformationMessage(message, ...actionTitles);
        break;
      case FeedbackType.WARNING:
        selectedAction = await vscode.window.showWarningMessage(message, ...actionTitles);
        break;
      case FeedbackType.ERROR:
        selectedAction = await vscode.window.showErrorMessage(message, ...actionTitles);
        break;
      case FeedbackType.INFO:
        selectedAction = await vscode.window.showInformationMessage(message, ...actionTitles);
        break;
    }

    // Execute selected action
    if (selectedAction) {
      const action = actions.find((a) => a.title === selectedAction);
      if (action) {
        action.action();
      }
    }
  }

  private updateStatusBar(type: FeedbackType, message: string, timeout: number): void {
    const icon = this.getStatusBarIcon(type);
    const originalText = this.statusBarItem.text;

    this.statusBarItem.text = `${icon} ${message}`;
    this.statusBarItem.tooltip = message;

    // Restore original text after timeout
    setTimeout(() => {
      this.statusBarItem.text = originalText;
      this.statusBarItem.tooltip = undefined;
    }, timeout);
  }

  private getStatusBarIcon(type: FeedbackType): string {
    switch (type) {
      case FeedbackType.SUCCESS:
        return '$(check)';
      case FeedbackType.WARNING:
        return '$(warning)';
      case FeedbackType.ERROR:
        return '$(error)';
      case FeedbackType.INFO:
        return '$(info)';
      default:
        return '$(terminal)';
    }
  }

  public showProgress<T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
  ): Thenable<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task
    );
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    for (const disposable of this.activeNotifications.values()) {
      disposable.dispose();
    }
    this.activeNotifications.clear();
  }
}

// Convenience functions
export function showSuccess(message: string, options?: FeedbackOptions): void {
  FeedbackManager.getInstance().showFeedback(FeedbackType.SUCCESS, message, options);
}

export function showWarning(message: string, options?: FeedbackOptions): void {
  FeedbackManager.getInstance().showFeedback(FeedbackType.WARNING, message, options);
}

export function showError(message: string, options?: FeedbackOptions): void {
  FeedbackManager.getInstance().showFeedback(FeedbackType.ERROR, message, options);
}

export function showInfo(message: string, options?: FeedbackOptions): void {
  FeedbackManager.getInstance().showFeedback(FeedbackType.INFO, message, options);
}

export function showProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Thenable<T>
): Thenable<T> {
  return FeedbackManager.getInstance().showProgress(title, task);
}

/**
 * Enhanced error handling for terminal operations
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TerminalErrorHandler {
  public static handleTerminalCreationError(error: unknown): void {
    const message = TerminalErrorHandler.getErrorMessage(error);

    if (message.includes('ENOENT') || message.includes('command not found')) {
      showError('Shell not found. Please check your terminal settings.', {
        actions: [
          {
            title: 'Open Settings',
            action: () => {
              void vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'sidebarTerminal.shell'
              );
            },
          },
        ],
      });
    } else if (message.includes('EACCES') || message.includes('permission denied')) {
      showError('Permission denied. Please check shell permissions.', {
        actions: [
          {
            title: 'Learn More',
            action: () => {
              void vscode.env.openExternal(
                vscode.Uri.parse(
                  'https://code.visualstudio.com/docs/terminal/basics#_permission-issues'
                )
              );
            },
          },
        ],
      });
    } else {
      showError(`Terminal creation failed: ${message}`, {
        actions: [
          {
            title: 'Retry',
            action: () => {
              void vscode.commands.executeCommand('sidebarTerminal.createTerminal');
            },
          },
        ],
      });
    }
  }

  public static handleMaxTerminalsReached(maxCount: number): void {
    showWarning(
      `Maximum number of terminals reached (${maxCount}). Close some terminals to create new ones.`,
      {
        actions: [
          {
            title: 'Kill Active Terminal',
            action: () => {
              void vscode.commands.executeCommand('sidebarTerminal.killTerminal');
            },
          },
        ],
      }
    );
  }

  public static handleTerminalNotFound(): void {
    showWarning('No active terminal found.', {
      actions: [
        {
          title: 'Create Terminal',
          action: () => {
            void vscode.commands.executeCommand('sidebarTerminal.createTerminal');
          },
        },
      ],
    });
  }

  public static handleWebviewError(error: unknown): void {
    const message = TerminalErrorHandler.getErrorMessage(error);
    showError(`Webview error: ${message}. Try refreshing the terminal view.`, {
      actions: [
        {
          title: 'Refresh',
          action: () => {
            void vscode.commands.executeCommand('workbench.action.reloadWindow');
          },
        },
      ],
    });
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error occurred';
  }
}
