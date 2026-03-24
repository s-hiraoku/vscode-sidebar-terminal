import { defineConfig } from 'vitepress'
import { en } from './locales/en'
import { ja } from './locales/ja'
import { zhCN } from './locales/zh-CN'
import { ko } from './locales/ko'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { de } from './locales/de'

export default defineConfig({
  title: 'Secondary Terminal',
  description: 'A full-featured terminal for VS Code sidebar with AI agent detection',
  base: '/vscode-sidebar-terminal/',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/vscode-sidebar-terminal/images/icon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Secondary Terminal - VS Code Extension' }],
    ['meta', { property: 'og:description', content: 'A full-featured terminal for VS Code sidebar with AI agent detection' }],
    ['meta', { property: 'og:image', content: '/vscode-sidebar-terminal/images/hero.png' }],
  ],

  locales: {
    root: { ...en, link: '/' },
    ja: { ...ja },
    'zh-CN': { ...zhCN },
    ko: { ...ko },
    es: { ...es },
    fr: { ...fr },
    de: { ...de },
  },

  themeConfig: {
    logo: '/images/icon.png',

    socialLinks: [
      { icon: 'github', link: 'https://github.com/s-hiraoku/vscode-sidebar-terminal' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: `Copyright 2025-${new Date().getFullYear()} s-hiraoku`,
    },

    editLink: {
      pattern: 'https://github.com/s-hiraoku/vscode-sidebar-terminal/edit/main/website/:path',
      text: 'Edit this page on GitHub',
    },
  },

  lastUpdated: true,
})
