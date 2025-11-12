// ESLint 9+ Flat Configuration
// Addresses GitHub Issue #228: Code Quality Refactoring

const typescriptParser = require('@typescript-eslint/parser');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    // Global ignores
    ignores: ['out/**', 'dist/**', '**/*.d.ts', 'webpack.config.js'],
  },
  {
    // Main configuration for TypeScript files
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      // Existing rules from .eslintrc.json
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      curly: ['warn', 'multi-line'],
      eqeqeq: ['error', 'always'],
      'no-throw-literal': 'error',
      semi: ['error', 'always'],

      // NEW RULES for Issue #228: Code Quality Refactoring

      // 1. Deep Nesting - Prevent 6+ levels of nesting
      'max-depth': ['warn', { max: 4 }],

      // 2. God Methods - Limit function length
      'max-lines-per-function': [
        'warn',
        {
          max: 100,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // 3. Complexity - Reduce cyclomatic complexity
      complexity: ['warn', { max: 15 }],

      // 4. Max file lines - Prevent god classes
      'max-lines': [
        'warn',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true,
        },
      ],

      // 5. Function parameters - Prevent primitive obsession
      'max-params': ['warn', { max: 4 }],

      // 6. Nested callbacks - Prevent callback hell
      'max-nested-callbacks': ['warn', { max: 3 }],

      // 7. Switch case statements - Limit switch complexity
      'max-statements': ['warn', { max: 30 }, { ignoreTopLevelFunctions: false }],

      // 8. Consistent naming
      '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],

      // 9. Code duplication indicators
      'no-duplicate-imports': 'error',

      // 10. Encourage early returns
      'no-else-return': ['warn', { allowElseIf: false }],

      // 11. Variable naming clarity
      'id-length': [
        'warn',
        {
          min: 2,
          max: 50,
          exceptions: ['i', 'j', 'k', 'x', 'y', 'z', '_'],
          properties: 'never',
        },
      ],

      // 12. TypeScript specific quality rules
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-string-starts-ends-with': 'warn',

      // 13. Enforce consistent return
      'consistent-return': 'warn',

      // 14. Avoid unclear boolean logic
      'no-unneeded-ternary': 'warn',

      // 15. Code organization
      'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1, maxBOF: 0 }],
    },
  },
  {
    // Test files - relaxed rules
    files: ['src/test/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'max-nested-callbacks': 'off',
    },
  },
  // Prettier configuration (should be last)
  prettierConfig,
];
