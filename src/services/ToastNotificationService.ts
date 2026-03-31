import * as vscode from 'vscode';
import { terminal as log } from '../utils/logger';
import type { AgentType } from '../types/shared';
import { getAgentDisplayName, getWaitingTypeLabel } from './agentConstants';

const SETTING_PREFIX = 'secondaryTerminal';
const STATUS_BAR_DISPLAY_MS = 5000;

export class ToastNotificationService implements vscode.Disposable {
  private readonly lastNotifiedAt = new Map<string, number>();
  private lastGlobalNotifiedAt = 0;
  private isDisposed = false;

  private getConfig() {
    const config = vscode.workspace.getConfiguration(SETTING_PREFIX);
    return {
      enabled: config.get<boolean>('agentToastNotification.enabled', true),
      cooldownMs: Math.max(
        1000,
        Math.min(60000, config.get<number>('agentToastNotification.cooldownMs', 10000))
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

  public showWaitingNotification(
    terminalId: string,
    waitingType?: 'input' | 'approval' | 'idle'
  ): void {
    if (this.isDisposed) {
      return;
    }

    const config = this.getConfig();
    if (!config.enabled || !this.canNotify(terminalId, config.cooldownMs)) {
      return;
    }

    const message = `CLI Agent is ${getWaitingTypeLabel(waitingType)} (${terminalId})`;

    log('[TOAST]', message);
    vscode.window.setStatusBarMessage(`$(terminal) ${message}`, STATUS_BAR_DISPLAY_MS);
  }

  public showCompletedNotification(terminalId: string, agentType?: AgentType | null): void {
    if (this.isDisposed) {
      return;
    }

    const config = this.getConfig();
    if (!config.enabled || !this.canNotify(terminalId, config.cooldownMs)) {
      return;
    }

    const agentName = getAgentDisplayName(agentType);
    const message = `${agentName} has completed (${terminalId})`;

    log('[TOAST]', message);
    vscode.window.setStatusBarMessage(`$(terminal) ${message}`, STATUS_BAR_DISPLAY_MS);
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
