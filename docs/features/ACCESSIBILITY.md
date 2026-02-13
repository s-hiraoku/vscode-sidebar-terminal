# Accessibility Implementation

## Overview

This document describes the accessibility features implemented in VSCode Sidebar Terminal to achieve WCAG 2.1 Level AA compliance. The implementation focuses on five key areas:

1. ARIA Attributes
2. Keyboard Navigation
3. Screen Reader Support
4. Color Contrast
5. Automated Testing

## WCAG AA Compliance

The extension has been enhanced to meet [Web Content Accessibility Guidelines (WCAG) 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa) standards.

### Success Criteria Met

- **1.1.1 Non-text Content (Level A)**: All images, icons, and non-text elements have appropriate text alternatives
- **1.3.1 Info and Relationships (Level A)**: Proper semantic HTML and ARIA roles communicate structure
- **1.4.3 Contrast (Level AA)**: Text meets minimum 4.5:1 contrast ratio
- **2.1.1 Keyboard (Level A)**: All functionality available via keyboard
- **2.1.2 No Keyboard Trap (Level A)**: Focus can move away from all components
- **2.4.3 Focus Order (Level A)**: Logical tab order maintained
- **2.4.6 Headings and Labels (Level AA)**: Descriptive headings and labels provided
- **2.4.7 Focus Visible (Level AA)**: Keyboard focus indicator visible
- **3.2.4 Consistent Identification (Level AA)**: Components identified consistently
- **4.1.2 Name, Role, Value (Level A)**: All UI components have accessible names and roles
- **4.1.3 Status Messages (Level AA)**: Screen reader announcements for status changes

## Implementation Details

### 1. ARIA Attributes (50+ attributes)

#### Terminal Tab List (`TerminalTabList.ts`)
- `role="navigation"` - Marks container as navigation landmark
- `role="tablist"` - Identifies tab group
- `role="tab"` - Individual tab elements
- `aria-selected` - Indicates selected tab
- `aria-label` - Descriptive labels for tabs
- `aria-controls` - Links tabs to their panels
- `aria-hidden="true"` - Hides decorative icons
- `tabindex` - Manages keyboard focus (0 for active, -1 for inactive)

#### Settings Panel (`SettingsPanel.ts`)
- `role="dialog"` - Modal dialog role
- `aria-modal="true"` - Prevents interaction with background
- `aria-labelledby` - References dialog title
- `role="group"` - Groups related controls
- `aria-label` - Descriptive labels for buttons and groups

#### Profile Selector (`ProfileSelector.ts`)
- `role="dialog"` - Dialog modal
- `role="listbox"` - List selection component
- `role="option"` - Individual profile items
- `aria-selected` - Indicates selected profile
- `aria-label` - Descriptive labels
- `tabindex="0"` - Makes items focusable

#### WebView HTML (`WebViewHtmlGenerationService.ts`)
- `role="main"` - Main content landmark
- `role="status"` - Screen reader announcement regions
- `role="alert"` - Urgent announcements
- `aria-live="polite"` - Polite announcements
- `aria-live="assertive"` - Urgent announcements
- `aria-atomic="true"` - Announce entire region content

### 2. Keyboard Navigation

All interactive elements support keyboard navigation:

#### Global Shortcuts
- **Tab** - Navigate forward through focusable elements
- **Shift+Tab** - Navigate backward
- **Enter** - Activate buttons and links
- **Space** - Activate buttons and toggle controls
- **Escape** - Close dialogs and panels

#### Terminal Tabs
- **Arrow Left/Right** - Navigate between tabs
- **Home** - First tab
- **End** - Last tab
- **Delete/Backspace** - Close closable tab

#### Profile Selector
- **Arrow Up/Down** - Navigate profiles
- **Enter** - Select profile
- **Escape** - Cancel selection
- **Type** - Filter profiles

#### Settings Panel
- **Tab** - Navigate controls
- **Enter** - Activate buttons
- **Escape** - Close panel

