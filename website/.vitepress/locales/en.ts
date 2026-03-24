import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const en: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: 'English',
  lang: 'en-US',
  link: '/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/installation' },
      { text: 'Features', link: '/features/terminal-management' },
      { text: 'Reference', link: '/reference/keyboard-shortcuts' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Using with AI Agents', link: '/guide/ai-agents' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Terminal Management', link: '/features/terminal-management' },
            { text: 'Split View', link: '/features/split-view' },
            { text: 'AI Integration', link: '/features/ai-integration' },
            { text: 'Session Persistence', link: '/features/session-persistence' },
            { text: 'Shell Integration', link: '/features/shell-integration' },
            { text: 'Input & Interaction', link: '/features/input-interaction' },
            { text: 'Navigation', link: '/features/navigation' },
            { text: 'Link Detection', link: '/features/link-detection' },
            { text: 'Customization', link: '/features/customization' },
            { text: 'Accessibility', link: '/features/accessibility' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
            { text: 'Settings', link: '/reference/settings' },
            { text: 'Commands', link: '/reference/commands' },
            { text: 'VS Code Comparison', link: '/reference/comparison' },
          ],
        },
      ],
      '/dev/': [
        {
          text: 'Developer Guide',
          items: [
            { text: 'Architecture', link: '/dev/architecture' },
            { text: 'Testing', link: '/dev/testing' },
            { text: 'API Reference', link: '/dev/api' },
          ],
        },
      ],
    },
  },
}
