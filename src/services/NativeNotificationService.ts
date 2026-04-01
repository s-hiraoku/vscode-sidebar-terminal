import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';
import { NOTIFICATION_TITLE } from './agentConstants';

const SETTING_PREFIX = 'secondaryTerminal';
const DEFAULT_COOLDOWN_MS = 10000;

type ExecFileCallback = (error: Error | null) => void;
type ExecFileFn = (cmd: string, args: string[], callback: ExecFileCallback) => void;

interface NativeNotificationConfig {
  enabled: boolean;
  activateWindow: boolean;
  cooldownMs: number;
}

export class NativeNotificationService implements vscode.Disposable {
  private isDisposed = false;
  private readonly execFileFn: ExecFileFn;
  private readonly lastNotifiedAt = new Map<string, number>();
  private lastGlobalNotifiedAt = 0;

  constructor(execFileFn?: ExecFileFn) {
    this.execFileFn =
      execFileFn ??
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('child_process').execFile as ExecFileFn);
  }

  private getConfig(): NativeNotificationConfig {
    const config = vscode.workspace.getConfiguration(SETTING_PREFIX);
    return {
      enabled: config.get<boolean>('nativeNotification.enabled', true),
      activateWindow: config.get<boolean>('nativeNotification.activateWindow', true),
      cooldownMs: Math.max(
        1000,
        Math.min(60000, config.get<number>('nativeNotification.cooldownMs', DEFAULT_COOLDOWN_MS))
      ),
    };
  }

  private canNotify(terminalId: string, cooldownMs: number): boolean {
    const now = Date.now();

    if (now - this.lastGlobalNotifiedAt < cooldownMs) {
      return false;
    }

    const lastNotified = this.lastNotifiedAt.get(terminalId) ?? 0;
    if (now - lastNotified < cooldownMs) {
      return false;
    }

    this.lastNotifiedAt.set(terminalId, now);
    this.lastGlobalNotifiedAt = now;
    return true;
  }

  public notifyAndActivate(terminalId: string, title: string, message: string): void {
    if (this.isDisposed) {
      return;
    }

    const config = this.getConfig();
    if (!config.enabled || !this.canNotify(terminalId, config.cooldownMs)) {
      return;
    }

    const platform = process.platform;

    try {
      switch (platform) {
        case 'darwin':
          this.notifyAndActivateMac(title, message, config.activateWindow);
          break;
        case 'win32':
          this.notifyAndActivateWindows(title, message, config.activateWindow);
          break;
        case 'linux':
          this.notifyAndActivateLinux(title, message, config.activateWindow);
          break;
        default:
          log('[NATIVE_NOTIFY] Unsupported platform:', platform);
          break;
      }
    } catch (error) {
      log('[NATIVE_NOTIFY] Error:', error);
    }
  }

  private getAppName(): string {
    try {
      return vscode.env.appName || 'Visual Studio Code';
    } catch {
      return 'Visual Studio Code';
    }
  }

  private notifyAndActivateMac(title: string, message: string, activate: boolean): void {
    const safeTitle = this.sanitize(title);
    const safeMessage = this.sanitize(message);
    const parts = [`display notification "${safeMessage}" with title "${safeTitle}"`];
    if (activate) {
      const appName = this.sanitize(this.getAppName());
      parts.push(`tell application "${appName}" to activate`);
    }
    const script = parts.join('\n');
    this.execFileFn('osascript', ['-e', script], (error) => {
      if (error) {
        log('[NATIVE_NOTIFY] macOS error:', error);
      }
    });
  }

  private notifyAndActivateWindows(title: string, message: string, activate: boolean): void {
    const safeTitle = title.replace(/'/g, "''");
    const safeMessage = message.replace(/'/g, "''");
    const lines = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;',
      `$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);`,
      `$textNodes = $template.GetElementsByTagName('text');`,
      `$textNodes.Item(0).AppendChild($template.CreateTextNode('${safeTitle}')) > $null;`,
      `$textNodes.Item(1).AppendChild($template.CreateTextNode('${safeMessage}')) > $null;`,
      `$toast = [Windows.UI.Notifications.ToastNotification]::new($template);`,
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${NOTIFICATION_TITLE}').Show($toast);`,
    ];
    if (activate) {
      lines.push(
        `$vscode = Get-Process | Where-Object { $_.ProcessName -match '^Code( - Insiders)?$' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1;`,
        `if ($vscode) {`,
        `  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }';`,
        `  [Win32]::SetForegroundWindow($vscode.MainWindowHandle) > $null;`,
        `}`
      );
    }
    this.execFileFn('powershell', ['-Command', lines.join(' ')], (error) => {
      if (error) {
        log('[NATIVE_NOTIFY] Windows error:', error);
      }
    });
  }

  private notifyAndActivateLinux(title: string, message: string, activate: boolean): void {
    this.execFileFn('notify-send', [title, message], (error) => {
      if (error) {
        log('[NATIVE_NOTIFY] Linux notification error:', error);
      }
    });
    if (activate) {
      this.execFileFn('wmctrl', ['-a', this.getAppName()], (error) => {
        if (error) {
          log('[NATIVE_NOTIFY] Linux window activation error:', error);
        }
      });
    }
  }

  private sanitize(str: string): string {
    return str.replace(/[\\"]/g, '');
  }

  public clearTerminal(terminalId: string): void {
    this.lastNotifiedAt.delete(terminalId);
  }

  public dispose(): void {
    this.isDisposed = true;
    this.lastNotifiedAt.clear();
    this.lastGlobalNotifiedAt = 0;
  }
}
