import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const es: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: 'Español',
  lang: 'es',
  link: '/es/',
  themeConfig: {
    nav: [
      { text: 'Guía', link: '/es/guide/installation' },
      { text: 'Características', link: '/es/features/terminal-management' },
      { text: 'Referencia', link: '/reference/keyboard-shortcuts' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: {
      '/es/guide/': [
        {
          text: 'Primeros Pasos',
          items: [
            { text: 'Instalación', link: '/es/guide/installation' },
            { text: 'Inicio Rápido', link: '/es/guide/quick-start' },
            { text: 'Uso con Agentes IA', link: '/es/guide/ai-agents' },
          ],
        },
      ],
    },
  },
}
