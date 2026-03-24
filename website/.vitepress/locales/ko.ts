import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const ko: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: '한국어',
  lang: 'ko',
  link: '/ko/',
  themeConfig: {
    nav: [
      { text: '가이드', link: '/ko/guide/installation' },
      { text: '기능', link: '/ko/features/terminal-management' },
      { text: '참조', link: '/reference/keyboard-shortcuts' },
      { text: '변경 이력', link: '/changelog' },
    ],
    sidebar: {
      '/ko/guide/': [
        {
          text: '시작하기',
          items: [
            { text: '설치', link: '/ko/guide/installation' },
            { text: '빠른 시작', link: '/ko/guide/quick-start' },
            { text: 'AI 에이전트와 함께 사용', link: '/ko/guide/ai-agents' },
          ],
        },
      ],
    },
  },
}
