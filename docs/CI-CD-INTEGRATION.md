# CI/CD統合手順書

## 📖 概要

TDD環境をCI/CDパイプラインに統合し、継続的な品質担保を実現するための手順書です。
GitHub Actions、VS Code Marketplace連携、自動品質チェックの設定方法を説明します。

## 🎯 CI/CD統合の目標

1. **自動TDD品質チェック**: プルリクエスト毎のTDD遵守率確認
2. **段階的品質ゲート**: テスト → 品質チェック → デプロイのフロー
3. **メトリクス収集**: TDD指標の継続的な追跡
4. **自動レポート生成**: 品質改善のための可視化

## 🚀 GitHub Actions設定

### 1. 基本的なTDDチェックワークフロー

`.github/workflows/tdd-quality-check.yml`を作成：

```yaml
name: TDD Quality Check

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main ]

jobs:
  tdd-quality-check:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Compile TypeScript
      run: npm run compile-tests
      
    - name: Run ESLint
      run: npm run lint
      
    - name: Run tests with coverage
      run: npm run test:coverage
      
    - name: TDD Quality Check
      run: npm run tdd:check-quality
      
    - name: Generate TDD Report
      run: |
        npm run tdd:generate-report > tdd-report.md
        echo "TDD_REPORT<<EOF" >> $GITHUB_ENV
        cat tdd-report.md >> $GITHUB_ENV
        echo "EOF" >> $GITHUB_ENV
        
    - name: Comment TDD Report on PR
      if: github.event_name == 'pull_request'
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: `## 🧪 TDD Quality Report\n\n${process.env.TDD_REPORT}`
          })
          
    - name: Upload TDD Metrics
      uses: actions/upload-artifact@v4
      with:
        name: tdd-metrics-${{ matrix.node-version }}
        path: |
          tdd-metrics.json
          coverage/
          tdd-report.md
          
    - name: Quality Gate Check
      run: |
        if ! npm run tdd:quality-gate; then
          echo "❌ TDD Quality Gate Failed"
          echo "Please improve TDD compliance before merging"
          exit 1
        fi
        echo "✅ TDD Quality Gate Passed"
```

### 2. リリース前の総合品質チェック

`.github/workflows/pre-release-quality.yml`：

```yaml
name: Pre-Release Quality Check

on:
  push:
    tags:
      - 'v*'

jobs:
  comprehensive-quality-check:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        fetch-depth: 0  # 全履歴を取得（メトリクス分析用）
        
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Full TDD Compliance Check
      run: |
        echo "=== 総合TDD品質チェック ==="
        npm run tdd:comprehensive-check
        
    - name: Generate Release Quality Report
      run: |
        npm run tdd:release-report > release-quality-report.md
        
    - name: Historical TDD Trend Analysis
      run: |
        npm run tdd:trend-analysis > tdd-trend.json
        
    - name: Create Release with Quality Report
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        body_path: release-quality-report.md
        draft: false
        prerelease: false
```

## 🎛️ 品質ゲート設定

### 1. TDD品質ゲートスクリプト

`scripts/tdd-quality-gate.js`を作成：

```javascript
#!/usr/bin/env node

const { TDDMetrics } = require('../src/test/utils/TDDMetrics');
const fs = require('fs');

class TDDQualityGate {
  constructor() {
    this.thresholds = {
      tddCompliance: 0.80,    // 80%以上
      testCoverage: 0.90,     // 90%以上
      eslintScore: 0.95,      // 95%以上
      testCount: 50,          // 最低50個のテスト
      passingRate: 0.93       // 93%以上の成功率
    };
  }

  async checkQualityGate() {
    console.log('🚦 TDD Quality Gate Check Starting...');
    
    const metrics = await this.collectMetrics();
    const results = this.evaluateMetrics(metrics);
    
    this.printResults(results);
    
    const passed = results.every(result => result.passed);
    
    if (passed) {
      console.log('✅ All TDD Quality Gates Passed!');
      process.exit(0);
    } else {
      console.log('❌ TDD Quality Gate Failed!');
      process.exit(1);
    }
  }

  async collectMetrics() {
    const tddMetrics = TDDMetrics.getInstance();
    const currentMetrics = tddMetrics.getCurrentMetrics();
    
    // テストカバレッジ取得
    let coverage = { percentage: 0 };
    try {
      const coverageData = fs.readFileSync('coverage/coverage-summary.json', 'utf8');
      coverage = JSON.parse(coverageData).total.lines;
    } catch (error) {
      console.warn('⚠️ Coverage data not found, using default');
    }
    
    // ESLintスコア計算
    const eslintScore = await this.calculateESLintScore();
    
    return {
      tddCompliance: currentMetrics.tddComplianceRate,
      testCoverage: coverage.pct / 100,
      eslintScore: eslintScore,
      testCount: currentMetrics.totalTests,
      passingRate: currentMetrics.passingRate
    };
  }

