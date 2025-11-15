/**
 * Custom ESLint Rules for Manager Pattern Standardization
 *
 * These rules enforce the Manager pattern standardization as described in Issue #216
 *
 * @see docs/refactoring/issue-216-manager-standardization.md
 */

module.exports = {
  rules: {
    'require-base-manager': require('./require-base-manager'),
  },
};
