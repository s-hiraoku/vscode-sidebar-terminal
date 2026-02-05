# Secondary Terminal - VS Code Erweiterung

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | **Deutsch**

Deine Seitenleiste, dein Terminal, deine KI-Agenten -- alles an einem Ort. Ein vollwertiges Terminal in der VS Code-Seitenleiste mit integrierter KI-Agenten-Erkennung für Claude Code, Codex CLI, Gemini CLI und GitHub Copilot CLI.

![Demo](resources/readme-hero.png)

## Warum Secondary Terminal?

- **Natives Seitenleisten-Terminal** -- Behalte dein Terminal beim Bearbeiten im Blick. Kein Umschalten des unteren Panels mehr.
- **KI-Agenten-bewusst** -- Erkennt automatisch Claude Code, Copilot, Gemini und Codex. Zeigt den Verbindungsstatus in Echtzeit an und optimiert das Rendering für KI-Streaming-Ausgaben (bis zu 250fps).
- **Vollständig ausgestattet** -- Geteilte Ansichten, Session-Persistenz, Shell-Integration, Terminal-Suche, Befehlsdekorationen, 89 konfigurierbare Einstellungen. Kein Spielzeug -- ein Produktions-Terminal.

## Schnellstart

1. **Installieren**: Suche "Secondary Terminal" in der VS Code-Erweiterungsansicht
   - Auch verfügbar auf [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) (VS Codium, Gitpod) und über [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal): `code --install-extension s-hiraoku.vscode-sidebar-terminal`
2. **Öffnen**: Klicke auf das Terminal-Symbol (ST) in der Aktivitätsleiste
3. **Verwenden**: Ein Terminal öffnet sich mit deiner Standard-Shell. Führe `claude`, `codex`, `gemini` oder `gh copilot` aus und beobachte, wie der KI-Agenten-Status im Header erscheint.

## Funktions-Highlights

### Für KI-Agenten-Workflows

|                            |                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Automatische Erkennung** | Echtzeit-Statusanzeigen für Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI                      |
| **Dateireferenzen**        | `Cmd+Alt+L` / `Ctrl+Alt+L` fügt den aktuellen Dateipfad ein; `Cmd+Alt+A` / `Ctrl+Alt+A` fügt alle geöffneten Dateien ein |
| **Bild einfügen**          | `Cmd+V` auf macOS fügt Screenshots direkt in Claude Code ein                                             |
| **Optimiertes Rendering**  | 250fps adaptives Buffering für KI-Streaming-Ausgaben                                                     |
| **Session-Persistenz**     | Der Terminalzustand überlebt VS Code-Neustarts -- mache dort weiter, wo du aufgehört hast                |
| **Multi-Agent**            | Führe verschiedene Agenten in verschiedenen Terminals aus, wechsle mit `Cmd+Alt+1..5` / `Alt+1..5`      |

### Terminal-Power-Funktionen

|                            |                                                                            |
| -------------------------- | -------------------------------------------------------------------------- |
| **Mehrere Terminals**      | Bis zu 5 gleichzeitige Terminals mit Tab-Verwaltung (Drag & Drop-Sortierung) |
| **Geteilte Ansichten**     | Vertikale/horizontale Teilung mit Drag-Resize                              |
| **Session-Persistenz**     | Auto-Speichern/Wiederherstellen mit ANSI-Farberhaltung (bis zu 3.000 Zeilen Scrollback) |
| **Shell-Integration**      | Befehlsstatusanzeigen, Arbeitsverzeichnis-Anzeige, Befehlshistorie         |
| **Im Terminal suchen**     | `Ctrl+F` / `Cmd+F` -- Terminal-Ausgabe mit Regex-Unterstützung durchsuchen |
| **Befehlsdekorationen**    | Visuelle Erfolgs-/Fehler-/Laufend-Anzeigen an Befehlsgrenzen              |
| **Navigationsmarkierungen** | `Cmd+Up/Down` / `Ctrl+Up/Down` zum Springen zwischen Befehlen            |
| **Scrollback-Komprimierung** | Komprimierter Speicher mit progressivem Laden für große Historien         |
| **Terminal-Profile**       | Shell-Profile pro Plattform (bash, zsh, fish, PowerShell usw.)             |

### Entwicklererfahrung

|                            |                                                                    |
| -------------------------- | ------------------------------------------------------------------ |
| **Volle IME-Unterstützung** | Japanische, chinesische, koreanische Eingabe mit VS Code-Standardverarbeitung |
| **Link-Erkennung**         | Dateipfade öffnen in VS Code, URLs im Browser, E-Mail-Links erkannt |
| **Alt+Klick**              | VS Code-Standard Cursorpositionierung                               |
| **Mausverfolgung**         | TUI-App-Unterstützung (vim, htop, zellij) mit automatischem Mausmodus |
| **Volle Zwischenablage**   | Ctrl/Cmd+C/V mit Bild-Einfügen-Unterstützung                      |
| **Plattformübergreifend**  | Windows, macOS, Linux -- 9 plattformspezifische Builds              |
| **Barrierefreiheit**       | Screenreader-Unterstützung                                          |
| **Debug-Panel**            | Echtzeitüberwachung mit `Ctrl+Shift+D`                              |

## Tastenkürzel

