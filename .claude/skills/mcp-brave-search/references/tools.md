# Brave Search MCP Tools Reference

## mcp__brave-search__brave_web_search

Perform a web search using the Brave Search API. Ideal for general queries, news, articles, and online content.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| query | string | Yes | - | Search query (max 400 chars, 50 words) |
| count | number | No | 10 | Number of results (1-20) |
| offset | number | No | 0 | Pagination offset (max 9) |

**Returns:** Search results with titles, URLs, and snippets.

**Example:**
```
mcp__brave-search__brave_web_search({
  query: "TypeScript best practices 2024",
  count: 10,
  offset: 0
})
```

---

## mcp__brave-search__brave_local_search

Search for local businesses and places. Returns detailed information including business names, addresses, ratings, phone numbers, and opening hours.

**Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| query | string | Yes | - | Local search query (e.g., "pizza near Central Park") |
| count | number | No | 5 | Number of results (1-20) |

**Returns:** Local business results with contact information, ratings, and hours.

**Example:**
```
mcp__brave-search__brave_local_search({
  query: "restaurants near Tokyo Station",
  count: 5
})
```

**Note:** Automatically falls back to web search if no local results are found.

---

## Search Query Tips

### Use Search Operators

- **Exact phrase**: `"VS Code terminal"`
- **Exclude terms**: `terminal -windows`
- **Site-specific**: `site:github.com xterm.js`
- **File type**: `filetype:pdf typescript guide`

### Effective Queries

| Goal | Example Query |
|------|--------------|
| Latest docs | `xterm.js documentation 2024` |
| Error solution | `"WebGL context lost" xterm fix` |
| Comparisons | `xterm.js vs terminal.js comparison` |
| Tutorials | `VS Code extension tutorial beginner` |
