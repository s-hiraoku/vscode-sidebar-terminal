#!/usr/bin/env python3
"""
VS Code Extension Test Environment Setup Script

This script automates the setup of a comprehensive test environment
for VS Code extension projects.

Usage:
    python setup-test-env.py --project-path /path/to/extension
    python setup-test-env.py --project-path . --framework mocha
    python setup-test-env.py --project-path . --ci github
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, List


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Setup test environment for VS Code extension'
    )
    parser.add_argument(
        '--project-path',
        type=str,
        required=True,
        help='Path to the VS Code extension project'
    )
    parser.add_argument(
        '--framework',
        type=str,
        choices=['mocha', 'jest'],
        default='mocha',
        help='Test framework to use (default: mocha)'
    )
    parser.add_argument(
        '--ci',
        type=str,
        choices=['github', 'gitlab', 'azure', 'none'],
        default='github',
        help='CI/CD platform to configure (default: github)'
    )
    parser.add_argument(
        '--coverage',
        type=str,
        choices=['c8', 'nyc'],
        default='c8',
        help='Coverage tool to use (default: c8)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Print actions without executing them'
    )
    return parser.parse_args()


def get_mocha_dependencies() -> List[str]:
    """Return Mocha stack dependencies."""
    return [
        '@vscode/test-cli',
        '@vscode/test-electron',
        'mocha',
        'chai',
        'sinon',
        'sinon-chai',
        'chai-as-promised',
        '@types/mocha',
        '@types/chai',
        '@types/sinon'
    ]


def get_jest_dependencies() -> List[str]:
    """Return Jest stack dependencies."""
    return [
        'jest',
        'ts-jest',
        '@types/jest',
        '@vscode/test-electron'
    ]


def get_coverage_dependencies(tool: str) -> List[str]:
    """Return coverage tool dependencies."""
    if tool == 'c8':
        return ['c8']
    elif tool == 'nyc':
        return ['nyc', '@istanbuljs/nyc-config-typescript']
    return []


def create_directory_structure(project_path: Path, dry_run: bool) -> None:
    """Create test directory structure."""
    directories = [
        'src/test/unit',
        'src/test/integration',
        'src/test/e2e',
        'src/test/fixtures',
        'src/test/helpers',
        'test-fixtures/.vscode'
    ]

    for dir_path in directories:
        full_path = project_path / dir_path
        if dry_run:
            print(f'Would create directory: {full_path}')
        else:
            full_path.mkdir(parents=True, exist_ok=True)
            print(f'Created directory: {full_path}')


def create_vscode_test_config(project_path: Path, dry_run: bool) -> None:
    """Create .vscode-test.js configuration."""
    config_content = """const { defineConfig } = require('@vscode/test-cli');

module.exports = defineConfig({
  files: 'out/test/**/*.test.js',
  version: 'stable',
  workspaceFolder: './test-fixtures',
  launchArgs: [
    '--disable-extensions',
    '--disable-workspace-trust'
  ],
  mocha: {
    timeout: 20000,
    ui: 'bdd',
    color: true,
    retries: process.env.CI ? 2 : 0
  }
});
"""
    config_path = project_path / '.vscode-test.js'
    if dry_run:
        print(f'Would create: {config_path}')
    else:
        config_path.write_text(config_content)
        print(f'Created: {config_path}')


def create_mocharc(project_path: Path, dry_run: bool) -> None:
    """Create .mocharc.json configuration."""
    config = {
        "require": ["ts-node/register"],
        "extension": ["ts"],
        "spec": "src/test/unit/**/*.test.ts",
        "timeout": 5000,
        "ui": "bdd",
        "color": True,
        "reporter": "spec",
        "exit": True
    }
    config_path = project_path / '.mocharc.json'
    if dry_run:
        print(f'Would create: {config_path}')
    else:
        config_path.write_text(json.dumps(config, indent=2))
        print(f'Created: {config_path}')


def create_jest_config(project_path: Path, dry_run: bool) -> None:
    """Create jest.config.js configuration."""
    config_content = """/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/test/unit'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/test/**',
    '!**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/test/helpers/vscode-mock.ts'
  }
};
"""
    config_path = project_path / 'jest.config.js'
    if dry_run:
        print(f'Would create: {config_path}')
    else:
        config_path.write_text(config_content)
        print(f'Created: {config_path}')


def create_coverage_config(project_path: Path, tool: str, dry_run: bool) -> None:
    """Create coverage tool configuration."""
    if tool == 'c8':
        # c8 config goes in package.json, handled separately
        pass
    elif tool == 'nyc':
        config = {
            "extends": "@istanbuljs/nyc-config-typescript",
            "include": ["src/**/*.ts"],
            "exclude": ["src/test/**", "**/*.d.ts"],
            "reporter": ["text", "html", "lcov"],
            "all": True,
            "check-coverage": True,
            "branches": 80,
            "functions": 80,
            "lines": 80,
            "statements": 80
        }
        config_path = project_path / '.nycrc.json'
        if dry_run:
            print(f'Would create: {config_path}')
        else:
            config_path.write_text(json.dumps(config, indent=2))
            print(f'Created: {config_path}')


def create_test_setup_file(project_path: Path, framework: str, dry_run: bool) -> None:
    """Create test setup file."""
    if framework == 'mocha':
        content = """import * as chai from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

