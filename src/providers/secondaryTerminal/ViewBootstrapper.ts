import * as vscode from 'vscode';
import { provider as log } from '../../utils/logger';
import {
  MessageBridge,
  WebviewMessageHandler,
  WebviewMessageValidator,
} from './MessageBridge';
import { PanelLocationController } from './PanelLocationController';

export interface ViewBootstrapperHooks {
  handleMessage: WebviewMessageHandler;
  validateMessage: WebviewMessageValidator;
  configureWebview(view: vscode.WebviewView): void;
  initializeMessageHandlers(): void | Promise<void>;
  initializeWebviewContent(view: vscode.WebviewView): void | Promise<void>;
  registerCoreListeners(): void | Promise<void>;
}

export class ViewBootstrapper {
  constructor(
    private readonly messageBridge: MessageBridge,
    private readonly panelLocationController: PanelLocationController,
    private readonly logger: typeof log = log
  ) {}

  public async bootstrap(webviewView: vscode.WebviewView, hooks: ViewBootstrapperHooks): Promise<void> {
    this.logger('🚀 [BOOTSTRAP] Starting Secondary Terminal webview setup');

    this.messageBridge.register(webviewView, hooks.validateMessage, hooks.handleMessage);
    await Promise.resolve(hooks.initializeMessageHandlers());

    hooks.configureWebview(webviewView);
    this.panelLocationController.registerVisibilityListener(webviewView);

    await Promise.resolve(hooks.initializeWebviewContent(webviewView));
    await Promise.resolve(hooks.registerCoreListeners());

    await this.panelLocationController.setupPanelLocationChangeListener(webviewView);

    this.logger('✅ [BOOTSTRAP] Webview setup complete');
  }
}
