---
layout: home

hero:
  name: Secondary Terminal
  text: 사이드바, 터미널, AI 에이전트
  tagline: VS Code 사이드바에 상주하는 모든 기능을 갖춘 터미널. Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI AI 에이전트 감지 내장.
  image:
    src: /images/icon.png
    alt: Secondary Terminal
  actions:
    - theme: brand
      text: 시작하기
      link: /ko/guide/quick-start
    - theme: alt
      text: Marketplace에서 보기
      link: https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal

features:
  - icon: 🖥️
    title: 다중 터미널
    details: 최대 10개의 동시 터미널, 탭 관리, 드래그 앤 드롭 재정렬, 더블 클릭으로 이름 변경.
    link: /features/terminal-management
  - icon: ⚡
    title: 분할 뷰
    details: 수직/수평 분할과 드래그로 크기 조절. 패널 위치에 따른 동적 방향 조정.
    link: /features/split-view
  - icon: 🤖
    title: AI 에이전트 감지
    details: Claude Code, Copilot, Gemini (v0.28.2+), Codex CLI를 실시간으로 자동 감지.
    link: /features/ai-integration
  - icon: 💾
    title: 세션 영속성
    details: ANSI 색상 보존을 지원하는 자동 저장 및 복원. VS Code 재시작 후에도 이어서 작업.
    link: /features/session-persistence
  - icon: 🎨
    title: 완전한 커스터마이징
    details: 글꼴, 커서, 테마, 색상, 터미널 동작에 대한 90개 이상의 설정.
    link: /features/customization
---

## 왜 Secondary Terminal인가?

| | |
|---|---|
| **사이드바 네이티브** | 편집 중에도 터미널을 표시. 하단 패널 전환 불필요. |
| **AI 에이전트 인식** | Claude Code, Copilot, Gemini, Codex 자동 감지. 실시간 상태와 250fps 렌더링. |
| **풀 기능** | 분할 뷰, 세션 영속성, Shell 통합, 90+ 설정. 프로덕션 터미널. |

## 빠른 설치

```sh
code --install-extension s-hiraoku.vscode-sidebar-terminal
```
