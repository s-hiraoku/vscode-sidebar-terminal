#!/usr/bin/env node

/**
 * VS Code Extension Emergency Rollback Script
 *
 * Usage:
 *   npm run rollback:emergency     # Rollback to previous version
 *   npm run rollback:to 0.1.95     # Rollback to specific version
 *   npm run rollback:list          # List available versions for rollback
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RollbackManager {
  constructor() {
    this.packageJsonPath = path.join(__dirname, '..', 'package.json');
    this.backupDir = path.join(__dirname, '..', '.version-backups');
    this.ensureBackupDir();
  }

  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    return packageJson.version;
  }

  backupCurrentVersion() {
    const currentVersion = this.getCurrentVersion();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-v${currentVersion}-${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupFileName);

    const packageJson = fs.readFileSync(this.packageJsonPath, 'utf8');
    fs.writeFileSync(backupPath, packageJson);

    console.log(`✅ Current version v${currentVersion} backed up to: ${backupFileName}`);
    return backupPath;
  }

  listAvailableVersions() {
    console.log('📋 Available versions for rollback:');

    try {
      // Get git tags for released versions
      const gitTags = execSync('git tag -l "v*" --sort=-version:refname', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(tag => tag.length > 0)
        .slice(0, 10); // Show last 10 versions

      if (gitTags.length === 0) {
        console.log('❌ No tagged versions found in git history');
        return [];
      }

      gitTags.forEach((tag, index) => {
        const version = tag.replace('v', '');
        const isLatest = index === 0 ? ' (latest)' : '';
        console.log(`   ${index + 1}. ${version}${isLatest}`);
      });

      return gitTags.map(tag => tag.replace('v', ''));
    } catch (error) {
      console.log('⚠️  Git tags not available, checking backup files...');

      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('backup-v') && file.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 5);

      if (backupFiles.length === 0) {
        console.log('❌ No backup versions available');
        return [];
      }

      backupFiles.forEach((file, index) => {
        const versionMatch = file.match(/backup-v([\d.]+)-/);
        if (versionMatch) {
          console.log(`   ${index + 1}. ${versionMatch[1]}`);
        }
      });

      return backupFiles.map(file => {
        const match = file.match(/backup-v([\d.]+)-/);
        return match ? match[1] : null;
      }).filter(Boolean);
    }
  }

  async rollbackToVersion(targetVersion) {
    console.log(`🔄 Starting rollback to version ${targetVersion}...`);

    // Backup current state
    this.backupCurrentVersion();

    try {
      // Try git-based rollback first
      await this.gitRollback(targetVersion);
    } catch (gitError) {
      console.log('⚠️  Git rollback failed, trying backup file rollback...');
      await this.backupFileRollback(targetVersion);
    }
  }

  async gitRollback(targetVersion) {
    const tagName = `v${targetVersion}`;

    try {
      // Check if tag exists
      execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });

      // Checkout the specific version
      execSync(`git checkout ${tagName} -- package.json`, { stdio: 'inherit' });

      console.log(`✅ Rolled back package.json to version ${targetVersion}`);

      // Reinstall dependencies for the rolled back version
      console.log('📦 Reinstalling dependencies...');
      execSync('npm install', { stdio: 'inherit' });

      // Rebuild extension
      console.log('🔨 Rebuilding extension...');
      execSync('npm run compile', { stdio: 'inherit' });

      console.log('🎉 Rollback completed successfully!');
      console.log(`📝 Please verify the extension works correctly with version ${targetVersion}`);

    } catch (error) {
      throw new Error(`Git rollback failed: ${error.message}`);
    }
  }

  async backupFileRollback(targetVersion) {
    const backupFiles = fs.readdirSync(this.backupDir)
      .filter(file => file.includes(`backup-v${targetVersion}-`))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      throw new Error(`No backup found for version ${targetVersion}`);
    }

    const backupFile = path.join(this.backupDir, backupFiles[0]);
    const backupContent = fs.readFileSync(backupFile, 'utf8');

    // Restore package.json
    fs.writeFileSync(this.packageJsonPath, backupContent);

    console.log(`✅ Restored package.json from backup: ${backupFiles[0]}`);

    // Reinstall and rebuild
    console.log('📦 Reinstalling dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    console.log('🔨 Rebuilding extension...');
    execSync('npm run compile', { stdio: 'inherit' });

    console.log('🎉 Rollback completed successfully!');
  }

  async emergencyRollback() {
    console.log('🚨 EMERGENCY ROLLBACK - Rolling back to previous version...');

    const availableVersions = this.listAvailableVersions();
    if (availableVersions.length < 2) {
      console.log('❌ No previous version available for emergency rollback');
      return;
    }

    const previousVersion = availableVersions[1]; // Second in list (first is current)
    await this.rollbackToVersion(previousVersion);

    console.log('🆘 Emergency rollback completed!');
    console.log('🔍 Please test the extension and publish the rolled-back version if needed');
  }

  createRollbackPlan() {
    const currentVersion = this.getCurrentVersion();
    const plan = {
      currentVersion,
      rollbackProcedure: [
        '1. 🛑 Stop any active development',
        '2. 🔄 Run rollback script',
        '3. 🧪 Test rolled-back version',
        '4. 📦 Publish emergency fix if needed',
        '5. 📝 Create incident report',
        '6. 🔧 Fix issue in development branch'
      ],
      emergencyContacts: [
        'Extension Marketplace Support',
        'Development Team Lead'
      ],
      rollbackCommand: 'npm run rollback:emergency'
    };

    const planPath = path.join(this.backupDir, 'emergency-rollback-plan.json');
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

    console.log(`📋 Emergency rollback plan created: ${planPath}`);
    return plan;
  }
}

// CLI Interface
async function main() {
  const manager = new RollbackManager();
  const args = process.argv.slice(2);
  const command = args[0];
  const targetVersion = args[1];

  try {
    switch (command) {
      case 'emergency':
        await manager.emergencyRollback();
        break;

      case 'to':
        if (!targetVersion) {
          console.log('❌ Please specify target version: npm run rollback:to 0.1.95');
          process.exit(1);
        }
        await manager.rollbackToVersion(targetVersion);
        break;

      case 'list':
        manager.listAvailableVersions();
        break;

      case 'plan':
        manager.createRollbackPlan();
        break;

      case 'backup':
        manager.backupCurrentVersion();
        break;

      default:
        console.log(`
🔄 VS Code Extension Rollback Manager

Available commands:
  npm run rollback:emergency           # Emergency rollback to previous version
  npm run rollback:to <version>        # Rollback to specific version
  npm run rollback:list               # List available versions
  npm run rollback:plan               # Create emergency rollback plan
  npm run rollback:backup             # Backup current version

Examples:
  npm run rollback:emergency
  npm run rollback:to 0.1.95
  npm run rollback:list
        `);
    }
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RollbackManager;