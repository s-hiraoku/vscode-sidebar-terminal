# Security Policy

The VS Code Sidebar Terminal extension takes security seriously. This document outlines our security practices, vulnerability reporting procedures, credential handling policies, and XSS mitigation strategies.

## Security Audit Status

### Credential Handling Audit (Issue #230)

**Last Audit Date**: 2025-11-12
**Audit Scope**: Complete codebase credential handling review
**Status**: ✅ PASS - No hardcoded credentials or critical security issues detected

#### Audit Summary

- **Total Credential References Analyzed**: 500+ occurrences
- **Classification Results**:
  - SAFE: 100% (All references are legitimate API usage)
  - RISKY: 0
  - CRITICAL: 0
- **Hardcoded Credentials Found**: None

For detailed audit findings, see [SECURITY_AUDIT_REPORT.md](docs/SECURITY_AUDIT_REPORT.md).

### XSS Vulnerability Mitigation (Issue #229)

**Status**: Completed for high/low risk areas
**Scope**: 68+ instances of innerHTML usage audited and remediated

The extension previously used `innerHTML` extensively throughout the codebase, which posed a significant XSS vulnerability risk. We have implemented a comprehensive four-phase approach to eliminate XSS vulnerabilities.

**Phase 1: Audit (Completed)**
- Audited all innerHTML usage locations in the codebase
- Classified each usage by risk level:
  - **HIGH RISK**: User input or terminal output directly inserted into DOM
  - **MEDIUM RISK**: System information or partially sanitized content
  - **LOW RISK**: Fixed content or clear operations

**Phase 2: Remediation (Completed for High/Low Risk)**
Replaced vulnerable innerHTML patterns with safe alternatives:

High-Risk Replacements:
- `DOMUtils.ts`: Blocked innerHTML attribute support with warning
- `UIController.ts`: Notification messages now use textContent + DOM construction
- `UIManager.ts`: Notification content uses safe DOM APIs

Low-Risk Replacements:
- All `innerHTML = ''` changed to `textContent = ''`
- All `innerHTML = '×'` changed to `textContent = '×'`
- Clear operations now use textContent instead of innerHTML

Medium-Risk Replacements:
- Loading indicators: Use createElement + textContent
- Debug panels: Build DOM structure with safe APIs
- Terminal tabs: Construct using DOM elements

**Phase 3: Prevention (Completed)**
Implemented automated safeguards:

ESLint Rule:
```json
{
  "no-restricted-properties": [
    "error",
    {
      "object": "*",
      "property": "innerHTML",
      "message": "SECURITY: innerHTML is not allowed due to XSS vulnerability risk. Use textContent, createElement, or appendChild instead. See issue #229."
    }
  ]
}
```

DOMUtils Security:
- innerHTML attribute in `DOMUtils.createElement()` now logs warning and falls back to textContent
- Developers are guided to use safe alternatives

**Phase 4: Testing (In Progress)**
- TypeScript compilation verified with no errors
- ESLint rules active to prevent future innerHTML usage
- XSS test suite to be implemented in future PR

#### Safe DOM Manipulation Patterns

When building UI elements, always use these safe patterns:

✅ **SAFE: Using textContent**
```typescript
element.textContent = userInput; // Automatically escapes HTML
```

✅ **SAFE: Building DOM with createElement**
```typescript
const div = document.createElement('div');
div.className = 'message';

const span = document.createElement('span');
span.textContent = message; // Safe

div.appendChild(span);
```

✅ **SAFE: Using DocumentFragment**
```typescript
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item.name; // Safe
  fragment.appendChild(li);
});
container.appendChild(fragment);
```

❌ **UNSAFE: Using innerHTML with user input**
```typescript
element.innerHTML = userInput; // XSS RISK!
element.innerHTML = `<div>${terminalOutput}</div>`; // XSS RISK!
```

#### Remaining Work

The following files still contain innerHTML for large fixed HTML templates:
- `src/webview/components/ProfileSelector.ts` (uses _escapeHtml for sanitization)
- `src/webview/components/TerminalTabList.ts`
- `src/webview/components/SettingsPanel.ts`
- `src/webview/managers/LightweightTerminalWebviewManager.ts`
- `src/webview/managers/handlers/ShellIntegrationMessageHandler.ts`

These are lower priority as they use:
1. Fixed HTML templates (no user input)
2. HTML escape functions (_escapeHtml)
3. System information only

Future work will convert these to safe DOM construction methods.

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

We recommend always using the latest version of vscode-sidebar-terminal to ensure you have all security updates.

## Reporting a Vulnerability

