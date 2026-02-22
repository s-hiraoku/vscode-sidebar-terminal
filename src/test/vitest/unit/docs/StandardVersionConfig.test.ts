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

describe('standard-version configuration (#273)', () => {
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

  describe('.versionrc.cjs existence and structure', () => {
    it('has .versionrc.cjs at the repository root', () => {
      expect(fs.existsSync(path.join(repoRoot, '.versionrc.cjs'))).toBe(true);
    });

    it('exports an object with tagPrefix "v"', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(path.join(repoRoot, '.versionrc.cjs'));
      expect(config.tagPrefix).toBe('v');
    });

    it('skips tag creation to support safe release procedure', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(path.join(repoRoot, '.versionrc.cjs'));
      expect(config.skip?.tag).toBe(true);
    });

    it('skips push to support safe release procedure', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const config = require(path.join(repoRoot, '.versionrc.cjs'));
      expect(config.skip?.push).toBe(true);
    });
  });

  describe('conventional commit type mappings', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let config: any;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      config = require(path.join(repoRoot, '.versionrc.cjs'));
    });

    it('maps feat to Added section', () => {
      const types = config.types as Array<{ type: string; section?: string; hidden?: boolean }>;
      const feat = types.find((t) => t.type === 'feat');
      expect(feat?.section).toBe('Added');
    });

    it('maps fix to Fixed section', () => {
      const types = config.types as Array<{ type: string; section?: string; hidden?: boolean }>;
      const fix = types.find((t) => t.type === 'fix');
      expect(fix?.section).toBe('Fixed');
    });

    it('maps perf and refactor to Changed section', () => {
      const types = config.types as Array<{ type: string; section?: string; hidden?: boolean }>;
      const perf = types.find((t) => t.type === 'perf');
      const refactor = types.find((t) => t.type === 'refactor');
      expect(perf?.section).toBe('Changed');
      expect(refactor?.section).toBe('Changed');
    });

    it('hides test, chore, and ci types', () => {
      const types = config.types as Array<{ type: string; section?: string; hidden?: boolean }>;
      for (const typeName of ['test', 'chore', 'ci']) {
        const entry = types.find((t) => t.type === typeName);
        expect(entry?.hidden, `${typeName} should be hidden`).toBe(true);
      }
    });

    it('covers all commitlint type-enum values', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const commitlintConfig = require(path.join(repoRoot, 'commitlint.config.cjs'));
      const commitlintTypes: string[] = commitlintConfig.rules['type-enum'][2];
      const types = config.types as Array<{ type: string }>;
      const configuredTypes = types.map((t) => t.type);

      for (const commitType of commitlintTypes) {
        expect(configuredTypes, `missing type: ${commitType}`).toContain(commitType);
      }
    });
  });

  describe('devDependencies', () => {
    it('includes standard-version', () => {
      expect(devDeps).toHaveProperty('standard-version');
    });
  });

  describe('release scripts use standard-version', () => {
    it('release:patch uses standard-version', () => {
      expect(pkg!.scripts?.['release:patch']).toContain('standard-version');
      expect(pkg!.scripts?.['release:patch']).toContain('--release-as patch');
    });

    it('release:minor uses standard-version', () => {
      expect(pkg!.scripts?.['release:minor']).toContain('standard-version');
      expect(pkg!.scripts?.['release:minor']).toContain('--release-as minor');
    });

    it('release:major uses standard-version', () => {
      expect(pkg!.scripts?.['release:major']).toContain('standard-version');
      expect(pkg!.scripts?.['release:major']).toContain('--release-as major');
    });

    it('release scripts do not use --follow-tags', () => {
      expect(pkg!.scripts?.['release:patch']).not.toContain('--follow-tags');
      expect(pkg!.scripts?.['release:minor']).not.toContain('--follow-tags');
      expect(pkg!.scripts?.['release:major']).not.toContain('--follow-tags');
    });

    it('has a changelog preview script', () => {
      expect(pkg!.scripts?.['changelog']).toBeDefined();
      expect(pkg!.scripts?.['changelog']).toContain('standard-version');
    });
  });

  describe('commands/release.js', () => {
    it('exists at the repository root', () => {
      expect(fs.existsSync(path.join(repoRoot, 'commands/release.js'))).toBe(true);
    });
  });
});
