# MCP Server Setup Guide

**Complete guide to configure MCP (Model Context Protocol) servers for optimal OpenSpec workflow**

MCP servers provide specialized capabilities to agents, enabling faster research, reliable file operations, and automated testing.

---

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [MCP Server Overview](#mcp-server-overview)
3. [Required MCPs](#required-mcps)
4. [Optional MCPs](#optional-mcps)
5. [Configuration](#configuration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Configuration](#advanced-configuration)

---

## Quick Setup

### 1. Locate Configuration File

**macOS**:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux**:
```bash
~/.config/Claude/claude_desktop_config.json
```

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

### 2. Backup Existing Configuration

```bash
# macOS/Linux
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json \
   ~/Library/Application\ Support/Claude/claude_desktop_config.json.backup

# Windows (PowerShell)
Copy-Item "$env:APPDATA\Claude\claude_desktop_config.json" `
          "$env:APPDATA\Claude\claude_desktop_config.json.backup"
```

### 3. Add MCP Servers

Edit `claude_desktop_config.json`:

```json
{
  "globalShortcut": "",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/your/project"
      ]
    },
    "npm": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-npm"]
    },
    "deepwiki": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-deepwiki"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  },
  "preferences": {
    "quickEntryDictationShortcut": "capslock"
  }
}
```

### 4. Get Required API Keys

**GitHub Personal Access Token**:
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:org`
4. Copy token and paste into config

**Brave Search API Key** (optional):
1. Go to https://brave.com/search/api/
2. Sign up for free tier
3. Copy API key

**Firecrawl API Key** (optional):
1. Go to https://firecrawl.dev/
2. Create account
3. Copy API key

### 5. Update Project Path

Replace `/path/to/your/project` with your actual project path:

```json
"filesystem": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/Volumes/SSD/development/workspace/vscode-sidebar-terminal/for-publish"
  ]
}
```

### 6. Restart Claude Desktop

```bash
# Quit Claude Desktop completely
# Restart Claude Desktop
# MCPs will initialize on startup
```

### 7. Verify MCPs Loaded

Check Claude Code logs for MCP initialization messages:
```
MCP server 'github' initialized
MCP server 'filesystem' initialized
MCP server 'npm' initialized
...
```

---

## MCP Server Overview

### What is MCP?

**Model Context Protocol (MCP)** is a protocol that allows AI assistants to access external tools and services through standardized servers.

**Benefits**:
- **Faster Research**: Direct API access vs web scraping
- **Reliable Operations**: Structured data vs text parsing
- **Extended Capabilities**: Access to specialized tools

### How MCPs Work

```
AI Agent → Claude Code → MCP Client → MCP Server → External Service
                                                       ↓
                                                  (GitHub API,
                                                   Filesystem,
                                                   npm registry,
                                                   etc.)
```

**Example**: `vscode-terminal-resolver` agent
1. Agent requests VS Code source code
2. Claude Code calls MCP client
3. MCP client communicates with GitHub MCP server
4. GitHub MCP server fetches code via GitHub API
5. Response flows back to agent

**Result**: 10x faster (6s vs 60s) compared to WebFetch

---

## Required MCPs

These MCPs are essential for OpenSpec workflow:

### 1. github MCP

**Purpose**: Access GitHub repositories (especially VS Code source code)

**Used by**:
- `vscode-terminal-resolver` (research VS Code patterns)
- `vscode-api-validator` (fetch VS Code API docs)
- Generated implementation agents

**Setup**:
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxxxxxxxxxx"
  }
}
```

**Get Token**:
```bash
# 1. Go to https://github.com/settings/tokens
# 2. Generate new token (classic)
# 3. Select scopes: repo, read:org
# 4. Copy token
```

**Performance Impact**: **10x faster** VS Code research (60s → 6s)

---

### 2. filesystem MCP

**Purpose**: Safe file operations for refactoring and scaffolding

**Used by**:
- `openspec-scaffolder` (create OpenSpec files)
- `similarity-based-refactoring` (bulk file edits)
- Generated implementation agents

**Setup**:
```json
"filesystem": {
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/ABSOLUTE/PATH/TO/YOUR/PROJECT"
  ]
}
```

**⚠️ Important**: Use absolute path, not relative:

```json
// ❌ Wrong
"args": ["...", "./for-publish"]

