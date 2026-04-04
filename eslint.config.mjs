// @ts-check
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginEslintComments from '@eslint-community/eslint-plugin-eslint-comments';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'out/**',
      'dist/**',
      '**/*.d.ts',
      'webpack.config.js',
      'node_modules/**',
      '.vscode-test/**',
      'eslint-rules/**',
      '.synapse/**',
      'symphony/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '!eslint.config.mjs',
    ],
  },

  // Base TypeScript config (recommended only, without type-checking)
  ...tseslint.configs.recommended,

  // Main rules for all TypeScript files
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
      '@eslint-community/eslint-comments': eslintPluginEslintComments,
    },
    rules: {
      // ESLint Comments (from .eslintrc.json - previously not enforced in CI)
      '@eslint-community/eslint-comments/disable-enable-pair': [
        'warn',
        { allowWholeFile: false },
      ],
      '@eslint-community/eslint-comments/no-aggregating-enable': 'warn',
      '@eslint-community/eslint-comments/no-duplicate-disable': 'warn',
      '@eslint-community/eslint-comments/no-unlimited-disable': 'warn',
      '@eslint-community/eslint-comments/no-unused-enable': 'warn',
      '@eslint-community/eslint-comments/no-unused-disable': 'warn',
      '@eslint-community/eslint-comments/require-description': 'off',

      // Prettier
      'prettier/prettier': 'error',

      // TypeScript
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
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

      // Downgrade rules from typescript-eslint/recommended that weren't in the old config
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',

      // General
      curly: ['warn', 'multi-line'],
      eqeqeq: ['warn', 'always'],
      'no-throw-literal': 'warn',
      semi: ['error', 'always'],
      complexity: ['warn', { max: 10 }],
      'max-depth': ['warn', { max: 4 }],
      'max-nested-callbacks': ['warn', { max: 3 }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: '*',
          property: 'innerHTML',
          message:
            'SECURITY: innerHTML is not allowed due to XSS vulnerability risk. Use textContent, createElement, or appendChild instead. See issue #229.',
        },
      ],
      'no-console': 'warn',

      // Memory leak detection rules (from .eslintrc.memory-leaks.json)
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.property.name=/^on(Did|Will)/]:not(:has(VariableDeclarator))",
          message:
            'Event subscriptions should be stored in a variable for proper disposal. Consider using DisposableStore.',
        },
        {
          selector: "CallExpression[callee.name='setInterval']:not(:has(VariableDeclarator))",
          message:
            'setInterval should be stored in a variable and cleared in dispose(). Track timers in a collection.',
        },
        {
          selector: "CallExpression[callee.name='setTimeout']:not(:has(VariableDeclarator))",
          message:
            'setTimeout should be stored in a variable if it needs cleanup. Consider tracking in a collection.',
        },
        {
          selector:
            "CallExpression[callee.object.name='window'][callee.property.name='addEventListener']:not(:has(VariableDeclarator))",
          message:
            'addEventListener should be paired with removeEventListener. Store handler reference for cleanup.',
        },
      ],
    },
  },

  // Logger files: allow console
  {
    files: ['src/utils/logger.ts', 'src/webview/utils/ManagerLogger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Test files: relaxed rules
  {
    files: ['src/test/**/*.ts', 'src/test/**/*.js'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^error$|^e$',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-rest-params': 'off',
      'max-lines-per-function': 'off',
      complexity: 'off',
      'max-depth': 'off',
      'max-nested-callbacks': 'off',
    },
  },

  // Prettier config (disables conflicting rules) - must be last
  eslintConfigPrettier,
);