// Configure chai plugins
chai.use(sinonChai);
chai.use(chaiAsPromised);

export { expect } from 'chai';
export { default as sinon } from 'sinon';
"""
    else:  # jest
        content = """// Jest setup file
// Add any global test configuration here

// Extend Jest matchers if needed
// expect.extend({...});
"""

    setup_path = project_path / 'src/test/unit/setup.ts'
    if dry_run:
        print(f'Would create: {setup_path}')
    else:
        setup_path.write_text(content)
        print(f'Created: {setup_path}')


def create_vscode_mock(project_path: Path, dry_run: bool) -> None:
    """Create VS Code API mock file."""
    content = """/**
 * VS Code API Mock for unit tests
 * This module provides mock implementations of VS Code APIs
 * for testing code that depends on the VS Code extension API.
 */

import * as sinon from 'sinon';

// Event Emitter Mock
export class EventEmitter<T> {
  private listeners: ((e: T) => any)[] = [];

  event = (listener: (e: T) => any) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners = this.listeners.filter(l => l !== listener) };
  };

  fire(data: T) {
    this.listeners.forEach(l => l(data));
  }

  dispose() {
    this.listeners = [];
  }
}

// Uri Mock
export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
  parse: (value: string) => ({ fsPath: value, scheme: 'file', path: value }),
  joinPath: (base: any, ...pathSegments: string[]) => {
    const path = [base.path, ...pathSegments].join('/');
    return { fsPath: path, scheme: base.scheme, path };
  }
};

// Window Mock
export const window = {
  showInformationMessage: sinon.stub().resolves(undefined),
  showWarningMessage: sinon.stub().resolves(undefined),
  showErrorMessage: sinon.stub().resolves(undefined),
  showQuickPick: sinon.stub().resolves(undefined),
  showInputBox: sinon.stub().resolves(undefined),
  createTerminal: sinon.stub(),
  createWebviewPanel: sinon.stub(),
  createOutputChannel: sinon.stub().returns({
    appendLine: sinon.stub(),
    append: sinon.stub(),
    clear: sinon.stub(),
    show: sinon.stub(),
    hide: sinon.stub(),
    dispose: sinon.stub()
  }),
  createStatusBarItem: sinon.stub().returns({
    text: '',
    tooltip: '',
    command: undefined,
    show: sinon.stub(),
    hide: sinon.stub(),
    dispose: sinon.stub()
  }),
  activeTextEditor: undefined,
  visibleTextEditors: [],
  onDidChangeActiveTextEditor: new EventEmitter<any>().event,
  onDidChangeVisibleTextEditors: new EventEmitter<any[]>().event,
  onDidCloseTerminal: new EventEmitter<any>().event
};

// Workspace Mock
export const workspace = {
  getConfiguration: sinon.stub().returns({
    get: sinon.stub().returns(undefined),
    has: sinon.stub().returns(false),
    inspect: sinon.stub().returns(undefined),
    update: sinon.stub().resolves()
  }),
  workspaceFolders: [],
  rootPath: '/mock/workspace',
  name: 'Mock Workspace',
  openTextDocument: sinon.stub().resolves({}),
  findFiles: sinon.stub().resolves([]),
  createFileSystemWatcher: sinon.stub().returns({
    onDidChange: new EventEmitter<any>().event,
    onDidCreate: new EventEmitter<any>().event,
    onDidDelete: new EventEmitter<any>().event,
    dispose: sinon.stub()
  }),
  onDidChangeConfiguration: new EventEmitter<any>().event
};

