import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalLinksService } from '../../../../services/TerminalLinksService';

// Mock vscode
const mocks = vi.hoisted(() => {
  const mockEventEmitter = {
    event: vi.fn(),
    fire: vi.fn(),
    dispose: vi.fn(),
  };

  const mockConfiguration = {
    get: vi.fn((key: string, defaultValue: any) => {
      if (key === 'terminal.integrated.allowedLinkSchemes') return ['http', 'https', 'file', 'mailto'];
      return defaultValue;
    }),
  };

  const mockWorkspace = {
    getConfiguration: vi.fn(() => mockConfiguration),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    openTextDocument: vi.fn().mockResolvedValue({}),
  };

  const mockEnv = {
    openExternal: vi.fn().mockResolvedValue(true),
  };

  const mockWindow = {
    showTextDocument: vi.fn().mockResolvedValue(true),
  };

  const mockCommands = {
    executeCommand: vi.fn().mockResolvedValue(true),
  };

  const mockUri = {
    parse: vi.fn((str) => ({ toString: () => str })),
    file: vi.fn((str) => ({ fsPath: str })),
  };

  return {
    mockEventEmitter,
    mockConfiguration,
    mockWorkspace,
    mockEnv,
    mockWindow,
    mockCommands,
    mockUri
  };
});

vi.mock('vscode', () => ({
  EventEmitter: vi.fn(function() { return mocks.mockEventEmitter; }),
  workspace: mocks.mockWorkspace,
  env: mocks.mockEnv,
  window: mocks.mockWindow,
  commands: mocks.mockCommands,
  Uri: mocks.mockUri,
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    stat: vi.fn().mockImplementation(async (path) => {
      if (typeof path === 'string' && (path.includes('file') || path.includes('folder'))) {
        return { isDirectory: () => path.includes('folder') };
      }
      throw new Error('File not found');
    }),
  },
}));

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

// Mock path
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    isAbsolute: vi.fn((p) => p.startsWith('/')),
    resolve: vi.fn((...args) => args.join('/')),
  };
});

describe('TerminalLinksService', () => {
  let service: TerminalLinksService;

  beforeEach(() => {
    service = new TerminalLinksService();
    mocks.mockEventEmitter.fire.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.dispose();
  });

  describe('detectLinks', () => {
    it('should detect web links', async () => {
      const links = await service.detectLinks('t1', 1, 'Check this https://example.com link');
      
      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('url');
      expect(links[0].text).toBe('https://example.com');
    });

    it('should detect file links', async () => {
      const links = await service.detectLinks('t1', 1, 'File at /absolute/path/file');
      
      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('file');
      expect(links[0].text).toBe('/absolute/path/file');
    });

    it('should detect email links', async () => {
      const links = await service.detectLinks('t1', 1, 'Mail to user@example.com');
      
      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('email');
      expect(links[0].text).toBe('user@example.com');
    });

    it('should fire event when links detected', async () => {
      await service.detectLinks('t1', 1, 'https://example.com');
      
      expect(mocks.mockEventEmitter.fire).toHaveBeenCalledWith(expect.objectContaining({
        terminalId: 't1',
        links: expect.arrayContaining([expect.objectContaining({ type: 'url' })])
      }));
    });
  });

  describe('activateLink', () => {
    it('should activate web link', async () => {
      const link = { type: 'url', text: 'https://example.com' } as any;
      await service.activateLink(link);
      
      expect(mocks.mockEnv.openExternal).toHaveBeenCalled();
    });

    it('should activate file link', async () => {
      const link = { type: 'file', activationData: { path: '/file.txt' } } as any;
      await service.activateLink(link);
      
      expect(mocks.mockWorkspace.openTextDocument).toHaveBeenCalledWith('/file.txt');
      expect(mocks.mockWindow.showTextDocument).toHaveBeenCalled();
    });

    it('should activate folder link', async () => {
      const link = { type: 'folder', activationData: { path: '/folder' } } as any;
      await service.activateLink(link);
      
      expect(mocks.mockCommands.executeCommand).toHaveBeenCalledWith('revealFileInOS', expect.anything());
    });

    it('should activate email link', async () => {
      const link = { type: 'email', text: 'test@example.com' } as any;
      await service.activateLink(link);
      
      expect(mocks.mockEnv.openExternal).toHaveBeenCalled();
    });
  });

  describe('custom providers', () => {
    it('should support custom link providers', async () => {
      const provider = {
        provideTerminalLinks: vi.fn().mockResolvedValue([{ startIndex: 0, length: 5, tooltip: 'Custom' }]),
        handleTerminalLink: vi.fn(),
      };
      
      service.registerLinkProvider(provider as any);
      
      const links = await service.detectLinks('t1', 1, '12345');
      
      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('custom');
      expect(provider.provideTerminalLinks).toHaveBeenCalled();
    });
  });
});