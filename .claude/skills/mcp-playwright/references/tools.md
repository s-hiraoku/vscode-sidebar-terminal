# Playwright MCP Tools Reference

## Navigation Tools

### mcp__playwright__browser_navigate
Navigate to a URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | The URL to navigate to |

### mcp__playwright__browser_navigate_back
Go back to the previous page. No parameters required.

### mcp__playwright__browser_close
Close the page. No parameters required.

---

## Snapshot and Screenshot Tools

### mcp__playwright__browser_snapshot
Capture accessibility snapshot of the current page. Preferred over screenshot for interaction.

No parameters required. Returns element tree with refs for interaction.

### mcp__playwright__browser_take_screenshot
Take a screenshot of the current page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | "png" \| "jpeg" | No | Image format (default: png) |
| fullPage | boolean | No | Capture full scrollable page |
| filename | string | No | Output filename |
| ref | string | No | Element ref for element screenshot |
| element | string | No | Element description (required if ref provided) |

---

## Element Interaction Tools

### mcp__playwright__browser_click
Click on an element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| element | string | Yes | Human-readable element description |
| ref | string | Yes | Element reference from snapshot |
| button | "left" \| "right" \| "middle" | No | Mouse button |
| doubleClick | boolean | No | Perform double click |
| modifiers | string[] | No | Modifier keys: Alt, Control, Meta, Shift |

### mcp__playwright__browser_type
Type text into an element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| element | string | Yes | Human-readable element description |
| ref | string | Yes | Element reference from snapshot |
| text | string | Yes | Text to type |
| submit | boolean | No | Press Enter after typing |
| slowly | boolean | No | Type one character at a time |

### mcp__playwright__browser_hover
Hover over an element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| element | string | Yes | Human-readable element description |
| ref | string | Yes | Element reference from snapshot |

### mcp__playwright__browser_drag
Drag and drop between elements.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startElement | string | Yes | Source element description |
| startRef | string | Yes | Source element reference |
| endElement | string | Yes | Target element description |
| endRef | string | Yes | Target element reference |

---

## Form Tools

### mcp__playwright__browser_fill_form
Fill multiple form fields at once.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fields | array | Yes | Array of field objects |

Field object structure:
```json
{
  "name": "Field name",
  "type": "textbox" | "checkbox" | "radio" | "combobox" | "slider",
  "ref": "element reference",
  "value": "value to fill"
}
```

### mcp__playwright__browser_select_option
Select option in a dropdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| element | string | Yes | Element description |
| ref | string | Yes | Element reference |
| values | string[] | Yes | Values to select |

### mcp__playwright__browser_file_upload
Upload files.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| paths | string[] | No | Absolute file paths to upload |

---

## Keyboard Tools

### mcp__playwright__browser_press_key
Press a keyboard key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| key | string | Yes | Key name (e.g., "Enter", "ArrowLeft", "a") |

---

## Wait and Dialog Tools

### mcp__playwright__browser_wait_for
Wait for conditions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| text | string | No | Text to wait for appearance |
| textGone | string | No | Text to wait for disappearance |
| time | number | No | Seconds to wait |

### mcp__playwright__browser_handle_dialog
Handle browser dialogs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| accept | boolean | Yes | Accept or dismiss dialog |
| promptText | string | No | Text to enter in prompt dialog |

---

## Tab Management Tools

### mcp__playwright__browser_tabs
Manage browser tabs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | "list" \| "new" \| "close" \| "select" | Yes | Tab operation |
| index | number | No | Tab index for close/select |

### mcp__playwright__browser_resize
Resize browser window.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| width | number | Yes | Window width |
| height | number | Yes | Window height |

---

## Advanced Tools

### mcp__playwright__browser_evaluate
Execute JavaScript on the page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| function | string | Yes | JavaScript function to execute |
| ref | string | No | Element ref to pass to function |
| element | string | No | Element description |

### mcp__playwright__browser_run_code
Run Playwright code snippet.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | Playwright code to execute |

### mcp__playwright__browser_console_messages
Get console messages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| onlyErrors | boolean | No | Return only error messages |

### mcp__playwright__browser_network_requests
Get all network requests since page load. No parameters required.
