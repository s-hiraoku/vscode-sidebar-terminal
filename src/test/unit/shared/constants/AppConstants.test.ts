/**
 * AppConstants Test Suite
 * Tests the unified constants to ensure consistency and completeness
 */

import { expect } from 'chai';
import {
  TERMINAL_CONSTANTS,
  WEBVIEW_CONSTANTS,
  CLI_AGENT_CONSTANTS,
  FILE_REFERENCE_CONSTANTS,
  NOTIFICATION_CONSTANTS,
  TEST_CONSTANTS,
} from '../../../../shared/constants/AppConstants';

describe('AppConstants', () => {
  describe('TERMINAL_CONSTANTS', () => {
    it('should have all required terminal configuration values', () => {
      expect(TERMINAL_CONSTANTS.DEFAULT_MAX_TERMINALS).to.equal(5);
      expect(TERMINAL_CONSTANTS.DEFAULT_COLS).to.equal(80);
      expect(TERMINAL_CONSTANTS.DEFAULT_ROWS).to.equal(30);
      expect(TERMINAL_CONSTANTS.SCROLLBACK_LINES).to.equal(10000);
      expect(TERMINAL_CONSTANTS.TERMINAL_REMOVE_DELAY).to.equal(2000);
    });

    it('should have platform constants', () => {
      expect(TERMINAL_CONSTANTS.PLATFORMS).to.deep.equal({
        WINDOWS: 'win32',
        DARWIN: 'darwin',
        LINUX: 'linux',
      });
    });

    it('should have configuration keys', () => {
      expect(TERMINAL_CONSTANTS.CONFIG_KEYS).to.have.property('SHELL_PATH');
      expect(TERMINAL_CONSTANTS.CONFIG_KEYS).to.have.property('SHELL_ARGS');
      expect(TERMINAL_CONSTANTS.CONFIG_KEYS).to.have.property('MAX_TERMINALS');
    });

    it('should have number recycling configuration', () => {
      expect(TERMINAL_CONSTANTS.NUMBER_RECYCLING).to.have.property('ENABLED');
      expect(TERMINAL_CONSTANTS.NUMBER_RECYCLING).to.have.property('MAX_NUMBER');
      expect(TERMINAL_CONSTANTS.NUMBER_RECYCLING).to.have.property('MIN_NUMBER');
      expect(TERMINAL_CONSTANTS.NUMBER_RECYCLING.MAX_NUMBER).to.equal(5);
      expect(TERMINAL_CONSTANTS.NUMBER_RECYCLING.MIN_NUMBER).to.equal(1);
    });

    it('should have state management constants', () => {
      expect(TERMINAL_CONSTANTS.STATE_MANAGEMENT).to.have.property('SYNC_INTERVAL');
      expect(TERMINAL_CONSTANTS.STATE_MANAGEMENT).to.have.property('MAX_RETRY_ATTEMPTS');
    });
  });

  describe('WEBVIEW_CONSTANTS', () => {
    it('should have message types', () => {
      expect(WEBVIEW_CONSTANTS.MESSAGE_TYPES).to.have.property('INIT');
      expect(WEBVIEW_CONSTANTS.MESSAGE_TYPES).to.have.property('OUTPUT');
      expect(WEBVIEW_CONSTANTS.MESSAGE_TYPES).to.have.property('RESIZE');
      expect(WEBVIEW_CONSTANTS.MESSAGE_TYPES).to.have.property('DELETE_TERMINAL');
    });

    it('should have performance settings', () => {
      expect(WEBVIEW_CONSTANTS.PERFORMANCE).to.have.property('BUFFER_FLUSH_INTERVAL');
      expect(WEBVIEW_CONSTANTS.PERFORMANCE).to.have.property('DEBOUNCE_DELAY');
      expect(WEBVIEW_CONSTANTS.PERFORMANCE).to.have.property('MAX_BUFFER_SIZE');
    });

    it('should have theme constants', () => {
      expect(WEBVIEW_CONSTANTS.THEMES).to.have.property('DARK');
      expect(WEBVIEW_CONSTANTS.THEMES).to.have.property('LIGHT');
      expect(WEBVIEW_CONSTANTS.THEMES).to.have.property('HIGH_CONTRAST');
    });

    it('should have CSS classes', () => {
      expect(WEBVIEW_CONSTANTS.CSS_CLASSES).to.have.property('TERMINAL_CONTAINER');
      expect(WEBVIEW_CONSTANTS.CSS_CLASSES).to.have.property('ACTIVE_TERMINAL');
      expect(WEBVIEW_CONSTANTS.CSS_CLASSES).to.have.property('NOTIFICATION');
    });
  });

  describe('CLI_AGENT_CONSTANTS', () => {
    it('should have agent detection patterns', () => {
      expect(CLI_AGENT_CONSTANTS.AGENTS).to.have.property('CLAUDE');
      expect(CLI_AGENT_CONSTANTS.AGENTS).to.have.property('GEMINI');

      expect(CLI_AGENT_CONSTANTS.AGENTS.CLAUDE).to.have.property('NAME');
      expect(CLI_AGENT_CONSTANTS.AGENTS.CLAUDE).to.have.property('COMMAND_PATTERN');
      expect(CLI_AGENT_CONSTANTS.AGENTS.CLAUDE).to.have.property('COMPLETION_PATTERN');
    });

    it('should have valid regex patterns', () => {
      const claudePattern = CLI_AGENT_CONSTANTS.AGENTS.CLAUDE.COMMAND_PATTERN;
      const geminiPattern = CLI_AGENT_CONSTANTS.AGENTS.GEMINI.COMMAND_PATTERN;

      expect(claudePattern).to.be.instanceOf(RegExp);
      expect(geminiPattern).to.be.instanceOf(RegExp);

      // Test pattern matching
      expect(claudePattern.test('claude-code "help"')).to.be.true;
      expect(geminiPattern.test('gemini code "test"')).to.be.true;
    });

    it('should have detection and output settings', () => {
      expect(CLI_AGENT_CONSTANTS.DETECTION).to.have.property('PATTERNS');
      expect(CLI_AGENT_CONSTANTS.DETECTION).to.have.property('TIMEOUTS');

      expect(CLI_AGENT_CONSTANTS.OUTPUT).to.have.property('BUFFER_SIZE');
      expect(CLI_AGENT_CONSTANTS.OUTPUT).to.have.property('FLUSH_INTERVAL');
      expect(CLI_AGENT_CONSTANTS.OUTPUT.FLUSH_INTERVAL).to.equal(4);
    });
  });

  describe('FILE_REFERENCE_CONSTANTS', () => {
    it('should have format prefixes', () => {
      expect(FILE_REFERENCE_CONSTANTS.FORMATS).to.have.property('CLI_AGENT');
      expect(FILE_REFERENCE_CONSTANTS.FORMATS).to.have.property('COPILOT');

      expect(FILE_REFERENCE_CONSTANTS.FORMATS.CLI_AGENT).to.equal('@');
      expect(FILE_REFERENCE_CONSTANTS.FORMATS.COPILOT).to.equal('#file:');
    });

    it('should have line range patterns', () => {
      expect(FILE_REFERENCE_CONSTANTS.LINE_RANGE).to.have.property('PATTERN');
      expect(FILE_REFERENCE_CONSTANTS.LINE_RANGE).to.have.property('SINGLE_LINE_FORMAT');
      expect(FILE_REFERENCE_CONSTANTS.LINE_RANGE).to.have.property('RANGE_FORMAT');

      const pattern = FILE_REFERENCE_CONSTANTS.LINE_RANGE.PATTERN;
      expect(pattern).to.be.instanceOf(RegExp);

      // Test pattern matching
      expect(pattern.test('#L10')).to.be.true;
      expect(pattern.test('#L5-L15')).to.be.true;
    });

    it('should have validation rules', () => {
      expect(FILE_REFERENCE_CONSTANTS.VALIDATION).to.have.property('MAX_PATH_LENGTH');
      expect(FILE_REFERENCE_CONSTANTS.VALIDATION).to.have.property('ALLOWED_EXTENSIONS');
      expect(FILE_REFERENCE_CONSTANTS.VALIDATION).to.have.property('EXCLUDED_PATTERNS');

      expect(FILE_REFERENCE_CONSTANTS.VALIDATION.MAX_PATH_LENGTH).to.be.a('number');
      expect(FILE_REFERENCE_CONSTANTS.VALIDATION.ALLOWED_EXTENSIONS).to.be.an('array');
    });

    it('should have configuration keys', () => {
      expect(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS).to.have.property('ENABLE_CLI_AGENT');
      expect(FILE_REFERENCE_CONSTANTS.CONFIG_KEYS).to.have.property('ENABLE_COPILOT');
    });
  });

  describe('NOTIFICATION_CONSTANTS', () => {
    it('should have notification types', () => {
      expect(NOTIFICATION_CONSTANTS.TYPES).to.have.property('INFO');
      expect(NOTIFICATION_CONSTANTS.TYPES).to.have.property('WARNING');
      expect(NOTIFICATION_CONSTANTS.TYPES).to.have.property('ERROR');
      expect(NOTIFICATION_CONSTANTS.TYPES).to.have.property('SUCCESS');
    });

    it('should have duration settings', () => {
      expect(NOTIFICATION_CONSTANTS.DURATIONS).to.have.property('SHORT');
      expect(NOTIFICATION_CONSTANTS.DURATIONS).to.have.property('MEDIUM');
      expect(NOTIFICATION_CONSTANTS.DURATIONS).to.have.property('LONG');
      expect(NOTIFICATION_CONSTANTS.DURATIONS).to.have.property('PERSISTENT');

      expect(NOTIFICATION_CONSTANTS.DURATIONS.PERSISTENT).to.equal(-1);
    });

    it('should have position and animation settings', () => {
      expect(NOTIFICATION_CONSTANTS.POSITIONS).to.have.property('TOP_RIGHT');
      expect(NOTIFICATION_CONSTANTS.POSITIONS).to.have.property('BOTTOM_RIGHT');

      expect(NOTIFICATION_CONSTANTS.ANIMATIONS).to.have.property('FADE_IN_DURATION');
      expect(NOTIFICATION_CONSTANTS.ANIMATIONS).to.have.property('FADE_OUT_DURATION');
    });

    it('should have configuration keys', () => {
      expect(NOTIFICATION_CONSTANTS.CONFIG_KEYS).to.have.property('ENABLE_NOTIFICATIONS');
      expect(NOTIFICATION_CONSTANTS.CONFIG_KEYS).to.have.property('NOTIFICATION_POSITION');
      expect(NOTIFICATION_CONSTANTS.CONFIG_KEYS).to.have.property('AUTO_HIDE_DURATION');
    });
  });

  describe('TEST_CONSTANTS', () => {
    it('should have timeout values', () => {
      expect(TEST_CONSTANTS.TIMEOUTS).to.have.property('UNIT_TEST');
      expect(TEST_CONSTANTS.TIMEOUTS).to.have.property('INTEGRATION_TEST');
      expect(TEST_CONSTANTS.TIMEOUTS).to.have.property('E2E_TEST');

      expect(TEST_CONSTANTS.TIMEOUTS.UNIT_TEST).to.equal(5000);
      expect(TEST_CONSTANTS.TIMEOUTS.INTEGRATION_TEST).to.equal(10000);
      expect(TEST_CONSTANTS.TIMEOUTS.E2E_TEST).to.equal(30000);
    });

    it('should have mock data', () => {
      expect(TEST_CONSTANTS.MOCK_DATA).to.have.property('TERMINAL_ID');
      expect(TEST_CONSTANTS.MOCK_DATA).to.have.property('PROCESS_ID');
      expect(TEST_CONSTANTS.MOCK_DATA).to.have.property('TITLE');

      expect(TEST_CONSTANTS.MOCK_DATA.TERMINAL_ID).to.equal('test-terminal-1');
      expect(TEST_CONSTANTS.MOCK_DATA.PROCESS_ID).to.equal(12345);
    });
  });

  describe('Constants Consistency', () => {
    it('should have consistent naming patterns', () => {
      // All constants should be uppercase with underscores
      const checkNaming = (obj: any, path = ''): void => {
        for (const [key, value] of Object.entries(obj)) {
          const fullPath = path ? `${path}.${key}` : key;

          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            !(value instanceof RegExp)
          ) {
            checkNaming(value, fullPath);
          } else {
            // Check that keys are uppercase with underscores (except for some exceptions)
            const exceptions = ['PATTERNS', 'FORMATS', 'TYPES', 'POSITIONS', 'ANIMATIONS'];
            if (!exceptions.includes(key) && key !== key.toUpperCase()) {
              // Allow camelCase for nested objects
              if (!fullPath.includes('.')) {
                expect(key).to.equal(key.toUpperCase(), `Key ${fullPath} should be uppercase`);
              }
            }
          }
        }
      };

      checkNaming(TERMINAL_CONSTANTS);
      checkNaming(WEBVIEW_CONSTANTS);
      checkNaming(CLI_AGENT_CONSTANTS);
      checkNaming(FILE_REFERENCE_CONSTANTS);
      checkNaming(NOTIFICATION_CONSTANTS);
      checkNaming(TEST_CONSTANTS);
    });

    it('should have no duplicate values where uniqueness is expected', () => {
      // Check that message types are unique
      const messageTypes = Object.values(WEBVIEW_CONSTANTS.MESSAGE_TYPES);
      const uniqueMessageTypes = new Set(messageTypes);
      expect(messageTypes.length).to.equal(
        uniqueMessageTypes.size,
        'Message types should be unique'
      );

      // Check that theme names are unique
      const themes = Object.values(WEBVIEW_CONSTANTS.THEMES);
      const uniqueThemes = new Set(themes);
      expect(themes.length).to.equal(uniqueThemes.size, 'Theme names should be unique');
    });

    it('should have reasonable timeout values', () => {
      // Test timeouts should be reasonable
      expect(TEST_CONSTANTS.TIMEOUTS.UNIT_TEST).to.be.greaterThan(1000);
      expect(TEST_CONSTANTS.TIMEOUTS.UNIT_TEST).to.be.lessThan(10000);

      expect(TEST_CONSTANTS.TIMEOUTS.INTEGRATION_TEST).to.be.greaterThan(
        TEST_CONSTANTS.TIMEOUTS.UNIT_TEST
      );
      expect(TEST_CONSTANTS.TIMEOUTS.E2E_TEST).to.be.greaterThan(
        TEST_CONSTANTS.TIMEOUTS.INTEGRATION_TEST
      );

      // CLI Agent timeouts should be reasonable
      expect(CLI_AGENT_CONSTANTS.DETECTION.TIMEOUTS.ACTIVITY_TIMEOUT).to.be.greaterThan(5000);
      expect(CLI_AGENT_CONSTANTS.DETECTION.TIMEOUTS.COMMAND_TIMEOUT).to.be.greaterThan(
        CLI_AGENT_CONSTANTS.DETECTION.TIMEOUTS.ACTIVITY_TIMEOUT
      );
    });

    it('should have valid performance settings', () => {
      // Buffer sizes should be positive
      expect(WEBVIEW_CONSTANTS.PERFORMANCE.MAX_BUFFER_SIZE).to.be.greaterThan(0);
      expect(CLI_AGENT_CONSTANTS.OUTPUT.BUFFER_SIZE).to.be.greaterThan(0);

      // Flush intervals should be reasonable
      expect(WEBVIEW_CONSTANTS.PERFORMANCE.BUFFER_FLUSH_INTERVAL).to.be.greaterThan(0);
      expect(CLI_AGENT_CONSTANTS.OUTPUT.FLUSH_INTERVAL).to.be.greaterThan(0);
      expect(CLI_AGENT_CONSTANTS.OUTPUT.FLUSH_INTERVAL).to.be.lessThan(
        WEBVIEW_CONSTANTS.PERFORMANCE.BUFFER_FLUSH_INTERVAL
      );
    });
  });
});
