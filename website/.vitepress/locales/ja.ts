import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const ja: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: '日本語',
  lang: 'ja',
  link: '/ja/',
  themeConfig: {
    nav: [
      { text: 'ガイド', link: '/ja/guide/installation' },
      { text: '機能', link: '/ja/features/terminal-management' },
      { text: 'リファレンス', link: '/reference/keyboard-shortcuts' },
      { text: '変更履歴', link: '/changelog' },
    ],
    sidebar: {
      '/ja/guide/': [
        {
          text: 'はじめに',
          items: [
            { text: 'インストール', link: '/ja/guide/installation' },
            { text: 'クイックスタート', link: '/ja/guide/quick-start' },
            { text: 'AIエージェントと使う', link: '/ja/guide/ai-agents' },
          ],
        },
      ],
      '/ja/features/': [
        {
          text: '機能',
          items: [
            { text: 'ターミナル管理', link: '/ja/features/terminal-management' },
            { text: '分割表示', link: '/ja/features/split-view' },
            { text: 'AI連携', link: '/ja/features/ai-integration' },
            { text: 'セッション永続化', link: '/ja/features/session-persistence' },
            { text: 'シェル統合', link: '/ja/features/shell-integration' },
            { text: '入力・操作', link: '/ja/features/input-interaction' },
            { text: 'ナビゲーション', link: '/ja/features/navigation' },
            { text: 'リンク検出', link: '/ja/features/link-detection' },
            { text: 'カスタマイズ', link: '/ja/features/customization' },
            { text: 'アクセシビリティ', link: '/ja/features/accessibility' },
          ],
        },
      ],
    },
  },
}
