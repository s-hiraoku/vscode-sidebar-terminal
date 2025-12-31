import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  TerminalLogger, 
  MessageLogger, 
  WebViewLogger, 
  ExtensionLogger, 
  SessionLogger, 
  PerformanceLogger,
  AgentLogger,
  createWebViewLogger
} from '../../../../utils/ComponentLoggers';

const { mockLoggers } = vi.hoisted(() => {
  return {
    mockLoggers: {
      terminal: vi.fn(),
      message: vi.fn(),
      extension: vi.fn(),
      performance: vi.fn(),
      ui: vi.fn(),
      config: vi.fn(),
      session: vi.fn(),
      input: vi.fn(),
      output: vi.fn(),
      lifecycle: vi.fn(),
      error_category: vi.fn(),
      warning_category: vi.fn(),
      agent: vi.fn(),
      state: vi.fn(),
    }
  };
});

vi.mock('../../../../utils/logger', () => mockLoggers);

describe('ComponentLoggers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TerminalLogger', () => {
    it('should log terminal operations', () => {
      const logger = new TerminalLogger('t1', 'Terminal 1');
      logger.create('t1', 'Terminal 1');
      expect(mockLoggers.terminal).toHaveBeenCalledWith(expect.stringContaining('[t1](Terminal 1) Created terminal'));

      logger.output('data', 4);
      expect(mockLoggers.output).toHaveBeenCalledWith(expect.stringContaining('[t1](Terminal 1) Output'), 'data');
    });
  });

  describe('MessageLogger', () => {
    it('should log message operations', () => {
      const logger = new MessageLogger('Context');
      logger.received('cmd', 'source');
      expect(mockLoggers.message).toHaveBeenCalledWith(expect.stringContaining('[Context] Received: cmd from source'));
    });
  });

  describe('WebViewLogger', () => {
    it('should log webview operations', () => {
      const logger = new WebViewLogger('Manager');
      logger.initialized();
      expect(mockLoggers.lifecycle).toHaveBeenCalledWith(expect.stringContaining('[Manager] Initialized'));
      
      logger.render('Component');
      expect(mockLoggers.ui).toHaveBeenCalledWith(expect.stringContaining('[Manager] Rendered Component'));
    });
  });

  describe('ExtensionLogger', () => {
    it('should log extension operations', () => {
      const logger = new ExtensionLogger('Provider');
      logger.activated();
      expect(mockLoggers.lifecycle).toHaveBeenCalledWith(expect.stringContaining('[Provider] Activated'));
    });
  });

  describe('SessionLogger', () => {
    it('should log session operations', () => {
      const logger = new SessionLogger();
      logger.save('id', 100);
      expect(mockLoggers.session).toHaveBeenCalledWith(expect.stringContaining('[Session] Saved session'));
    });
  });

  describe('PerformanceLogger', () => {
    it('should log performance operations', () => {
      const logger = new PerformanceLogger('Comp');
      logger.startOperation('op');
      expect(mockLoggers.performance).toHaveBeenCalledWith(expect.stringContaining('[Comp] Started: op'));
    });
  });

  describe('AgentLogger', () => {
    it('should log agent operations', () => {
      const logger = new AgentLogger('Claude');
      logger.detected('t1', 'Claude');
      expect(mockLoggers.agent).toHaveBeenCalledWith(expect.stringContaining('[Claude] Detected'));
    });
  });

  describe('createWebViewLogger', () => {
    it('should create instance', () => {
      const logger = createWebViewLogger('Test');
      expect(logger).toBeInstanceOf(WebViewLogger);
    });
  });
});
