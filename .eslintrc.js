module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'local-rules'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',

    // Issue #216: Manager pattern standardization
    // Note: These rules will be gradually enforced as managers are migrated
    // 'local-rules/require-base-manager': 'warn', // TODO: Enable after Phase 1 migration
  },
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ['out', 'dist', '**/*.d.ts', 'eslint-rules'],
};