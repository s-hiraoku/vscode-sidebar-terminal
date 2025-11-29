# Firecrawl MCP Tools Reference

## mcp__firecrawl__firecrawl_scrape

Scrape content from a single URL. The most powerful and reliable scraper tool.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | URL to scrape |
| formats | array | No | Output formats: "markdown", "html", "rawHtml", "screenshot", "links", "summary" |
| onlyMainContent | boolean | No | Extract only main content |
| maxAge | number | No | Cache TTL in milliseconds (improves speed by 500%) |
| includeTags | array | No | HTML tags to include |
| excludeTags | array | No | HTML tags to exclude |
| waitFor | number | No | Wait time in ms before scraping |
| mobile | boolean | No | Use mobile viewport |

**Example:**
```json
{
  "url": "https://example.com/docs",
  "formats": ["markdown"],
  "onlyMainContent": true,
  "maxAge": 172800000
}
```

---

## mcp__firecrawl__firecrawl_search

Search the web and optionally extract content from results.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| query | string | Yes | Search query |
| limit | number | No | Number of results |
| scrapeOptions | object | No | Options for scraping search results |
| sources | array | No | Source types: "web", "images", "news" |
| tbs | string | No | Time-based search filter |

**Search Operators:**
- `""` - Exact match: `"xterm.js"`
- `-` - Exclude: `-deprecated`
- `site:` - Specific site: `site:github.com`
- `inurl:` - URL contains: `inurl:docs`
- `intitle:` - Title contains: `intitle:tutorial`
- `related:` - Related sites: `related:example.com`

**Example without scraping:**
```json
{
  "query": "xterm.js addon tutorial",
  "limit": 5
}
```

**Example with scraping:**
```json
{
  "query": "VS Code extension API",
  "limit": 3,
  "scrapeOptions": {
    "formats": ["markdown"],
    "onlyMainContent": true
  }
}
```

---

## mcp__firecrawl__firecrawl_map

Discover all URLs on a website.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | Base URL to map |
| limit | number | No | Maximum URLs to return |
| search | string | No | Filter URLs containing this text |
| includeSubdomains | boolean | No | Include subdomain URLs |
| ignoreQueryParameters | boolean | No | Ignore URL query parameters |
| sitemap | string | No | Sitemap handling: "include", "skip", "only" |

**Example:**
```json
{
  "url": "https://docs.example.com",
  "limit": 100,
  "search": "api"
}
```

---

## mcp__firecrawl__firecrawl_crawl

Crawl a website and extract content from multiple pages.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| url | string | Yes | Starting URL |
| maxDiscoveryDepth | number | No | Crawl depth limit |
| limit | number | No | Maximum pages to crawl |
| includePaths | array | No | Paths to include (e.g., ["/docs/*"]) |
| excludePaths | array | No | Paths to exclude |
| allowExternalLinks | boolean | No | Follow external links |
| deduplicateSimilarURLs | boolean | No | Skip similar URLs |

**Warning:** Crawl can return large responses. Use small limits.

**Example:**
```json
{
  "url": "https://docs.example.com/guide",
  "maxDiscoveryDepth": 2,
  "limit": 10,
  "includePaths": ["/guide/*"]
}
```

---

## mcp__firecrawl__firecrawl_check_crawl_status

Check status of a crawl job.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Crawl job ID |

---

## mcp__firecrawl__firecrawl_extract

Extract structured data from web pages using LLM.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| urls | array | Yes | URLs to extract from |
| prompt | string | No | Extraction instructions |
| schema | object | No | JSON schema for structured output |
| allowExternalLinks | boolean | No | Allow external link extraction |
| enableWebSearch | boolean | No | Enable web search for context |

**Example:**
```json
{
  "urls": ["https://shop.example.com/product/123"],
  "prompt": "Extract product information",
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "price": { "type": "number" },
      "description": { "type": "string" },
      "inStock": { "type": "boolean" }
    },
    "required": ["name", "price"]
  }
}
```

---

## Recommended Workflows

### Documentation Research
1. Search: `firecrawl_search({ query: "topic", limit: 5 })`
2. Scrape relevant: `firecrawl_scrape({ url: "...", formats: ["markdown"] })`

### Site Discovery
1. Map: `firecrawl_map({ url: "...", search: "api" })`
2. Scrape specific pages from results

### Product Data Extraction
1. Extract: `firecrawl_extract({ urls: [...], schema: {...} })`
