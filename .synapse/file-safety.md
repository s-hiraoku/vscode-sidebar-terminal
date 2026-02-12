================================================================================
CRITICAL: FILE LOCK REQUIRED BEFORE ANY EDIT
================================================================================

You are {{agent_id}} in a MULTI-AGENT environment.
Other agents may be editing files RIGHT NOW.

================================================================================
MANDATORY WORKFLOW
================================================================================

STEP 1: BEFORE EVERY FILE EDIT
-------------------------------
ALWAYS run this FIRST - no exceptions:

```bash
synapse file-safety lock <file_path> {{agent_id}} --intent "what you plan to do"
```

STEP 2: VERIFY LOCK STATUS
--------------------------
Confirm you have the lock before proceeding:

```bash
synapse file-safety locks
```

STEP 3: AFTER EDIT COMPLETE
---------------------------
Record and release the lock:

```bash
synapse file-safety record <file_path> {{agent_id}} --type MODIFY --intent "what you changed"
synapse file-safety unlock <file_path> {{agent_id}}
```

================================================================================
WHAT HAPPENS IF YOU FORGET
================================================================================

- Your changes MAY BE OVERWRITTEN by another agent
- Data loss is PERMANENT
- No recovery possible
- Other agents' work may be destroyed

================================================================================
IF LOCK FAILS (ANOTHER AGENT HAS IT)
================================================================================

- DO NOT edit the file
- Check who has the lock: synapse file-safety locks
- Work on something else first
- Coordinate with the lock holder if urgent
- Try again later

================================================================================
QUICK REFERENCE TABLE
================================================================================

| Action          | Command                                              |
|-----------------|------------------------------------------------------|
| Lock file       | synapse file-safety lock FILE {{agent_id}}           |
| Unlock file     | synapse file-safety unlock FILE {{agent_id}}         |
| Check locks     | synapse file-safety locks                            |
| Record change   | synapse file-safety record FILE {{agent_id}} --type MODIFY |

================================================================================
EXAMPLE WORKFLOW
================================================================================

BEFORE EDITING src/foo.py:

```bash
synapse file-safety lock src/foo.py {{agent_id}} --intent "Fix null check bug"
synapse file-safety locks  # Verify lock acquired
```

AFTER EDITING src/foo.py:

```bash
synapse file-safety record src/foo.py {{agent_id}} --type MODIFY --intent "Added null check"
synapse file-safety unlock src/foo.py {{agent_id}}
```

================================================================================
CHECKLIST BEFORE USING Edit/Write TOOLS
================================================================================

[ ] Did I run: synapse file-safety lock <file> {{agent_id}}?
[ ] Did I verify: synapse file-safety locks?
[ ] If lock failed, am I working on a different file instead?

If any answer is NO --> STOP and run the lock command first!

EVERY EDIT NEEDS A LOCK. NO EXCEPTIONS.
