import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalDecorationsService } from '../../../../services/TerminalDecorationsService';

// Mock VS Code API
const mockEventEmitter = {
  event: vi.fn(),
  fire: vi.fn(),
  dispose: vi.fn(),
};

const mockConfiguration = {
  get: vi.fn((key: string, defaultValue: any) => {
    if (key === 'terminal.integrated.shellIntegration.decorationsEnabled') return true;
    if (key === 'secondaryTerminal.decorations') return {};
    return defaultValue;
  }),
};

vi.mock('vscode', () => {
  return {
    EventEmitter: vi.fn(function() { return mockEventEmitter; }),
    workspace: {
      getConfiguration: vi.fn(() => mockConfiguration),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    },
  };
});

// Mock logger
vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

describe('TerminalDecorationsService', () => {
  let service: TerminalDecorationsService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEventEmitter.fire.mockClear();
    service = new TerminalDecorationsService();
  });

  afterEach(() => {
    service.dispose();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('addDecoration', () => {
    it('should add decoration and fire event', () => {
      const decoration = {
        terminalId: 't1',
        commandId: 'cmd1',
        line: 1,
        status: 'running' as const,
      };

      service.addDecoration(decoration);

      expect(service.getDecorations('t1')).toHaveLength(1);
      expect(mockEventEmitter.fire).toHaveBeenCalledWith(expect.objectContaining({
        terminalId: 't1',
        decorations: expect.arrayContaining([expect.objectContaining({ commandId: 'cmd1' })])
      }));
    });

    it('should respect max decoration limit', () => {
      for (let i = 0; i < 110; i++) {
        service.addDecoration({
          terminalId: 't1',
          commandId: `cmd${i}`,
          line: i,
          status: 'success',
        });
      }

      expect(service.getDecorations('t1')).toHaveLength(100);
    });
  });

  describe('completeCommand', () => {
    it('should update running command status', () => {
      service.addDecoration({
        terminalId: 't1',
        commandId: 'cmd1',
        line: 1,
        status: 'running',
      });

      service.completeCommand('t1', 'cmd1', 0);

      const decorations = service.getDecorations('t1');
      expect(decorations[0].status).toBe('success');
      expect(decorations[0].exitCode).toBe(0);
      expect(mockEventEmitter.fire).toHaveBeenCalledTimes(2); // add + complete
    });

    it('should set error status for non-zero exit code', () => {
      service.addDecoration({
        terminalId: 't1',
        commandId: 'cmd1',
        line: 1,
        status: 'running',
      });

      service.completeCommand('t1', 'cmd1', 1);

      const decorations = service.getDecorations('t1');
      expect(decorations[0].status).toBe('error');
      expect(decorations[0].exitCode).toBe(1);
    });
  });

  describe('processShellIntegrationData', () => {
    it('should detect command start', () => {
      service.processShellIntegrationData('t1', '\x1b]633;A;ls\x07');

      const decorations = service.getDecorations('t1');
      expect(decorations).toHaveLength(1);
      expect(decorations[0].status).toBe('running');
      expect(decorations[0].command).toBe('ls');
    });

    it('should detect command end and complete latest running command', () => {
      // Start command
      service.processShellIntegrationData('t1', '\x1b]633;A;ls\x07');
      
      // End command (exit code 0)
      service.processShellIntegrationData('t1', '\x1b]633;D;0\x07');

      const decorations = service.getDecorations('t1');
      expect(decorations[0].status).toBe('success');
    });
  });

  describe('clearDecorations', () => {
    it('should clear decorations for terminal', () => {
      service.addDecoration({
        terminalId: 't1',
        commandId: 'cmd1',
        line: 1,
        status: 'running',
      });

      service.clearDecorations('t1');

      expect(service.getDecorations('t1')).toHaveLength(0);
      expect(mockEventEmitter.fire).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateDecorationCSS', () => {
    it('should return CSS string', () => {
      const css = service.generateDecorationCSS();
      expect(css).toContain('.terminal-command-decoration');
      expect(css).toContain('background-color:');
    });
  });
});