  evaluateMetrics(metrics) {
    return [
      {
        name: 'TDD Compliance Rate',
        value: metrics.tddCompliance,
        threshold: this.thresholds.tddCompliance,
        passed: metrics.tddCompliance >= this.thresholds.tddCompliance,
        unit: '%'
      },
      {
        name: 'Test Coverage',
        value: metrics.testCoverage,
        threshold: this.thresholds.testCoverage,
        passed: metrics.testCoverage >= this.thresholds.testCoverage,
        unit: '%'
      },
      {
        name: 'ESLint Score',
        value: metrics.eslintScore,
        threshold: this.thresholds.eslintScore,
        passed: metrics.eslintScore >= this.thresholds.eslintScore,
        unit: '%'
      },
      {
        name: 'Test Count',
        value: metrics.testCount,
        threshold: this.thresholds.testCount,
        passed: metrics.testCount >= this.thresholds.testCount,
        unit: 'tests'
      },
      {
        name: 'Test Passing Rate',
        value: metrics.passingRate,
        threshold: this.thresholds.passingRate,
        passed: metrics.passingRate >= this.thresholds.passingRate,
        unit: '%'
      }
    ];
  }

  printResults(results) {
    console.log('\n📊 TDD Quality Gate Results:');
    console.log('================================');
    
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const value = result.unit === '%' 
        ? `${(result.value * 100).toFixed(1)}%`
        : `${result.value} ${result.unit}`;
      const threshold = result.unit === '%'
        ? `${(result.threshold * 100).toFixed(1)}%`
        : `${result.threshold} ${result.unit}`;
        
      console.log(`${status} ${result.name}: ${value} (Required: ${threshold})`);
    });
    
    console.log('================================\n');
  }

  async calculateESLintScore() {
    try {
      const { execSync } = require('child_process');
      const eslintOutput = execSync('npm run lint', { encoding: 'utf8' });
      
      // ESLintエラーがない場合は100%
      if (eslintOutput.includes('0 problems')) {
        return 1.0;
      }
      
      // エラー数に基づいてスコア計算
      const errorMatch = eslintOutput.match(/(\d+) problems?/);
      if (errorMatch) {
        const errorCount = parseInt(errorMatch[1]);
        const maxAllowedErrors = 10; // 許容エラー数
        return Math.max(0, 1 - (errorCount / maxAllowedErrors));
      }
      
      return 0.5; // 不明な場合は50%
    } catch (error) {
      console.warn('⚠️ ESLint score calculation failed:', error.message);
      return 0.5;
    }
  }
}

// スクリプト直接実行時
if (require.main === module) {
  const gate = new TDDQualityGate();
  gate.checkQualityGate().catch(console.error);
}

module.exports = { TDDQualityGate };
```

### 2. package.jsonスクリプト追加

```json
{
  "scripts": {
    "tdd:quality-gate": "node scripts/tdd-quality-gate.js",
    "tdd:comprehensive-check": "npm run test:coverage && npm run tdd:check-quality && npm run tdd:quality-gate",
    "tdd:generate-report": "node scripts/tdd-quality-checker.js --format=markdown",
    "tdd:release-report": "node scripts/tdd-quality-checker.js --format=release",
    "tdd:trend-analysis": "node scripts/tdd-quality-checker.js --trend"
  }
}
```

## 📊 継続的メトリクス収集

### 1. メトリクス履歴管理

`scripts/metrics-history.js`を作成：

```javascript
const fs = require('fs');
const path = require('path');

class MetricsHistory {
  constructor() {
    this.historyFile = 'metrics-history.json';
  }

  saveCurrentMetrics() {
    const { TDDMetrics } = require('../src/test/utils/TDDMetrics');
    const currentMetrics = TDDMetrics.getInstance().getCurrentMetrics();
    
    const entry = {
      timestamp: new Date().toISOString(),
      commit: process.env.GITHUB_SHA || 'local',
      branch: process.env.GITHUB_REF_NAME || 'local',
      ...currentMetrics
    };

    let history = [];
    try {
      const historyData = fs.readFileSync(this.historyFile, 'utf8');
      history = JSON.parse(historyData);
    } catch (error) {
      // ファイルが存在しない場合は新規作成
    }

    history.push(entry);
    
    // 最新100エントリのみ保持
    if (history.length > 100) {
      history = history.slice(-100);
    }

    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    console.log('📈 Metrics saved to history');
  }

