# DeepWiki MCP Tools Reference

## mcp__deepwiki__read_wiki_structure

Get a list of documentation topics for a GitHub repository.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| repoName | string | Yes | GitHub repository: owner/repo (e.g., "facebook/react") |

**Returns:** List of documentation topics and sections available for the repository.

---

## mcp__deepwiki__read_wiki_contents

View documentation about a GitHub repository.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| repoName | string | Yes | GitHub repository: owner/repo (e.g., "facebook/react") |

**Returns:** Comprehensive documentation content for the repository.

---

## mcp__deepwiki__ask_question

Ask any question about a GitHub repository.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| repoName | string | Yes | GitHub repository: owner/repo (e.g., "facebook/react") |
| question | string | Yes | The question to ask about the repository |

**Returns:** AI-generated answer based on the repository's codebase and documentation.

---

## Common Repository Queries

### VS Code Terminal Implementation
```
mcp__deepwiki__ask_question({
  repoName: "microsoft/vscode",
  question: "How is the integrated terminal implemented?"
})
```

### xterm.js Addon System
```
mcp__deepwiki__ask_question({
  repoName: "xtermjs/xterm.js",
  question: "How do addons work in xterm.js?"
})
```

### React Hooks Implementation
```
mcp__deepwiki__ask_question({
  repoName: "facebook/react",
  question: "How are hooks implemented internally?"
})
```
