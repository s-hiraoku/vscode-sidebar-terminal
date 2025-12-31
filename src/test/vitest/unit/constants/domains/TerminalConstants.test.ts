/**
 * TerminalConstants Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { TERMINAL_CONSTANTS } from '../../../../../constants/domains/TerminalConstants';

describe('TerminalConstants', () => {
  describe('Terminal Limits', () => {
    it('should have valid terminal count limits', () => {
      expect(TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT).toBe(5);
      expect(TERMINAL_CONSTANTS.DEFAULT_MAX_TERMINALS).toBe(5);
    });

    it('should have valid terminal ID range', () => {
      expect(TERMINAL_CONSTANTS.MIN_TERMINAL_ID_NUMBER).toBe(1);
      expect(TERMINAL_CONSTANTS.MAX_TERMINAL_ID_NUMBER).toBe(5);
      expect(TERMINAL_CONSTANTS.MAX_TERMINAL_ID_NUMBER).toEqual(
        TERMINAL_CONSTANTS.MAX_TERMINAL_COUNT
      );
    });
  });

  describe('Platform Settings', () => {
    it('should have valid platform identifiers', () => {
      expect(TERMINAL_CONSTANTS.PLATFORMS.WINDOWS).toBe('win32');
      expect(TERMINAL_CONSTANTS.PLATFORMS.MACOS).toBe('darwin');
      expect(TERMINAL_CONSTANTS.PLATFORMS.DARWIN).toBe('darwin');
      expect(TERMINAL_CONSTANTS.PLATFORMS.LINUX).toBe('linux');
    });

    it('should have default shells for all platforms', () => {
      expect(TERMINAL_CONSTANTS.PLATFORMS.DEFAULT_SHELLS.win32).toBe('powershell.exe');
      expect(TERMINAL_CONSTANTS.PLATFORMS.DEFAULT_SHELLS.darwin).toBe('/bin/zsh');
      expect(TERMINAL_CONSTANTS.PLATFORMS.DEFAULT_SHELLS.linux).toBe('/bin/bash');
    });
  });

  describe('Terminal Settings', () => {
    it('should have valid default dimensions', () => {
      expect(TERMINAL_CONSTANTS.DEFAULT_TERMINAL_COLS).toBe(80);
      expect(TERMINAL_CONSTANTS.DEFAULT_TERMINAL_ROWS).toBe(24);
      expect(TERMINAL_CONSTANTS.ALTERNATE_DEFAULT_ROWS).toBe(30);
    });

    it('should have valid minimum size thresholds', () => {
      expect(TERMINAL_CONSTANTS.MIN_TERMINAL_HEIGHT_PX).toBe(100);
      expect(TERMINAL_CONSTANTS.MIN_TERMINAL_SIZE_THRESHOLD_PX).toBe(50);
    });

    it('should have valid tab stop width', () => {
      expect(TERMINAL_CONSTANTS.TAB_STOP_WIDTH).toBe(8);
    });
  });

  describe('Name Prefixes', () => {
    it('should have valid terminal name prefix', () => {
      expect(TERMINAL_CONSTANTS.TERMINAL_NAME_PREFIX).toBe('Terminal');
    });

    it('should have valid terminal ID prefix', () => {
      expect(TERMINAL_CONSTANTS.TERMINAL_ID_PREFIX).toBe('terminal-');
    });

    it('should have valid split terminal suffix', () => {
      expect(TERMINAL_CONSTANTS.SPLIT_TERMINAL_SUFFIX).toBe('-split');
    });
  });

  describe('Scrollback Settings', () => {
    it('should have valid scrollback limits', () => {
      expect(TERMINAL_CONSTANTS.DEFAULT_SCROLLBACK_LINES).toBe(2000);
      expect(TERMINAL_CONSTANTS.MAX_SCROLLBACK_LINES).toBe(10000);
      expect(TERMINAL_CONSTANTS.DEFAULT_SCROLLBACK_LINES).toBeLessThanOrEqual(
        TERMINAL_CONSTANTS.MAX_SCROLLBACK_LINES
      );
    });

    it('should have valid chunk size', () => {
      expect(TERMINAL_CONSTANTS.SCROLLBACK_CHUNK_SIZE).toBe(100);
    });
  });

  describe('CLI Agent Detection', () => {
    it('should have valid debounce delay', () => {
      expect(TERMINAL_CONSTANTS.CLI_AGENT_DETECTION_DEBOUNCE_MS).toBe(500);
    });

    it('should have valid detection patterns', () => {
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.CLAUDE_CODE).toBeInstanceOf(RegExp);
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.GITHUB_COPILOT).toBeInstanceOf(RegExp);
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.GEMINI_CLI).toBeInstanceOf(RegExp);
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.GENERAL_AI).toBeInstanceOf(RegExp);
    });

    it('should match expected patterns', () => {
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.CLAUDE_CODE.test('Claude Code')).toBe(true);
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.GITHUB_COPILOT.test('GitHub Copilot')).toBe(
        true
      );
      expect(TERMINAL_CONSTANTS.CLI_AGENT_PATTERNS.GEMINI_CLI.test('gemini')).toBe(true);
    });
  });
});
