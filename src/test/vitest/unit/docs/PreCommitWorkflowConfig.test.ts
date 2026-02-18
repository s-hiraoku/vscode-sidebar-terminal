import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  'lint-staged'?: Record<string, string[]>;
  [key: string]: unknown;
};

const repoRoot = path.resolve(__dirname, '../../../../..');

const readText = (relativePath: string): string =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const readPackageJson = (): PackageJson => {
  const raw = readText('package.json');
  return JSON.parse(raw) as PackageJson;
};

describe('Pre-commit workflow configuration (#272)', () => {
  let pkg: PackageJson | null;
  let devDeps: Record<string, string> | null;

  beforeEach(() => {
    pkg = readPackageJson();
    devDeps = pkg.devDependencies ?? {};
  });

  afterEach(() => {
    pkg = null;
    devDeps = null;
  });

  it('adds required dev dependencies for hooks and commit message linting', () => {
    // Given: package.json devDependencies
    // When: checking required hook packages
    // Then: all hook-related packages are present
    expect(devDeps).toHaveProperty('husky');
    expect(devDeps).toHaveProperty('lint-staged');
    expect(devDeps).toHaveProperty('@commitlint/cli');
    expect(devDeps).toHaveProperty('@commitlint/config-conventional');
  });

  it('registers prepare script and lint-staged config in package.json', () => {
    // Given: package.json scripts and lint-staged config
    // When: checking hook registration
    // Then: prepare script runs husky and lint-staged config exists
    expect(pkg!.scripts?.prepare).toBe('husky');
    expect(pkg).toHaveProperty('lint-staged');
  });

  it('lint-staged runs type check before lint and format', () => {
    // Given: lint-staged config for TypeScript files
    const tsCommands = pkg!['lint-staged']?.['*.{ts,tsx}'] ?? [];

    // When: checking command order
    // Then: tsc --noEmit runs before eslint and prettier
    expect(tsCommands[0]).toContain('tsc --noEmit');
    expect(tsCommands).toContain('eslint --fix');
    expect(tsCommands).toContain('prettier --write');
  });

  it('creates husky hooks for pre-commit and commit-msg', () => {
    // Given: husky hook files
    const preCommit = readText('.husky/pre-commit');
    const commitMsg = readText('.husky/commit-msg');

    // When: checking hook contents
    // Then: pre-commit runs lint-staged, commit-msg runs commitlint with quoted arg
    expect(preCommit).toContain('npx lint-staged');
    expect(commitMsg).toContain('commitlint --edit "$1"');
  });

  it('defines commitlint configuration using conventional commits', () => {
    // Given: commitlint config file
    const configText = readText('commitlint.config.cjs');

    // When: checking config content
    // Then: extends conventional commits and defines type-enum
    expect(configText).toContain("extends: ['@commitlint/config-conventional']");
    expect(configText).toContain("'type-enum'");
  });
});
