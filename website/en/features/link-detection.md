---
title: Link Detection
---

# Link Detection

Link detection turns terminal output into something you can act on directly. Secondary Terminal can recognize file paths, web URLs, and email addresses, then make them clickable so you can move from terminal output to the right destination without copy-pasting.

## Supported Link Types

| Link type       | What happens when clicked                      |
| --------------- | ---------------------------------------------- |
| File paths      | Opens the target file in the VS Code editor.   |
| Web URLs        | Opens the address in your browser.             |
| Email addresses | Detects mail-style links from terminal output. |

This is particularly useful for compiler errors, test failures, generated local URLs, and logs that include contact or service details.

## Settings

| Setting                                    | Default | Description                                     |
| ------------------------------------------ | ------- | ----------------------------------------------- |
| `secondaryTerminal.links.enabled`          | `true`  | Master switch for automatic link detection.     |
| `secondaryTerminal.links.detectFileLinks`  | `true`  | Detects and highlights file paths.              |
| `secondaryTerminal.links.detectWebLinks`   | `true`  | Detects and highlights web URLs.                |
| `secondaryTerminal.links.detectEmailLinks` | `true`  | Detects and highlights email addresses.         |
| `secondaryTerminal.links.maxLinksPerLine`  | `10`    | Limits detection work per line for performance. |

## Typical Examples

```text
src/server.ts:42:13
http://localhost:5173
support@example.com
```

In practice, this means a test failure that prints `src/server.ts:42:13` can become an editor jump instead of a manual search, and a dev server URL can open in the browser with a click.

## Example Configuration

```json
{
  "secondaryTerminal.links.enabled": true,
  "secondaryTerminal.links.detectFileLinks": true,
  "secondaryTerminal.links.detectWebLinks": true,
  "secondaryTerminal.links.detectEmailLinks": true,
  "secondaryTerminal.links.maxLinksPerLine": 10
}
```

## Performance Considerations

Link detection is enabled by default, but `secondaryTerminal.links.maxLinksPerLine` is there for a reason. Very noisy logs can contain many URL-like fragments, so the extension caps detection work per line to keep the terminal responsive.

If you work with huge generated logs, reduce the maximum. If you mostly work with normal build and test output, the default value is usually a good balance.

## Troubleshooting

| Problem                              | What to check                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| File paths are not clickable         | Confirm `secondaryTerminal.links.enabled` and `secondaryTerminal.links.detectFileLinks` are both enabled. |
| URLs are not opening                 | Confirm `secondaryTerminal.links.detectWebLinks` is enabled and the output contains a valid URL.          |
| Too many highlighted items           | Lower `secondaryTerminal.links.maxLinksPerLine` for noisy output.                                         |
| Email addresses should not be linked | Disable `secondaryTerminal.links.detectEmailLinks`.                                                       |

## Workflow Tips

If you rely heavily on compiler output, keep file link detection enabled even if you disable web or email detection. That preserves the most valuable editor jump behavior without spending work on link types you do not need.

For web-heavy projects, leave URL detection on so local dev servers and preview links stay one click away. This is especially helpful when one terminal is running a frontend server and another is running tests or an AI agent.

## Good Use Cases

| Scenario             | Benefit                                             |
| -------------------- | --------------------------------------------------- |
| Build failures       | Jump directly to the referenced file and line.      |
| Local dev servers    | Open localhost URLs without copying them first.     |
| CI or service output | Follow web dashboards or service endpoints quickly. |
| Shared logs          | Click email addresses or contact entries directly.  |

## Related Pages

- [Navigation](/en/features/navigation)
- [Shell Integration](/en/features/shell-integration)
- [Quick Start](/en/guide/quick-start)
- [Settings Reference](/en/reference/settings)
