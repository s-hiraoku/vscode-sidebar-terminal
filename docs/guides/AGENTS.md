# Repository Guidelines

## Project Structure & Module Organization
- `src/extension.ts` boots the VS Code extension; domain folders (`core/`, `services/`, `terminals/`, `webview/`) keep host vs WebView logic separated.
- `src/test/{unit,integration,performance}` holds TypeScript specs; tests compile into `out/`.
- `dist/` contains webpack bundles; clean rebuilds overwrite it.
- `scripts/` and `commands/` supply TDD automation and release tooling; `docs/` houses deep dives (TDD, debugging, agent specs); `resources/` stores marketplace assets.

## Build, Test, and Development Commands
- `npm run compile` builds the extension with webpack.
- `npm run watch` rebuilds on change during local debugging (`Run Extension` launch config).
- `npm run pre-release:check` runs coverage, lint, and quality gates; treat as mandatory before tagging or PRs.
- `npm run package` emits the production bundle; use `npm run vsce:package` for a VSIX artifact.
- `npm run format` applies the canonical Prettier profile.

## Coding Style & Naming Conventions
- TypeScript with ESLint + Prettier: 2-space indent, single quotes, trailing commas, 100-char lines, semicolons on.
- Prefer PascalCase filenames for managers/services (`TerminalStateManager.ts`), camelCase for functions, SCREAMING_CASE for constants in `constants/`.
- Avoid `any`; extend shared interfaces in `src/interfaces/` or `src/types/`. Document cross-cutting utilities with short comments when behavior is non-obvious.

## Testing Guidelines
- Compile tests first (`npm run compile-tests`) if TypeScript types drift.
- `npm test` delegates to `npm run test:unit`; use `npm run test:integration` and `npm run test:performance` for broader coverage.
- Enforce coverage by running `npm run coverage:check` (70% lines/functions, 60% branches). Place new specs under `src/test/<tier>/**/<feature>.test.ts`.
- Review `docs/TDD_GUIDELINES.md` for workflow expectations (red/green/refactor scripts and reporting).

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in recent history.
- Branch from `main` using `feature/<topic>` or `fix/<issue>`.
- Before opening a PR, ensure `npm run pre-release:check` passes, docs are updated, and relevant screenshots/GIFs illustrate UI changes.
- PR descriptions should link issues, note testing performed, and call out agent-impacting changes (Claude/Gemini/Copilot detection).