// Commands Mock
export const commands = {
  registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
  executeCommand: sinon.stub().resolves(undefined),
  getCommands: sinon.stub().resolves([])
};

// Extensions Mock
export const extensions = {
  getExtension: sinon.stub().returns(undefined),
  all: []
};

// Enums
export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3
}

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}

// Reset all mocks
export function resetMocks() {
  sinon.reset();
}
"""
    mock_path = project_path / 'src/test/helpers/vscode-mock.ts'
    if dry_run:
        print(f'Would create: {mock_path}')
    else:
        mock_path.write_text(content)
        print(f'Created: {mock_path}')


def create_github_workflow(project_path: Path, dry_run: bool) -> None:
    """Create GitHub Actions workflow."""
    workflow_content = """name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        vscode-version: ['stable']
      fail-fast: false

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Compile
        run: npm run compile

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests (Linux)
        if: runner.os == 'Linux'
        run: xvfb-run -a npm run test:integration
        env:
          VSCODE_TEST_VERSION: ${{ matrix.vscode-version }}

      - name: Run integration tests (Windows/macOS)
        if: runner.os != 'Linux'
        run: npm run test:integration
        env:
          VSCODE_TEST_VERSION: ${{ matrix.vscode-version }}

      - name: Upload coverage
        if: matrix.os == 'ubuntu-latest'
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: false
"""
    workflow_dir = project_path / '.github/workflows'
    if dry_run:
        print(f'Would create directory: {workflow_dir}')
        print(f'Would create: {workflow_dir}/test.yml')
    else:
        workflow_dir.mkdir(parents=True, exist_ok=True)
        (workflow_dir / 'test.yml').write_text(workflow_content)
        print(f'Created: {workflow_dir}/test.yml')


def create_sample_test(project_path: Path, framework: str, dry_run: bool) -> None:
    """Create sample test file."""
    if framework == 'mocha':
        content = """import { expect, sinon } from './setup';

