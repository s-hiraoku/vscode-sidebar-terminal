# Trigger Examples

Use this file to tune `description` for high precision.

## Should Trigger

- "新しい skill を作りたい。SKILL.md の書き方を決めてほしい"
- "この skill が発火しないので frontmatter を修正したい"
- "過剰に trigger するので description を狭めたい"
- "scripts/references/assets の設計を見直したい"
- "skill のテストケースを作って品質確認したい"
- "配布前に package できる形へ整えたい"

## Should Not Trigger

- "React のバグを直して"
- "SQL クエリを最適化して"
- "この画像の色味を調整して"
- "Jotai の atom 設計をレビューして"

## Description Tuning Patterns

- Too broad:
  - "Helps create projects"
- Better:
  - "Design and improve Claude/Codex skills. Use when creating SKILL.md, tuning frontmatter triggers, organizing scripts/references/assets, and validating packaging."

## Negative Trigger Pattern

Append a boundary sentence when over-triggering occurs:

- "Do not use for general coding/debugging tasks unless the user explicitly asks to create or improve a skill."
