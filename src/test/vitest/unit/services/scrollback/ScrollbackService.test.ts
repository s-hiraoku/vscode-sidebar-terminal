/**
 * ScrollbackService Unit Tests
 *
 * Vitest Migration: Converted from Mocha/assert to Vitest
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScrollbackService } from '../../../../../services/scrollback/ScrollbackService';

describe('ScrollbackService', () => {
  let service: ScrollbackService;

  beforeEach(() => {
    service = new ScrollbackService();
  });

  afterEach(() => {
    if (service) {
      service.dispose();
    }
  });

  describe('Basic Operations', () => {
    it('should initialize successfully', () => {
      expect(service).toBeDefined();
    });

    it('should start recording', () => {
      service.startRecording('term-1');
      const stats = service.getScrollbackStats('term-1');
      expect(stats).toBeDefined();
      expect(stats!.isRecording).toBe(true);
    });

    it('should record data', () => {
      service.startRecording('term-1');
      service.recordData('term-1', 'test data\n');
      const stats = service.getScrollbackStats('term-1');
      expect(stats).toBeDefined();
      expect(stats!.entryCount).toBe(1);
    });

    it('should serialize data', () => {
      service.startRecording('term-1');
      service.recordData('term-1', 'line 1\n');
      service.recordData('term-1', 'line 2\n');
      const data = service.getSerializedData('term-1');
      expect(data).toBeDefined();
      expect(data).toContain('line 1');
      expect(data).toContain('line 2');
    });
  });
});
