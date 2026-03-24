import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const fr: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: 'Français',
  lang: 'fr',
  link: '/fr/',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/fr/guide/installation' },
      { text: 'Fonctionnalités', link: '/fr/features/terminal-management' },
      { text: 'Référence', link: '/reference/keyboard-shortcuts' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: {
      '/fr/guide/': [
        {
          text: 'Démarrage',
          items: [
            { text: 'Installation', link: '/fr/guide/installation' },
            { text: 'Démarrage Rapide', link: '/fr/guide/quick-start' },
            { text: 'Utilisation avec les Agents IA', link: '/fr/guide/ai-agents' },
          ],
        },
      ],
    },
  },
}
