import * as fs from 'fs';
import * as pty from 'node-pty';
import { TERMINAL_CONSTANTS } from '../constants';
import { terminal as log } from '../utils/logger';

export interface TerminalSpawnRequest {
  terminalId: string;
  shell: string;
  shellArgs: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface TerminalSpawnResult {
  ptyProcess: pty.IPty;
}

/**
 * Lightweight helper responsible only for spawning PTY processes.
 * Keeps TerminalManager focused on orchestration and event wiring.
 */
export class TerminalSpawner {
  spawnTerminal(request: TerminalSpawnRequest): TerminalSpawnResult {
    const env = this.buildSpawnEnv(request.env);

    const candidateCwds = this.getCandidateWorkingDirectories(request.cwd, env.HOME);

    const attemptedShells = this.getCandidateShells(request.shell);

    let lastError: unknown = null;

    for (const cwd of candidateCwds) {
      if (!this.isDirectoryAccessible(cwd)) {
        log(`⚠️ [SPAWNER] Skipping inaccessible cwd candidate: ${cwd}`);
        continue;
      }

      for (const shell of attemptedShells) {
        try {
          log(
            `🔧 [SPAWNER] Attempting PTY spawn for ${request.terminalId} (shell=${shell}, cwd=${cwd})`
          );

          const ptyProcess = pty.spawn(shell, request.shellArgs, {
            name: 'xterm-256color',
            cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
            rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
            cwd,
            env,
          });

          log(
            `✅ [SPAWNER] PTY spawned successfully for ${request.terminalId} (pid=${ptyProcess.pid}, shell=${shell}, cwd=${cwd})`
          );

          return { ptyProcess };
        } catch (error) {
          lastError = error;
          const err = error as NodeJS.ErrnoException;
          log(
            `❌ [SPAWNER] PTY spawn failed for shell=${shell} cwd=${cwd}: ${err?.message || error}`
          );
          // Try next fallback shell/cwd
        }
      }
    }

    log('❌ [SPAWNER] All spawn attempts failed. Throwing last error.');
    throw lastError ?? new Error('Failed to spawn PTY process');
  }

  private buildSpawnEnv(baseEnv: Record<string, string>): Record<string, string> {
    return {
      ...baseEnv,
      LANG: baseEnv.LANG || 'en_US.UTF-8',
      LC_ALL: baseEnv.LC_ALL || 'en_US.UTF-8',
      LC_CTYPE: baseEnv.LC_CTYPE || 'en_US.UTF-8',
      TERM: baseEnv.TERM || 'xterm-256color',
      COLORTERM: baseEnv.COLORTERM || 'truecolor',
      // Force interactive shell behavior and prompt display
      PS1: baseEnv.PS1 || '$ ',
      FORCE_COLOR: '1',
      // Ensure shell reads initialization files
      ...(baseEnv.BASH_ENV && { BASH_ENV: baseEnv.BASH_ENV }),
      ...(baseEnv.ENV && { ENV: baseEnv.ENV }),
    };
  }

  private getCandidateShells(primaryShell: string): string[] {
    const fallbacks = ['/bin/zsh', '/bin/bash', '/bin/sh'];
    const candidates = [primaryShell, ...fallbacks];
    const seen = new Set<string>();
    return candidates.filter((shellPath) => {
      if (!shellPath) {
        return false;
      }
      const normalized = shellPath.trim();
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private getCandidateWorkingDirectories(requestedCwd: string, home?: string): string[] {
    const candidates = [requestedCwd];
    if (home) {
      candidates.push(home);
    }
    // Only add process.cwd() if it's not root directory
    const currentCwd = process.cwd();
    if (currentCwd && currentCwd !== '/') {
      candidates.push(currentCwd);
    }
    // Add home directory as last fallback if available
    if (home && !candidates.includes(home)) {
      candidates.push(home);
    }
    // Ensure we have at least one valid directory (fallback to /tmp)
    if (candidates.filter((c) => !!c).length === 0) {
      candidates.push('/tmp');
    }
    return candidates.filter((cwd, index, arr) => !!cwd && arr.indexOf(cwd) === index);
  }

  private isDirectoryAccessible(dirPath: string): boolean {
    try {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return false;
      }
      fs.accessSync(dirPath, fs.constants.R_OK | fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
}
