# Security Policy

## Overview

The VS Code Sidebar Terminal extension takes security seriously. This document outlines our security practices, vulnerability reporting procedures, and credential handling policies.

## Security Audit Status

**Last Audit Date**: 2025-11-12
**Audit Scope**: Complete codebase credential handling review
**Status**: ✅ PASS - No hardcoded credentials or critical security issues detected

### Audit Summary

- **Total Credential References Analyzed**: 500+ occurrences
- **Classification Results**:
  - SAFE: 100% (All references are legitimate API usage)
  - RISKY: 0
  - CRITICAL: 0
- **Hardcoded Credentials Found**: None

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email the maintainer directly at: [project maintainer email]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release cycle

## Credential Handling Policy

### Current Implementation

This extension currently **does not store or handle user credentials**. All environment variable access is limited to:

- System paths (`SHELL`, `HOME`, `USERPROFILE`)
- Debug flags (`NODE_ENV`, `CI`, `VSCODE_DEBUG_MODE`)
- Terminal configuration (`DISPLAY`, `COMSPEC`)

### Future Credential Storage

If future versions require credential storage, we commit to:

1. **ALWAYS** use VS Code's `SecretStorage` API
2. **NEVER** store credentials in:
   - Workspace configuration files
   - Plain text files
   - Environment variables
   - Local storage

### Example: Proper Credential Storage

```typescript
// ✅ CORRECT: Using VS Code SecretStorage API
import * as vscode from 'vscode';

export class CredentialService {
  constructor(private context: vscode.ExtensionContext) {}

  async storeApiKey(key: string): Promise<void> {
    await this.context.secrets.store('myExtension.apiKey', key);
  }

  async retrieveApiKey(): Promise<string | undefined> {
    return await this.context.secrets.get('myExtension.apiKey');
  }

  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete('myExtension.apiKey');
  }
}

// ❌ INCORRECT: Never do this
const API_KEY = "sk-1234567890abcdef"; // Hardcoded credential
```

## Security Best Practices

### For Contributors

1. **Never commit credentials**
   - API keys, passwords, tokens, or secrets
   - Use `.env` files (already gitignored)
   - Use environment variables for local testing

2. **Use VS Code SecretStorage API**
   - For any credential storage needs
   - Never use workspace configuration

3. **Review code for security issues**
   - Check for hardcoded credentials
   - Validate input from external sources
   - Avoid `eval()` and similar dangerous functions

4. **Keep dependencies updated**
   - Run `npm audit` regularly
   - Update packages with known vulnerabilities

### For Users

1. **Keep extension updated**
   - Install security updates promptly
   - Enable automatic updates in VS Code

2. **Report suspicious behavior**
   - Unexpected network requests
   - Unusual file access patterns
   - Permission escalation attempts

3. **Use secure environments**
   - Don't run untrusted code in terminals
   - Be cautious with terminal commands from unknown sources

## Security Scanning

### Automated Security Checks

Our CI/CD pipeline includes:

- **CodeQL Analysis**: Automated code security scanning
- **npm audit**: Dependency vulnerability scanning
- **Automated Testing**: 70%+ code coverage
- **GitHub Security Advisories**: Automated vulnerability alerts

### Pre-commit Hooks (Recommended)

For contributors, we recommend setting up pre-commit hooks:

```bash
# Future implementation - not yet configured
npm install --save-dev husky lint-staged @secretlint/secretlint-rule-preset-recommend

# Add to package.json scripts:
# "prepare": "husky install"
# "secretlint": "secretlint **/*"
```

## Protected Files

The following files are protected via `.gitignore`:

```
# Environment and credential files
.env
.env.*
.env.local
.env.*.local
*.pem
*.key
*.p12
*.pfx
credentials.json
secrets.json
```

## Security Architecture

### Principle of Least Privilege

- Extension only requests necessary VS Code API permissions
- No unnecessary file system access
- Limited network access

### Defense in Depth

1. **Layer 1**: `.gitignore` prevents credential commits
2. **Layer 2**: ESLint rules catch dangerous code patterns
3. **Layer 3**: Code review process for all contributions
4. **Layer 4**: Automated security scanning in CI/CD
5. **Layer 5**: VS Code marketplace security review

## Known Security Considerations

### Terminal Command Execution

⚠️ **Risk**: This extension creates terminals that can execute arbitrary commands.

**Mitigations**:
- All commands are user-initiated
- No automatic command execution
- Clear visual feedback for command execution
- Inherits VS Code's terminal security model

### GitHub Actions Secrets

✅ **Properly Managed**: We use GitHub Secrets for:
- `VSCE_PAT`: VS Code marketplace publishing
- `CODECOV_TOKEN`: Code coverage reporting

These are never hardcoded and are properly referenced as `${{ secrets.* }}`.

## Security Update Notifications

Users will be notified of security updates through:

1. **VS Code Marketplace**: Extension update notifications
2. **GitHub Releases**: Tagged security releases
3. **GitHub Security Advisories**: For critical vulnerabilities

## Compliance

### OWASP Top 10

This extension has been audited against:
- **A07:2021 – Identification and Authentication Failures**: ✅ PASS
- **A02:2021 – Cryptographic Failures**: N/A (No cryptographic operations)
- **A03:2021 – Injection**: ✅ Mitigated (No eval, proper input handling)

## Security Contact

For security concerns, please contact:
- **GitHub Issues**: For non-sensitive security improvements
- **Email**: [Project maintainer email] for vulnerability reports
- **Security Advisories**: Use GitHub's "Report a vulnerability" feature

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with their permission).

## Updates to This Policy

This security policy is reviewed and updated:
- After each security audit
- When new features are added
- In response to security incidents
- At least annually

**Last Updated**: 2025-11-12
**Version**: 1.0.0