// ✅ Correct
"args": ["...", "/Users/yourname/projects/vscode-sidebar-terminal/for-publish"]
```

**Security**: filesystem MCP only has access to specified directory

---

### 3. npm MCP

**Purpose**: Query npm registry for package information

**Used by**:
- `vscode-api-validator` (check dependency versions)
- Research agents (find package docs)

**Setup**:
```json
"npm": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-npm"]
}
```

**No API key required**

**Capabilities**:
- Package version lookup
- Dependency tree analysis
- Documentation links

---

## Optional MCPs

These MCPs enhance specific workflows:

### 4. deepwiki MCP

**Purpose**: Query GitHub repository documentation

**Used by**:
- `xterm-info-analyzer` (xterm.js docs)
- Research agents (library documentation)

**Setup**:
```json
"deepwiki": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-deepwiki"]
}
```

**Examples**:
```bash
# Get xterm.js documentation
deepwiki: "xtermjs/xterm.js"

# Get VS Code documentation
deepwiki: "microsoft/vscode"
```

---

### 5. playwright MCP

**Purpose**: Browser automation for E2E testing

**Used by**:
- `playwright-test-planner` (create test scenarios)
- `playwright-test-generator` (implement tests)
- `playwright-test-healer` (debug tests)

**Setup**:
```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-playwright"]
}
```

**First-time setup** (installs browsers):
```bash
npx playwright install
```

---

### 6. chrome-devtools MCP

**Purpose**: Chrome DevTools protocol for performance profiling

**Used by**:
- `terminal-performance-analyzer` (performance profiling)
- `webview-stability-investigator` (debugging)

**Setup**:
```json
"chrome-devtools": {
  "command": "npx",
  "args": ["-y", "chrome-devtools-mcp@latest"]
}
```

**Note**: Requires Chrome/Chromium installed

---

### 7. brave-search MCP

**Purpose**: Web search for documentation

**Used by**:
- Research agents (find documentation)
- `xterm-info-analyzer` (search for xterm.js examples)

**Setup**:
```json
"brave-search": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-brave-search"],
  "env": {
    "BRAVE_API_KEY": "BSAxxxxxxxxxxxxxxxxxxxx"
  }
}
```

**Get API Key**:
```bash
# 1. Go to https://brave.com/search/api/
# 2. Sign up (free tier: 2000 queries/month)
# 3. Copy API key
```

---

### 8. firecrawl MCP

**Purpose**: Web scraping for documentation

**Used by**:
- Research agents (scrape documentation sites)
- `xterm-info-analyzer` (extract xterm.js docs)

**Setup**:
```json
"firecrawl": {
  "command": "npx",
  "args": ["-y", "firecrawl-mcp"],
  "env": {
    "FIRECRAWL_API_KEY": "fc-xxxxxxxxxxxxxxxxxxxx"
  }
}
```

**Get API Key**:
```bash
# 1. Go to https://firecrawl.dev/
# 2. Create account
# 3. Copy API key
```

---

## Configuration

### Complete Configuration Template

Save this as your `claude_desktop_config.json`:

```json
{
  "globalShortcut": "",
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": ""
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        ""
      ]
    },
    "npm": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-npm"]
    },
    "deepwiki": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-deepwiki"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": ""
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    },
    "firecrawl": {
      "command": "npx",
      "args": ["-y", "firecrawl-mcp"],
      "env": {
        "FIRECRAWL_API_KEY": ""
      }
    }
  },
  "preferences": {
    "quickEntryDictationShortcut": "capslock"
  }
}
```

**Fill in**:
1. `GITHUB_PERSONAL_ACCESS_TOKEN` - Required
2. Filesystem path - Required (absolute path to project)
3. `BRAVE_API_KEY` - Optional
4. `FIRECRAWL_API_KEY` - Optional

---

## Verification

### 1. Check MCP Initialization

After restarting Claude Desktop, MCPs should initialize:

```bash
# Check Claude Code logs (if available)
# Look for initialization messages:
# "MCP server 'github' initialized"
# "MCP server 'filesystem' initialized"
```

### 2. Test Individual MCPs

**Test github MCP**:
```bash
Task(vscode-terminal-resolver): "Fetch VS Code TerminalInstance.ts:100-150"
# Should return VS Code source code quickly
```

**Test filesystem MCP**:
```bash
Task(openspec-scaffolder): "Create test OpenSpec change: test-mcp-setup"
# Should create files in openspec/changes/
```

**Test npm MCP**:
```bash
# Ask about a package
"What's the latest version of xterm?"
# Should query npm registry
```

### 3. Verify MCP Status

**Expected behavior**:
- Agents complete tasks faster
- No "MCP server not available" errors
- Source code fetching works (github MCP)
- File operations succeed (filesystem MCP)

**If MCPs not working**:
- See [Troubleshooting](#troubleshooting) section

---

## Troubleshooting

### Issue: MCP servers not initializing

**Symptoms**:
- No MCP initialization messages
- Agents can't access MCPs
- Errors: "MCP server not available"

**Solutions**:

1. **Check JSON syntax**:
```bash
# Validate JSON
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python -m json.tool
# Should output formatted JSON with no errors
```

2. **Check file permissions**:
```bash
# macOS/Linux
chmod 644 ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

