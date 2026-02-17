# Workflow Patterns to Reuse

## 1) Sequential Orchestration

Use for strict multi-step operations with dependencies.

Include:
- explicit step order
- required inputs/outputs per step
- validation and rollback guidance

## 2) Multi-System Coordination

Use when multiple services or MCP tools must be chained.

Include:
- phase separation
- data handoff contract between phases
- centralized error handling

## 3) Iterative Refinement

Use when output quality improves via review loops.

Include:
- quality criteria
- validate -> refine -> re-validate loop
- stop condition

## 4) Context-Aware Tool Selection

Use when the same user outcome maps to different tools.

Include:
- decision tree with explicit criteria
- fallback behavior
- user-facing explanation of selected path

## 5) Domain-Specific Intelligence

Use when the skill adds specialized policy/compliance logic.

Include:
- pre-action checks
- decision policy
- audit trail requirements