#### Panel Navigation Mode (Zellij-style)
Provides a high-efficiency alternative for switching between split terminals without leaving the home row:
- **Cmd+P / Ctrl+P** - Toggle navigation mode
- **h / j / k / l** - Switch terminal (vim-style)
- **Arrow keys** - Switch terminal
- **Escape** - Exit mode

### 3. Screen Reader Support

#### Accessibility Utilities (`AccessibilityUtils.ts`)

##### ScreenReaderAnnouncer
```typescript
// Initialize announcement regions
ScreenReaderAnnouncer.initialize();

// Announce messages
ScreenReaderAnnouncer.announce('Terminal created', 'polite');
ScreenReaderAnnouncer.announce('Error occurred', 'assertive');
```

##### FocusManager
```typescript
// Get focusable elements
const elements = FocusManager.getFocusableElements(container);

// Trap focus in dialog
const cleanup = FocusManager.trapFocus(dialog);

// Set focus with scroll
FocusManager.setFocus(element, true);
```

##### AriaHelper
```typescript
// Set ARIA attributes
AriaHelper.setAttributes(element, {
  'aria-label': 'Terminal tabs',
  'aria-required': 'true'
});

// Manage state
AriaHelper.setExpanded(element, true);
AriaHelper.setSelected(element, true);
AriaHelper.setDisabled(element, false);
```

##### KeyboardNavigationHelper
```typescript
// Arrow key navigation
KeyboardNavigationHelper.handleArrowKeys(
  event,
  items,
  currentIndex,
  (newIndex) => selectItem(newIndex)
);

// Setup shortcuts
const cleanup = KeyboardNavigationHelper.setupShortcut(
  element,
  ['Enter', ' '],
  () => activateItem(),
  'Item activated'
);
```

#### Live Regions

Two live regions are available for screen reader announcements:

1. **Polite** (`#sr-status`) - Non-urgent notifications
2. **Assertive** (`#sr-alert`) - Urgent alerts

### 4. Color Contrast

All color combinations meet WCAG AA standards (4.5:1 ratio):

#### Utilities
```typescript
// Check contrast
const ratio = ColorContrastValidator.getContrastRatio('#fff', '#000');
const meetsAA = ColorContrastValidator.meetsWCAG_AA('#fff', '#000'); // true
const meetsAAA = ColorContrastValidator.meetsWCAG_AAA('#fff', '#000'); // true
```

#### VSCode Theme Colors
The extension uses VSCode theme colors that are already accessibility-compliant:
- `--vscode-foreground` / `--vscode-editor-background`
- `--vscode-button-foreground` / `--vscode-button-background`
- `--vscode-focusBorder` (2px outline for focus indication)

#### Focus Indicators
```css
*:focus-visible {
  outline: 2px solid var(--vscode-focusBorder, #007acc);
  outline-offset: 2px;
}
```

### 5. Automated Testing

#### Axe-core Integration

Comprehensive accessibility tests using axe-core:

```typescript
// WCAG AA compliance test
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();

expect(results.violations).toEqual([]);
```

#### Test Coverage

The test suite (`wcag-compliance.spec.ts`) includes:

1. **Critical violations** - No critical accessibility issues
2. **ARIA attributes** - Proper implementation on all elements
3. **Keyboard navigation** - Full keyboard support
4. **Color contrast** - Sufficient contrast ratios
5. **Heading hierarchy** - Proper heading structure
6. **Form labels** - All inputs labeled
7. **Semantic HTML** - Proper use of HTML5 elements
8. **Live regions** - Screen reader announcements
9. **Tab order** - Logical navigation order
10. **Dialog/Modal** - Proper ARIA dialog implementation
11. **Lists** - Proper list markup
12. **Landmarks** - Proper region/landmark usage
13. **Image alt text** - Alternative text for images
14. **ARIA count** - Minimum 50 ARIA attributes