| Kürzel                                         | Aktion                                               |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | Ausgewählten Text kopieren (oder SIGINT senden, wenn keine Auswahl) |
| `Cmd+V` / `Ctrl+V`                            | Einfügen (Text und Bilder)                          |
| `Shift+Enter` / `Option+Enter`                | Zeilenumbruch einfügen (Claude Code mehrzeilige Prompts) |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | Aktuelle Dateireferenz für KI-Agenten einfügen      |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | Alle offenen Dateireferenzen für KI-Agenten einfügen |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | GitHub Copilot Chat aktivieren                      |
| ``Ctrl+` ``                                   | Secondary Terminal-Ansicht fokussieren               |
| ``Ctrl+Shift+` ``                             | Neues Terminal erstellen                            |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | Terminal vertikal teilen                            |
| `Cmd+K` / `Ctrl+K`                            | Terminal leeren                                     |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | Zum vorherigen/nächsten Befehl scrollen             |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | Vorheriges/nächstes Terminal fokussieren             |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | Terminal nach Index fokussieren                     |
| `Cmd+R` / `Ctrl+R`                            | Letzten Befehl ausführen                            |
| `Cmd+A` / `Ctrl+A`                            | Gesamten Terminal-Inhalt auswählen                  |
| `Ctrl+Shift+D`                                | Debug-Panel umschalten                              |

> **Claude Code Tipps**:
>
> - `Cmd+V` auf macOS fügt sowohl Text als auch Bilder (Screenshots) in Claude Code ein
> - Verwende `Shift+Enter` oder `Option+Enter`, um Zeilenumbrüche für mehrzeilige Prompts einzufügen

## Konfiguration

Die Erweiterung hat 89 Einstellungen. Hier sind die wirkungsvollsten zum Anpassen:

```json
{
  // Erscheinungsbild
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // KI-Agenten-Integration
  "secondaryTerminal.enableCliAgentIntegration": true,

  // Session-Persistenz
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // Geteilte Ansicht
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // Shell-Integration
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

Suche `secondaryTerminal` in den VS Code-Einstellungen für die vollständige Liste, oder siehe [package.json](package.json) für alle Standardwerte.

## Leistung

| Metrik                       | Wert                                                    |
| ---------------------------- | ------------------------------------------------------- |
| **Rendering**                | WebGL mit automatischem DOM-Fallback                    |
| **Ausgabe-Buffering**        | Adaptive 2-16ms Intervalle (bis zu 250fps für KI-Ausgabe) |
| **Scrollback-Wiederherstellung** | <1s für 1.000 Zeilen mit ANSI-Farberhaltung         |
| **Terminal-Bereinigung**     | <100ms Aufräumzeit                                      |
| **Build-Größe**              | Erweiterung ~790 KiB + WebView ~1,5 MiB                 |

## Fehlerbehebung

### Terminal startet nicht

- Prüfe, ob `secondaryTerminal.shell` auf eine gültige Shell in deinem PATH zeigt
- Versuche, einen expliziten Shell-Pfad anzugeben

### KI-Agent wird nicht erkannt

- Stelle sicher, dass `secondaryTerminal.enableCliAgentIntegration` auf `true` steht
- Prüfe die Erkennungsprotokolle im Debug-Panel (`Ctrl+Shift+D`)

### Leistungsprobleme

- Reduziere den Wert von `secondaryTerminal.scrollback`
- Überprüfe die Systemressourcen über das Debug-Panel

### Session wird nicht wiederhergestellt

- Stelle sicher, dass `secondaryTerminal.enablePersistentSessions` auf `true` steht
- Verwende den Befehl "Clear Corrupted Terminal History", wenn die Daten beschädigt sind

### TUI-Anzeigeprobleme

- Die Mausverfolgung wird für Apps wie zellij automatisch aktiviert
- Bei Anzeigeproblemen im geteilten Modus versuche, in den Vollbildmodus zu wechseln

## Bekannte Einschränkungen

- **Laufende Prozesse**: Langlebige Prozesse werden beim VS Code-Neustart beendet (Scrollback bleibt erhalten). Verwende `tmux`/`screen` für Prozesspersistenz.
- **Plattformunterstützung**: Alpine Linux und Linux armhf werden aufgrund von Einschränkungen der vorkompilierten node-pty-Binärdateien nicht unterstützt.

## Entwicklung

```bash
npm install && npm run compile    # Bauen
npm test                          # 3.800+ Unit-Tests
npm run test:e2e                  # E2E-Tests (Playwright)
npm run watch                     # Überwachungsmodus
```

Qualität: TypeScript Strict-Modus, TDD-Workflow, 3.800+ Unit-Tests, E2E-Abdeckung mit Playwright, CI/CD-Builds für 9 Plattformen.

## Datenschutz

Diese Erweiterung respektiert die Telemetrie-Einstellungen von VS Code. Wir erheben nur anonyme Nutzungsmetriken (Funktionsnutzung, Fehlerraten) -- niemals Terminalinhalte, Dateipfade oder persönliche Daten.

Zum Deaktivieren: Setze `telemetry.telemetryLevel` auf `"off"` in den VS Code-Einstellungen. Siehe [PRIVACY.md](PRIVACY.md) für Details.

## Beitragen

1. Forke das Repository
2. Erstelle einen Feature-Branch: `git checkout -b feature/my-feature`
3. Befolge TDD-Praktiken
4. Führe Qualitätsprüfungen aus: `npm run pre-release:check`
5. Reiche einen Pull Request ein

Siehe [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) für offene Aufgaben.

## Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [GitHub-Repository](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [Änderungsprotokoll](CHANGELOG.md)
- [Blog-Artikel (Japanisch)](https://zenn.dev/hiraoku/articles/0de654620028a0)

## Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei.

---

**Entwickelt für VS Code-Entwickler, die mit KI-Agenten arbeiten**
