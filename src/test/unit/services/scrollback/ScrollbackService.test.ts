import * as assert from 'assert';
import { BaseTest } from '../../../utils';
import { ScrollbackService } from '../../../../services/scrollback/ScrollbackService';
import { IScrollbackConfig } from '../../../../services/scrollback/IScrollbackService';

class ScrollbackServiceTest extends BaseTest {
  public service!: ScrollbackService;

  protected override setup(): void {
    super.setup();
    this.service = new ScrollbackService();
  }

  protected override teardown(): void {
    if (this.service) {
      this.service.dispose();
    }
    super.teardown();
  }
}

describe('ScrollbackService', () => {
  const test = new ScrollbackServiceTest();

  beforeEach(() => test.beforeEach());
  afterEach(() => test.afterEach());

  describe('Basic Operations', () => {
    it('should initialize successfully', () => {
      assert.ok(test.service);
    });

    it('should start recording', () => {
      test.service.startRecording('term-1');
      const stats = test.service.getScrollbackStats('term-1');
      assert.ok(stats);
      assert.strictEqual(stats.isRecording, true);
    });

    it('should record data', () => {
      test.service.startRecording('term-1');
      test.service.recordData('term-1', 'test data\n');
      const stats = test.service.getScrollbackStats('term-1');
      assert.ok(stats);
      assert.strictEqual(stats.entryCount, 1);
    });

    it('should serialize data', () => {
      test.service.startRecording('term-1');
      test.service.recordData('term-1', 'line 1\n');
      test.service.recordData('term-1', 'line 2\n');
      const data = test.service.getSerializedData('term-1');
      assert.ok(data);
      assert.ok(data.includes('line 1'));
      assert.ok(data.includes('line 2'));
    });
  });
});
