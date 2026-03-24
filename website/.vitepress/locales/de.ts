import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const de: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: 'Deutsch',
  lang: 'de',
  link: '/de/',
  themeConfig: {
    nav: [
      { text: 'Anleitung', link: '/de/guide/installation' },
      { text: 'Funktionen', link: '/de/features/terminal-management' },
      { text: 'Referenz', link: '/reference/keyboard-shortcuts' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: {
      '/de/guide/': [
        {
          text: 'Erste Schritte',
          items: [
            { text: 'Installation', link: '/de/guide/installation' },
            { text: 'Schnellstart', link: '/de/guide/quick-start' },
            { text: 'Mit KI-Agenten verwenden', link: '/de/guide/ai-agents' },
          ],
        },
      ],
    },
  },
}
