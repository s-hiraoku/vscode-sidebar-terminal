# Failure Remedies

Map observed failures to minimum effective edits.

## 1) Under-triggering

Symptoms:
- User asks for skill creation but skill is not loaded.
- User repeatedly calls skill by name manually.

Fixes:
- Add user-language phrases to `description`.
- Add file/context anchors: `SKILL.md`, `frontmatter`, `scripts/references/assets`, `.skill` packaging.
- Add domain phrase variants (create/build/refactor/tune/review).

## 2) Over-triggering

Symptoms:
- Skill loads for unrelated coding tasks.

Fixes:
- Add explicit negative boundary sentence in `description`.
- Remove generic terms ("project", "automation", "development") without skill context.

## 3) Output Drift

Symptoms:
- Generated skills are inconsistent or too verbose.

Fixes:
- Add stricter template in `references/prompt-templates.md`.
- Add a mandatory checklist gate before packaging.
- Move long prose from `SKILL.md` to `references/`.

## 4) Packaging/Validation Failures

Symptoms:
- Missing `SKILL.md`
- Invalid frontmatter
- Name mismatch with folder

Fixes:
- Verify exact file name `SKILL.md`.
- Keep frontmatter minimal and valid YAML.
- Keep `name` as kebab-case and aligned to folder name.

## 5) Tool Reliability Failures

Symptoms:
- Repeated manual corrections in generated outputs.

Fixes:
- Script fragile transformations/checks in `scripts/`.
- Add explicit stepwise validation checkpoints.
