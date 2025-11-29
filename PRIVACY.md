# Privacy Policy - Secondary Terminal Extension

**Last Updated:** 2025-11-12

## Overview

The Secondary Terminal extension respects your privacy and is committed to protecting your data. This document explains what data we collect, how we use it, and your choices regarding telemetry.

## Telemetry Collection

This extension implements **privacy-respecting telemetry** using Visual Studio Code's native TelemetryLogger API to help us improve the extension.

### What We Collect

We collect **anonymous usage data** including:

#### Extension Lifecycle
- Extension activation time
- Extension version
- Platform (Windows, macOS, Linux)
- Node.js version

#### Terminal Operations
- Number of terminals created
- Number of terminals deleted
- Terminal focus events
- Split terminal operations (direction: horizontal/vertical)
- Terminal profile selection (whether custom profile is used, not the profile content)

#### CLI Agent Detection
- CLI agent type detected (e.g., 'claude', 'gemini', 'copilot')
- CLI agent connection/disconnection events
- Session duration

#### Command Execution
- Command IDs executed (e.g., 'secondaryTerminal.createTerminal')
- Success/failure status
- Execution time

#### Error Events
- Error messages
- Error types
- Error context (which operation failed)
- Stack traces (sanitized)

#### Session Management
- Number of terminals saved
- Number of terminals restored
- Success/failure status

#### Performance Metrics
- Operation execution duration
- Success/failure status

### What We DO NOT Collect

We are committed to **minimal data collection** and **never** collect:

- ❌ Terminal content (commands you type)
- ❌ Terminal output
- ❌ File paths or file content
- ❌ Working directory paths
- ❌ Environment variables
- ❌ Credentials or passwords
- ❌ Personal identifiable information (PII)
- ❌ Network requests or IP addresses
- ❌ User-specific data

## How We Use Your Data

Telemetry data is used exclusively to:

- 📊 Understand which features are most used
- 🐛 Identify and fix bugs
- ⚡ Improve performance
- 🎯 Prioritize development efforts
- 📈 Track feature adoption rates

## Your Privacy Controls

### Respecting VS Code Settings

This extension **automatically respects** VS Code's telemetry settings:

```json
{
  "telemetry.telemetryLevel": "off"  // Disables all telemetry
}
```

If you have opted out of telemetry in VS Code settings, **no data will be collected** by this extension.

### How to Opt Out

You can disable telemetry in three ways:

#### Option 1: VS Code Telemetry Setting (Recommended)
1. Open VS Code Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "telemetry"
3. Set **"Telemetry: Telemetry Level"** to `"off"`

This will disable telemetry for **all extensions** that respect VS Code's telemetry API.

#### Option 2: Global VS Code Setting
Add to your `settings.json`:

```json
{
  "telemetry.telemetryLevel": "off"
}
```

#### Option 3: Workspace-Specific Setting
Add to your workspace `.vscode/settings.json`:

```json
{
  "telemetry.telemetryLevel": "off"
}
```

### Telemetry Levels

VS Code supports the following telemetry levels:

- `"all"` - Send usage data, errors, and crash reports
- `"error"` - Send error and crash reports only
- `"crash"` - Send crash reports only
- `"off"` - **No telemetry data is sent** ✅

## Data Security

### Encryption
- All telemetry data is transmitted over **HTTPS** (encrypted in transit)
- No sensitive data is included in telemetry

### Anonymization
- All data is **anonymous**
- No user identification or tracking across sessions
- No persistent user IDs

### Data Retention
- Telemetry data may be stored for analysis purposes
- Data is aggregated and anonymized
- Individual events cannot be traced back to specific users

## Third-Party Data Sharing

We **do not share, sell, or distribute** your telemetry data to third parties.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be:
- Documented in this file
- Included in extension updates
- Announced in release notes

## Contact

If you have questions or concerns about privacy:

- **GitHub Issues:** https://github.com/s-hiraoku/vscode-sidebar-terminal/issues
- **Repository:** https://github.com/s-hiraoku/vscode-sidebar-terminal

## Compliance

This extension complies with:
- ✅ VS Code Extension Guidelines
- ✅ VS Code Telemetry Best Practices
- ✅ GDPR principles (minimal data collection, user consent)
- ✅ Privacy by design principles

## Summary

**TL;DR:**
- ✅ Anonymous usage data only
- ✅ No terminal content, commands, or file paths
- ✅ Respects VS Code telemetry opt-out
- ✅ HTTPS encryption
- ✅ No third-party sharing
- ✅ Minimal data collection approach

**Your privacy is important to us.** If you have any concerns, please disable telemetry in VS Code settings or contact us via GitHub Issues.
