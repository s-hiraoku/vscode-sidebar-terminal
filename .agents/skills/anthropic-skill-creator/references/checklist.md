# Skill Checklist (High Precision)

## Before Start

- 2-3 concrete use cases defined
- Trigger phrases collected from realistic user wording
- Success criteria defined (trigger, quality, reliability)

## During Authoring

- Folder name is kebab-case
- `SKILL.md` exists with exact spelling
- Frontmatter includes required fields
  - `name`
  - `description` (WHAT + WHEN)
- Description includes concrete trigger phrases
- Description includes file types when relevant
- Description avoids overly broad terms
- Core steps are imperative and actionable
- Common failures include explicit remedies
- Deep details moved to `references/`
- No extra docs inside skill folder (README/changelog/etc.)

## Before Release

- Triggering tests pass (obvious/paraphrase/non-trigger)
- Functional tests pass (happy path + edge cases)
- Baseline comparison run (with vs without skill)
- Validation command passes
- Packaging command succeeds

## After Release

- Monitor under-trigger and over-trigger behavior
- Gather failed prompts and misfires
- Update description and instructions using failures
- Re-run tests after each revision
