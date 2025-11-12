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

## Security Best Practices for Users

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

- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [VS Code Extension Security](https://code.visualstudio.com/api/references/extension-manifest#security)

---

Last updated: 2025-11-12
