# Chrome DevTools MCP Tools Reference

## Page Management Tools

### mcp__chrome-devtools__list_pages
Get a list of pages open in the browser. No parameters required.

### mcp__chrome-devtools__select_page
Select a page for future tool calls.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pageIdx | number | Yes | Index of page to select |

### mcp__chrome-devtools__new_page
Create a new page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | URL to load |
| timeout | number | No | Maximum wait time in ms |

### mcp__chrome-devtools__close_page
Close a page by index. Last page cannot be closed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| pageIdx | number | Yes | Index of page to close |

### mcp__chrome-devtools__navigate_page
Navigate the selected page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | No | "url", "back", "forward", "reload" |
| url | string | No | Target URL (for type=url) |
| ignoreCache | boolean | No | Ignore cache on reload |
| timeout | number | No | Maximum wait time in ms |

### mcp__chrome-devtools__resize_page
Resize the page window.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| width | number | Yes | Page width |
| height | number | Yes | Page height |

---

## Snapshot and Screenshot Tools

### mcp__chrome-devtools__take_snapshot
Take accessibility tree snapshot. Preferred over screenshot for interaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| verbose | boolean | No | Include all a11y tree info |
| filePath | string | No | Save snapshot to file |

### mcp__chrome-devtools__take_screenshot
Take a screenshot.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | No | "png", "jpeg", "webp" (default: png) |
| quality | number | No | JPEG/WebP quality (0-100) |
| fullPage | boolean | No | Capture full scrollable page |
| uid | string | No | Element uid for element screenshot |
| filePath | string | No | Save path |

---

## Element Interaction Tools

### mcp__chrome-devtools__click
Click on an element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| uid | string | Yes | Element uid from snapshot |
| dblClick | boolean | No | Double click |

### mcp__chrome-devtools__fill
Fill input or select option.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| uid | string | Yes | Element uid from snapshot |
| value | string | Yes | Value to fill |

### mcp__chrome-devtools__fill_form
Fill multiple form elements.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| elements | array | Yes | Array of {uid, value} objects |

### mcp__chrome-devtools__hover
Hover over an element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| uid | string | Yes | Element uid from snapshot |

### mcp__chrome-devtools__drag
Drag element to another element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| from_uid | string | Yes | Source element uid |
| to_uid | string | Yes | Target element uid |

### mcp__chrome-devtools__upload_file
Upload a file.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| uid | string | Yes | File input element uid |
| filePath | string | Yes | Local file path |

---

## Keyboard Tools

### mcp__chrome-devtools__press_key
Press a key or key combination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| key | string | Yes | Key or combo (e.g., "Enter", "Control+A") |

Modifiers: Control, Shift, Alt, Meta

---

## Console Tools

### mcp__chrome-devtools__list_console_messages
List console messages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| types | array | No | Filter by type: "log", "error", "warn", etc. |
| includePreservedMessages | boolean | No | Include messages from last 3 navigations |
| pageIdx | number | No | Page number (0-based) |
| pageSize | number | No | Maximum messages to return |

### mcp__chrome-devtools__get_console_message
Get specific console message.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| msgid | number | Yes | Message ID |

---

## Network Tools

### mcp__chrome-devtools__list_network_requests
List network requests.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| resourceTypes | array | No | Filter: "xhr", "fetch", "document", etc. |
| includePreservedRequests | boolean | No | Include from last 3 navigations |
| pageIdx | number | No | Page number (0-based) |
| pageSize | number | No | Maximum requests to return |

### mcp__chrome-devtools__get_network_request
Get specific network request details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reqid | number | No | Request ID (current DevTools selection if omitted) |

---

## Performance Tools

### mcp__chrome-devtools__performance_start_trace
Start performance trace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reload | boolean | Yes | Reload page after starting |
| autoStop | boolean | Yes | Automatically stop recording |

### mcp__chrome-devtools__performance_stop_trace
Stop active performance trace. No parameters required.

### mcp__chrome-devtools__performance_analyze_insight
Analyze a specific performance insight.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| insightSetId | string | Yes | Insight set ID from trace |
| insightName | string | Yes | Insight name (e.g., "LCPBreakdown") |

---

## Advanced Tools

### mcp__chrome-devtools__evaluate_script
Execute JavaScript in the page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| function | string | Yes | JS function: `() => { ... }` |
| args | array | No | Element uids to pass as arguments |

### mcp__chrome-devtools__emulate
Emulate network/CPU conditions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| networkConditions | string | No | "Offline", "Slow 3G", "Fast 3G", etc. |
| cpuThrottlingRate | number | No | CPU slowdown (1-20, 1=no throttling) |

### mcp__chrome-devtools__handle_dialog
Handle browser dialog.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | string | Yes | "accept" or "dismiss" |
| promptText | string | No | Text for prompt dialog |

### mcp__chrome-devtools__wait_for
Wait for text to appear.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| text | string | Yes | Text to wait for |
| timeout | number | No | Maximum wait time in ms |
