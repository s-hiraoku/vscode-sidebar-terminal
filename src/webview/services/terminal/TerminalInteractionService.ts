import { Terminal } from '@xterm/xterm';
import { IConfigManager } from '../../interfaces/ManagerInterfaces';
import { LifecycleController } from '../../controllers/LifecycleController';
import { TerminalEventManager } from '../../managers/TerminalEventManager';
import { EventHandlerRegistry } from '../../utils/EventHandlerRegistry';
import { terminalLogger } from '../../utils/ManagerLogger';
import { isMacPlatform } from '../../utils/PlatformUtils';
import { TerminalFocusService } from './TerminalFocusService';

interface ICoordinatorDependencies {
  postMessageToExtension(message: unknown): void;
  shellIntegrationManager?: {
    decorateTerminalOutput(terminal: Terminal, terminalId: string): void;
  };
}

export interface IDependencies {
  coordinator: ICoordinatorDependencies;
  eventRegistry: EventHandlerRegistry;
  lifecycleController: LifecycleController;
  eventManager: TerminalEventManager;
  focusService: TerminalFocusService;
}

type TerminalConfigManager = Pick<IConfigManager, 'getCurrentFontSettings' | 'getCurrentSettings'>;

export class TerminalInteractionService {
  constructor(private readonly dependencies: IDependencies) {}

  public setupTerminalInteraction(params: {
    terminalId: string;
    terminal: Terminal;
    container: HTMLElement;
    terminalContent: HTMLElement;
    currentSettings: unknown;
    currentFontSettings: unknown;
    configManager: TerminalConfigManager | undefined;
    uiManager: unknown;
    applyPostOpenSettings: (params: {
      terminalId: string;
      terminal: Terminal;
      container: HTMLElement;
      terminalContent: HTMLElement;
      currentSettings: unknown;
      currentFontSettings: unknown;
      configManager: TerminalConfigManager | undefined;
      uiManager: unknown;
    }) => void;
  }): void {
    const {
      terminalId,
      terminal,
      container,
      terminalContent,
      currentSettings,
      currentFontSettings,
      configManager,
      uiManager,
      applyPostOpenSettings,
    } = params;

    terminal.open(terminalContent);
    terminalLogger.info(`✅ Terminal opened in container: ${terminalId}`);

    this.setupPasteHandling(terminalId, terminal, terminalContent);
    applyPostOpenSettings({
      terminalId,
      terminal,
      container,
      terminalContent,
      currentSettings,
      currentFontSettings,
      configManager,
      uiManager,
    });

    this.dependencies.lifecycleController.attachTerminal(terminalId, terminal);
    this.dependencies.eventManager.setupTerminalEvents(terminal, terminalId, container);
    this.dependencies.focusService.ensureTerminalFocus(terminal, terminalId, terminalContent);
    this.dependencies.focusService.setupContainerFocusHandler(
      terminal,
      terminalId,
      container,
      terminalContent
    );
    this.setupShellIntegration(terminal, terminalId);
  }

  private setupPasteHandling(
    terminalId: string,
    terminal: Terminal,
    terminalContent: HTMLElement
  ): void {
    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const mac = isMacPlatform();

      if ((mac && event.metaKey && event.key === 'v') || (event.ctrlKey && event.key === 'v' && !event.shiftKey)) {
        terminalLogger.info('📋 Paste keydown - bypassing xterm.js key handler');
        return false;
      }

      if (
        document.body.classList.contains('panel-navigation-enabled') &&
        event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key.toLowerCase() === 'p'
      ) {
        return false;
      }

      if (document.body.classList.contains('panel-navigation-mode')) {
        const key = event.key.toLowerCase();
        if (
          key === 'h' ||
          key === 'j' ||
          key === 'k' ||
          key === 'l' ||
          key === 'arrowleft' ||
          key === 'arrowright' ||
          key === 'arrowup' ||
          key === 'arrowdown' ||
          key === 'escape' ||
          key === 'r' ||
          key === 'd' ||
          key === 'x'
        ) {
          return false;
        }
      }

      return true;
    });

    const pasteHandler = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        terminalLogger.warn('📋 Paste event has no clipboardData');
        return;
      }

      const hasImage = Array.from(clipboardData.items).some((item) =>
        item.type.startsWith('image/')
      );

      if (hasImage) {
        terminalLogger.info('🖼️ Image in paste event - sending Ctrl+V escape for Claude Code');
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dependencies.coordinator.postMessageToExtension({
          command: 'input',
          terminalId,
          data: '\x16',
        });
        return;
      }

      const text = clipboardData.getData('text/plain');
      if (text) {
        terminalLogger.info(`📋 Text paste (${text.length} chars) - sending to extension`);
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dependencies.coordinator.postMessageToExtension({
          command: 'pasteText',
          terminalId,
          text,
        });
        return;
      }

      terminalLogger.warn('📋 Paste event has no text or image content');
    };

    this.dependencies.eventRegistry.register(
      `terminal-${terminalId}-paste`,
      terminalContent,
      'paste',
      pasteHandler as EventListener,
      true
    );
  }

  private setupShellIntegration(terminal: Terminal, terminalId: string): void {
    try {
      this.dependencies.coordinator.shellIntegrationManager?.decorateTerminalOutput(
        terminal,
        terminalId
      );
      terminalLogger.info(`Shell integration decorations added for terminal: ${terminalId}`);
    } catch (error) {
      terminalLogger.warn(`Failed to setup shell integration for terminal ${terminalId}:`, error);
    }
  }
}
