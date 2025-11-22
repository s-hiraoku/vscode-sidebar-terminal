/**
 * Terminal Message Handlers
 * Specific handlers for terminal operations extracted from SecondaryTerminalProvider
 */

import { BaseMessageHandler, MessageRouter } from '../MessageRouter';
import { safeProcessCwd } from '../../utils/common';

// Terminal operation data types
export interface CreateTerminalData {
  profile?: string;
  workingDirectory?: string;
  environmentVariables?: Record<string, string>;
}

export interface DeleteTerminalData {
  terminalId: string;
  force?: boolean;
}

export interface TerminalInputData {
  terminalId: string;
  input: string;
}

export interface TerminalResizeData {
  terminalId: string;
  cols: number;
  rows: number;
}

export interface FocusTerminalData {
  terminalId: string;
}

export interface UpdateSettingsData {
  settings: Record<string, unknown>;
}

// Extension-side service interfaces for handler dependencies
export interface ITerminalManagerForHandler {
  createTerminal(options: CreateTerminalData): Promise<string>;
  deleteTerminal(terminalId: string, force: boolean): Promise<boolean>;
  sendInput(terminalId: string, input: string): void;
  resize(terminalId: string, cols: number, rows: number): void;
  focusTerminal(terminalId: string): void;
  getActiveTerminalId(): string | null;
  getWorkingDirectory(terminalId: string): Promise<string>;
}

export interface IPersistenceServiceForHandler {
  getLastSession(): Promise<unknown>;
}

export interface IConfigServiceForHandler {
  getCurrentSettings(): Record<string, unknown>;
  updateSettings(settings: Record<string, unknown>): Promise<void>;
}

export interface INotificationServiceForHandler {
  showError(message: string): void;
  showInfo(message: string): void;
  showWarning(message: string): void;
}

// Dependencies interface with proper types
export interface TerminalMessageHandlerDependencies {
  terminalManager: ITerminalManagerForHandler;
  persistenceService: IPersistenceServiceForHandler;
  configService: IConfigServiceForHandler;
  notificationService: INotificationServiceForHandler;
}

/**
 * Handler for creating new terminals
 */
export class CreateTerminalHandler extends BaseMessageHandler<CreateTerminalData, { terminalId: string }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('CreateTerminalHandler');
  }

  public async handle(data: CreateTerminalData): Promise<{ terminalId: string }> {
    this.log('Creating new terminal');

    try {
      const terminalId = await this.dependencies.terminalManager.createTerminal({
        profile: data.profile,
        workingDirectory: data.workingDirectory,
        environmentVariables: data.environmentVariables,
      });

      this.log(`Terminal created successfully: ${terminalId}`);
      return { terminalId };

    } catch (error) {
      this.log(`Failed to create terminal: ${error}`);
      throw new Error(`Terminal creation failed: ${error}`);
    }
  }
}

/**
 * Handler for deleting terminals
 */
export class DeleteTerminalHandler extends BaseMessageHandler<DeleteTerminalData, { success: boolean }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('DeleteTerminalHandler');
  }

  public async handle(data: DeleteTerminalData): Promise<{ success: boolean }> {
    this.validateRequired(data, ['terminalId']);
    this.log(`Deleting terminal: ${data.terminalId}`);

    try {
      const success = await this.dependencies.terminalManager.deleteTerminal(
        data.terminalId,
        data.force || false
      );

      if (success) {
        this.log(`Terminal deleted successfully: ${data.terminalId}`);
      } else {
        this.log(`Failed to delete terminal: ${data.terminalId}`);
      }

      return { success };

    } catch (error) {
      this.log(`Error deleting terminal: ${error}`);
      throw new Error(`Terminal deletion failed: ${error}`);
    }
  }
}

/**
 * Handler for terminal input
 */
export class TerminalInputHandler extends BaseMessageHandler<TerminalInputData, { success: boolean }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('TerminalInputHandler');
  }

  public handle(data: TerminalInputData): { success: boolean } {
    this.validateRequired(data, ['terminalId', 'input']);

    try {
      this.dependencies.terminalManager.sendInput(data.terminalId, data.input);
      return { success: true };

    } catch (error) {
      this.log(`Error sending input to terminal ${data.terminalId}: ${error}`);
      throw new Error(`Input sending failed: ${error}`);
    }
  }
}

/**
 * Handler for terminal resize operations
 */
export class TerminalResizeHandler extends BaseMessageHandler<TerminalResizeData, { success: boolean }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('TerminalResizeHandler');
  }

  public handle(data: TerminalResizeData): { success: boolean } {
    this.validateRequired(data, ['terminalId', 'cols', 'rows']);

    if (data.cols <= 0 || data.rows <= 0) {
      throw new Error('Invalid resize dimensions: cols and rows must be positive');
    }

    try {
      this.dependencies.terminalManager.resize(data.terminalId, data.cols, data.rows);
      this.log(`Terminal resized: ${data.terminalId} (${data.cols}x${data.rows})`);
      return { success: true };

    } catch (error) {
      this.log(`Error resizing terminal ${data.terminalId}: ${error}`);
      throw new Error(`Terminal resize failed: ${error}`);
    }
  }
}

