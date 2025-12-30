import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedShellIntegrationService } from '../../../../services/EnhancedShellIntegrationService';
import * as vscode from 'vscode';

// Mock base class
vi.mock('../../../../services/ShellIntegrationService', () => {
  class MockShellIntegrationService {
    processTerminalData(_id: string, _data: string) {}
    disposeTerminal(_id: string) {}
    dispose() {}
    getCommandHistory(_id: string) { return []; }
  }
  MockShellIntegrationService.prototype.processTerminalData = vi.fn();
  MockShellIntegrationService.prototype.disposeTerminal = vi.fn();
  MockShellIntegrationService.prototype.dispose = vi.fn();
  MockShellIntegrationService.prototype.getCommandHistory = vi.fn().mockReturnValue([]);
  return {
    ShellIntegrationService: MockShellIntegrationService
  };
});

// Mock vscode
const mockEventEmitter = {
  fire: vi.fn(),
  event: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('vscode', () => ({
  EventEmitter: class {
    fire = mockEventEmitter.fire;
    event = mockEventEmitter.event;
    dispose = mockEventEmitter.dispose;
  },
  window: {
    showQuickPick: vi.fn(),
  },
}));

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

vi.mock('../../../../utils/common', () => ({
  safeProcessCwd: vi.fn().mockReturnValue('/home/user'),
}));

describe('EnhancedShellIntegrationService', () => {
  let service: EnhancedShellIntegrationService;
  let mockTerminalManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminalManager = {};
    service = new EnhancedShellIntegrationService(mockTerminalManager);
  });

  describe('initializeTerminal', () => {
    it('should initialize terminal status', () => {
      service.initializeTerminal('term-1', 'Terminal 1');
      const status = service.getTerminalStatus('term-1');
      expect(status).toBeDefined();
      expect(status?.terminalId).toBe('term-1');
      expect(status?.commandStatus).toBe('idle');
      expect(mockEventEmitter.fire).toHaveBeenCalled();
    });
  });

  describe('processTerminalData', () => {
    it('should process data without error', () => {
      service.initializeTerminal('term-1');
      service.processTerminalData('term-1', 'data');
      // No assertions needed as long as it doesn't throw and base method is called (mocked)
    });
  });

  describe('command history', () => {
    it('should clear global command history', () => {
       service.initializeTerminal('term-1'); // Initialize a terminal first
       service.clearCommandHistory();
       expect(service.getGlobalCommandHistory()).toHaveLength(0);
       expect(mockEventEmitter.fire).toHaveBeenCalled();
    });
    
    it('should return null for recent command if history empty', async () => {
      const result = await service.executeRecentCommand('term-1');
      expect(result).toBeNull();
    });
  });

  describe('setWebviewProvider', () => {
    it('should send updates to webview', () => {
      const mockProvider = { sendMessage: vi.fn() } as any;
      service.setWebviewProvider(mockProvider);
      
      service.initializeTerminal('term-1');
      
      expect(mockProvider.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        command: 'shellIntegrationStatus',
        terminalId: 'term-1'
      }));
    });
  });

  describe('removeTerminal', () => {
    it('should clean up terminal resources', () => {
      service.initializeTerminal('term-1');
      service.removeTerminal('term-1');
      
      expect(service.getTerminalStatus('term-1')).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should dispose resources', () => {
      service.dispose();
      expect(mockEventEmitter.dispose).toHaveBeenCalled();
    });
  });
});
