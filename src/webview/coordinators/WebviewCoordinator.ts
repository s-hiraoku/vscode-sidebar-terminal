import { IManagerCoordinator } from '../interfaces/ManagerInterfaces';
import { MessageCommand } from '../managers/messageTypes';
import { PanelLocationHandler } from '../managers/handlers/PanelLocationHandler';
import { SplitHandler } from '../managers/handlers/SplitHandler';
import { ScrollbackMessageHandler } from '../managers/handlers/ScrollbackMessageHandler';
import { SerializationMessageHandler } from '../managers/handlers/SerializationMessageHandler';
import { TerminalLifecycleMessageHandler } from '../managers/handlers/TerminalLifecycleMessageHandler';
import { SettingsAndConfigMessageHandler } from '../managers/handlers/SettingsAndConfigMessageHandler';
import { ShellIntegrationMessageHandler } from '../managers/handlers/ShellIntegrationMessageHandler';
import { ProfileMessageHandler } from '../managers/handlers/ProfileMessageHandler';
import { SessionMessageController } from '../managers/controllers/SessionMessageController';
import { CliAgentMessageController } from '../managers/controllers/CliAgentMessageController';

type CommandString = MessageCommand['command'];

type CommandHandler = (
  message: MessageCommand,
  coordinator: IManagerCoordinator
) => void | Promise<void>;

interface HandlerDependencies {
  lifecycleHandler: TerminalLifecycleMessageHandler;
  settingsHandler: SettingsAndConfigMessageHandler;
  shellIntegrationHandler: ShellIntegrationMessageHandler;
  serializationHandler: SerializationMessageHandler;
  scrollbackHandler: ScrollbackMessageHandler;
  panelLocationHandler: PanelLocationHandler;
  splitHandler: SplitHandler;
  profileHandler: ProfileMessageHandler;
  sessionController: SessionMessageController;
  cliAgentController: CliAgentMessageController;
}

interface CoordinatorLogger {
  warn: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
  debug: (message: string, data?: unknown) => void;
}

export class WebviewCoordinator {
  private readonly handlers = new Map<CommandString, CommandHandler>();

  constructor(
    private readonly deps: HandlerDependencies,
    private readonly logger: CoordinatorLogger
  ) {
    this.registerHandlers();
  }

  public getRegisteredCommands(): CommandString[] {
    return Array.from(this.handlers.keys());
  }

  public async dispatch(message: MessageCommand, coordinator: IManagerCoordinator): Promise<void> {
    const handler = this.handlers.get(message.command);
    if (!handler) {
      this.logger.warn(`Unknown command: ${message.command}`);
      return;
    }

    await handler(message, coordinator);
  }

  private registerHandlers(): void {
    this.register(
      [
        'init',
        'output',
        'terminalCreated',
        'newTerminal',
        'focusTerminal',
        'setActiveTerminal',
        'deleteTerminalResponse',
        'terminalRemoved',
        'clear',
      ],
      (message, coordinator) => this.deps.lifecycleHandler.handleMessage(message, coordinator)
    );

    this.register(
      ['fontSettingsUpdate', 'settingsResponse', 'openSettings', 'versionInfo', 'stateUpdate'],
      (message, coordinator) => this.deps.settingsHandler.handleMessage(message, coordinator)
    );

    this.register(['cliAgentStatusUpdate'], (message, coordinator) =>
      this.deps.cliAgentController.handleStatusUpdateMessage(message, coordinator)
    );

    this.register(['cliAgentFullStateSync'], (message, coordinator) =>
      this.deps.cliAgentController.handleFullStateSyncMessage(message, coordinator)
    );

    this.register(['switchAiAgentResponse'], (message, coordinator) =>
      this.deps.cliAgentController.handleSwitchResponseMessage(message, coordinator)
    );

    this.register(['sessionRestore'], (message, coordinator) =>
      this.deps.sessionController.handleSessionRestoreMessage(message, coordinator)
    );

    this.register(['sessionRestoreStarted'], (message) =>
      this.deps.sessionController.handleSessionRestoreStartedMessage(message)
    );

    this.register(['sessionRestoreProgress'], (message) =>
      this.deps.sessionController.handleSessionRestoreProgressMessage(message)
    );

    this.register(['sessionRestoreCompleted'], (message) =>
      this.deps.sessionController.handleSessionRestoreCompletedMessage(message)
    );

    this.register(['sessionRestoreError'], (message) =>
      this.deps.sessionController.handleSessionRestoreErrorMessage(message)
    );

    this.register(
      [
        'getScrollback',
        'restoreScrollback',
        'scrollbackProgress',
        'extractScrollbackData',
        'restoreTerminalSessions',
      ],
      (message, coordinator) => this.deps.scrollbackHandler.handleMessage(message, coordinator)
    );

    this.register(['sessionSaved'], (message) =>
      this.deps.sessionController.handleSessionSavedMessage(message)
    );

    this.register(['sessionSaveError'], (message) =>
      this.deps.sessionController.handleSessionSaveErrorMessage(message)
    );

    this.register(['sessionCleared'], () =>
      this.deps.sessionController.handleSessionClearedMessage()
    );

    this.register(['sessionRestored'], (message) =>
      this.deps.sessionController.handleSessionRestoredMessage(message)
    );

    this.register(['shellStatus', 'cwdUpdate', 'commandHistory', 'find'], (message, coordinator) =>
      this.deps.shellIntegrationHandler.handleMessage(message, coordinator)
    );

    this.register(
      [
        'serializeTerminal',
        'restoreSerializedContent',
        'terminalRestoreInfo',
        'saveAllTerminalSessions',
        'requestTerminalSerialization',
        'restoreTerminalSerialization',
        'sessionRestorationData',
        'persistenceSaveSessionResponse',
        'persistenceRestoreSessionResponse',
        'persistenceClearSessionResponse',
      ],
      (message, coordinator) => this.deps.serializationHandler.handleMessage(message, coordinator)
    );

    this.register(['sessionRestoreSkipped'], (message) =>
      this.deps.sessionController.handleSessionRestoreSkippedMessage(message)
    );

    this.register(['terminalRestoreError'], (message) =>
      this.deps.sessionController.handleTerminalRestoreErrorMessage(message)
    );

    this.register(
      ['panelLocationUpdate', 'requestPanelLocationDetection'],
      (message, coordinator) => this.deps.panelLocationHandler.handleMessage(message, coordinator)
    );

    this.register(['split', 'relayoutTerminals'], (message, coordinator) =>
      this.deps.splitHandler.handleMessage(message, coordinator)
    );

    this.register(
      ['showProfileSelector', 'profilesUpdated', 'defaultProfileChanged'],
      (message, coordinator) => this.deps.profileHandler.handleMessage(message, coordinator)
    );
  }

  private register(commands: CommandString[], handler: CommandHandler): void {
    commands.forEach((command) => this.handlers.set(command, handler));
  }
}
