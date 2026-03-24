---
layout: home

hero:
  name: Secondary Terminal
  text: Tu barra lateral, tu terminal, tus agentes IA
  tagline: Un terminal completo para la barra lateral de VS Code con deteccion integrada de agentes IA para Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI.
  image:
    src: /images/icon.png
    alt: Secondary Terminal
  actions:
    - theme: brand
      text: Empezar
      link: /es/guide/quick-start
    - theme: alt
      text: Ver en Marketplace
      link: https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal

features:
  - icon: 🖥️
    title: Multiples Terminales
    details: Hasta 10 terminales simultaneos con gestion de pestanas, arrastrar y soltar, y cambio de nombre.
    link: /features/terminal-management
  - icon: ⚡
    title: Vistas Divididas
    details: Division vertical y horizontal con redimensionamiento. Direccion dinamica segun ubicacion del panel.
    link: /features/split-view
  - icon: 🤖
    title: Deteccion de Agentes IA
    details: Deteccion automatica en tiempo real de Claude Code, Copilot, Gemini (v0.28.2+), Codex CLI.
    link: /features/ai-integration
  - icon: 💾
    title: Persistencia de Sesion
    details: Guardado y restauracion automatica con preservacion de colores ANSI.
    link: /features/session-persistence
  - icon: 🎨
    title: Totalmente Personalizable
    details: Mas de 90 configuraciones para fuentes, cursor, tema, colores y comportamiento del terminal.
    link: /features/customization
---

## Instalacion Rapida

```sh
code --install-extension s-hiraoku.vscode-sidebar-terminal
```
