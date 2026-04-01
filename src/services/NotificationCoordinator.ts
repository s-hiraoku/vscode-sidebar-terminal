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

    this.audioService.playNotification(terminalId);
    this.toastService.showWaitingNotification(terminalId, waitingType);
    this.nativeService.notifyAndActivate(
      terminalId,
      NOTIFICATION_TITLE,
      `CLI Agent is ${getWaitingTypeLabel(waitingType)} (${terminalId})`
    );
  }

  public notifyCompleted(terminalId: string, agentType?: AgentType | null): void {
    if (this.isDisposed) {
      return;
    }

    this.toastService.showCompletedNotification(terminalId, agentType);
    this.nativeService.notifyAndActivate(
      terminalId,
      NOTIFICATION_TITLE,
      `${getAgentDisplayName(agentType)} has completed (${terminalId})`
    );
  }

  public clearTerminal(terminalId: string): void {
    this.audioService.clearTerminal(terminalId);
    this.toastService.clearTerminal(terminalId);
    this.nativeService.clearTerminal(terminalId);
  }

  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.audioService.dispose();
    this.toastService.dispose();
    this.nativeService.dispose();
  }
}
