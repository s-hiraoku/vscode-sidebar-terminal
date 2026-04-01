import * as vscode from 'vscode';
import * as path from 'path';
import { terminal as log } from '../utils/logger';

const SETTING_PREFIX = 'secondaryTerminal';
const EXEC_TIMEOUT_MS = 5000;
const ALLOWED_EXTENSIONS = new Set(['.aiff', '.wav', '.mp3', '.ogg', '.flac', '.m4a']);

const DEFAULT_SOUNDS: Record<string, string> = {
  darwin: '/System/Library/Sounds/Glass.aiff',
  win32: '',
  linux: '',
};

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;
type ExecFileFn = (
  cmd: string,
  args: string[],
  opts: Record<string, unknown>,
  callback: ExecFileCallback
) => { kill: (signal?: string) => boolean };

export class AudioNotificationService implements vscode.Disposable {
  private readonly lastPlayedAt = new Map<string, number>();
  private lastGlobalPlayedAt = 0;
  private readonly activeProcesses = new Set<{ kill: (signal?: string) => boolean }>();
  private isDisposed = false;
  private _execFile: ExecFileFn | undefined;

  private getExecFile(): ExecFileFn {
    if (!this._execFile) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this._execFile = require('child_process').execFile;
    }
    return this._execFile!;
  }

  private getConfig() {
    const config = vscode.workspace.getConfiguration(SETTING_PREFIX);
    return {
      enabled: config.get<boolean>('agentWaitingNotification.enabled', true),
      soundFile: config.get<string>('agentWaitingNotification.soundFile', ''),
      volume: config.get<number>('agentWaitingNotification.volume', 50),
      cooldownMs: Math.max(
        1000,
        Math.min(60000, config.get<number>('agentWaitingNotification.cooldownMs', 5000))
      ),
    };
  }

  private validateSoundFile(filePath: string): boolean {
    if (!filePath) {
      return false;
    }
    if (!path.isAbsolute(filePath)) {
      log('[AUDIO] Sound file path must be absolute:', filePath);
      return false;
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      log('[AUDIO] Unsupported audio file extension:', ext);
      return false;
    }
    return true;
  }

  public playNotification(terminalId: string): void {
    if (this.isDisposed) {
      return;
    }

    const config = this.getConfig();

    if (!config.enabled) {
      return;
    }

    const now = Date.now();

    if (now - this.lastGlobalPlayedAt < config.cooldownMs) {
      return;
    }

    const lastPlayed = this.lastPlayedAt.get(terminalId) ?? 0;
    if (now - lastPlayed < config.cooldownMs) {
      return;
    }

    this.lastPlayedAt.set(terminalId, now);
    this.lastGlobalPlayedAt = now;

    const soundFile = config.soundFile || DEFAULT_SOUNDS[process.platform] || '';
    if (!this.validateSoundFile(soundFile)) {
      return;
    }

    const volume = Math.max(0, Math.min(100, config.volume)) / 100;

    this.playPlatformSound(soundFile, volume);
  }

  private trackProcess(proc: { kill: (signal?: string) => boolean }): void {
    this.activeProcesses.add(proc);
  }

  private untrackProcess(proc: { kill: (signal?: string) => boolean }): void {
    this.activeProcesses.delete(proc);
  }

  private playPlatformSound(soundFile: string, volume: number): void {
    const exec = this.getExecFile();
    const opts = { timeout: EXEC_TIMEOUT_MS };
    try {
      switch (process.platform) {
        case 'darwin': {
          const proc = exec('afplay', ['-v', String(volume), soundFile], opts, (err) => {
            this.untrackProcess(proc);
            if (err) {
              log('[AUDIO] macOS playback failed:', err.message);
            }
          });
          this.trackProcess(proc);
          break;
        }

        case 'win32': {
          const script =
            '$p = New-Object System.Media.SoundPlayer -ArgumentList $args[0]; $p.PlaySync()';
          const proc = exec(
            'powershell',
            ['-NoProfile', '-NonInteractive', '-Command', script, soundFile],
            opts,
            (err) => {
              this.untrackProcess(proc);
              if (err) {
                log('[AUDIO] Windows playback failed:', err.message);
              }
            }
          );
          this.trackProcess(proc);
          break;
        }

        case 'linux': {
          const proc = exec('paplay', [soundFile], opts, (err) => {
            this.untrackProcess(proc);
            if (err) {
              const proc2 = exec('aplay', [soundFile], opts, (err2) => {
                this.untrackProcess(proc2);
                if (err2) {
                  log('[AUDIO] Linux playback failed:', err2.message);
                }
              });
              this.trackProcess(proc2);
            }
          });
          this.trackProcess(proc);
          break;
        }

        default:
          log('[AUDIO] Unsupported platform:', process.platform);
      }
    } catch (error) {
      log('[AUDIO] Playback error:', error);
    }
  }

  public clearTerminal(terminalId: string): void {
    this.lastPlayedAt.delete(terminalId);
  }

  public dispose(): void {
    this.isDisposed = true;
    for (const proc of this.activeProcesses) {
      try {
        proc.kill();
      } catch {
        // Process may already be dead
      }
    }
    this.activeProcesses.clear();
    this.lastPlayedAt.clear();
    this.lastGlobalPlayedAt = 0;
  }
}
