import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import {
  PanelLocationService,
  PanelLocation,
  SplitDirection,
} from '../services/PanelLocationService';
import { WebviewMessage } from '../../types/common';
import { TerminalManager } from '../../terminals/TerminalManager';

export interface PanelLocationControllerOptions {
  extensionContext: vscode.ExtensionContext;
  terminalManager: TerminalManager;
  sendMessage: (message: WebviewMessage) => Promise<void>;
  panelLocationService?: PanelLocationService;
  logger?: typeof log;
}

export class PanelLocationController implements vscode.Disposable {
  private readonly panelLocationService: PanelLocationService;
  private readonly logger: typeof log;

  constructor(private readonly options: PanelLocationControllerOptions) {
    this.logger = options.logger ?? log;
    this.panelLocationService =
      options.panelLocationService ||
      new PanelLocationService((message: unknown) =>
        options.sendMessage(message as WebviewMessage)
      );
  }

  public async handleReportPanelLocation(message: WebviewMessage): Promise<void> {
    await this.panelLocationService.handlePanelLocationReport(
      (message as WebviewMessage & { location?: unknown }).location,
      async (_oldLocation, _newLocation) => {
        const terminalCount = this.options.terminalManager.getTerminals().length;
        if (terminalCount < 2) {
          return;
        }

        const splitDirection = this.panelLocationService.determineSplitDirection();
        await this.options.sendMessage({
          command: 'relayoutTerminals',
          direction: splitDirection,
        });
      }
    );
  }

  public registerVisibilityListener(webviewView: vscode.WebviewView): void {
    const disposable = webviewView.onDidChangeVisibility?.(() => {
      if (!webviewView.visible) {
        return;
      }

      setTimeout(() => {
        void this.panelLocationService.requestPanelLocationDetection();
      }, 500);
    });

    if (disposable) {
      this.options.extensionContext.subscriptions.push(disposable);
    }
  }

  public async setupPanelLocationChangeListener(webviewView: vscode.WebviewView): Promise<void> {
    await this.panelLocationService.initialize(webviewView);

    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('secondaryTerminal.panelLocation') ||
        event.affectsConfiguration('secondaryTerminal.dynamicSplitDirection')
      ) {
        void this.panelLocationService.requestPanelLocationDetection();
      }
    });

    this.options.extensionContext.subscriptions.push(disposable);
  }

  public requestPanelLocationDetection(): void {
    void this.panelLocationService.requestPanelLocationDetection();
  }

  public determineSplitDirection(): SplitDirection {
    return this.panelLocationService.determineSplitDirection();
  }

  public getCurrentPanelLocation(): PanelLocation {
    return this.panelLocationService.getCurrentPanelLocation();
  }

  public getCachedPanelLocation(): PanelLocation {
    return this.panelLocationService.getCachedPanelLocation();
  }

  public dispose(): void {
    this.panelLocationService.dispose();
  }
}