  generateTrendReport() {
    try {
      const historyData = fs.readFileSync(this.historyFile, 'utf8');
      const history = JSON.parse(historyData);
      
      if (history.length < 2) {
        console.log('📊 Insufficient data for trend analysis');
        return;
      }

      const latest = history[history.length - 1];
      const previous = history[history.length - 2];
      
      const trends = {
        tddCompliance: this.calculateTrend(previous.tddComplianceRate, latest.tddComplianceRate),
        testCoverage: this.calculateTrend(previous.testCoverage, latest.testCoverage),
        testCount: this.calculateTrend(previous.totalTests, latest.totalTests),
        qualityScore: this.calculateTrend(previous.qualityScore, latest.qualityScore)
      };

      console.log('📈 TDD Metrics Trends:');
      Object.entries(trends).forEach(([metric, trend]) => {
        const arrow = trend > 0 ? '📈' : trend < 0 ? '📉' : '➡️';
        console.log(`${arrow} ${metric}: ${trend > 0 ? '+' : ''}${trend.toFixed(2)}%`);
      });

      return trends;
    } catch (error) {
      console.error('Error generating trend report:', error);
    }
  }

  calculateTrend(previous, current) {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }
}

module.exports = { MetricsHistory };
```

### 2. VS Code Marketplace統合

`.github/workflows/marketplace-release.yml`：

```yaml
name: VS Code Marketplace Release

on:
  push:
    tags:
      - 'v*'

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    outputs:
      quality-passed: ${{ steps.quality-check.outputs.passed }}
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: TDD Quality Gate
      id: quality-check
      run: |
        if npm run tdd:quality-gate; then
          echo "passed=true" >> $GITHUB_OUTPUT
          echo "✅ Quality gate passed"
        else
          echo "passed=false" >> $GITHUB_OUTPUT
          echo "❌ Quality gate failed"
          exit 1
        fi

  marketplace-publish:
    needs: quality-gate
    if: needs.quality-gate.outputs.quality-passed == 'true'
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20.x'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Install VSCE
      run: npm install -g vsce
      
    - name: Build extension
      run: npm run package
      
    - name: Publish to Marketplace
      env:
        VSCE_PAT: ${{ secrets.VSCE_PAT }}
      run: vsce publish
      
    - name: Save release metrics
      run: |
        node -e "
          const { MetricsHistory } = require('./scripts/metrics-history.js');
          const history = new MetricsHistory();
          history.saveCurrentMetrics();
        "
        
    - name: Create GitHub Release
      uses: actions/create-release@v1
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      with:
        tag_name: ${{ github.ref }}
        release_name: Release ${{ github.ref }}
        body: |
          ## 📊 Release Quality Metrics
          
          ✅ TDD Quality Gate: Passed
          📈 All quality thresholds met
          🚀 Ready for production use
          
          See [Quality Report](link-to-report) for detailed metrics.
```

## 🎨 開発者エクスペリエンス向上

### 1. プルリクエスト前のローカルチェック

`scripts/pre-commit-tdd-check.sh`：

```bash
#!/bin/bash

echo "🧪 Running TDD Quality Check..."

# コンパイルチェック
echo "1️⃣ TypeScript compilation..."
if ! npm run compile-tests; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# ESLint チェック
echo "2️⃣ ESLint check..."
if ! npm run lint; then
    echo "❌ ESLint check failed"
    exit 1
fi

# テスト実行
echo "3️⃣ Running tests..."
if ! npm run test:unit; then
    echo "❌ Tests failed"
    exit 1
fi

# TDD品質チェック
echo "4️⃣ TDD quality check..."
if ! npm run tdd:check-quality; then
    echo "❌ TDD quality check failed"
    exit 1
fi

echo "✅ All TDD quality checks passed!"
echo "🚀 Ready to create pull request"
```

### 2. Git hooksの設定

`.husky/pre-commit`：

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# TDD品質チェック実行
npm run pre-commit-tdd-check
```

### 3. VS Code設定

`.vscode/settings.json`に追加：

```json
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "eslint.validate": ["typescript"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tasks.autoDetect": "on",
  "npm.enableScriptExplorer": true,
  "testing.automaticallyOpenPeekView": "never",
  "testing.defaultGutterClickAction": "run",
  "testing.followRunningTest": false
}
```

## 📈 ダッシュボードとレポート

### 1. TDD品質ダッシュボード

HTML形式のダッシュボード生成スクリプト `scripts/generate-dashboard.js`：

