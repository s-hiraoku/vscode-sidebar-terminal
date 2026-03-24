---
title: Customization
---

# Customization

Secondary Terminal exposes more than 90 settings, so you can tune the terminal to match your editor, your accessibility needs, and the density of your workflow. The most important areas are typography, cursor behavior, spacing, theme control, ANSI rendering, contrast, active terminal borders, and the webview header UI.

## Main Customization Areas

| Area                  | Examples                                    |
| --------------------- | ------------------------------------------- |
| Font                  | Family, size, weight, bold weight           |
| Cursor                | Style, blink, width                         |
| Spacing               | Line height, letter spacing, scrollback     |
| Theme                 | Auto, dark, light                           |
| ANSI rendering        | Bright bold colors, full ANSI support       |
| Accessibility visuals | Minimum contrast ratio                      |
| Focus indicators      | Active terminal border mode                 |
| Header UI             | Show or hide header, title text, icon sizes |

## Typography

| Setting                            | Default       | Description                      |
| ---------------------------------- | ------------- | -------------------------------- |
| `secondaryTerminal.fontFamily`     | `"monospace"` | Terminal font family.            |
| `secondaryTerminal.fontSize`       | `12`          | Font size in pixels.             |
| `secondaryTerminal.fontWeight`     | `"normal"`    | Font weight for standard text.   |
| `secondaryTerminal.fontWeightBold` | `"bold"`      | Font weight for bold text.       |
| `secondaryTerminal.lineHeight`     | `1`           | Line-height multiplier.          |
| `secondaryTerminal.letterSpacing`  | `0`           | Extra pixels between characters. |

## Cursor and Input Appearance

| Setting                                           | Default   | Description                             |
| ------------------------------------------------- | --------- | --------------------------------------- |
| `secondaryTerminal.cursorStyle`                   | `"block"` | Cursor shape: block, underline, or bar. |
| `secondaryTerminal.cursorBlink`                   | `true`    | Enables cursor blinking.                |
| `secondaryTerminal.cursorWidth`                   | `1`       | Width used when cursor style is `bar`.  |
| `secondaryTerminal.features.vscodeStandardCursor` | `true`    | Uses VS Code-like cursor behavior.      |

## Theme and Color Controls

| Setting                                        | Default  | Description                                       |
| ---------------------------------------------- | -------- | ------------------------------------------------- |
| `secondaryTerminal.theme`                      | `"auto"` | Follows VS Code or forces dark/light.             |
| `secondaryTerminal.drawBoldTextInBrightColors` | `true`   | Uses bright ANSI variants for bold text.          |
| `secondaryTerminal.minimumContrastRatio`       | `1`      | Adjusts foreground cells to meet a target ratio.  |
| `secondaryTerminal.features.fullANSISupport`   | `true`   | Enables richer ANSI color and formatting support. |

The `minimumContrastRatio` setting is important if you want stricter accessibility or use a low-contrast editor theme. A value of `4.5` targets WCAG AA minimum contrast.

## Border and Header UI

| Setting                               | Default          | Description                                        |
| ------------------------------------- | ---------------- | -------------------------------------------------- |
| `secondaryTerminal.activeBorderMode`  | `"multipleOnly"` | Controls when the active terminal border is shown. |
| `secondaryTerminal.showWebViewHeader` | `true`           | Shows or hides the webview header.                 |
| `secondaryTerminal.webViewTitle`      | `"Terminal"`     | Custom title text in the header.                   |
| `secondaryTerminal.headerFontSize`    | `14`             | Header title font size.                            |
| `secondaryTerminal.headerIconSize`    | `20`             | Terminal icon size in the header.                  |
| `secondaryTerminal.showSampleIcons`   | `true`           | Shows extra sample icons in the header.            |
| `secondaryTerminal.sampleIconSize`    | `16`             | Size of sample icons.                              |
| `secondaryTerminal.sampleIconOpacity` | `0.4`            | Opacity for sample icons.                          |

## Scrollback and Density

| Setting                                         | Default | Description                          |
| ----------------------------------------------- | ------- | ------------------------------------ |
| `secondaryTerminal.scrollback`                  | `2000`  | In-memory terminal scrollback size.  |
| `secondaryTerminal.persistentSessionScrollback` | `1000`  | Restored saved scrollback lines.     |
| `secondaryTerminal.maxSplitTerminals`           | `10`    | Max visible terminals in split view. |
| `secondaryTerminal.minTerminalHeight`           | `100`   | Minimum split terminal height.       |

## Example Theme Configuration

```json
{
  "secondaryTerminal.fontFamily": "JetBrains Mono",
  "secondaryTerminal.fontSize": 13,
  "secondaryTerminal.cursorStyle": "bar",
  "secondaryTerminal.cursorWidth": 2,
  "secondaryTerminal.theme": "auto",
  "secondaryTerminal.minimumContrastRatio": 4.5,
  "secondaryTerminal.activeBorderMode": "always",
  "secondaryTerminal.showWebViewHeader": true,
  "secondaryTerminal.webViewTitle": "Workspace Terminal"
}
```

## Suggested Starting Points

| Goal                          | Suggested changes                                           |
| ----------------------------- | ----------------------------------------------------------- |
| Match the editor              | Keep theme on `auto` and use the same font family.          |
| Improve readability           | Raise `fontSize`, `lineHeight`, and `minimumContrastRatio`. |
| Fit more content              | Lower `fontSize` slightly and keep `lineHeight` near `1`.   |
| Highlight the active terminal | Set `activeBorderMode` to `"always"`.                       |

## Related Pages

- [Accessibility](/features/accessibility)
- [Session Persistence](/features/session-persistence)
- [Settings Reference](/reference/settings)
- [Quick Start](/guide/quick-start)
