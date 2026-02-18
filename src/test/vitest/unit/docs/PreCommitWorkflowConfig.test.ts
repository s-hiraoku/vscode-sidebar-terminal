import { describe, it, expect } from 'vitest';
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
  it('adds required dev dependencies for hooks and commit message linting', () => {
    const pkg = readPackageJson();
    const devDeps = pkg.devDependencies ?? {};

    expect(devDeps).toHaveProperty('husky');
    expect(devDeps).toHaveProperty('lint-staged');
    expect(devDeps).toHaveProperty('@commitlint/cli');
    expect(devDeps).toHaveProperty('@commitlint/config-conventional');
  });

  it('registers prepare script and lint-staged config in package.json', () => {
    const pkg = readPackageJson();

    expect(pkg.scripts?.prepare).toBe('husky');
    expect(pkg).toHaveProperty('lint-staged');
  });

  it('creates husky hooks for pre-commit and commit-msg', () => {
    const preCommit = readText('.husky/pre-commit');
    const commitMsg = readText('.husky/commit-msg');

    expect(preCommit).toContain('npx lint-staged');
    expect(commitMsg).toContain('commitlint --edit ${1}');
  });

  it('defines commitlint configuration using conventional commits', () => {
    const configText = readText('commitlint.config.cjs');

    expect(configText).toContain("extends: ['@commitlint/config-conventional']");
    expect(configText).toContain("'type-enum'");
  });
});