#### Running Tests

```bash
# Run all accessibility tests
npm run test:e2e -- accessibility

# Run specific test
npm run test:e2e -- accessibility/wcag-compliance.spec.ts

# Run with debug output
npm run test:e2e -- accessibility --debug
```

## Usage Examples

### Adding Screen Reader Announcements

```typescript
import { ScreenReaderAnnouncer } from './utils/AccessibilityUtils';

// Initialize (done automatically in main.ts)
ScreenReaderAnnouncer.initialize();

// Announce terminal creation
ScreenReaderAnnouncer.announce('New terminal created', 'polite');

// Announce errors
ScreenReaderAnnouncer.announce('Failed to create terminal', 'assertive');

// Clear announcements
ScreenReaderAnnouncer.clear();
```

### Managing Focus in Dialogs

```typescript
import { FocusManager } from './utils/AccessibilityUtils';

class MyDialog {
  private focusTrap?: () => void;

  show() {
    // Trap focus within dialog
    this.focusTrap = FocusManager.trapFocus(this.dialogElement);
  }

  hide() {
    // Release focus trap
    this.focusTrap?.();
  }
}
```

### Setting ARIA Attributes

```typescript
import { AriaHelper } from './utils/AccessibilityUtils';

// Set multiple attributes
AriaHelper.setAttributes(button, {
  'aria-label': 'Close dialog',
  'aria-pressed': 'false'
});

// Update state
AriaHelper.setExpanded(accordion, true);
AriaHelper.setSelected(tab, true);
```

### Implementing Keyboard Navigation

```typescript
import { KeyboardNavigationHelper } from './utils/AccessibilityUtils';

// Arrow key navigation
this.container.addEventListener('keydown', (e) => {
  KeyboardNavigationHelper.handleArrowKeys(
    e,
    this.items,
    this.currentIndex,
    (newIndex) => {
      this.currentIndex = newIndex;
      this.selectItem(newIndex);
    }
  );
});

// Custom shortcuts
const cleanup = KeyboardNavigationHelper.setupShortcut(
  this.element,
  ['Enter', ' '],
  () => this.activate(),
  'Terminal activated'
);
```

## Screen Reader Testing

The extension has been tested with:

- **NVDA** (Windows) - [Download](https://www.nvaccess.org/download/)
- **JAWS** (Windows) - [Download](https://www.freedomscientific.com/products/software/jaws/)
- **VoiceOver** (macOS) - Built-in (Cmd+F5 to enable)
- **Narrator** (Windows) - Built-in (Win+Ctrl+Enter to enable)

### Testing Procedure

1. Enable screen reader
2. Navigate to terminal view
3. Use Tab key to navigate
4. Verify announcements for:
   - Tab selection
   - Terminal creation/deletion
   - Error messages
   - Status updates
5. Test keyboard shortcuts
6. Verify focus indicators are visible

## Compliance Checklist

- [x] 50+ ARIA attributes implemented
- [x] Complete keyboard navigation
- [x] Screen reader announcements
- [x] Color contrast meets 4.5:1 ratio
- [x] Focus indicators visible
- [x] Semantic HTML structure
- [x] Automated testing with axe-core
- [x] Manual testing with screen readers
- [x] Documentation complete

## Future Improvements

1. **High Contrast Mode** - Enhanced support for high contrast themes
2. **Reduced Motion** - Respect prefers-reduced-motion setting
3. **Text Scaling** - Better support for large text sizes
4. **Voice Control** - Enhanced support for voice navigation
5. **Mobile Accessibility** - Touch-optimized keyboard alternatives

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [VS Code Accessibility](https://code.visualstudio.com/docs/editor/accessibility)

## Support

If you encounter accessibility issues:

1. Check this documentation
2. Run automated tests: `npm run test:e2e -- accessibility`
3. Open an issue with:
   - Screen reader used
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/recordings if applicable

## License

This accessibility implementation follows the same license as the main project.
