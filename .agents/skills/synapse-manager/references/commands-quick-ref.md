# Commands Quick Reference

| Command | Purpose |
|---------|---------|
| `synapse list` | Check agent status (auto-updates; `--json` for JSON array) |
| `synapse spawn <type\|id> --name <n> --role "<r>"` | Start agent (ad-hoc or from saved definition) |
| `synapse send <name> "<msg>" --silent` | Delegate task (fire-and-forget) |
| `synapse send <name> "<msg>" --task --silent` | Delegate with auto-created board task (`-T` shorthand) |
| `synapse send <name> "<msg>" --wait` | Request reply (blocking) |
| `synapse send <name> "<msg>" --attach <file>` | Send with reference files |
| `synapse broadcast "<msg>" --priority <n>` | Message all agents |
| `synapse interrupt <name> "<msg>"` | Urgent status check (priority 4) |
| `synapse tasks create "<subject>" -d "<desc>" --priority <n> [--group G] [--component C] [--milestone M]` | Create task on board |
| `synapse tasks assign <id> <agent>` | Assign task |
| `synapse tasks complete <id>` | Mark task done |
| `synapse tasks fail <id> --reason "<why>"` | Mark task failed |
| `synapse tasks reopen <id>` | Reopen a completed or failed task |
| `synapse tasks purge [--status STATUS] [--older-than DURATION] [--dry-run]` | Delete tasks (all, by status, by age, or preview) |
| `synapse approve <id>` | Approve agent plan |
| `synapse reject <id> --reason "<feedback>"` | Reject with guidance |
| `synapse tasks accept-plan <plan_id>` | Accept plan card and register steps as board tasks |
| `synapse tasks sync-plan <plan_id>` | Sync task board progress back to plan card |
| `synapse canvas plan '<json>' --title "<title>"` | Post a plan card (Mermaid DAG + step list) |
| `synapse memory save <key> "<content>" --tags <t> --notify` | Share knowledge |
| `synapse memory search "<query>"` | Find shared knowledge |
| `synapse history list --agent <name>` | Check task history |
| `synapse history stats --agent <name>` | Token/cost breakdown |
| `synapse trace <task_id>` | Full audit trail |
| `synapse kill <name> -f` | Terminate agent |
