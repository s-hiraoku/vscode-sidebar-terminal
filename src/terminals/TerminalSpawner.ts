import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
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

    log(
      `🔧 [SPAWNER] Spawning PTY for ${request.terminalId} (shell=${request.shell}, cwd=${request.cwd})`
    );

    const ptyProcess = pty.spawn(request.shell, request.shellArgs, {
      name: 'xterm-256color',
      cols: TERMINAL_CONSTANTS.DEFAULT_COLS,
      rows: TERMINAL_CONSTANTS.DEFAULT_ROWS,
      cwd: request.cwd,
      env,
    });

    log(`✅ [SPAWNER] PTY spawned successfully for ${request.terminalId} (pid=${ptyProcess.pid})`);

    return { ptyProcess };
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
      BASH_ENV: baseEnv.BASH_ENV,
      ENV: baseEnv.ENV,
    };
  }
}

