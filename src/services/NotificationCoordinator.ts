import * as vscode from 'vscode';
import { AudioNotificationService } from './AudioNotificationService';
import { ToastNotificationService } from './ToastNotificationService';
import { NativeNotificationService } from './NativeNotificationService';
import {
  getAgentDisplayName,
  getWaitingTypeLabel,
  NOTIFICATION_TITLE,
  type WaitingType,
} from './agentConstants';
import { terminal as log } from '../utils/logger';
import type { AgentType } from '../types/shared';

export class NotificationCoordinator implements vscode.Disposable {
  private isDisposed = false;

  constructor(
    private readonly audioService: AudioNotificationService,
    private readonly toastService: ToastNotificationService,
    private readonly nativeService: NativeNotificationService
  ) {}

  public notifyWaiting(terminalId: string, waitingType?: WaitingType): void {
    if (this.isDisposed) {
      return;
    }

    if (waitingType !== 'idle') {
      this.safeCall(() => this.audioService.playNotification(terminalId));
    }
    this.safeCall(() => this.toastService.showWaitingNotification(terminalId, waitingType));
    if (waitingType !== 'idle') {
      this.safeCall(() => {
        const title = NOTIFICATION_TITLE;
        const message = this.getWaitingMessage(terminalId, waitingType);
        this.nativeService.notifyWaiting(terminalId, title, message);
      });
    }
  }

  public notifyCompleted(terminalId: string, agentType?: AgentType | null): void {
    if (this.isDisposed) {
      return;
    }

    this.safeCall(() => this.toastService.showCompletedNotification(terminalId, agentType));
    this.safeCall(() =>
      this.nativeService.notifyCompleted(
        terminalId,
        NOTIFICATION_TITLE,
        `${getAgentDisplayName(agentType)} has completed (${terminalId})`
      )
    );
  }

  public clearTerminal(terminalId: string): void {
    if (this.isDisposed) {
      return;
    }

    this.safeCall(() => this.audioService.clearTerminal(terminalId));
    this.safeCall(() => this.toastService.clearTerminal(terminalId));
    this.safeCall(() => this.nativeService.clearTerminal(terminalId));
  }

  private getWaitingMessage(terminalId: string, waitingType?: WaitingType): string {
    return `CLI Agent is ${getWaitingTypeLabel(waitingType)} (${terminalId})`;
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.safeCall(() => this.audioService.dispose());
    this.safeCall(() => this.toastService.dispose());
    this.safeCall(() => this.nativeService.dispose());
  }

  private safeCall(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      log('[NOTIFICATION] Error in notification service:', error);
    }
  }
}
