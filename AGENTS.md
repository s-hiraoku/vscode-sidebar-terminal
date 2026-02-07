## Development Flow (Mandatory)

1. When receiving a feature request or modification, write tests first
2. Present the tests to confirm the specification
3. Proceed to implementation only after confirmation
4. Adjust implementation until all tests pass

<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Repository Guidelines

## Project Structure & Module Organization

- Extension entry point is `src/extension.ts`; feature code is grouped beneath `src/core/`, `src/terminals/`, `src/sessions/`, and `src/webview/`.
- Test suites mirror runtime folders under `src/test/` and share fixtures via `src/test/shared/`.
- Bundled JavaScript emits to `out/`, releases land in `dist/`, assets stay in `resources/`, and telemetry directories (`coverage/`, `report/`, `temp_out/`) remain read-only.

## Build, Test, and Development Commands

- `npm run compile` performs a webpack build; `npm run watch` rebuilds on change.
- `npm run lint` and `npm run format` enforce ESLint plus Prettier before committing.
- Use `npm run test:unit`, `npm run test:integration`, and `npm run test:all` as the quick-to-full Vitest ladder.
- `npm run test:coverage` keeps v8 coverage thresholds (70% lines/functions, 60% branches) satisfied.
- `npm run package` emits the `.vsix` bundle.

## Coding Style & Naming Conventions

- TypeScript uses 2-space indentation, `camelCase` for variables/functions, `PascalCase` for classes, and avoids `any` in favor of explicit VS Code types.
- Centralize enums, literals, and contracts in `src/core/constants/` and `src/core/types/`; keep terminal logic inside `src/terminals/`.
- Run `npm run format` before commits so imports and whitespace stay canonical; ESLint blocks unused imports and unsafe async patterns.

## Testing Guidelines

- Tests run on Vitest with v8 coverage; re-use helpers in `src/test/shared/`.
- Name specs after their subject, e.g. `src/test/unit/terminals/TerminalProcess.test.ts`, to surface intent in coverage reports.
- Start with `npm run test:unit`, escalate to `npm run test:integration` when touching sessions or terminals, and finish with `npm run coverage:check`.

## Commit & Pull Request Guidelines

- Commits follow semantic prefixes (`fix:`, `refactor:`, `docs:`) and stay under 72 characters; reference issues inline (e.g., `Issue #123`).
- Each PR should describe scope, note impacted user flows, attach UI artifacts when relevant, and list executed npm scripts.
- Confirm CI is green and rerun lint, format, and coverage locally.
