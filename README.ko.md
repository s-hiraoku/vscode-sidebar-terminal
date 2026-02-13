# Secondary Terminal - VS Code 확장

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md) | **한국어** | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

사이드바, 터미널, AI 에이전트 -- 모두 한 곳에. VS Code 사이드바에 상주하는 완전한 기능의 터미널로, Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI의 AI 에이전트 감지 기능이 내장되어 있습니다.

<video src="resources/demo/demo.mov" controls muted loop playsinline poster="resources/readme-hero.png"></video>

## 왜 Secondary Terminal인가?

- **사이드바 네이티브 터미널** -- 편집하면서 터미널을 계속 표시. 하단 패널 전환이 필요 없습니다.
- **AI 에이전트 인식** -- Claude Code, Copilot, Gemini, Codex를 자동 감지. 실시간 연결 상태를 표시하고 AI 스트리밍 출력 렌더링을 최적화합니다(최대 250fps).
- **완전한 기능** -- 분할 뷰, 세션 지속성, 셸 통합, 터미널 내 검색, 명령 데코레이션, 90개 설정 항목. 장난감이 아닌 프로덕션 터미널입니다.

## 빠른 시작

1. **설치**: VS Code 확장 뷰에서 "Secondary Terminal" 검색
   - [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)(VSCodium, Gitpod) 또는 [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal): `code --install-extension s-hiraoku.vscode-sidebar-terminal`로도 설치 가능
2. **열기**: 활동 표시줄의 터미널 아이콘(ST) 클릭
3. **사용**: 기본 셸로 터미널이 시작됩니다. `claude`, `codex`, `gemini`, `gh copilot`을 실행하면 헤더에 AI 에이전트 상태가 표시됩니다.

## 기능 하이라이트

### AI 에이전트 워크플로용

|                      |                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **자동 감지**        | Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI의 실시간 상태 표시기                           |
| **파일 참조**        | `Cmd+Alt+L` / `Ctrl+Alt+L`로 현재 파일 경로 삽입; `Cmd+Alt+A` / `Ctrl+Alt+A`로 열린 모든 파일 삽입  |
| **이미지 붙여넣기**  | macOS에서 `Cmd+V`로 스크린샷을 Claude Code에 직접 붙여넣기                                           |
| **최적화 렌더링**    | AI 스트리밍 출력용 250fps 적응형 버퍼링                                                              |
| **세션 지속성**      | VS Code 재시작 후에도 터미널 상태 유지 -- 중단한 곳에서 계속                                         |
| **멀티 에이전트**    | 다른 터미널에서 다른 에이전트 실행, `Cmd+Alt+1..5` / `Alt+1..5`로 전환                               |

### 터미널 파워 기능

|                      |                                                                            |
| -------------------- | -------------------------------------------------------------------------- |
| **다중 터미널**      | 최대 5개 동시 터미널과 탭 관리(드래그 앤 드롭 정렬)                        |
| **분할 뷰**          | 수직/수평 분할과 드래그 크기 조절                                          |
| **세션 지속성**      | ANSI 색상 보존으로 자동 저장/복원(최대 3,000줄 스크롤백)                   |
| **셸 통합**          | 명령 상태 표시기, 작업 디렉토리 표시, 명령 기록                            |
| **터미널 내 검색**   | `Ctrl+F` / `Cmd+F` -- 정규식 지원 터미널 출력 검색                        |
| **명령 데코레이션**  | 명령 경계에서의 성공/오류/실행 중 시각적 표시기                            |
| **내비게이션 마크**  | `Cmd+Up/Down` / `Ctrl+Up/Down`으로 명령 간 이동                           |
| **스크롤백 압축**    | 대량 기록용 압축 저장소와 점진적 로딩                                      |
| **터미널 프로필**    | 플랫폼별 셸 프로필(bash, zsh, fish, PowerShell 등)                         |

### 개발자 경험

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **완전한 IME 지원**  | VS Code 표준 처리 방식의 일본어, 중국어, 한국어 입력               |
| **링크 감지**        | 파일 경로는 VS Code에서 열고, URL은 브라우저에서 열고, 이메일 감지 |
| **Alt+클릭**         | VS Code 표준 커서 위치 지정                                        |
| **마우스 추적**      | TUI 앱 지원(vim, htop, zellij), 자동 마우스 모드                   |
| **완전한 클립보드**  | Ctrl/Cmd+C/V, 이미지 붙여넣기 지원                                |
| **크로스 플랫폼**    | Windows, macOS, Linux -- 9개 플랫폼별 빌드                         |
| **접근성**           | 스크린 리더 지원                                                   |
| **디버그 패널**      | `Ctrl+Shift+D`로 실시간 모니터링                                   |

## 키보드 단축키

