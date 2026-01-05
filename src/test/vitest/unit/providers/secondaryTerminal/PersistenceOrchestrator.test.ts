/**
 * PersistenceOrchestrator Unit Tests
 *
 * Vitest Migration: Converted from Mocha/Chai/Sinon to Vitest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as vscode from 'vscode';

import '../../../../shared/TestSetup';
import { PersistenceOrchestrator } from '../../../../../providers/secondaryTerminal/PersistenceOrchestrator';
import { WebviewMessage } from '../../../../../types/common';
import { TerminalPersistencePort } from '../../../../../services/persistence/TerminalPersistencePort';

describe('PersistenceOrchestrator', () => {
  let extensionContext: vscode.ExtensionContext;
  let sendMessage: ReturnType<typeof vi.fn>;
  let handler: {
    handleMessage: ReturnType<typeof vi.fn>;
  };
  let service: TerminalPersistencePort;
  let terminalManager: {
    getTerminals: ReturnType<typeof vi.fn>;
    createTerminal: ReturnType<typeof vi.fn>;
    getTerminal: ReturnType<typeof vi.fn>;
    setActiveTerminal: ReturnType<typeof vi.fn>;
  };
  let orchestrator: PersistenceOrchestrator;
  let terminalStore: Map<string, any>;

  beforeEach(() => {
    extensionContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    sendMessage = vi.fn().mockResolvedValue(undefined);
    terminalStore = new Map();
    terminalManager = {
      getTerminals: vi.fn().mockReturnValue([]),
      createTerminal: vi.fn().mockImplementation(() => {
        const id = `terminal-${terminalStore.size + 1}`;
        const terminal = { id, name: `Terminal ${terminalStore.size + 1}` };
        terminalStore.set(id, terminal);
        return id;
      }),
      getTerminal: vi.fn().mockImplementation((id: string) => terminalStore.get(id)),
      setActiveTerminal: vi.fn(),
    };

    handler = {
      handleMessage: vi.fn().mockResolvedValue({ success: true, data: [] }),
    };
    service = {
      saveCurrentSession: vi.fn().mockResolvedValue({ success: true, terminalCount: 1 } as any),
      restoreSession: vi
        .fn()
        .mockResolvedValue({ success: true, restoredCount: 1, skippedCount: 0 } as any),
      clearSession: vi.fn().mockResolvedValue(undefined),
      cleanupExpiredSessions: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
    } as unknown as TerminalPersistencePort;

    orchestrator = new PersistenceOrchestrator({
      extensionContext,
      terminalManager: terminalManager as any,
      sendMessage: sendMessage as any,
      handlerFactory: () => handler as any,
      serviceFactory: () => service,
      logger: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bridges persistence messages and forwards responses', async () => {
    handler.handleMessage.mockResolvedValue({ success: true, data: [] });
    await orchestrator.handlePersistenceMessage(
      {
        command: 'persistenceSaveSession',
        data: [],
        messageId: 'msg-1',
      } as WebviewMessage,
      sendMessage
    );

    expect(handler.handleMessage).toHaveBeenCalled();
    const args = handler.handleMessage.mock.calls[0][0];
    expect(args?.command).toBe('savesession');
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'persistenceSaveSessionResponse', success: true })
    );
  });

  it('maps legacy commands before forwarding', async () => {
    handler.handleMessage.mockResolvedValue({ success: true, data: [] });
    await orchestrator.handleLegacyPersistenceMessage(
      {
        command: 'terminalSerializationRequest',
        data: [],
      } as WebviewMessage,
      sendMessage
    );

    const args = handler.handleMessage.mock.calls[0][0];
    expect(args?.command).toBe('savesession');
  });

  it('cleans up persistence service on dispose', async () => {
    orchestrator.dispose();

    expect(service.cleanupExpiredSessions).toHaveBeenCalledOnce();
  });

  it('saves current session via persistence service', async () => {
    const result = await orchestrator.saveCurrentSession();

    expect(result).toBe(true);
    expect(service.saveCurrentSession).toHaveBeenCalledOnce();
  });

  it('restores sessions using persistence service', async () => {
    const result = await orchestrator.restoreLastSession();

    expect(result).toBe(true);
    expect(service.restoreSession).toHaveBeenCalledOnce();
  });
});
