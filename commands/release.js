#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

const run = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

const args = process.argv.slice(2);
const arg = args[0];

if (arg === '--check-only') {
  console.log('\n--- Quality check ---');
  run('npm run pre-release:check');
  process.exit(0);
}

if (arg === '--fix-only') {
  console.log('\n--- Auto-fix lint & format ---');
  run('npm run lint -- --fix');
  run('npm run format');
  process.exit(0);
}

const validBumps = ['patch', 'minor', 'major'];

if (arg && validBumps.includes(arg)) {
  console.log(`\n--- Release ${arg} ---`);
  run('npm run pre-release:check');
  run(`npx standard-version --release-as ${arg}`);

  const pkg = require('../package.json');
  const version = pkg.version;
  console.log('\n========================================');
  console.log(`  Version bumped. Next steps:`);
  console.log(`  1. Review CHANGELOG.md`);
  console.log(`  2. git push`);
  console.log(`  3. Wait for CI to pass`);
  console.log(`  4. git tag v${version} && git push origin v${version}`);
  console.log('========================================\n');
  process.exit(0);
}

// Default: show help
if (!arg) {
  console.log('\n--- Release quality overview ---');
  run('npm run pre-release:check');
  process.exit(0);
}

console.error(`Unknown argument: ${arg}`);
console.error('Usage: node commands/release.js [patch|minor|major|--check-only|--fix-only]');
process.exit(1);
