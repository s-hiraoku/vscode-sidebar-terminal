# Secondary Terminal - Extensión de VS Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md) | [한국어](README.ko.md) | **Español** | [Français](README.fr.md) | [Deutsch](README.de.md)

Tu barra lateral, tu terminal, tus agentes de IA — todo en un solo lugar. Un terminal completo que vive en la barra lateral de VS Code, con detección integrada de agentes de IA para Claude Code, Codex CLI, Gemini CLI y GitHub Copilot CLI.

<video src="resources/demo/demo.mov" controls muted loop playsinline poster="resources/readme-hero.png"></video>

## ¿Por qué Secondary Terminal?

- **Terminal nativo en la barra lateral** — Mantén tu terminal visible mientras editas. No más alternar el panel inferior.
- **Consciente de agentes de IA** — Detecta automáticamente Claude Code, Copilot, Gemini y Codex. Muestra el estado de conexión en tiempo real y optimiza el renderizado para salida de streaming de IA (hasta 250 fps).
- **Completo** — Vistas divididas, persistencia de sesiones, integración de shell, búsqueda en terminal, decoraciones de comandos, 90 configuraciones personalizables. No es un juguete — es un terminal de producción.

## Inicio Rápido

1. **Instalar**: Busca "Secondary Terminal" en la vista de Extensiones de VS Code
   - También disponible en [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) (VSCodium, Gitpod) y vía [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal): `code --install-extension s-hiraoku.vscode-sidebar-terminal`
2. **Abrir**: Haz clic en el icono de terminal (ST) en la barra de actividades
3. **Usar**: Se abre un terminal con tu shell predeterminado. Ejecuta `claude`, `codex`, `gemini` o `gh copilot` y observa cómo aparece el estado del agente de IA en el encabezado.

## Características Destacadas

### Para Flujos de Trabajo con Agentes de IA

|                              |                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Detección automática**     | Indicadores de estado en tiempo real para Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI         |
| **Referencias de archivos**  | `Cmd+Alt+L` / `Ctrl+Alt+L` inserta la ruta del archivo actual; `Cmd+Alt+A` / `Ctrl+Alt+A` inserta todos los archivos abiertos |
| **Pegado de imágenes**       | `Cmd+V` en macOS pega capturas de pantalla directamente en Claude Code                                   |
| **Renderizado optimizado**   | Buffering adaptativo de 250 fps para salida de streaming de IA                                            |
| **Persistencia de sesiones** | El estado del terminal sobrevive a los reinicios de VS Code —continúa donde lo dejaste                 |
| **Multi-agente**             | Ejecuta diferentes agentes en diferentes terminales, cambia con `Cmd+Alt+1..5` / `Alt+1..5`             |

### Funciones Avanzadas del Terminal

|                                 |                                                                            |
| ------------------------------- | -------------------------------------------------------------------------- |
| **Múltiples terminales**        | Hasta 5 terminales simultáneos con gestión de pestañas (arrastrar y soltar)|
| **Vistas divididas**            | División vertical/horizontal con redimensionamiento por arrastre           |
| **Persistencia de sesiones**    | Auto-guardar/restaurar con preservación de colores ANSI (hasta 3.000 líneas de scrollback) |
| **Integración de shell**        | Indicadores de estado de comandos, visualización del directorio de trabajo, historial de comandos |
| **Buscar en terminal**          | `Ctrl+F` / `Cmd+F` —buscar en la salida del terminal con soporte regex  |
| **Decoraciones de comandos**    | Indicadores visuales de éxito/error/en ejecución en los límites de comandos|
| **Marcas de navegación**        | `Cmd+Up/Down` / `Ctrl+Up/Down` para saltar entre comandos                 |
| **Compresión de scrollback**    | Almacenamiento comprimido con carga progresiva para historiales grandes    |
| **Perfiles de terminal**        | Perfiles de shell por plataforma (bash, zsh, fish, PowerShell, etc.)       |

### Experiencia del Desarrollador

|                        |                                                                    |
| ---------------------- | ------------------------------------------------------------------ |
| **Soporte IME completo** | Entrada en japonés, chino, coreano con manejo estándar de VS Code|
| **Detección de enlaces** | Rutas de archivos abren en VS Code, URLs en el navegador, enlaces de email detectados |
| **Alt+Clic**           | Posicionamiento estándar del cursor de VS Code                     |
| **Seguimiento de ratón** | Soporte para apps TUI (vim, htop, zellij) con modo de ratón automático |
| **Portapapeles completo** | Ctrl/Cmd+C/V con soporte para pegado de imágenes                |
| **Multiplataforma**    | Windows, macOS, Linux —9 compilaciones específicas por plataforma |
| **Accesibilidad**      | Soporte para lectores de pantalla                                  |
| **Panel de depuración** | Monitoreo en tiempo real con `Ctrl+Shift+D`                       |

## Atajos de Teclado

