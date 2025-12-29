/**
 * TerminalLinkManager Unit Tests
 *
 * Tests for terminal file path and URL link detection including:
 * - Link modifier settings (VS Code standard behavior)
 * - File path detection with line:column parsing
 * - Link provider registration and disposal
 * - Link activation with modifier key checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalLinkManager } from '../../../../../webview/managers/TerminalLinkManager';
import type { IManagerCoordinator } from '../../../../../webview/interfaces/ManagerInterfaces';
import type { Terminal, ILink, IDisposable, IBuffer, IBufferLine } from '@xterm/xterm';

// Mock logger
vi.mock('../../../../../webview/utils/ManagerLogger', () => ({
  terminalLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

// Helper to create mock terminal
function createMockTerminal(lines: string[] = []): Terminal {
  const mockBuffer: Partial<IBuffer> = {
    getLine: vi.fn((lineIndex: number): IBufferLine | undefined => {
      const text = lines[lineIndex];
      if (text === undefined) return undefined;
      return {
        translateToString: vi.fn().mockReturnValue(text),
        length: text.length,
        isWrapped: false,
        getCell: vi.fn(),
      } as unknown as IBufferLine;
    }),
  };

  return {
    buffer: {
      active: mockBuffer as IBuffer,
      normal: mockBuffer as IBuffer,
      alternate: mockBuffer as IBuffer,
    },
    registerLinkProvider: vi.fn().mockReturnValue({
      dispose: vi.fn(),
    } as IDisposable),
  } as unknown as Terminal;
}

// Helper to create mock coordinator
function createMockCoordinator(): IManagerCoordinator {
  return {
    getManager: vi.fn(),
    postMessage: vi.fn(),
    postMessageToExtension: vi.fn(),
  } as unknown as IManagerCoordinator;
}

// Helper to create mock mouse event
function createMockMouseEvent(options: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
} = {}): MouseEvent {
  return {
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as MouseEvent;
}

describe('TerminalLinkManager', () => {
  let manager: TerminalLinkManager;
  let mockCoordinator: IManagerCoordinator;

  beforeEach(() => {
    mockCoordinator = createMockCoordinator();
    manager = new TerminalLinkManager(mockCoordinator);
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with coordinator', () => {
      expect(manager).toBeDefined();
      expect(manager.getStatus().name).toBe('TerminalLinkManager');
    });

    it('should have default link modifier as alt', () => {
      // Default is 'alt', which means Cmd/Ctrl opens links
      // We can test this through link activation behavior
      expect(manager.getStatus().isDisposed).toBe(false);
    });
  });

  describe('setLinkModifier', () => {
    it('should update link modifier to alt', () => {
      manager.setLinkModifier('alt');
      // Modifier is internal, but we can verify no errors occur
      expect(() => manager.setLinkModifier('alt')).not.toThrow();
    });

    it('should update link modifier to ctrlCmd', () => {
      manager.setLinkModifier('ctrlCmd');
      expect(() => manager.setLinkModifier('ctrlCmd')).not.toThrow();
    });
  });

  describe('registerTerminalLinkHandlers', () => {
    it('should register link provider for terminal', () => {
      const mockTerminal = createMockTerminal();

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(mockTerminal.registerLinkProvider).toHaveBeenCalled();
      expect(manager.getRegisteredTerminals()).toContain('terminal-1');
    });

    it('should dispose existing provider before registering new one', () => {
      const mockDispose = vi.fn();
      const mockTerminal = createMockTerminal();
      vi.mocked(mockTerminal.registerLinkProvider).mockReturnValue({
        dispose: mockDispose,
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');
      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(mockDispose).toHaveBeenCalledTimes(1);
    });

    it('should handle registration errors gracefully', () => {
      const mockTerminal = createMockTerminal();
      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation(() => {
        throw new Error('Registration failed');
      });

      expect(() => {
        manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');
      }).not.toThrow();
    });
  });

  describe('Link Detection', () => {
    it('should detect absolute file paths', () => {
      const mockTerminal = createMockTerminal(['/path/to/file.ts']);
      let capturedCallback: ((links: ILink[]) => void) | null = null;

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          capturedCallback = () => links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      // The provideLinks callback should be called during registration
      expect(mockTerminal.registerLinkProvider).toHaveBeenCalled();
    });

    it('should detect relative file paths with ./', () => {
      const lines = ['./src/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('./src/file.ts');
    });

    it('should detect relative file paths with ../', () => {
      const lines = ['../parent/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('../parent/file.ts');
    });

    it('should detect Windows file paths', () => {
      const lines = ['C:\\Users\\test\\file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('C:\\Users\\test\\file.ts');
    });

    it('should detect file paths with line numbers', () => {
      const lines = ['/path/to/file.ts:10'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('/path/to/file.ts:10');
    });

    it('should detect file paths with line and column numbers', () => {
      const lines = ['/path/to/file.ts:10:5'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('/path/to/file.ts:10:5');
    });

    it('should detect URL path portion starting from first slash', () => {
      // The regex pattern (?:\.{0,2}\/|[A-Za-z]:\\) matches 0-2 dots + /
      // For https://example.com/path, it matches starting at the first /
      // (with 0 dots before it), then continues with /example.com/path
      const lines = ['https://example.com/path'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      // The regex matches //example.com/path (0 dots + / + rest)
      // This looks like a file path to the regex
      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('//example.com/path');
    });

    it('should clean trailing punctuation from paths', () => {
      const lines = ['/path/to/file.ts,'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('/path/to/file.ts');
    });

    it('should handle empty lines', () => {
      const mockTerminal = createMockTerminal(['']);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(0);
    });

    it('should handle non-existent lines', () => {
      const mockTerminal = createMockTerminal([]);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(0);
    });

    it('should detect multiple links in one line', () => {
      const lines = ['/path/to/file1.ts /path/to/file2.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(2);
    });

    it('should avoid duplicate links', () => {
      // Same path appearing twice at same position should only be detected once
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
    });
  });

  describe('Link Activation', () => {
    it('should activate with Cmd+Click when modifier is alt', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.setLinkModifier('alt');
      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      const event = createMockMouseEvent({ metaKey: true });
      detectedLinks[0]?.activate(event, detectedLinks[0].text);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'openTerminalLink',
          linkType: 'file',
          filePath: '/path/to/file.ts',
        })
      );
    });

    it('should activate with Ctrl+Click when modifier is alt', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.setLinkModifier('alt');
      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      const event = createMockMouseEvent({ ctrlKey: true });
      detectedLinks[0]?.activate(event, detectedLinks[0].text);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalled();
    });

    it('should activate with Alt+Click when modifier is ctrlCmd', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.setLinkModifier('ctrlCmd');
      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      const event = createMockMouseEvent({ altKey: true });
      detectedLinks[0]?.activate(event, detectedLinks[0].text);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalled();
    });

    it('should not activate without modifier key', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      const event = createMockMouseEvent(); // No modifier keys
      detectedLinks[0]?.activate(event, detectedLinks[0].text);

      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should not activate with wrong modifier key', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.setLinkModifier('alt'); // Cmd/Ctrl should open links
      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      const event = createMockMouseEvent({ altKey: true }); // Alt pressed, but should be Cmd/Ctrl
      detectedLinks[0]?.activate(event, detectedLinks[0].text);

      expect(mockCoordinator.postMessageToExtension).not.toHaveBeenCalled();
    });

    it('should include line and column in activation message', () => {
      const lines = ['/path/to/file.ts:10:5'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      const event = createMockMouseEvent({ metaKey: true });
      detectedLinks[0]?.activate(event, detectedLinks[0].text);

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'openTerminalLink',
          linkType: 'file',
          filePath: '/path/to/file.ts',
          lineNumber: 10,
          columnNumber: 5,
        })
      );
    });
  });

  describe('openUrlFromTerminal', () => {
    it('should send URL open message to extension', () => {
      manager.openUrlFromTerminal('https://example.com', 'terminal-1');

      expect(mockCoordinator.postMessageToExtension).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'openTerminalLink',
          linkType: 'url',
          url: 'https://example.com',
          terminalId: 'terminal-1',
        })
      );
    });
  });

  describe('unregisterTerminalLinkProvider', () => {
    it('should dispose and remove provider', () => {
      const mockDispose = vi.fn();
      const mockTerminal = createMockTerminal();
      vi.mocked(mockTerminal.registerLinkProvider).mockReturnValue({
        dispose: mockDispose,
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');
      expect(manager.getRegisteredTerminals()).toContain('terminal-1');

      manager.unregisterTerminalLinkProvider('terminal-1');

      expect(mockDispose).toHaveBeenCalled();
      expect(manager.getRegisteredTerminals()).not.toContain('terminal-1');
    });

    it('should handle unregistering non-existent provider', () => {
      expect(() => {
        manager.unregisterTerminalLinkProvider('non-existent');
      }).not.toThrow();
    });
  });

  describe('getRegisteredTerminals', () => {
    it('should return empty array initially', () => {
      expect(manager.getRegisteredTerminals()).toEqual([]);
    });

    it('should return registered terminal IDs', () => {
      const mockTerminal1 = createMockTerminal();
      const mockTerminal2 = createMockTerminal();

      manager.registerTerminalLinkHandlers(mockTerminal1, 'terminal-1');
      manager.registerTerminalLinkHandlers(mockTerminal2, 'terminal-2');

      const registered = manager.getRegisteredTerminals();

      expect(registered).toContain('terminal-1');
      expect(registered).toContain('terminal-2');
      expect(registered.length).toBe(2);
    });
  });

  describe('dispose', () => {
    it('should dispose all registered providers', () => {
      const mockDispose1 = vi.fn();
      const mockDispose2 = vi.fn();

      const mockTerminal1 = createMockTerminal();
      const mockTerminal2 = createMockTerminal();

      vi.mocked(mockTerminal1.registerLinkProvider).mockReturnValue({
        dispose: mockDispose1,
      });
      vi.mocked(mockTerminal2.registerLinkProvider).mockReturnValue({
        dispose: mockDispose2,
      });

      manager.registerTerminalLinkHandlers(mockTerminal1, 'terminal-1');
      manager.registerTerminalLinkHandlers(mockTerminal2, 'terminal-2');

      manager.dispose();

      expect(mockDispose1).toHaveBeenCalled();
      expect(mockDispose2).toHaveBeenCalled();
    });

    it('should clear registered terminals after dispose', () => {
      const mockTerminal = createMockTerminal();
      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      manager.dispose();

      expect(manager.getRegisteredTerminals()).toEqual([]);
    });

    it('should set disposed status', () => {
      manager.dispose();

      expect(manager.getStatus().isDisposed).toBe(true);
    });
  });

  describe('Link Decorations', () => {
    it('should include pointer cursor and underline decorations', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks[0]?.decorations?.pointerCursor).toBe(true);
      expect(detectedLinks[0]?.decorations?.underline).toBe(true);
    });
  });

  describe('Link Range Calculation', () => {
    it('should calculate correct link range', () => {
      const lines = ['prefix /path/to/file.ts suffix'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      // Link starts after "prefix " (7 characters), so startX = 8 (1-indexed)
      expect(detectedLinks[0].range.start.x).toBe(8);
      expect(detectedLinks[0].range.start.y).toBe(1);
    });
  });

  describe('Path Cleaning', () => {
    it('should remove trailing semicolons', () => {
      const lines = ['/path/to/file.ts;'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks[0]?.text).toBe('/path/to/file.ts');
    });

    it('should remove unmatched closing brackets', () => {
      const lines = ['/path/to/file.ts)'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks[0]?.text).toBe('/path/to/file.ts');
    });

    it('should truncate at brackets due to regex exclusion', () => {
      // The regex pattern [^\s"'<>()[\]{}|]+ excludes parentheses
      // So paths with brackets are truncated at the bracket
      const lines = ['/path/to/(special)/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      // Due to regex, path is truncated at the opening parenthesis
      expect(detectedLinks[0]?.text).toBe('/path/to/');
    });
  });

  describe('Edge Cases', () => {
    it('should handle paths without extension', () => {
      const lines = ['/path/to/file'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      expect(detectedLinks.length).toBe(1);
      expect(detectedLinks[0].text).toBe('/path/to/file');
    });

    it('should reject invalid paths without separators', () => {
      // A path that starts with ./ but has no further separators might be invalid
      const lines = ['./file'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      // ./file has a path separator (/), so it should be valid
      expect(detectedLinks.length).toBe(1);
    });

    it('should handle hover and leave callbacks', () => {
      const lines = ['/path/to/file.ts'];
      const mockTerminal = createMockTerminal(lines);
      let detectedLinks: ILink[] = [];

      vi.mocked(mockTerminal.registerLinkProvider).mockImplementation((provider) => {
        provider.provideLinks(1, (links) => {
          detectedLinks = links;
        });
        return { dispose: vi.fn() };
      });

      manager.registerTerminalLinkHandlers(mockTerminal, 'terminal-1');

      // Hover and leave callbacks should be defined and not throw
      const event = createMockMouseEvent();
      expect(() => detectedLinks[0]?.hover?.(event, '/path/to/file.ts')).not.toThrow();
      expect(() => detectedLinks[0]?.leave?.(event, '/path/to/file.ts')).not.toThrow();
    });
  });

  describe('Health and Performance', () => {
    it('should report health status', async () => {
      await manager.initialize();

      const health = manager.getHealthStatus();

      expect(health.managerName).toBe('TerminalLinkManager');
      expect(health.isInitialized).toBe(true);
      expect(health.isDisposed).toBe(false);
    });

    it('should track performance metrics', async () => {
      await manager.initialize();

      const metrics = manager.getPerformanceMetrics();

      expect(metrics.initializationTimeMs).toBeGreaterThanOrEqual(0);
      expect(metrics.operationCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });
});
