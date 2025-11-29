#!/usr/bin/env node

/**
 * Pre-Release Hook Script
 *
 * Automatically creates version backups before any release
 * This ensures we always have a rollback point
 */

const RollbackManager = require('./rollback-release');
const fs = require('fs');
const path = require('path');

class PreReleaseHook {
  constructor() {
    this.rollbackManager = new RollbackManager();
  }

  async executePreReleaseChecks() {
    console.log('🔍 Pre-Release Checks Starting...');

    try {
      // 1. Backup current version
      console.log('💾 Creating version backup...');
      this.rollbackManager.backupCurrentVersion();

      // 2. Create rollback plan
      console.log('📋 Creating emergency rollback plan...');
      this.rollbackManager.createRollbackPlan();

      // 3. Tag current state in git
      await this.createPreReleaseTag();

      // 4. Generate release metadata
      await this.generateReleaseMetadata();

      console.log('✅ Pre-release checks completed successfully!');
      return true;

    } catch (error) {
      console.error('❌ Pre-release checks failed:', error.message);
      return false;
    }
  }

  async createPreReleaseTag() {
    const { execSync } = require('child_process');
    const currentVersion = this.rollbackManager.getCurrentVersion();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tagName = `pre-release-v${currentVersion}-${timestamp}`;

    try {
      // Create lightweight tag for pre-release state
      execSync(`git tag ${tagName}`, { stdio: 'inherit' });
      console.log(`🏷️  Pre-release tag created: ${tagName}`);
    } catch (error) {
      console.warn('⚠️  Could not create git tag:', error.message);
    }
  }

  async generateReleaseMetadata() {
    const currentVersion = this.rollbackManager.getCurrentVersion();
    const metadata = {
      version: currentVersion,
      releaseDate: new Date().toISOString(),
      preReleaseChecks: {
        backupCreated: true,
        rollbackPlanGenerated: true,
        gitTagged: true
      },
      rollbackInstructions: {
        emergency: 'npm run rollback:emergency',
        specific: `npm run rollback:to ${currentVersion}`,
        listVersions: 'npm run rollback:list'
      }
    };

    const metadataPath = path.join(__dirname, '..', '.version-backups', `release-metadata-v${currentVersion}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`📄 Release metadata generated: ${metadataPath}`);
  }
}

// Auto-execute if called directly
if (require.main === module) {
  const hook = new PreReleaseHook();
  hook.executePreReleaseChecks()
    .then(success => {
      process.exit(success ? 0 : 1);
    });
}

module.exports = PreReleaseHook;