| Atajo                                          | Acción                                               |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | Copiar texto seleccionado (o enviar SIGINT si no hay selección) |
| `Cmd+V` / `Ctrl+V`                            | Pegar (texto e imágenes)                            |
| `Shift+Enter` / `Option+Enter`                | Insertar nueva línea (prompts multilínea de Claude Code) |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | Insertar referencia del archivo actual para agentes de IA |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | Insertar referencias de todos los archivos abiertos para agentes de IA |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | Activar GitHub Copilot Chat                         |
| ``Ctrl+` ``                                   | Enfocar vista de Secondary Terminal                 |
| ``Ctrl+Shift+` ``                             | Crear nuevo terminal                                |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | Dividir terminal verticalmente                      |
| `Cmd+K` / `Ctrl+K`                            | Limpiar terminal                                    |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | Desplazar al comando anterior/siguiente             |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | Enfocar terminal anterior/siguiente                 |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | Enfocar terminal por índice                         |
| `Cmd+R` / `Ctrl+R`                            | Ejecutar comando reciente                           |
| `Cmd+A` / `Ctrl+A`                            | Seleccionar todo el contenido del terminal          |
| `Ctrl+Shift+D`                                | Alternar panel de depuración                        |

> **Consejos para Claude Code**:
>
> - `Cmd+V` en macOS pega tanto texto como imágenes (capturas de pantalla) en Claude Code
> - Usa `Shift+Enter` u `Option+Enter` para insertar nuevas líneas en prompts multilínea

## Configuración

La extensión tiene 90 configuraciones. Estas son las más impactantes para personalizar:

```json
{
  // Apariencia
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // Integración de agentes de IA
  "secondaryTerminal.enableCliAgentIntegration": true,

  // Persistencia de sesiones
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // Vista dividida
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // Integración de shell
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

Busca `secondaryTerminal` en la Configuración de VS Code para ver la lista completa, o consulta [package.json](package.json) para todos los valores predeterminados.

## Rendimiento

| Métrica                  | Valor                                                   |
| ------------------------ | ------------------------------------------------------- |
| **Renderizado**          | WebGL con fallback automático a DOM                     |
| **Buffering de salida**  | Intervalos adaptativos de 2-16ms (hasta 250 fps para salida de IA) |
| **Restauración de scrollback** | <1s para 1.000 líneas con preservación de colores ANSI |
| **Disposición de terminal** | Tiempo de limpieza <100ms                            |
| **Tamaño de compilación** | Extensión ~790 KiB + WebView ~1.5 MiB                 |

## Solución de Problemas

### El terminal no se inicia

- Verifica que `secondaryTerminal.shell` apunte a un shell válido en tu PATH
- Intenta establecer una ruta de shell explícita

### Agente de IA no detectado

- Asegúrate de que `secondaryTerminal.enableCliAgentIntegration` sea `true`
- Revisa los registros de detección en el panel de depuración (`Ctrl+Shift+D`)

### Problemas de rendimiento

- Reduce el valor de `secondaryTerminal.scrollback`
- Verifica los recursos del sistema a través del panel de depuración

### La sesión no se restaura

- Verifica que `secondaryTerminal.enablePersistentSessions` sea `true`
- Usa el comando "Clear Corrupted Terminal History" si los datos están corruptos

### Problemas de visualización TUI

- El seguimiento del ratón se habilita automáticamente para apps como zellij
- Si hay problemas de visualización en modo dividido, intenta cambiar al modo de pantalla completa

## Limitaciones Conocidas

- **Procesos en ejecución**: Los procesos de larga duración se terminan al reiniciar VS Code (el scrollback se preserva). Usa `tmux`/`screen` para persistencia de procesos.
- **Soporte de plataformas**: Alpine Linux y Linux armhf no son compatibles debido a limitaciones de binarios precompilados de node-pty.

## Desarrollo

```bash
npm install && npm run compile    # Compilar
npm test                          # 3.900+ pruebas unitarias
npm run test:e2e                  # Pruebas E2E (Playwright)
npm run watch                     # Modo de vigilancia
```

Calidad: TypeScript modo estricto, flujo de trabajo TDD, 3.900+ pruebas unitarias, cobertura E2E con Playwright, compilaciones CI/CD para 9 plataformas.

## Privacidad

Esta extensión respeta la configuración de telemetría de VS Code. Solo recopilamos métricas de uso anónimas (uso de funciones, tasas de error) —nunca contenido del terminal, rutas de archivos ni datos personales.

Para desactivar: Establece `telemetry.telemetryLevel` en `"off"` en la configuración de VS Code. Consulta [PRIVACY.md](PRIVACY.md) para más detalles.

## Contribuir

1. Haz fork del repositorio
2. Crea una rama de funcionalidad: `git checkout -b feature/my-feature`
3. Sigue las prácticas de TDD
4. Ejecuta las verificaciones de calidad: `npm run pre-release:check`
5. Envía un pull request

Consulta [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) para tareas abiertas.

## Enlaces

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [Repositorio de GitHub](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [Registro de cambios](CHANGELOG.md)
- [Artículo de blog (japonés)](https://zenn.dev/hiraoku/articles/0de654620028a0)

## Licencia

MIT License - consulta el archivo [LICENSE](LICENSE).

---

**Construido para desarrolladores de VS Code que trabajan con agentes de IA**