describe('Sample Test Suite', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Basic Tests', () => {
    it('should pass a simple assertion', () => {
      expect(true).to.be.true;
    });

    it('should handle async operations', async () => {
      const result = await Promise.resolve('success');
      expect(result).to.equal('success');
    });

    it('should work with stubs', () => {
      const stub = sandbox.stub().returns('stubbed');
      expect(stub()).to.equal('stubbed');
      expect(stub).to.have.been.calledOnce;
    });
  });

  describe('TDD Example', () => {
    it('RED: should implement feature X', () => {
      // Write the test first (this will fail initially)
      // const feature = new FeatureX();
      // expect(feature.doSomething()).to.equal('expected result');

      // TODO: Implement FeatureX to make this test pass
      expect(true).to.be.true; // Placeholder
    });
  });
});
"""
    else:  # jest
        content = """describe('Sample Test Suite', () => {
  describe('Basic Tests', () => {
    it('should pass a simple assertion', () => {
      expect(true).toBe(true);
    });

    it('should handle async operations', async () => {
      const result = await Promise.resolve('success');
      expect(result).toBe('success');
    });

    it('should work with mocks', () => {
      const mock = jest.fn().mockReturnValue('mocked');
      expect(mock()).toBe('mocked');
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });

  describe('TDD Example', () => {
    it('RED: should implement feature X', () => {
      // Write the test first (this will fail initially)
      // const feature = new FeatureX();
      // expect(feature.doSomething()).toBe('expected result');

      // TODO: Implement FeatureX to make this test pass
      expect(true).toBe(true); // Placeholder
    });
  });
});
"""

    test_path = project_path / 'src/test/unit/sample.test.ts'
    if dry_run:
        print(f'Would create: {test_path}')
    else:
        test_path.write_text(content)
        print(f'Created: {test_path}')


def update_package_json(project_path: Path, framework: str, coverage: str, dry_run: bool) -> None:
    """Update package.json with test scripts."""
    package_json_path = project_path / 'package.json'

    if not package_json_path.exists():
        print(f'Warning: package.json not found at {package_json_path}')
        return

    with open(package_json_path, 'r') as f:
        package_json = json.load(f)

    # Add test scripts
    if 'scripts' not in package_json:
        package_json['scripts'] = {}

    scripts = package_json['scripts']
    scripts['pretest'] = 'npm run compile'

    if framework == 'mocha':
        scripts['test'] = 'vscode-test'
        scripts['test:unit'] = 'mocha out/test/unit/**/*.test.js --timeout 5000'
        scripts['test:integration'] = 'vscode-test'
        scripts['test:watch'] = 'mocha out/test/unit/**/*.test.js --watch --timeout 5000'
    else:  # jest
        scripts['test'] = 'jest'
        scripts['test:unit'] = 'jest --testPathPattern=unit'
        scripts['test:watch'] = 'jest --watch'

    # Coverage scripts
    if coverage == 'c8':
        scripts['test:coverage'] = 'c8 npm run test:unit'
        # Add c8 config
        package_json['c8'] = {
            "include": ["src/**/*.ts"],
            "exclude": ["src/test/**", "**/*.d.ts"],
            "reporter": ["text", "html", "lcov"],
            "all": True,
            "check-coverage": True,
            "branches": 80,
            "functions": 80,
            "lines": 80,
            "statements": 80
        }
    else:  # nyc
        scripts['test:coverage'] = 'nyc npm run test:unit'

    # TDD scripts
    scripts['tdd:red'] = 'npm run test:unit -- --grep "RED:"'
    scripts['tdd:green'] = 'npm run test:unit'
    scripts['tdd:refactor'] = 'npm run lint && npm run test:unit'
    scripts['tdd:quality-gate'] = 'npm run test:coverage && npm run lint'

    if dry_run:
        print(f'Would update: {package_json_path}')
        print(f'Scripts to add: {json.dumps(scripts, indent=2)}')
    else:
        with open(package_json_path, 'w') as f:
            json.dump(package_json, f, indent=2)
        print(f'Updated: {package_json_path}')


def install_dependencies(project_path: Path, framework: str, coverage: str, dry_run: bool) -> None:
    """Install npm dependencies."""
    deps = []

    if framework == 'mocha':
        deps.extend(get_mocha_dependencies())
    else:
        deps.extend(get_jest_dependencies())

    deps.extend(get_coverage_dependencies(coverage))

    if dry_run:
        print(f'Would install: {" ".join(deps)}')
    else:
        print(f'Installing dependencies: {" ".join(deps)}')
        subprocess.run(
            ['npm', 'install', '--save-dev'] + deps,
            cwd=project_path,
            check=True
        )


def main():
    """Main entry point."""
    args = parse_args()
    project_path = Path(args.project_path).resolve()

    if not project_path.exists():
        print(f'Error: Project path does not exist: {project_path}')
        sys.exit(1)

    print(f'Setting up test environment for: {project_path}')
    print(f'Framework: {args.framework}')
    print(f'Coverage: {args.coverage}')
    print(f'CI: {args.ci}')
    print()

    # Create directory structure
    create_directory_structure(project_path, args.dry_run)

    # Create configuration files
    if args.framework == 'mocha':
        create_vscode_test_config(project_path, args.dry_run)
        create_mocharc(project_path, args.dry_run)
    else:
        create_jest_config(project_path, args.dry_run)

    create_coverage_config(project_path, args.coverage, args.dry_run)

    # Create test files
    create_test_setup_file(project_path, args.framework, args.dry_run)
    create_vscode_mock(project_path, args.dry_run)
    create_sample_test(project_path, args.framework, args.dry_run)

    # Create CI configuration
    if args.ci == 'github':
        create_github_workflow(project_path, args.dry_run)

    # Update package.json
    update_package_json(project_path, args.framework, args.coverage, args.dry_run)

    # Install dependencies
    if not args.dry_run:
        install_dependencies(project_path, args.framework, args.coverage, args.dry_run)

    print()
    print('Test environment setup complete!')
    print()
    print('Next steps:')
    print('1. Run `npm run compile` to compile TypeScript')
    print('2. Run `npm run test:unit` to execute unit tests')
    print('3. Run `npm run test:coverage` to check coverage')
    print('4. Start TDD with `npm run tdd:red`')


if __name__ == '__main__':
    main()
