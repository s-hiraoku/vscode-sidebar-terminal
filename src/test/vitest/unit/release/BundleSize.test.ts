import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const distDir = path.join(repoRoot, 'dist');
const oneMiB = 1024 * 1024;

const getDistPath = (fileName: string): string => path.join(distDir, fileName);
const hasBuiltBundle = fs.existsSync(getDistPath('webview.js'));
const describeIfBuilt = hasBuiltBundle ? describe : describe.skip;

describeIfBuilt('webview release bundle artifacts', () => {
  it('keeps the main webview entry bundle at or below 1 MiB', () => {
    const webviewBundle = getDistPath('webview.js');

    expect(fs.existsSync(webviewBundle)).toBe(true);
    expect(fs.statSync(webviewBundle).size).toBeLessThanOrEqual(oneMiB);
  });

  it('does not ship the obsolete webview-simple build artifact', () => {
    expect(fs.existsSync(getDistPath('webview-simple.js'))).toBe(false);
    expect(fs.existsSync(getDistPath('webview-simple.js.map'))).toBe(false);
  });

  it('ships all split chunks injected by WebViewHtmlGenerationService', () => {
    for (const chunk of [
      'vendors.js',
      'xterm-vendor.js',
      'webview-services.js',
      'webview-managers.js',
    ]) {
      expect(fs.existsSync(getDistPath(chunk))).toBe(true);
    }
  });
});
