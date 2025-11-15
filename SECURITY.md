# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

We recommend always using the latest version of vscode-sidebar-terminal to ensure you have all security updates.

## Reporting a Vulnerability

We take the security of vscode-sidebar-terminal seriously. If you believe you have found a security vulnerability, please report it to us as described below.

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

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Updates**: We will send you regular updates about our progress
- **Timeline**: We aim to release a fix within 90 days of disclosure
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Measures

This project implements the following security measures:

### XSS Vulnerability Mitigation (Issue #229)

#### Background

The extension previously used `innerHTML` extensively throughout the codebase, which posed a significant XSS vulnerability risk. Issue #229 documented 68+ instances of innerHTML usage that needed to be addressed.

#### Remediation Strategy

We have implemented a comprehensive four-phase approach to eliminate XSS vulnerabilities:

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

### Automated Security Scanning

- **npm audit**: Runs on every CI build to detect vulnerable dependencies
  - Fails builds on high/critical severity vulnerabilities
  - Audit level: `high`

- **Snyk Security Scanning**: Integrated SAST tool for comprehensive vulnerability detection
  - Scans dependencies and code for security issues
  - Results uploaded to GitHub Security tab

- **CodeQL Analysis**: Static analysis for code vulnerabilities
  - Runs weekly and on every push to main branches
  - Analyzes JavaScript/TypeScript code patterns

- **Dependabot**: Automated dependency updates
  - Weekly scans for outdated dependencies
  - Automatic pull requests for security updates
  - Separate updates for GitHub Actions

### Continuous Monitoring

- Weekly scheduled security scans
- Automated dependency updates
- Security alerts enabled on GitHub

## Security Best Practices

### For Developers

#### 1. Input Validation
- Always validate and sanitize user input before processing
- Use TypeScript types to enforce expected data shapes
- Never trust terminal output or external data sources

#### 2. Content Security Policy (CSP)
The extension uses VS Code's WebView CSP to restrict:
- Script sources to trusted origins only
- No inline script execution
- Restricted style sources

#### 3. Code Review Guidelines
When reviewing PRs, check for:
- Use of innerHTML (should trigger ESLint error)
- Direct DOM manipulation without sanitization
- User input being inserted into HTML attributes
- Terminal output being rendered as HTML

#### 4. Dependencies
- Regularly update dependencies to patch known vulnerabilities
- Run `npm audit` to identify and fix security issues
- Use `npm audit fix` for automated patches

### For Users

When using vscode-sidebar-terminal, we recommend:

1. **Keep Updated**: Always use the latest version of the extension
2. **Review Permissions**: Understand what permissions the extension requires
3. **Report Issues**: Report any suspicious behavior immediately
4. **Secure Environment**: Use the extension in a secure development environment
5. **Code Review**: Review any code you execute through the terminal

## Known Security Considerations

- This extension provides terminal access within VS Code
- Commands executed in the terminal run with your user permissions
- Be cautious when executing commands from untrusted sources
- The extension does not collect or transmit user data

## Security Update Policy

- **Critical vulnerabilities**: Patched within 7 days
- **High vulnerabilities**: Patched within 30 days
- **Medium vulnerabilities**: Patched within 90 days
- **Low vulnerabilities**: Addressed in regular releases

## Contact

For any security-related questions or concerns, please contact the repository maintainer through GitHub.

## Additional Resources

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [VS Code Extension Security Best Practices](https://code.visualstudio.com/api/extension-guides/webview#security)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

## Changelog

### 2025-11-12
- Initial security documentation created
- XSS vulnerability remediation (Issue #229) completed for high/low risk areas
- ESLint rule added to prevent future innerHTML usage
- DOMUtils.createElement() secured against innerHTML usage
- Comprehensive security scanning enabled in CI (Issue #233)
- npm audit enforcement, Snyk SAST, and Dependabot integration

---

Last updated: 2025-11-12
