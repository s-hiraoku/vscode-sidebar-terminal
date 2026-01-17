/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as vscode from 'vscode';
import { TerminalInstance, DeleteResult, ProcessState } from '../types/shared';
import { ERROR_MESSAGES } from '../constants';
import {
  getTerminalConfig,
  getShellForPlatform,
  getWorkingDirectory,
  generateTerminalId,
  generateTerminalName,
  showErrorMessage,
  showWarningMessage,
} from '../utils/common';
import { TerminalNumberManager } from '../utils/TerminalNumberManager';
import { TerminalProfileService } from '../services/TerminalProfileService';
import { TerminalCreationOverrides } from './types';
import { TerminalSpawner } from './TerminalSpawner';
import { ICliAgentDetectionService } from '../interfaces/CliAgentService';

/** Manages terminal creation and deletion lifecycle */
export class TerminalLifecycleManager {
  private readonly _terminalBeingKilled = new Set<string>();
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly _terminals: Map<string, TerminalInstance>,
    private readonly _terminalNumberManager: TerminalNumberManager,
    private readonly _profileService: TerminalProfileService,
    private readonly _terminalSpawner: TerminalSpawner,
    private readonly _cliAgentService: ICliAgentDetectionService,
    private readonly _terminalCreatedEmitter: vscode.EventEmitter<TerminalInstance>,
    private readonly _terminalRemovedEmitter: vscode.EventEmitter<string>,
    private readonly _exitEmitter: vscode.EventEmitter<any>,
    private readonly _setupEventsCallback: (terminal: TerminalInstance) => void,
    private readonly _notifyStateUpdateCallback: () => void,
    private readonly _cleanupTerminalDataCallback: (terminalId: string) => void
  ) {}

  private async resolveTerminalProfile(requestedProfile?: string): Promise<{
    shell: string;
    shellArgs: string[];
    cwd?: string;
    env?: Record<string, string | null>;
  }> {
    try {
      const profileResult = await this._profileService.resolveProfile(requestedProfile);
      return {
        shell: profileResult.profile.path,
        shellArgs: profileResult.profile.args || [],
        cwd: profileResult.profile.cwd,
        env: profileResult.profile.env,
      };
    } catch {
      const config = getTerminalConfig();
      return { shell: getShellForPlatform(), shellArgs: config.shellArgs || [] };
    }
  }

  public async createTerminalWithProfile(
    profileName?: string,
    overrides?: TerminalCreationOverrides
  ): Promise<string> {
    if (!this._terminalNumberManager.canCreate(this._terminals)) {
      showWarningMessage(
        'Maximum number of terminals reached. Please close some terminals before creating new ones.'
      );
      return '';
    }

    const terminalId = generateTerminalId();
    const profileConfig = await this.resolveTerminalProfile(profileName);
    const cwd = profileConfig.cwd || getWorkingDirectory();

    try {
      const env = {
        ...process.env,
        PWD: cwd,
        ...(vscode.workspace.workspaceFolders?.[0] && {
          VSCODE_WORKSPACE: vscode.workspace.workspaceFolders[0].uri.fsPath || '',
          VSCODE_PROJECT_NAME: vscode.workspace.workspaceFolders[0].name || '',
        }),
        ...(profileConfig.env && profileConfig.env),
      } as { [key: string]: string };

      const { ptyProcess } = this._terminalSpawner.spawnTerminal({
        terminalId,
        shell: profileConfig.shell,
        shellArgs: profileConfig.shellArgs || [],
        cwd,
        env,
      });

      const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
      if (!terminalNumber) {
        throw new Error('Unable to assign terminal number');
      }

      const terminal: TerminalInstance = {
        id: terminalId,
        name: generateTerminalName(terminalNumber),
        number: terminalNumber,
        pty: ptyProcess,
        ptyProcess,
        cwd,
        isActive: false,
        createdAt: new Date(),
        creationDisplayModeOverride: overrides?.displayModeOverride,
      };

      this._terminals.set(terminalId, terminal);
      this._setupEventsCallback(terminal);
      this._terminalCreatedEmitter.fire(terminal);
      this._notifyStateUpdateCallback();

      return terminalId;
    } catch (error) {
      showErrorMessage(`Failed to create terminal: ${error}`);
      return '';
    }
  }

  public createTerminal(overrides?: TerminalCreationOverrides): string {
    const config = getTerminalConfig();
    const canCreateResult = this._terminalNumberManager.canCreate(this._terminals);

    if (!canCreateResult) {
      // Edge case: if terminals map is empty but canCreate returns false, force creation
      if (this._terminals.size !== 0) {
        showWarningMessage(`${ERROR_MESSAGES.MAX_TERMINALS_REACHED} (${config.maxTerminals})`);
        return '';
      }
    }

    const terminalNumber = this._terminalNumberManager.findAvailableNumber(this._terminals);
    const terminalId = generateTerminalId();
    const shell = getShellForPlatform();
    const cwd = getWorkingDirectory();

    try {
      const env = {
        ...process.env,
        PWD: cwd,
        ...(vscode.workspace.workspaceFolders?.[0] && {
          VSCODE_WORKSPACE: vscode.workspace.workspaceFolders[0].uri.fsPath || '',
          VSCODE_PROJECT_NAME: vscode.workspace.workspaceFolders[0].name || '',
        }),
      } as { [key: string]: string };

      const { ptyProcess } = this._terminalSpawner.spawnTerminal({
        terminalId,
        shell,
        shellArgs: config.shellArgs || [],
        cwd,
        env,
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        pty: ptyProcess,
        ptyProcess: ptyProcess,
        name: generateTerminalName(terminalNumber),
        number: terminalNumber,
        cwd: cwd,
        isActive: true,
        createdAt: new Date(),
        creationDisplayModeOverride: overrides?.displayModeOverride,
      };

      this._terminals.set(terminalId, terminal);
      this._setupEventsCallback(terminal);
      this._terminalCreatedEmitter.fire(terminal);
      this._notifyStateUpdateCallback();

      return terminalId;
    } catch (error) {
      showErrorMessage(
        ERROR_MESSAGES.TERMINAL_CREATION_FAILED,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private validateDeletion(terminalId: string): { canDelete: boolean; reason?: string } {
    if (!this._terminals.has(terminalId)) {
      return { canDelete: false, reason: 'Terminal not found' };
    }
    if (this._terminals.size <= 1) {
      return { canDelete: false, reason: 'Must keep at least 1 terminal open' };
    }
    return { canDelete: true };
  }

  public canRemoveTerminal(terminalId: string): { canRemove: boolean; reason?: string } {
    const validation = this.validateDeletion(terminalId);
    return { canRemove: validation.canDelete, reason: validation.reason };
  }

  public async deleteTerminal(
    terminalId: string,
    options: { force?: boolean; source?: 'header' | 'panel' | 'command' } = {}
  ): Promise<DeleteResult> {
    return new Promise<DeleteResult>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(() => {
        try {
          resolve(this.performDeleteOperation(terminalId, options));
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private performDeleteOperation(
    terminalId: string,
    options: { force?: boolean; source?: 'header' | 'panel' | 'command' }
  ): DeleteResult {
    const validation = this.validateDeletion(terminalId);
    if (!validation.canDelete) {
      if (!options.force) {
        showWarningMessage(validation.reason || 'Cannot delete terminal');
      }
      return { success: false, reason: validation.reason };
    }

    const terminal = this._terminals.get(terminalId);
    if (!terminal) {
      return { success: false, reason: 'Terminal not found' };
    }

    try {
      this._terminalBeingKilled.add(terminalId);
      terminal.processState = ProcessState.KilledByUser;

      const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
      if (p && typeof p.kill === 'function') {
        p.kill();
      }

      return { success: true, newState: undefined };
    } catch (error) {
      this._terminalBeingKilled.delete(terminalId);
      return { success: false, reason: `Delete failed: ${String(error)}` };
    }
  }

  public removeTerminal(terminalId: string): void {
    const terminal = this._terminals.get(terminalId);
    if (terminal) {
      try {
        const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
        if (p && typeof p.kill === 'function') {
          p.kill();
        }
      } catch {
        // Ignore errors when killing process during removal
      }
    }
    this._cleanupTerminalDataCallback(terminalId);
  }

  public getTerminal(terminalId: string): TerminalInstance | undefined {
    return this._terminals.get(terminalId);
  }

  public getTerminals(): TerminalInstance[] {
    return Array.from(this._terminals.values());
  }

  public isTerminalBeingKilled(terminalId: string): boolean {
    return this._terminalBeingKilled.has(terminalId);
  }

  public markTerminalBeingKilled(terminalId: string): void {
    this._terminalBeingKilled.add(terminalId);
  }

  public unmarkTerminalBeingKilled(terminalId: string): void {
    this._terminalBeingKilled.delete(terminalId);
  }

  public async getAvailableProfiles(): Promise<
    Record<string, import('../types/shared').TerminalProfile>
  > {
    return await this._profileService.getAvailableProfiles();
  }

  public getDefaultProfile(): string | null {
    return this._profileService.getDefaultProfile();
  }

  public dispose(): void {
    this._terminalBeingKilled.clear();
    for (const terminal of this._terminals.values()) {
      const p = (terminal.ptyProcess || terminal.pty) as { kill?: () => void } | undefined;
      try {
        if (p && typeof p.kill === 'function') {
          p.kill();
        }
      } catch {
        // Ignore errors when killing processes during dispose
      }
    }
  }
}
