# Gemini Notes for Secondary Terminal Extension

This file is intended to store notes, configurations, or specific instructions relevant to developing and interacting with the Secondary Terminal extension using the Gemini CLI.

## Current Status

- Initial setup complete.
- `CHANGELOG.md` updated with webview refactoring details.

## Role and Context of Gemini CLI

In this project, the Gemini CLI plays the following roles and understands the project context:

- **No Source Code Modification**: In this project, the Gemini CLI cannot directly modify the source code.
- **Document Management**: Responsible for reviewing, updating, and maintaining consistency across all project documentation. This includes keeping `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, and various documents within the `docs/` directory up-to-date and establishing cross-references.
- **Understanding Architecture and Features**: Understands the modular architecture between the VS Code Extension Host and WebView (especially the manager-based structure due to WebView refactoring), and key features such as Alt+Click and CLI Agent integration.
- **Release Process**: Understands the mechanism of the automated release process (GitHub Actions and `npm` scripts) and manages related documentation (`RELEASE_PROCESS.md`).
- **Display of UI/UX Elements**: Possesses knowledge regarding the management of elements in the VS Code UI, such as the display of extension icons.

## Future Considerations

- Add Gemini-specific commands or scripts here.
- Document any common issues or workarounds encountered during Gemini-driven development.
- Store project-specific context that helps Gemini understand the codebase better.