| 단축키                                         | 동작                                                 |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | 선택 텍스트 복사(선택 없으면 SIGINT 전송)           |
| `Cmd+V` / `Ctrl+V`                            | 붙여넣기(텍스트와 이미지)                           |
| `Shift+Enter` / `Option+Enter`                | 줄바꿈 삽입(Claude Code 여러 줄 프롬프트용)         |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | AI 에이전트용 현재 파일 참조 삽입                   |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | AI 에이전트용 열린 모든 파일 참조 삽입              |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | GitHub Copilot Chat 활성화                          |
| ``Ctrl+` ``                                   | Secondary Terminal 뷰 포커스                        |
| ``Ctrl+Shift+` ``                             | 새 터미널 생성                                      |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | 터미널 수직 분할                                    |
| `Cmd+K` / `Ctrl+K`                            | 터미널 지우기                                       |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | 이전/다음 명령으로 스크롤                           |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | 이전/다음 터미널 포커스                             |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | 인덱스로 터미널 포커스                              |
| `Cmd+R` / `Ctrl+R`                            | 최근 명령 실행                                      |
| `Cmd+A` / `Ctrl+A`                            | 터미널 전체 내용 선택                               |
| `Ctrl+Shift+D`                                | 디버그 패널 토글                                    |

> **Claude Code 팁**:
>
> - macOS에서 `Cmd+V`로 텍스트와 이미지(스크린샷) 모두를 Claude Code에 붙여넣기 가능
> - 여러 줄 프롬프트에는 `Shift+Enter` 또는 `Option+Enter`로 줄바꿈 삽입

## 설정

이 확장에는 90개의 설정이 있습니다. 가장 효과적인 커스터마이징 항목:

```json
{
  // 외관
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // AI 에이전트 통합
  "secondaryTerminal.enableCliAgentIntegration": true,

  // 세션 지속성
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // 분할 뷰
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // 셸 통합
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

VS Code 설정에서 `secondaryTerminal`을 검색하면 전체 설정 목록을 볼 수 있습니다. 모든 기본값은 [package.json](package.json)을 참조하세요.

## 성능

| 지표               | 값                                                      |
| ------------------ | ------------------------------------------------------- |
| **렌더링**         | WebGL(DOM 자동 폴백)                                    |
| **출력 버퍼링**    | 적응형 2-16ms 간격(AI 출력 시 최대 250fps)              |
| **스크롤백 복원**  | 1,000줄 ANSI 색상 보존, 1초 미만                        |
| **터미널 폐기**    | <100ms 정리 시간                                        |
| **빌드 크기**      | 확장 ~790 KiB + WebView ~1.5 MiB                        |

## 문제 해결

### 터미널이 시작되지 않음

- `secondaryTerminal.shell`이 PATH의 유효한 셸을 가리키는지 확인
- 명시적인 셸 경로 설정 시도

### AI 에이전트가 감지되지 않음

- `secondaryTerminal.enableCliAgentIntegration`이 `true`인지 확인
- 디버그 패널(`Ctrl+Shift+D`)에서 감지 로그 확인

### 성능 문제

- `secondaryTerminal.scrollback` 값 줄이기
- 디버그 패널에서 시스템 리소스 확인

### 세션이 복원되지 않음

- `secondaryTerminal.enablePersistentSessions`가 `true`인지 확인
- 데이터 손상 시 "Clear Corrupted Terminal History" 명령 사용

### TUI 표시 문제

- zellij 등의 앱에서는 마우스 추적이 자동으로 활성화됩니다
- 분할 모드에서 표시 문제가 발생하면 전체 화면 모드로 전환해 보세요

## 알려진 제한 사항

- **실행 중인 프로세스**: VS Code 재시작 시 장시간 실행 중인 프로세스가 종료됩니다(스크롤백은 보존). 프로세스 지속성이 필요하면 `tmux`/`screen`을 사용하세요.
- **플랫폼 지원**: node-pty 사전 빌드 바이너리 제한으로 Alpine Linux와 Linux armhf는 지원되지 않습니다.

## 개발

```bash
npm install && npm run compile    # 빌드
npm test                          # 4,000+ 단위 테스트
npm run test:e2e                  # E2E 테스트(Playwright)
npm run watch                     # 감시 모드
```

품질: TypeScript 엄격 모드, TDD 워크플로, 4,000+ 단위 테스트, Playwright E2E 커버리지, 9개 플랫폼 CI/CD 빌드.

## 개인정보 보호

이 확장은 VS Code의 텔레메트리 설정을 준수합니다. 익명 사용 메트릭(기능 사용량, 오류율)만 수집하며, 터미널 내용, 파일 경로, 개인 데이터는 절대 수집하지 않습니다.

비활성화하려면: VS Code 설정에서 `telemetry.telemetryLevel`을 `"off"`로 설정하세요. 자세한 내용은 [PRIVACY.md](PRIVACY.md)를 참조하세요.

## 기여

1. 저장소 포크
2. 기능 브랜치 생성: `git checkout -b feature/my-feature`
3. TDD 실천 방법 준수
4. 품질 검사 실행: `npm run pre-release:check`
5. 풀 리퀘스트 제출

오픈 태스크는 [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues)를 참조하세요.

## 링크

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [GitHub 저장소](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [변경 로그](CHANGELOG.md)
- [블로그 글(일본어)](https://zenn.dev/hiraoku/articles/0de654620028a0)

## 라이선스

MIT License - [LICENSE](LICENSE) 파일을 참조하세요.

---

**AI 에이전트와 함께 일하는 VS Code 개발자를 위해 만들어졌습니다**
