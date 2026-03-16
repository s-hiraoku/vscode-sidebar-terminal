import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageRouterFactory } from '../../../../../services/MessageRouter';
import {
  CreateTerminalHandler,
  DeleteTerminalHandler,
  GetSettingsHandler,
  SessionRestorationHandler,
  SplitTerminalHandler,
  TerminalInputHandler,
  TerminalMessageHandlerDependencies,
  TerminalMessageHandlerFactory,
  TerminalResizeHandler,
  UpdateSettingsHandler,
} from '../../../../../services/handlers/TerminalMessageHandlers';
import { safeProcessCwd } from '../../../../../utils/common';

vi.mock('../../../../../utils/logger', () => ({
  log: vi.fn(),
}));

describe('TerminalMessageHandlers', () => {
  let dependencies: TerminalMessageHandlerDependencies;

  beforeEach(() => {
    dependencies = {
      terminalManager: {
        createTerminal: vi.fn().mockResolvedValue('terminal-2'),
        deleteTerminal: vi.fn().mockResolvedValue(true),
        sendInput: vi.fn(),
        resize: vi.fn(),
        focusTerminal: vi.fn(),
        getActiveTerminalId: vi.fn().mockReturnValue('terminal-1'),
        getWorkingDirectory: vi.fn().mockResolvedValue('/tmp/worktree'),
      },
      persistenceService: {
        getLastSession: vi.fn().mockResolvedValue({ terminals: ['terminal-1'] }),
      },
      configService: {
        getCurrentSettings: vi.fn().mockReturnValue({ theme: 'light' }),
        updateSettings: vi.fn().mockResolvedValue(undefined),
      },
      notificationService: {
        showError: vi.fn(),
        showInfo: vi.fn(),
        showWarning: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    dependencies = null as unknown as TerminalMessageHandlerDependencies;
  });

  it('creates terminals with the requested options', async () => {
    // Given
    const handler = new CreateTerminalHandler(dependencies);

    // When
    await expect(
      handler.handle({
        profile: 'zsh',
        workingDirectory: '/workspace',
        environmentVariables: { FOO: 'bar' },
      })
    ).resolves.toEqual({ terminalId: 'terminal-2' });

    // Then
    expect(dependencies.terminalManager.createTerminal).toHaveBeenCalledWith({
      profile: 'zsh',
      workingDirectory: '/workspace',
      environmentVariables: { FOO: 'bar' },
    });
  });

  it('wraps create-terminal failures with handler context', async () => {
    // Given
    const handler = new CreateTerminalHandler(dependencies);
    vi.mocked(dependencies.terminalManager.createTerminal).mockRejectedValueOnce(new Error('boom'));

    // When / Then
    await expect(handler.handle({})).rejects.toThrow('Terminal creation failed: Error: boom');
  });

  it('requires a terminal id before deleting', async () => {
    // Given
    const handler = new DeleteTerminalHandler(dependencies);
    const invokeWithPartialPayload = (
      data: Partial<Parameters<DeleteTerminalHandler['handle']>[0]>
    ) => handler.handle(data as Parameters<DeleteTerminalHandler['handle']>[0]);

    // When / Then
    await expect(invokeWithPartialPayload({})).rejects.toThrow(
      "Required field 'terminalId' is missing or null"
    );
  });

  it('passes input and terminal id in the runtime order expected by terminalManager', () => {
    // Given
    const handler = new TerminalInputHandler(dependencies);

    // When
    expect(handler.handle({ terminalId: 'terminal-1', input: 'pwd' })).toEqual({ success: true });

    // Then
    expect(dependencies.terminalManager.sendInput).toHaveBeenCalledWith('pwd', 'terminal-1');
  });

  it('rejects resize requests with non-positive dimensions', () => {
    // Given
    const handler = new TerminalResizeHandler(dependencies);

    // When / Then
    expect(() =>
      handler.handle({
        terminalId: 'terminal-1',
        cols: 0,
        rows: 24,
      })
    ).toThrow('Invalid resize dimensions: cols and rows must be positive');
  });

  it('delegates valid resize requests to terminalManager', () => {
    // Given
    const handler = new TerminalResizeHandler(dependencies);

    // When
    expect(
      handler.handle({
        terminalId: 'terminal-1',
        cols: 120,
        rows: 30,
      })
    ).toEqual({ success: true });

    // Then
    expect(dependencies.terminalManager.resize).toHaveBeenCalledWith('terminal-1', 120, 30);
  });

  it('returns current settings through the settings handler', () => {
    // Given
    const handler = new GetSettingsHandler(dependencies);

    // When
    expect(handler.handle()).toEqual({ settings: { theme: 'light' } });

    // Then
    expect(dependencies.configService.getCurrentSettings).toHaveBeenCalledTimes(1);
  });

  it('wraps settings update errors', async () => {
    // Given
    const handler = new UpdateSettingsHandler(dependencies);
    vi.mocked(dependencies.configService.updateSettings).mockRejectedValueOnce(new Error('nope'));

    // When / Then
    await expect(handler.handle({ settings: { theme: 'dark' } })).rejects.toThrow(
      'Settings update failed: Error: nope'
    );
  });

  it('returns persisted session data for restoration', async () => {
    // Given
    const handler = new SessionRestorationHandler(dependencies);

    // When / Then
    await expect(handler.handle()).resolves.toEqual({
      sessionData: { terminals: ['terminal-1'] },
    });
  });

  it('uses the active terminal working directory when creating a split terminal', async () => {
    // Given
    const handler = new SplitTerminalHandler(dependencies);

    // When
    await expect(handler.handle({ direction: 'vertical' })).resolves.toEqual({
      terminalId: 'terminal-2',
    });

    // Then
    expect(dependencies.terminalManager.getWorkingDirectory).toHaveBeenCalledWith('terminal-1');
    expect(dependencies.terminalManager.createTerminal).toHaveBeenCalledWith({
      workingDirectory: '/tmp/worktree',
    });
  });

  it('falls back to safeProcessCwd when the active terminal cwd cannot be resolved', async () => {
    // Given
    const handler = new SplitTerminalHandler(dependencies);
    vi.mocked(dependencies.terminalManager.getWorkingDirectory).mockRejectedValueOnce(
      new Error('cwd unavailable')
    );

    // When
    await handler.handle({});

    // Then
    expect(dependencies.terminalManager.createTerminal).toHaveBeenCalledWith({
      workingDirectory: safeProcessCwd(),
    });
  });

  it('creates and registers the full handler set', () => {
    // Given
    const handlers = TerminalMessageHandlerFactory.createAllHandlers(dependencies);
    const router = MessageRouterFactory.create({ enableLogging: false });

    // When / Then
    expect(Array.from(handlers.keys()).sort()).toEqual([
      'createTerminal',
      'deleteTerminal',
      'focusTerminal',
      'getSettings',
      'sessionRestore',
      'splitTerminal',
      'terminalInput',
      'terminalResize',
      'updateSettings',
    ]);

    // When
    TerminalMessageHandlerFactory.registerAllHandlers(router, dependencies);

    // Then
    expect(router.getRegisteredCommands().sort()).toEqual([
      'createTerminal',
      'deleteTerminal',
      'focusTerminal',
      'getSettings',
      'sessionRestore',
      'splitTerminal',
      'terminalInput',
      'terminalResize',
      'updateSettings',
    ]);
  });
});
