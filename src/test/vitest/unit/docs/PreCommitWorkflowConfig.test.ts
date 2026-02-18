import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
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

  it('registers prepare script in package.json', () => {
    // Given: package.json scripts
    // When: checking hook registration
    // Then: prepare script runs husky
    expect(pkg!.scripts?.prepare).toBe('husky');
  });

  it('uses external lint-staged config file instead of package.json key', () => {
    // Given: lint-staged configuration
    // When: checking config location
    // Then: config lives in lint-staged.config.cjs, not package.json
    expect(pkg).not.toHaveProperty('lint-staged');
    expect(fs.existsSync(path.join(repoRoot, 'lint-staged.config.cjs'))).toBe(true);
  });

  it('lint-staged config runs tsc --noEmit before lint and format', () => {
    // Given: lint-staged config for TypeScript files
    const configText = readText('lint-staged.config.cjs');

    // When: checking type check command
    // Then: tsc --noEmit is present
    expect(configText).toContain('tsc --noEmit');
  });

  it('lint-staged config includes eslint and prettier commands', () => {
    // Given: lint-staged config for TypeScript files
    const configText = readText('lint-staged.config.cjs');

    // When: checking lint and format commands
    // Then: eslint --fix and prettier --write are present
    expect(configText).toContain('eslint --fix');
    expect(configText).toContain('prettier --write');
  });

  it('lint-staged uses function form for TypeScript to avoid file path appending', () => {
    // Given: lint-staged config
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(path.join(repoRoot, 'lint-staged.config.cjs'));

    // When: checking TypeScript pattern config type
    // Then: it is a function (prevents lint-staged from appending staged file paths)
    expect(typeof config['*.{ts,tsx}']).toBe('function');
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
