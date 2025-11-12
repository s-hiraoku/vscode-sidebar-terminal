# Security Policy for vscode-sidebar-terminal

## Overview

This document outlines the security measures and best practices implemented in the vscode-sidebar-terminal extension to protect against Cross-Site Scripting (XSS) vulnerabilities and other security risks.

## XSS Vulnerability Mitigation (Issue #229)

### Background

The extension previously used `innerHTML` extensively throughout the codebase, which posed a significant XSS vulnerability risk. Issue #229 documented 68+ instances of innerHTML usage that needed to be addressed.

### Remediation Strategy

We have implemented a comprehensive four-phase approach to eliminate XSS vulnerabilities:

#### Phase 1: Audit (Completed)
- Audited all innerHTML usage locations in the codebase
- Classified each usage by risk level:
  - **HIGH RISK**: User input or terminal output directly inserted into DOM
  - **MEDIUM RISK**: System information or partially sanitized content
  - **LOW RISK**: Fixed content or clear operations

#### Phase 2: Remediation (Completed for High/Low Risk)
Replaced vulnerable innerHTML patterns with safe alternatives:

**High-Risk Replacements:**
- `DOMUtils.ts`: Blocked innerHTML attribute support with warning
- `UIController.ts`: Notification messages now use textContent + DOM construction
- `UIManager.ts`: Notification content uses safe DOM APIs

**Low-Risk Replacements:**
- All `innerHTML = ''` changed to `textContent = ''`
- All `innerHTML = '×'` changed to `textContent = '×'`
- Clear operations now use textContent instead of innerHTML

**Medium-Risk Replacements:**
- Loading indicators: Use createElement + textContent
- Debug panels: Build DOM structure with safe APIs
- Terminal tabs: Construct using DOM elements

#### Phase 3: Prevention (Completed)
Implemented automated safeguards:

**ESLint Rule:**
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

**DOMUtils Security:**
- innerHTML attribute in `DOMUtils.createElement()` now logs warning and falls back to textContent
- Developers are guided to use safe alternatives

#### Phase 4: Testing (In Progress)
- TypeScript compilation verified with no errors
- ESLint rules active to prevent future innerHTML usage
- XSS test suite to be implemented in future PR

### Safe DOM Manipulation Patterns

When building UI elements, always use these safe patterns:

#### ✅ SAFE: Using textContent
```typescript
element.textContent = userInput; // Automatically escapes HTML
```

#### ✅ SAFE: Building DOM with createElement
```typescript
const div = document.createElement('div');
div.className = 'message';

const span = document.createElement('span');
span.textContent = message; // Safe

div.appendChild(span);
```

#### ✅ SAFE: Using DocumentFragment
```typescript
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const li = document.createElement('li');
  li.textContent = item.name; // Safe
  fragment.appendChild(li);
});
container.appendChild(fragment);
```

#### ❌ UNSAFE: Using innerHTML with user input
```typescript
element.innerHTML = userInput; // XSS RISK!
element.innerHTML = `<div>${terminalOutput}</div>`; // XSS RISK!
```

### Remaining Work

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

## Security Best Practices

### 1. Input Validation
- Always validate and sanitize user input before processing
- Use TypeScript types to enforce expected data shapes
- Never trust terminal output or external data sources

### 2. Content Security Policy (CSP)
The extension uses VS Code's WebView CSP to restrict:
- Script sources to trusted origins only
- No inline script execution
- Restricted style sources

### 3. Code Review Guidelines
When reviewing PRs, check for:
- Use of innerHTML (should trigger ESLint error)
- Direct DOM manipulation without sanitization
- User input being inserted into HTML attributes
- Terminal output being rendered as HTML

### 4. Dependencies
- Regularly update dependencies to patch known vulnerabilities
- Run `npm audit` to identify and fix security issues
- Use `npm audit fix` for automated patches

## Reporting Security Issues

If you discover a security vulnerability in vscode-sidebar-terminal:

1. **Do NOT** open a public issue
2. Email the maintainers directly with details
3. Include steps to reproduce if possible
4. Allow time for the team to address before public disclosure

## Security Resources

- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- VS Code Extension Security Best Practices: https://code.visualstudio.com/api/extension-guides/webview#security
- Content Security Policy Guide: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

## Changelog

### 2025-11-12
- Initial security documentation created
- XSS vulnerability remediation (Issue #229) completed for high/low risk areas
- ESLint rule added to prevent future innerHTML usage
- DOMUtils.createElement() secured against innerHTML usage
