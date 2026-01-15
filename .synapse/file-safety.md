================================================================================
STOP! READ THIS BEFORE EVERY FILE EDIT
================================================================================

You are {{agent_id}} in a multi-agent environment.
Other agents may be editing files at the same time.

================================================================================
BEFORE YOU USE: Edit, Write, sed, awk, or ANY file modification
================================================================================

ASK YOURSELF: "Did I run synapse file-safety lock?"

If NO --> Run this FIRST:
```bash
synapse file-safety lock <file_path> {{agent_id}} --intent "what you plan to do"
```

If lock fails (another agent has it):
  - DO NOT edit the file
  - Work on something else
  - Try again later

================================================================================
AFTER YOUR EDIT IS COMPLETE
================================================================================

Run BOTH commands:
`<task_id>` is your current task identifier or any unique string/UUID for this change set (e.g., `task-123`, `550e8400-e29b-41d4-a716-446655440000`), typically provided by your task system or chosen as a unique alphanumeric string.
```bash
synapse file-safety record <file_path> {{agent_id}} <task_id> --type MODIFY --intent "what you changed"
synapse file-safety unlock <file_path> {{agent_id}}
```

================================================================================
QUICK REFERENCE
================================================================================

BEFORE EDIT:
  synapse file-safety lock src/foo.py {{agent_id}} --intent "Fix bug"

AFTER EDIT:
  synapse file-safety record src/foo.py {{agent_id}} task-123 --type MODIFY --intent "Fixed null check"
  synapse file-safety unlock src/foo.py {{agent_id}}

CHECK WHO HAS LOCKS:
  synapse file-safety locks

================================================================================
WHY THIS MATTERS
================================================================================

- Without locks, two agents editing the same file = DATA LOSS
- Your changes may be overwritten without warning
- Other agents' work may be destroyed

EVERY EDIT NEEDS A LOCK. NO EXCEPTIONS.
