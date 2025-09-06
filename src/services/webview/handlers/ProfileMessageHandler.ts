/**
 * Profile Message Handler
 * Handles terminal profile-related messages from WebView
 */

import { provider as log } from '../../../utils/logger';
import { WebviewMessage } from '../../../types/shared';
import { IMessageHandler, IMessageHandlerContext } from '../interfaces';

export class ProfileMessageHandler implements IMessageHandler {
  public readonly supportedCommands = [
    'getProfiles',
    'createTerminalWithProfile', 
    'selectProfile',
    'createProfile',
    'updateProfile',
    'deleteProfile',
    'setDefaultProfile'
  ];

  public canHandle(message: WebviewMessage): boolean {
    return this.supportedCommands.includes(message.command);
  }

  public async handle(
    message: WebviewMessage, 
    context: IMessageHandlerContext
  ): Promise<void> {
    await this.handleMessage(message, context);
  }

  public async handleMessage(
    message: WebviewMessage, 
    context: IMessageHandlerContext
  ): Promise<boolean> {
    const { profileManager } = context;

    if (!profileManager) {
      log('⚠️ [PROFILE-HANDLER] Profile Manager not available');
      return false;
    }

    switch (message.command) {
      case 'getProfiles':
        return this._handleGetProfiles(message, context);

      case 'createTerminalWithProfile':
        return this._handleCreateTerminalWithProfile(message, context);

      case 'selectProfile':
        return this._handleSelectProfile(message, context);

      case 'createProfile':
        return this._handleCreateProfile(message, context);

      case 'updateProfile':
        return this._handleUpdateProfile(message, context);

      case 'deleteProfile':
        return this._handleDeleteProfile(message, context);

      case 'setDefaultProfile':
        return this._handleSetDefaultProfile(message, context);

      default:
        return false;
    }
  }

  private async _handleGetProfiles(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const { profileManager, sendMessage } = context;
      const profiles = profileManager.getProfiles();
      const defaultProfile = profileManager.getDefaultProfile();

      await sendMessage({
        command: 'profilesResponse',
        profiles: profiles,
        profileId: defaultProfile.id
      });

      log(`🎯 [PROFILE-HANDLER] Sent ${profiles.length} profiles to WebView`);
      return true;

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error getting profiles:', error);
      await this._sendErrorResponse(context, 'Failed to get profiles', error);
      return true;
    }
  }

  private async _handleCreateTerminalWithProfile(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const { profileManager, terminalManager, sendMessage } = context;
      const profileId = message.profileId;

      if (!profileId) {
        throw new Error('Profile ID is required');
      }

      // Create terminal with profile
      const result = profileManager.createTerminalWithProfile(
        profileId, 
        message.profileOptions
      );

      // Use terminal manager to create actual terminal
      const terminalId = await terminalManager.createTerminal();

      // Set as active terminal
      terminalManager.setActiveTerminal(terminalId);

      // Send success response
      await sendMessage({
        command: 'terminalCreated',
        terminalId: terminalId,
        terminalName: result.config.name || 'Terminal',
        profile: result.profile
      });

      log(`🎯 [PROFILE-HANDLER] Created terminal with profile: ${result.profile.name}`);
      return true;

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error creating terminal with profile:', error);
      await this._sendErrorResponse(context, 'Failed to create terminal with profile', error);
      return true;
    }
  }

  private async _handleSelectProfile(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const profileId = message.profileId;

      if (!profileId) {
        throw new Error('Profile ID is required');
      }

      // For select profile, we'll create a terminal with the selected profile
      return this._handleCreateTerminalWithProfile({
        ...message,
        command: 'createTerminalWithProfile'
      }, context);

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error selecting profile:', error);
      await this._sendErrorResponse(context, 'Failed to select profile', error);
      return true;
    }
  }

  private async _handleCreateProfile(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const { profileManager, sendMessage } = context;
      
      if (!message.profile) {
        throw new Error('Profile data is required');
      }

      const newProfile = profileManager.createProfile(message.profile);

      await sendMessage({
        command: 'profilesResponse',
        profiles: profileManager.getProfiles(),
        profileId: newProfile.id
      });

      log(`🎯 [PROFILE-HANDLER] Created new profile: ${newProfile.name}`);
      return true;

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error creating profile:', error);
      await this._sendErrorResponse(context, 'Failed to create profile', error);
      return true;
    }
  }

  private async _handleUpdateProfile(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const { profileManager, sendMessage } = context;
      
      if (!message.profileId || !message.profile) {
        throw new Error('Profile ID and data are required');
      }

      profileManager.updateProfile(message.profileId, message.profile);

      await sendMessage({
        command: 'profilesResponse',
        profiles: profileManager.getProfiles(),
        profileId: message.profileId
      });

      log(`🎯 [PROFILE-HANDLER] Updated profile: ${message.profileId}`);
      return true;

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error updating profile:', error);
      await this._sendErrorResponse(context, 'Failed to update profile', error);
      return true;
    }
  }

  private async _handleDeleteProfile(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const { profileManager, sendMessage } = context;
      
      if (!message.profileId) {
        throw new Error('Profile ID is required');
      }

      profileManager.deleteProfile(message.profileId);

      await sendMessage({
        command: 'profilesResponse',
        profiles: profileManager.getProfiles(),
        profileId: profileManager.getDefaultProfile().id
      });

      log(`🎯 [PROFILE-HANDLER] Deleted profile: ${message.profileId}`);
      return true;

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error deleting profile:', error);
      await this._sendErrorResponse(context, 'Failed to delete profile', error);
      return true;
    }
  }

  private async _handleSetDefaultProfile(
    message: WebviewMessage,
    context: IMessageHandlerContext
  ): Promise<boolean> {
    try {
      const { profileManager, sendMessage } = context;
      
      if (!message.profileId) {
        throw new Error('Profile ID is required');
      }

      profileManager.setDefaultProfile(message.profileId);

      await sendMessage({
        command: 'profilesResponse',
        profiles: profileManager.getProfiles(),
        profileId: message.profileId
      });

      log(`🎯 [PROFILE-HANDLER] Set default profile: ${message.profileId}`);
      return true;

    } catch (error) {
      log('❌ [PROFILE-HANDLER] Error setting default profile:', error);
      await this._sendErrorResponse(context, 'Failed to set default profile', error);
      return true;
    }
  }

  private async _sendErrorResponse(
    context: IMessageHandlerContext,
    message: string,
    error: any
  ): Promise<void> {
    try {
      await context.sendMessage({
        command: 'error',
        message: message,
        context: 'ProfileMessageHandler',
        stack: error?.stack || String(error)
      });
    } catch (sendError) {
      log('❌ [PROFILE-HANDLER] Failed to send error response:', sendError);
    }
  }
}