```javascript
const fs = require('fs');
const { TDDMetrics } = require('../src/test/utils/TDDMetrics');

class TDDDashboard {
  generateHTML() {
    const metrics = TDDMetrics.getInstance().getCurrentMetrics();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>TDD Quality Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { 
            display: inline-block; 
            margin: 10px; 
            padding: 20px; 
            border: 1px solid #ddd; 
            border-radius: 8px;
            min-width: 200px;
        }
        .metric.good { border-color: #4CAF50; background-color: #f8fff8; }
        .metric.warning { border-color: #FF9800; background-color: #fff8f0; }
        .metric.bad { border-color: #f44336; background-color: #fff8f8; }
        .value { font-size: 2em; font-weight: bold; }
        .label { font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    <h1>🧪 TDD Quality Dashboard</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="metrics">
        ${this.generateMetricHTML('TDD Compliance', metrics.tddComplianceRate, 0.8, '%')}
        ${this.generateMetricHTML('Test Coverage', metrics.testCoverage, 0.9, '%')}
        ${this.generateMetricHTML('Quality Score', metrics.qualityScore, 7, '/10')}
        ${this.generateMetricHTML('Total Tests', metrics.totalTests, 50, '')}
    </div>
    
    <h2>📊 Recent Trends</h2>
    <div id="trends">
        <!-- TrendチャートをChart.jsで実装可能 -->
    </div>
    
    <h2>🎯 Recommendations</h2>
    <ul>
        ${this.generateRecommendations(metrics).map(rec => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>`;

    fs.writeFileSync('tdd-dashboard.html', html);
    console.log('📊 TDD Dashboard generated: tdd-dashboard.html');
  }

  generateMetricHTML(label, value, threshold, suffix) {
    const percentage = suffix === '%' ? value * 100 : value;
    const thresholdPercentage = suffix === '%' ? threshold * 100 : threshold;
    
    let cssClass = 'good';
    if (value < threshold * 0.8) cssClass = 'bad';
    else if (value < threshold) cssClass = 'warning';
    
    return `
      <div class="metric ${cssClass}">
        <div class="value">${percentage.toFixed(1)}${suffix}</div>
        <div class="label">${label}</div>
        <div class="threshold">Target: ${thresholdPercentage}${suffix}</div>
      </div>`;
  }

  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.tddComplianceRate < 0.8) {
      recommendations.push('TDD遵守率を向上させるため、Red-Green-Refactorサイクルを意識してください');
    }
    
    if (metrics.testCoverage < 0.9) {
      recommendations.push('テストカバレッジを向上させるため、エッジケースのテストを追加してください');
    }
    
    if (metrics.qualityScore < 7) {
      recommendations.push('コード品質を向上させるため、リファクタリングを実施してください');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('素晴らしいTDD実践です！この品質を維持してください');
    }
    
    return recommendations;
  }
}

// スクリプト実行
if (require.main === module) {
  const dashboard = new TDDDashboard();
  dashboard.generateHTML();
}

module.exports = { TDDDashboard };
```

## 🔧 設定カスタマイズ

### 1. プロジェクト固有の品質しきい値

`tdd-config.json`：

```json
{
  "qualityGate": {
    "tddCompliance": {
      "minimum": 0.80,
      "target": 0.90,
      "description": "Red-Green-Refactor cycle compliance rate"
    },
    "testCoverage": {
      "minimum": 0.90,
      "target": 0.95,
      "description": "Code coverage by tests"
    },
    "eslintScore": {
      "minimum": 0.95,
      "target": 1.0,
      "description": "ESLint compliance score"
    },
    "testCount": {
      "minimum": 50,
      "target": 100,
      "description": "Total number of tests"
    }
  },
  "reporting": {
    "frequency": "daily",
    "recipients": ["dev-team@company.com"],
    "slackWebhook": "https://hooks.slack.com/...",
    "dashboardUrl": "https://tdd-dashboard.company.com"
  },
  "automation": {
    "autoFixESLint": true,
    "autoGenerateTests": false,
    "notifyOnQualityDrop": true
  }
}
```

### 2. チーム別設定

```javascript
// scripts/team-config.js
const teamConfigs = {
  frontend: {
    testCoverage: 0.95,
    tddCompliance: 0.85,
    specialChecks: ['accessibility', 'performance']
  },
  backend: {
    testCoverage: 0.90,
    tddCompliance: 0.80,
    specialChecks: ['security', 'database']
  },
  integration: {
    testCoverage: 0.85,
    tddCompliance: 0.75,
    specialChecks: ['e2e', 'api']
  }
};
```

---

## 💡 まとめ

CI/CD統合により実現される効果：

1. **自動品質ゲート**: 品質基準を満たさないコードの自動検出
2. **継続的改善**: メトリクス追跡による品質向上の可視化
3. **開発効率向上**: 手動チェックの自動化
4. **チーム標準化**: 一貫した品質基準の適用

この統合により、TDDを基盤とした高品質な開発サイクルを確立できます。