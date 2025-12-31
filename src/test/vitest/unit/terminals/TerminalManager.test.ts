
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalManager } from '../../../../terminals/TerminalManager';

// Mock dependencies
vi.mock('vscode', () => {
  class MockEventEmitter {
    fire = vi.fn();
    event = vi.fn();
    dispose = vi.fn();
  }
  return {
    default: {},
    EventEmitter: MockEventEmitter,
    workspace: {
      workspaceFolders: []
    }
  };
});

vi.mock('../../../../utils/logger', () => ({
  terminal: vi.fn(),
}));

vi.mock('../../../../utils/common', () => {
  class MockActiveTerminalManager {
    getActive = vi.fn();
    setActive = vi.fn();
    clearActive = vi.fn();
    hasActive = vi.fn();
    isActive = vi.fn();
  }

  return {
    getTerminalConfig: vi.fn().mockReturnValue({ maxTerminals: 5 }),
    ActiveTerminalManager: MockActiveTerminalManager,
  };
});

vi.mock('../../../../services/TerminalProfileService', () => {
  class MockTerminalProfileService {
    resolveProfile = vi.fn();
    getAvailableProfiles = vi.fn();
    getDefaultProfile = vi.fn();
  }
  return { TerminalProfileService: MockTerminalProfileService };
});

vi.mock('../../../../services/CliAgentDetectionService', () => {
  class MockCliAgentDetectionService {
    startHeartbeat = vi.fn();
    dispose = vi.fn();
    onCliAgentStatusChange = vi.fn();
    getAgentState = vi.fn().mockReturnValue({ status: 'none', agentType: null });
    getConnectedAgent = vi.fn().mockReturnValue(null);
    getDisconnectedAgents = vi.fn().mockReturnValue(new Map());
    refreshAgentState = vi.fn();
    detectFromOutput = vi.fn();
    detectFromInput = vi.fn();
    switchAgentConnection = vi.fn();
    forceReconnectAgent = vi.fn();
    clearDetectionError = vi.fn();
    handleTerminalRemoved = vi.fn();
  }
  return { CliAgentDetectionService: MockCliAgentDetectionService };
});

vi.mock('../../../../services/TerminalProcessManager', () => {
  class MockTerminalProcessManager {}
  return { TerminalProcessManager: MockTerminalProcessManager };
});

vi.mock('../../../../services/TerminalValidationService', () => {
  class MockTerminalValidationService {}
  return { TerminalValidationService: MockTerminalValidationService };
});

vi.mock('../../../../utils/CircularBufferManager', () => {
  class MockCircularBufferManager {
    bufferData = vi.fn();
  }
  return { CircularBufferManager: MockCircularBufferManager };
});

vi.mock('../../../../utils/TerminalNumberManager', () => {
  class MockTerminalNumberManager {
    canCreate = vi.fn().mockReturnValue(true);
    findAvailableNumber = vi.fn().mockReturnValue(1);
    getAvailableSlots = vi.fn().mockReturnValue([]);
  }
  return { TerminalNumberManager: MockTerminalNumberManager };
});

vi.mock('../../../../terminals/TerminalSpawner', () => {
  class MockTerminalSpawner {
    spawnTerminal = vi.fn();
  }
  return { TerminalSpawner: MockTerminalSpawner };
});


// Mock Coordinators
const mockLifecycleManager = {
  createTerminal: vi.fn(),
  createTerminalWithProfile: vi.fn(),
  deleteTerminal: vi.fn(),
  canRemoveTerminal: vi.fn(),
  removeTerminal: vi.fn(),
  getTerminal: vi.fn(),
  getTerminals: vi.fn(),
  getAvailableProfiles: vi.fn(),
  getDefaultProfile: vi.fn(),
  dispose: vi.fn(),
};

const mockCommandCoordinator = {
  getCurrentState: vi.fn(),
  hasActiveTerminal: vi.fn(),
  getActiveTerminalId: vi.fn(),
  setActiveTerminal: vi.fn(),
  focusTerminal: vi.fn(),
  reorderTerminals: vi.fn(),
  updateTerminalCwd: vi.fn(),
  sendInput: vi.fn(),
  resize: vi.fn(),
  writeToTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
  notifyStateUpdate: vi.fn(),
  updateActiveTerminalAfterRemoval: vi.fn(),
};

const mockProcessCoordinator = {
  initializeShellForTerminal: vi.fn(),
  startPtyOutput: vi.fn(),
  setupTerminalEvents: vi.fn(),
  cleanupInitialPromptGuard: vi.fn(),
  cleanupPtyOutput: vi.fn(),
  dispose: vi.fn(),
};

