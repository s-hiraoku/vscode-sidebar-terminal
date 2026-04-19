import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const expectedKeywords = [
  'terminal',
  'sidebar',
  'ai',
  'claude',
  'copilot',
  'xterm',
  'shell',
  'split terminal',
  'session',
  'ime',
];

const allowedConsoleFiles = new Set(['src/utils/logger.ts']);
const productionConsolePattern = /\bconsole\.(log|debug|info)\b/;

const listTypeScriptFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    const relativePath = path.relative(repoRoot, fullPath);

    if (entry.isDirectory()) {
      if (relativePath === 'src/test') {
        return [];
      }
      return listTypeScriptFiles(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });
};

const findProductionConsoleCalls = (): string[] => {
  const srcDir = path.join(repoRoot, 'src');

  return listTypeScriptFiles(srcDir).flatMap((filePath) => {
    const relativePath = path.relative(repoRoot, filePath);
    if (allowedConsoleFiles.has(relativePath)) {
      return [];
    }

    return fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .flatMap((line, index) => {
        const trimmedLine = line.trim();
        const isComment =
          trimmedLine.startsWith('//') ||
          trimmedLine.startsWith('*') ||
          trimmedLine.startsWith('/*');

        if (isComment || trimmedLine.includes('onclick=') || !productionConsolePattern.test(line)) {
          return [];
        }

        return [`${relativePath}:${index + 1}: ${trimmedLine}`];
      });
  });
};

describe('1.0.0 release readiness', () => {
  it('uses stable release package metadata', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
    ) as {
      version: string;
      description: string;
      keywords: string[];
    };

    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.description).toBe(
      'Sidebar terminal for VS Code with AI agent awareness (Claude Code, Copilot, Gemini, Codex), split views, session persistence, and full IME support.'
    );
    expect(packageJson.keywords).toEqual(expectedKeywords);
  });

  it('documents the 1.0.0 stable release at the top of the changelog', () => {
    const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
    const stableReleaseHeading =
      '### [1.0.0](https://github.com/s-hiraoku/vscode-sidebar-terminal/compare/v0.6.3...v1.0.0) (2026-04-20)';
    const previousReleaseHeading = '### [0.6.3]';

    expect(changelog).toContain(stableReleaseHeading);
    expect(changelog.indexOf(stableReleaseHeading)).toBeLessThan(
      changelog.indexOf(previousReleaseHeading)
    );
    expect(changelog).toContain('**First stable release.**');
  });

  it('does not leave debug console output in production TypeScript paths', () => {
    expect(findProductionConsoleCalls()).toEqual([]);
  });
});
