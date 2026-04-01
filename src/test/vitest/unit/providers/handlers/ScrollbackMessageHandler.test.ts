/**
 * ScrollbackMessageHandler Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode (required by logger)
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(false),
    }),
  },
}));

import {
  ScrollbackMessageHandler,
  IScrollbackMessageHandlerDependencies,
  IScrollbackPersistenceService,
} from '../../../../../providers/handlers/ScrollbackMessageHandler';
import { WebviewMessage } from '../../../../../types/common';

function createMockPersistenceService(): IScrollbackPersistenceService {
  return {
    handlePushedScrollbackData: vi.fn(),
    handleScrollbackDataCollected: vi.fn(),
    handleScrollbackRefreshRequest: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDeps(
  persistenceService: IScrollbackPersistenceService | null = null
): IScrollbackMessageHandlerDependencies {
  return {
    getExtensionPersistenceService: vi.fn().mockReturnValue(persistenceService),
  };
}

describe('ScrollbackMessageHandler', () => {
  let handler: ScrollbackMessageHandler;
  let deps: IScrollbackMessageHandlerDependencies;
  let persistenceService: IScrollbackPersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    persistenceService = createMockPersistenceService();
    deps = createMockDeps(persistenceService);
    handler = new ScrollbackMessageHandler(deps);
  });

  describe('handlePushScrollbackData', () => {
    it('should forward message to persistence service', async () => {
      const message = { command: 'pushScrollbackData', data: 'test' } as unknown as WebviewMessage;

      await handler.handlePushScrollbackData(message);

      expect(persistenceService.handlePushedScrollbackData).toHaveBeenCalledWith(message);
    });

    it('should return early when persistence service is unavailable', async () => {
      const depsNoPersistence = createMockDeps(null);
      const handlerNoPersistence = new ScrollbackMessageHandler(depsNoPersistence);
      const message = { command: 'pushScrollbackData' } as unknown as WebviewMessage;

      // Should not throw
      await handlerNoPersistence.handlePushScrollbackData(message);
    });

    it('should return early when handler method does not exist', async () => {
      const incompleteService = {} as IScrollbackPersistenceService;
      const depsIncomplete = createMockDeps(incompleteService);
      const handlerIncomplete = new ScrollbackMessageHandler(depsIncomplete);
      const message = { command: 'pushScrollbackData' } as unknown as WebviewMessage;

      // Should not throw
      await handlerIncomplete.handlePushScrollbackData(message);
    });

    it('should catch and log errors from persistence service', async () => {
      (
        persistenceService.handlePushedScrollbackData as ReturnType<typeof vi.fn>
      ).mockImplementation(() => {
        throw new Error('persistence error');
      });
      const message = { command: 'pushScrollbackData' } as unknown as WebviewMessage;

      // Should not throw
      await handler.handlePushScrollbackData(message);
    });
  });

  describe('handleScrollbackDataCollected', () => {
    it('should forward scrollback data to persistence service', async () => {
      const message = {
        command: 'scrollbackDataCollected',
        terminalId: 'term-1',
        requestId: 'req-1',
        scrollbackData: ['line1', 'line2'],
      } as unknown as WebviewMessage;

      await handler.handleScrollbackDataCollected(message);

      expect(persistenceService.handleScrollbackDataCollected).toHaveBeenCalledWith({
        terminalId: 'term-1',
        requestId: 'req-1',
        scrollbackData: ['line1', 'line2'],
      });
    });

    it('should use scrollbackContent as fallback', async () => {
      const message = {
        command: 'scrollbackDataCollected',
        terminalId: 'term-1',
        scrollbackContent: ['line1'],
      } as unknown as WebviewMessage;

      await handler.handleScrollbackDataCollected(message);

      expect(persistenceService.handleScrollbackDataCollected).toHaveBeenCalledWith({
        terminalId: 'term-1',
        requestId: undefined,
        scrollbackData: ['line1'],
      });
    });

    it('should return early when scrollbackData is not an array', async () => {
      const message = {
        command: 'scrollbackDataCollected',
        terminalId: 'term-1',
      } as unknown as WebviewMessage;

      await handler.handleScrollbackDataCollected(message);

      expect(persistenceService.handleScrollbackDataCollected).not.toHaveBeenCalled();
    });

    it('should fallback to pushScrollbackData when persistence service lacks handleScrollbackDataCollected', async () => {
      const partialService: IScrollbackPersistenceService = {
        handlePushedScrollbackData: vi.fn(),
      };
      const partialDeps = createMockDeps(partialService);
      const partialHandler = new ScrollbackMessageHandler(partialDeps);

      const message = {
        command: 'scrollbackDataCollected',
        terminalId: 'term-1',
        scrollbackData: ['line1'],
      } as unknown as WebviewMessage;

      await partialHandler.handleScrollbackDataCollected(message);

      expect(partialService.handlePushedScrollbackData).toHaveBeenCalled();
    });

    it('should fallback to pushScrollbackData when persistence service is null', async () => {
      const nullDeps = createMockDeps(null);
      const nullHandler = new ScrollbackMessageHandler(nullDeps);

      const message = {
        command: 'scrollbackDataCollected',
        terminalId: 'term-1',
        scrollbackData: ['line1'],
      } as unknown as WebviewMessage;

      // Should not throw - both paths handle null gracefully
      await nullHandler.handleScrollbackDataCollected(message);
    });
  });

  describe('handleScrollbackRefreshRequest', () => {
    it('should forward refresh request to persistence service', async () => {
      const message = {
        command: 'requestScrollbackRefresh',
      } as unknown as WebviewMessage;

      await handler.handleScrollbackRefreshRequest(message);

      expect(persistenceService.handleScrollbackRefreshRequest).toHaveBeenCalledWith(message);
    });

    it('should return early when persistence service is unavailable', async () => {
      const depsNoPersistence = createMockDeps(null);
      const handlerNoPersistence = new ScrollbackMessageHandler(depsNoPersistence);
      const message = { command: 'requestScrollbackRefresh' } as unknown as WebviewMessage;

      await handlerNoPersistence.handleScrollbackRefreshRequest(message);
    });

    it('should return early when handler method does not exist', async () => {
      const incompleteService = {} as IScrollbackPersistenceService;
      const depsIncomplete = createMockDeps(incompleteService);
      const handlerIncomplete = new ScrollbackMessageHandler(depsIncomplete);
      const message = { command: 'requestScrollbackRefresh' } as unknown as WebviewMessage;

      await handlerIncomplete.handleScrollbackRefreshRequest(message);
    });

    it('should catch and log errors from persistence service', async () => {
      (
        persistenceService.handleScrollbackRefreshRequest as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('refresh error'));
      const message = { command: 'requestScrollbackRefresh' } as unknown as WebviewMessage;

      // Should not throw
      await handler.handleScrollbackRefreshRequest(message);
    });
  });
});
