/**
 * 自動コード品質チェックシステム
 * コードベース全体の品質を継続的に監視・改善
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// =============================================================================
// 品質メトリクス定義
// =============================================================================

export interface QualityMetrics {
  typeScore: number;           // 型安全性スコア (0-100)
  complexityScore: number;      // 複雑度スコア (0-100)
  maintainabilityScore: number; // 保守性スコア (0-100)
  testCoverage: number;        // テストカバレッジ (0-100)
  documentationScore: number;   // ドキュメンテーションスコア (0-100)
  namingScore: number;         // 命名規則スコア (0-100)
  overallScore: number;        // 総合スコア (0-100)
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  category: QualityCategory;
  file: string;
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
}

export enum QualityCategory {
  TYPE_SAFETY = 'type_safety',
  NAMING = 'naming',
  COMPLEXITY = 'complexity',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  MAINTAINABILITY = 'maintainability'
}

export interface QualityReport {
  timestamp: number;
  metrics: QualityMetrics;
  issues: QualityIssue[];
  suggestions: QualitySuggestion[];
  fileReports: Map<string, FileQualityReport>;
}

export interface FileQualityReport {
  path: string;
  metrics: Partial<QualityMetrics>;
  issues: QualityIssue[];
  complexity: number;
  linesOfCode: number;
  functions: FunctionMetrics[];
}

export interface FunctionMetrics {
  name: string;
  complexity: number;
  parameters: number;
  linesOfCode: number;
  hasTypeAnnotations: boolean;
  hasDocumentation: boolean;
}

export interface QualitySuggestion {
  category: QualityCategory;
  priority: 'high' | 'medium' | 'low';
  message: string;
  actions: SuggestedAction[];
}

export interface SuggestedAction {
  type: 'refactor' | 'document' | 'test' | 'rename' | 'simplify';
  target: string;
  description: string;
}

// =============================================================================
// 品質チェッカー基底クラス
// =============================================================================

export abstract class QualityChecker {
  protected issues: QualityIssue[] = [];

  abstract check(filePath: string, content: string): Promise<QualityIssue[]>;

  protected addIssue(issue: QualityIssue): void {
    this.issues.push(issue);
  }

  protected clearIssues(): void {
    this.issues = [];
  }

  public getIssues(): QualityIssue[] {
    return [...this.issues];
  }
}

// =============================================================================
// 型安全性チェッカー
// =============================================================================

export class TypeSafetyChecker extends QualityChecker {
  private readonly dangerousPatterns = [
    { pattern: /\bany\b/g, message: 'Avoid using "any" type' },
    { pattern: /as\s+any/g, message: 'Avoid type assertion to "any"' },
    { pattern: /\/\/\s*@ts-ignore/g, message: 'Avoid using @ts-ignore' },
    { pattern: /\/\/\s*@ts-nocheck/g, message: 'Avoid using @ts-nocheck' }
  ];

  async check(filePath: string, content: string): Promise<QualityIssue[]> {
    this.clearIssues();

    // TypeScript ファイルのみチェック
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return [];
    }

    const lines = content.split('\n');

    lines.forEach((line, index) => {
      this.dangerousPatterns.forEach(({ pattern, message }) => {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          this.addIssue({
            severity: 'warning',
            category: QualityCategory.TYPE_SAFETY,
            file: filePath,
            line: index + 1,
            column: match.index || 0,
            message,
            suggestion: 'Use specific types instead of "any"'
          });
        }
      });
    });

    return this.getIssues();
  }

  public calculateTypeScore(issues: QualityIssue[]): number {
    const typeIssues = issues.filter(i => i.category === QualityCategory.TYPE_SAFETY);
    const maxScore = 100;
    const penaltyPerIssue = 5;
    const score = Math.max(0, maxScore - (typeIssues.length * penaltyPerIssue));
    return score;
  }
}

// =============================================================================
// 命名規則チェッカー
// =============================================================================

export class NamingConventionChecker extends QualityChecker {
  private readonly conventions = {
    // クラス名: PascalCase
    class: /^[A-Z][a-zA-Z0-9]*$/,
    // インターフェース名: I + PascalCase
    interface: /^I[A-Z][a-zA-Z0-9]*$/,
    // 関数名: camelCase
    function: /^[a-z][a-zA-Z0-9]*$/,
    // 定数: UPPER_SNAKE_CASE
    constant: /^[A-Z][A-Z0-9_]*$/,
    // 変数: camelCase
    variable: /^[a-z][a-zA-Z0-9]*$/,
    // ファイル名: PascalCase または camelCase
    fileName: /^[A-Za-z][a-zA-Z0-9]*\.(ts|tsx|js|jsx)$/
  };

  async check(filePath: string, content: string): Promise<QualityIssue[]> {
    this.clearIssues();

    // ファイル名チェック
    const fileName = path.basename(filePath);
    if (!this.conventions.fileName.test(fileName)) {
      this.addIssue({
        severity: 'info',
        category: QualityCategory.NAMING,
        file: filePath,
        message: `File name "${fileName}" doesn't follow naming conventions`,
        suggestion: 'Use PascalCase or camelCase for file names'
      });
    }

    // TypeScript AST解析（簡易版）
    this.checkClassNames(filePath, content);
    this.checkInterfaceNames(filePath, content);
    this.checkFunctionNames(filePath, content);
    this.checkConstantNames(filePath, content);

    return this.getIssues();
  }

  private checkClassNames(filePath: string, content: string): void {
    const classPattern = /class\s+([A-Za-z_]\w*)/g;
    const matches = content.matchAll(classPattern);

    for (const match of matches) {
      const className = match[1];
      if (className && !this.conventions.class.test(className)) {
        const line = content.substring(0, match.index || 0).split('\n').length;
        this.addIssue({
          severity: 'warning',
          category: QualityCategory.NAMING,
          file: filePath,
          line,
          message: `Class name "${className}" should use PascalCase`,
          suggestion: `Rename to "${this.toPascalCase(className)}"`
        });
      }
    }
  }

  private checkInterfaceNames(filePath: string, content: string): void {
    const interfacePattern = /interface\s+([A-Za-z_]\w*)/g;
    const matches = content.matchAll(interfacePattern);

    for (const match of matches) {
      const interfaceName = match[1];
      if (interfaceName && !this.conventions.interface.test(interfaceName)) {
        const line = content.substring(0, match.index || 0).split('\n').length;
        this.addIssue({
          severity: 'info',
          category: QualityCategory.NAMING,
          file: filePath,
          line,
          message: `Interface name "${interfaceName}" should start with 'I' and use PascalCase`,
          suggestion: `Rename to "I${this.toPascalCase(interfaceName)}"`
        });
      }
    }
  }

  private checkFunctionNames(filePath: string, content: string): void {
    const functionPattern = /function\s+([A-Za-z_]\w*)|(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(/g;
    const matches = content.matchAll(functionPattern);

    for (const match of matches) {
      const functionName = match[1] || match[2];
      if (functionName && !this.conventions.function.test(functionName)) {
        const line = content.substring(0, match.index || 0).split('\n').length;
        this.addIssue({
          severity: 'info',
          category: QualityCategory.NAMING,
          file: filePath,
          line,
          message: `Function name "${functionName}" should use camelCase`,
          suggestion: `Rename to "${this.toCamelCase(functionName)}"`
        });
      }
    }
  }

  private checkConstantNames(filePath: string, content: string): void {
    const constPattern = /const\s+([A-Z_][A-Z0-9_]*)\s*=/g;
    const matches = content.matchAll(constPattern);

    for (const match of matches) {
      const constName = match[1];
      if (constName && !this.conventions.constant.test(constName)) {
        const line = content.substring(0, match.index || 0).split('\n').length;
        this.addIssue({
          severity: 'info',
          category: QualityCategory.NAMING,
          file: filePath,
          line,
          message: `Constant "${constName}" should use UPPER_SNAKE_CASE`,
          suggestion: `Rename to "${this.toUpperSnakeCase(constName)}"`
        });
      }
    }
  }

  private toPascalCase(str: string): string {
    return str.replace(/(?:^|_)([a-z])/g, (_, char) => char.toUpperCase());
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toUpperSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}

// =============================================================================
// 複雑度チェッカー
// =============================================================================

export class ComplexityChecker extends QualityChecker {
  private readonly MAX_CYCLOMATIC_COMPLEXITY = 10;
  private readonly MAX_FUNCTION_LENGTH = 50;
  private readonly MAX_FILE_LENGTH = 500;
  private readonly MAX_PARAMETERS = 5;

  async check(filePath: string, content: string): Promise<QualityIssue[]> {
    this.clearIssues();

    const lines = content.split('\n');

    // ファイル長チェック
    if (lines.length > this.MAX_FILE_LENGTH) {
      this.addIssue({
        severity: 'warning',
        category: QualityCategory.COMPLEXITY,
        file: filePath,
        message: `File has ${lines.length} lines (max: ${this.MAX_FILE_LENGTH})`,
        suggestion: 'Consider splitting this file into smaller modules'
      });
    }

    // 関数の複雑度チェック
    this.checkFunctionComplexity(filePath, content);

    return this.getIssues();
  }

  private checkFunctionComplexity(filePath: string, content: string): void {
    const functionPattern = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\))/g;
    const matches = content.matchAll(functionPattern);

    for (const match of matches) {
      const functionName = match[1] || match[2];
      const parameters = match[3] ? match[3].split(',').length : 0;
      const functionStart = match.index || 0;

      // パラメータ数チェック
      if (parameters > this.MAX_PARAMETERS) {
        const line = content.substring(0, functionStart).split('\n').length;
        this.addIssue({
          severity: 'warning',
          category: QualityCategory.COMPLEXITY,
          file: filePath,
          line,
          message: `Function "${functionName}" has ${parameters} parameters (max: ${this.MAX_PARAMETERS})`,
          suggestion: 'Consider using an options object or splitting the function'
        });
      }

      // 関数長と複雑度の簡易チェック
      const functionBody = this.extractFunctionBody(content, functionStart);
      const functionLines = functionBody.split('\n').length;

      if (functionLines > this.MAX_FUNCTION_LENGTH) {
        const line = content.substring(0, functionStart).split('\n').length;
        this.addIssue({
          severity: 'warning',
          category: QualityCategory.COMPLEXITY,
          file: filePath,
          line,
          message: `Function "${functionName}" has ${functionLines} lines (max: ${this.MAX_FUNCTION_LENGTH})`,
          suggestion: 'Consider breaking down this function into smaller functions'
        });
      }

      // 循環的複雑度の簡易計算
      const complexity = this.calculateCyclomaticComplexity(functionBody);
      if (complexity > this.MAX_CYCLOMATIC_COMPLEXITY) {
        const line = content.substring(0, functionStart).split('\n').length;
        this.addIssue({
          severity: 'error',
          category: QualityCategory.COMPLEXITY,
          file: filePath,
          line,
          message: `Function "${functionName}" has cyclomatic complexity of ${complexity} (max: ${this.MAX_CYCLOMATIC_COMPLEXITY})`,
          suggestion: 'Refactor to reduce complexity'
        });
      }
    }
  }

  private extractFunctionBody(content: string, start: number): string {
    let braceCount = 0;
    let inFunction = false;
    let end = start;

    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inFunction = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0 && inFunction) {
          end = i;
          break;
        }
      }
    }

    return content.substring(start, end + 1);
  }

  private calculateCyclomaticComplexity(code: string): number {
    let complexity = 1;
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\&\&/g,
      /\|\|/g,
      /\?/g
    ];

    complexityPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }
}

// =============================================================================
// ドキュメンテーションチェッカー
// =============================================================================

export class DocumentationChecker extends QualityChecker {
  async check(filePath: string, content: string): Promise<QualityIssue[]> {
    this.clearIssues();

    // クラス、関数、インターフェースのドキュメントチェック
    this.checkClassDocumentation(filePath, content);
    this.checkFunctionDocumentation(filePath, content);
    this.checkInterfaceDocumentation(filePath, content);

    return this.getIssues();
  }

  private checkClassDocumentation(filePath: string, content: string): void {
    const classPattern = /(?:\/\*\*[\s\S]*?\*\/)?\s*(?:export\s+)?class\s+(\w+)/g;
    const matches = content.matchAll(classPattern);

    for (const match of matches) {
      if (!match[0].includes('/**')) {
        const className = match[1];
        const line = content.substring(0, match.index || 0).split('\n').length;
        this.addIssue({
          severity: 'info',
          category: QualityCategory.DOCUMENTATION,
          file: filePath,
          line,
          message: `Class "${className}" lacks JSDoc documentation`,
          suggestion: 'Add JSDoc comment describing the class purpose'
        });
      }
    }
  }

  private checkFunctionDocumentation(filePath: string, content: string): void {
    const functionPattern = /(?:\/\*\*[\s\S]*?\*\/)?\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:\/\*\*[\s\S]*?\*\/)?\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
    const matches = content.matchAll(functionPattern);

    for (const match of matches) {
      if (!match[0].includes('/**')) {
        const functionName = match[1] || match[2];
        const line = content.substring(0, match.index || 0).split('\n').length;

        // プライベート関数はスキップ
        if (functionName?.startsWith('_')) continue;

        this.addIssue({
          severity: 'info',
          category: QualityCategory.DOCUMENTATION,
          file: filePath,
          line,
          message: `Function "${functionName}" lacks JSDoc documentation`,
          suggestion: 'Add JSDoc comment with @param and @returns tags'
        });
      }
    }
  }

  private checkInterfaceDocumentation(filePath: string, content: string): void {
    const interfacePattern = /(?:\/\*\*[\s\S]*?\*\/)?\s*(?:export\s+)?interface\s+(\w+)/g;
    const matches = content.matchAll(interfacePattern);

    for (const match of matches) {
      if (!match[0].includes('/**')) {
        const interfaceName = match[1];
        const line = content.substring(0, match.index || 0).split('\n').length;
        this.addIssue({
          severity: 'info',
          category: QualityCategory.DOCUMENTATION,
          file: filePath,
          line,
          message: `Interface "${interfaceName}" lacks JSDoc documentation`,
          suggestion: 'Add JSDoc comment describing the interface purpose'
        });
      }
    }
  }
}

// =============================================================================
// 統合品質チェックマネージャー
// =============================================================================

export class CodeQualityManager {
  private static instance: CodeQualityManager;
  private checkers: QualityChecker[] = [];
  private lastReport?: QualityReport;

  private constructor() {
    this.initializeCheckers();
  }

  public static getInstance(): CodeQualityManager {
    if (!CodeQualityManager.instance) {
      CodeQualityManager.instance = new CodeQualityManager();
    }
    return CodeQualityManager.instance;
  }

  private initializeCheckers(): void {
    this.checkers = [
      new TypeSafetyChecker(),
      new NamingConventionChecker(),
      new ComplexityChecker(),
      new DocumentationChecker()
    ];
  }

  /**
   * 単一ファイルの品質チェック
   */
  public async checkFile(filePath: string): Promise<FileQualityReport> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const issues: QualityIssue[] = [];

    for (const checker of this.checkers) {
      const checkerIssues = await checker.check(filePath, content);
      issues.push(...checkerIssues);
    }

    const metrics = this.calculateFileMetrics(content, issues);

    return {
      path: filePath,
      metrics,
      issues,
      complexity: metrics.complexityScore || 0,
      linesOfCode: content.split('\n').length,
      functions: []
    };
  }

  /**
   * ディレクトリ全体の品質チェック
   */
  public async checkDirectory(dirPath: string, pattern = '**/*.ts'): Promise<QualityReport> {
    const files = this.getFiles(dirPath, pattern);
    const fileReports = new Map<string, FileQualityReport>();
    const allIssues: QualityIssue[] = [];

    for (const file of files) {
      const report = await this.checkFile(file);
      fileReports.set(file, report);
      allIssues.push(...report.issues);
    }

    const metrics = this.calculateOverallMetrics(fileReports, allIssues);
    const suggestions = this.generateSuggestions(metrics, allIssues);

    const report: QualityReport = {
      timestamp: Date.now(),
      metrics,
      issues: allIssues,
      suggestions,
      fileReports
    };

    this.lastReport = report;
    return report;
  }

  /**
   * テストカバレッジ取得
   */
  private async getTestCoverage(): Promise<number> {
    try {
      const coverageData = execSync('npm run test:coverage --silent', {
        encoding: 'utf-8'
      });
      const match = coverageData.match(/All files\s+\|\s+([\d.]+)/);
      return match && match[1] ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * ファイルメトリクス計算
   */
  private calculateFileMetrics(content: string, issues: QualityIssue[]): Partial<QualityMetrics> {
    const typeScore = this.calculateTypeScore(issues);
    const complexityScore = this.calculateComplexityScore(issues);
    const documentationScore = this.calculateDocumentationScore(issues);
    const namingScore = this.calculateNamingScore(issues);

    return {
      typeScore,
      complexityScore,
      documentationScore,
      namingScore
    };
  }

  /**
   * 総合メトリクス計算
   */
  private calculateOverallMetrics(
    fileReports: Map<string, FileQualityReport>,
    issues: QualityIssue[]
  ): QualityMetrics {
    const typeScore = this.calculateTypeScore(issues);
    const complexityScore = this.calculateComplexityScore(issues);
    const documentationScore = this.calculateDocumentationScore(issues);
    const namingScore = this.calculateNamingScore(issues);
    const testCoverage = 0; // TODO: 実際のカバレッジ取得実装
    const maintainabilityScore = this.calculateMaintainabilityScore(
      typeScore,
      complexityScore,
      documentationScore,
      namingScore
    );

    const overallScore = (
      typeScore * 0.25 +
      complexityScore * 0.20 +
      maintainabilityScore * 0.20 +
      testCoverage * 0.15 +
      documentationScore * 0.10 +
      namingScore * 0.10
    );

    return {
      typeScore,
      complexityScore,
      maintainabilityScore,
      testCoverage,
      documentationScore,
      namingScore,
      overallScore
    };
  }

  private calculateTypeScore(issues: QualityIssue[]): number {
    const typeIssues = issues.filter(i => i.category === QualityCategory.TYPE_SAFETY);
    return Math.max(0, 100 - typeIssues.length * 5);
  }

  private calculateComplexityScore(issues: QualityIssue[]): number {
    const complexityIssues = issues.filter(i => i.category === QualityCategory.COMPLEXITY);
    const errorCount = complexityIssues.filter(i => i.severity === 'error').length;
    const warningCount = complexityIssues.filter(i => i.severity === 'warning').length;
    return Math.max(0, 100 - errorCount * 10 - warningCount * 5);
  }

  private calculateDocumentationScore(issues: QualityIssue[]): number {
    const docIssues = issues.filter(i => i.category === QualityCategory.DOCUMENTATION);
    return Math.max(0, 100 - docIssues.length * 2);
  }

  private calculateNamingScore(issues: QualityIssue[]): number {
    const namingIssues = issues.filter(i => i.category === QualityCategory.NAMING);
    return Math.max(0, 100 - namingIssues.length * 3);
  }

  private calculateMaintainabilityScore(...scores: number[]): number {
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * 改善提案生成
   */
  private generateSuggestions(
    metrics: QualityMetrics,
    issues: QualityIssue[]
  ): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // 型安全性の改善提案
    if (metrics.typeScore < 80) {
      suggestions.push({
        category: QualityCategory.TYPE_SAFETY,
        priority: 'high',
        message: 'Improve type safety by eliminating "any" types',
        actions: [
          {
            type: 'refactor',
            target: 'TypeScript files',
            description: 'Replace all "any" types with specific types'
          }
        ]
      });
    }

    // 複雑度の改善提案
    if (metrics.complexityScore < 70) {
      suggestions.push({
        category: QualityCategory.COMPLEXITY,
        priority: 'high',
        message: 'Reduce code complexity',
        actions: [
          {
            type: 'simplify',
            target: 'Complex functions',
            description: 'Break down functions with high cyclomatic complexity'
          }
        ]
      });
    }

    // ドキュメンテーションの改善提案
    if (metrics.documentationScore < 60) {
      suggestions.push({
        category: QualityCategory.DOCUMENTATION,
        priority: 'medium',
        message: 'Improve code documentation',
        actions: [
          {
            type: 'document',
            target: 'Public APIs',
            description: 'Add JSDoc comments to all public classes and functions'
          }
        ]
      });
    }

    return suggestions;
  }

  /**
   * ファイル検索
   */
  private getFiles(dirPath: string, pattern: string): string[] {
    const files: string[] = [];

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walkDir(fullPath);
        } else if (entry.isFile() && this.matchPattern(entry.name, pattern)) {
          files.push(fullPath);
        }
      }
    };

    walkDir(dirPath);
    return files;
  }

  private matchPattern(fileName: string, pattern: string): boolean {
    // 簡易パターンマッチング
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp(regex).test(fileName);
  }

  /**
   * レポート生成
   */
  public generateHTMLReport(report: QualityReport): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Code Quality Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .metric { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    .metric-value { font-size: 2em; font-weight: bold; }
    .metric-label { color: #666; margin-top: 5px; }
    .score-high { color: #22c55e; }
    .score-medium { color: #f59e0b; }
    .score-low { color: #ef4444; }
    .issues { margin-top: 30px; }
    .issue { padding: 10px; margin: 5px 0; border-left: 3px solid; }
    .issue-error { border-color: #ef4444; background: #fee; }
    .issue-warning { border-color: #f59e0b; background: #fef3c7; }
    .issue-info { border-color: #3b82f6; background: #eff6ff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Code Quality Report</h1>
    <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>

    <div class="metrics">
      ${this.renderMetric('Overall Score', report.metrics.overallScore)}
      ${this.renderMetric('Type Safety', report.metrics.typeScore)}
      ${this.renderMetric('Complexity', report.metrics.complexityScore)}
      ${this.renderMetric('Maintainability', report.metrics.maintainabilityScore)}
      ${this.renderMetric('Test Coverage', report.metrics.testCoverage)}
      ${this.renderMetric('Documentation', report.metrics.documentationScore)}
      ${this.renderMetric('Naming', report.metrics.namingScore)}
    </div>

    <div class="issues">
      <h2>Issues (${report.issues.length})</h2>
      ${report.issues.map(issue => this.renderIssue(issue)).join('')}
    </div>

    <div class="suggestions">
      <h2>Suggestions</h2>
      ${report.suggestions.map(s => `
        <div class="suggestion">
          <h3>${s.message}</h3>
          <ul>
            ${s.actions.map(a => `<li>${a.description}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
    `;
    return html;
  }

  private renderMetric(label: string, value: number): string {
    const scoreClass = value >= 80 ? 'score-high' : value >= 60 ? 'score-medium' : 'score-low';
    return `
      <div class="metric">
        <div class="metric-value ${scoreClass}">${value.toFixed(0)}%</div>
        <div class="metric-label">${label}</div>
      </div>
    `;
  }

  private renderIssue(issue: QualityIssue): string {
    const issueClass = `issue-${issue.severity}`;
    return `
      <div class="issue ${issueClass}">
        <strong>${issue.file}${issue.line ? `:${issue.line}` : ''}</strong><br>
        ${issue.message}
        ${issue.suggestion ? `<br><em>Suggestion: ${issue.suggestion}</em>` : ''}
      </div>
    `;
  }

  /**
   * VS Code 統合
   */
  public async runQualityCheck(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Running code quality check...'
      },
      async () => {
        return await this.checkDirectory(workspaceFolder.uri.fsPath);
      }
    );

    // 結果表示
    const overallScore = report.metrics.overallScore.toFixed(0);
    const issueCount = report.issues.length;

    vscode.window.showInformationMessage(
      `Code Quality: ${overallScore}% | Issues: ${issueCount}`,
      'Show Report',
      'Show Issues'
    ).then(selection => {
      if (selection === 'Show Report') {
        this.showReport(report);
      } else if (selection === 'Show Issues') {
        this.showIssues(report);
      }
    });
  }

  private showReport(report: QualityReport): void {
    const panel = vscode.window.createWebviewPanel(
      'codeQualityReport',
      'Code Quality Report',
      vscode.ViewColumn.One,
      {}
    );

    panel.webview.html = this.generateHTMLReport(report);
  }

  private showIssues(report: QualityReport): void {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('codeQuality');
    const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

    for (const issue of report.issues) {
      const diagnostics = diagnosticsMap.get(issue.file) || [];

      const range = new vscode.Range(
        (issue.line || 1) - 1,
        issue.column || 0,
        (issue.line || 1) - 1,
        (issue.column || 0) + 20
      );

      const diagnostic = new vscode.Diagnostic(
        range,
        issue.message,
        issue.severity === 'error' ? vscode.DiagnosticSeverity.Error :
        issue.severity === 'warning' ? vscode.DiagnosticSeverity.Warning :
        vscode.DiagnosticSeverity.Information
      );

      diagnostics.push(diagnostic);
      diagnosticsMap.set(issue.file, diagnostics);
    }

    diagnosticsMap.forEach((diagnostics, file) => {
      diagnosticCollection.set(vscode.Uri.file(file), diagnostics);
    });
  }
}

// =============================================================================
// エクスポート
// =============================================================================

export const qualityManager = CodeQualityManager.getInstance();

export default {
  qualityManager,
  TypeSafetyChecker,
  NamingConventionChecker,
  ComplexityChecker,
  DocumentationChecker
};