We take the security of vscode-sidebar-terminal seriously. If you believe you have found a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to the [Security Advisories](https://github.com/s-hiraoku/vscode-sidebar-terminal/security/advisories) page
   - Click "Report a vulnerability"
   - Fill out the form with details about the vulnerability

2. **Email**
   - Send an email to the repository maintainer
   - Include as much information as possible (see below)

### What to Include in Your Report

Please include the following information in your vulnerability report:

- **Description**: A clear description of the vulnerability
- **Impact**: What kind of vulnerability it is and its potential impact
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions of the extension are affected
- **Proof of Concept**: If possible, include a proof of concept or exploit code
- **Suggested Fix**: If you have ideas on how to fix the issue, please share them

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release cycle

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Updates**: We will send you regular updates about our progress
- **Timeline**: We aim to release a fix within 90 days of disclosure
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

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

## Security Scanning

### Automated Security Checks

Our CI/CD pipeline includes:

- **npm audit**: Runs on every CI build to detect vulnerable dependencies
  - Fails builds on high/critical severity vulnerabilities
  - Audit level: `high`
  - No bypass with `|| true` (Issue #233)

- **Snyk Security Scanning**: Integrated SAST tool for comprehensive vulnerability detection
  - Scans dependencies and code for security issues
  - Results uploaded to GitHub Security tab
  - Severity threshold: `high`

- **CodeQL Analysis**: Static analysis for code vulnerabilities
  - Runs weekly and on every push to main branches
  - Analyzes JavaScript/TypeScript code patterns

- **Dependabot**: Automated dependency updates
  - Weekly scans for outdated dependencies
  - Automatic pull requests for security updates
  - Separate updates for GitHub Actions

- **ESLint Security Rules**: Prevents innerHTML and dangerous functions

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

### Continuous Monitoring

- Weekly scheduled security scans
- Automated dependency updates
- Security alerts enabled on GitHub

## Security Best Practices

### For Developers and Contributors

#### 1. Never Commit Credentials
- API keys, passwords, tokens, or secrets
- Use `.env` files (already gitignored)
- Use environment variables for local testing

#### 2. Use VS Code SecretStorage API
- For any credential storage needs
- Never use workspace configuration

#### 3. Prevent XSS Vulnerabilities
- Never use `innerHTML` (ESLint will block it)
- Use `textContent` or safe DOM APIs
- Validate and sanitize all user input

#### 4. Review Code for Security Issues
- Check for hardcoded credentials
- Validate input from external sources
- Avoid `eval()` and similar dangerous functions

#### 5. Keep Dependencies Updated
- Run `npm audit` regularly
- Update packages with known vulnerabilities

#### 6. Input Validation
- Always validate and sanitize user input before processing
- Use TypeScript types to enforce expected data shapes
- Never trust terminal output or external data sources

#### 7. Content Security Policy (CSP)
The extension uses VS Code's WebView CSP to restrict:
- Script sources to trusted origins only
- No inline script execution
- Restricted style sources

#### 8. Code Review Guidelines
When reviewing PRs, check for:
- Use of innerHTML (should trigger ESLint error)
- Direct DOM manipulation without sanitization
- User input being inserted into HTML attributes
- Terminal output being rendered as HTML
- Hardcoded credentials or API keys

### For Users

When using vscode-sidebar-terminal, we recommend:

1. **Keep Updated**: Always use the latest version of the extension
2. **Install Security Updates Promptly**: Enable automatic updates in VS Code
3. **Review Permissions**: Understand what permissions the extension requires
4. **Report Suspicious Behavior**:
   - Unexpected network requests
   - Unusual file access patterns
   - Permission escalation attempts
5. **Secure Environment**: Use the extension in a secure development environment
6. **Code Review**: Review any code you execute through the terminal
7. **Be Cautious**: Don't run untrusted code in terminals

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
2. **Layer 2**: ESLint rules catch dangerous code patterns (innerHTML, eval)
3. **Layer 3**: Code review process for all contributions
4. **Layer 4**: Automated security scanning in CI/CD (npm audit, Snyk, CodeQL)
5. **Layer 5**: VS Code marketplace security review

## Known Security Considerations

### Terminal Command Execution

⚠️ **Risk**: This extension creates terminals that can execute arbitrary commands.

**Mitigations**:
- All commands are user-initiated
- No automatic command execution
- Clear visual feedback for command execution
- Inherits VS Code's terminal security model
- Commands executed in the terminal run with your user permissions
- Be cautious when executing commands from untrusted sources
- The extension does not collect or transmit user data

### GitHub Actions Secrets

✅ **Properly Managed**: We use GitHub Secrets for:
- `VSCE_PAT`: VS Code marketplace publishing
- `CODECOV_TOKEN`: Code coverage reporting
- `SNYK_TOKEN`: Security scanning

These are never hardcoded and are properly referenced as `${{ secrets.* }}`.

## Security Update Policy

- **Critical vulnerabilities**: Patched within 24-48 hours
- **High vulnerabilities**: Patched within 7 days
- **Medium vulnerabilities**: Patched within 30 days
- **Low vulnerabilities**: Addressed in next release cycle

## Security Update Notifications

Users will be notified of security updates through:

1. **VS Code Marketplace**: Extension update notifications
2. **GitHub Releases**: Tagged security releases
3. **GitHub Security Advisories**: For critical vulnerabilities

## Compliance

### OWASP Top 10

This extension has been audited against:
- **A07:2021 – Identification and Authentication Failures**: ✅ PASS (Issue #230)
- **A03:2021 – Injection (XSS)**: ✅ MITIGATED (Issue #229)
- **A02:2021 – Cryptographic Failures**: N/A (No cryptographic operations)

## Security Contact

For security concerns, please contact:
- **GitHub Issues**: For non-sensitive security improvements
- **Email**: [Project maintainer email] for vulnerability reports
- **Security Advisories**: Use GitHub's "Report a vulnerability" feature

For any security-related questions or concerns, please contact the repository maintainer through GitHub.

## Additional Resources

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [VS Code Extension Security Best Practices](https://code.visualstudio.com/api/extension-guides/webview#security)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who report valid vulnerabilities (with their permission).

## Updates to This Policy

This security policy is reviewed and updated:
- After each security audit
- When new features are added
- In response to security incidents
- At least annually

## Changelog

### 2025-11-12
- Comprehensive credential handling audit completed (Issue #230)
- XSS vulnerability remediation completed for high/low risk areas (Issue #229)
- Comprehensive security scanning enabled in CI (Issue #233)
- npm audit enforcement, Snyk SAST, and Dependabot integration
- ESLint rules added to prevent innerHTML and dangerous functions
- DOMUtils.createElement() secured against innerHTML usage
- Enhanced .gitignore with credential file patterns
- Created comprehensive security documentation

---

**Last Updated**: 2025-11-12
**Version**: 3.0.0 (Merged Issue #229, #230, and #233 security enhancements)
