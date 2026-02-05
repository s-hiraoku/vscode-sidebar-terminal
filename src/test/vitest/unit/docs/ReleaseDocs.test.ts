import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../../..');

const readDoc = (relativePath: string): string =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Release documentation', () => {
  it('documents main as the release branch', () => {
    const content = readDoc('docs/operations/RELEASE_PROCESS.md');

    expect(content).toContain('git checkout main');
    expect(content).not.toContain('for-publish');
  });

  it('uses supported release scripts instead of deprecated slash commands', () => {
    const content = readDoc('docs/operations/releases/RELEASE_COMMANDS.md');

    expect(content).toContain('npm run release:patch');
    expect(content).toContain('npm run release:minor');
    expect(content).toContain('npm run release:major');

    expect(content).not.toMatch(/^\/release\s+/m);
    expect(content).not.toMatch(/^\/quality\b/m);
    expect(content).not.toMatch(/^\/fix\b/m);
    expect(content).not.toMatch(/release:(patch|minor|major):safe/);
    expect(content).not.toMatch(/quality:(check|fix)/);
  });

  it('avoids deprecated safe release scripts in emergency rollback guidance', () => {
    const content = readDoc('docs/operations/EMERGENCY_ROLLBACK.md');

    expect(content).toContain('npm run release:patch');
    expect(content).not.toMatch(/release:patch:safe/);
  });
});
