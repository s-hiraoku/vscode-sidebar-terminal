---
title: Accessibility
---

# Accessibility

Secondary Terminal includes accessibility features aimed at making a terminal-heavy workflow usable with assistive technology and keyboard-only interaction. The implementation focuses on screen reader support, WCAG-aware contrast handling, reliable focus behavior, and support for high-contrast themes in VS Code.

## Accessibility Goals

| Area                 | What Secondary Terminal provides                                  |
| -------------------- | ----------------------------------------------------------------- |
| Screen readers       | Dedicated support and live region announcements.                  |
| Keyboard-only use    | Navigable tabs, dialogs, controls, and terminal management flows. |
| Contrast             | Configurable minimum contrast ratio for terminal cells.           |
| High-contrast themes | Integration with VS Code theme variables and focus indicators.    |

## Main Settings

| Setting                                               | Default  | Description                                                       |
| ----------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `secondaryTerminal.accessibility.screenReaderSupport` | `true`   | Enables enhanced screen reader support.                           |
| `secondaryTerminal.minimumContrastRatio`              | `1`      | Raises terminal foreground contrast when needed.                  |
| `secondaryTerminal.theme`                             | `"auto"` | Follows the active VS Code theme, including high-contrast themes. |

If you want a stronger accessibility baseline, set `secondaryTerminal.minimumContrastRatio` to `4.5` for WCAG AA minimum contrast or higher if your environment requires it.

## Keyboard-Only Navigation

Secondary Terminal keeps keyboard support across the major UI surfaces:

| Interaction             | Keys                                   |
| ----------------------- | -------------------------------------- |
| Move focus              | `Tab` and `Shift+Tab`                  |
| Activate controls       | `Enter` or `Space`                     |
| Close dialogs and modes | `Escape`                               |
| Move between tabs       | Arrow keys, `Home`, `End`              |
| Focus terminal view     | ``Ctrl+` ``                            |
| Search terminal output  | `Ctrl+F` / `Cmd+F`                     |
| Panel navigation mode   | `Ctrl+P`, then `h/j/k/l` or arrow keys |

This matters if you work without a mouse or rely on predictable keyboard sequences for speed and accessibility.

## Screen Reader Support

The extension includes explicit announcement regions so status changes, dialog actions, and other updates can be communicated more clearly to assistive technology.

| Support area     | Example                                                |
| ---------------- | ------------------------------------------------------ |
| Status messages  | Terminal creation or state updates announced politely. |
| Alerts           | Urgent errors can use assertive announcements.         |
| Dialog semantics | Settings and profile selectors use dialog-style roles. |
| Tab semantics    | Terminal tabs expose tab and tablist roles.            |

## Contrast and Theme Support

Secondary Terminal uses VS Code theme variables where possible, which helps it stay aligned with themes that already target accessibility. The `secondaryTerminal.minimumContrastRatio` setting can then raise the contrast floor for terminal text when theme colors are too subtle.

| Value | Meaning                                       |
| ----- | --------------------------------------------- |
| `1`   | Use normal theme colors without adjustment.   |
| `4.5` | Target WCAG AA minimum contrast.              |
| `7`   | Target WCAG AAA contrast.                     |
| `21`  | Force the maximum theoretical contrast ratio. |

Example accessibility-focused configuration:

```json
{
  "secondaryTerminal.accessibility.screenReaderSupport": true,
  "secondaryTerminal.minimumContrastRatio": 4.5,
  "secondaryTerminal.theme": "auto"
}
```

## High-Contrast Themes

Because the extension follows VS Code theme variables, it works better with built-in and custom high-contrast themes than terminals that hardcode their own visual palette. Keep the theme on `auto` if you want Secondary Terminal to follow the rest of the editor automatically.

## Accessibility in Practice

This feature set is especially useful when:

- you use a screen reader for terminal context
- you need visible focus indicators at all times
- you work entirely from the keyboard
- your team requires WCAG-aware UI defaults

## Related Pages

- [Customization](/en/features/customization)
- [Navigation](/en/features/navigation)
- [Quick Start](/en/guide/quick-start)
- [Settings Reference](/en/reference/settings)
