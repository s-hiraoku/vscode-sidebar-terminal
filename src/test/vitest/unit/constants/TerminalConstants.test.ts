import { describe, it, expect } from 'vitest';
import { TERMINAL_CONSTANTS } from '../../../../constants/TerminalConstants';

describe('TerminalConstants', () => {
  it('should have MAX_TERMINAL_COUNT set to 10', () => {
    expect(TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT).toBe(10);
  });

  it('should have DEFAULT_MAX_TERMINALS set to 10', () => {
    expect(TERMINAL_CONSTANTS.DEFAULT_MAX_TERMINALS).toBe(10);
  });

  it('should have MAX_TERMINAL_ID_NUMBER set to 10', () => {
    expect(TERMINAL_CONSTANTS.MAX_TERMINAL_ID_NUMBER).toBe(10);
  });
});