const mockDataBufferManager = {
  bufferData: vi.fn(),
  cleanupBuffer: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../../../../terminals/TerminalLifecycleManager', () => {
  class MockTerminalLifecycleManager {
    constructor() { return mockLifecycleManager; }
  }
  return { TerminalLifecycleManager: MockTerminalLifecycleManager };
});

vi.mock('../../../../terminals/TerminalCommandCoordinator', () => {
  class MockTerminalCommandCoordinator {
    constructor() { return mockCommandCoordinator; }
  }
  return { TerminalCommandCoordinator: MockTerminalCommandCoordinator };
});

vi.mock('../../../../terminals/TerminalProcessCoordinator', () => {
  class MockTerminalProcessCoordinator {
    constructor() { return mockProcessCoordinator; }
  }
  return { TerminalProcessCoordinator: MockTerminalProcessCoordinator };
});

vi.mock('../../../../terminals/TerminalDataBufferManager', () => {
  class MockTerminalDataBufferManager {
    constructor() { return mockDataBufferManager; }
  }
  return { TerminalDataBufferManager: MockTerminalDataBufferManager };
});


describe('TerminalManager', () => {
  let manager: TerminalManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TerminalManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Lifecycle Delegation', () => {
    it('createTerminal delegates to LifecycleManager', () => {
      manager.createTerminal();
      expect(mockLifecycleManager.createTerminal).toHaveBeenCalled();
    });

    it('createTerminalWithProfile delegates to LifecycleManager', async () => {
      await manager.createTerminalWithProfile('profile');
      expect(mockLifecycleManager.createTerminalWithProfile).toHaveBeenCalledWith('profile');
    });

    it('deleteTerminal delegates to LifecycleManager', async () => {
      await manager.deleteTerminal('t1');
      expect(mockLifecycleManager.deleteTerminal).toHaveBeenCalledWith('t1', expect.anything());
    });

    it('canRemoveTerminal delegates to LifecycleManager', () => {
      manager.canRemoveTerminal('t1');
      expect(mockLifecycleManager.canRemoveTerminal).toHaveBeenCalledWith('t1');
    });

    it('getTerminal delegates to LifecycleManager', () => {
      manager.getTerminal('t1');
      expect(mockLifecycleManager.getTerminal).toHaveBeenCalledWith('t1');
    });
  });

  describe('Process Delegation', () => {
    it('initializeShellForTerminal delegates to ProcessCoordinator', () => {
      manager.initializeShellForTerminal('t1', {}, true);
      expect(mockProcessCoordinator.initializeShellForTerminal).toHaveBeenCalledWith('t1', {}, true);
    });

    it('startPtyOutput delegates to ProcessCoordinator', () => {
      manager.startPtyOutput('t1');
      expect(mockProcessCoordinator.startPtyOutput).toHaveBeenCalledWith('t1');
    });
  });

  describe('Command/IO Delegation', () => {
    it('sendInput delegates to CommandCoordinator', () => {
      manager.sendInput('data', 't1');
      expect(mockCommandCoordinator.sendInput).toHaveBeenCalledWith('data', 't1');
    });

    it('resize delegates to CommandCoordinator', () => {
      manager.resize(10, 20, 't1');
      expect(mockCommandCoordinator.resize).toHaveBeenCalledWith(10, 20, 't1');
    });

    it('writeToTerminal delegates to CommandCoordinator', () => {
      manager.writeToTerminal('t1', 'data');
      expect(mockCommandCoordinator.writeToTerminal).toHaveBeenCalledWith('t1', 'data');
    });

    it('resizeTerminal delegates to CommandCoordinator', () => {
      manager.resizeTerminal('t1', 80, 24);
      expect(mockCommandCoordinator.resizeTerminal).toHaveBeenCalledWith('t1', 80, 24);
    });

    it('setActiveTerminal delegates to CommandCoordinator', () => {
      manager.setActiveTerminal('t1');
      expect(mockCommandCoordinator.setActiveTerminal).toHaveBeenCalledWith('t1');
    });
  });

  describe('Dispose', () => {
    it('should dispose all coordinators', () => {
      manager.dispose();
      expect(mockLifecycleManager.dispose).toHaveBeenCalled();
      expect(mockProcessCoordinator.dispose).toHaveBeenCalled();
      expect(mockDataBufferManager.dispose).toHaveBeenCalled();
      // CommandCoordinator doesn't seem to have dispose method called in TerminalManager.dispose() 
      // based on my reading of TerminalManager.ts earlier?
      // Let's check TerminalManager.ts again.
    });
  });
});
