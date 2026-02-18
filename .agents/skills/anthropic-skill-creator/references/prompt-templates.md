# Prompt Templates

## 1) Collect Use Cases

```text
I am creating a skill. Give me 3 concrete user requests that should trigger it and 3 that should NOT trigger it.
For each trigger request, include expected outcome and critical failure risks.
```

## 2) Generate Frontmatter Candidates

```text
Given these use cases, generate 3 candidate `description` strings.
Each must include: what the skill does, when to use it, and concrete trigger phrases.
Also suggest one negative trigger sentence to avoid over-triggering.
```

## 3) Build Test Suite

```text
From this skill description, create:
- 10 trigger test prompts (should trigger)
- 10 paraphrased trigger prompts (should trigger)
- 10 unrelated prompts (should not trigger)
Return as a markdown checklist.
```

## 4) Failure-Driven Revision

```text
These prompts failed or misfired:
[paste]
Propose the minimum edits to:
1) description
2) core workflow steps
3) validations/error handling
Keep SKILL.md concise and move details to references if needed.
```