3. **Restart Claude Desktop**:
```bash
# Quit completely (not just close window)
# Restart
```

4. **Check npx is available**:
```bash
npx --version
# Should output version number

# If not found, install Node.js:
# https://nodejs.org/
```

---

### Issue: GitHub MCP failing

**Symptoms**:
- Error: "GitHub authentication failed"
- vscode-terminal-resolver returns errors

**Solutions**:

1. **Check token is valid**:
```bash
# Test token with curl
curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user
# Should return your GitHub user info
```

2. **Check token scopes**:
- Token must have `repo` and `read:org` scopes
- Regenerate token if scopes missing

3. **Check token format**:
```json
// ✅ Correct
"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_1234567890abcdefghijklmnopqrstuvwxyz"

// ❌ Wrong (has quotes inside string)
"GITHUB_PERSONAL_ACCESS_TOKEN": "\"ghp_...\""
```

---

### Issue: Filesystem MCP path not found

**Symptoms**:
- Error: "Path not found" or "Access denied"
- openspec-scaffolder can't create files

**Solutions**:

1. **Use absolute path**:
```json
// ❌ Wrong
"args": ["...", "./for-publish"]
"args": ["...", "~/projects/my-project"]

// ✅ Correct
"args": ["...", "/Users/yourname/projects/my-project"]
```

2. **Check path exists**:
```bash
# macOS/Linux
ls -la /path/you/specified
# Should list directory contents

# Windows
dir "C:\path\you\specified"
```

3. **Check permissions**:
```bash
# macOS/Linux
chmod 755 /path/to/project
# Ensure directory is readable and writable
```

---

### Issue: npx commands failing

**Symptoms**:
- Error: "npx: command not found"
- MCPs not starting

**Solutions**:

1. **Install Node.js**:
```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed:
# Download from https://nodejs.org/
# Install LTS version
```

2. **Check PATH**:
```bash
# macOS/Linux
echo $PATH | grep node
# Should include Node.js path

# If not, add to ~/.zshrc or ~/.bashrc:
export PATH="/usr/local/bin:$PATH"
```

3. **Update npm**:
```bash
npm install -g npm@latest
```

---

### Issue: Playwright browsers not installed

**Symptoms**:
- Error: "Browser not found"
- Playwright tests fail immediately

**Solutions**:

```bash
# Install Playwright browsers
npx playwright install

# If permission issues (macOS):
sudo npx playwright install
```

---

## Advanced Configuration

### Environment Variables

**Load from .env file**:
```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

Create `.env` file:
```bash
# ~/.config/Claude/.env
GITHUB_TOKEN=ghp_your_token_here
BRAVE_API_KEY=BSA_your_key_here
FIRECRAWL_API_KEY=fc_your_key_here
```

---

### Multiple Filesystem Paths

**Access multiple projects**:
```json
"filesystem-project1": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project1"]
},
"filesystem-project2": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project2"]
}
```

---

### Custom MCP Servers

**Run custom MCP server**:
```json
"custom-mcp": {
  "command": "node",
  "args": ["/path/to/custom-mcp-server.js"],
  "env": {
    "CUSTOM_VAR": "value"
  }
}
```

---

## Performance Metrics

### With MCPs Configured

- **VS Code research**: 6s (vs 60s without github MCP)
- **File operations**: Instant (vs manual editing)
- **npm queries**: 2s (vs manual npm search)
- **E2E testing**: Automated (vs manual browser testing)

**Overall**: ~10 hours/month time savings

---

### Without MCPs

- Falls back to slower alternatives:
  - WebFetch instead of github MCP
  - Manual file operations instead of filesystem MCP
  - Manual npm search instead of npm MCP

**Recommendation**: Configure at least `github` and `filesystem` MCPs for significant productivity gains.

---

## Security Considerations

### API Keys

**Store securely**:
- ✅ In `claude_desktop_config.json` (file permissions: 644)
- ✅ In environment variables
- ❌ Don't commit to git
- ❌ Don't share publicly

**Rotate regularly**:
- GitHub tokens: Rotate every 90 days
- API keys: Rotate when compromised

---

### Filesystem Access

**Limit scope**:
```json
// ✅ Good: Specific project directory
"args": ["...", "/path/to/specific/project"]

// ❌ Bad: Home directory (too broad)
"args": ["...", "/Users/yourname"]
```

**Principle of Least Privilege**: Only grant access to directories that need MCP operations.

---

## Additional Resources

- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Agents Reference**: [AGENTS_REFERENCE.md](AGENTS_REFERENCE.md)
- **CLAUDE.md**: Complete development guide
- **MCP Documentation**: https://modelcontextprotocol.io/

---

**Questions or issues?** Check [QUICKSTART.md](QUICKSTART.md) or create an issue in the repository.
