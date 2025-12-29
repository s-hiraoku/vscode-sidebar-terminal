import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManagerLogger } from '../../../../../webview/utils/ManagerLogger';
import { webview as baseLog } from '../../../../../utils/logger';

// Mock base logger
vi.mock('../../../../../utils/logger', () => ({
  webview: vi.fn(),
}));

describe('ManagerLogger', () => {
  let logger: ManagerLogger;

  beforeEach(() => {
    // Reset global config to defaults
    ManagerLogger.configure({
      enableTimestamp: false,
      enableLevel: true,
      maxMessageLength: 500,
    });
    ManagerLogger.clearHistory();
    logger = ManagerLogger.createLogger('TestManager', '🧪');
    vi.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log info messages to base logger', () => {
      logger.info('Hello world');
      expect(baseLog).toHaveBeenCalledWith(expect.stringContaining('🧪 [TestManager] Hello world'));
    });

    it('should include [LEVEL] for non-info logs', () => {
      logger.error('Failed');
      expect(baseLog).toHaveBeenCalledWith(expect.stringContaining('[ERROR] 🧪 [TestManager] Failed'));
    });

    it('should truncate long messages', () => {
      // Configure BEFORE creating the instance, or use a fresh one
      ManagerLogger.configure({ maxMessageLength: 10 });
      const truncateLogger = ManagerLogger.createLogger('Short', 'S');
      
      const longMsg = 'This is a very long message';
      truncateLogger.info(longMsg);
      
      expect(baseLog).toHaveBeenCalledWith(expect.stringContaining('This is a ...'));
    });

    it('should log additional data', () => {
      const data = { id: 1 };
      logger.info('Msg', data);
      
      expect(baseLog).toHaveBeenCalledWith(expect.stringContaining('🧪 [TestManager] Msg'));
      expect(baseLog).toHaveBeenCalledWith('🔍 [TestManager] Data:', data);
    });
  });

  describe('Specialized Formats', () => {
    it('should format lifecycle events', () => {
      logger.lifecycle('Init', 'completed');
      expect(baseLog).toHaveBeenCalledWith(expect.stringContaining('🧪 [TestManager] ✅ Init completed'));
    });

    it('should format performance logs', () => {
      logger.performance('Startup', 150);
      expect(baseLog).toHaveBeenCalledWith(expect.stringContaining('🧪 [TestManager] ⏱️ Startup: 150ms'));
    });
  });

  describe('History and Stats', () => {
    it('should keep track of log history', () => {
      logger.info('msg1');
      logger.warn('msg2');
      
      const all = ManagerLogger.getAllLogs();
      expect(all.length).toBe(2);
      expect(all[0].message).toBe('msg1');
    });

    it('should filter logs by manager', () => {
      const other = ManagerLogger.createLogger('Other');
      logger.info('msg1');
      other.info('msg2');
      
      const filtered = logger.getRecentLogs(10);
      expect(filtered.length).toBe(1);
      expect(filtered[0].message).toBe('msg1');
    });

    it('should provide statistics', () => {
      logger.info('msg');
      logger.error('err');
      
      const stats = ManagerLogger.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.levelCounts.info).toBe(1);
      expect(stats.levelCounts.error).toBe(1);
      expect(stats.managerCounts['TestManager']).toBe(2);
    });
  });
});