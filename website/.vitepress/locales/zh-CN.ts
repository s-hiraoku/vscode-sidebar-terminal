import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const zhCN: LocaleSpecificConfig<DefaultTheme.Config> & { label: string; link: string } = {
  label: '简体中文',
  lang: 'zh-CN',
  link: '/zh-CN/',
  themeConfig: {
    nav: [
      { text: '指南', link: '/zh-CN/guide/installation' },
      { text: '功能', link: '/zh-CN/features/terminal-management' },
      { text: '参考', link: '/reference/keyboard-shortcuts' },
      { text: '更新日志', link: '/changelog' },
    ],
    sidebar: {
      '/zh-CN/guide/': [
        {
          text: '入门',
          items: [
            { text: '安装', link: '/zh-CN/guide/installation' },
            { text: '快速开始', link: '/zh-CN/guide/quick-start' },
            { text: '与AI代理一起使用', link: '/zh-CN/guide/ai-agents' },
          ],
        },
      ],
      '/zh-CN/features/': [
        {
          text: '功能',
          items: [
            { text: '终端管理', link: '/zh-CN/features/terminal-management' },
            { text: '分屏视图', link: '/zh-CN/features/split-view' },
            { text: 'AI集成', link: '/zh-CN/features/ai-integration' },
            { text: '会话持久化', link: '/zh-CN/features/session-persistence' },
            { text: 'Shell集成', link: '/zh-CN/features/shell-integration' },
            { text: '输入与交互', link: '/zh-CN/features/input-interaction' },
            { text: '导航', link: '/zh-CN/features/navigation' },
            { text: '链接检测', link: '/zh-CN/features/link-detection' },
            { text: '自定义', link: '/zh-CN/features/customization' },
            { text: '无障碍', link: '/zh-CN/features/accessibility' },
          ],
        },
      ],
    },
  },
}
