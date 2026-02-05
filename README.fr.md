# Secondary Terminal - Extension VS Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/s-hiraoku.vscode-sidebar-terminal)](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
[![Open VSX](https://img.shields.io/open-vsx/v/s-hiraoku/vscode-sidebar-terminal)](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
[![License](https://img.shields.io/github/license/s-hiraoku/vscode-sidebar-terminal)](https://github.com/s-hiraoku/vscode-sidebar-terminal/blob/main/LICENSE)
[![Ask DeepWiki](https://img.shields.io/badge/Ask-DeepWiki-blue)](https://deepwiki.com/s-hiraoku/vscode-sidebar-terminal)

[English](README.md) | [日本語](README.ja.md) | [中文](README.zh-CN.md) | [한국어](README.ko.md) | [Español](README.es.md) | **Français** | [Deutsch](README.de.md)

Votre barre latérale, votre terminal, vos agents IA -- tout en un seul endroit. Un terminal complet qui réside dans la barre latérale de VS Code, avec détection intégrée des agents IA pour Claude Code, Codex CLI, Gemini CLI et GitHub Copilot CLI.

![Démo](resources/readme-hero.png)

## Pourquoi Secondary Terminal ?

- **Terminal natif dans la barre latérale** -- Gardez votre terminal visible pendant l'édition. Plus besoin de basculer le panneau inférieur.
- **Conscient des agents IA** -- Détecte automatiquement Claude Code, Copilot, Gemini et Codex. Affiche l'état de connexion en temps réel et optimise le rendu pour la sortie en streaming IA (jusqu'à 250fps).
- **Complet** -- Vues fractionnées, persistance des sessions, intégration shell, recherche dans le terminal, décorations de commandes, 89 paramètres configurables. Pas un jouet -- un terminal de production.

## Démarrage Rapide

1. **Installer** : Recherchez "Secondary Terminal" dans la vue Extensions de VS Code
   - Également disponible sur [Open VSX](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal) (VSCodium, Gitpod) et via [CLI](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal) : `code --install-extension s-hiraoku.vscode-sidebar-terminal`
2. **Ouvrir** : Cliquez sur l'icône de terminal (ST) dans la barre d'activités
3. **Utiliser** : Un terminal s'ouvre avec votre shell par défaut. Exécutez `claude`, `codex`, `gemini` ou `gh copilot` et observez l'état de l'agent IA apparaître dans l'en-tête.

## Fonctionnalités Principales

### Pour les Flux de Travail avec Agents IA

|                                |                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Détection automatique**      | Indicateurs d'état en temps réel pour Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI             |
| **Références de fichiers**     | `Cmd+Alt+L` / `Ctrl+Alt+L` insère le chemin du fichier actuel ; `Cmd+Alt+A` / `Ctrl+Alt+A` insère tous les fichiers ouverts |
| **Collage d'images**           | `Cmd+V` sur macOS colle les captures d'écran directement dans Claude Code                                |
| **Rendu optimisé**             | Buffering adaptatif 250fps pour la sortie en streaming IA                                                |
| **Persistance des sessions**   | L'état du terminal survit aux redémarrages de VS Code -- reprenez là où vous vous êtes arrêté            |
| **Multi-agents**               | Exécutez différents agents dans différents terminaux, basculez avec `Cmd+Alt+1..5` / `Alt+1..5`         |

### Fonctionnalités Avancées du Terminal

|                                  |                                                                            |
| -------------------------------- | -------------------------------------------------------------------------- |
| **Terminaux multiples**          | Jusqu'à 5 terminaux simultanés avec gestion d'onglets (glisser-déposer)   |
| **Vues fractionnées**            | Fractionnement vertical/horizontal avec redimensionnement par glissement   |
| **Persistance des sessions**     | Sauvegarde/restauration automatique avec préservation des couleurs ANSI (jusqu'à 3 000 lignes de scrollback) |
| **Intégration shell**            | Indicateurs d'état des commandes, affichage du répertoire de travail, historique des commandes |
| **Recherche dans le terminal**   | `Ctrl+F` / `Cmd+F` -- recherche dans la sortie du terminal avec support regex |
| **Décorations de commandes**     | Indicateurs visuels succès/erreur/en cours aux limites des commandes       |
| **Marqueurs de navigation**      | `Cmd+Up/Down` / `Ctrl+Up/Down` pour naviguer entre les commandes          |
| **Compression du scrollback**    | Stockage compressé avec chargement progressif pour les historiques volumineux |
| **Profils de terminal**          | Profils shell par plateforme (bash, zsh, fish, PowerShell, etc.)           |

### Expérience Développeur

|                            |                                                                    |
| -------------------------- | ------------------------------------------------------------------ |
| **Support IME complet**    | Saisie japonaise, chinoise, coréenne avec gestion standard VS Code |
| **Détection de liens**     | Les chemins de fichiers s'ouvrent dans VS Code, les URLs dans le navigateur, les liens email détectés |
| **Alt+Clic**               | Positionnement standard du curseur VS Code                         |
| **Suivi de souris**        | Support des apps TUI (vim, htop, zellij) avec mode souris automatique |
| **Presse-papiers complet** | Ctrl/Cmd+C/V avec support du collage d'images                     |
| **Multiplateforme**        | Windows, macOS, Linux -- 9 builds spécifiques par plateforme       |
| **Accessibilité**          | Support des lecteurs d'écran                                       |
| **Panneau de débogage**    | Surveillance en temps réel avec `Ctrl+Shift+D`                     |

## Raccourcis Clavier

| Raccourci                                      | Action                                               |
| --------------------------------------------- | --------------------------------------------------- |
| `Cmd+C` / `Ctrl+C`                            | Copier le texte sélectionné (ou envoyer SIGINT si pas de sélection) |
| `Cmd+V` / `Ctrl+V`                            | Coller (texte et images)                            |
| `Shift+Enter` / `Option+Enter`                | Insérer un saut de ligne (prompts multilignes Claude Code) |
| `Cmd+Alt+L` / `Ctrl+Alt+L`                    | Insérer la référence du fichier actuel pour les agents IA |
| `Cmd+Alt+A` / `Ctrl+Alt+A`                    | Insérer les références de tous les fichiers ouverts pour les agents IA |
| `Cmd+K Cmd+C` / `Ctrl+K Ctrl+C`               | Activer GitHub Copilot Chat                         |
| ``Ctrl+` ``                                   | Mettre le focus sur la vue Secondary Terminal        |
| ``Ctrl+Shift+` ``                             | Créer un nouveau terminal                           |
| `Cmd+\` (Mac) / `Ctrl+Shift+5`                | Fractionner le terminal verticalement               |
| `Cmd+K` / `Ctrl+K`                            | Effacer le terminal                                 |
| `Cmd+Up/Down` (Mac) / `Ctrl+Up/Down`          | Défiler vers la commande précédente/suivante        |
| `Alt+Cmd+Left/Right` (Mac) / `Alt+Left/Right` | Mettre le focus sur le terminal précédent/suivant   |
| `Cmd+Alt+1..5` (Mac) / `Alt+1..5`             | Mettre le focus sur le terminal par index           |
| `Cmd+R` / `Ctrl+R`                            | Exécuter la commande récente                        |
| `Cmd+A` / `Ctrl+A`                            | Sélectionner tout le contenu du terminal            |
| `Ctrl+Shift+D`                                | Basculer le panneau de débogage                     |

> **Astuces Claude Code** :
>
> - `Cmd+V` sur macOS colle à la fois le texte et les images (captures d'écran) dans Claude Code
> - Utilisez `Shift+Enter` ou `Option+Enter` pour insérer des sauts de ligne dans les prompts multilignes

## Configuration

L'extension dispose de 89 paramètres. Voici les plus impactants à personnaliser :

```json
{
  // Apparence
  "secondaryTerminal.fontSize": 12,
  "secondaryTerminal.fontFamily": "monospace",
  "secondaryTerminal.cursorStyle": "block",
  "secondaryTerminal.scrollback": 2000,

  // Intégration des agents IA
  "secondaryTerminal.enableCliAgentIntegration": true,

  // Persistance des sessions
  "secondaryTerminal.enablePersistentSessions": true,
  "secondaryTerminal.persistentSessionScrollback": 1000,

  // Vue fractionnée
  "secondaryTerminal.maxSplitTerminals": 5,
  "secondaryTerminal.dynamicSplitDirection": true,

  // Intégration shell
  "secondaryTerminal.shellIntegration.enabled": true,
  "secondaryTerminal.shellIntegration.showCommandStatus": true
}
```

Recherchez `secondaryTerminal` dans les Paramètres de VS Code pour la liste complète, ou consultez [package.json](package.json) pour tous les valeurs par défaut.

## Performances

| Métrique                     | Valeur                                                  |
| ---------------------------- | ------------------------------------------------------- |
| **Rendu**                    | WebGL avec repli automatique sur DOM                    |
| **Buffering de sortie**      | Intervalles adaptatifs 2-16ms (jusqu'à 250fps pour sortie IA) |
| **Restauration du scrollback** | <1s pour 1 000 lignes avec préservation des couleurs ANSI |
| **Suppression du terminal**  | Temps de nettoyage <100ms                               |
| **Taille de build**          | Extension ~790 KiB + WebView ~1,5 MiB                   |

## Dépannage

### Le terminal ne démarre pas

- Vérifiez que `secondaryTerminal.shell` pointe vers un shell valide dans votre PATH
- Essayez de définir un chemin de shell explicite

### Agent IA non détecté

- Assurez-vous que `secondaryTerminal.enableCliAgentIntegration` est `true`
- Vérifiez les journaux de détection dans le panneau de débogage (`Ctrl+Shift+D`)

### Problèmes de performances

- Réduisez la valeur de `secondaryTerminal.scrollback`
- Vérifiez les ressources système via le panneau de débogage

### La session ne se restaure pas

- Vérifiez que `secondaryTerminal.enablePersistentSessions` est `true`
- Utilisez la commande "Clear Corrupted Terminal History" si les données sont corrompues

### Problèmes d'affichage TUI

- Le suivi de souris est activé automatiquement pour les apps comme zellij
- Si des problèmes d'affichage surviennent en mode fractionné, essayez de passer en mode plein écran

## Limitations Connues

- **Processus en cours** : Les processus de longue durée se terminent au redémarrage de VS Code (le scrollback est préservé). Utilisez `tmux`/`screen` pour la persistance des processus.
- **Support des plateformes** : Alpine Linux et Linux armhf ne sont pas pris en charge en raison des limitations des binaires précompilés de node-pty.

## Développement

```bash
npm install && npm run compile    # Compiler
npm test                          # 3 800+ tests unitaires
npm run test:e2e                  # Tests E2E (Playwright)
npm run watch                     # Mode surveillance
```

Qualité : TypeScript mode strict, workflow TDD, 3 800+ tests unitaires, couverture E2E avec Playwright, builds CI/CD pour 9 plateformes.

## Confidentialité

Cette extension respecte les paramètres de télémétrie de VS Code. Nous ne collectons que des métriques d'utilisation anonymes (utilisation des fonctionnalités, taux d'erreurs) -- jamais le contenu du terminal, les chemins de fichiers ou les données personnelles.

Pour désactiver : Définissez `telemetry.telemetryLevel` sur `"off"` dans les paramètres de VS Code. Consultez [PRIVACY.md](PRIVACY.md) pour plus de détails.

## Contribuer

1. Forkez le dépôt
2. Créez une branche de fonctionnalité : `git checkout -b feature/my-feature`
3. Suivez les pratiques TDD
4. Exécutez les vérifications de qualité : `npm run pre-release:check`
5. Soumettez une pull request

Consultez [GitHub Issues](https://github.com/s-hiraoku/vscode-sidebar-terminal/issues) pour les tâches ouvertes.

## Liens

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=s-hiraoku.vscode-sidebar-terminal)
- [Open VSX Registry](https://open-vsx.org/extension/s-hiraoku/vscode-sidebar-terminal)
- [Dépôt GitHub](https://github.com/s-hiraoku/vscode-sidebar-terminal)
- [Journal des modifications](CHANGELOG.md)
- [Article de blog (japonais)](https://zenn.dev/hiraoku/articles/0de654620028a0)

## Licence

MIT License - consultez le fichier [LICENSE](LICENSE).

---

**Conçu pour les développeurs VS Code travaillant avec des agents IA**