/**
 * Handler for focusing terminals
 */
export class FocusTerminalHandler extends BaseMessageHandler<FocusTerminalData, { success: boolean }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('FocusTerminalHandler');
  }

  public handle(data: FocusTerminalData): { success: boolean } {
    this.validateRequired(data, ['terminalId']);

    try {
      this.dependencies.terminalManager.focusTerminal(data.terminalId);
      this.log(`Terminal focused: ${data.terminalId}`);
      return { success: true };

    } catch (error) {
      this.log(`Error focusing terminal ${data.terminalId}: ${error}`);
      throw new Error(`Terminal focus failed: ${error}`);
    }
  }
}

/**
 * Handler for getting terminal settings
 */
export class GetSettingsHandler extends BaseMessageHandler<void, { settings: Record<string, unknown> }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('GetSettingsHandler');
  }

  public handle(): { settings: Record<string, unknown> } {
    try {
      const settings = this.dependencies.configService.getCurrentSettings();
      return { settings };

    } catch (error) {
      this.log(`Error getting settings: ${error}`);
      throw new Error(`Failed to get settings: ${error}`);
    }
  }
}

/**
 * Handler for updating settings
 */
export class UpdateSettingsHandler extends BaseMessageHandler<UpdateSettingsData, { success: boolean }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('UpdateSettingsHandler');
  }

  public async handle(data: UpdateSettingsData): Promise<{ success: boolean }> {
    this.validateRequired(data, ['settings']);

    try {
      await this.dependencies.configService.updateSettings(data.settings);
      this.log('Settings updated successfully');
      return { success: true };

    } catch (error) {
      this.log(`Error updating settings: ${error}`);
      throw new Error(`Settings update failed: ${error}`);
    }
  }
}

/**
 * Handler for session restoration requests
 */
export class SessionRestorationHandler extends BaseMessageHandler<void, { sessionData: unknown }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('SessionRestorationHandler');
  }

  public async handle(): Promise<{ sessionData: unknown }> {
    try {
      const sessionData = await this.dependencies.persistenceService.getLastSession();
      this.log('Session data retrieved successfully');
      return { sessionData };

    } catch (error) {
      this.log(`Error retrieving session data: ${error}`);
      throw new Error(`Session retrieval failed: ${error}`);
    }
  }
}

/**
 * Handler for split terminal operations
 */
export class SplitTerminalHandler extends BaseMessageHandler<{ direction?: 'horizontal' | 'vertical' }, { terminalId: string }> {
  constructor(private dependencies: TerminalMessageHandlerDependencies) {
    super('SplitTerminalHandler');
  }

  public async handle(data: { direction?: 'horizontal' | 'vertical' }): Promise<{ terminalId: string }> {
    try {
      // Create a new terminal for the split
      const terminalId = await this.dependencies.terminalManager.createTerminal({
        // Split terminal inherits current working directory
        workingDirectory: await this.getCurrentWorkingDirectory(),
      });

      this.log(`Split terminal created: ${terminalId} (${data.direction || 'default'})`);
      return { terminalId };

    } catch (error) {
      this.log(`Error creating split terminal: ${error}`);
      throw new Error(`Split terminal creation failed: ${error}`);
    }
  }

  private async getCurrentWorkingDirectory(): Promise<string> {
    // Get current working directory from active terminal or default
    try {
      const activeTerminalId = this.dependencies.terminalManager.getActiveTerminalId();
      if (activeTerminalId) {
        return await this.dependencies.terminalManager.getWorkingDirectory(activeTerminalId);
      }
    } catch (error) {
      this.log(`Could not get working directory: ${error}`);
    }

    return safeProcessCwd(); // Fallback to process working directory
  }
}

/**
 * Factory for creating terminal message handlers
 */
export class TerminalMessageHandlerFactory {
  public static createAllHandlers(
    dependencies: TerminalMessageHandlerDependencies
  ): Map<string, BaseMessageHandler> {
    const handlers = new Map<string, BaseMessageHandler>();

    handlers.set('createTerminal', new CreateTerminalHandler(dependencies));
    handlers.set('deleteTerminal', new DeleteTerminalHandler(dependencies));
    handlers.set('terminalInput', new TerminalInputHandler(dependencies));
    handlers.set('terminalResize', new TerminalResizeHandler(dependencies));
    handlers.set('focusTerminal', new FocusTerminalHandler(dependencies));
    handlers.set('getSettings', new GetSettingsHandler(dependencies));
    handlers.set('updateSettings', new UpdateSettingsHandler(dependencies));
    handlers.set('sessionRestore', new SessionRestorationHandler(dependencies));
    handlers.set('splitTerminal', new SplitTerminalHandler(dependencies));

    return handlers;
  }

  public static registerAllHandlers(
    messageRouter: MessageRouter,
    dependencies: TerminalMessageHandlerDependencies
  ): void {
    const handlers = TerminalMessageHandlerFactory.createAllHandlers(dependencies);

    for (const [command, handler] of handlers) {
      messageRouter.registerHandler(command, handler);
    }
  }
}

// Re-export MessageRouter type for external use
export type { MessageRouter } from '../MessageRouter';